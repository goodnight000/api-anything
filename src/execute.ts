/**
 * call(): the execution ladder (DESIGN.md "Execution ladder"), the classifier-driven actions,
 * the heal-loop guards, and the write rules. Always sends the stored template first; healing is
 * reactive only.
 */
import { chromeAvailable, type PageFetchResult, ProfileInUse, pageFetch, profileCookies } from "./browser.js";
import { type Class, judge } from "./classify.js";
import { capOutput } from "./extract.js";
import {
  type Attempt,
  type HealResult,
  healOperation,
  judgeExchange,
  PROFILE_HINT,
  profileDir,
  runOpTrigger,
} from "./heal.js";
import { buildRequest, type Sent, send, withDefaults } from "./http.js";
import { reimportIfBrowser } from "./login.js";
import { loadSession, loggedIn, mergeCapture, type Session, saveSession, sessionFile, withLock } from "./session.js";
import type { Operation, Site } from "./spec.js";
import { lastHealAt, loadSite, markStale, rememberedTier, rememberTier, staleMark } from "./store.js";
import type { StoredCookie } from "./types.js";

export type Tier = 1 | 2 | 3;

export interface CallOptions {
  /** required for any readOnly:false op, at every entry point */
  allowWrites?: boolean;
  fetchImpl?: typeof fetch;
  /** highest transport tier to use (default 3); 1 also means no browser at all, so no recapture or cookie refresh */
  maxTier?: Tier;
  /** per-site gap between tier-1 requests (default 1000) */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export interface CallResult {
  ok: boolean;
  class: Class | "refused";
  /** extracted, picked, capped */
  data?: unknown;
  truncated?: string;
  tier?: Tier;
  healed?: boolean;
  ms: number;
  reason?: string;
  /** what to do about a failure; follow it at most once */
  next?: string;
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
}

function nextFor(c: CallResult["class"], site: string, op: Operation, a?: Attempt): string | undefined {
  if (c === "ok") return undefined;
  if (c === "refused")
    return "only if the user asked for this write: rerun with --allow-writes (MCP: start the server with --allow-writes)";
  if (a?.hint) return a.hint;
  // A write the server may have run: never invite a second send.
  const ran = !op.readOnly && a !== undefined && !notRun(a);
  if (ran && c !== "drift" && c !== "auth") return "the write may have gone through: check the site before any retry";
  switch (c) {
    case "auth":
      return `ask the user to run: api-anything login ${site}; then ${ran ? "check the site, and retry only if the write is not there" : "retry once"}`;
    case "rate":
      return /retry after/.test(a?.reason ?? "")
        ? "rate limited: do not retry before the time in reason"
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
  op.params.every((p) => String(a[p.name] ?? p.default ?? "") === String(b[p.name] ?? p.default ?? ""));

/** Never throws: a browser that fails to launch or a page that fails to load is a failed heal. */
const safeHeal = (p: Promise<HealResult>): Promise<HealResult> =>
  p.catch((e: Error) => ({ outcome: "failed" as const, reason: `heal crashed: ${e.message.split("\n")[0]}` }));

async function attempt(ctx: Ctx, op: Operation, tier: Tier): Promise<Attempt> {
  try {
    if (tier === 3) {
      // For a write this is the UI sending it: the one attempt.
      const run = await runOpTrigger(ctx.site, op, ctx.args);
      const judged = run.matched && judgeExchange(op, run.matched);
      if (judged) return judged;
      if (run.loginWall)
        return { tier, class: "auth", reason: `the trigger landed on a sign-in page (${run.loginWall})` };
      return { tier, class: "drift", reason: `the trigger fired no request matching ${JSON.stringify(op.match)}` };
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
      });
    }
    return { tier, status: r.status, ...(r.redirected ? { redirected: true } : {}), ...judge(op, r) };
  } catch (e) {
    // nothing was sent when the browser could not start
    if (e instanceof ProfileInUse) return { tier, class: "error", reason: e.message, hint: PROFILE_HINT };
    return { tier, class: "error", reason: (e as Error).message.split("\n")[0]!, ambiguous: true };
  }
}

/**
 * Replace the jar with the profile's cookies. True when that changes the request this tier sends:
 * a tier-2 page sends the profile's own cookies, so there the jar only fills `cookie:` refs.
 */
async function refreshCookies(ctx: Ctx, op: Operation, tier: Tier): Promise<boolean> {
  if (!chromeAvailable()) return false;
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
    ...extra,
  });

  // An op learned signed in, called with no login cookie: the site hides the data from guests; it did not move.
  if (a.missing && op.learnedLoggedIn && !loggedIn(loadSession(ctx.site).cookies, site.loginCookies)) {
    return fail(
      { ...a, class: "auth" },
      { reason: `${a.reason}; the op was learned signed in and the session has no login cookie` },
    );
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
      // throttled or challenged while checking: stop, don't spend a heal (a browser run) against it
      if (b.class === "rate" || b.class === "blocked" || b.class === "auth") return fail(b);
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
    if (op.readOnly && a.tier < 3 && ctx.maxTier >= 3 && stale?.tier3 !== false && chromeAvailable()) {
      const b = await attempt(ctx, op, 3);
      if (b.class === "ok") return success(b, { reason: guard });
      // the site's own request doesn't answer either: stop paying a browser run per call
      if (!b.hint && b.class !== "auth")
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

function resolve(siteName: string, opName: string): { site: Site; op: Operation } | Result {
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
    };
  }
  if (!r)
    return {
      ok: false,
      class: "input",
      reason: `no site "${siteName}"`,
      next: "api-anything sites lists what exists; api-anything add creates one",
    };
  const op = r.site.operations.find((o) => o.name === opName);
  if (!op)
    return {
      ok: false,
      class: "input",
      reason: `no operation "${opName}" on ${r.site.name}`,
      next: `api-anything ops ${r.site.name}`,
    };
  return { site: r.site, op };
}

/** Call one operation. Never throws for site-side failures; the result carries class, reason and next. */
export async function call(
  siteName: string,
  opName: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<CallResult> {
  const t0 = Date.now();
  const done = (r: Result): CallResult => ({ ...r, ms: Date.now() - t0 });
  const found = resolve(siteName, opName);
  if ("ok" in found) return done(found);
  const { site, op } = found;
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
    session = loadSession(siteName);
  } catch (e) {
    return done({
      ok: false,
      class: "error",
      reason: (e as Error).message,
      next: `delete ${sessionFile(siteName)}, then ask the user to run api-anything login ${siteName} if the site needs an account`,
    });
  }
  try {
    buildRequest(op, args, session);
  } catch (e) {
    return done({ ok: false, class: "input", reason: (e as Error).message, next: nextFor("input", siteName, op) });
  }

  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3 };
  const remembered = rememberedTier(siteName, op.name);
  // A remembered escalation is a speed hint, not a requirement: under a lower cap, start at the op's own tier.
  let tier = Math.max(op.minTier, remembered !== undefined && remembered <= ctx.maxTier ? remembered : 1) as Tier;
  // Why a call ran above tier 1, so a slow call explains itself.
  const notes: string[] = tier > op.minTier ? [`started at tier ${tier}: an earlier call escalated there`] : [];
  const noted = (a: Attempt) => success(a, notes.length ? { reason: notes.join("; ") } : {});
  let authTried = false;
  let examplesChecked = false;
  for (;;) {
    if (tier > ctx.maxTier) {
      return done({
        ok: false,
        class: "blocked",
        tier,
        reason: `needs tier ${tier}, capped at ${ctx.maxTier}`,
        next: `allow a higher tier (--max-tier ${tier})`,
      });
    }
    if (tier > 1 && !chromeAvailable()) {
      return done({
        ok: false,
        class: "blocked",
        tier,
        reason: `tier ${tier} needs Google Chrome`,
        next: "install Google Chrome, then retry once",
      });
    }
    const a = await attempt(ctx, op, tier);
    if (a.class === "ok") {
      // Only an escalation is remembered; a tier the spec itself asks for is not, so editing minTier takes effect.
      const keep = tier > op.minTier ? tier : undefined;
      if (remembered !== keep) rememberTier(siteName, op.name, keep);
      return done(noted(a));
    }
    const fail = (): CallResult =>
      done({ ok: false, class: a.class, tier, reason: a.reason, next: nextFor(a.class, siteName, op, a) });
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
    // Once per call, at any tier. A write gets here only when it certainly did not run.
    if (a.class === "auth" && !authTried) {
      authTried = true;
      // An imported session is a mirror of the everyday browser: silently re-import from the same
      // profile once (browserless), in case the human re-signed in there. It lands in the jar and
      // in the Chrome profile tiers 2 and 3 send from. Then retry.
      if (await reimportIfBrowser(siteName, op.request.url, site.loginCookies)) continue;
      // tier 3 ran the site's own page: the profile's cookies and session values are what it just used
      if (tier === 3 || ctx.maxTier <= 1) return fail();
      if (await refreshCookies(ctx, op, tier)) continue;
      // Session values (a bearer, a guest token) come from the site's own requests: a trigger run
      // refreshes them, and for a read its answer is this call's answer.
      if (op.readOnly && ctx.maxTier >= 3 && chromeAvailable() && op.slots.some((s) => s.ref?.startsWith("session:"))) {
        const b = await attempt(ctx, op, 3);
        if (b.class === "ok") {
          const why = [...notes, `tier ${tier} said ${a.class} (${a.reason})`].join("; ");
          return done(success(b, { reason: `${why}; refreshed the session through the site's own request` }));
        }
        // The run answered other args (a trigger fixed to one page), but it refreshed the session values: retry once.
        continue;
      }
    }
    if (a.class === "drift") return done(await onDrift(ctx, site, op, a));
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
  const found = resolve(siteName, opName);
  if ("ok" in found) return { ...found, ms: Date.now() - t0 };
  const { site, op } = found;
  siteName = site.name;
  if (!op.readOnly) {
    return {
      ok: false,
      class: "refused",
      reason: "healing a write is validated by performing it",
      next: `writes heal during a real call: api-anything call ${siteName} ${opName} ... --allow-writes`,
      ms: Date.now() - t0,
    };
  }
  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3 };
  const tier = Math.min(Math.max(op.minTier, rememberedTier(siteName, op.name) ?? 1), 2) as Tier;
  const h = await safeHeal(
    healOperation(siteName, op, args, {
      validate: (c) => attempt(ctx, c, tier),
      fetchImpl: opts.fetchImpl,
      loginCookies: site.loginCookies,
      browser: ctx.maxTier > 1,
    }),
  );
  const ms = Date.now() - t0;
  if (h.outcome === "healed") return { ...success(h.attempt, { healed: true }), strategy: h.strategy, ms };
  if (h.outcome === "identical")
    return { ok: true, class: "ok", healed: false, reason: "the stored template is already current", ms };
  const b = h.attempt ?? h.fallback;
  return {
    ok: false,
    class: b?.class ?? "drift",
    tier: b?.tier,
    reason: h.reason,
    next: nextFor(b?.class ?? "drift", siteName, op, b),
    ms,
  };
}
