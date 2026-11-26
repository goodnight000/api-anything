/**
 * Sharing what this install learned or healed with the registry (docs/REGISTRY.md): publish.ts builds
 * and checks each upload, this sends the ones the rules allow, signed, and records the version.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { limited, PaceConfigError, sitePace } from "./budget.js";
import { proofOf } from "./checks.js";
import { cleanCall } from "./clean.js";
import { siteOf } from "./domain.js";
import { publicAddress } from "./http.js";
import { loadSettings, localOnly, localOnlyOff } from "./identity.js";
import { accountMaybe, hostsOfOp, isPublic, type OpPlan, personal, plan, spelled, uploadName } from "./publish.js";
import { registryRequest } from "./registry.js";
import {
  anonymous,
  type Claim,
  type ClaimResult,
  type Evidence,
  fingerprintText,
  nameHashText,
  type Status,
  type UploadResult,
  type VersionUpload,
} from "./registry-api.js";
import { flushReports } from "./report.js";
import { type Held, heldForReview, unreplayable } from "./review.js";
import { home, loadSession, readJson, withLock, writePrivate } from "./session.js";
import type { Operation, Site } from "./spec.js";
import { budgetCheck, coolDown, cooling, exportSite, loadSite, RATE_COOL_MS, updateSite } from "./store.js";

/** The purpose of the check learn_site records from its holdout call: the one kind an automatic share may carry. */
export const HOLDOUT_PURPOSE = "learn_site holdout";

export interface ShareOutcome {
  site: string;
  op: string;
  /** uploaded (or already there, counted as a confirmation) */
  shared: boolean;
  /** the name it goes up under in the registry, when that is not `site` (publish.ts `registryName`) */
  as?: string;
  status?: Status;
  hash?: string;
  /** why it was not shared: sharing off in settings, a login or write op without consent, refused */
  reason?: string;
  /** a login or write op: shared only with the user's explicit yes (`consent: true`) */
  needsConsent?: boolean;
  /** what in the upload may be the user's own (an email, an account id), for the caller to show them */
  personal?: string[];
  /** with `strict`: what `--strict-scan` reports of the upload (publish.ts `OpPlan`), for the caller to show them */
  borderline?: string[];
  /** the clean replay this share ran, nothing on record having proved one (`replayClean`) */
  cleanReplay?: Evidence["cleanReplay"];
  /** what that replay met, or why it did not run */
  cleanReason?: string;
  /** status review: each reason the registry gave, with its category and in words (review.ts) */
  held?: Held[];
  /** the step to take, when there is one */
  next?: string;
}

/** Why a public op stays here: the user never answered the question, or said no. */
const offReason = () =>
  loadSettings().askedAt
    ? "sharing is off: the user said no (api-anything setup --yes --share-only turns it on)"
    : "sharing was never asked: the user has not answered whether to share (api-anything setup --yes --share-only, or --no-share --share-only, records it)";

/**
 * The cookie names a signed-out visit of the site is given now (login.ts's probe: one GET of the site's
 * address with no cookies), asked only where they decide whether `ops` are public: no login is on
 * record, an op could be public, and the session holds a cookie of the site whose name alone could
 * carry an account. A framework's session cookie and a load balancer's are every visitor's, and no
 * list knows their names. The site of an op an agent learned or someone shared is asked only at a
 * public address, as its clean replay is.
 */
async function visitorNames(site: string, ops: string[], fetchImpl?: typeof fetch): Promise<string[]> {
  const r = loadSite(site);
  const session = loadSession(site);
  const mine = r?.site.operations.filter((op) => ops.includes(op.name)) ?? [];
  const open = mine.some((op) => op.readOnly && !op.learnedLoggedIn && !op.public?.length);
  if (!r || !open || session.source || !accountMaybe(r.site, session).length) return [];
  const { guestCookieNames } = await import("./login.js");
  const guarded = !!r.site.shared || mine.some((op) => op.publicOnly);
  return (await guestCookieNames(r.site.baseUrl, fetchImpl, guarded ? publicAddress : undefined)) ?? [];
}

/**
 * Uploads each named op of a local site. A public read (learned logged out, in a session that shows no
 * account, clean replay ok, its hosts on its own site) goes automatically when settings allow sharing;
 * anything else only with `consent`.
 * One that holds what may be the user's own waits for their yes too. `parent`: the version it replaces.
 * `guest`: the names a signed-out visit is given, when the caller asked already (`visitorNames`, through
 * `fetchImpl` otherwise). `strict`: each outcome carries its op's `borderline`.
 * An op about to go up with no clean replay on record (the caller's evidence, or what a learn_site proved
 * of this version) gets one first (`replayClean`), so an op made with `add` is not held for review for
 * want of it. Nothing is sent to the site for an op that would not go up anyway.
 */
export async function shareOps(
  site: string,
  ops: string[],
  o: {
    evidence: Partial<Evidence>;
    consent?: boolean;
    parent?: string;
    signal?: AbortSignal;
    guest?: string[];
    fetchImpl?: typeof fetch;
    strict?: boolean;
    /** the clean replay's pacing (http.ts `pace`); tests pass 0 */
    minIntervalMs?: number;
  } = { evidence: {} },
): Promise<ShareOutcome[]> {
  // plan reads no names as all of them
  if (!ops.length) return [];
  if (localOnly())
    return ops.map((op) => ({
      site,
      op,
      shared: false,
      reason: `this install is local-only: nothing is sent to the shared catalog (${localOnlyOff()})`,
    }));
  let p: ReturnType<typeof plan>;
  let planned: Parameters<typeof plan>[1];
  try {
    // the registry is asked for the site's name only when something may go up
    const as = o.consent || loadSettings().share ? await uploadName(site, { signal: o.signal }) : undefined;
    // with the user's yes, public or not decides nothing
    const guest = o.guest ?? (o.consent ? [] : await visitorNames(site, ops, o.fetchImpl));
    planned = {
      ops,
      evidence: o.evidence,
      parent: o.parent,
      consent: o.consent,
      guest,
      strict: o.strict,
      ...(as ? { as } : {}),
    };
    p = plan(site, planned);
  } catch (e) {
    return ops.map((op) => ({ site, op, shared: false, reason: (e as Error).message.split("\n")[0] }));
  }
  const share = loadSettings().share;
  const spec = loadSite(p.site)!.site;
  const session = loadSession(p.site);
  const out: ShareOutcome[] = [];
  for (let op of p.ops) {
    const base = {
      site: p.site,
      op: op.op,
      ...(p.as ? { as: p.as } : {}),
      ...(op.personal.length ? { personal: op.personal } : {}),
      ...(op.borderline.length ? { borderline: op.borderline } : {}),
    };
    if (op.errors.length) {
      out.push({ ...base, shared: false, reason: `refused: ${op.errors.join("; ")}` });
      continue;
    }
    // The holdout check learn_site records has args its agent chose as neither of the user's examples (the
    // user's own refuse the share there): it holds back only what needs consent anyway. A check the user
    // recorded (api-anything check), an email, an id, an IP or a literal typed into the page holds an
    // automatic share back.
    const checks = op.upload.operation.checks ?? [];
    const holding = op.personal.filter((x) => {
      const j = /\.checks\[(\d+)\] sends /.exec(x)?.[1];
      return j === undefined || checks[Number(j)]?.purpose !== HOLDOUT_PURPOSE;
    });
    const mine = spec.operations.find((x) => x.name === op.op)!;
    const proven = o.evidence.cleanReplay !== undefined || proofOf(p.site, mine)?.cleanReplay !== undefined;
    // with no replay on record, whether it would be public once one answers ok
    const could = proven
      ? op.public
      : isPublic(spec, mine, { ...op.upload.evidence, cleanReplay: "ok" }, session, planned.guest);
    if (!o.consent && !(could && share && !holding.length)) {
      // An op learned signed in may still go, without asking anyone: by its fingerprint now, and its
      // anonymous body only once installs on enough networks hold the same op (claim).
      const claimed = share ? await claim(p.site, op, o.signal) : undefined;
      if (claimed) {
        out.push({
          ...base,
          shared: false,
          needsConsent: true,
          reason: `learned signed in: only its fingerprint went to the registry (${claimed}); its body follows by itself once other installs hold the same op, or now with the user's yes`,
        });
        continue;
      }
      out.push({
        ...base,
        shared: false,
        ...(could && !holding.length
          ? { reason: offReason() }
          : {
              needsConsent: true,
              reason: could
                ? "it may hold something of the user's own (personal): shared only with their yes"
                : NEEDS_YES,
            }),
      });
      continue;
    }
    let replayed: Pick<ShareOutcome, "cleanReplay" | "cleanReason"> = {};
    if (!proven) {
      const r = await replayClean(p.site, spec, mine, o);
      if ("notNow" in r) {
        out.push({ ...base, shared: false, reason: r.notNow, next: r.next });
        continue;
      }
      replayed = r;
      if (r.cleanReplay !== "skipped") {
        try {
          op = plan(site, { ...planned, ops: [op.op], evidence: { ...o.evidence, cleanReplay: r.cleanReplay } })
            .ops[0]!;
        } catch (e) {
          out.push({ ...base, ...replayed, shared: false, reason: (e as Error).message.split("\n")[0] });
          continue;
        }
        if (op.errors.length) {
          out.push({ ...base, ...replayed, shared: false, reason: `refused: ${op.errors.join("; ")}` });
          continue;
        }
      }
      // the replay did not show it public: an automatic share waits for the user's yes
      if (!o.consent && !op.public) {
        out.push({ ...base, ...replayed, shared: false, needsConsent: true, reason: NEEDS_YES });
        continue;
      }
    }
    try {
      const r = await registryRequest<UploadResult>("/v1/versions", {
        method: "POST",
        body: op.upload,
        signed: true,
        cap: 64 * 1024,
        signal: o.signal,
      });
      const review =
        r.status === "review"
          ? heldForReview(r.reasons ?? [], { site: p.site, op: mine, cleanReason: replayed.cleanReason })
          : undefined;
      record(p.site, op.op, {
        hash: r.hash,
        status: r.status,
        ...(review ? { review: review.held.map((h) => h.category) } : {}),
      });
      out.push({
        ...base,
        ...replayed,
        shared: true,
        hash: r.hash,
        status: r.status,
        ...(review
          ? { reason: review.reason, held: review.held, next: review.next }
          : r.reasons?.length
            ? { reason: r.reasons.join("; ") }
            : {}),
      });
    } catch (e) {
      out.push({ ...base, ...replayed, shared: false, reason: (e as Error).message.split("\n")[0] });
    }
  }
  return out;
}

/**
 * What `publish`'s preview says of each op's clean replay: the one on record, why none can run, or that
 * `--yes` runs it. The preview itself sends nothing to the site.
 */
export function cleanReplayPreview(site: string, ops: string[]): Record<string, string> {
  const spec = loadSite(site)?.site;
  const out: Record<string, string> = {};
  for (const name of ops) {
    const op = spec?.operations.find((x) => x.name === name);
    if (!op) continue;
    const proof = proofOf(site, op)?.cleanReplay;
    const why = unreplayable(op);
    out[name] = proof ? `${proof} (on record)` : why ? `skipped: ${why}` : "will run on publish";
  }
  return out;
}

const NEEDS_YES =
  "it needed a login or was learned in a session that may be signed in, writes, sends off its site or uses a public credential: shared only with the user's yes";

type Replay =
  | { cleanReplay: Evidence["cleanReplay"]; cleanReason?: string }
  /** nothing was sent now (a cool-down, the site's budget, its rate limit): the op does not go up skipped */
  | { notNow: string; next: string };

/**
 * The clean replay of an op no proof on record covers, as learn_site runs it: plain HTTP with no
 * cookies and no session values, with its own examples (`unreplayable` says when it cannot be),
 * once, at the site's pace and inside its budget and cool-down. A site that says stop cools down as
 * after any call. An op learned over MCP or a pulled site's goes only to public addresses.
 */
async function replayClean(
  site: string,
  spec: Site,
  op: Operation,
  o: { fetchImpl?: typeof fetch; minIntervalMs?: number },
): Promise<Replay> {
  const why = unreplayable(op);
  if (why) return { cleanReplay: "skipped", cleanReason: why };
  const again = `run api-anything publish ${site} ${op.name} --yes again`;
  const notSent = "its clean replay was not sent";
  const held = cooling(site);
  if (held) {
    const until = new Date(held.until).toISOString();
    return {
      notNow: `${notSent}: ${site} is cooling down after ${held.class} until ${until}`,
      next: `${again} after ${until}`,
    };
  }
  let pace: ReturnType<typeof sitePace>;
  try {
    pace = sitePace(spec);
  } catch (e) {
    if (!(e instanceof PaceConfigError)) throw e;
    return { notNow: `${notSent}: ${e.message}`, next: `ask the user to fix API_ANYTHING_PACE, then ${again}` };
  }
  const budget = limited(pace) ? { site, pace } : undefined;
  const over = budget && budgetCheck(site, pace);
  if (over)
    return { notNow: `${notSent}: ${over.message}`, next: `${again} in ${Math.ceil(over.retryAfterMs / 1000)} s` };
  const r = await cleanCall(op, examplesOf(op)!, {
    site,
    fetchImpl: o.fetchImpl,
    minIntervalMs:
      pace.minIntervalMs !== undefined ? Math.max(o.minIntervalMs ?? 1000, pace.minIntervalMs) : o.minIntervalMs,
    publicOnly: !!op.publicOnly || !!spec.shared,
    budget,
  });
  if (r.class === "rate") {
    const ms = r.retryAfterMs ?? RATE_COOL_MS;
    if (!r.budget && ms > 0) coolDown(site, { class: "rate", reason: r.reason }, ms);
    return {
      notNow: r.budget ? `${notSent}: ${r.reason}` : `its clean replay answered rate: ${r.reason}`,
      next: `${again} in ${Math.ceil(ms / 1000)} s`,
    };
  }
  return r.class === "ok" || r.class === "blocked"
    ? { cleanReplay: r.class, ...(r.class === "blocked" ? { cleanReason: `blocked: ${r.reason}` } : {}) }
    : { cleanReplay: "failed", cleanReason: `${r.class}: ${r.reason}` };
}
/** The local op now is that registry version: its calls report on it. */
function record(site: string, op: string, version: NonNullable<Operation["version"]>): void {
  updateSite(site, (s) => ({
    ...s!,
    operations: s!.operations.map((x) => (x.name === op ? { ...x, version } : x)),
  }));
}

/** The op's stored example args, with defaults; undefined when a required param has none. */
function examplesOf(op: Operation): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = p.example ?? p.default;
    if (v !== undefined) out[p.name] = v;
    else if (p.required) return undefined;
  }
  return out;
}

/**
 * A call healed an op that was the registry version `parent`. When sharing is on and the healed op is
 * public, as a clean replay of its examples shows, it goes up as the version that repairs `parent`.
 * `args`: the healing call's own. The heal may have learned the request from a run made with them, and
 * the export puts `{param}` back only where learning made a slot: a template that spells one anywhere
 * else stays here, as learn_site keeps an op that spells the user's own request.
 */
export async function healBack(
  site: string,
  opName: string,
  parent: string,
  o: { fetchImpl?: typeof fetch; minIntervalMs?: number; signal?: AbortSignal; args?: Record<string, unknown> } = {},
): Promise<ShareOutcome | undefined> {
  if (!loadSettings().share) return undefined;
  const mine = loadSite(site)?.site;
  const op = mine?.operations.find((x) => x.name === opName);
  // nothing that could be public: no replay is spent on it
  if (!mine || !op || op.version || !op.readOnly || op.learnedLoggedIn || op.public?.length) return undefined;
  if (o.args) {
    // what the heal learned, as the upload would carry it; the param examples are the version's own
    const sent = exportSite(site).spec.operations.find((x) => x.name === opName)!;
    const kept = spelled({ request: sent.request, slots: sent.slots, volatile: sent.volatile }, o.args);
    if (kept.length)
      return {
        site,
        op: opName,
        shared: false,
        reason: `the healed request keeps the ${kept.join(", ")} of the call that healed it: sharing it would say what was asked`,
      };
  }
  const args = examplesOf(op);
  if (!args) return undefined;
  // The session's part of public, before the replay: nobody is here to ask, so an op that would wait
  // for a yes stays, and no request is spent on it.
  const session = loadSession(site);
  const guest = await visitorNames(site, [opName], o.fetchImpl);
  if (session.source || accountMaybe(mine, session, guest).length)
    return {
      site,
      op: opName,
      shared: false,
      needsConsent: true,
      reason:
        "the session may be signed in (a login on record, or a cookie no signed-out visit is given): the heal is shared only with the user's yes",
    };
  const clean = await cleanCall(op, args, {
    site,
    fetchImpl: o.fetchImpl,
    minIntervalMs: o.minIntervalMs,
    // an op an agent learned or someone shared: the page its heal learned from chose the request
    publicOnly: !!op.publicOnly || !!mine.shared,
  });
  if (clean.class !== "ok" && clean.class !== "blocked") return undefined;
  // the registry counts it as a heal only after this install's `fail` report on `parent`: send that first
  await flushReports(o.signal);
  const [shared] = await shareOps(site, [opName], {
    evidence: { cleanReplay: clean.class, healedFrom: parent },
    parent,
    signal: o.signal,
    guest,
  });
  return shared;
}

/* --------------------------------------------------- ops learned signed in */

const claimsFile = () => join(home(), "claims.json");
/** each claimed fingerprint: the local site and op, and the name the site went up under (`as`) */
type Claimed = Record<string, { site: string; op: string; as?: string }>;

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** The upload of an op answering a claim: its anonymous form, and the site by its name and address alone. */
function claimUpload(op: OpPlan): VersionUpload {
  const { name, domain, baseUrl, loginCookies, pace } = op.upload.site;
  const { clientVersion, tier, holdout } = op.upload.evidence;
  return {
    site: { name, domain, baseUrl, ...(loginCookies ? { loginCookies } : {}), ...(pace ? { pace } : {}) },
    operation: anonymous(op.upload.operation),
    // Field by field, never a spread: the holdout's args are the args of the check `anonymous` took out,
    // the learner's own. The registry's schema asks for the record, so it goes empty.
    evidence: {
      clientVersion,
      learnedLoggedIn: true,
      cleanReplay: "skipped",
      ...(holdout ? { holdout: { args: {}, ok: holdout.ok, ...(holdout.tier ? { tier: holdout.tier } : {}) } } : {}),
      ...(tier ? { tier } : {}),
    },
  };
}

/**
 * Claims an op learned signed in by its fingerprint, when it could ever go up that way: a read on its own
 * site, refused by no rule, with nothing of the user's own in its anonymous form (that would make it
 * this person's alone, so it would never match another install's anyway). Answers the fingerprint's
 * start, or undefined when it is not claimed. Any claim the registry already wants is answered now.
 */
async function claim(site: string, op: OpPlan, signal?: AbortSignal): Promise<string | undefined> {
  const mine = loadSite(site)?.site.operations.find((x) => x.name === op.op);
  if (!mine?.learnedLoggedIn || !mine.readOnly || mine.public?.length || op.errors.length) return undefined;
  const upload = claimUpload(op);
  const own = siteOf(new URL(upload.site.baseUrl).hostname);
  if (!hostsOfOp(upload.operation).every((h) => siteOf(h) === own) || personal(upload).length) return undefined;
  const fingerprint = sha(fingerprintText(upload.site.name, upload.operation));
  const body: Claim = {
    site: { name: upload.site.name, domain: upload.site.domain },
    fingerprint,
    nameHash: sha(nameHashText(op.op)),
  };
  try {
    const r = await registryRequest<ClaimResult>("/v1/claims", {
      method: "POST",
      body,
      signed: true,
      cap: 64 * 1024,
      signal,
    });
    withLock(claimsFile(), () => {
      const have = readJson<Claimed>(claimsFile(), {});
      have[fingerprint] = { site, op: op.op, as: upload.site.name };
      writePrivate(claimsFile(), JSON.stringify(have, null, 1));
    });
    await answerClaims(r.wanted, signal);
  } catch {
    return undefined;
  }
  return fingerprint.slice(0, 12);
}

/**
 * The registry asks for the bodies of claims enough installs hold: each goes up in its anonymous form,
 * but only for a fingerprint this install claimed and that its op still hashes to. The registry's word
 * that k installs agree is its claim, not this machine's: it gets nothing else.
 */
export async function answerClaims(
  wanted?: ClaimResult["wanted"],
  signal?: AbortSignal,
): Promise<{ site: string; op: string; status?: Status; reason?: string }[]> {
  if (!loadSettings().share || localOnly()) return [];
  const mine = readJson<Claimed>(claimsFile(), {});
  if (!Object.keys(mine).length) return [];
  const asked =
    wanted ?? (await registryRequest<ClaimResult>("/v1/claims", { signed: true, cap: 64 * 1024, signal })).wanted;
  const out: { site: string; op: string; status?: Status; reason?: string }[] = [];
  for (const w of asked) {
    const held = mine[w.fingerprint];
    if (!held) continue;
    let p: ReturnType<typeof plan>;
    try {
      p = plan(held.site, { ops: [held.op], evidence: { learnedLoggedIn: true }, ...(held.as ? { as: held.as } : {}) });
    } catch {
      continue;
    }
    const op = p.ops[0]!;
    const upload = { ...claimUpload(op), claim: w.fingerprint };
    if (op.errors.length || sha(fingerprintText(upload.site.name, upload.operation)) !== w.fingerprint) continue;
    // a name as many installs did not choose is this person's words: it never leaves, not even for the registry to replace
    if (!w.named) upload.operation = { ...upload.operation, name: `op_${w.fingerprint.slice(0, 8)}` };
    try {
      const r = await registryRequest<UploadResult>("/v1/versions", {
        method: "POST",
        body: upload,
        signed: true,
        cap: 64 * 1024,
        signal,
      });
      record(held.site, held.op, { hash: r.hash, status: r.status });
      out.push({ site: held.site, op: held.op, status: r.status });
    } catch (e) {
      out.push({ site: held.site, op: held.op, reason: (e as Error).message.split("\n")[0] });
    }
  }
  return out;
}
