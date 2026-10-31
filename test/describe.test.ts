import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { describeOperation, prepareLink, pull, search } from "../src/index.js";
import { linkProblems } from "../src/links.js";
import { parseSite } from "../src/spec.js";
import { vetShared } from "../src/vet.js";

const fixture = () =>
  parseSite({
    name: "contracts",
    baseUrl: "https://example.com",
    operations: [
      {
        name: "search",
        readOnly: true,
        request: { method: "GET", url: "https://example.com/search?q={q}" },
        trigger: { url: "https://example.com/?q={q}" },
        match: { host: "example.com", path: "/search" },
        params: [{ name: "q", example: "book", pattern: ".+", hint: "search words" }],
        response: {
          extract: "data.hits",
          pick: ["id", "ratings=count", "slug=url~/([^/]+)$", "missing"],
          shape: {
            data: "object",
            "data.hits": "array",
            "data.hits[]": "object",
            "data.hits[].id": "string",
            "data.hits[].count": "number",
          },
        },
        links: [{ from: "id", to: { op: "detail", arg: "id" } }],
      },
      {
        name: "detail",
        readOnly: true,
        request: { method: "GET", url: "https://example.com/items/{id}" },
        trigger: { url: "https://example.com/items/{id}" },
        match: { host: "example.com", path: "/items/*" },
        params: [{ name: "id" }, { name: "limit", type: "number", default: 3 }, { name: "after", required: false }],
        response: { shape: { title: "string", count: "number" } },
      },
    ],
  });

test("portable contracts describe the selected recipe and reuse MCP's input schema", () => {
  const site = fixture();
  const d = describeOperation(site, "search");
  assert.equal(d.site, "contracts");
  assert.equal(d.op, "search");
  assert.equal(d.readOnly, true);
  assert.deepEqual(d.output, {
    cardinality: "list",
    fields: {
      id: { type: "string", source: "observed" },
      ratings: { type: "number", source: "observed" },
      slug: { type: "string", source: "declared" },
      missing: { source: "unknown" },
    },
  });
  assert.deepEqual(d.params, {
    type: "object",
    properties: { q: { type: "string", pattern: "^(?:.+)$", description: "search words", examples: ["book"] } },
    required: ["q"],
    additionalProperties: false,
  });
  assert.deepEqual(d.links, site.operations[0]!.links);
  assert.deepEqual(describeOperation(site, "detail").output, {
    cardinality: "one",
    fields: { title: { type: "string", source: "observed" }, count: { type: "number", source: "observed" } },
  });
  assert.throws(() => describeOperation(site, "absent"), /no operation/);
  assert.equal(typeof search, "function");
  assert.equal(typeof pull, "function");
});

test("HTML recipes declare a list and text/list fields, not numeric coercions", () => {
  const site = fixture();
  const op = site.operations[0]!;
  op.response = { format: "html", html: { items: "body", fields: { ratings: ".ratings", tags: "all:.tag" } } };
  assert.deepEqual(describeOperation(site, op.name).output, {
    cardinality: "list",
    fields: { ratings: { type: "string", source: "declared" }, tags: { type: "array", source: "declared" } },
  });
  op.response.extract = "[0]";
  assert.deepEqual(describeOperation(site, op.name).output, { cardinality: "unknown", fields: {} });
});

test("contracts do not guess cardinality or types from names, examples, or descriptions", () => {
  const site = fixture();
  site.operations[0]!.response.shape = undefined;
  const output = describeOperation(site, "search").output;
  assert.equal(output.cardinality, "unknown");
  assert.deepEqual(output.fields.ratings, { source: "unknown" });
  site.operations[0]!.response.extract = "data.hits[*]";
  assert.equal(describeOperation(site, "search").output.cardinality, "list");
});

test("bundled contracts distinguish HTML detail lists and expose the documented links", () => {
  const bundled = (name: string) =>
    parseSite(JSON.parse(readFileSync(new URL(`../sites/${name}.json`, import.meta.url), "utf8")));
  const gr = bundled("goodreads");
  assert.equal(describeOperation(gr, "getBook").output.cardinality, "list");
  assert.deepEqual(describeOperation(gr, "getBook").output.fields.ratingsCount, { type: "string", source: "declared" });
  assert.deepEqual(prepareLink(gr, "searchBooks", { bookId: "12345" }, gr.operations[0]!.links![1]!), {
    site: "goodreads",
    op: "getWorkId",
    args: { bookId: "12345" },
  });
  const work = gr.operations.find((o) => o.name === "getWorkId")!;
  assert.deepEqual(prepareLink(gr, work.name, { workId: "kca://work/example" }, work.links![0]!).args, {
    limit: 3,
    workId: "kca://work/example",
  });
  const food = bundled("bbcgoodfood");
  assert.deepEqual(
    prepareLink(
      food,
      "search",
      { url: "https://www.bbcgoodfood.com/recipes/pasta/?q=ignored#part" },
      food.operations[0]!.links![0]!,
    ),
    {
      site: "bbcgoodfood",
      op: "getRecipe",
      args: { slug: "pasta" },
    },
  );
  const rt = bundled("rottentomatoes");
  const movies = rt.operations.find((o) => o.name === "searchMovies")!;
  assert.deepEqual(
    prepareLink(rt, movies.name, { url: "https://www.rottentomatoes.com/m/interstellar_2014" }, movies.links![0]!).args,
    { slug: "interstellar_2014" },
  );
});

test("links vet target operations, params, transform syntax and unsafe regexes", () => {
  const site = fixture();
  const op = site.operations[0]!;
  assert.deepEqual(vetShared(site).errors, []);
  const link = op.links![0]!;
  link.to.op = "absent";
  assert.match(vetShared(site).errors.join("; "), /link target absent/);
  link.to.op = "detail";
  link.to.arg = "absent";
  assert.match(vetShared(site).errors.join("; "), /is no param/);
  link.to.arg = "id";
  link.from = "title";
  assert.match(vetShared(site).errors.join("; "), /link source title is no field search returns/);
  link.from = "id";
  for (const transform of ["eval", "~(", "name=url~(x)"]) {
    link.transform = transform;
    assert.match(vetShared(site).errors.join("; "), /link transform/);
  }
  for (const transform of ["lastPathSegment", "~([^/]+)$", "url~/items/([^/]+)"]) {
    link.transform = transform;
    assert.deepEqual(linkProblems(site, op), []);
  }
  link.transform = "~(a+)+";
  assert.match(vetShared(site).errors.join("; "), /nests a quantifier/);
  link.transform = `~${"a".repeat(201)}`;
  assert.match(vetShared(site).errors.join("; "), /at most 200/);
});

test("prepareLink fills defaults and explicit required args but neither executes nor coerces values", () => {
  const site = fixture();
  const op = site.operations[0]!;
  const link = op.links![0]!;
  assert.deepEqual(prepareLink(site, "search", { id: 12345 }, link), {
    site: "contracts",
    op: "detail",
    args: { limit: 3, id: 12345 },
  });
  site.operations[1]!.params.push({ name: "locale", type: "string", required: true });
  assert.throws(() => prepareLink(site, "search", { id: "123" }, link), /required args: locale/);
  assert.deepEqual(prepareLink(site, "search", { id: "123" }, link, { locale: "en", limit: 5 }).args, {
    locale: "en",
    limit: 5,
    id: "123",
  });
  assert.throws(() => prepareLink(site, "search", {}, link), /no value/);
  assert.throws(() => prepareLink(site, "search", { id: "123" }, { ...link, from: "other" }), /not declared/);
  assert.throws(() => prepareLink(site, "search", { id: "123" }, link, { unexpected: true }), /extra args/);
  assert.throws(
    () => prepareLink(site, "search", [{ id: "123" }] as unknown as Record<string, unknown>, link),
    /choose one/,
  );
});

test("link transforms share pick's path and regex semantics and refuse absent matches", () => {
  const site = fixture();
  const op = site.operations[0]!;
  const link = op.links![0]!;
  op.response.pick!.push("record");
  link.from = "record";
  link.transform = "url~/items/([^/?]+)";
  assert.deepEqual(prepareLink(site, op.name, { record: { url: "https://example.com/items/book?q=x" } }, link).args, {
    limit: 3,
    id: "book",
  });
  assert.throws(() => prepareLink(site, op.name, { record: { url: "unmatched" } }, link), /no value/);
  link.transform = "lastPathSegment";
  assert.throws(() => prepareLink(site, op.name, { record: "not a URL" }, link), /absolute URL/);
  assert.throws(() => prepareLink(site, op.name, { record: "https://example.com/" }, link), /no value/);
});

test("observed object and list types follow extract and aliases, including optional and array fields", () => {
  const site = fixture();
  const op = site.operations[0]!;
  op.response = {
    format: "json",
    extract: "data.item",
    pick: ["name", "maybe", "tags"],
    shape: { "data.item": "object", "data.item.name": "string", "data.item.maybe": "null", "data.item.tags": "array" },
  };
  assert.deepEqual(describeOperation(site, op.name).output, {
    cardinality: "one",
    fields: {
      name: { type: "string", source: "observed" },
      maybe: { source: "unknown" },
      tags: { type: "array", source: "observed" },
    },
  });
  op.response = { format: "json", pick: ["id"], shape: { "[].id": "string" } };
  assert.equal(describeOperation(site, op.name).output.cardinality, "list");
  op.response = { format: "json", extract: "sections[*].items", pick: ["id"], shape: { "sections[].items": "array" } };
  assert.deepEqual(describeOperation(site, op.name).output.fields.id, { source: "unknown" });
});
