/**
 * Captured exchanges + example args -> an Operation (DESIGN.md "Learning", steps 1-8).
 * Only example-arg values become params; everything else is kept verbatim.
 */
import { fillTemplate, getAt, setAt, walk, type Leaf, type Step } from "./codec.js";
import { inferShape, innerJson, parseBody, XSSI } from "./extract.js";
import { loggedIn, parseCookieHeader } from "./session.js";
import { OperationSchema, type Match, type Operation, type Param, type Request, type ResponseSpec, type Slot, type Trigger, type Volatile } from "./spec.js";
import type { Exchange, StoredCookie } from "./types.js";

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
}

export interface Learned {
  operation: Operation;
  warnings: string[];
  /** literal values of session: refs, for the session store; never written to the spec */
  sessionValues: Record<string, string>;
}

/* ------------------------------------------------------------------ noise */

const ASSET_EXT =
  /\.(js|mjs|cjs|jsx|ts|css|scss|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|wasm|map|pdf|zip)$/i;
const DENY_RESOURCE = new Set([
  "image", "font", "stylesheet", "script", "media", "manifest", "texttrack", "websocket", "eventsource", "preflight", "ping", "cspviolationreport",
]);
const DENY_MIME = /^(image|font|video|audio)\/|^text\/(css|javascript)|^application\/(javascript|x-javascript|font|octet-stream|wasm)/i;
const ANALYTICS =
  /google-analytics\.com|googletagmanager\.com|doubleclick\.net|sentry\.io|\/sentry\/|segment\.(io|com)|mixpanel\.com|amplitude\.com|hotjar\.com|facebook\.com\/tr|clarity\.ms|nr-data\.net|datadoghq|\/(collect|beacon|log_event|telemetry|jot|csp-report|client_event)(\/|\?|$)/i;

function isNoise(e: Exchange): boolean {
  if (e.request.method.toUpperCase() === "OPTIONS") return true;
  if (DENY_RESOURCE.has(e.resourceType.toLowerCase())) return true;
  let url: URL;
  try {
    url = new URL(e.request.url);
  } catch {
    return true;
  }
  if (ASSET_EXT.test(url.pathname) || ANALYTICS.test(e.request.url)) return true;
  if (e.aborted) return false;
  if (!e.response) return true;
  if (e.response.status >= 300 && e.response.status < 400) return true;
  // XHR/fetch are data by definition; Instagram's GraphQL answers JSON as text/javascript.
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

function exampleValues(args: Args): [string, string][] {
  return Object.entries(args).map(([k, v]) => [k, String(v).toLowerCase()]);
}

function tryParse(body: string | undefined): unknown {
  if (!body) return undefined;
  try {
    return parseBody(body);
  } catch {
    return undefined;
  }
}

/** Noise-filtered requests, best first: carries the example values, succeeded, returned JSON. */
export function rankCandidates(exchanges: Exchange[], args: Args = {}): Candidate[] {
  const values = exampleValues(args).filter(([, v]) => v.length >= 3);
  return exchanges
    .filter((e) => !isNoise(e))
    .map((e) => {
      const leaves = walk(e.request).filter((l) => !NOT_EVIDENCE.has(l.at[0]!));
      const hits = values.filter(([, v]) => leaves.some((l) => l.value.toLowerCase().includes(v))).map(([k]) => k);
      const body = e.response?.body ?? "";
      const parsed = tryParse(body);
      const json = parsed !== null && typeof parsed === "object";
      const status = e.response?.status;
      const lower = values.length ? body.toLowerCase() : "";
      const score =
        hits.length * 1000 +
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
        score: Math.round(score),
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

/** GraphQL-ish operation name from the body, form, query, or Meta's friendly-name header. */
export function operationNameOf(req: Request): string | undefined {
  for (const at of [["body", "json:/operationName"], ["form:fb_api_req_friendly_name"], ["form:operationName"], ["query:operationName"], ["header:x-fb-friendly-name"]]) {
    const v = tryGet(req, at);
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

/** camelCase/PascalCase/snake/kebab words ("UserByScreenName") are names, not hashes. */
const wordy = (s: string) => !/\d/.test(s) && s.split(/[_-]|(?=[A-Z])/).every((w) => w === "" || /^[A-Z]?[a-z]+$/.test(w));
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

function buildMatch(req: Request, paramSegments: Set<number>): Match {
  const u = new URL(req.url);
  const path = u.pathname
    .split("/")
    .map((seg, i) => (i > 0 && (paramSegments.has(i - 1) || hashLike(seg) || /^\d{6,}$/.test(seg)) ? "*" : seg))
    .join("/");
  const operationName = operationNameOf(req);
  return { method: req.method.toUpperCase(), host: u.hostname, path, ...(operationName ? { operationName } : {}) };
}

/* --------------------------------------------------------------- learning */

const DROP_HEADER = /^(:.*|host|content-length|connection|cookie|accept-encoding)$/i;
const SESSION_HEADER = /^(authorization|x-[a-z0-9-]*token|x-csrf[a-z0-9-]*|x-xsrf[a-z0-9-]*|x-goog-batchexecute-bgr|x-client-transaction-id)$/i;
const VOLATILE_KEY = /^(doc_?id|query_?id|document_?id|sha256_?hash|query_?hash|persisted_?query_?hash|hash)$/i;

const key = (at: Step[]) => JSON.stringify(at);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lastToken = (at: Step[]) => {
  const s = at[at.length - 1]!;
  return s.startsWith("json:") ? s.slice(s.lastIndexOf("/") + 1) : s.slice(s.indexOf(":") + 1);
};

function checkExamples(args: Args, label: string): void {
  const seen = new Map<string, string>();
  for (const [name, v] of Object.entries(args)) {
    const s = String(v).toLowerCase();
    if (s.length < 3) throw new Error(`${label} ${name}=${JSON.stringify(v)}: example values need at least 3 characters to be located`);
    const other = seen.get(s);
    if (other) throw new Error(`${label}: ${other} and ${name} share the value ${JSON.stringify(v)}; example values must be distinct`);
    seen.set(s, name);
  }
}

function headersOf(e: Exchange): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.request.headers)) if (!DROP_HEADER.test(k)) out[k.toLowerCase()] = v;
  return out;
}

function pickExchange(input: LearnInput, exchanges: Exchange[], args: Args, warnings: string[]): Exchange {
  if (input.id !== undefined) {
    const e = exchanges.find((x) => x.id === input.id);
    if (!e) throw new Error(`no captured request with id ${input.id}`);
    return e;
  }
  const pool = input.match ? exchanges.filter((e) => matches(input.match!, e.request)) : exchanges;
  const ranked = rankCandidates(pool, args).filter((c) => input.match || c.hits.length);
  if (!ranked.length) {
    throw new Error(
      input.match
        ? `no captured request matches ${JSON.stringify(input.match)}`
        : "no captured request carries the example values; check the trigger, or pass match/id",
    );
  }
  const [top, next] = ranked;
  if (next && next.score === top!.score) {
    warnings.push(`ambiguous: requests #${top!.id} and #${next.id} rank equally; learned #${top!.id}, pass id or match to choose`);
  }
  return exchanges.find((e) => e.id === top!.id)!;
}

function paramSlots(leaves: Leaf[], args: Args, warnings: string[]): { slots: Slot[]; types: Map<string, Param["type"]> } {
  const slots: Slot[] = [];
  const types = new Map<string, Param["type"]>();
  const partial = new Map<string, { leaf: Leaf; names: string[] }>();
  for (const [name, raw] of Object.entries(args)) {
    const v = String(raw).toLowerCase();
    const places: string[] = [];
    let found = false;
    for (const leaf of leaves) {
      if (leaf.at[0] === "header:cookie") continue;
      const text = leaf.value.toLowerCase();
      if (text === v) {
        slots.push({ param: name, at: leaf.at });
        if (leaf.type === "number") types.set(name, "number");
        if (leaf.type === "boolean") types.set(name, "boolean");
      } else if (!leaf.container && text.includes(v)) {
        const p = partial.get(key(leaf.at)) ?? { leaf, names: [] };
        p.names.push(name);
        partial.set(key(leaf.at), p);
      } else continue;
      found = true;
      if (!leaf.at[0]!.startsWith("header:")) places.push(leaf.at.join(" > "));
    }
    if (!found) {
      warnings.push(`example value for "${name}" was not found in the request; the param has no effect`);
    }
    if (places.length > 1) warnings.push(`"${name}" appears in ${places.length} places, all will be filled: ${places.join("; ")}`);
  }
  for (const { leaf, names } of partial.values()) {
    let template = leaf.value;
    for (const name of names) template = template.replace(new RegExp(escapeRe(String(args[name])), "gi"), `{${name}}`);
    slots.push({ param: names[0]!, at: leaf.at, template });
  }
  return { slots, types };
}

function cookieCandidates(cookies: StoredCookie[], cookieHeader: string | undefined): Map<string, Pick<Slot, "ref" | "transform">> {
  const all = [...cookies.map((c) => [c.name, c.value] as const), ...Object.entries(parseCookieHeader(cookieHeader ?? ""))];
  const out = new Map<string, Pick<Slot, "ref" | "transform">>();
  for (const [name, value] of all) {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      /* keep raw */
    }
    const forms: [string, Slot["transform"]][] = [[value, undefined], [value.replace(/^"|"$/g, ""), "strip-quotes"], [decoded, "url-decode"]];
    for (const [v, transform] of forms) {
      if (v.length >= 8 && !out.has(v)) out.set(v, { ref: `cookie:${name}`, ...(transform ? { transform } : {}) });
    }
  }
  return out;
}

function shapeOf(s: string): Volatile["shape"] {
  const charset = /^\d+$/.test(s) ? "digits" : /^[0-9a-f]+$/i.test(s) ? "hex" : /^[A-Za-z0-9_-]+$/.test(s) ? "base64url" : "base64";
  return { charset, length: s.length };
}

function volatileAnchors(req: Request, leaves: Leaf[], taken: Set<string>, opName: string | undefined): Volatile[] {
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
      out.push({ at: leaf.at, shape: shapeOf(leaf.value), anchor: opName ?? anchorOf.get(leaf.value) ?? lastToken(leaf.at) });
    }
  }
  return out;
}

/** Path to the richest array carrying an example value, else the object holding it, else the biggest array. */
function suggestExtract(root: unknown, values: string[]): string | undefined {
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
      : Object.entries(v).map(([k, c]) => [/^[\w$-]+$/.test(k) ? (path ? `${path}.${k}` : k) : `${path}[${JSON.stringify(k)}]`, c]);
    if (Array.isArray(v) && path) {
      if (!anyArray || v.length > anyArray.len) anyArray = { path, len: v.length };
      const rank = v.length + (v.some((x) => x !== null && typeof x === "object") ? 1e6 : 0);
      if (v.length > 1 && (!bestArray || rank > bestArray.len) && carries(v)) bestArray = { path, len: rank };
    }
    for (const [p, c] of children) {
      const inner = typeof c === "string" ? innerJson(c) : undefined;
      if (inner && typeof inner === "object") queue.push({ v: inner, path: p, depth: depth + 1 });
      else if (c && typeof c === "object") queue.push({ v: c, path: p, depth: depth + 1 });
      else if (path && c != null && values.includes(String(c).toLowerCase()) && (!holder || depth > holder.depth)) holder = { path, depth };
    }
  }
  return bestArray?.path ?? holder?.path ?? anyArray?.path;
}

function learnResponse(e: Exchange, values: string[], warnings: string[]): ResponseSpec {
  const r = e.response;
  if (!r) return { format: "json" };
  const body = r.body ?? "";
  const xssiPrefix = body.trimStart().startsWith(XSSI) ? XSSI : undefined;
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
      ? 'response is HTML: set response.html {items, fields} or response.format "embedded" with a regex'
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
    if (!other) {
      missing.push(leaf.at.join(" > "));
      continue;
    }
    if (slot?.param) {
      const want = slot.template !== undefined ? fillTemplate(slot.template, args2) : String(args2[slot.param]);
      if (other.value.toLowerCase() !== want.toLowerCase()) {
        warnings.push(`run 2 has ${JSON.stringify(other.value)} at ${leaf.at.join(" > ")}, expected ${JSON.stringify(want)}`);
      }
      continue;
    }
    if (other.value === leaf.value) continue;
    const where = leaf.at.join(" > ");
    if (values2.some((v) => other.value.toLowerCase().includes(v))) {
      warnings.push(`${where} follows the args in run 2 but did not match example 1; check its format`);
    } else if ((/^\d+$/.test(leaf.value) && /^\d+$/.test(other.value)) || Math.max(leaf.value.length, other.value.length) <= 4) {
      // ponytail: digits-only or tiny values read as counters/timestamps (_reqid, __req), not signatures; a numeric signature would slip through
      warnings.push(`${where} varies between runs (counter or timestamp?); kept constant`);
    } else {
      nonces.push(where);
    }
  }
  if (missing.length) warnings.push(`run 2 lacks ${missing.length} position(s) of run 1, e.g. ${missing.slice(0, 3).join("; ")}`);
  return nonces;
}

export function learnOperation(input: LearnInput): Learned {
  const warnings: string[] = [];
  const [args1, args2] = input.examples;
  checkExamples(args1, "example");
  if (args2) {
    checkExamples(args2, "example 2");
    const k1 = Object.keys(args1).sort().join();
    if (Object.keys(args2).sort().join() !== k1) warnings.push("example 2 names different params than example 1");
  }

  // 1. pick the request
  const ex = pickExchange(input, input.exchanges, args1, warnings);
  let request: Request = {
    method: ex.request.method.toUpperCase(),
    url: ex.request.url,
    headers: headersOf(ex),
    ...(ex.request.body !== undefined ? { body: ex.request.body } : {}),
  };
  const leaves = walk(request);

  // 2. params
  const { slots, types } = paramSlots(leaves, args1, warnings);
  const taken = new Set(slots.map((s) => key(s.at)));

  // 4. session refs: cookie echoes anywhere, then auth/anti-bot headers by name
  const sessionValues: Record<string, string> = {};
  const cookieRefs = cookieCandidates(input.cookies, ex.request.headers.cookie);
  for (const leaf of leaves) {
    const ref = cookieRefs.get(leaf.value);
    // string leaves only: a ref is filled with a string, which would retype a JSON number
    if (!ref || leaf.type !== "string" || taken.has(key(leaf.at))) continue;
    slots.push({ ...ref, at: leaf.at });
    taken.add(key(leaf.at));
  }
  for (const [name, value] of Object.entries(request.headers)) {
    const at = [`header:${name}`];
    if (!SESSION_HEADER.test(name) || taken.has(key(at))) continue;
    slots.push({ ref: `session:${name}`, at });
    taken.add(key(at));
    sessionValues[name] = value;
  }
  // The spec never holds a credential: blank every ref'd leaf.
  for (const s of slots) if (s.ref) request = setAt(request, s.at, "");

  // 5. volatile anchors
  const opName = operationNameOf(request);
  const volatile = volatileAnchors(request, leaves, taken, opName);

  // match: stable identity, with param and hash-like path segments wildcarded
  const paramSegments = new Set(
    slots.filter((s) => s.param && s.at.length === 1 && s.at[0]!.startsWith("path:")).map((s) => Number(s.at[0]!.slice(5))),
  );
  const match = input.match ?? buildMatch(request, paramSegments);

  // 3. two-run diff
  let minTier: 1 | 2 | 3 = 1;
  if (input.exchanges2 && args2) {
    const pool = input.exchanges2.filter((e) => matches(match, e.request));
    const top = rankCandidates(pool, args2)[0];
    const ex2 = top && pool.find((e) => e.id === top.id);
    if (!ex2) {
      warnings.push("run 2 produced no matching request; skipped the two-run diff");
    } else {
      const nonces = diffRuns(request, { ...ex2.request, headers: headersOf(ex2) }, slots, args2, warnings);
      if (nonces.length) {
        minTier = 3;
        warnings.push(`changes between runs without an arg change (nonce/signature), so minTier 3: ${nonces.join("; ")}`);
      }
    }
  } else {
    warnings.push("learned from one example; a second example set separates params from nonces");
  }

  // 8. response
  const response = learnResponse(ex, Object.values(args1).map((v) => String(v).toLowerCase()), warnings);

  const params: Param[] = Object.entries(args1).map(([name, example]) => ({
    name,
    type: types.get(name) ?? "string",
    required: true,
    example,
  }));

  const operation = OperationSchema.parse({
    name: input.name,
    request,
    slots,
    volatile,
    trigger: input.trigger,
    match,
    response,
    params,
    readOnly: input.readOnly,
    minTier,
    learnedLoggedIn: loggedIn(input.cookies, input.loginCookies),
    learnedAt: new Date().toISOString(),
  });
  return { operation, warnings, sessionValues };
}

