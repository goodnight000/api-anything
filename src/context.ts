/**
 * The catalog as a graph on disk: built once from the installed specs, reused while they do not
 * change, and queried by `queryContext`. This is the only module that reads specs for the graph; the
 * graph itself (`graph.ts`) is pure, so the registry service can import it without a file system.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildGraph, type Context, type Graph, graphStats, queryContext, renderContext } from "./graph.js";
import { ensureDir, home, readJson, writePrivate } from "./session.js";
import { bundledDir, listSites, loadSite, registryDir, userSitesDir } from "./store.js";

const VERSION = 1;

export const graphFile = () => join(home(), "graph.json");

let printed: { at: number; root: string; value: string } | undefined;

/**
 * What the graph was built from: every spec file's path, size and modification time. Cheap (a stat
 * per spec, no parsing), so a change on disk is noticed without rebuilding on every call; held for a
 * second, since a burst of questions does not need the same 115 stats each time.
 */
export function specFingerprint(): string {
  const root = home();
  const now = Date.now();
  if (printed && printed.root === root && now - printed.at < 1000) return printed.value;
  const hash = createHash("sha256");
  let files = 0;
  for (const dir of [userSitesDir(), registryDir(), bundledDir()]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".json")) continue;
      const path = join(dir, file);
      try {
        const st = statSync(path);
        hash.update(`${path}:${st.size}:${st.mtimeMs}\n`);
        files++;
      } catch {
        // a file removed between the listing and the stat changes nothing worth a rebuild
      }
    }
  }
  const value = `${VERSION}:${files}:${hash.digest("hex").slice(0, 32)}`;
  printed = { at: now, root, value };
  return value;
}

let memo: { root: string; fingerprint: string; graph: Graph } | undefined;

/** Forget the in-process copy (a test's own home, or a spec saved in this process). */
export function resetGraph(): void {
  memo = undefined;
  printed = undefined;
}

export interface LoadedGraph {
  graph: Graph;
  /** the graph came from memory or the file, not from parsing every spec */
  cached: boolean;
  loadMs: number;
}

/**
 * The graph of the installed sites: memory, then the cached file if the specs are unchanged, then a
 * build from the specs. A cached file that cannot be read is rebuilt, never fatal.
 */
export function getGraph(o: { force?: boolean } = {}): LoadedGraph {
  const started = performance.now();
  const fingerprint = specFingerprint();
  if (!o.force && memo?.root === home() && memo.fingerprint === fingerprint) {
    return { graph: memo.graph, cached: true, loadMs: performance.now() - started };
  }
  const file = graphFile();
  if (!o.force && existsSync(file)) {
    try {
      const saved = readJson<Graph | undefined>(file, undefined);
      if (
        saved?.version === VERSION &&
        saved.fingerprint === fingerprint &&
        Array.isArray(saved.nodes) &&
        Array.isArray(saved.edges)
      ) {
        memo = { root: home(), fingerprint, graph: saved };
        return { graph: saved, cached: true, loadMs: performance.now() - started };
      }
    } catch {
      // a corrupt cache is a cache miss
    }
  }
  const sites = [];
  for (const name of listSites()) {
    try {
      const r = loadSite(name);
      if (r) sites.push(r.site);
    } catch {
      // one unreadable spec leaves the rest of the catalog usable, as `list_sites` does
    }
  }
  const graph = buildGraph(sites, fingerprint);
  try {
    ensureDir(home());
    writePrivate(file, JSON.stringify(graph));
  } catch {
    // a read-only home still answers: the graph lives in memory for this process
  }
  memo = { root: home(), fingerprint, graph };
  return { graph, cached: false, loadMs: performance.now() - started };
}

export interface ContextAnswer extends Context {
  text: string;
  stats: Context["stats"] & {
    loadMs: number;
    queryMs: number;
    cached: boolean;
    graph: ReturnType<typeof graphStats>;
  };
}

/** A question to a ranked, budgeted slice of the catalog, with the text a model reads. */
export function contextOf(
  query: string,
  o: { budget?: number; sites?: number; ops?: number; site?: string } = {},
): ContextAnswer {
  const loaded = getGraph();
  const started = performance.now();
  const c = queryContext(loaded.graph, query, {
    ...(o.budget !== undefined ? { budget: o.budget } : {}),
    ...(o.sites !== undefined ? { sites: o.sites } : {}),
    ...(o.ops !== undefined ? { ops: o.ops } : {}),
    ...(o.site ? { onlySite: o.site } : {}),
  });
  const queryMs = performance.now() - started;
  return {
    ...c,
    text: renderContext(c),
    stats: {
      ...c.stats,
      loadMs: Math.round(loaded.loadMs * 10) / 10,
      queryMs: Math.round(queryMs * 10) / 10,
      cached: loaded.cached,
      graph: graphStats(loaded.graph),
    },
  };
}
