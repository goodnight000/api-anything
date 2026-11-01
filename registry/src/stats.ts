/**
 * The public aggregate stats (`GET /v1/stats`, the home page's strip) and which sites installs taught.
 * Only counts leave here: never a key, a network hash or anything that tells one install from another.
 */
import type { ServedSite } from "../../src/registry-api.js";
import { confirmed } from "./catalog.js";
import { SERVED, successRate } from "./rules.js";
import type { D1Database } from "./store.js";

/** The uploader of a maintainer's seed (worker.ts `adminSeed`, store.ts `seedSite`). */
const SEED = "seed";

export interface PublicStats {
  generated: string;
  /** distinct installs that reported, uploaded, claimed or reported an interface in the window */
  installs: { last7Days: number; last30Days: number };
  /** calls reported in the last 7 UTC days, today included; okRate is ok / (ok + fail + wrong) */
  calls: { last7Days: number; ok: number; okRate?: number };
  /** sites with a live op, and their live ops */
  sites: { live: number; operations: number };
  /** of those, the sites an install first shared, and the live ops whose served version an install uploaded */
  community: { sites: number; operations: number; uploadsLast30Days: number };
  /** domains asked for in the demand window that no site covers */
  wanted: number;
}

const DAY = 86_400_000;
const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

/** Statements adding a batch of reported outcomes to today's call counts. */
export function countCalls(db: D1Database, at: number, outcomes: string[]) {
  const by = new Map<string, number>();
  for (const o of outcomes) by.set(o, (by.get(o) ?? 0) + 1);
  return [...by].map(([outcome, n]) =>
    db
      .prepare(
        "INSERT INTO calls (day, outcome, n) VALUES (?, ?, ?) ON CONFLICT (day, outcome) DO UPDATE SET n = n + excluded.n",
      )
      .bind(utcDay(at), outcome, n),
  );
}

export const forgetCalls = (db: D1Database, before: number) =>
  db.prepare("DELETE FROM calls WHERE day < ?").bind(utcDay(before)).run();

async function activeInstalls(db: D1Database, since: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
        SELECT key FROM reports WHERE at >= ?
        UNION SELECT uploader FROM versions WHERE created_at >= ? AND uploader <> ?
        UNION SELECT key FROM claims WHERE at >= ?
        UNION SELECT key FROM interface_reports WHERE at >= ?
      )`,
    )
    .bind(since, since, SEED, since, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Sites an install first shared, and the served versions installs uploaded; `site` narrows to one site. */
export async function community(db: D1Database, site?: string): Promise<{ sites: Set<string>; hashes: Set<string> }> {
  const only = site ? " AND name = ?" : "";
  const sites = await db
    .prepare(`SELECT name FROM sites WHERE first_uploader <> ?${only}`)
    .bind(SEED, ...(site ? [site] : []))
    .all<{ name: string }>();
  const hashes = await db
    .prepare(
      `SELECT hash FROM versions WHERE uploader <> ? AND status IN (${SERVED.map(() => "?").join(", ")})${site ? " AND site = ?" : ""}`,
    )
    .bind(SEED, ...SERVED, ...(site ? [site] : []))
    .all<{ hash: string }>();
  return { sites: new Set(sites.results.map((r) => r.name)), hashes: new Set(hashes.results.map((r) => r.hash)) };
}

/** The stats over `sites`, the catalog as served to an unsigned caller; `by` is `community()` when already read. */
export async function publicStats(
  db: D1Database,
  sites: ServedSite[],
  now: number,
  demandSince: string,
  by?: { sites: Set<string>; hashes: Set<string> },
): Promise<PublicStats> {
  const ago = (days: number) => new Date(now - days * DAY).toISOString();
  const calls = await db
    .prepare(
      `SELECT COALESCE(SUM(n), 0) AS total, COALESCE(SUM(CASE WHEN outcome = 'ok' THEN n END), 0) AS ok,
        COALESCE(SUM(CASE WHEN outcome IN ('fail', 'wrong') THEN n END), 0) AS bad FROM calls WHERE day >= ?`,
    )
    .bind(utcDay(now - 6 * DAY))
    .first<{ total: number; ok: number; bad: number }>();
  const uploads = await db
    .prepare("SELECT COUNT(*) AS n FROM versions WHERE created_at >= ? AND uploader <> ?")
    .bind(ago(30), SEED)
    .first<{ n: number }>();
  const wanted = await db
    .prepare(
      `SELECT COUNT(DISTINCT d.domain) AS n FROM demand d
       WHERE d.at >= ? AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.domain = d.domain)`,
    )
    .bind(demandSince)
    .first<{ n: number }>();
  const taught = by ?? (await community(db));
  const live = sites.filter(confirmed);
  const liveOps = live.flatMap((s) => s.operations.filter((o) => o.status === "live"));
  const rate = successRate(calls?.ok ?? 0, calls?.bad ?? 0);
  return {
    generated: new Date(now).toISOString(),
    installs: { last7Days: await activeInstalls(db, ago(7)), last30Days: await activeInstalls(db, ago(30)) },
    calls: { last7Days: calls?.total ?? 0, ok: calls?.ok ?? 0, ...(rate !== undefined ? { okRate: rate } : {}) },
    sites: { live: live.length, operations: liveOps.length },
    community: {
      sites: live.filter((s) => taught.sites.has(s.name)).length,
      operations: liveOps.filter((o) => taught.hashes.has(o.hash)).length,
      uploadsLast30Days: uploads?.n ?? 0,
    },
    wanted: wanted?.n ?? 0,
  };
}
