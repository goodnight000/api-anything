import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getGraph, graphFile, resetGraph } from "../src/context.js";
import { buildGraph, graphStats, queryContext, renderContext } from "../src/graph.js";
import { type Site, SiteSchema } from "../src/spec.js";

/** Fixtures stand for any two sites: the graph must know no site by name. */
const op = (name: string, host: string, extra: Record<string, unknown> = {}) => ({
  name,
  description: `Read ${name} from the public page`,
  request: { method: "GET", url: `https://${host}/${name}` },
  trigger: { url: `https://${host}/${name}` },
  readOnly: true,
  ...extra,
});

const site = (name: string, host: string, operations: unknown[]): Site =>
  SiteSchema.parse({
    name,
    baseUrl: `https://${host}`,
    displayName: name,
    description: `Public catalog of ${name} things`,
    operations,
  });

const fixtures = () => [
  site("catalog-one", "one.com", [
    op("searchBooks", "one.com", {
      params: [{ name: "q", type: "string", required: true }],
      response: {
        format: "html",
        html: { items: "li", fields: { declaredRating: ".rating" } },
      },
    }),
    op("getBook", "one.com", { response: { format: "json", shape: { avgRating: "number" } } }),
  ]),
  site("catalog-two", "two.com", [
    op("listRecipes", "two.com", { response: { format: "json", shape: { avgRating: "number" } } }),
  ]),
];

test("the graph is deterministic and labels its edges by confidence", () => {
  const a = buildGraph(fixtures(), "fingerprint");
  const b = buildGraph([...fixtures()].reverse(), "fingerprint");
  assert.deepEqual(a.nodes, b.nodes);
  assert.deepEqual(a.edges, b.edges);
  const kinds = new Set(a.nodes.map((n) => n.kind));
  for (const k of ["site", "domain", "op", "param", "field", "topic"] as const) assert.ok(kinds.has(k), `missing ${k}`);
  assert.ok(a.edges.some((e) => e.kind === "has_op" && e.confidence === "declared"));
  assert.ok(a.edges.some((e) => e.kind === "returns" && e.confidence === "declared"));
  assert.ok(a.edges.some((e) => e.kind === "returns" && e.confidence === "observed"));
  assert.ok(a.edges.some((e) => e.kind === "mentions" && e.confidence === "lexical"));
  assert.equal(graphStats(a).byConfidence.inferred, 0);
});

test("an exact domain wins over a word in another site's description", () => {
  const c = queryContext(buildGraph(fixtures()), "two.com");
  assert.equal(c.sites[0]?.site, "catalog-two");
  assert.equal(c.sites[0]?.confidence, "exact");
});

test("a field names the operations that return it", () => {
  const c = queryContext(buildGraph(fixtures()), "avg rating");
  assert.deepEqual(c.sites.map((s) => s.site).sort(), ["catalog-one", "catalog-two"]);
  assert.ok(c.sites.find((s) => s.site === "catalog-one")?.ops.some((o) => o.op === "getBook"));
  assert.ok(c.sites.find((s) => s.site === "catalog-two")?.ops.some((o) => o.op === "listRecipes"));
});

test("a shared field gives cross-site neighbours with a reason", () => {
  const c = queryContext(buildGraph(fixtures()), "avg rating", { onlySite: "catalog-two" });
  assert.deepEqual(
    c.sites.map((s) => s.site),
    ["catalog-two"],
  );
  assert.ok(c.also.some((a) => a.site === "catalog-one" && /via avgRating/.test(a.via)));
});

test("site confines the answer and budget trims the text", () => {
  const g = buildGraph(fixtures());
  const one = queryContext(g, "declared rating", { onlySite: "catalog-one" });
  assert.deepEqual(
    one.sites.map((s) => s.site),
    ["catalog-one"],
  );
  const small = queryContext(g, "avg rating", { budget: 200 });
  assert.ok(small.truncated);
  assert.ok(renderContext(small).length <= 200);
});

test("the on-disk graph is reused and keyed to this machine's specs", () => {
  const dir = mkdtempSync(join(tmpdir(), "api-anything-graph-"));
  const previous = process.env.API_ANYTHING_HOME;
  process.env.API_ANYTHING_HOME = dir;
  try {
    resetGraph();
    const first = getGraph({ force: true });
    assert.equal(first.cached, false);
    assert.ok(first.graph.fingerprint);
    const second = getGraph();
    assert.equal(second.cached, true);
    assert.deepEqual(second.graph.nodes, first.graph.nodes);
    assert.ok(graphFile().startsWith(dir));
  } finally {
    if (previous === undefined) delete process.env.API_ANYTHING_HOME;
    else process.env.API_ANYTHING_HOME = previous;
    resetGraph();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two capability words in a site's own text expose its operations", () => {
  const only = SiteSchema.parse({
    name: "forecast-index",
    baseUrl: "https://forecast.example",
    description: "hourly precipitation and temperature forecasts",
    operations: [op("getConditions", "forecast.example")],
  });
  const c = queryContext(buildGraph([only]), "hourly precipitation");
  assert.equal(c.sites[0]?.site, "forecast-index");
  assert.deepEqual(
    c.sites[0]?.ops.map((o) => o.op),
    ["getConditions"],
  );
});
