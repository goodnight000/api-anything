/** What the registry serves: each site with the best version of each of its ops, and search over them. */
import type { FoundOp, SearchMatch, ServedOp, ServedSite } from "../../src/registry-api.js";
import { domainOf, type IndexEntry, indexEntry, matchQuery, operationMatch, summarize } from "../../src/search.js";
import type { Operation, Site } from "../../src/spec.js";
import { byRank, successRate } from "./rules.js";
import { allSites, context, type D1Database, getSite, servable, type VersionRow } from "./store.js";

const servedOp = (r: VersionRow): ServedOp => {
  const rate = successRate(r.oks, r.bad);
  return {
    hash: r.hash,
    status: r.status,
    confirmations: r.confirmations,
    ...(rate !== undefined ? { successRate: rate } : {}),
    ...(r.last_ok_at ? { lastOkAt: r.last_ok_at } : {}),
    registry: {
      hash: r.hash,
      status: r.status,
      confirmations: r.confirmations,
      ...(rate !== undefined ? { successRate: rate } : {}),
      ...(r.last_ok_at ? { lastOkAt: r.last_ok_at } : {}),
    },
    operation: JSON.parse(r.operation) as Operation,
  };
};

/**
 * One version per op: the best of those with its name. Not by match signature alone, as docs/REGISTRY.md
 * has it: real specs hold distinct ops on one endpoint (goodreads getBook and getWorkId, google-flights
 * search and top), and a site must never serve two ops of one name.
 */
export function bestPerOp(rows: VersionRow[]): ServedOp[] {
  const groups = new Map<string, ServedOp & { createdAt: string; liveSince?: string }>();
  for (const r of rows) {
    const op = { ...servedOp(r), createdAt: r.created_at, ...(r.live_since ? { liveSince: r.live_since } : {}) };
    const held = groups.get(r.op_name);
    if (!held || byRank(op, held) < 0) groups.set(r.op_name, op);
  }
  return [...groups.values()]
    .map(({ createdAt: _, liveSince: __, ...op }) => op)
    .sort((a, b) => a.operation.name.localeCompare(b.operation.name));
}

/** The sites with something to serve this viewer, by name; `name` narrows to one. */
export async function catalog(db: D1Database, viewer?: string, name?: string): Promise<ServedSite[]> {
  const rows = await servable(db, viewer, name);
  const bySite = new Map<string, VersionRow[]>();
  for (const r of rows) bySite.set(r.site, [...(bySite.get(r.site) ?? []), r]);
  const sites = name ? [await getSite(db, name)].flatMap((s) => (s ? [s] : [])) : await allSites(db);
  return sites.flatMap((s) => {
    const versions = bySite.get(s.name);
    return versions ? [{ ...context(s), operations: bestPerOp(versions) }] : [];
  });
}

const asSite = (s: ServedSite): Site => ({
  name: s.name,
  baseUrl: s.baseUrl,
  ...(s.displayName ? { displayName: s.displayName } : {}),
  ...(s.description ? { description: s.description } : {}),
  operations: s.operations.map((o) => o.operation),
});

/** The site as an index entry; its sha256 is over its served versions, so it changes when one does. */
export const entryOf = (s: ServedSite): IndexEntry => indexEntry(asSite(s), s.operations.map((o) => o.hash).join("\n"));

const foundOp = (o: ServedOp): FoundOp => ({
  name: o.operation.name,
  signature: summarize(o.operation).op,
  ...(o.operation.description ? { description: o.operation.description } : {}),
  status: o.status,
  confirmations: o.confirmations,
  ...(o.successRate !== undefined ? { successRate: o.successRate } : {}),
  ...(o.lastOkAt ? { lastOkAt: o.lastOkAt } : {}),
  ...(o.registry ? { registry: o.registry } : {}),
  ...(o.operation.learnedLoggedIn ? { login: true as const } : {}),
  params: o.operation.params.map((p) => ({
    name: p.name,
    type: p.type,
    required: p.required,
    ...(p.description ? { description: p.description } : {}),
    ...(p.hint ? { hint: p.hint } : {}),
    ...(p.example !== undefined ? { example: p.example } : {}),
  })),
});

/** A site some other install confirmed: it has a live op. Only these are listed and found by words. */
export const confirmed = (s: ServedSite) => s.operations.some((o) => o.status === "live");

/**
 * The sites that answer a query, best first, cut as the client's search cuts (src/registry.ts `search`).
 * Anyone can upload a site that says it is Amazon, so a site with no live op is found only by a domain or
 * URL query naming its own domain, and a confirmed site always ranks above it.
 */
export function search(sites: ServedSite[], query: string, limit: number): SearchMatch[] {
  const byDomain = domainOf(query) !== undefined;
  const scored = sites
    .filter((s) => byDomain || confirmed(s))
    .map((s) => ({ s, live: confirmed(s), ...matchQuery(entryOf(s), query) }))
    .sort((a, b) => Number(b.live) - Number(a.live) || b.score - a.score || a.s.name.localeCompare(b.s.name));
  // a site far behind the best answer matched a stray word
  const best = Math.max(0, ...scored.map((x) => x.score));
  return scored
    .filter(({ score }) => score > 0 && score * 3 >= best)
    .slice(0, limit)
    .map(({ s, matched, unmatched }) => ({
      name: s.name,
      domain: s.domain,
      ...(s.displayName ? { displayName: s.displayName } : {}),
      ...(s.description ? { description: s.description } : {}),
      matched,
      unmatched,
      operations: s.operations.map((o) => ({
        ...foundOp(o),
        ...operationMatch({ op: summarize(o.operation).op, description: o.operation.description }, query),
      })),
    }));
}
