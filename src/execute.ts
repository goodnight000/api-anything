/**
 * call(): the execution ladder (DESIGN.md "Execution ladder"), the classifier-driven actions,
 * the heal-loop guards, and the write rules. Always sends the stored template first; healing is
 * reactive only.
 */
import {
  browserAvailable,
  type PageFetchResult,
  PageUnreachable,
  ProfileInUse,
  pageFetch,
  profileCookies,
} from "./browser.js";
import { type Class, judge } from "./classify.js";
import { asText } from "./codec.js";
import { capOutput } from "./extract.js";
import {
  type Attempt,
  firedNothing,
  type HealResult,
  healOperation,
  judgeExchange,
  learnedNothing,
  PROFILE_HINT,
  pageDown,
  profileDir,
  runOpTrigger,
} from "./heal.js";
import { BadHeader, buildRequest, holdsRef, nextHop, RedirectRefused, type Sent, send, withDefaults } from "./http.js";
import { reimportIfBrowser } from "./login.js";
import { redact } from "./secrets.js";
import {
  dropUnbound,
  loadSession,
  loggedIn,
  mergeCapture,
  type Session,
  saveSession,
  sessionFile,
  withLock,
} from "./session.js";
import type { Operation, Site } from "./spec.js";
import {
  beginWrite,
  lastHealAt,
  loadSite,
  markStale,
  rememberedTier,
  rememberTier,
  settleWrite,
  staleMark,
  type WriteGate,
  type WriteStatus,
} from "./store.js";
import type { StoredCookie } from "./types.js";

export type Tier = 1 | 2 | 3;

export interface CallOptions {
  /** required for any readOnly:false op, at every entry point */
  allowWrites?: boolean;
  /**
   * send a write even though the same one (same args) was sent within the last 10 minutes and may
   * have gone through; only when the user checked the site and wants it sent again
   */
  again?: boolean;
  /**
   * a write's caller-chosen key: a repeat with the same key, while the first may have gone through,
   * returns that call's record instead of sending. It replaces the args check: calls with different
   * keys are different writes
   */
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
  /** highest transport tier to use (default 3); 1 also means no browser at all, so no recapture or cookie refresh */
  maxTier?: Tier;
  /** per-site gap between tier-1 requests (default 1000) */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export type { WriteStatus };

/**
 * Whether to send the same call again. `safe`: now, once. `after_wait`: after `retryAfterMs`, or a
 * few minutes without it. `after_fix`: once the `nextCall` step is done. `no`: not as it is: a write
 * that went through or may have (check the site first), or a call that would meet the same answer.
 */
export type Retry = "no" | "safe" | "after_wait" | "after_fix";

export type NextAction =
  | "retry"
  | "login"
  | "heal"
  | "relearn"
  | "fix_args"
  | "list_sites"
  | "check_site"
  | "allow_writes"
  | "raise_tier"
  | "install_browser"
  | "report";

/** The one step `next` describes, for a program: the CLI and MCP each name it in their own terms. */
export interface NextCall {
  action: NextAction;
  site?: string;
  op?: string;
  /** login: a visible window, for a challenge or a sign-in the user clears by hand */
  mode?: "window";
  /** raise_tier: the tier the call needs */
  tier?: Tier;
}

export interface CallResult {
  ok: boolean;
  /** `duplicate`: a write refused because the same one may already have gone through */
  class: Class | "refused" | "duplicate";
  /** extracted, picked, capped */
  data?: unknown;
  truncated?: string;
  tier?: Tier;
  healed?: boolean;
  ms: number;
  reason?: string;
  /** what to do about a failure; follow it at most once */
  next?: string;
  /**
   * writes only, ok or not: `not_sent` nothing left; `not_applied` the site answered that it did not
   * run it; `accepted` a 2xx judged ok (proof the site took it, not that it took effect);
   * `may_have_applied` anything else that may have reached the site
   */
  write?: WriteStatus;
  /** failures only; never `safe` or `after_wait` for a write that is accepted or may_have_applied */
  retry?: Retry;
  /** the wait the site asked for (Retry-After) */
  retryAfterMs?: number;
  /** failures only: `next` as data */
  nextCall?: NextCall;
}

type Result = Omit<CallResult, "ms">;

const HEAL_GUARD_MS = 10 * 60_000;
// A write is retried only when the server certainly did not run it; timeouts and 5xx are ambiguous.
const NOT_EXECUTED = new Set([400, 401, 403, 404]);
/**
 * Certainly not run: a 400/401/403/404 answered to the request itself. After a redirect
 * (Post/Redirect/Get) it ran. At tier 3 the page sent it and the answer judged may be a redirect's
 * follow-up, with nothing to tell the two apart: never proof.
 */
const notRun = (a?: Attempt) => a?.status !== undefined && NOT_EXECUTED.has(a.status) && !a.redirected && a.tier !== 3;

interface Ctx {
  site: string;
  args: Record<string, unknown>;
  opts: CallOptions;
  maxTier: Tier;
  /** every attempt this call made, in order: what a write did is read from them */
  log: Attempt[];
}

/** What one attempt did to a write. */
const statusOf = (a: Attempt): WriteStatus =>
  a.unsent ? "not_sent" : a.class === "ok" ? "accepted" : a.rejected || notRun(a) ? "not_applied" : "may_have_applied";

/** What a call's attempts did to a write: the most that any of them may have done. */
function writeStatus(log: Attempt[]): WriteStatus {
  const seen = new Set(log.map(statusOf));
  for (const s of ["accepted", "may_have_applied", "not_applied"] as const) if (seen.has(s)) return s;
  return "not_sent";
}

/** The step an attempt's own facts ask for, before the class's usual one. */
export function stepOf(a: Attempt): Partial<Result> {
  const wait = a.retryAfterMs !== undefined ? { retryAfterMs: a.retryAfterMs } : {};
  if (a.hint === PROFILE_HINT) return { ...wait, nextCall: { action: "retry" }, retry: "after_wait" };
  if (a.step) return { ...wait, nextCall: { action: a.step } };
  if (a.rejected) return { ...wait, nextCall: { action: "fix_args" } };
  return wait;
}

const DEFAULT_STEP: Record<CallResult["class"], NextCall | undefined> = {
  ok: undefined,
  refused: { action: "allow_writes" },
  duplicate: { action: "check_site" },
  input: { action: "fix_args" },
  auth: { action: "login" },
  rate: { action: "retry" },
  blocked: { action: "login", mode: "window" },
  drift: { action: "heal" },
  error: { action: "retry" },
};

/**
 * The structured fields every result carries, filled from its class and what was sent where the
 * code that built it did not say: one place keeps them consistent (test/execute.test.ts's table).
 * A write that went through or may have gets retry "no" and check_site, whatever else was said.
 */
export function finish(r: Result, op: Operation | undefined, site: string | undefined, log: Attempt[]): Result {
  const out: Result = { ...r };
  if (op && !op.readOnly) out.write = r.write ?? writeStatus(log);
  if (r.ok) {
    delete out.retry;
    delete out.nextCall;
    return out;
  }
  // a duplicate is held back because the first one may have run: the same answer
  const ran = out.write === "accepted" || out.write === "may_have_applied" || r.class === "duplicate";
  let step: NextCall | undefined = ran ? { action: "check_site" } : (r.nextCall ?? DEFAULT_STEP[r.class]);
  if (step?.action === "heal" && op && !op.readOnly) step = { action: "relearn" };
  if (step)
    out.nextCall = {
      ...step,
      ...(site && step.action !== "list_sites" ? { site, ...(op ? { op: op.name } : {}) } : {}),
    };
  const a = out.nextCall?.action;
  out.retry = ran
    ? "no"
    : (r.retry ??
      (a === "retry"
        ? r.class === "rate"
          ? "after_wait"
          : "safe"
        : a === "check_site" || a === "report" || a === undefined
          ? "no"
          : "after_fix"));
  return out;
}

function nextFor(c: CallResult["class"], site: string, op: Operation, a?: Attempt): string | undefined {
  if (c === "ok") return undefined;
  if (c === "refused")
    return "only if the user asked for this write: rerun with --allow-writes (MCP: start the server with --allow-writes)";
  if (a?.hint) return a.hint;
  // A write the server may have run: never invite a second send.
  const ran = !op.readOnly && a !== undefined && statusOf(a) === "may_have_applied";
  if (ran && c !== "drift" && c !== "auth") return "the write may have gone through: check the site before any retry";
  if (a?.rejected)
    return `the site refused the write, so it did not run: read reason, check the args against: api-anything ops ${site}; do not send it again unchanged`;
  switch (c) {
    case "auth":
      return `ask the user to run: api-anything login ${site}; then ${ran ? "check the site, and retry only if the write is not there" : "retry once"}`;
    case "rate":
      return a?.retryAfterMs !== undefined
        ? "rate limited: do not retry before retryAfterMs (the time in reason)"
        : "rate limited: do not retry now; wait a few minutes";
    case "blocked":
      return `the site is challenging automated requests: ask the user to run api-anything login ${site} and clear the challenge, then retry once`;
    case "drift":
      if (!op.readOnly)
        return `${ran ? "the write may have run: check the site first, then " : ""}re-learn it with api-anything add ${site} ${op.name} ... --write`;
      return `api-anything heal ${site} ${op.name}; if that fails, re-learn it with api-anything add ${site} ${op.name} ...`;
    case "input":
      return `check the args against: api-anything ops ${site}`;
    default:
      return "retry once; if it fails the same way, stop and report the reason";
  }
}

const success = (a: Attempt, extra: Partial<Result> = {}): Result => ({
  ok: true,
  class: "ok",
  tier: a.tier,
  ...capOutput(a.data),
  ...extra,
});

/** The op's stored example args, with defaults; undefined when a required param has none. */
function exampleArgs(op: Operation): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = p.example ?? p.default;
    if (v !== undefined) out[p.name] = v;
    else if (p.required) return undefined;
  }
  return out;
}

const sameArgs = (a: Record<string, unknown>, b: Record<string, unknown>, op: Operation) =>
  op.params.every((p) => asText(a[p.name] ?? p.default ?? "") === asText(b[p.name] ?? p.default ?? ""));

/** Never throws: a browser that fails to launch or a page that fails to load is a failed heal. */
const safeHeal = (p: Promise<HealResult>): Promise<HealResult> =>
  p.catch((e: Error) => ({ outcome: "failed" as const, reason: `heal crashed: ${e.message.split("\n")[0]}` }));

/** What to do about a write whose redirect was not followed, since that would have sent it again. */
const sentOnce = (site: string, op: Operation) =>
  `the write was sent once and may have run: check the site first. Do not retry: the site answered it with a redirect that would send it a second time, which was not followed; if the operation moved, learn it at its new address: api-anything add ${site} ${op.name} ... --write`;

const sessionOrNone = (site: string): Session | undefined => {
  try {
    return loadSession(site);
  } catch {
    return undefined;
  }
};

/** `text` without the live values of any of `sessions`; see `redact`. */
const hide = (text: string, sessions: (Session | undefined)[], cut = false) =>
  sessions.reduce((t, s) => (s ? redact(t, s, { cut }) : t), text);

/**
 * One try at a tier, logged for the call's write status. A reason quotes the response, which can
 * echo a credential (a 401 naming the token it refused): redacted against the jar as it was before
 * the send and after it (a rotated cookie), with the snippet's cut end treated as cut.
 */
async function attempt(ctx: Ctx, op: Operation, tier: Tier): Promise<Attempt> {
  const before = sessionOrNone(ctx.site);
  const a = await tryTier(ctx, op, tier);
  ctx.log.push(a);
  return { ...a, reason: hide(a.reason, [before, sessionOrNone(ctx.site)], true) };
}

async function tryTier(ctx: Ctx, op: Operation, tier: Tier): Promise<Attempt> {
  try {
    if (tier === 3) {
      // For a write this is the UI sending it: the one attempt.
      const run = await runOpTrigger(ctx.site, op, ctx.args);
      const judged = run.matched && judgeExchange(op, run.matched);
      // The page is told nothing of a redirect that was stopped, its status included: this is the answer.
      const resent: Attempt | undefined = run.resends
        ? {
            tier,
            class: "error",
            reason: "the site answered this write with a redirect that would send it again: stopped in the browser",
            ambiguous: true,
            hint: sentOnce(ctx.site, op),
          }
        : undefined;
      const a: Attempt =
        judged ||
        resent ||
        (run.loginWall
          ? { tier, class: "auth", reason: `the trigger landed on a sign-in page (${run.loginWall})` }
          : (pageDown(run.capture) ?? {
              tier,
              class: "drift",
              reason: firedNothing(op, run.capture),
              // a write's confirm told no: the page's handler stopped there, and its request never left
              ...(!op.readOnly && run.capture.dialogs?.some((d) => d.type === "confirm" && !d.accepted)
                ? { unsent: true }
                : {}),
            }));
      if (!run.repeats) return a;
      const stopped = run.repeats === 1 ? "the repeat was" : `${run.repeats} repeats were`;
      return { ...a, note: `the page sent this write ${run.repeats + 1} times: ${stopped} stopped in the browser` };
    }
    const session = loadSession(ctx.site);
    let r: Sent | PageFetchResult;
    if (tier === 1) {
      const sent = await send(op, ctx.args, session, {
        site: ctx.site,
        fetchImpl: ctx.opts.fetchImpl,
        timeoutMs: ctx.opts.timeoutMs,
        minIntervalMs: ctx.opts.minIntervalMs,
      });
      // A rotating cookie (a rolling session, __cf_bm) must ride on the next call.
      if (sent.setCookies) {
        try {
          mergeCapture(ctx.site, sent.setCookies);
        } catch {
          /* a read-only home still answers this call */
        }
      }
      r = sent;
    } else {
      const req = buildRequest(op, ctx.args, session);
      const { cookie: _jar, ...headers } = req.headers; // the page sends the profile's own cookies
      r = await pageFetch({
        origin: new URL(req.url).origin,
        url: req.url,
        method: req.method,
        headers,
        body: req.body,
        profileDir: profileDir(),
        timeoutMs: ctx.opts.timeoutMs,
        retryOnNavigation: op.readOnly,
        // tier 1's policy, one hop at a time: a page's own fetch() would follow with everything aboard
        redirect: (from, status, location, taken) => nextHop(op, session, from, status, location, taken),
      });
    }
    return { tier, status: r.status, ...(r.redirected ? { redirected: true } : {}), ...judge(op, r) };
  } catch (e) {
    // nothing was sent when the browser could not start
    if (e instanceof ProfileInUse) return { tier, class: "error", reason: e.message, hint: PROFILE_HINT, unsent: true };
    if (e instanceof RedirectRefused) {
      // The redirect is the site's answer, so a retry meets it again; the request it answered was sent.
      const add = `api-anything add ${ctx.site} ${op.name} ...${op.readOnly ? "" : " --write"}`;
      if (e.kind === "again")
        return {
          tier,
          class: "error",
          reason: e.message,
          ambiguous: true,
          hint: sentOnce(ctx.site, op),
          step: "check_site",
        };
      const why = e.kind
        ? `the site's redirects for this request do not end (a loop, or a chain past the limit); learn the operation again from the page that uses it, at the address the site now answers from: ${add}`
        : op.readOnly
          ? `the site sends this request on to another origin, which was not followed; re-learn it with ${add} if the site moved there`
          : `re-learn it with ${add} if the site moved there`;
      const hint = op.readOnly
        ? `do not retry: ${why}`
        : `the write may have run: check the site first. Do not retry: ${why}`;
      return { tier, class: "error", reason: e.message, ambiguous: true, hint, step: "relearn" };
    }
    // No answer (a timeout, a reset, a page that did not load) teaches nothing about the request; a
    // trigger step that failed (its button is gone) does.
    const reason = (e as Error).message.split("\n")[0]!;
    return {
      tier,
      class: "error",
      reason,
      ambiguous: true,
      ...(tier < 3 || e instanceof PageUnreachable ? { server: true } : {}),
      // tier 2 fetches from the site's origin page: when that did not load, the request never left
      ...(tier === 2 && e instanceof PageUnreachable ? { unsent: true } : {}),
    };
  }
}

/**
 * Replace the jar with the profile's cookies. True when that changes the request this tier sends:
 * a tier-2 page sends the profile's own cookies, so there the jar only fills `cookie:` refs.
 */
async function refreshCookies(ctx: Ctx, op: Operation, tier: Tier): Promise<boolean> {
  if (!browserAvailable()) return false;
  let fresh: StoredCookie[];
  try {
    fresh = await profileCookies({ url: op.request.url, profileDir: profileDir() });
  } catch {
    return false;
  }
  const swap = () => {
    const s = loadSession(ctx.site);
    const sent = (cookies: StoredCookie[]) => {
      try {
        const req = buildRequest(op, ctx.args, { ...s, cookies });
        if (tier > 1) delete req.headers.cookie;
        return JSON.stringify(req);
      } catch {
        return undefined; // a cookie: ref with nowhere to go; the retry reports it like any failed attempt
      }
    };
    const before = sent(s.cookies);
    saveSession(ctx.site, { ...s, cookies: fresh });
    return sent(fresh) !== before;
  };
  try {
    return withLock(sessionFile(ctx.site), swap);
  } catch {
    return false; // a full disk, an unreadable session file: nothing refreshed, and the call keeps its own answer
  }
}

async function onDrift(ctx: Ctx, site: Site, op: Operation, a: Attempt): Promise<Result> {
  const fail = (b: Attempt, extra: Partial<Result> = {}): Result => ({
    ok: false,
    class: b.class,
    tier: b.tier,
    reason: b.reason,
    next: nextFor(b.class, ctx.site, op, b),
    ...stepOf(b),
    ...extra,
  });

  // An op learned signed in, called with no login cookie: the site hides the data from guests; it did not move.
  if (a.missing && op.learnedLoggedIn && !loggedIn(loadSession(ctx.site).cookies, site.loginCookies)) {
    return fail(
      { ...a, class: "auth" },
      { reason: `${a.reason}; the op was learned signed in and the session has no login cookie` },
    );
  }

  // A server that sometimes answers without the data (Google's fallback page, issue #21) answers a second
  // try: before the args are blamed or a browser heals, the same request goes once more.
  if (a.missing && op.readOnly && a.tier < 3) {
    const again = await attempt(ctx, op, a.tier);
    if (again.class === "ok")
      return success(again, { reason: `the first answer had no data (${a.reason}); a second try did` });
    if (learnedNothing(again)) return fail(again);
  }

  // "No such user" and "no results" look exactly like a moved extract path. If the example args
  // still return data through the same template, nothing drifted: the args are the problem.
  const examples = exampleArgs(op);
  /** the op's own example args got no data either: the args are not the problem */
  let examplesFail = false;
  if (a.missing && op.readOnly && examples) {
    if (sameArgs(examples, ctx.args, op)) examplesFail = true;
    else {
      const b = await attempt({ ...ctx, args: examples }, op, a.tier);
      if (b.class === "ok") {
        return fail(
          { ...a, class: "input" },
          {
            reason: `no results for these args (${a.reason}); the example args still return data, so the operation works`,
            next: `check the args against: api-anything ops ${ctx.site}; do not heal or re-add`,
          },
        );
      }
      // throttled, challenged or a server failure while checking: stop, don't spend a heal (a browser run) against it
      if (learnedNothing(b)) return fail(b);
      examplesFail = true;
    }
  }

  let guard: string | undefined;
  const stale = staleMark(ctx.site, op.name);
  const healedAt = lastHealAt(ctx.site, op.name);
  if (stale) guard = `stale until ${new Date(stale.until).toISOString()}: ${stale.reason}`;
  else if (healedAt !== undefined && Date.now() - healedAt < HEAL_GUARD_MS) {
    const reason = `drifted again within 10 min of a heal (${a.reason})`;
    markStale(ctx.site, op.name, reason);
    guard = `marked stale: ${reason}`;
  }
  if (guard) {
    // Not re-healed. A read can still get its answer from the site's own frontend.
    if (op.readOnly && a.tier < 3 && ctx.maxTier >= 3 && stale?.tier3 !== false && browserAvailable()) {
      const b = await attempt(ctx, op, 3);
      if (b.class === "ok") return success(b, { reason: guard });
      // the site's own request doesn't answer either: stop paying a browser run per call
      if (!b.hint && b.class !== "auth" && !b.server)
        markStale(ctx.site, op.name, stale?.reason ?? guard, undefined, undefined, { tier3: false });
    }
    // `heal` refuses writes: a stale write is re-learned
    const next = op.readOnly
      ? `wait for the stale mark to expire, or force it: api-anything heal ${ctx.site} ${op.name}`
      : `wait for the stale mark to expire, or re-learn it: api-anything add ${ctx.site} ${op.name} ... --write`;
    return fail(a, { reason: `${a.reason}; ${guard}`, next });
  }

  // A candidate is validated by replaying it; at tier 3 the site's own request would answer instead, validating nothing.
  const h = await safeHeal(
    healOperation(ctx.site, op, ctx.args, {
      validate: (candidate) => attempt(ctx, candidate, Math.min(a.tier, 2) as Tier),
      fetchImpl: ctx.opts.fetchImpl,
      loginCookies: site.loginCookies,
      browser: ctx.maxTier > 1,
    }),
  );
  if (h.outcome === "healed") return success(h.attempt, { healed: true });
  // Throttled, challenged, logged out, or no browser: nothing was learned about the op, so it is not stale.
  if (h.outcome === "failed" && h.transient) {
    // the replay that would have saved a candidate got no answer, but the site's own request did: that is the tier-3 read
    if (h.fallback?.class === "ok" && ctx.maxTier >= 3)
      return success(h.fallback, { reason: `heal stopped (${h.reason}); answered by the site's own request` });
    const b = h.attempt ?? a;
    return fail(b, { reason: `${a.reason}; heal stopped: ${h.reason}` });
  }
  // A heal that tried everything and failed would fail the same way on the next call: don't rerun the browser each time.
  if (h.outcome === "failed" && ctx.maxTier > 1)
    markStale(ctx.site, op.name, `heal failed: ${h.reason}`, undefined, undefined, {
      tier3: h.fallback?.class === "ok",
    });
  // The template can't be replayed, but the site's own request answered: that is the tier-3 read.
  if (h.fallback?.class === "ok" && ctx.maxTier >= 3)
    return success(h.fallback, { reason: `heal failed (${h.reason}); answered by the site's own request` });
  if (h.outcome === "identical") {
    if (examplesFail) {
      // Same request, and even the examples get no data: the response recipe drifted (a renamed field), or the site is down.
      return fail(
        { ...a, class: "drift" },
        {
          reason: `the site takes the same request but its response lacks the data (${a.reason}), for the op's example args too`,
          next: `if the site works in a browser, re-learn the response recipe: api-anything add ${ctx.site} ${op.name} ... --extract <path> (api-anything capture <trigger url> shows the response); otherwise report it`,
          nextCall: { action: "relearn" },
        },
      );
    }
    return fail(
      { ...a, class: "input" },
      {
        reason: `not drift: re-learning gave a byte-identical template (${a.reason})`,
        next: `check the args against api-anything ops ${ctx.site}; if the site needs an account, ask the user to run api-anything login ${ctx.site}`,
      },
    );
  }
  const b = h.attempt ?? h.fallback ?? a;
  return fail(b, { reason: `${b.reason}; heal failed: ${h.reason}` });
}

function resolve(siteName: string, opName: string): { site: Site; op: Operation; theirs: boolean } | Result {
  let r: ReturnType<typeof loadSite>;
  try {
    r = loadSite(siteName);
  } catch (e) {
    const bad = /invalid site name/.test((e as Error).message);
    return {
      ok: false,
      class: bad ? "input" : "error",
      reason: (e as Error).message.split("\n")[0],
      next: bad ? "api-anything sites lists what exists" : "fix or delete that spec file, then retry once",
      // a broken file on this machine: the user fixes it, then the call works
      ...(bad ? { nextCall: { action: "list_sites" } } : { nextCall: { action: "report" }, retry: "after_fix" }),
    };
  }
  if (!r)
    return {
      ok: false,
      class: "input",
      reason: `no site "${siteName}"`,
      next: `api-anything sites lists what exists; api-anything pull ${siteName} fetches it if someone shared it`,
      nextCall: { action: "list_sites" },
    };
  const op = r.site.operations.find((o) => o.name === opName);
  if (!op)
    return {
      ok: false,
      class: "input",
      reason: `no operation "${opName}" on ${r.site.name}`,
      next: `api-anything ops ${r.site.name}`,
    };
  // someone else's: pulled, bundled, or a heal's copy of a pulled one
  return { site: r.site, op, theirs: r.source !== "user" || !!r.site.shared };
}

/** The answer to a write the ledger held back: nothing is sent. */
function heldBack(g: Exclude<WriteGate, { send: true }>, op: Operation): Result {
  const when = new Date(g.earlier.at).toISOString();
  const was: WriteStatus = g.earlier.status === "sending" ? "may_have_applied" : g.earlier.status;
  const again = "repeat the call with again (CLI --again, MCP again: true)";
  if (g.why === "key_reused")
    return {
      ok: false,
      class: "input",
      write: "not_sent",
      reason: `not sent: this idempotency key was used at ${when} for ${op.name} with other args`,
      next: "give each different write its own idempotency key",
    };
  if (g.why === "replay") {
    const ok = g.earlier.ok === true && was === "accepted";
    return {
      ok,
      class: ok ? "ok" : ((g.earlier.class as CallResult["class"] | undefined) ?? "error"),
      write: was,
      reason: `not sent again: this idempotency key was sent at ${when}, and this is that call's record (${was === "accepted" ? "the site accepted it" : "it may have gone through"})`,
      ...(ok ? {} : { next: "the write may have gone through: check the site before any retry" }),
    };
  }
  return {
    ok: false,
    class: "duplicate",
    write: "not_sent",
    reason: `not sent: the same write (same args) was sent at ${when} and ${was === "accepted" ? "the site accepted it" : "may have gone through"}`,
    next: `check the site: the write is probably there. Only if it is not, and the user wants it sent again, ${again}`,
  };
}

/** Call one operation. Never throws for site-side failures; the result carries class, reason and next. */
export async function call(
  siteName: string,
  opName: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<CallResult> {
  const t0 = Date.now();
  const log: Attempt[] = [];
  let resolved: Operation | undefined;
  /** the jar as the call found it: a value it rotated out can still be quoted in a reason */
  let jar: Session | undefined;
  /** this write's ledger record, settled with what the call did */
  let ledger: string | undefined;
  const done = (r: Result): CallResult => {
    const f = finish(r, resolved, resolved ? siteName : undefined, log);
    const sessions = [jar, resolved ? sessionOrNone(siteName) : undefined];
    if (f.reason) f.reason = hide(f.reason, sessions, true);
    if (f.next) f.next = hide(f.next, sessions);
    if (ledger) settleWrite(ledger, f.write ?? "may_have_applied", f);
    return { ...f, ms: Date.now() - t0 };
  };
  const found = resolve(siteName, opName);
  if ("ok" in found) return done(found);
  const { site, op, theirs } = found;
  resolved = op;
  siteName = site.name;
  const write = !op.readOnly;
  if (write && !opts.allowWrites) {
    return done({
      ok: false,
      class: "refused",
      reason: `${op.name} is a write and writes are not allowed`,
      next: nextFor("refused", siteName, op),
    });
  }
  // A misspelled optional arg would silently fall back to its default: refuse it.
  const unknown = Object.keys(args).filter((k) => !op.params.some((p) => p.name === k));
  if (unknown.length) {
    const takes = op.params.map((p) => p.name).join(", ") || "no args";
    return done({
      ok: false,
      class: "input",
      reason: `unknown arg ${unknown.join(", ")}; ${op.name} takes ${takes}`,
      next: nextFor("input", siteName, op),
    });
  }
  // Resolved once: the tier-3 trigger and its answer's match take a default just as the request does.
  args = withDefaults(op, args);
  let session: Session;
  try {
    if (theirs) dropUnbound(siteName);
    session = loadSession(siteName);
    jar = session;
  } catch (e) {
    return done({
      ok: false,
      class: "error",
      reason: (e as Error).message,
      next: `delete ${sessionFile(siteName)}, then ask the user to run api-anything login ${siteName} if the site needs an account`,
      nextCall: { action: "report" },
      retry: "after_fix",
    });
  }
  try {
    buildRequest(op, args, session);
  } catch (e) {
    const next =
      e instanceof BadHeader
        ? `nothing was sent. Check the args; if the value is the session's, ask the user to run: api-anything login ${siteName}`
        : nextFor("input", siteName, op);
    return done({ ok: false, class: "input", reason: (e as Error).message, next });
  }
  if (write) {
    let gate: WriteGate | undefined;
    try {
      gate = beginWrite(siteName, op.name, args, { again: opts.again, idempotencyKey: opts.idempotencyKey });
    } catch (e) {
      // Without a record a repeat cannot be caught: only a caller that already said "send it again" goes on.
      if (!opts.again)
        return done({
          ok: false,
          class: "error",
          reason: `the write was not sent: it could not be recorded first, so a repeat of it could not be caught (${(e as Error).message.split("\n")[0]})`,
          next: "ask the user to make the api-anything home directory writable; only if they want it sent without the duplicate guard, repeat the call with again (CLI --again)",
          nextCall: { action: "report" },
          retry: "after_fix",
        });
    }
    if (gate && !gate.send) return done(heldBack(gate, op));
    ledger = gate?.id;
  }

  // No login on record for this site: the session has no source (a login records one, logout clears it),
  // the jar has no live login cookie, and the op neither takes a credential nor was learned signed in.
  // Asked when it matters, not at the start: recovery may have put a login in the jar by then.
  const noLogin = () => {
    if (op.slots.some(holdsRef) || op.learnedLoggedIn) return false;
    try {
      const s = loadSession(siteName);
      return !s.source && !loggedIn(s.cookies, site.loginCookies);
    } catch {
      return false;
    }
  };
  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3, log };
  const remembered = rememberedTier(siteName, op.name);
  // A remembered escalation is a speed hint, not a requirement: under a lower cap, start at the op's own tier.
  let tier = Math.max(op.minTier, remembered !== undefined && remembered <= ctx.maxTier ? remembered : 1) as Tier;
  // Why a call ran above tier 1, so a slow call explains itself.
  const notes: string[] = tier > op.minTier ? [`started at tier ${tier}: an earlier call escalated there`] : [];
  const noted = (a: Attempt) => success(a, notes.length ? { reason: notes.join("; ") } : {});
  // auth recovery steps taken this call: 1 re-import, 2 the profile's cookies, 3 a trigger run
  let authStep = 0;
  let examplesChecked = false;
  for (;;) {
    if (tier > ctx.maxTier) {
      return done({
        ok: false,
        class: "blocked",
        tier,
        reason: [...notes, `needs tier ${tier}, capped at ${ctx.maxTier}`].join("; "),
        next: `allow a higher tier (--max-tier ${tier})`,
        nextCall: { action: "raise_tier", tier },
      });
    }
    if (tier > 1 && !browserAvailable()) {
      return done({
        ok: false,
        class: "blocked",
        tier,
        reason: `tier ${tier} needs a Chromium browser (Google Chrome, Brave, Edge or Chromium)`,
        next: "install one, or set API_ANYTHING_BROWSER to its path, then retry once",
        nextCall: { action: "install_browser" },
      });
    }
    const a = await attempt(ctx, op, tier);
    if (a.note) notes.push(a.note);
    if (a.class === "ok") {
      // Only an escalation is remembered; a tier the spec itself asks for is not, so editing minTier takes effect.
      const keep = tier > op.minTier ? tier : undefined;
      if (remembered !== keep) rememberTier(siteName, op.name, keep);
      return done(noted(a));
    }
    const reason = a.note ? `${a.reason}; ${a.note}` : a.reason;
    const fail = (): CallResult =>
      done({ ok: false, class: a.class, tier, reason, next: nextFor(a.class, siteName, op, a), ...stepOf(a) });
    if (write && !notRun(a)) return fail();
    // A bare 403 is a wall or a refusal of this one entity (a private profile): if the example args
    // answer through the same tier, the args are the problem, and a browser run would not help.
    if (a.class === "blocked" && a.missing && !write && !examplesChecked) {
      examplesChecked = true;
      const examples = exampleArgs(op);
      if (
        examples &&
        !sameArgs(examples, args, op) &&
        (await attempt({ ...ctx, args: examples }, op, tier)).class === "ok"
      ) {
        return done({
          ok: false,
          class: "input",
          tier,
          reason: `refused for these args (${a.reason}); the example args still return data, so the operation works`,
          next: `check the args (a private, restricted or missing entity is refused this way) against: api-anything ops ${siteName}; do not heal or re-add`,
        });
      }
    }
    if (a.class === "blocked" && tier < (write ? 2 : 3)) {
      notes.push(`tier ${tier} was blocked (${a.reason})`);
      tier++;
      continue;
    }
    // Each step once per call, at any tier; a retry that still says auth goes on to the next step (a
    // changed analytics cookie is a changed request, not a renewed token). A write gets here only
    // when it certainly did not run.
    if (a.class === "auth" && authStep < 3) {
      // An imported session is a mirror of the everyday browser: silently re-import from the same
      // profile once (browserless), in case the human re-signed in there. It lands in the jar and
      // in the Chrome profile tiers 2 and 3 send from. Then retry.
      if (authStep < 1) {
        authStep = 1;
        if (await reimportIfBrowser(siteName, op.request.url, site.loginCookies)) continue;
      }
      // tier 3 ran the site's own page: the profile's cookies and session values are what it just used
      if (tier === 3 || ctx.maxTier <= 1) return fail();
      if (authStep < 2) {
        authStep = 2;
        if (await refreshCookies(ctx, op, tier)) continue;
      }
      authStep = 3;
      // Session values (a bearer, a guest token) come from the site's own requests: a trigger run
      // refreshes them, and for a read its answer is this call's answer.
      if (
        op.readOnly &&
        ctx.maxTier >= 3 &&
        browserAvailable() &&
        op.slots.some((s) => s.ref?.startsWith("session:"))
      ) {
        const b = await attempt(ctx, op, 3);
        if (b.class === "ok") {
          const why = [...notes, `tier ${tier} said ${a.class} (${a.reason})`].join("; ");
          return done(success(b, { reason: `${why}; refreshed the session through the site's own request` }));
        }
        // The run answered other args (a trigger fixed to one page), but it refreshed the session values: retry once.
        continue;
      }
      // A write's page-issued token (a CSRF field, fb_dtsg) went stale, and a login renews only cookies:
      // run the trigger as learning does, the write intercepted and never sent, to refresh it; retry once.
      if (
        !op.readOnly &&
        ctx.maxTier >= 3 &&
        browserAvailable() &&
        op.slots.some((s) => s.ref?.startsWith("session:"))
      ) {
        try {
          await runOpTrigger(siteName, op, args, { intercept: true });
          continue;
        } catch {
          // no browser run: the call keeps its auth answer
        }
      }
    }
    if (a.class === "drift") return done(await onDrift(ctx, site, op, a));
    // Recovery is spent, plain HTTP still says auth, and the site has no login on record that could
    // have run out: a wall that answers 419 or 401 to what is not a browser looks the same. One tier-2
    // attempt tells them apart, for a read only: a page can send a request more than once (its own
    // scripts, a retry after a navigation or a reset), and a write is sent once. When the attempt does
    // not get the data, the call ends with tier 1's answer.
    if (a.class === "auth" && tier === 1 && !write && ctx.maxTier >= 2 && browserAvailable() && noLogin()) {
      const b = await attempt(ctx, op, 2);
      if (b.class === "ok") {
        rememberTier(siteName, op.name, 2);
        const why = `tier 1 said auth with no login on record for this site (${a.reason}); a real page got the answer`;
        return done(success(b, { reason: why }));
      }
    }
    // A credential marked public (a web app's shared bearer) answers auth when the site rotated it,
    // which no login fixes: re-learn it from the page, as for drift.
    if (a.class === "auth" && op.readOnly && op.public?.length && noLogin())
      return done(await onDrift(ctx, site, op, { ...a, class: "drift" }));
    return fail();
  }
}

/** Forced heal for `api-anything heal`: ignores the stale guard. Reads only; a write's check would perform it. */
export async function heal(
  siteName: string,
  opName: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<CallResult & { strategy?: string }> {
  const t0 = Date.now();
  const log: Attempt[] = [];
  let resolved: Operation | undefined;
  const done = (r: Result, extra: { strategy?: string } = {}): CallResult & { strategy?: string } => {
    const f = finish(r, resolved, resolved ? siteName : undefined, log);
    const sessions = [resolved ? sessionOrNone(siteName) : undefined];
    if (f.reason) f.reason = hide(f.reason, sessions, true);
    if (f.next) f.next = hide(f.next, sessions);
    return { ...f, ...extra, ms: Date.now() - t0 };
  };
  const found = resolve(siteName, opName);
  if ("ok" in found) return done(found);
  const { site, op, theirs } = found;
  resolved = op;
  siteName = site.name;
  if (theirs) dropUnbound(siteName);
  if (!op.readOnly) {
    return done({
      ok: false,
      class: "refused",
      reason: "healing a write is validated by performing it",
      next: `writes heal during a real call: api-anything call ${siteName} ${opName} ... --allow-writes`,
      nextCall: { action: "report" },
      retry: "no",
    });
  }
  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3, log };
  const tier = Math.min(Math.max(op.minTier, rememberedTier(siteName, op.name) ?? 1), 2) as Tier;
  const h = await safeHeal(
    healOperation(siteName, op, args, {
      validate: (c) => attempt(ctx, c, tier),
      fetchImpl: opts.fetchImpl,
      loginCookies: site.loginCookies,
      browser: ctx.maxTier > 1,
    }),
  );
  if (h.outcome === "healed") return done(success(h.attempt, { healed: true }), { strategy: h.strategy });
  if (h.outcome === "identical") {
    // The same template is no proof it works: its answer says whether the op does.
    const filled = withDefaults(op, args);
    const complete = op.params.every((p) => !p.required || filled[p.name] !== undefined);
    const b = await attempt({ ...ctx, args: complete ? filled : (exampleArgs(op) ?? filled) }, op, tier);
    const why = "the stored template is already current";
    if (b.class === "ok") return done(success(b, { healed: false, reason: why }));
    const recipe = b.class === "drift";
    return done({
      ok: false,
      class: b.class,
      tier: b.tier,
      reason: `${why}, and it answers: ${b.reason}`,
      next: recipe
        ? `if the site works in a browser, re-learn the response recipe: api-anything add ${siteName} ${op.name} ... --extract <path> (api-anything capture <trigger url> shows the response); otherwise report it`
        : nextFor(b.class, siteName, op, b),
      ...stepOf(b),
      ...(recipe ? { nextCall: { action: "relearn" } } : {}),
    });
  }
  const b = h.attempt ?? h.fallback;
  return done({
    ok: false,
    class: b?.class ?? "drift",
    tier: b?.tier,
    reason: h.reason,
    next: nextFor(b?.class ?? "drift", siteName, op, b),
    ...(b ? stepOf(b) : {}),
    // this was the heal: what is left is learning it again
    ...((b?.class ?? "drift") === "drift" ? { nextCall: { action: "relearn" } } : {}),
  });
}
