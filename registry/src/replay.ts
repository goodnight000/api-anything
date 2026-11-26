/**
 * The registry's clean replay of a version held for review only because its uploader's client sent
 * none (an op made with `add` by a client older than 0.6, or one that could not replay it then): once,
 * through try.ts's sender and every one of its guards, with the op's published examples and no cookie
 * or session value. An ok answer the op's own recipe extracts something from supplies the evidence the
 * upload lacked, and the version becomes the candidate its upload would have been with that replay ok.
 * It is no report: it counts toward no promotion and never makes a version live. Anything else leaves
 * it in review; a version is tried at most `ATTEMPTS` times, a day apart at least, then never again.
 */
import { judge } from "../../src/classify.js";
import { buildRequest } from "../../src/http.js";
import type { Evidence } from "../../src/registry-api.js";
import type { Operation } from "../../src/spec.js";
import { vetShared } from "../../src/vet.js";
import {
  claimReplay,
  context,
  count,
  getSite,
  markReplay,
  promoteReplayed,
  replayQueue,
  restoreReplay,
  siteHeld,
  UNREPLAYABLE,
  type VersionRow,
} from "./store.js";
import { exampleArgs, fetchCapped, httpsOrigin, limits, OverCap, sendRefusal, type TryEnv, tryEnabled } from "./try.js";
import { cleanReplayReason, reviewReasons } from "./upload.js";

const DAY = 86_400_000;
export const ATTEMPTS = 3;
/** Each a Worker var too: replays a minute's tick sends at most, and a UTC day. */
const DEFAULTS = { perTick: 3, perDay: 200 };
const VARS = { perTick: "REPLAY_PER_TICK", perDay: "REPLAY_PER_DAY" } as const;

/** The outcome on record while a replay is under way, and all there is of one that never returned. */
const STARTED = "started";

/** The stored reasons of a version held for the skipped replay alone. */
const SKIPPED_ONLY = JSON.stringify([cleanReplayReason({ cleanReplay: "skipped" })]);

const empty = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);

function bound(env: TryEnv, k: keyof typeof DEFAULTS): number {
  const v = Number(env[VARS[k]]);
  return env[VARS[k]] !== undefined && Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULTS[k];
}

/**
 * Why no replay may run on this version, ever, or undefined when one may. The rules are asked again as
 * they stand now, with an ok replay: a version they would hold for anything else stays where it is.
 */
async function unreplayable(env: TryEnv, v: VersionRow, op: Operation): Promise<string | undefined> {
  if (v.uploader === "seed" || v.claim) return "not an install's upload";
  const row = await getSite(env.DB, v.site);
  if (!row) return "its site is gone";
  const site = context(row);
  const evidence = JSON.parse(v.evidence) as Evidence;
  const held = await siteHeld(env.DB, site, row, op.name);
  if (reviewReasons(site, op, { ...evidence, cleanReplay: "ok" }, held).length) return "the rules hold it for more";
  const refused = sendRefusal(site, op);
  if (refused) return refused;
  if (vetShared({ name: site.name, baseUrl: site.baseUrl, operations: [op] }).errors.length) return "the shared rules";
  if (!exampleArgs(op)) return "no example for a required param";
  return undefined;
}

/**
 * One tick's replays: at most `perTick`, one per site, while TRY_ENABLED is on. Each request is
 * counted against the replays' day and the catalog's sends a day (TRY_PER_DAY_ALL, shared with
 * `/v1/try`); once either is spent, the tick stops, and an attempt that had sent nothing yet is not counted.
 */
export async function replaySkipped(env: TryEnv, now: number): Promise<{ tried: number; promoted: number }> {
  const done = { tried: 0, promoted: 0 };
  if (!tryEnabled(env)) return done;
  const db = env.DB;
  const l = limits(env);
  const perTick = bound(env, "perTick");
  const perDay = bound(env, "perDay");
  const at = new Date(now).toISOString();
  const dayHour = Math.floor(now / DAY) * 24;
  // more than a tick takes: one per site passes over a second version of a site
  const queue = await replayQueue(db, SKIPPED_ONLY, ATTEMPTS, new Date(now - DAY).toISOString(), perTick * 4);
  const sites = new Set<string>();
  for (const v of queue) {
    if (done.tried >= perTick) break;
    if (sites.has(v.site)) continue;
    let op: Operation;
    try {
      op = JSON.parse(v.operation) as Operation;
    } catch {
      await markReplay(db, v.hash, UNREPLAYABLE);
      continue;
    }
    const why = await unreplayable(env, v, op);
    let req: ReturnType<typeof buildRequest> | undefined;
    try {
      req = why ? undefined : buildRequest(op, exampleArgs(op)!, { cookies: [], values: {} });
    } catch {
      req = undefined;
    }
    const origin = httpsOrigin(op.request.url);
    if (!req || !origin || req.method !== "GET" || httpsOrigin(req.url) !== origin) {
      await markReplay(db, v.hash, UNREPLAYABLE);
      continue;
    }
    // only the op's own literal headers, and no cookie
    const { cookie: _c, host: _h, "content-length": _l, ...headers } = req.headers;
    let sent = false;
    const reserve = async () => {
      const ok =
        (await count(db, "all", "replay:day", dayHour, 1)) <= perDay &&
        (await count(db, "all", "try:day", dayHour, 1)) <= l.allPerDay;
      sent ||= ok;
      return ok;
    };
    // Counted before the send: an answer that ends the tick (the Worker's CPU or time limit, on a body
    // and a recipe their uploader chose) would otherwise leave the version first in line every minute.
    // And a claim: a version a maintainer decided on, or another tick took, since the queue read is not sent.
    if (!(await claimReplay(db, v, SKIPPED_ONLY, STARTED, at))) continue;
    sites.add(v.site);
    let outcome: string;
    let spent = false;
    try {
      const up = await fetchCapped(req.url, headers, new Set([origin]), l, reserve);
      const j = judge(op, up);
      outcome = j.class === "ok" ? (empty(j.data) ? "empty" : "ok") : j.class;
    } catch (e) {
      spent = e instanceof OverCap;
      if (spent && !sent) {
        // the day's sends were spent before anything went: this was no attempt
        await restoreReplay(db, v, at);
        break;
      }
      // a redirect hop over the day's sends still sent its first request: that attempt stands
      outcome = "error";
    }
    done.tried++;
    if (outcome === "ok") {
      const evidence = JSON.parse(v.evidence) as Evidence;
      await promoteReplayed(db, v.hash, SKIPPED_ONLY, { ...evidence, registryReplay: { at, outcome: "ok" } }, at);
      done.promoted++;
    } else await markReplay(db, v.hash, outcome);
    if (spent) break;
  }
  return done;
}
