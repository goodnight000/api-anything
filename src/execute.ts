/**
 * call(): the execution ladder (DESIGN.md "Execution ladder"), the classifier-driven actions,
 * the heal-loop guards, and the write rules. Always sends the stored template first; healing is
 * reactive only.
 */
import { chromeAvailable, pageFetch, profileCookies } from "./browser.js";
import { judge, type Class } from "./classify.js";
import { capOutput } from "./extract.js";
import { healOperation, judgeExchange, profileDir, runOpTrigger, type Attempt } from "./heal.js";
import { buildRequest, send } from "./http.js";
import { cookieHeaderFor, loadSession, saveSession } from "./session.js";
import type { Operation, Site } from "./spec.js";
import { lastHealAt, loadSite, markStale, rememberTier, rememberedTier, staleMark } from "./store.js";

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

interface Ctx {
  site: string;
  args: Record<string, unknown>;
  opts: CallOptions;
  maxTier: Tier;
}

function nextFor(c: CallResult["class"], site: string, op: Operation, a?: Attempt): string | undefined {
  switch (c) {
    case "ok":
      return undefined;
    case "auth":
      return `ask the user to run: site2api login ${site}; then retry once`;
    case "rate":
      return "rate limited: do not retry now; wait a few minutes";
    case "blocked":
      return `the site is challenging automated requests: ask the user to run site2api login ${site} and clear the challenge, then retry once`;
    case "drift":
      if (!op.readOnly) {
        const ran = a?.status === undefined || !NOT_EXECUTED.has(a.status) ? "the write may have run: check the site first, then " : "";
        return `${ran}re-learn it with site2api add ${site} ${op.name} ... --write`;
      }
      return `site2api heal ${site} ${op.name}; if that fails, re-learn it with site2api add ${site} ${op.name} ...`;
    case "input":
      return `check the args against: site2api ops ${site}`;
    case "refused":
      return "only if the user asked for this write: rerun with --allow-writes (MCP: start the server with --allow-writes)";
    default:
      return !op.readOnly && (a?.ambiguous || (a?.status ?? 0) >= 500)
        ? "the write may have gone through: check the site before any retry"
        : "retry once; if it fails the same way, stop and report the reason";
  }
}

const success = (a: Attempt, extra: Partial<Result> = {}): Result => ({ ok: true, class: "ok", tier: a.tier, ...capOutput(a.data), ...extra });

async function attempt(ctx: Ctx, op: Operation, tier: Tier): Promise<Attempt> {
  try {
    if (tier === 3) {
      // For a write this is the UI sending it: the one attempt.
      const run = await runOpTrigger(ctx.site, op, ctx.args);
      const judged = run.matched && judgeExchange(op, run.matched);
      return judged ?? { tier, class: "drift", reason: `the trigger fired no request matching ${JSON.stringify(op.match)}` };
    }
    const session = loadSession(ctx.site);
    let r;
    if (tier === 1) {
      r = await send(op, ctx.args, session, {
        site: ctx.site,
        fetchImpl: ctx.opts.fetchImpl,
        timeoutMs: ctx.opts.timeoutMs,
        minIntervalMs: ctx.opts.minIntervalMs,
      });
    } else {
      const req = buildRequest(op, ctx.args, session);
      const { cookie: _jar, ...headers } = req.headers; // the page sends the profile's own cookies
      r = await pageFetch({ origin: new URL(req.url).origin, url: req.url, method: req.method, headers, body: req.body, profileDir: profileDir() });
    }
    return { tier, status: r.status, ...judge(op, r) };
  } catch (e) {
    return { tier, class: "error", reason: (e as Error).message, ambiguous: true };
  }
}

/** Replace the jar with the profile's cookies. True when that changes what op's request would carry. */
async function refreshCookies(site: string, op: Operation): Promise<boolean> {
  if (!chromeAvailable()) return false;
  const s = loadSession(site);
  let fresh;
  try {
    fresh = await profileCookies({ url: op.request.url, profileDir: profileDir() });
  } catch {
    return false;
  }
  const before = cookieHeaderFor(s.cookies, op.request.url);
  saveSession(site, { ...s, cookies: fresh });
  return cookieHeaderFor(fresh, op.request.url) !== before;
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
    if (op.readOnly && a.tier < 3 && ctx.maxTier >= 3 && chromeAvailable()) {
      const b = await attempt(ctx, op, 3);
      if (b.class === "ok") return success(b, { reason: guard });
    }
    return fail(a, { reason: `${a.reason}; ${guard}`, next: `wait for the stale mark to expire, or force it: site2api heal ${ctx.site} ${op.name}` });
  }

  const h = await healOperation(ctx.site, op, ctx.args, {
    validate: (candidate) => attempt(ctx, candidate, a.tier),
    fetchImpl: ctx.opts.fetchImpl,
    loginCookies: site.loginCookies,
    browser: ctx.maxTier > 1,
  });
  if (h.outcome === "healed") return success(h.attempt, { healed: true });
  // The template can't be replayed, but the site's own request answered: that is the tier-3 read.
  if (h.fallback?.class === "ok" && ctx.maxTier >= 3) return success(h.fallback, { reason: `heal failed (${h.reason}); answered by the site's own request` });
  if (h.outcome === "identical") {
    return fail(
      { ...a, class: "input" },
      {
        reason: `not drift: re-learning gave a byte-identical template (${a.reason})`,
        next: `check the args against site2api ops ${ctx.site}; if the site needs an account, ask the user to run site2api login ${ctx.site}`,
      },
    );
  }
  const b = h.attempt ?? h.fallback ?? a;
  return fail(b, { reason: `${b.reason}; heal failed: ${h.reason}` });
}

function resolve(siteName: string, opName: string): { site: Site; op: Operation } | Result {
  const r = loadSite(siteName);
  if (!r) return { ok: false, class: "input", reason: `no site "${siteName}"`, next: "site2api sites lists what exists; site2api add creates one" };
  const op = r.site.operations.find((o) => o.name === opName);
  if (!op) return { ok: false, class: "input", reason: `no operation "${opName}" on ${siteName}`, next: `site2api ops ${siteName}` };
  return { site: r.site, op };
}

/** Call one operation. Never throws for site-side failures; the result carries class, reason and next. */
export async function call(siteName: string, opName: string, args: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<CallResult> {
  const t0 = Date.now();
  const done = (r: Result): CallResult => ({ ...r, ms: Date.now() - t0 });
  const found = resolve(siteName, opName);
  if ("ok" in found) return done(found);
  const { site, op } = found;
  const write = !op.readOnly;
  if (write && !opts.allowWrites) {
    return done({ ok: false, class: "refused", reason: `${op.name} is a write and writes are not allowed`, next: nextFor("refused", siteName, op) });
  }
  try {
    buildRequest(op, args, loadSession(siteName));
  } catch (e) {
    return done({ ok: false, class: "input", reason: (e as Error).message, next: nextFor("input", siteName, op) });
  }

  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3 };
  const remembered = rememberedTier(siteName, op.name);
  let tier = Math.max(op.minTier, remembered ?? 1) as Tier;
  let authTried = false;
  for (;;) {
    if (tier > ctx.maxTier) {
      return done({ ok: false, class: "blocked", tier, reason: `needs tier ${tier}, capped at ${ctx.maxTier}`, next: `allow a higher tier (--max-tier ${tier})` });
    }
    if (tier > 1 && !chromeAvailable()) {
      return done({ ok: false, class: "blocked", tier, reason: `tier ${tier} needs Google Chrome`, next: "install Google Chrome, then retry once" });
    }
    const a = await attempt(ctx, op, tier);
    if (a.class === "ok") {
      if (remembered !== tier) rememberTier(siteName, op.name, tier);
      return done(success(a));
    }
    const fail = (): CallResult => done({ ok: false, class: a.class, tier, reason: a.reason, next: nextFor(a.class, siteName, op, a) });
    if (write && !(a.status !== undefined && NOT_EXECUTED.has(a.status))) return fail();
    if (a.class === "blocked" && tier < (write ? 2 : 3)) {
      tier++;
      continue;
    }
    if (a.class === "auth" && tier === 1 && !authTried && ctx.maxTier > 1) {
      authTried = true;
      if (await refreshCookies(siteName, op)) continue;
    }
    if (a.class === "drift") return done(await onDrift(ctx, site, op, a));
    return fail();
  }
}

/** Forced heal for `site2api heal`: ignores the stale guard. Reads only; a write's check would perform it. */
export async function heal(siteName: string, opName: string, args: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<CallResult & { strategy?: string }> {
  const t0 = Date.now();
  const found = resolve(siteName, opName);
  if ("ok" in found) return { ...found, ms: Date.now() - t0 };
  const { site, op } = found;
  if (!op.readOnly) {
    return {
      ok: false,
      class: "refused",
      reason: "healing a write is validated by performing it",
      next: `writes heal during a real call: site2api call ${siteName} ${opName} ... --allow-writes`,
      ms: Date.now() - t0,
    };
  }
  const ctx: Ctx = { site: siteName, args, opts, maxTier: opts.maxTier ?? 3 };
  const tier = Math.min(Math.max(op.minTier, rememberedTier(siteName, op.name) ?? 1), 2) as Tier;
  const h = await healOperation(siteName, op, args, {
    validate: (c) => attempt(ctx, c, tier),
    fetchImpl: opts.fetchImpl,
    loginCookies: site.loginCookies,
    browser: ctx.maxTier > 1,
  });
  const ms = Date.now() - t0;
  if (h.outcome === "healed") return { ...success(h.attempt, { healed: true }), strategy: h.strategy, ms };
  if (h.outcome === "identical") return { ok: true, class: "ok", healed: false, reason: "the stored template is already current", ms };
  const b = h.attempt ?? h.fallback;
  return { ok: false, class: b?.class ?? "drift", tier: b?.tier, reason: h.reason, next: nextFor(b?.class ?? "drift", siteName, op, b), ms };
}
