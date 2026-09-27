import assert from "node:assert/strict";
import { test } from "node:test";
import { ResponseSchema } from "../src/spec.ts";
import { capOutput, extract, extractEmbedded, extractHtml, getPath, inferShape, parseBody, pick } from "../src/extract.ts";

test("parseBody strips XSSI and keeps big integers exact", () => {
  assert.deepEqual(parseBody(')]}\'\n{"id":2085462611575857621,"n":3}'), { id: "2085462611575857621", n: 3 });
  assert.deepEqual(parseBody("while(1);[1]", "while(1);"), [1]);
  assert.throws(() => parseBody("<html>"));
});

test("parseBody reads Google rt=c length-prefixed chunks", () => {
  const body = ')]}\'\n\n27\n[["wrb.fr",null,"[1,2]"]]\n12\n[["di",42]]\n';
  assert.deepEqual(parseBody(body), [[["wrb.fr", null, "[1,2]"]], [["di", 42]]]);
});

test("getPath: dots, brackets, index-only paths, dashed keys, quoted keys", () => {
  const o = { a: { "foo-bar": [{ c: 1 }] }, "x.y": 2, arr: [[0, [5, 6]]] };
  assert.equal(getPath(o, "a.foo-bar[0].c"), 1);
  assert.equal(getPath(o, '["x.y"]'), 2);
  assert.equal(getPath(o.arr, "[0][1][1]"), 6);
  assert.equal(getPath(o, "a.missing.c"), undefined);
  assert.equal(getPath("str", "length"), undefined);
});

test("getPath [*]: results split across sections (an ad section first) are all collected", () => {
  // YouTube with a visitor cookie: section 0 holds an ad, a shelf and one video, then an ad slot, then the main list
  const v = (id: string) => ({ videoRenderer: { videoId: id } });
  const page = { contents: [{ itemSectionRenderer: { contents: [{ searchPyvRenderer: {} }, { shelfRenderer: {} }, v("a")] } }, { adSlotRenderer: {} }, { itemSectionRenderer: { contents: [v("b"), v("c")] } }] };
  const path = "contents[*].itemSectionRenderer.contents";
  assert.equal((getPath(page, path) as unknown[]).length, 5);
  assert.deepEqual(extract({ format: "json", extract: path, pick: ["id=videoRenderer.videoId"] }, JSON.stringify(page)), [{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.deepEqual(getPath({ contents: [] }, path), [], "no sections: no results");
  assert.equal(getPath({ contents: [{ adSlotRenderer: {} }] }, path), undefined, "sections, none with the path: moved, not empty");
  assert.equal(getPath({ contents: {} }, path), undefined);
  assert.deepEqual(getPath({ a: [{ b: 1 }, { c: 2 }, { b: 3 }] }, "a[*].b"), [1, 3]);
});

test("pick projects per item and per object", () => {
  const items = [{ id: 1, user: { name: "a", bio: "long" }, x: 1 }, { id: 2, user: { name: "b" } }];
  assert.deepEqual(pick(items, ["id", "user.name"]), [{ id: 1, "user.name": "a" }, { id: 2, "user.name": "b" }]);
  assert.deepEqual(pick({ id: 1, y: 2 }, ["id", "nope"]), { id: 1 });
});

test("html recipe via selectors, text and @attr", () => {
  const html = `<table>
    <tr class="athing" id="1"><td><span class="titleline"><a href="https://a.example">First  story</a></span></td></tr>
    <tr class="athing" id="2"><td><span class="titleline"><a href="item?id=2">Second &amp; more</a></span></td></tr>
  </table>`;
  const rows = extractHtml(html, { items: "tr.athing", fields: { id: "@id", title: ".titleline > a", url: ".titleline > a@href", none: ".nope" } });
  assert.deepEqual(rows, [
    { id: "1", title: "First story", url: "https://a.example", none: undefined },
    { id: "2", title: "Second & more", url: "item?id=2", none: undefined },
  ]);
});

test("embedded regex: group 1 marks the JSON start, the scanner finds its end", () => {
  const doc = `<script>AF_initDataCallback({key: 'ds:1', hash: '2', data:[["United",[1,2]],"x]y"], sideChannel: {}});</script>`;
  assert.deepEqual(extractEmbedded(doc, "key: 'ds:1'.*?data:(\\[)"), [["United", [1, 2]], "x]y"]);
  assert.equal(extractEmbedded(doc, "key: 'ds:9'.*?data:(\\[)"), undefined);
  assert.deepEqual(
    extract({ format: "embedded", embedded: { regex: "data:(\\[)" }, extract: "[0][0]" }, doc),
    "United",
  );
});

test("extract: json + extract + pick; html without recipe returns the raw body", () => {
  const body = ')]}\'{"data":{"items":[{"id":1,"t":"a","junk":1}]}}';
  assert.deepEqual(extract({ format: "json", xssiPrefix: ")]}'", extract: "data.items", pick: ["id", "t"] }, body), [{ id: 1, t: "a" }]);
  assert.equal(extract({ format: "json", extract: "data.nope" }, body), undefined);
  assert.equal(extract({ format: "html" }, "<p>x</p>"), "<p>x</p>");
});

test("capOutput truncates arrays at item boundaries and notes it", () => {
  const big = Array.from({ length: 100 }, (_, i) => ({ i, pad: "x".repeat(50) }));
  const out = capOutput(big, 1000);
  assert.ok(Array.isArray(out.data));
  assert.ok(JSON.stringify(out.data).length <= 1000);
  assert.match(out.truncated!, /showing \d+ of 100 items/);
  assert.deepEqual(capOutput({ a: 1 }), { data: { a: 1 } });
  // an object stays an object, its long string shortened (edge EC-14)
  const s = capOutput({ s: "y".repeat(50) }, 20);
  assert.deepEqual(s.data, { s: "y".repeat(12) });
  assert.match(s.truncated!, /cut to 20/);
  assert.equal(capOutput("z".repeat(50), 20).data, "z".repeat(18));
});

test("inferShape records key paths and types, first array item only", () => {
  assert.deepEqual(inferShape({ data: { users: [{ id: "1", n: 2 }, { other: true }], ok: null } }), {
    data: "object",
    "data.users": "array",
    "data.users[]": "object",
    "data.users[].id": "string",
    "data.users[].n": "number",
    "data.ok": "null",
  });
});

test("getPath steps into JSON-encoded strings (batchexecute payloads)", () => {
  const body = [["wrb.fr", "search", JSON.stringify([[["a", 1], ["b", 2]]])]];
  assert.deepEqual(getPath(body, "[0][2][0][1]"), ["b", 2]);
  assert.equal(getPath(body, "[0][1][0]"), undefined, "a plain string is not indexed");
});

test("parseBody: Meta's for (;;); prefix, repeated before each chunk, gives an array", () => {
  assert.deepEqual(parseBody('for (;;);{"a":1}'), { a: 1 });
  assert.deepEqual(parseBody('for (;;);{"a":1}\nfor (;;);{"b":2}'), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(parseBody("while(1);[1,2]"), [1, 2]);
});

test("pick: name=path renames the output key", () => {
  assert.deepEqual(pick([{ node: { code: "A", caption: { text: "hi" } } }], ["code=node.code", "caption=node.caption.text", "node.code"]), [
    { code: "A", caption: "hi", "node.code": "A" },
  ]);
  assert.deepEqual(pick({ "[1][0][1]": 1 }, []), {});
  assert.deepEqual(pick([[["UA"], [0, 209]]], ["price=[1][1]"]), [{ price: 209 }]);
});

test("pick name=path~regex keeps group 1 (or the whole match) of a string; no match drops the field", () => {
  const items = [{ u: "https://www.linkedin.com/in/satyanadella?miniProfileUrn=x" }, { u: "https://www.linkedin.com/company/openai/" }, { u: 7 }];
  assert.deepEqual(pick(items, ["id=u~/in/([^/?]+)", "co=u~/company/([^/?]+)", "host=u~linkedin\\.com"]), [
    { id: "satyanadella", host: "linkedin.com" },
    { co: "openai", host: "linkedin.com" },
  ]);
  assert.deepEqual(pick({ a: { b: "v-12" } }, ["a.b~\\d+"]), { "a.b": "12" });
  assert.throws(() => ResponseSchema.parse({ pick: ["id=u~/in/(["] }), /regex after ~/);
});
