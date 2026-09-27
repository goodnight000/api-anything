/**
 * Learning against the live site. One routine, run trigger -> match -> learn, serves three jobs:
 * add (create), recapture (heal), and the tier-3 read. Rescan is the browserless heal.
 */
import { join } from "node:path";
import { chromeAvailable, ProfileInUse, runTrigger } from "./browser.js";
import { botWall, judge, type Class } from "./classify.js";
import { asText, escapeTemplate, fillTemplate, getAt, setAt, walk } from "./codec.js";
import { capOutput, extract } from "./extract.js";
import { buildRequest, send } from "./http.js";
import { checkExamples, hashLike, learnOperation, matches, rankCandidates, type Args } from "./learn.js";
import { cookieHeaderFor, home, loadSession, mergeCapture, readJson, safeName, writePrivate } from "./session.js";
import type { Match, Operation, ResponseSpec, Site, Trigger, Volatile } from "./spec.js";
import { appendHeal, clearStale, loadSite, rememberTier, scanSecrets, updateSite } from "./store.js";
import type { CaptureResult, Exchange, TriggerStep } from "./types.js";

export const profileDir = () => join(home(), "profile");

/** One transport try, judged. `ambiguous`: no response came back, so a write may have run. */
export interface Attempt {
  tier: 1 | 2 | 3;
  class: Class;
  reason: string;
  status?: number;
  data?: unknown;
  ambiguous?: boolean;
  /** drift with the data missing from an otherwise fine response; see Classified.missing */
  missing?: boolean;
  /** the first answer was a redirect, so the server took the request (a write ran) */
  redirected?: boolean;
  /** a specific `next` for the agent (a local problem, not the site's) */
  hint?: string;
}

export const PROFILE_HINT =
  "another api-anything process (an MCP server?) holds the browser profile; it lets go after a few seconds idle: wait, or stop it, then retry once";

/** Fill `{param}` in a trigger. URL parts are percent-encoded; step values are typed as given. */
export function fillTrigger(t: Trigger, args: Args): Trigger {
  const enc = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, encodeURIComponent(asText(v))]));
  const step = (s: TriggerStep): TriggerStep => ({
    ...s,
    ...(s.selector !== undefined ? { selector: fillTemplate(s.selector, args) } : {}),
    ...(s.value !== undefined ? { value: fillTemplate(s.value, s.action === "goto" ? enc : args) } : {}),
  });
  return {
    url: fillTemplate(t.url, enc),
    ...(t.softFrom ? { softFrom: fillTemplate(t.softFrom, enc) } : {}),
    ...(t.steps ? { steps: t.steps.map(step) } : {}),
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Once the steps run, only these may still load: they can't carry a write the way an image ping,
// a link, a GET form, a JSONP script or an iframe can.
const INERT = new Set(["stylesheet", "font", "media"]);
/**
 * While learning a write: abort every unsafe request, and once the UI steps run, every request
 * but stylesheets, fonts and media (a "Follow" button may send a GET, an upvote may be
 * `new Image().src`). A known write's own match is aborted whatever its method. WebSocket
 * messages the page sends are dropped by the browser layer.
 * ponytail: also aborts requests the page needs after the click; a narrower matcher would risk
 * letting the write itself through when the match is wrong.
 */
export const writeGuard =
  (m?: Match) =>
  (e: Exchange, acting: boolean): boolean =>
    !SAFE_METHODS.has(e.request.method.toUpperCase()) ||
    (acting && !INERT.has(e.resourceType)) ||
    (!!m && Object.keys(m).length > 0 && matches(m, e.request));

/**
 * A read's trigger must not write either: a shared spec that says "read" but clicks a button that
 * POSTs. Once the steps run, unsafe requests other than the op's own are aborted.
 */
const readGuard =
  (m: Match) =>
  (e: Exchange, acting: boolean): boolean =>
    acting && e.resourceType !== "websocket" && !SAFE_METHODS.has(e.request.method.toUpperCase()) && !(Object.keys(m).length > 0 && matches(m, e.request));

/** Values of the op's session: refs as the browser just sent them. */
function sessionValuesOf(op: Operation, e: Exchange): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of op.slots) {
    if (!s.ref?.startsWith("session:")) continue;
    let v: unknown;
    try {
      v = getAt(e.request, s.at);
    } catch {
      continue;
    }
    const part = typeof v === "string" && s.template !== undefined ? refPart(s.template, s.ref, v, s.escape) : v;
    if (typeof part === "string" && part) out[s.ref.slice(8)] = part;
  }
  return out;
}

/** The text a templated ref holds inside a leaf: the template's other holes match anything. */
function refPart(template: string, ref: string, leaf: string, escape?: "url" | "json"): string | undefined {
  const re = template
    .split(/(\{\{|\}\}|\{[^{}]+\})/)
    .map((p) => (p === "{{" ? "\\{" : p === "}}" ? "\\}" : p === `{${ref}}` ? "(.*?)" : /^\{[^{}]+\}$/.test(p) ? ".*?" : escapeRe(p)))
    .join("");
  const m = new RegExp(`^${re}$`, "s").exec(leaf);
  if (!m) return undefined;
  try {
    return escape === "url" ? decodeURIComponent(m[1]!) : escape === "json" ? (JSON.parse(`"${m[1]}"`) as string) : m[1];
  } catch {
    return m[1];
  }
}

export interface TriggerRun {
  capture: CaptureResult;
  /** the request matching op.match that answers this run (see pickHit) */
  matched?: Exchange;
  /** the trigger landed on a sign-in page instead of the content */
  loginWall?: string;
}

/**
 * The matching exchange that is this run's answer: one carrying the run's args (a softFrom page
 * fires its own request first) and judged ok (a bot interstitial may precede the real page),
 * the latest on a tie.
 */
function pickHit(op: Operation, hits: Exchange[], args: Args): Exchange | undefined {
  const answered = hits.filter((e) => e.response || e.aborted);
  if (!answered.length) return hits[0];
  const want = Object.values(args).filter((v) => asText(v).length >= 3).length;
  const carries = new Map(rankCandidates(answered, args, { all: true }).map((c) => [c.id, c.hits.length >= want]));
  const score = (e: Exchange) => (carries.get(e.id) ? 2 : 0) + (e.aborted || judgeExchange(op, e)?.class === "ok" ? 1 : 0);
  return answered.reduce((best, e) => (score(e) >= score(best) ? e : best));
}

/** The final page of a run, when it is a sign-in page the trigger was redirected to. */
export function loginWall(capture: CaptureResult, triggerUrl: string): string | undefined {
  let f: URL;
  let t: URL;
  try {
    f = new URL(capture.finalUrl);
    t = new URL(triggerUrl);
  } catch {
    return undefined;
  }
  if (f.pathname === t.pathname) return undefined;
  const doc = capture.exchanges.filter((e) => e.resourceType === "document" && e.response?.body).at(-1);
  const password = /type=["']?password/i.test(doc?.response?.body ?? "");
  return password || /(log|sign)[-_]?in|\/accounts\/login|\/i\/flow\/login/i.test(f.pathname) ? f.pathname : undefined;
}

/** Run an op's trigger with args in the shared profile and refresh the session from it. */
export async function runOpTrigger(site: string, op: Operation, args: Args, o: { intercept?: boolean } = {}): Promise<TriggerRun> {
  const t = fillTrigger(op.trigger, args);
  const isHit = (e: Exchange) => matches(op.match, e.request);
  // A write's tier-3 run is the UI sending it for real; learning or healing one intercepts it.
  const intercept = o.intercept ? writeGuard(op.match) : op.readOnly ? readGuard(op.match) : undefined;
  const capture = await runTrigger({ ...t, profileDir: profileDir(), intercept, match: isHit });
  const matched = pickHit(op, capture.exchanges.filter(isHit), args);
  mergeCapture(site, capture.cookies, matched ? sessionValuesOf(op, matched) : {});
  const wall = matched?.response ? undefined : loginWall(capture, t.url);
  return { capture, matched, ...(wall ? { loginWall: wall } : {}) };
}

/** A tier-3 result: the site's own request, answered. */
export function judgeExchange(op: Operation, e: Exchange): Attempt | undefined {
  const r = e.response;
  if (!r) return undefined;
  return { tier: 3, status: r.status, ...judge(op, { status: r.status, headers: r.headers, body: r.body ?? "", url: e.request.url }) };
}

/* ------------------------------------------------------------ captures */

export interface CaptureFile extends CaptureResult {
  id: string;
  at: string;
  url: string;
  steps?: TriggerStep[];
  softFrom?: string;
  /** writes were intercepted during this run */
  write?: boolean;
}

const captureFile = (id: string) => join(home(), "captures", `${safeName(id)}.json`);
let lastId = "";

function saveCapture(o: { url: string; steps?: TriggerStep[]; softFrom?: string; write?: boolean }, r: CaptureResult): CaptureFile {
  let id = `c${Date.now().toString(36)}`;
  while (id <= lastId) id = `c${(parseInt(lastId.slice(1), 36) + 1).toString(36)}`;
  lastId = id;
  const file: CaptureFile = { id, at: new Date().toISOString(), url: o.url, steps: o.steps, softFrom: o.softFrom, ...(o.write ? { write: true } : {}), ...r };
  writePrivate(captureFile(id), JSON.stringify(file));
  return file;
}

/** Run a page, keep everything it sent under ~/.api-anything/captures/<id>.json (0600: it holds cookies). */
export async function capturePage(o: { url: string; steps?: TriggerStep[]; softFrom?: string; write?: boolean }): Promise<CaptureFile> {
  const r = await runTrigger({ url: o.url, steps: o.steps, softFrom: o.softFrom, profileDir: profileDir(), intercept: o.write ? writeGuard() : undefined });
  return saveCapture(o, r);
}

export function loadCapture(id: string): CaptureFile {
  const c = readJson<CaptureFile | undefined>(captureFile(id), undefined);
  if (!c) throw new Error(`no capture "${id}"`);
  return c;
}

/* ----------------------------------------------------------------- add */

export interface AddInput {
  site: string;
  op: string;
  /** url may be relative to an existing site's baseUrl; optional with `from` (derived from the capture) */
  trigger?: Trigger;
  examples: [Args] | [Args, Args];
  match?: Match;
  write?: boolean;
  description?: string;
  response?: Partial<Pick<ResponseSpec, "format" | "extract" | "pick" | "html" | "embedded">>;
  /** header names a human confirmed are public constants: kept literal instead of session refs */
  public?: string[];
  /** learn from a saved capture instead of running the trigger; id = the request to learn */
  from?: { capture: CaptureFile; id?: number };
  /** a second saved capture, made with examples[1], for the two-run diff */
  from2?: CaptureFile;
  fetchImpl?: typeof fetch;
}

export interface AddResult {
  operation: Operation;
  warnings: string[];
  path: string;
  /** the trigger runs, saved as captures (add --from <id> re-learns from them without Chrome) */
  captures: string[];
  /** what a call would have returned, judged on the captured response */
  preview?: { count?: number; first: unknown };
  /** an op of that name existed and was overwritten */
  replaced: boolean;
}

/** Put `{name}` back where an example value sits in a literal step (a typed value, a selector). */
function templatize(text: string, args: Args): string {
  let out = escapeTemplate(text);
  for (const [k, v] of Object.entries(args)) {
    const s = asText(v);
    if (s.length >= 3) out = out.split(escapeTemplate(s)).join(`{${k}}`);
  }
  return out;
}

const decodeLoose = (raw: string, plus: boolean) => {
  try {
    return decodeURIComponent(plus ? raw.replace(/\+/g, " ") : raw);
  } catch {
    return raw;
  }
};

/**
 * Put `{name}` back where an example value sits in a captured page URL: the query value under a key
 * named like the param, else every query value and path segment equal to it (however it was
 * encoded: + or %20, any case), else a substring of the path or query. The host stays literal.
 */
export function templatizeUrl(url: string, args: Args): string {
  const hashAt = url.indexOf("#");
  const noHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : url.slice(hashAt);
  const qAt = noHash.indexOf("?");
  const base = qAt < 0 ? noHash : noHash.slice(0, qAt);
  const pathAt = base.indexOf("/", base.indexOf("//") + 2);
  const origin = pathAt < 0 ? base : base.slice(0, pathAt);
  let segs = pathAt < 0 ? [] : base.slice(pathAt).split("/");
  let pairs = qAt < 0 ? undefined : noHash.slice(qAt + 1).split("&");
  const lit = (t: string) => escapeTemplate(t);
  segs = segs.map(lit);
  pairs = pairs?.map(lit);
  for (const [k, v] of Object.entries(args)) {
    const want = asText(v).toLowerCase();
    if (want.length < 3) continue;
    const hole = `{${k}}`;
    const valueOf = (p: string) => decodeLoose(p.slice(p.indexOf("=") + 1), true).toLowerCase();
    const keyOf = (p: string) => decodeLoose(p.slice(0, p.indexOf("=")), true).toLowerCase();
    const inQuery = (p: string) => p.includes("=") && valueOf(p) === want;
    const inPath = (seg: string) => decodeLoose(seg, false).toLowerCase() === want;
    // A query key named like the param is its position (?q= on /r/python/search). Otherwise an equal
    // path segment and query value are both taken (/u/nasa?tab=nasa): which one is the arg is unknown.
    const named = pairs?.some((p) => inQuery(p) && keyOf(p) === k.toLowerCase());
    if (pairs?.some(inQuery) || segs.some(inPath)) {
      pairs = pairs?.map((p) => (inQuery(p) && (!named || keyOf(p) === k.toLowerCase()) ? `${p.slice(0, p.indexOf("="))}=${hole}` : p));
      if (!named) segs = segs.map((seg) => (inPath(seg) ? hole : seg));
    } else {
      const forms = [...new Set([encodeURIComponent(asText(v)), encodeURIComponent(asText(v)).replace(/%20/g, "+"), asText(v)])].map((f) => escapeRe(lit(f)));
      const re = new RegExp(forms.join("|"), "gi");
      segs = segs.map((seg) => seg.replace(re, hole));
      pairs = pairs?.map((p) => (p.includes("=") ? `${p.slice(0, p.indexOf("=") + 1)}${p.slice(p.indexOf("=") + 1).replace(re, hole)}` : p));
    }
  }
  return `${lit(origin)}${segs.join("/")}${pairs ? `?${pairs.join("&")}` : ""}${lit(hash)}`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function putOperation(site: Site, op: Operation): Site {
  const rest = site.operations.filter((o) => o.name !== op.name);
  return { ...site, operations: [...rest, op] };
}

/** learnOperation, but a failure on a page that was a bot wall says so (the recipe or the pick is not the problem). */
function learnOrExplain(site: string, run: CaptureResult, input: Parameters<typeof learnOperation>[0]): ReturnType<typeof learnOperation> {
  try {
    return learnOperation(input);
  } catch (e) {
    const doc = run.exchanges.filter((x) => x.resourceType === "document" && x.response).at(-1);
    const wall = doc?.response && botWall({ status: doc.response.status, headers: doc.response.headers, body: doc.response.body ?? "" });
    if (wall) throw new Error(`the page served a bot challenge (${wall}): ask the user to run api-anything login ${site} and clear it, then add again`);
    throw e;
  }
}

/** The recipe finds data in this body (a non-empty list, or a value). */
function resolves(spec: ResponseSpec, body: string | undefined): boolean {
  if (!body) return false;
  try {
    const d = extract(spec, body);
    return d !== undefined && d !== null && !(Array.isArray(d) && !d.length);
  } catch {
    return false;
  }
}

function previewOf(data: unknown): AddResult["preview"] {
  const first = Array.isArray(data) ? data[0] : data;
  const cut = capOutput(first, 600);
  return { ...(Array.isArray(data) ? { count: data.length } : {}), first: cut.data };
}

/**
 * Learn an op and save it to the user spec dir. Without `from`, the trigger runs twice (with
 * example 2, or example 1 again) so nonces show up. A write is learned from aborted requests only.
 */
export async function addOperation(input: AddInput): Promise<AddResult> {
  const i = { ...input, site: safeName(input.site) };
  const existing = loadSite(i.site)?.site;
  const [ex1, ex2] = i.examples;
  for (const c of [i.from?.capture, i.from2]) {
    if (i.write && c && !c.write) throw new Error(`capture ${c.id} ran without --write, so any write in it was already sent; capture again with --write`);
  }
  let trigger = i.trigger;
  if (!trigger && i.from) {
    const c = i.from.capture;
    const step = (s: TriggerStep): TriggerStep => ({
      ...s,
      ...(s.selector ? { selector: templatize(s.selector, ex1) } : {}),
      ...(s.value ? { value: s.action === "goto" ? templatizeUrl(s.value, ex1) : templatize(s.value, ex1) } : {}),
    });
    trigger = { url: templatizeUrl(c.url, ex1), ...(c.softFrom ? { softFrom: c.softFrom } : {}), ...(c.steps ? { steps: c.steps.map(step) } : {}) };
  }
  if (!trigger) throw new Error("a trigger url is needed (or --from a capture)");
  if (trigger.url.startsWith("/")) {
    if (!existing) throw new Error(`relative trigger ${trigger.url} needs an existing site; use a full URL`);
    trigger = { ...trigger, url: existing.baseUrl.replace(/\/$/, "") + trigger.url };
  }
  const t0 = trigger;
  const unplaced = Object.keys(ex1).filter((k) => ![t0.url, t0.softFrom ?? "", ...(t0.steps ?? []).flatMap((st) => [st.selector ?? "", st.value ?? ""])].some((x) => x.includes(`{${k}}`)));

  let run1: CaptureResult;
  let run2: CaptureResult | undefined;
  const captures: string[] = [];
  if (i.from) {
    run1 = i.from.capture;
    run2 = i.from2;
  } else {
    const run = async (a: Args) => {
      const t = fillTrigger(trigger!, a);
      const r = await runTrigger({ ...t, profileDir: profileDir(), intercept: i.write ? writeGuard(i.match) : undefined });
      const saved = saveCapture({ url: t.url, steps: t.steps, softFrom: t.softFrom, write: i.write }, r);
      captures.push(saved.id);
      return saved;
    };
    run1 = await run(ex1);
    const wall = loginWall(run1, fillTrigger(trigger, ex1).url);
    if (wall) throw new Error(`the trigger landed on a sign-in page (${wall}): the site needs an account. Ask the user to run: api-anything login ${i.site}; then add again`);
    run2 = await run(ex2 ?? ex1);
  }
  const r = i.response ?? {};
  const spec: ResponseSpec = { format: r.html ? "html" : r.embedded ? "embedded" : "json", ...r };
  const learned = learnOrExplain(i.site, run1, {
    exchanges: run1.exchanges,
    exchanges2: run2?.exchanges,
    examples: run2 ? [ex1, ex2 ?? ex1] : [ex1],
    cookies: (run2 ?? run1).cookies,
    storage: { ...run2?.storage, ...run1.storage },
    match: i.match,
    id: i.from?.id,
    name: i.op,
    trigger,
    readOnly: !i.write,
    loginCookies: existing?.loginCookies,
    public: i.public,
    // With a response recipe, the request it resolves on is the answer (not a beacon echoing the page URL).
    ...(r.html || r.embedded || r.extract ? { accepts: (e: Exchange) => resolves(spec, e.response?.body) } : {}),
  });
  const recipe = r.html ?? r.embedded;
  const warnings = learned.warnings.filter((w) => !(recipe && w.startsWith("response is HTML")));
  if (unplaced.length) warnings.push(`the trigger has no {${unplaced.join("}, {")}}: tier-3 runs and heals would load the example's page; put the param in --trigger`);
  let operation: Operation = {
    ...learned.operation,
    ...(i.description ? { description: i.description } : {}),
    response: {
      ...learned.operation.response,
      ...r,
      ...(r.html ? { format: "html" as const } : {}),
      ...(r.embedded ? { format: "embedded" as const } : {}),
    },
  };
  const session = mergeCapture(i.site, (run2 ?? run1).cookies, learned.sessionValues);

  // Values that differ between two page loads are often session-scoped ids, not per-request
  // signatures. One replay of run 1's template with example 2's args tells them apart.
  if (operation.minTier === 3 && operation.readOnly && run2) {
    try {
      const sent = await send(operation, ex2 ?? ex1, session, { site: i.site, fetchImpl: i.fetchImpl });
      if (judge(operation, sent).class === "ok") {
        operation = { ...operation, minTier: 1 };
        warnings.push("...but run 1's template replays fine with example 2's args, so those values are session-scoped: minTier 1");
      }
    } catch {
      /* keep minTier 3 */
    }
  }

  let preview: AddResult["preview"];
  const res = learned.exchange.response;
  if (res) {
    const j = judge(operation, { status: res.status, headers: res.headers, body: res.body ?? "", url: learned.exchange.request.url });
    const again = captures[0] ?? i.from?.capture.id;
    if (j.class === "ok") preview = previewOf(j.data);
    else if (j.class === "blocked" || j.class === "auth" || j.class === "rate") {
      // a bot wall or a login page is not fixed by editing the recipe
      warnings.push(
        `the captured response is ${j.class}: ${j.reason}. The op was learned from ${j.class === "rate" ? "a throttled answer" : "a challenge or sign-in page"}: ` +
          (j.class === "rate" ? "wait a few minutes, then add again" : `ask the user to run api-anything login ${i.site} (and clear any challenge), then add again`),
      );
    } else warnings.push(`on the captured response this op says ${j.class}: ${j.reason}. Fix --extract/--pick/--html/--embedded and re-run add --from ${again} (no browser needed)`);
  }

  const allowed = new Set((operation.public ?? []).map((h) => `$.request.headers.${h}`));
  warnings.push(...scanSecrets(operation, session, allowed).secrets.map((s) => `credential left in the spec: ${s}`));
  // Re-read under the lock: another add or a heal may have saved this site since we started.
  let replaced = false;
  const path = updateSite(i.site, (current) => {
    replaced = !!current?.operations.some((o) => o.name === operation.name);
    return putOperation(current ?? { name: i.site, baseUrl: new URL(trigger.url).origin, operations: [] }, operation);
  });
  rememberTier(i.site, operation.name, undefined);
  clearStale(i.site, operation.name);
  return { operation, warnings, path, captures, ...(preview ? { preview } : {}), replaced };
}

/* ---------------------------------------------------------------- rescan */

const CHARSET: Record<Volatile["shape"]["charset"], [string, string]> = {
  // [token chars, chars that must not touch the token]
  digits: ["0-9", "0-9A-Za-z_"],
  hex: ["0-9a-fA-F", "0-9A-Za-z_"],
  base64url: ["A-Za-z0-9_-", "A-Za-z0-9_-"],
  base64: ["A-Za-z0-9+/=", "A-Za-z0-9+/="],
};
const NEAR = 300;

/**
 * Whether text between a token and its anchor (read left to right) keeps them in one group: no
 * bracket closes the group the scan started in, and no `;` ends a statement at that level. Meta's
 * `}),null);__d(` and X's `}},13:e=>{` end the previous module; a `"use strict";` nested inside the
 * anchor's own module does not.
 * ponytail: brackets inside string literals count too; a bundle string holding `}` could mislead it.
 */
function sameGroup(between: string): boolean {
  let depth = 0;
  for (const c of between) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth < 0) return false;
    } else if (c === ";" && depth === 0) return false;
  }
  return true;
}

/**
 * The token of the recorded shape next to the anchor. The anchor must stand as its own name
 * ("Followers" is not inside "FollowersYouKnow"), and an occurrence in code beats one in prose
 * (a log message "B failed", whitespace next to it). A token in the anchor's own group beats a
 * nearer one across a module boundary; a tie between two tokens is no answer.
 * `strict` (writes, whose validation is a real send): only a token that is the one candidate.
 */
function nearestToken(texts: string[], v: Volatile, strict = false): string | undefined {
  const [chars, bound] = CHARSET[v.shape.charset];
  const re = new RegExp(`(?<![${bound}])[${chars}]{${v.shape.length}}(?![${bound}])`, "g");
  const anchor = new RegExp(`(?<![A-Za-z0-9$])${escapeRe(v.anchor)}(?![A-Za-z0-9$])`, "g");
  const found: { token: string; d: number; same: boolean; prose: boolean }[] = [];
  for (const text of texts) {
    for (const a of text.matchAll(anchor)) {
      const i = a.index;
      const from = Math.max(0, i - NEAR);
      const anchorEnd = i + v.anchor.length;
      const prose = /\s/.test(text[i - 1] ?? "") || /\s/.test(text[anchorEnd] ?? "");
      for (const m of text.slice(from, anchorEnd + NEAR).matchAll(re)) {
        const token = m[0];
        if (v.shape.charset !== "digits" && !hashLike(token)) continue;
        const start = from + m.index;
        const end = start + token.length;
        if (end > i && start < anchorEnd) continue; // overlaps the anchor itself
        const between = end <= i ? text.slice(end, i) : text.slice(anchorEnd, start);
        found.push({ token, d: between.length, same: sameGroup(between), prose });
      }
    }
  }
  const code = found.some((f) => !f.prose) ? found.filter((f) => !f.prose) : found;
  const pool = code.some((f) => f.same) ? code.filter((f) => f.same) : strict ? [] : code;
  if (strict) {
    const distinct = new Set(pool.map((f) => f.token));
    return distinct.size === 1 ? [...distinct][0] : undefined;
  }
  const best = Math.min(...pool.map((f) => f.d));
  const tied = new Set(pool.filter((f) => f.d === best).map((f) => f.token));
  return tied.size === 1 ? [...tied][0] : undefined;
}

async function fetchText(url: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<{ text: string; url: string }> {
  try {
    const r = await fetchImpl(url, { headers, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return { text: r.ok ? await r.text() : "", url: r.url || url };
  } catch {
    return { text: "", url };
  }
}

/**
 * Browserless heal: fetch the trigger document and the scripts it references, and swap in the
 * token of each volatile's shape nearest its anchor. Undefined when nothing new was found.
 */
export async function rescan(site: string, op: Operation, args: Args, fetchImpl: typeof fetch = fetch): Promise<{ operation: Operation; diff: string } | undefined> {
  if (!op.volatile.length) return undefined;
  const session = loadSession(site);
  const url = fillTrigger(op.trigger, args).url;
  const headers = (u: string) => {
    const h: Record<string, string> = {};
    const ua = op.request.headers["user-agent"];
    const cookie = cookieHeaderFor(session.cookies, u);
    if (ua) h["user-agent"] = ua;
    if (cookie) h.cookie = cookie;
    return h;
  };
  const { text: doc, url: docUrl } = await fetchText(url, headers(url), fetchImpl);
  if (!doc) return undefined;
  // relative to the document's final URL: a redirect (a locale prefix) moves where "../static" points
  const refs = [
    ...doc.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ...doc.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.m?js(?:\?[^"']*)?)["']/gi),
  ].map((m) => new URL(m[1]!, docUrl).href);
  // ponytail: only scripts the document references directly; ids in lazily loaded chunks need recapture.
  const scripts = await Promise.all([...new Set(refs)].slice(0, 40).map(async (s) => (await fetchText(s, headers(s), fetchImpl)).text));
  const texts = [doc, ...scripts];

  const types = new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]));
  let request = op.request;
  const changes: string[] = [];
  for (const v of op.volatile) {
    const old = asText(getAt(op.request, v.at));
    const token = nearestToken(texts, v, !op.readOnly);
    if (!token || token === old) continue;
    const numeric = types.get(JSON.stringify(v.at)) === "number";
    request = setAt(request, v.at, numeric ? BigInt(token) : token);
    changes.push(`${v.at.join(" > ")}: ${old} -> ${token}`);
  }
  return changes.length ? { operation: { ...op, request }, diff: changes.join("; ") } : undefined;
}

/* -------------------------------------------------------------- recapture */

/** The wire template with these args filled in, so the example values an op was learned with don't count as a change. */
function template(op: Operation, args: Args): string {
  let req = op.request;
  try {
    req = buildRequest(op, args, { cookies: [], values: {} });
  } catch {
    /* compare raw */
  }
  return JSON.stringify([req, op.slots, op.volatile]);
}

function summarize(a: Operation, b: Operation): string {
  const parts: string[] = [];
  if (a.request.url !== b.request.url) parts.push(`url ${new URL(a.request.url).pathname} -> ${new URL(b.request.url).pathname}`);
  const names = new Set([...Object.keys(a.request.headers), ...Object.keys(b.request.headers)]);
  const headers = [...names].filter((n) => a.request.headers[n] !== b.request.headers[n]);
  if (headers.length) parts.push(`headers ${headers.join(",")}`);
  if (a.request.body !== b.request.body) parts.push("body");
  if (JSON.stringify(a.slots) !== JSON.stringify(b.slots)) parts.push(`slots ${a.slots.length} -> ${b.slots.length}`);
  return parts.join("; ") || "template unchanged";
}

export type HealResult =
  | { outcome: "healed"; strategy: "rescan" | "recapture"; operation: Operation; attempt: Attempt }
  | {
      outcome: "identical" | "failed";
      reason: string;
      /** the last validation replay, if one ran */
      attempt?: Attempt;
      /** reads: the site's own response from the recapture run (the tier-3 answer) */
      fallback?: Attempt;
      /**
       * nothing was learned about the op: the site throttled or challenged the check, the session
       * is logged out, or the browser could not start. Not a reason to mark the op stale.
       */
      transient?: boolean;
    };

// A check answered with these says nothing about the candidate: stop, and don't spend a browser run on it.
const STOP: ReadonlySet<Class> = new Set(["rate", "blocked", "auth"]);

function saveHealed(site: string, op: Operation, strategy: "rescan" | "recapture", diff: string, attempt: Attempt): HealResult {
  updateSite(site, (current) => {
    if (!current) throw new Error(`site "${site}" disappeared during heal`);
    return putOperation(current, op);
  });
  appendHeal({ site, op: op.name, strategy, diff });
  clearStale(site, op.name);
  return { outcome: "healed", strategy, operation: op, attempt };
}

const withDefaults = (op: Operation, args: Args): Args => {
  const out: Args = {};
  for (const p of op.params) {
    const v = args[p.name] ?? p.default;
    if (v !== undefined) out[p.name] = v;
  }
  return out;
};

/** Args the learner can locate: every param present, values distinct and 3+ chars. */
function learnable(op: Operation, a: Args): boolean {
  if (op.params.some((p) => a[p.name] === undefined)) return false;
  try {
    checkExamples(a, "args");
    return true;
  } catch {
    return false;
  }
}

/**
 * Rescan, then recapture; a candidate is saved only after `validate` (a replay) says ok.
 * A write's validation is the write itself, so a write gets exactly one validation in total.
 * Recapture learns from the call's args (defaults filled) when they can be located, else from the
 * op's examples, so a short arg ("page=2") or an omitted optional one never loses a slot.
 */
export async function healOperation(
  site: string,
  op: Operation,
  args: Args,
  o: { validate: (candidate: Operation) => Promise<Attempt>; fetchImpl?: typeof fetch; loginCookies?: string[]; browser?: boolean },
): Promise<HealResult> {
  let budget = op.readOnly ? 2 : 1;
  let last: Attempt | undefined;
  const callArgs = withDefaults(op, args);

  const scanned = await rescan(site, op, callArgs, o.fetchImpl).catch(() => undefined);
  const swapped = scanned ? `rescan swapped ${scanned.diff}, replay said ${"%s"}` : "";
  if (scanned) {
    budget--;
    last = await o.validate(scanned.operation);
    if (last.class === "ok") return saveHealed(site, scanned.operation, "rescan", scanned.diff, last);
    if (STOP.has(last.class)) return { outcome: "failed", attempt: last, transient: true, reason: swapped.replace("%s", last.reason) };
    if (!budget) return { outcome: "failed", attempt: last, reason: swapped.replace("%s", last.reason) };
  }
  const tried = scanned ? swapped.replace("%s", last!.reason) : "rescan found nothing new";
  if (o.browser === false) return { outcome: "failed", attempt: last, reason: `${tried}; recapture needs the browser (maxTier 1)` };
  if (!chromeAvailable()) return { outcome: "failed", attempt: last, reason: `${tried}; recapture needs Google Chrome` };

  const examples = withDefaults(op, Object.fromEntries(op.params.flatMap((p) => (p.example !== undefined ? [[p.name, p.example]] : []))));
  const learnArgs = learnable(op, callArgs) || !learnable(op, examples) ? callArgs : examples;
  let run: TriggerRun;
  try {
    run = await runOpTrigger(site, op, learnArgs, { intercept: !op.readOnly });
  } catch (e) {
    const reason = `the browser run failed: ${(e as Error).message.split("\n")[0]}`;
    // another process holds the profile: nothing about the op was learned
    if (e instanceof ProfileInUse) return { outcome: "failed", attempt: { tier: 3, class: "error", reason, hint: PROFILE_HINT }, transient: true, reason };
    return { outcome: "failed", attempt: last, reason };
  }
  if (!run.matched && run.loginWall) {
    return { outcome: "failed", transient: true, attempt: { tier: 3, class: "auth", reason: `the trigger landed on a sign-in page (${run.loginWall})` }, reason: `the trigger landed on a sign-in page (${run.loginWall})` };
  }
  if (!run.matched) return { outcome: "failed", attempt: last, reason: `the trigger fired no request matching ${JSON.stringify(op.match)}` };
  const seen = judgeExchange(op, run.matched);
  if (seen && STOP.has(seen.class)) return { outcome: "failed", attempt: seen, transient: true, reason: `the site's own request says ${seen.class}: ${seen.reason}` };
  // The site's own answer is this call's answer only when the trigger ran with this call's args.
  const fallback = op.readOnly && learnArgs === callArgs ? judgeExchange(op, run.matched) : undefined;
  let fresh: Operation;
  let sessionValues: Record<string, string>;
  try {
    ({ operation: fresh, sessionValues } = learnOperation({
      exchanges: run.capture.exchanges,
      examples: [learnArgs],
      cookies: run.capture.cookies,
      storage: run.capture.storage,
      match: op.match,
      name: op.name,
      trigger: op.trigger,
      readOnly: op.readOnly,
      loginCookies: o.loginCookies,
      public: op.public,
    }));
  } catch (e) {
    return { outcome: "failed", attempt: last, fallback, reason: `re-learning failed: ${(e as Error).message}` };
  }
  // A deploy that adds an auth/anti-bot header: its value is needed to validate (and later send) the candidate.
  mergeCapture(site, [], sessionValues);
  // An arg equal to a constant the old template had there ("search" in /api/search) is not a param position.
  const oldLeaves = new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.value.toLowerCase()]));
  const oldSlots = new Set(op.slots.map((sl) => JSON.stringify(sl.at)));
  fresh = {
    ...fresh,
    slots: fresh.slots.filter((sl) => {
      if (!sl.param) return true;
      const k = JSON.stringify(sl.at);
      if (oldSlots.has(k)) return true;
      const now = asText(getAt(fresh.request, sl.at)).toLowerCase();
      return oldLeaves.get(k) !== now;
    }),
  };
  // The interface (params, trigger, match, what to extract) is the caller's contract; only the wire template heals.
  const candidate: Operation = {
    ...fresh,
    description: op.description,
    params: op.params,
    trigger: op.trigger,
    match: op.match,
    readOnly: op.readOnly,
    ...(op.public ? { public: op.public } : {}),
    minTier: Math.max(op.minTier, fresh.minTier) as Operation["minTier"],
    response: { ...fresh.response, format: op.response.format, extract: op.response.extract, pick: op.response.pick, html: op.response.html, embedded: op.response.embedded },
  };
  const lost = [...new Set(op.slots.flatMap((s) => (s.param ? [s.param] : [])))].filter((p) => !candidate.slots.some((s) => s.param === p));
  if (lost.length) return { outcome: "failed", attempt: last, fallback, reason: `re-learning found no place for ${lost.join(", ")}; not saved` };
  if (template(candidate, learnArgs) === template(op, learnArgs)) {
    return { outcome: "identical", fallback, reason: "re-learning produced a byte-identical template" };
  }
  last = await o.validate(candidate);
  if (last.class === "ok") return saveHealed(site, candidate, "recapture", summarize(op, candidate), last);
  return { outcome: "failed", attempt: last, fallback, ...(STOP.has(last.class) ? { transient: true } : {}), reason: `recaptured template failed replay: ${last.reason}` };
}
