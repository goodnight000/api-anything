/**
 * Captured exchanges + example args -> an Operation (DESIGN.md "Learning", steps 1-8).
 * Only example-arg values become params; everything else is kept verbatim.
 */
import {
  asText,
  type Escape,
  escapeTemplate,
  escapeValue,
  fillSlotTemplate,
  fillTemplate,
  getAt,
  type Leaf,
  type Step,
  setAt,
  templateRefs,
  walk,
} from "./codec.js";
import { inferShape, innerJson, parseBody, xssiOf } from "./extract.js";
import { loggedIn, parseCookieHeader } from "./session.js";
import {
  type Match,
  type Operation,
  OperationSchema,
  type Param,
  type Request,
  type ResponseSpec,
  type Slot,
  type Trigger,
  type Volatile,
} from "./spec.js";
import type { CaptureResult, Exchange, StoredCookie } from "./types.js";

export type Args = Record<string, unknown>;

export interface LearnInput {
  exchanges: Exchange[];
  /** the second trigger run, made with examples[1] */
  exchanges2?: Exchange[];
  examples: [Args] | [Args, Args];
  cookies: StoredCookie[];
  match?: Match;
  /** exchange id to learn from, when the agent already chose one */
  id?: number;
  name: string;
  trigger: Trigger;
  readOnly: boolean;
  loginCookies?: string[];
  /** header or field names a human marked as public constants: kept literal, never session refs */
  public?: string[];
  /** the page origin's localStorage/sessionStorage at capture time: a request repeating a value is a session: ref */
  storage?: Record<string, string>;
  /** when several requests carry the values, prefer one this accepts (the response recipe resolves on it) */
  accepts?: (e: Exchange) => boolean;
  /** where the page was during the capture (capturePages): an echo of these is not evidence */
  pages?: string[];
}

export interface Learned {
  operation: Operation;
  /** the captured request it was learned from */
  exchange: Exchange;
  warnings: string[];
  /** literal values of session: refs, for the session store; never written to the spec */
  sessionValues: Record<string, string>;
}

/* ------------------------------------------------------------------ noise */

export const ASSET_EXT =
  /\.(js|mjs|cjs|jsx|ts|css|scss|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|wasm|map|pdf|zip)$/i;
const DENY_RESOURCE = new Set([
  "image",
  "font",
  "stylesheet",
  "script",
  "media",
  "manifest",
  "texttrack",
  "websocket",
  "eventsource",
  "preflight",
  "ping",
  "cspviolationreport",
]);
const DENY_MIME =
  /^(image|font|video|audio)\/|^text\/(css|javascript)|^application\/(javascript|x-javascript|font|octet-stream|wasm)/i;
const ANALYTICS =
  /google-analytics\.com|googletagmanager\.com|doubleclick\.net|sentry\.io|\/sentry\/|segment\.(io|com)|mixpanel\.com|amplitude\.com|hotjar\.com|facebook\.com\/tr|clarity\.ms|nr-data\.net|datadoghq|\/(collect|beacon|log_event|telemetry|jot|csp-report|client_event|tracking|logging)(\/|\?|$)/i;
// Pages and APIs can end in .js (github.com/vercel/next.js, /repos/chart.js): the extension only means an asset for subresources.
const DATA_RESOURCE = new Set(["document", "xhr", "fetch"]);

function isNoise(e: Exchange): boolean {
  if (e.request.method.toUpperCase() === "OPTIONS") return true;
  if (DENY_RESOURCE.has(e.resourceType.toLowerCase())) return true;
  let url: URL;
  try {
    url = new URL(e.request.url);
  } catch {
    return true;
  }
  if ((!DATA_RESOURCE.has(e.resourceType) && ASSET_EXT.test(url.pathname)) || ANALYTICS.test(e.request.url))
    return true;
  if (e.aborted) return false;
  if (!e.response) return true;
  if (e.response.status >= 300 && e.response.status < 400) return true;
  // Media is never data, even fetched by XHR (video segments); otherwise XHR/fetch are data by
  // definition: Instagram's GraphQL answers JSON as text/javascript.
  if (/^(image|font|video|audio)\//i.test(e.response.contentType)) return true;
  return e.resourceType !== "xhr" && e.resourceType !== "fetch" && DENY_MIME.test(e.response.contentType);
}

/* ------------------------------------------------------------- candidates */

export interface Candidate {
  id: number;
  method: string;
  url: string;
  resourceType: string;
  status?: number;
  contentType?: string;
  operationName?: string;
  /** params whose example value the request carries */
  hits: string[];
  size: number;
  score: number;
}

// The page URL rides along in these on every XHR, so they say nothing about which request carries the args.
const NOT_EVIDENCE = new Set(["header:cookie", "header:referer", "header:origin"]);
// Telemetry posts the page URL in its body (web-vitals, perf logs); a value seen only inside a URL is weak evidence.
const URLISH = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Lower-cased and percent-decoded (up to 3 layers, + as a space): a location reads the same in any leaf. */
function norm(s: string): string {
  let out = s.toLowerCase();
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(out.replace(/\+/g, " "));
    } catch {
      break;
    }
    if (next === out) break;
    out = next;
  }
  return out.replace(/\+/g, " ");
}

/** Every URL a run's page had: its main frame's locations (pushState included) and where it ended. */
export const capturePages = (c: CaptureResult): string[] => [...(c.locations ?? []), c.finalUrl].filter(Boolean);

/** The pages a capture ran on: its documents, every Referer, and any extra (the filled trigger, capturePages). */
export function pageUrls(exchanges: Exchange[], extra: string[] = []): string[] {
  const urls = new Set(extra);
  for (const e of exchanges) {
    if (e.resourceType === "document") urls.add(e.request.url);
    if (e.request.headers.referer) urls.add(e.request.headers.referer);
  }
  return [...urls];
}

type Locations = { abs: string[]; rel: string[] };

/**
 * What a page's location looks like when a script echoes it (normalized): absolute forms (href,
 * origin) anywhere in a leaf, relative ones (path, search) at its start, since a leaf that merely
 * contains `?q=x` (a `next=/search?q=x&sig=..` param) is its own URL, not the page's.
 */
function locations(pages: string[]): Locations {
  const abs = new Set<string>();
  const rel = new Set<string>();
  for (const p of pages) {
    let u: URL;
    try {
      u = new URL(p);
    } catch {
      continue;
    }
    for (const s of [u.origin + u.pathname + u.search, u.origin + u.pathname, u.origin]) abs.add(norm(s));
    for (const s of [u.pathname + u.search, u.pathname, u.search]) if (s.length > 1) rel.add(norm(s));
  }
  return { abs: [...abs], rel: [...rel] };
}

/**
 * A leaf that holds the page's own location around the value (analytics `context.page.url`, an
 * x-page-path header, `src=`/`redirect=` params) is an echo, not evidence: it would carry the
 * value whatever request it rode on. Structural, from the capture's page URLs, not a name list.
 */
function echoes(text: string, v: string, locs: Locations): boolean {
  const want = norm(v);
  const t = norm(text);
  const of = (l: string) => l.length > want.length && l.includes(want);
  return locs.abs.some((l) => of(l) && t.includes(l)) || locs.rel.some((l) => of(l) && t.startsWith(l));
}

/** A 2xx that carries no data: empty, or a tiny body of flags (`{"success":true}`, `OK`): a beacon's answer. */
function isAck(e: Exchange): boolean {
  const r = e.response;
  if (!r || r.status < 200 || r.status >= 300) return false;
  const body = (r.body ?? "").trim();
  if (body.length > 100) return false;
  const flags = (v: unknown): boolean =>
    v === null ||
    typeof v === "boolean" ||
    (typeof v === "string" && /^\w{0,8}$/.test(v)) ||
    (typeof v === "object" && Object.values(v).every(flags));
  const data = tryParse(body);
  return flags(data === undefined ? body : data);
}

/** The text an example is searched by; an array example by its first element. */
function exampleText(v: unknown): string {
  if (Array.isArray(v)) return asText(v.find((x) => asText(x).length >= 3) ?? v[0]).toLowerCase();
  return asText(v).toLowerCase();
}

function exampleValues(args: Args): [string, string][] {
  return Object.entries(args).map(([k, v]) => [k, exampleText(v)]);
}

function tryParse(body: string | undefined): unknown {
  if (!body) return undefined;
  try {
    return parseBody(body);
  } catch {
    return undefined;
  }
}

/**
 * Noise-filtered requests, best first: carries the example values, succeeded, returned JSON.
 * `all`: the caller already chose the pool (a match), so only preflights are dropped.
 * `pages`: the capture's page URLs (default: its documents and Referers); a value found only in an
 * echo of them is no hit. A data-less answer (a beacon's ack) ranks below every real answer.
 */
export function rankCandidates(
  exchanges: Exchange[],
  args: Args = {},
  o: { all?: boolean; pages?: string[] } = {},
): Candidate[] {
  const values = exampleValues(args).filter(([, v]) => v.length >= 3);
  const locs = locations(o.pages ?? pageUrls(exchanges));
  return exchanges
    .filter((e) => (o.all ? e.request.method.toUpperCase() !== "OPTIONS" : !isNoise(e)))
    .map((e) => {
      const all = walk(e.request).filter((l) => !NOT_EVIDENCE.has(l.at[0]!));
      const leaves = (v: string) => all.filter((l) => !echoes(l.value, v, locs));
      const has = (v: string, ls: Leaf[]) => ls.some((l) => l.value.toLowerCase().includes(v));
      // a URL-valued example (a link preview's ?url=) is evidence in a URL-valued leaf
      const direct = (v: string) => leaves(v).filter((l) => !l.container && (!URLISH.test(l.value) || URLISH.test(v)));
      const hits = values.filter(([, v]) => has(v, direct(v))).map(([k]) => k);
      const urlHits = values.filter(([k, v]) => !hits.includes(k) && has(v, leaves(v))).length;
      const body = e.response?.body ?? "";
      const parsed = tryParse(body);
      const json = parsed !== null && typeof parsed === "object";
      const status = e.response?.status;
      const lower = values.length ? body.toLowerCase() : "";
      const score =
        hits.length * 1000 +
        urlHits * 50 +
        (e.aborted ? 600 : 0) +
        (status !== undefined && status >= 200 && status < 300 ? 300 : 0) +
        (json ? 400 : 0) +
        (e.resourceType === "xhr" || e.resourceType === "fetch" ? 100 : 0) +
        (values.some(([, v]) => lower.includes(v)) ? 200 : 0) +
        Math.min(body.length / 1000, 100);
      return {
        id: e.id,
        method: e.request.method.toUpperCase(),
        url: e.request.url,
        resourceType: e.resourceType,
        status,
        contentType: e.response?.contentType,
        operationName: operationNameOf(e.request),
        hits,
        size: body.length,
        // a read's answer is data: an ack with hits still ranks below any real answer with one
        score: Math.round(isAck(e) ? score / 10 : score),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ match */

function tryGet(req: Request, at: Step[]): unknown {
  try {
    return getAt(req, at);
  } catch {
    return undefined;
  }
}

const GQL_NAME = /(?:^|\})\s*(?:query|mutation|subscription)\s+([A-Za-z_]\w*)/;

/**
 * GraphQL-ish operation name from the body (a batch's first op too), form, query, or Meta's
 * friendly-name header; else the name in the query text (`query SearchProducts(...)`).
 */
export function operationNameOf(req: Request): string | undefined {
  const fields = [
    ["body", "json:/operationName"],
    ["body", "json:/0/operationName"],
    ["form:fb_api_req_friendly_name"],
    ["form:operationName"],
    ["query:operationName"],
    ["header:x-fb-friendly-name"],
  ];
  for (const at of fields) {
    const v = tryGet(req, at);
    if (typeof v === "string" && v) return v;
  }
  for (const at of [["body", "json:/query"], ["body", "json:/0/query"], ["form:query"], ["query:query"]]) {
    const v = tryGet(req, at);
    const m = typeof v === "string" ? GQL_NAME.exec(v) : null;
    if (m) return m[1];
  }
  return undefined;
}

/** camelCase/PascalCase/snake/kebab words ("UserByScreenName") are names, not hashes. */
const wordy = (s: string) =>
  !/\d/.test(s) && s.split(/[_-]|(?=[A-Z])/).every((w) => w === "" || /^[A-Z]?[a-z]+$/.test(w));
/** Long random-looking token: a queryId/hash, never a word. A digit is not required (~2% of base64url ids lack one). */
export const hashLike = (s: string) => s.length >= 16 && /^[A-Za-z0-9_-]+$/.test(s) && /[A-Za-z]/.test(s) && !wordy(s);

export function matches(m: Match, req: Request): boolean {
  let u: URL;
  try {
    u = new URL(req.url);
  } catch {
    return false;
  }
  if (m.method && m.method.toUpperCase() !== req.method.toUpperCase()) return false;
  if (m.host && m.host.toLowerCase() !== u.hostname.toLowerCase()) return false;
  if (m.path) {
    const want = m.path.split("/");
    const got = u.pathname.split("/");
    if (want.length !== got.length || want.some((w, i) => w !== "*" && w !== got[i])) return false;
  }
  if (m.operationName && operationNameOf(req) !== m.operationName) return false;
  return true;
}

/** Stable identity, with param and hash-like path segments wildcarded. */
function buildMatch(req: Request, slots: Slot[]): Match {
  const paramSegments = new Set(
    slots
      .filter((s) => s.param && s.at.length === 1 && s.at[0]!.startsWith("path:"))
      .map((s) => Number(s.at[0]!.slice(5))),
  );
  const u = new URL(req.url);
  const path = u.pathname
    .split("/")
    .map((seg, i) => (i > 0 && (paramSegments.has(i - 1) || hashLike(seg) || /^\d{6,}$/.test(seg)) ? "*" : seg))
    .join("/");
  const operationName = operationNameOf(req);
  return { method: req.method.toUpperCase(), host: u.hostname, path, ...(operationName ? { operationName } : {}) };
}

/* --------------------------------------------------------------- learning */

// Conditional headers (a revalidating browser's If-None-Match) would turn every replay into a 304.
// The body is stored decoded, so its content-encoding goes too.
const DROP_HEADER = /^(:.*|host|content-length|connection|cookie|accept-encoding|content-encoding|if-[a-z-]+)$/i;
const SESSION_HEADER =
  /^(authorization|x-[a-z0-9-]*token|x-csrf[a-z0-9-]*|x-xsrf[a-z0-9-]*|x-goog-batchexecute-bgr|x-client-transaction-id|x-fb-lsd|x-ig-www-claim)$/i;
// Per-session credentials sent in forms, queries or JSON bodies: Google's `at`, Meta's fb_dtsg/lsd,
// Rails', ASP.NET's anti-CSRF fields, and OAuth-style access tokens.
const SESSION_FIELD =
  /^(at|fb_dtsg|lsd|authenticity_token|__RequestVerificationToken|_?csrf(_?token)?|_?xsrf(_?token)?|csrfmiddlewaretoken|(access_?)?token|session_?id)$/i;
// Headers the browser computes itself: an example inside them is a coincidence ("apple" in the
// user-agent, "app" in application/json), and they never carry a nonce of the site's.
const BROWSER_HEADER =
  /^(user-agent|accept(-[a-z-]+)?|content-(type|language)|sec-[a-z0-9-]+|if-[a-z-]+|priority|dnt|upgrade-insecure-requests|cache-control|pragma|x-requested-with)$/i;
const URL_HEADER = new Set(["header:referer", "header:origin"]);
const URL_SHAPED = /^([a-z][a-z0-9+.-]*:\/\/|\/)\S*$/i;
const VOLATILE_KEY = /^(doc_?id|query_?id|document_?id|sha256_?hash|query_?hash|persisted_?query_?hash|hash)$/i;

const key = (at: Step[]) => JSON.stringify(at);
const headerName = (at: Step[]) => (at[0]!.startsWith("header:") ? at[0]!.slice(7) : undefined);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lastToken = (at: Step[]) => {
  const s = at[at.length - 1]!;
  return s.startsWith("json:") ? s.slice(s.lastIndexOf("/") + 1) : s.slice(s.indexOf(":") + 1);
};
/** The name a leaf goes by: its header, field, query key or JSON key. */
export const leafName = (at: Step[]) => headerName(at) ?? lastToken(at);

export function checkExamples(args: Args, label: string): void {
  const seen = new Map<string, string>();
  for (const [name, v] of Object.entries(args)) {
    const s = asText(v).toLowerCase();
    if (s.length < 3)
      throw new Error(`${label} ${name}=${JSON.stringify(v)}: example values need at least 3 characters to be located`);
    const other = seen.get(s);
    if (other)
      throw new Error(
        `${label}: ${other} and ${name} share the value ${JSON.stringify(v)}; example values must be distinct`,
      );
    seen.set(s, name);
  }
}

/** Both example sets can be located; the second should name the same params as the first. */
function checkExampleSets([args1, args2]: LearnInput["examples"], warnings: string[]): void {
  checkExamples(args1, "example");
  if (!args2) return;
  checkExamples(args2, "example 2");
  const k1 = Object.keys(args1).sort().join();
  if (Object.keys(args2).sort().join() !== k1) warnings.push("example 2 names different params than example 1");
}

/** Step 6: the captured headers verbatim, minus the ones a replay must not send (DROP_HEADER). */
function headersOf(e: Exchange): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.request.headers)) if (!DROP_HEADER.test(k)) out[k.toLowerCase()] = v;
  return out;
}

/** The captured request as the template every later step reads: verbatim, with step 6's headers. */
function templateOf(e: Exchange): Request {
  return {
    method: e.request.method.toUpperCase(),
    url: e.request.url,
    headers: headersOf(e),
    ...(e.request.body !== undefined ? { body: e.request.body } : {}),
  };
}

function pickExchange(
  input: LearnInput,
  exchanges: Exchange[],
  args: Args,
  pages: string[],
  warnings: string[],
): Exchange {
  if (input.id !== undefined) {
    const e = exchanges.find((x) => x.id === input.id);
    if (!e) throw new Error(`no captured request with id ${input.id}`);
    return e;
  }
  const pool = input.match ? exchanges.filter((e) => matches(input.match!, e.request)) : exchanges;
  const ranked = rankCandidates(pool, args, { all: !!input.match, pages }).filter((c) => input.match || c.hits.length);
  if (!ranked.length) {
    throw new Error(
      input.match
        ? `no captured request matches ${JSON.stringify(input.match)}`
        : "no captured request carries the example values; check the trigger, or pass match/id",
    );
  }
  const byId = (id: number) => exchanges.find((e) => e.id === id)!;
  // A response recipe (--html/--embedded/--extract) names the answer: a beacon echoing the page URL doesn't resolve it.
  const accepted = input.accepts && ranked.find((c) => input.accepts!(byId(c.id)));
  if (accepted) return byId(accepted.id);
  const [top, next] = ranked;
  if (next && next.score === top!.score) {
    warnings.push(
      `ambiguous: requests #${top!.id} and #${next.id} rank equally; learned #${top!.id}, pass id or match to choose`,
    );
  }
  return byId(top!.id);
}

/**
 * Step 1: the exchange to learn from, and the pages the capture ran on (its documents, every
 * Referer, the filled trigger, and the locations the caller saw), which later tell an echo from evidence.
 */
function pickRequest(input: LearnInput, args: Args, warnings: string[]): { exchange: Exchange; pages: string[] } {
  const enc = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, encodeURIComponent(asText(v))]));
  const pages = pageUrls(input.exchanges, [fillTemplate(input.trigger.url, enc), ...(input.pages ?? [])]);
  const ex = pickExchange(input, input.exchanges, args, pages, warnings);
  // A read's answer is data. Picked by rank alone, a data-less 2xx is a beacon's ack whose echo of the
  // page went unrecognized; learning it would answer every call with {"success":true}.
  const answer = (ex.response?.body ?? "").toLowerCase();
  const echoesArgs = exampleValues(args).some(([, v]) => v.length >= 3 && answer.includes(v));
  if (input.readOnly && isAck(ex) && !echoesArgs && input.id === undefined && !input.match) {
    throw new Error(
      `the request that carries the example values (#${ex.id} ${ex.request.method} ${ex.request.url.slice(0, 120)}) answers without data ` +
        `(${JSON.stringify((ex.response?.body ?? "").trim().slice(0, 60))}): an analytics beacon's ack, not the op's answer. ` +
        "Pick the data request (capture, then add --from <id> --pick-request <n>), or learn the page itself with --html or --embedded",
    );
  }
  return { exchange: ex, pages };
}

/**
 * A JSON object that repeats a key has a leaf no step path reaches, so a credential there could be
 * neither blanked nor filled. JSON.stringify never writes one, so a frontend's own request has none.
 */
function refuseRepeatedKeys(leaves: Leaf[]): void {
  const leaf = leaves.find((l) => l.repeated);
  if (!leaf) return;
  throw new Error(
    `the request has a JSON object that repeats a key (${leaf.at.join(" > ")}): only the key's first occurrence can be read or filled, ` +
      "so a value in a later one would stay in the spec as captured. Not learned; pick a request without the repeated key",
  );
}

/** Pointers inside a JSON text whose value equals want (an array or object example). */
function jsonPointers(root: unknown, want: string, ptr = ""): string[] {
  if (JSON.stringify(root) === want) return [ptr];
  if (!root || typeof root !== "object") return [];
  return Object.entries(root).flatMap(([k, c]) =>
    jsonPointers(c, want, `${ptr}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`),
  );
}

interface Hit {
  leaf: Leaf;
  /** the text found in the leaf: the example, or its percent-encoded form */
  text: string;
  encoded: boolean;
}

/**
 * How the arg is escaped inside a templated leaf: URL-valued leaves take it percent-encoded, JSON
 * string literals escaped. Referer/Origin are always URLs, so filling implies "url" there.
 */
function escapeOf(leaf: Leaf, hits: Hit[]): Escape | undefined {
  if (URL_HEADER.has(leaf.at[0]!)) return undefined;
  if (hits.some((h) => h.encoded)) return "url";
  // A URL leaf takes the arg percent-encoded, unless the example sits there raw in a form encoding
  // would change: "/facebook/react" in a route resolver's path keeps its slash.
  if (URL_SHAPED.test(leaf.value) && hits.every((h) => encodeURIComponent(h.text) === h.text)) return "url";
  const i = leaf.value.toLowerCase().indexOf(hits[0]!.text);
  const quotes = leaf.value.slice(0, Math.max(0, i)).match(/(?<!\\)"/g)?.length ?? 0;
  return quotes % 2 ? "json" : undefined;
}

/**
 * Where a scalar example sits: the leaves equal to it, and the string leaves holding it (raw or
 * percent-encoded) inside other text.
 */
function scalarHits(name: string, raw: unknown, leaves: Leaf[]): { exact: Leaf[]; part: Hit[] } {
  const v = asText(raw).toLowerCase();
  const literal = /^(true|false|null)$/.test(v);
  const digits = /^\d+$/.test(v);
  const enc = encodeURIComponent(asText(raw)).toLowerCase();
  const forms = [...new Set([enc, enc.replace(/%20/g, "+")])].filter((f) => f !== v);
  // digits inside a longer number (a timestamp, a cache-buster) are not the arg
  const inside = (text: string, t: string) =>
    digits ? new RegExp(`(?<!\\d)${t}(?!\\d)`).test(text) : text.includes(t);
  let exact: Leaf[] = [];
  const part: Hit[] = [];
  for (const leaf of leaves) {
    const header = headerName(leaf.at);
    if (header === "cookie" || (header && BROWSER_HEADER.test(header))) continue;
    const text = leaf.value.toLowerCase();
    if (text === v) {
      exact.push(leaf);
      continue;
    }
    if (leaf.container || leaf.type !== "string" || literal) continue;
    if (header && !URL_HEADER.has(leaf.at[0]!) && !header.startsWith("x-")) continue;
    // a short example ("SFO") turns up by chance inside a random token: there it must stand alone
    const within =
      v.length <= 4 && highEntropy(leaf.value)
        ? (t: string, x: string) => new RegExp(`(?<![a-z0-9])${escapeRe(x)}(?![a-z0-9])`).test(t)
        : inside;
    if (within(text, v)) part.push({ leaf, text: v, encoded: false });
    else {
      const f = forms.find((x) => within(text, x));
      if (f) part.push({ leaf, text: f, encoded: true });
    }
  }
  if (literal && exact.length) {
    // X-style GraphQL sends dozens of true flags, and a lone one may be any flag: bind only the one named like the param
    const named = exact.filter((l) => lastToken(l.at).toLowerCase() === name.toLowerCase());
    if (!named.length) {
      throw new Error(
        `example value for "${name}" (${JSON.stringify(raw)}) matches ${exact.length} flag(s) (${exact.map((l) => l.at.join(" > ")).join("; ")}), none with the key "${name}"; name the param after its key so it binds to one`,
      );
    }
    exact = named;
  }
  return { exact, part };
}

/** The slot for one leaf that holds param values inside other text. Each hit's text is `param\0found text`. */
function templatedSlot(hits: Hit[]): Slot {
  const leaf = hits[0]!.leaf;
  const byText = new Map(
    hits.map((h) => [h.text.slice(h.text.indexOf("\0") + 1), h.text.slice(0, h.text.indexOf("\0"))]),
  );
  // one alternation, longest first, so "nasa" never splits "nasagov"
  const alts = [...byText.keys()]
    .sort((a, b) => b.length - a.length)
    .map((t) => (/^\d+$/.test(t) ? `(?<!\\d)${t}(?!\\d)` : escapeRe(escapeTemplate(t))));
  const template = escapeTemplate(leaf.value).replace(
    new RegExp(alts.join("|"), "gi"),
    (m) => `{${byText.get(m.toLowerCase())}}`,
  );
  const plain = hits.map((h) => ({ ...h, text: h.text.slice(h.text.indexOf("\0") + 1) }));
  const escape = escapeOf(leaf, plain);
  return { param: byText.values().next().value!, at: leaf.at, template, ...(escape ? { escape } : {}) };
}

/**
 * Step 2: slots for the example args. An exact leaf is a slot; a leaf holding the value inside other text
 * (never a number, flag or browser header) is a templated slot. Referer/Origin/Cookie and any echo
 * of the page's location follow the args but are not evidence: a value found only there changes
 * nothing the server reads.
 */
function paramSlots(
  leaves: Leaf[],
  args: Args,
  locs: Locations,
  warnings: string[],
): { slots: Slot[]; types: Map<string, Param["type"]> } {
  const slots: Slot[] = [];
  const types = new Map<string, Param["type"]>();
  const found = new Map<string, { exact: Leaf[]; part: Hit[] }>();
  for (const [name, raw] of Object.entries(args)) {
    if (raw !== null && typeof raw === "object") {
      // an array/object example binds to the JSON container equal to it
      const want = JSON.stringify(raw);
      const at = leaves
        .filter((l) => l.container)
        .flatMap((l) => jsonPointers(JSON.parse(l.value), want).map((p) => [...l.at, `json:${p}`]));
      if (!at.length) throw notFound(name, raw);
      for (const a of at) slots.push({ param: name, at: a });
      types.set(name, Array.isArray(raw) ? "array" : "object");
      continue;
    }
    found.set(name, scalarHits(name, raw, leaves));
  }
  // A leaf that equals one param's value belongs to that param, even if another's value is inside it.
  const exactKeys = new Set([...found.values()].flatMap((f) => f.exact.map((l) => key(l.at))));
  const partial = new Map<string, Hit[]>();
  for (const [name, f] of found) {
    const part = f.part.filter((h) => !exactKeys.has(key(h.leaf.at)));
    const v = asText(args[name]).toLowerCase();
    const places = [...f.exact, ...part.map((h) => h.leaf)]
      .filter((l) => !NOT_EVIDENCE.has(l.at[0]!) && !echoes(l.value, v, locs))
      .map((l) => l.at.join(" > "));
    if (!places.length) throw notFound(name, args[name]);
    if (places.length > 1)
      warnings.push(`"${name}" appears in ${places.length} places, all will be filled: ${places.join("; ")}`);
    for (const leaf of f.exact) {
      slots.push({ param: name, at: leaf.at });
      if (leaf.type === "number") types.set(name, "number");
      if (leaf.type === "boolean") types.set(name, "boolean");
    }
    for (const h of part)
      partial.set(key(h.leaf.at), [...(partial.get(key(h.leaf.at)) ?? []), { ...h, text: `${name}\0${h.text}` }]);
  }
  for (const hits of partial.values()) slots.push(templatedSlot(hits));
  return { slots, types };
}

const notFound = (name: string, raw: unknown) =>
  new Error(
    `example value for "${name}" (${JSON.stringify(raw)}) is not in the learned request, so the param would change nothing. ` +
      "Pick the request that carries it (capture, then add --from <id> --pick-request <n>), or drop the param",
  );

/* ------------------------------------------------------------ credentials */

// Words that name a credential in a key or header: api_key, authToken, x-session-id, sid, X-Amz-Signature.
const CREDENTIAL_WORD =
  /^(?:auth(?!or)[a-z0-9]*|[a-z0-9]*(?:token|secret|key|signature|password|passwd|pwd|credential|bearer)s?|sess(?:ion)?[a-z0-9]*|sid)$/;

/** A key or header named like a credential, judged by its words (authToken -> auth, token; "author" is not). */
export function credentialName(name: string): boolean {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((w) => CREDENTIAL_WORD.test(w));
}

/** Random-looking: 16+ chars, no spaces, not a URL, two character classes, 3+ bits of entropy per char. */
export function highEntropy(v: string): boolean {
  if (v.length < 16 || /\s/.test(v) || URLISH.test(v)) return false;
  if ([/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(v)).length < 2) return false;
  const n = new Map<string, number>();
  for (const c of v) n.set(c, (n.get(c) ?? 0) + 1);
  let bits = 0;
  for (const k of n.values()) bits -= (k / v.length) * Math.log2(k / v.length);
  return bits >= 3;
}

/** A literal a spec must not hold: a per-session field or header, or a random value under a credential's name. */
export function isCredential(name: string, value: string): boolean {
  return (
    ((SESSION_FIELD.test(name) || SESSION_HEADER.test(name)) && value.length >= 8) ||
    (credentialName(name) && highEntropy(value))
  );
}

/**
 * A script every visitor gets byte for byte: a GET whose answer shared caches may keep (not private
 * or no-store), fetched without the user's cookies or marked public/immutable. A script from a
 * per-user path sent with the session cookie proves nothing is public.
 */
function staticBundle(e: Exchange): boolean {
  if (e.resourceType !== "script" || e.request.method.toUpperCase() !== "GET" || !e.response) return false;
  const cc = Object.entries(e.response.headers).find(([k]) => k.toLowerCase() === "cache-control")?.[1] ?? "";
  if (/private|no-store/i.test(cc)) return false;
  return !e.request.headers.cookie || /\bpublic\b|immutable/i.test(cc);
}

interface Live {
  ref: string;
  transform?: Slot["transform"];
  /** a session: ref's value, for the session store */
  value?: string;
}

/**
 * Live session values (8+ chars) a request may repeat: cookies (raw, unquoted, URL-decoded) and the
 * page's localStorage/sessionStorage, including string leaves of a JSON entry (auth SDKs keep
 * tokens that way). A cookie is a `cookie:` ref; a storage value a `session:` ref.
 */
function liveValues(
  cookies: StoredCookie[],
  cookieHeader: string | undefined,
  storage: Record<string, string> = {},
): Map<string, Live> {
  const out = new Map<string, Live>();
  const put = (v: string, live: Live) => v.length >= 8 && !out.has(v) && out.set(v, live);
  for (const [name, value] of [
    ...cookies.map((c) => [c.name, c.value] as const),
    ...Object.entries(parseCookieHeader(cookieHeader ?? "")),
  ]) {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    put(value, { ref: `cookie:${name}` });
    put(value.replace(/^"|"$/g, ""), { ref: `cookie:${name}`, transform: "strip-quotes" });
    put(decoded, { ref: `cookie:${name}`, transform: "url-decode" });
  }
  for (const [name, value] of Object.entries(storage)) {
    put(value, { ref: `session:${name}`, value });
    const visit = (v: unknown, k: string): void => {
      if (typeof v === "string") put(v, { ref: `session:${name}/${k}`, value: v });
      else if (v && typeof v === "object") for (const [kk, c] of Object.entries(v)) visit(c, k ? `${k}/${kk}` : kk);
    };
    if (/^\s*[[{]/.test(value)) visit(tryParse(value), "");
  }
  return out;
}

/* ------------------------------------------------------ session references */

/**
 * What the session-reference passes build together. Each pass skips the positions an earlier one
 * took and names its refs against the values already found, so they run in order over one state.
 */
interface Refs {
  /** the param slots, then each ref in the order found */
  slots: Slot[];
  /** positions that have a slot */
  taken: Set<string>;
  /** live values by their text; a credential a pass finds by name or issue joins them */
  live: Map<string, Live>;
  /** literal values of session: refs by name, for the session store */
  sessionValues: Record<string, string>;
}

/** Give a position its ref. A session: value is recorded, under a per-position name when the name holds another value. */
function addRef(refs: Refs, at: Step[], slot: Omit<Slot, "at">, value?: string): void {
  if (value !== undefined && slot.ref?.startsWith("session:")) {
    let name = slot.ref.slice(8);
    if (refs.sessionValues[name] !== undefined && refs.sessionValues[name] !== value)
      name += `@${encodeURIComponent(key(at))}`;
    slot = { ...slot, ref: `session:${name}` };
    refs.sessionValues[name] = value;
    // Newly discovered credentials need the same compound-copy cleanup as cookies/storage.
    if (!refs.live.get(value)?.ref.startsWith("cookie:")) refs.live.set(value, { ref: slot.ref!, value });
  }
  refs.slots.push({ ...slot, at });
  refs.taken.add(key(at));
}

/** Pass 1: a leaf equal to a live cookie or storage value. */
function liveRefs(refs: Refs, leaves: Leaf[]): void {
  for (const leaf of leaves) {
    const l = refs.live.get(leaf.value);
    // string leaves only: a ref is filled with a string, which would retype a JSON number
    if (!l || leaf.type !== "string" || refs.taken.has(key(leaf.at))) continue;
    // an app caching a persisted-query hash in storage does not make the hash a credential
    if (l.value !== undefined && VOLATILE_KEY.test(lastToken(leaf.at))) continue;
    addRef(refs, leaf.at, { ref: l.ref, ...(l.transform ? { transform: l.transform } : {}) }, l.value);
  }
}

type SecretNamed = (name: string, value: string) => boolean;

/**
 * A key the site ships in its own JS to every visitor (a public API key) is a constant, not a credential.
 * `secretNamed` tells the two apart for a credential-named random value: asked about a shipped one,
 * it says no and notes the name in `shipped`, for the op's public list.
 */
function secretTest(exchanges: Exchange[]): { secretNamed: SecretNamed; shipped: Set<string> } {
  const scripts = exchanges.flatMap((e) => (staticBundle(e) && e.response?.body ? [e.response.body] : []));
  const shipped = new Set<string>();
  const secretNamed = (name: string, value: string) => {
    if (!credentialName(name) || !highEntropy(value)) return false;
    if (!scripts.some((b) => b.includes(value))) return true;
    shipped.add(name.toLowerCase());
    return false;
  };
  return { secretNamed, shipped };
}

/** Pass 2: per-session fields and credential-named random values in the path, query, form and JSON. */
function fieldRefs(refs: Refs, leaves: Leaf[], secretNamed: SecretNamed): void {
  for (const leaf of leaves) {
    if (leaf.container || leaf.type !== "string" || leaf.at[0]!.startsWith("header:") || refs.taken.has(key(leaf.at)))
      continue;
    const name = lastToken(leaf.at);
    if ((SESSION_FIELD.test(name) && leaf.value.length >= 8) || secretNamed(name, leaf.value))
      addRef(refs, leaf.at, { ref: `session:${name}` }, leaf.value);
  }
}

/** Pass 3: auth and anti-bot headers, credential-named ones, and a header repeating a value the earlier passes found. */
function headerRefs(refs: Refs, leaves: Leaf[], secretNamed: SecretNamed): void {
  const fieldOf = new Map(Object.entries(refs.sessionValues).map(([k, v]) => [v, k]));
  for (const { at, value } of leaves) {
    const name = at.length === 1 ? headerName(at) : undefined;
    if (name === undefined || refs.taken.has(key(at))) continue;
    // Meta's x-fb-lsd repeats the lsd field: one credential, one ref.
    const same = value.length >= 8 ? fieldOf.get(value) : undefined;
    if (!same && !SESSION_HEADER.test(name) && (BROWSER_HEADER.test(name) || !secretNamed(name, value))) continue;
    addRef(refs, at, { ref: `session:${same ?? name}` }, same ? undefined : value);
  }
}

/**
 * Pass 4: server-issued values. `issued` holds the answers the page had before this request.
 * A random value an earlier answer of this capture handed the page (a bootstrap JSON, a per-user
 * config script, a token in the document) is server-issued: a session: ref under any name,
 * refreshed by every trigger run. Static bundles are public (above); hash-like path segments and
 * persisted-query ids are volatile anchors, healed by rescan.
 */
function issuedRefs(refs: Refs, leaves: Leaf[], issued: string[]): void {
  for (const leaf of leaves) {
    if (leaf.container || leaf.type !== "string" || refs.taken.has(key(leaf.at)) || !highEntropy(leaf.value)) continue;
    const header = headerName(leaf.at);
    const name = leafName(leaf.at);
    if (leaf.at[0]!.startsWith("path:") || VOLATILE_KEY.test(name)) continue;
    if (header && (URL_HEADER.has(leaf.at[0]!) || BROWSER_HEADER.test(header))) continue;
    const escaped = JSON.stringify(leaf.value).slice(1, -1);
    if (!issued.some((b) => b.includes(leaf.value) || b.includes(escaped))) continue;
    // A bootstrap token belongs to this operation and request position, not every field named t.
    const ref = refs.live.get(leaf.value)?.ref ?? `session:${name}@${encodeURIComponent(key(leaf.at))}`;
    addRef(refs, leaf.at, { ref }, leaf.value);
  }
}

/**
 * Pass 5, in a param's templated leaf: each live value it holds becomes a `{cookie:x}`/`{session:x}`
 * hole in the param's own template. Returns the request with those values taken out of the leaf,
 * since a param's leaf is not blanked like a ref's.
 */
function holeRefs(refs: Refs, own: Slot, long: [string, Live][], request: Request): Request {
  for (const [v, l] of long) {
    if (l.transform) continue;
    // With no escape of its own, the leaf may still hold the value encoded (x-ctx: user={q};auth=<%-encoded>):
    // the slot then takes that escape, so the hole is refilled the same way.
    const tries: (Escape | undefined)[] = own.escape ? [own.escape] : [undefined, "url", "json"];
    const i = tries.findIndex((e) => own.template!.includes(escapeTemplate(escapeValue(v, e))));
    if (i < 0) continue;
    const esc = tries[i];
    const form = escapeValue(v, esc);
    if (esc && !own.escape) own.escape = esc;
    own.template = own.template!.split(escapeTemplate(form)).join(`{${l.ref}}`);
    if (l.ref.startsWith("session:") && l.value !== undefined) refs.sessionValues[l.ref.slice(8)] = l.value;
    request = setAt(request, own.at, (getAt(request, own.at) as string).split(form).join(""));
  }
  return request;
}

/** Pass 5, in a leaf no slot has: the live values it holds become holes of one templated ref, named after the first found. */
function templatedRef(refs: Refs, leaf: Leaf, long: [string, Live][]): void {
  let template = escapeTemplate(leaf.value);
  let primary: { live: Live; escape: Escape | undefined } | undefined;
  for (const [v, l] of long) {
    const forms: [string, Escape | undefined][] = [
      [v, undefined],
      [encodeURIComponent(v), "url"],
      [JSON.stringify(v).slice(1, -1), "json"],
    ];
    const form = forms.find(([f, esc]) => template.includes(escapeTemplate(f)) && (!primary || primary.escape === esc));
    if (!form) continue;
    template = template.split(escapeTemplate(form[0])).join(`{${l.ref}}`);
    if (l.ref.startsWith("session:") && l.value !== undefined) refs.sessionValues[l.ref.slice(8)] = l.value;
    primary ??= { live: l, escape: form[1] };
  }
  if (!primary) return;
  const { live: l, escape } = primary;
  addRef(
    refs,
    leaf.at,
    { ref: l.ref, ...(l.transform ? { transform: l.transform } : {}), template, ...(escape ? { escape } : {}) },
    l.value,
  );
}

/**
 * Pass 5: live values embedded in longer leaves.
 * A live value inside a longer leaf ("v1:<cookie>", a next= URL holding it percent-encoded, a
 * JSON-escaped copy) is a templated ref, re-encoded like the leaf had it.
 */
function embeddedRefs(refs: Refs, leaves: Leaf[], request: Request): Request {
  const long = [...refs.live].filter(([v]) => v.length >= 16);
  for (const leaf of leaves) {
    if (leaf.container || leaf.type !== "string") continue;
    // A param's templated leaf can carry one too (next=/search?q={q}&auth=<cookie>): its template gets a ref hole.
    const own = refs.taken.has(key(leaf.at))
      ? refs.slots.find((s) => s.param && s.template !== undefined && key(s.at) === key(leaf.at))
      : undefined;
    if (own) request = holeRefs(refs, own, long, request);
    else if (!refs.taken.has(key(leaf.at))) templatedRef(refs, leaf, long);
  }
  return request;
}

/**
 * Step 4: session refs: live cookie/storage values anywhere, per-session fields, credential-named
 * values, auth headers. Takes the captured template and the param slots; returns the template with
 * every ref'd leaf blanked and the live values the passes found inside longer leaves cut out, the
 * slots with the refs appended, the session: values for the session store, and the names the op
 * lists as public (marked so by the caller, or shipped to every visitor).
 */
function sessionRefs(
  input: LearnInput,
  ex: Exchange,
  captured: Request,
  leaves: Leaf[],
  params: Slot[],
): { request: Request; slots: Slot[]; sessionValues: Record<string, string>; publicNames: string[] } {
  const refs: Refs = {
    // copies: pass 5 writes ref holes into a param's template
    slots: params.map((s) => ({ ...s })),
    taken: new Set(params.map((s) => key(s.at))),
    live: liveValues(input.cookies, ex.request.headers.cookie, input.storage),
    sessionValues: {},
  };
  // A name the caller marked public is a constant: no pass sees its leaf.
  const publicNames = new Set((input.public ?? []).map((h) => h.toLowerCase()));
  const open = leaves.filter((l) => !publicNames.has(leafName(l.at).toLowerCase()));
  liveRefs(refs, open);
  const { secretNamed, shipped } = secretTest(input.exchanges);
  fieldRefs(refs, open, secretNamed);
  headerRefs(refs, open, secretNamed);
  const issued = input.exchanges.flatMap((e) =>
    e.id < ex.id && e.response?.body && !staticBundle(e) ? [e.response.body] : [],
  );
  issuedRefs(refs, open, issued);
  let request = embeddedRefs(refs, open, captured);
  // The spec never holds a credential: blank every ref'd leaf.
  for (const s of refs.slots) if (s.ref) request = setAt(request, s.at, "");
  return {
    request,
    slots: refs.slots,
    sessionValues: refs.sessionValues,
    publicNames: [...new Set([...publicNames, ...shipped])],
  };
}

/**
 * Session values are stored per site. Two operations may use different tokens under the same
 * field/header name, so newly learned references include the operation name. Old specs still work.
 */
function scopeRefs(slots: Slot[], opName: string): Slot[] {
  const scope = (ref: string) =>
    ref.startsWith("session:") ? `session:${encodeURIComponent(opName)}/${ref.slice(8)}` : ref;
  return slots.map((s) => {
    const slot = { ...s };
    if (slot.ref) slot.ref = scope(slot.ref);
    if (slot.template)
      for (const ref of templateRefs(slot.template))
        slot.template = slot.template.split(`{${ref}}`).join(`{${scope(ref)}}`);
    return slot;
  });
}

function shapeOf(s: string): Volatile["shape"] {
  const charset = /^\d+$/.test(s)
    ? "digits"
    : /^[0-9a-f]+$/i.test(s)
      ? "hex"
      : /^[A-Za-z0-9_-]+$/.test(s)
        ? "base64url"
        : "base64";
  return { charset, length: s.length };
}

/** Step 5: hash-like literals no slot has, each with its shape and a stable anchor next to it. */
function volatileAnchors(req: Request, leaves: Leaf[], slots: Slot[]): Volatile[] {
  const opName = operationNameOf(req);
  const taken = new Set(slots.map((s) => key(s.at)));
  const out: Volatile[] = [];
  // A body queryId repeating the path id shares the path's anchor; "queryId" itself is too generic to rescan by.
  const anchorOf = new Map<string, string>();
  const segs = new URL(req.url).pathname.split("/").slice(1);
  for (const leaf of leaves) {
    if (leaf.container || taken.has(key(leaf.at)) || leaf.at[0]!.startsWith("header:")) continue;
    const first = leaf.at[0]!;
    if (leaf.at.length === 1 && first.startsWith("path:")) {
      if (!hashLike(leaf.value)) continue;
      const i = Number(first.slice(5));
      const anchor = opName ?? segs[i + 1] ?? segs[i - 1];
      if (anchor) out.push({ at: leaf.at, shape: shapeOf(leaf.value), anchor });
      if (anchor) anchorOf.set(leaf.value, anchor);
    } else if (VOLATILE_KEY.test(lastToken(leaf.at)) && (hashLike(leaf.value) || /^\d{8,}$/.test(leaf.value))) {
      out.push({
        at: leaf.at,
        shape: shapeOf(leaf.value),
        anchor: opName ?? anchorOf.get(leaf.value) ?? lastToken(leaf.at),
      });
    }
  }
  return out;
}

/** Path to the richest array carrying an example value, else the object holding it, else the biggest array. */
export function suggestExtract(root: unknown, values: string[]): string | undefined {
  const carries = (v: unknown) => {
    const s = JSON.stringify(v).toLowerCase();
    return values.some((x) => s.includes(x));
  };
  // rank arrays of records above arrays of scalars, then by length
  let bestArray: { path: string; len: number } | undefined;
  let anyArray: { path: string; len: number } | undefined;
  let holder: { path: string; depth: number } | undefined;
  const queue: { v: unknown; path: string; depth: number }[] = [{ v: root, path: "", depth: 0 }];
  while (queue.length) {
    const { v, path, depth } = queue.shift()!;
    if (depth > 8 || !v || typeof v !== "object") continue;
    const children: [string, unknown][] = Array.isArray(v)
      ? v.slice(0, 50).map((c, i) => [`${path}[${i}]`, c])
      : Object.entries(v).map(([k, c]) => [
          /^[\w$-]+$/.test(k) ? (path ? `${path}.${k}` : k) : `${path}[${JSON.stringify(k)}]`,
          c,
        ]);
    // a top-level list of results is itself the answer: "" (the whole response) beats any item in it
    if (Array.isArray(v) && !path && v.length > 1 && v.some((x) => x !== null && typeof x === "object") && carries(v))
      return "";
    if (Array.isArray(v) && path) {
      if (!anyArray || v.length > anyArray.len) anyArray = { path, len: v.length };
      const rank = v.length + (v.some((x) => x !== null && typeof x === "object") ? 1e6 : 0);
      if (v.length > 1 && (!bestArray || rank > bestArray.len) && carries(v)) bestArray = { path, len: rank };
    }
    for (const [p, c] of children) {
      const inner = typeof c === "string" ? innerJson(c) : undefined;
      if (inner && typeof inner === "object") queue.push({ v: inner, path: p, depth: depth + 1 });
      else if (c && typeof c === "object") queue.push({ v: c, path: p, depth: depth + 1 });
      else if (path && c != null && values.includes(String(c).toLowerCase()) && (!holder || depth > holder.depth))
        holder = { path, depth };
    }
  }
  return bestArray?.path ?? holder?.path ?? anyArray?.path;
}

function learnResponse(e: Exchange, values: string[], warnings: string[]): ResponseSpec {
  const r = e.response;
  if (!r) return { format: "json" };
  const body = r.body ?? "";
  const xssiPrefix = xssiOf(body);
  const data = tryParse(body);
  if (data !== null && typeof data === "object") {
    const extract = suggestExtract(data, values);
    return {
      format: "json",
      contentType: r.contentType,
      ...(xssiPrefix ? { xssiPrefix } : {}),
      ...(extract ? { extract } : {}),
      shape: inferShape(data),
    };
  }
  warnings.push(
    /html/i.test(r.contentType)
      ? 'response is HTML: add --html \'{"items":"<css>","fields":{...}}\' for a list, or --embedded \'<regex>\' for JSON inside the page'
      : `response is ${r.contentType || "untyped"} text, returned raw`,
  );
  return { format: "html", contentType: r.contentType };
}

/** Two-run diff: positions that change without an arg change are nonces (unless they look like counters). */
function diffRuns(req1: Request, req2: Request, slots: Slot[], args2: Args, warnings: string[]): string[] {
  const bySlot = new Map(slots.map((s) => [key(s.at), s]));
  const second = new Map(walk(req2).map((l) => [key(l.at), l]));
  const values2 = exampleValues(args2).map(([, v]) => v);
  const nonces: string[] = [];
  const missing: string[] = [];
  for (const leaf of walk(req1)) {
    if (leaf.container || leaf.at[0] === "header:cookie") continue;
    const k = key(leaf.at);
    const slot = bySlot.get(k);
    const other = second.get(k);
    if (slot?.ref) continue;
    const header = headerName(leaf.at);
    if (header && BROWSER_HEADER.test(header)) continue;
    if (!other) {
      missing.push(leaf.at.join(" > "));
      continue;
    }
    if (slot?.param) {
      const want =
        slot.template !== undefined ? fillSlotTemplate(slot.template, args2, slot.escape) : asText(args2[slot.param]);
      // a credential hole matches whatever run 2's session held
      const same = new RegExp(
        `^${want
          .split(/\{(?:cookie|session):[^{}]+\}/)
          .map(escapeRe)
          .join(".*?")}$`,
        "is",
      );
      if (same.test(other.value)) continue;
      // The text around the arg changed too: a signature inside the leaf (a signed URL in a param).
      // a credential hole is run-specific too: a wildcard like the args
      const holes = slot.template !== undefined ? [...Object.keys(args2), ...templateRefs(slot.template)] : [];
      const literals =
        slot.template !== undefined
          ? fillSlotTemplate(slot.template, Object.fromEntries(holes.map((k) => [k, "\0"]))).split("\0")
          : [];
      if (literals.some((l) => l && !other.value.toLowerCase().includes(l.toLowerCase())))
        nonces.push(leaf.at.join(" > "));
      else
        warnings.push(
          `run 2 has ${JSON.stringify(other.value)} at ${leaf.at.join(" > ")}, expected ${JSON.stringify(want)}`,
        );
      continue;
    }
    if (other.value === leaf.value) continue;
    const where = leaf.at.join(" > ");
    if (values2.some((v) => other.value.toLowerCase().includes(v))) {
      warnings.push(`${where} follows the args in run 2 but did not match example 1; check its format`);
    } else if (
      (/^\d+$/.test(leaf.value) && /^\d+$/.test(other.value)) ||
      Math.max(leaf.value.length, other.value.length) <= 4
    ) {
      // ponytail: digits-only or tiny values read as counters/timestamps (_reqid, __req), not signatures; a numeric signature would slip through
      warnings.push(`${where} varies between runs (counter or timestamp?); kept constant`);
    } else {
      nonces.push(where);
    }
  }
  if (missing.length)
    warnings.push(`run 2 lacks ${missing.length} position(s) of run 1, e.g. ${missing.slice(0, 3).join("; ")}`);
  return nonces;
}

/**
 * Step 3: the tier a nonce forces. 3 when a position changes between the runs without an arg
 * change (a nonce or signature), else 1. `request` and `slots` are run 1's, refs included.
 */
function twoRunDiff(
  request: Request,
  slots: Slot[],
  match: Match,
  exchanges2: Exchange[] | undefined,
  args2: Args | undefined,
  warnings: string[],
): 1 | 3 {
  if (!exchanges2 || !args2) {
    warnings.push("learned from one example; a second example set separates params from nonces");
    return 1;
  }
  const pool = exchanges2.filter((e) => matches(match, e.request));
  const top = rankCandidates(pool, args2, { all: true })[0];
  const ex2 = top && pool.find((e) => e.id === top.id);
  if (!ex2) {
    warnings.push("run 2 produced no matching request; skipped the two-run diff");
    return 1;
  }
  const nonces = diffRuns(request, { ...ex2.request, headers: headersOf(ex2) }, slots, args2, warnings);
  if (!nonces.length) return 1;
  warnings.push(`changes between runs without an arg change (nonce/signature), so minTier 3: ${nonces.join("; ")}`);
  return 3;
}

/**
 * DESIGN.md "Learning", step by step. The numbers are the design's; the order is the one the data
 * allows. The two-run diff (3) comes after the session refs (4), because a session value that
 * differs between the runs is not a nonce, and after the match, which finds run 2's request and is
 * built from the template once its credentials are blanked.
 */
export function learnOperation(input: LearnInput): Learned {
  const warnings: string[] = [];
  const { examples } = input;
  const [args1, args2] = examples;
  checkExampleSets(examples, warnings);

  // 1. pick the request (6: its headers are kept, minus the ones a replay must not send)
  const { exchange, pages } = pickRequest(input, args1, warnings);
  const captured = templateOf(exchange);
  const leaves = walk(captured);
  refuseRepeatedKeys(leaves);

  // 2. params. A request the agent picked by id is its call: an echo-shaped leaf there is evidence
  // (a route resolver posts {path:"/facebook/react"}, the page's own path).
  const locs = input.id !== undefined ? { abs: [], rel: [] } : locations(pages);
  const param = paramSlots(leaves, args1, locs, warnings);

  // 4. session refs: live cookie/storage values anywhere, per-session fields, credential-named values, auth headers
  const { request, slots, sessionValues, publicNames } = sessionRefs(input, exchange, captured, leaves, param.slots);

  // 5. volatile anchors
  const volatile = volatileAnchors(request, leaves, slots);

  // match: stable identity, with param and hash-like path segments wildcarded
  const match = input.match ?? buildMatch(request, slots);

  // 3. two-run diff
  const minTier = twoRunDiff(request, slots, match, input.exchanges2, args2, warnings);

  // 8. response
  const response = learnResponse(
    exchange,
    Object.values(args1).map((v) => String(v).toLowerCase()),
    warnings,
  );

  const params: Param[] = Object.entries(args1).map(([name, example]) => ({
    name,
    type: param.types.get(name) ?? "string",
    required: true,
    example,
  }));

  const operation = OperationSchema.parse({
    name: input.name,
    request,
    slots: scopeRefs(slots, input.name),
    volatile,
    trigger: input.trigger,
    match,
    response,
    params,
    readOnly: input.readOnly,
    ...(publicNames.length ? { public: publicNames } : {}),
    minTier,
    // 7. whether the session it was learned in was signed in
    learnedLoggedIn: loggedIn(input.cookies, input.loginCookies),
    learnedAt: new Date().toISOString(),
  });
  return {
    operation,
    exchange,
    warnings,
    sessionValues: Object.fromEntries(
      Object.entries(sessionValues).map(([k, v]) => [`${encodeURIComponent(input.name)}/${k}`, v]),
    ),
  };
}
