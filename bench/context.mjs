// Local, offline benchmark of the context layer: no browser, no network, no model calls.
// Usage: node --import tsx bench/context.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contextOf, getGraph, resetGraph } from "../src/context.ts";
import { buildGraph, graphStats, queryContext } from "../src/graph.ts";
import { indexEntry, matchQuery, operationMatch, words } from "../src/search.ts";
import { SiteSchema } from "../src/spec.ts";
import { listSites, loadSite } from "../src/store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const results = join(here, "results", "context.json");
const round = (n) => Math.round(n * 100) / 100;
const pct = (xs, p) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return round(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0);
};
const sample = (n, fn) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    fn(i);
    out.push(performance.now() - t);
  }
  return out;
};

/** Synthetic specs only: the labels are true by construction, and the graph knows no site by name. */
const fixture = (name, host, description, opName, params, fields) =>
  SiteSchema.parse({
    name,
    baseUrl: `https://${host}`,
    displayName: name,
    description,
    operations: [
      {
        name: opName,
        description: `${opName} on ${host}`,
        readOnly: true,
        request: { method: "GET", url: `https://${host}/${opName}` },
        trigger: { url: `https://${host}/` },
        params: params.map((p) => ({ name: p, type: "string", required: true })),
        response: { format: "json", shape: Object.fromEntries(fields.map((f) => [f, "string"])) },
      },
    ],
  });

const fixtures = [
  fixture(
    "books-index",
    "books.example",
    "novels, authors and reader ratings",
    "searchBooks",
    ["title", "author"],
    ["avgRating", "isbn"],
  ),
  fixture(
    "flights-index",
    "flights.example",
    "airfare schedules, routes and connecting flights",
    "searchFares",
    ["origin", "destination", "date"],
    ["fareAmount", "nonstop"],
  ),
  fixture(
    "recipes-index",
    "recipes.example",
    "cooking recipes, ingredients and kitchen steps",
    "findRecipes",
    ["ingredient"],
    ["cookTime", "recipeRating"],
  ),
  fixture(
    "trials-index",
    "trials.example",
    "clinical studies, eligibility and research sponsors",
    "listTrials",
    ["condition"],
    ["phase", "sponsor"],
  ),
  fixture(
    "weather-index",
    "weather.example",
    "forecasts, hourly conditions and precipitation",
    "hourlyForecast",
    ["city"],
    ["temperature", "humidity"],
  ),
  fixture(
    "packages-index",
    "packages.example",
    "parcel delivery tracking and dispatch history",
    "trackParcel",
    ["trackingNumber"],
    ["deliveryEta", "lastScan"],
  ),
  fixture(
    "jobs-index",
    "jobs.example",
    "vacancies, hiring and employer postings",
    "searchJobs",
    ["query", "location"],
    ["salaryRange", "employer"],
  ),
  fixture(
    "movies-index",
    "movies.example",
    "films, cinema listings and showtimes",
    "movieShowtimes",
    ["city", "date"],
    ["runtime", "genre"],
  ),
];

const labels = [
  { query: "book ratings", site: "books-index", op: "searchBooks" },
  { query: "novel author isbn", site: "books-index", op: "searchBooks" },
  { query: "cheap airfare connecting route", site: "flights-index", op: "searchFares" },
  { query: "cook time ingredients", site: "recipes-index", op: "findRecipes" },
  { query: "clinical eligibility sponsor", site: "trials-index", op: "listTrials" },
  { query: "hourly precipitation temperature", site: "weather-index", op: "hourlyForecast" },
  { query: "parcel dispatch eta", site: "packages-index", op: "trackParcel" },
  { query: "hiring employer salary", site: "jobs-index", op: "searchJobs" },
  { query: "cinema showtimes genre", site: "movies-index", op: "movieShowtimes" },
  { query: "weather.example", site: "weather-index", op: "hourlyForecast" },
];

const synthetic = buildGraph(fixtures, "synthetic");
const graded = labels.map((label) => {
  const c = queryContext(synthetic, label.query, { budget: 1600, sites: 4, ops: 3 });
  const siteRank = c.sites.findIndex((s) => s.site === label.site);
  const opRank = siteRank < 0 ? -1 : c.sites[siteRank].ops.findIndex((o) => o.op === label.op);
  return { ...label, siteRank, opRank, top: c.sites[0]?.site ?? null, chars: c.chars };
});
const rankScore = (key) => {
  const reciprocal = graded.reduce((sum, x) => sum + (x[key] < 0 ? 0 : 1 / (x[key] + 1)), 0) / graded.length;
  return {
    top1: round(graded.filter((x) => x[key] === 0).length / graded.length),
    top3: round(graded.filter((x) => x[key] >= 0 && x[key] < 3).length / graded.length),
    mrr: round(reciprocal),
  };
};

const installed = [];
for (const name of listSites()) {
  try {
    const r = loadSite(name);
    if (r) installed.push(r.site);
  } catch {
    // one unreadable spec must not stop the benchmark, as it must not stop a context answer
  }
}
const catalogJsonChars = JSON.stringify(installed).length;
const entries = installed.flatMap((s) => {
  try {
    return [indexEntry(s, JSON.stringify(s))];
  } catch {
    return [];
  }
});

/** The old discovery shape: five find_sites matches with their op matches, before list_operations. */
const baselineChars = (query) =>
  JSON.stringify(
    entries
      .map((e) => ({ e, m: matchQuery(e, query) }))
      .filter((x) => x.m.score > 0)
      .sort((a, b) => b.m.score - a.m.score || a.e.site.localeCompare(b.e.site))
      .slice(0, 5)
      .map(({ e, m }) => ({
        site: e.site,
        domain: e.domains?.[0],
        description: e.description,
        operations: e.operations.slice(0, 8).map((o) => ({ op: o.op, ...operationMatch(o, query) })),
        match: m,
      })),
  ).length;

// Payload questions come from the installed specs themselves, so no site name is fixed here.
const payloadQueries = installed
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name))
  .filter((_, i) => i % Math.max(1, Math.floor(installed.length / 24)) === 0)
  .slice(0, 24)
  .map((s) =>
    words(`${s.name} ${s.description ?? ""} ${s.operations.map((o) => o.name).join(" ")}`)
      .slice(0, 3)
      .join(" "),
  )
  .filter(Boolean);
const payload = payloadQueries.map((query) => {
  const c = contextOf(query, { budget: 1600 });
  return { query, contextChars: c.text.length, baselineChars: baselineChars(query), sites: c.sites.length };
});

const loaded = getGraph();
const graph = loaded.graph;
// Warm the traversal index and the on-disk read before measuring either.
contextOf("book ratings");
resetGraph();
getGraph();
const buildTimes = sample(12, () => buildGraph(installed));
const queryTimes = sample(60, (i) =>
  queryContext(graph, payloadQueries[i % payloadQueries.length] ?? "data", { budget: 1600 }),
);
const contextTimes = sample(60, (i) =>
  contextOf(payloadQueries[i % payloadQueries.length] ?? "data", { budget: 1600 }),
);
const diskTimes = sample(12, () => {
  resetGraph();
  getGraph();
});

const avg = (xs) => round(xs.reduce((a, b) => a + b, 0) / (xs.length || 1));
const report = {
  generatedAt: new Date().toISOString(),
  command: "node --import tsx bench/context.mjs",
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  catalog: {
    sites: installed.length,
    operations: installed.reduce((n, s) => n + s.operations.length, 0),
    catalogJsonChars,
    graph: graphStats(graph),
  },
  retrieval: {
    queries: graded.length,
    site: rankScore("siteRank"),
    op: rankScore("opRank"),
    misses: graded
      .filter((x) => x.siteRank < 0 || x.opRank < 0)
      .map(({ query, siteRank, opRank, top }) => ({ query, siteRank, opRank, top })),
  },
  payload: {
    queries: payload.length,
    contextChars: {
      p50: pct(
        payload.map((p) => p.contextChars),
        0.5,
      ),
      p95: pct(
        payload.map((p) => p.contextChars),
        0.95,
      ),
      max: Math.max(...payload.map((p) => p.contextChars)),
      avg: avg(payload.map((p) => p.contextChars)),
    },
    findSitesShapedChars: {
      p50: pct(
        payload.map((p) => p.baselineChars),
        0.5,
      ),
      p95: pct(
        payload.map((p) => p.baselineChars),
        0.95,
      ),
      max: Math.max(...payload.map((p) => p.baselineChars)),
      avg: avg(payload.map((p) => p.baselineChars)),
    },
    fullCatalogChars: catalogJsonChars,
    examples: payload.slice(0, 5),
  },
  discoveryCalls: {
    before: ["find_sites", "list_operations"],
    after: ["find_context"],
    savedPerQuestion: 1,
  },
  latencyMs: {
    build: { runs: buildTimes.length, p50: pct(buildTimes, 0.5), p95: pct(buildTimes, 0.95), avg: avg(buildTimes) },
    query: { runs: queryTimes.length, p50: pct(queryTimes, 0.5), p95: pct(queryTimes, 0.95), avg: avg(queryTimes) },
    contextOf: {
      runs: contextTimes.length,
      p50: pct(contextTimes, 0.5),
      p95: pct(contextTimes, 0.95),
      avg: avg(contextTimes),
    },
    cachedDiskLoad: {
      runs: diskTimes.length,
      p50: pct(diskTimes, 0.5),
      p95: pct(diskTimes, 0.95),
      avg: avg(diskTimes),
    },
  },
  syntheticStats: graphStats(synthetic),
};

mkdirSync(dirname(results), { recursive: true });
writeFileSync(results, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
