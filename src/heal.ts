/**
 * Learning against the live site. One routine, run trigger -> match -> learn, serves three jobs:
 * add (create), recapture (heal), and the tier-3 read. Rescan is the browserless heal.
 */
import { join } from "node:path";
import { chromeAvailable, runTrigger } from "./browser.js";
import { judge, type Class } from "./classify.js";
import { asText, fillTemplate, getAt, setAt, walk } from "./codec.js";
import { hashLike, learnOperation, matches, type Args } from "./learn.js";
import { cookieHeaderFor, home, loadSession, mergeCapture, readJson, safeName, writePrivate } from "./session.js";
import type { Match, Operation, ResponseSpec, Site, Trigger, Volatile } from "./spec.js";
import { appendHeal, clearStale, loadSite, saveSite, scanSecrets } from "./store.js";
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
}

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
// ponytail: aborts every unsafe request while learning a write, even ones the page needs to render;
// a narrower matcher would risk letting the write itself through when the match is wrong.
const unsafe = (req: Exchange["request"]) => !SAFE_METHODS.has(req.method.toUpperCase());

/** Values of the op's session: header refs as the browser just sent them. */
function sessionValuesOf(op: Operation, e: Exchange): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of op.slots) {
    const header = s.at.length === 1 && s.at[0]!.startsWith("header:") ? s.at[0]!.slice(7) : undefined;
    const v = header && e.request.headers[header];
    if (s.ref?.startsWith("session:") && v) out[s.ref.slice(8)] = v;
  }
  return out;
}

export interface TriggerRun {
  capture: CaptureResult;
  /** first request matching op.match that got a response (or was aborted) */
  matched?: Exchange;
}

/** Run an op's trigger with args in the shared profile and refresh the session from it. */
export async function runOpTrigger(site: string, op: Operation, args: Args, o: { intercept?: boolean } = {}): Promise<TriggerRun> {
  const capture = await runTrigger({ ...fillTrigger(op.trigger, args), profileDir: profileDir(), intercept: o.intercept ? unsafe : undefined });
  const hits = capture.exchanges.filter((e) => matches(op.match, e.request));
  const matched = hits.find((e) => e.response || e.aborted) ?? hits[0];
  mergeCapture(site, capture.cookies, matched ? sessionValuesOf(op, matched) : {});
  return { capture, matched };
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
}

const captureFile = (id: string) => join(home(), "captures", `${safeName(id)}.json`);

/** Run a page, keep everything it sent under ~/.site2api/captures/<id>.json (0600: it holds cookies). */
export async function capturePage(o: { url: string; steps?: TriggerStep[]; softFrom?: string; write?: boolean }): Promise<CaptureFile> {
  const r = await runTrigger({ url: o.url, steps: o.steps, softFrom: o.softFrom, profileDir: profileDir(), intercept: o.write ? unsafe : undefined });
  const id = `c${Date.now().toString(36)}`;
  const file: CaptureFile = { id, at: new Date().toISOString(), url: o.url, steps: o.steps, softFrom: o.softFrom, ...r };
  writePrivate(captureFile(id), JSON.stringify(file));
  return file;
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
  /** learn from a saved capture instead of running the trigger; id = the request to learn */
  from?: { capture: CaptureFile; id?: number };
}

/** Put `{name}` back where an example value sits in a literal URL or step. */
function templatize(text: string, args: Args, encoded: boolean): string {
  let out = text;
  for (const [k, v] of Object.entries(args)) {
    const s = asText(v);
    if (s.length >= 3) out = out.split(encoded ? encodeURIComponent(s) : s).join(`{${k}}`);
  }
  return out;
}

export function putOperation(site: Site, op: Operation): Site {
  const rest = site.operations.filter((o) => o.name !== op.name);
  return { ...site, operations: [...rest, op] };
}

/**
 * Learn an op and save it to the user spec dir. Without `from`, the trigger runs twice (with
 * example 2, or example 1 again) so nonces show up. A write is learned from aborted requests only.
 */
export async function addOperation(i: AddInput): Promise<{ operation: Operation; warnings: string[]; path: string }> {
  safeName(i.site);
  const existing = loadSite(i.site)?.site;
  const [ex1, ex2] = i.examples;
  let trigger = i.trigger;
  if (!trigger && i.from) {
    const c = i.from.capture;
    trigger = {
      url: templatize(c.url, ex1, true),
      ...(c.softFrom ? { softFrom: c.softFrom } : {}),
      ...(c.steps ? { steps: c.steps.map((s) => ({ ...s, ...(s.value ? { value: templatize(s.value, ex1, false) } : {}) })) } : {}),
    };
  }
  if (!trigger) throw new Error("a trigger url is needed (or --from a capture)");
  if (trigger.url.startsWith("/")) {
    if (!existing) throw new Error(`relative trigger ${trigger.url} needs an existing site; use a full URL`);
    trigger = { ...trigger, url: existing.baseUrl.replace(/\/$/, "") + trigger.url };
  }

  let run1: CaptureResult;
  let run2: CaptureResult | undefined;
  if (i.from) {
    run1 = i.from.capture;
  } else {
    const run = (a: Args) => runTrigger({ ...fillTrigger(trigger!, a), profileDir: profileDir(), intercept: i.write ? unsafe : undefined });
    run1 = await run(ex1);
    run2 = await run(ex2 ?? ex1);
  }
  const learned = learnOperation({
    exchanges: run1.exchanges,
    exchanges2: run2?.exchanges,
    examples: run2 ? [ex1, ex2 ?? ex1] : [ex1],
    cookies: (run2 ?? run1).cookies,
    match: i.match,
    id: i.from?.id,
    name: i.op,
    trigger,
    readOnly: !i.write,
    loginCookies: existing?.loginCookies,
  });
  const r = i.response ?? {};
  const operation: Operation = {
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
  const site = putOperation(existing ?? { name: i.site, baseUrl: new URL(trigger.url).origin, operations: [] }, operation);
  const warnings = [...learned.warnings, ...scanSecrets(operation, session).secrets.map((s) => `credential left in the spec: ${s}`)];
  return { operation, warnings, path: saveSite(site) };
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

/** The token of the recorded shape closest to any occurrence of the anchor. */
function nearestToken(texts: string[], v: Volatile): string | undefined {
  const [chars, bound] = CHARSET[v.shape.charset];
  const re = new RegExp(`(?<![${bound}])[${chars}]{${v.shape.length}}(?![${bound}])`, "g");
  let best: { token: string; d: number } | undefined;
  for (const text of texts) {
    for (let i = text.indexOf(v.anchor); i >= 0; i = text.indexOf(v.anchor, i + 1)) {
      const from = Math.max(0, i - NEAR);
      const anchorEnd = i + v.anchor.length;
      for (const m of text.slice(from, anchorEnd + NEAR).matchAll(re)) {
        const token = m[0];
        if (v.shape.charset !== "digits" && !hashLike(token)) continue;
        const start = from + m.index;
        const end = start + token.length;
        if (end > i && start < anchorEnd) continue; // overlaps the anchor itself
        const d = end <= i ? i - end : start - anchorEnd;
        if (!best || d < best.d) best = { token, d };
      }
    }
  }
  return best?.token;
}

async function fetchText(url: string, headers: Record<string, string>, fetchImpl: typeof fetch): Promise<string> {
  try {
    const r = await fetchImpl(url, { headers, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
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
  const doc = await fetchText(url, headers(url), fetchImpl);
  if (!doc) return undefined;
  const refs = [
    ...doc.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ...doc.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.m?js(?:\?[^"']*)?)["']/gi),
  ].map((m) => new URL(m[1]!, url).href);
  // ponytail: only scripts the document references directly; ids in lazily loaded chunks need recapture.
  const scripts = await Promise.all([...new Set(refs)].slice(0, 40).map((s) => fetchText(s, headers(s), fetchImpl)));
  const texts = [doc, ...scripts];

  const types = new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]));
  let request = op.request;
  const changes: string[] = [];
  for (const v of op.volatile) {
    const old = asText(getAt(op.request, v.at));
    const token = nearestToken(texts, v);
    if (!token || token === old) continue;
    const numeric = types.get(JSON.stringify(v.at)) === "number";
    request = setAt(request, v.at, numeric ? BigInt(token) : token);
    changes.push(`${v.at.join(" > ")}: ${old} -> ${token}`);
  }
  return changes.length ? { operation: { ...op, request }, diff: changes.join("; ") } : undefined;
}

/* -------------------------------------------------------------- recapture */

const template = (op: Operation) => JSON.stringify([op.request, op.slots, op.volatile]);

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
    };

function saveHealed(site: string, op: Operation, strategy: "rescan" | "recapture", diff: string, attempt: Attempt): HealResult {
  const r = loadSite(site);
  if (!r) throw new Error(`site "${site}" disappeared during heal`);
  saveSite(putOperation(r.site, op));
  appendHeal({ site, op: op.name, strategy, diff });
  clearStale(site, op.name);
  return { outcome: "healed", strategy, operation: op, attempt };
}

/**
 * Rescan, then recapture; a candidate is saved only after `validate` (a replay) says ok.
 * A write's validation is the write itself, so a write gets exactly one validation in total.
 */
export async function healOperation(
  site: string,
  op: Operation,
  args: Args,
  o: { validate: (candidate: Operation) => Promise<Attempt>; fetchImpl?: typeof fetch; loginCookies?: string[]; browser?: boolean },
): Promise<HealResult> {
  let budget = op.readOnly ? 2 : 1;
  let last: Attempt | undefined;

  const scanned = await rescan(site, op, args, o.fetchImpl).catch(() => undefined);
  if (scanned) {
    budget--;
    last = await o.validate(scanned.operation);
    if (last.class === "ok") return saveHealed(site, scanned.operation, "rescan", scanned.diff, last);
    if (!budget) return { outcome: "failed", attempt: last, reason: `rescan swapped ${scanned.diff}, replay said ${last.reason}` };
  }
  if (o.browser === false) return { outcome: "failed", attempt: last, reason: "rescan found nothing new; recapture needs the browser (maxTier 1)" };
  if (!chromeAvailable()) return { outcome: "failed", attempt: last, reason: "rescan found nothing new; recapture needs Google Chrome" };

  const run = await runOpTrigger(site, op, args, { intercept: !op.readOnly });
  if (!run.matched) return { outcome: "failed", attempt: last, reason: `the trigger fired no request matching ${JSON.stringify(op.match)}` };
  const fallback = op.readOnly ? judgeExchange(op, run.matched) : undefined;
  let fresh: Operation;
  try {
    fresh = learnOperation({
      exchanges: run.capture.exchanges,
      examples: [args],
      cookies: run.capture.cookies,
      match: op.match,
      name: op.name,
      trigger: op.trigger,
      readOnly: op.readOnly,
      loginCookies: o.loginCookies,
    }).operation;
  } catch (e) {
    return { outcome: "failed", attempt: last, fallback, reason: `re-learning failed: ${(e as Error).message}` };
  }
  // The interface (params, trigger, match, what to extract) is the caller's contract; only the wire template heals.
  const candidate: Operation = {
    ...fresh,
    description: op.description,
    params: op.params,
    trigger: op.trigger,
    match: op.match,
    readOnly: op.readOnly,
    minTier: Math.max(op.minTier, fresh.minTier) as Operation["minTier"],
    response: { ...fresh.response, format: op.response.format, extract: op.response.extract, pick: op.response.pick, html: op.response.html, embedded: op.response.embedded },
  };
  if (template(candidate) === template(op)) {
    return { outcome: "identical", fallback, reason: "re-learning produced a byte-identical template" };
  }
  last = await o.validate(candidate);
  if (last.class === "ok") return saveHealed(site, candidate, "recapture", summarize(op, candidate), last);
  return { outcome: "failed", attempt: last, fallback, reason: `recaptured template failed replay: ${last.reason}` };
}
