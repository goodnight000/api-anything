/**
 * Paging found in a capture (src/paging.ts): two requests to one endpoint that differ in one place,
 * where the first one's answer gives the second one's value there; and a cursor read out of a
 * next-page URL with `path~regex`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { judge } from "../src/classify.js";
import { pagingHints, standIn } from "../src/paging.js";
import { parseSite } from "../src/spec.js";
import type { Exchange } from "../src/types.js";

let n = 0;
const ex = (url: string, answer: unknown, o: { method?: string; body?: string; type?: string } = {}): Exchange => ({
  id: ++n,
  resourceType: o.type ?? "fetch",
  request: {
    method: o.method ?? "GET",
    url,
    headers: { "x-trace": String(Math.random()), ...(o.body ? { "content-type": "application/json" } : {}) },
    ...(o.body ? { body: o.body } : {}),
  },
  response: { status: 200, headers: {}, contentType: "application/json", body: JSON.stringify(answer) },
});

const API = "https://shop.example.com/api";
const connection = (from: number, end: string | null) => ({
  data: {
    reviews: {
      edges: [1, 2, 3].map((i) => ({ cursor: `cur${from + i}xyz`, node: { id: `r${from + i}` } })),
      pageInfo: { endCursor: end, hasNextPage: !!end },
    },
  },
});

test("a cursor: page 1's answer holds page 2's `after`; the path outside the list's items wins", () => {
  const hints = pagingHints([
    ex("https://shop.example.com/p/kettle", "<html>", { type: "document" }),
    ex(`${API}/reviews?id=48213&first=3&after=`, connection(0, "cur3xyz")),
    ex(`${API}/price?id=48213`, { amount: 3 }),
    ex(`${API}/reviews?id=48213&first=3&after=cur3xyz`, connection(3, "cur6xyz")),
    ex(`${API}/reviews?id=48213&first=3&after=cur6xyz`, connection(6, null)),
  ]);
  // pages 2 and 3 say the same: one hint, from the first pair
  assert.equal(hints.length, 1);
  assert.deepEqual(
    { ...hints[0], previous: undefined, request: undefined },
    {
      previous: undefined,
      request: undefined,
      at: ["query:after"],
      value: "cur3xyz",
      paging: { param: "after", next: "data.reviews.pageInfo.endCursor" },
    },
  );
  assert.equal(hints[0]!.request - hints[0]!.previous, 2);
});

test("a cursor in a JSON body (GraphQL variables), page 1 sending null; a page 1 that leaves the cursor out", () => {
  const body = (after: string | null) =>
    JSON.stringify({ operationName: "Reviews", variables: { id: "48213", after }, query: "query Reviews { x }" });
  const [h] = pagingHints([
    ex(`${API}/graphql`, connection(0, "cur3xyz"), { method: "POST", body: body(null) }),
    ex(`${API}/graphql`, connection(3, null), { method: "POST", body: body("cur3xyz") }),
  ]);
  assert.deepEqual(
    [h?.at, h?.paging],
    [["body", "json:/variables/after"], { param: "after", next: "data.reviews.pageInfo.endCursor" }],
  );
  const [added] = pagingHints([
    ex(`${API}/reviews?id=1&first=3`, connection(0, "cur3xyz")),
    ex(`${API}/reviews?id=1&first=3&after=cur3xyz`, connection(3, null)),
  ]);
  assert.deepEqual(added?.paging, { param: "after", next: "data.reviews.pageInfo.endCursor" });
});

test("a page number the answer gives as a next-page URL is read out of it with path~regex; with none it is numbered", () => {
  const page = (p: number, next: string | null) => ({ crates: [{ id: `c${p}` }], meta: { next_page: next, total: 2 } });
  const [h] = pagingHints([
    ex(`${API}/crates?page=1&per_page=10&q=reqwest`, page(1, "?per_page=10&q=reqwest&page=2")),
    ex(`${API}/crates?page=2&per_page=10&q=reqwest`, page(2, null)),
  ]);
  assert.deepEqual([h?.value, h?.paging], ["2", { param: "page", next: "meta.next_page~[?&]page=([^&#]*)" }]);
  // the answer says nothing about the next page, and the number counts up by one
  const plain = (p: number) => ({ items: [{ id: `i${p}`, stars: 2 }], page: p });
  const [numbered] = pagingHints([ex(`${API}/items?q=tea&p=1`, plain(1)), ex(`${API}/items?q=tea&p=2`, plain(2))]);
  assert.deepEqual(numbered?.paging, { param: "p" });
});

test("no paging: another item linked from the first, two places changed, or a value found only by chance", () => {
  const item = (id: string, related: string[]) => ({ item: { id, related: related.map((r) => ({ id: r })) } });
  assert.deepEqual(
    pagingHints([
      ex(`${API}/item?id=kettle-red`, item("kettle-red", ["teapot-blue"])),
      ex(`${API}/item?id=teapot-blue`, item("teapot-blue", [])),
    ]),
    [],
  );
  assert.deepEqual(
    pagingHints([
      ex(`${API}/reviews?first=3&after=&_=1`, connection(0, "cur3xyz")),
      ex(`${API}/reviews?first=3&after=cur3xyz&_=2`, connection(3, null)),
    ]),
    [],
  );
  // "7" is in page 1's answer, as a count: no cursor, and 3 -> 7 is no next page number
  assert.deepEqual(
    pagingHints([
      ex(`${API}/s?q=tea&from=3`, { total: 7, hits: [] }),
      ex(`${API}/s?q=tea&from=7`, { total: 7, hits: [] }),
    ]),
    [],
  );
});

test("a cursor read with path~regex: nextPage is group 1, and null or no URL there is the last page", () => {
  const site = parseSite({
    name: "crates",
    baseUrl: "https://crates.example.com",
    operations: [
      {
        name: "search",
        request: { method: "GET", url: "https://crates.example.com/api/crates?page=2&q=x", headers: {} },
        slots: [
          { param: "q", at: ["query:q"] },
          { param: "page", at: ["query:page"] },
        ],
        trigger: { url: "https://crates.example.com/search?q={q}" },
        match: { path: "/api/crates" },
        response: { extract: "crates" },
        params: [{ name: "q" }, { name: "page", required: false }],
        paging: { param: "page", next: "meta.next_page~[?&]page=([^&#]*)" },
        readOnly: true,
      },
    ],
  });
  const op = site.operations[0]!;
  const answer = (next: unknown) => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ crates: [{ id: "a" }], meta: { next_page: next } }),
  });
  const r = judge(op, answer("?per_page=10&page=3&q=x"));
  assert.deepEqual([r.class, r.data, r.nextPage, r.hasMore], ["ok", [{ id: "a" }], "3", true]);
  assert.deepEqual([judge(op, answer(null)).hasMore, judge(op, answer(null)).nextPage], [false, undefined]);
  // a URL without the param says nothing: a moved param must not read as the last page
  assert.deepEqual([judge(op, answer("?q=x")).hasMore, judge(op, answer("?q=x")).nextPage], [undefined, undefined]);
});

test("a short page value gets a stand-in at the place paging found, and the op gets each run's own value back", () => {
  const page = (p: number) => ({ crates: [{ id: `c${p}` }], meta: { next_page: `?page=${p + 1}&q=x` } });
  const run = (q: string) => ({
    exchanges: [ex(`${API}/crates?page=1&q=${q}`, page(1)), ex(`${API}/crates?page=2&q=${q}`, page(2))],
  });
  const [r1, r2] = [run("serde"), run("tokio")];
  const id = r1.exchanges[1]!.id;
  const paging = { param: "page", next: "meta.next_page~[?&]page=([^&#]*)" };
  const s = standIn(
    paging,
    [
      { q: "serde", page: "2" },
      { q: "tokio", page: "2" },
    ],
    { capture: r1, id },
    r2,
  );
  assert.ok(s);
  assert.deepEqual(s.examples, [
    { q: "serde", page: "pagingstandin1" },
    { q: "tokio", page: "pagingstandin2" },
  ]);
  assert.equal(s.from.capture.exchanges[1]!.request.url, `${API}/crates?page=pagingstandin1&q=serde`);
  assert.equal(s.from2?.exchanges[1]?.request.url, `${API}/crates?page=pagingstandin2&q=tokio`);
  // the captures themselves are untouched
  assert.equal(r1.exchanges[1]!.request.url, `${API}/crates?page=2&q=serde`);
  const learned = {
    request: { method: "GET", url: `${API}/crates?page=pagingstandin1&q=serde`, headers: {} },
    slots: [{ param: "page", at: ["query:page"] }],
  } as unknown as Parameters<NonNullable<typeof s>["restore"]>[0];
  assert.equal(s.restore(learned).request.url, `${API}/crates?page=2&q=serde`);
  // a long value is located as it is, and numbered pages keep their example: no stand-in
  assert.equal(standIn(paging, [{ q: "serde", page: "abcd" }], { capture: r1, id }, undefined), undefined);
  assert.equal(standIn({ param: "page" }, [{ q: "serde", page: "2" }], { capture: r1, id }, undefined), undefined);
});
