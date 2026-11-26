/**
 * Answers that arrive as server-sent events (text/event-stream): the decoding, the classifier, and
 * learning and calling such an op at every tier against the fixture's /live/* pages.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { browserAvailable, closeBrowser } from "../src/browser.js";
import { classify, judge } from "../src/classify.js";
import { call } from "../src/execute.js";
import { capOutput, extract, inferShape, parseBody, pick } from "../src/extract.js";
import { addOperation, capturePage } from "../src/heal.js";
import { outline } from "../src/outline.js";
import { loadSession } from "../src/session.js";
import { type Operation, OperationSchema, type Site } from "../src/spec.js";
import { looksLikeEventStream, parseEventStream, STREAM_IDLE_MS, STREAM_MAX_MS } from "../src/stream.js";
import { vetShared } from "../src/vet.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-stream-"));
process.env.API_ANYTHING_HOME = HOME;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src", "cli.ts");
const fast = { minIntervalMs: 0 };
const noChrome = !browserAvailable() && "no Chromium browser installed";

describe("parseEventStream follows the WHATWG event-stream rules", () => {
  test("fields, comments, retry and unknown fields; the event name defaults to message", () => {
    const text = ': a comment\nretry: 3000\nfoo: bar\nevent: result\ndata: {"a":1}\n\ndata: plain text\n\n';
    assert.deepEqual(parseEventStream(text), [
      { event: "result", data: { a: 1 } },
      { event: "message", data: "plain text" },
    ]);
  });

  test("CRLF, LF and CR all end a line, and one leading space of a value is dropped", () => {
    assert.deepEqual(parseEventStream("data:  two spaces\r\n\r\ndata:none\r\rdata: x\n\n"), [
      { event: "message", data: " two spaces" },
      { event: "message", data: "none" },
      { event: "message", data: "x" },
    ]);
  });

  test("data lines join with a line feed, JSON across them included; a bare `data` line is an empty one", () => {
    assert.deepEqual(parseEventStream('data: {"items":\ndata: [1,2]}\n\ndata: a\ndata\ndata: b\n\n'), [
      { event: "message", data: { items: [1, 2] } },
      { event: "message", data: "a\n\nb" },
    ]);
  });

  test("an id carries over to later events; one holding a NUL is ignored, and an empty one clears it", () => {
    assert.deepEqual(parseEventStream("id: 7\ndata: a\n\ndata: b\n\nid: x\0y\ndata: c\n\nid\ndata: d\n\n"), [
      { event: "message", id: "7", data: "a" },
      { event: "message", id: "7", data: "b" },
      { event: "message", id: "7", data: "c" },
      { event: "message", data: "d" },
    ]);
  });

  test("an event with no data is not dispatched, and its name does not leak into the next", () => {
    assert.deepEqual(parseEventStream("event: ping\n\ndata: x\n\n"), [{ event: "message", data: "x" }]);
  });

  test("an event still arriving when the text ends is dropped; a BOM at the start is not a field", () => {
    assert.deepEqual(parseEventStream("\uFEFFdata: whole\n\ndata: half"), [{ event: "message", data: "whole" }]);
    assert.deepEqual(parseEventStream("data: no blank line yet\n"), []);
  });

  test("only an object or an array is parsed: other text keeps one type, numbers and [DONE] too", () => {
    assert.deepEqual(
      parseEventStream("data: 12\n\ndata: [DONE]\n\ndata: {not json\n\ndata: true\n\n").map((e) => e.data),
      ["12", "[DONE]", "{not json", "true"],
    );
  });

  test("big integers keep their digits, as in any JSON answer", () => {
    assert.deepEqual(parseEventStream('data: {"id":1850000000000000001}\n\n')[0]!.data, { id: "1850000000000000001" });
  });
});

const STREAM =
  ': hello\r\nretry: 1000\r\n\r\nevent: result\nid: 1\ndata: {"items":[{"name":"alpha one","rank":1},\ndata: {"name":"alpha two","rank":2}]}\n\nevent: done\nid: 2\ndata: [DONE]\n\n';
const EVENTS = [
  {
    event: "result",
    id: "1",
    data: {
      items: [
        { name: "alpha one", rank: 1 },
        { name: "alpha two", rank: 2 },
      ],
    },
  },
  { event: "done", id: "2", data: "[DONE]" },
];

describe("an event stream is read like any JSON answer", () => {
  test("parseBody decodes it; extract, pick, the output cap, the shape and the outline need nothing of their own", () => {
    assert.deepEqual(parseBody(STREAM), EVENTS);
    const recipe = { format: "json" as const, extract: "[*].data.items", pick: ["name"] };
    assert.deepEqual(extract(recipe, STREAM), [{ name: "alpha one" }, { name: "alpha two" }]);
    assert.deepEqual(pick(parseBody(STREAM), ["event"]), [{ event: "result" }, { event: "done" }]);
    const capped = capOutput(parseBody(STREAM), 60);
    assert.match(capped.truncated ?? "", /showing 0 of 2 items|showing 1 of 2 items/);
    assert.equal(inferShape(parseBody(STREAM))["[].data.items[].name"], "string");
    const o = outline("text/event-stream", STREAM, ["alpha one"]);
    assert.ok(JSON.stringify(o).includes("items"), JSON.stringify(o));
  });

  test("a line of text that only opens like a stream field is not one", () => {
    // no line break: a data: URL, a one-line error
    for (const body of ["data:image/png;base64,iVBORw0KGgo=", "id: 5 not found", ":(", "retry", "event"])
      assert.equal(looksLikeEventStream(body), false, body);
    for (const body of [": ping\n\n", 'data: {"a":1}\n\n', "event: tick\r\ndata: 1\r\n\r\n", "data\n\n"])
      assert.equal(looksLikeEventStream(body), true, JSON.stringify(body));
    // a read that expects JSON and gets such a line is what it was before streams were read: not an empty list
    const o = OperationSchema.parse({
      name: "list",
      request: { method: "GET", url: "https://s.test/api/list", headers: {} },
      slots: [],
      params: [],
      trigger: { url: "https://s.test/list" },
      response: { format: "json", extract: "[*]" },
      readOnly: true,
    });
    const answered = (body: string) =>
      classify(o, { status: 200, headers: { "content-type": "text/plain" }, body }).class;
    assert.equal(answered("id: 5 not found"), "drift");
    assert.equal(answered("data:text/plain;base64,aGk="), "drift");
  });

  test("a JSON body is never taken for a stream", () => {
    assert.deepEqual(parseBody('{"data":"x"}'), { data: "x" });
    assert.deepEqual(parseBody('["event: x"]'), ["event: x"]);
  });
});

describe("the content type decides whether a body is a stream, wherever there is one", () => {
  const read = (response: Record<string, unknown>) =>
    OperationSchema.parse({
      name: "list",
      request: { method: "GET", url: "https://s.test/api/list", headers: {} },
      slots: [],
      params: [],
      trigger: { url: "https://s.test/list" },
      response: { format: "json", ...response },
      readOnly: true,
    });

  test("text/event-stream is a stream whatever its first line, and one that ended with no bytes is an empty list", () => {
    const body = "extension: v\ndata: hello\n\n";
    assert.equal(looksLikeEventStream(body), false, "the syntax alone would not say so");
    assert.deepEqual(parseBody(body, undefined, "text/event-stream"), [{ event: "message", data: "hello" }]);
    const j = judge(read({}), { status: 200, headers: sse, body });
    assert.equal(j.class, "ok", j.reason);
    assert.deepEqual(j.data, [{ event: "message", data: "hello" }]);
    assert.deepEqual(parseBody("", undefined, "text/event-stream; charset=utf-8"), []);
    const ended = judge(op(), answer(""));
    assert.deepEqual([ended.class, ended.reason], ["ok", "no results"]);
    // a capture's exchange: its outline reads the events too
    assert.ok(JSON.stringify(outline("text/event-stream", body, [])).includes("data"));
  });

  test("any other content type is never a stream: plain text that opens like a field is not JSON", () => {
    for (const body of ["data: temporarily unavailable\n", ": maintenance\n", "id: 5 not found\n"]) {
      assert.throws(() => parseBody(body, undefined, "text/plain"), body);
      for (const o of [read({}), read({ extract: "[*]" })]) {
        const c = classify(o, { status: 200, headers: { "content-type": "text/plain" }, body });
        assert.equal(c.class, "drift", `${JSON.stringify(body)}: ${c.reason}`);
        assert.match(c.reason, /not JSON/);
      }
      assert.equal(outline("text/plain", body, []), undefined, body);
    }
  });

  test("only a body that comes with no content type at all is judged by its syntax", () => {
    assert.deepEqual(parseBody(STREAM), EVENTS);
    assert.deepEqual(parseBody(STREAM, undefined, ""), EVENTS);
    assert.equal(classify(read({ extract: "[*]" }), { status: 200, headers: {}, body: STREAM }).class, "ok");
  });
});

const op = (over: Record<string, unknown> = {}): Operation =>
  OperationSchema.parse({
    name: "search",
    readOnly: true,
    trigger: { url: "http://127.0.0.1:1/live/fetch?q={q}" },
    request: { method: "GET", url: "http://127.0.0.1:1/api/live/stream?q=alpha", headers: {} },
    slots: [{ param: "q", at: ["query:q"] }],
    params: [{ name: "q", example: "alpha" }],
    response: {
      format: "json",
      contentType: "text/event-stream",
      extract: "[*].data.items",
      pick: ["name", "rank"],
      shape: inferShape(EVENTS, 200, true),
    },
    ...over,
  });
const sse = { "content-type": "text/event-stream" };
const answer = (body: string, extra: Record<string, unknown> = {}) => ({ status: 200, headers: sse, body, ...extra });

describe("the classifier judges the decoded events", () => {
  test("the finite stream is ok, with the recipe's data", () => {
    const j = judge(op(), answer(STREAM));
    assert.equal(j.class, "ok", j.reason);
    assert.deepEqual(j.data, [
      { name: "alpha one", rank: 1 },
      { name: "alpha two", rank: 2 },
    ]);
  });

  test("a renamed field is drift, as in a JSON answer", () => {
    const renamed = STREAM.replaceAll('"items"', '"results"');
    assert.equal(classify(op(), answer(renamed)).class, "drift");
    const json = JSON.stringify(parseBody(renamed));
    assert.equal(classify(op(), { status: 200, headers: {}, body: json }).class, "drift");
  });

  test("an empty stream is what an empty JSON list is", () => {
    const empty = classify(op(), answer(": nothing to say\n\n"));
    assert.deepEqual(
      [empty.class, empty.reason],
      [classify(op(), { status: 200, headers: {}, body: "[]" }).class, "no results"],
    );
  });

  test("an error event is error, never drift; its words can make it rate or auth", () => {
    const failed = classify(op(), answer(`event: error\ndata: {"message":"the answer could not be made"}\n\n`));
    assert.equal(failed.class, "error", failed.reason);
    assert.match(failed.reason, /error event.*could not be made/);
    // next to data, it is still the stream's failure
    assert.equal(classify(op(), answer(`${STREAM}event: error\ndata: boom\n\n`)).class, "error");
    assert.equal(classify(op(), answer("event: error\ndata: rate limit exceeded\n\n")).class, "rate");
    assert.equal(classify(op(), answer("event: error\ndata: please log in to continue\n\n")).class, "auth");
  });

  test("a rate limit or a challenge answered instead of the stream gets its class", () => {
    assert.equal(classify(op(), { status: 429, headers: {}, body: '{"message":"Too many requests"}' }).class, "rate");
    const wall =
      '<!doctype html><html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget"></div></body></html>';
    assert.equal(
      classify(op(), { status: 403, headers: { "content-type": "text/html" }, body: wall }).class,
      "blocked",
    );
  });

  test("a cut stream with data is ok and says it was cut; one cut before any event, or before the data, is error", () => {
    const truncated = "the event stream was still open after 10 s, so it was read no further";
    const j = judge(op(), answer(`${STREAM}data: {"tick":`, { truncated }));
    assert.equal(j.class, "ok", j.reason);
    assert.equal(j.truncated, truncated);
    const none = classify(op(), answer(": ping\n\n", { truncated }));
    assert.equal(none.class, "error", none.reason);
    assert.match(none.reason, /no event/);
    const later = classify(op(), answer('data: {"progress":1}\n\n', { truncated }));
    assert.equal(later.class, "error", later.reason);
    assert.match(later.reason, /may come later/);
  });
});

/** What `api-anything` prints, run from source. */
function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", CLI, ...args],
      { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    ),
  );
}

const specFile = (site: string) => join(HOME, "sites", `${site}.json`);
const readSite = (site: string): Site => JSON.parse(readFileSync(specFile(site), "utf8"));
const writeSite = (s: Site) => {
  mkdirSync(join(HOME, "sites"), { recursive: true });
  writeFileSync(specFile(s.name), JSON.stringify(s));
};
/** Put one op of a site in place, the others kept. */
function putOp(site: string, o: Operation): void {
  const s = readSite(site);
  writeSite({ ...s, operations: [...s.operations.filter((x) => x.name !== o.name), o] });
}
const items = (word: string) => [
  { name: `${word} one`, rank: 1 },
  { name: `${word} two`, rank: 2 },
];
const recipe = { extract: "[*].data.items", pick: ["name", "rank"] };

describe("against the fixture", () => {
  let fx: Fixture;
  before(async () => {
    fx = await startFixture();
  });
  after(async () => {
    await closeBrowser();
    await fx.close();
    rmSync(HOME, { recursive: true, force: true });
  });

  describe("tier 1, no browser", () => {
    const SITE = "plainlive";
    const plain = (name: string, mode: string, response: Record<string, unknown> = { format: "json", ...recipe }) =>
      OperationSchema.parse({
        name,
        readOnly: true,
        trigger: { url: `${fx.url}/live/fetch?q={q}` },
        match: { method: "GET", path: "/api/live/plain" },
        request: { method: "GET", url: `${fx.url}/api/live/plain?mode=${mode}&q=alpha`, headers: {} },
        slots: [{ param: "q", at: ["query:q"] }],
        params: [{ name: "q", example: "alpha" }],
        response,
      });
    before(() =>
      writeSite({
        name: SITE,
        baseUrl: fx.url,
        operations: [
          plain("finite", "stream"),
          plain("forever", "forever", { format: "json", extract: "[*].data" }),
          plain("idle", "idle"),
          plain("failing", "error"),
          plain("empty", "empty"),
          plain("limited", "rate"),
          plain("walled", "challenge"),
        ],
      }),
    );
    const one = { ...fast, maxTier: 1 as const };

    test("a finite stream is read to its end", async () => {
      const r = await call(SITE, "finite", { q: "delta" }, one);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual(r.data, items("delta"));
      assert.equal(r.truncated, undefined);
    });

    test("a stream that never ends answers within its bound, marked cut, with what arrived", async () => {
      const t0 = Date.now();
      const r = await call(SITE, "forever", { q: "echo" }, one);
      const took = Date.now() - t0;
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.ok((r.data as unknown[]).length > 10, JSON.stringify(r.data).slice(0, 200));
      assert.deepEqual((r.data as unknown[])[0], { tick: 0, q: "echo" });
      assert.match(r.truncated ?? "", /still open after \d+(\.\d)? s/);
      assert.ok(took >= STREAM_MAX_MS - 1000 && took < STREAM_MAX_MS + 5000, `took ${took} ms`);
    });

    test("a stream that goes idle after two events ends at the idle bound; heartbeats do not hold it", async () => {
      const t0 = Date.now();
      const r = await call(SITE, "idle", { q: "fox" }, one);
      const took = Date.now() - t0;
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual(r.data, items("fox"));
      assert.match(r.truncated ?? "", /no event for 3 s/);
      assert.ok(took < STREAM_IDLE_MS + 4000, `took ${took} ms`);
    });

    test("an error event, a rate limit, a challenge and an empty stream each get their class", async () => {
      // each call past the cool-down the one before it starts
      const past = { ...one, ignoreCoolDown: true };
      const failed = await call(SITE, "failing", { q: "golf" }, past);
      assert.equal(failed.class, "error", JSON.stringify(failed));
      assert.equal(failed.healed, undefined);
      assert.equal((await call(SITE, "limited", { q: "golf" }, past)).class, "rate");
      assert.equal((await call(SITE, "walled", { q: "golf" }, past)).class, "blocked");
      const empty = await call(SITE, "empty", { q: "golf" }, past);
      assert.equal(empty.ok, true, JSON.stringify(empty));
      assert.deepEqual(empty.data, []);
    });
  });

  describe("learned and called at every tier", { skip: noChrome }, () => {
    const SITE = "live";
    let search: Operation;

    test("add learns the fetch-read stream, with no credential in the spec, and tier 1 calls it", async () => {
      const r = await addOperation({
        site: SITE,
        op: "search",
        trigger: { url: `${fx.url}/live/fetch?q={q}` },
        examples: [{ q: "alpha" }, { q: "bravo" }],
        response: recipe,
      });
      search = r.operation;
      assert.equal(search.request.url.split("?")[0], `${fx.url}/api/live/stream`, r.warnings.join("\n"));
      assert.match(search.response.contentType ?? "", /text\/event-stream/);
      assert.ok(search.slots.some((s) => s.ref === "cookie:ct0"));
      const ct0 = loadSession(SITE).cookies.find((c) => c.name === "ct0");
      assert.ok(ct0);
      assert.ok(!readFileSync(specFile(SITE), "utf8").includes(ct0.value), "the spec never holds a credential");
      const res = await call(SITE, "search", { q: "carol" }, fast);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(res.tier, 1);
      assert.deepEqual(res.data, items("carol"));
    });

    test("tier 2's page fetch and tier 3's trigger run answer it too", async () => {
      for (const tier of [2, 3] as const) {
        putOp(SITE, { ...search, minTier: tier });
        const res = await call(SITE, "search", { q: `tier${tier}` }, fast);
        assert.equal(res.ok, true, JSON.stringify(res));
        assert.equal(res.tier, tier);
        assert.deepEqual(res.data, items(`tier${tier}`));
      }
      putOp(SITE, search);
    });

    test("an EventSource's stream is captured, learned and called", async () => {
      const r = await addOperation({
        site: SITE,
        op: "searchEs",
        trigger: { url: `${fx.url}/live/es?q={q}` },
        examples: [{ q: "alpha" }, { q: "bravo" }],
        response: recipe,
      });
      assert.equal(r.operation.request.url.split("?")[0], `${fx.url}/api/live/es`, r.warnings.join("\n"));
      assert.ok(r.operation.slots.some((s) => s.ref === "cookie:ct0" && s.at[0] === "query:t"));
      for (const tier of [1, 3] as const) {
        putOp(SITE, { ...r.operation, minTier: tier });
        const res = await call(SITE, "searchEs", { q: `es${tier}` }, fast);
        assert.equal(res.ok, true, JSON.stringify(res));
        assert.equal(res.tier, tier);
        assert.deepEqual(res.data, items(`es${tier}`));
      }
    });

    test("capture keeps the stream's body, and inspect reads it with a recipe and as an outline", async () => {
      const c = await capturePage({ url: `${fx.url}/live/fetch?q=alpha` });
      const e = c.exchanges.find((x) => x.request.url.includes("/api/live/stream"));
      if (!e?.response) throw new Error(`no stream captured: ${c.exchanges.map((x) => x.request.url).join(", ")}`);
      assert.ok(e.response.body?.includes("alpha one"), JSON.stringify(e.response));
      assert.equal(e.response.truncated, undefined);
      const read = await cli("inspect", c.id, String(e.id), "--extract", "[*].data.items", "--pick", "name");
      assert.equal(read.code, 0, read.stderr);
      assert.deepEqual(JSON.parse(read.stdout).data, [{ name: "alpha one" }, { name: "alpha two" }]);
      const o = await cli("inspect", c.id, String(e.id), "--outline", "--example", "q=alpha one");
      assert.equal(o.code, 0, o.stderr);
      assert.match(o.stdout, /items/);
    });

    test("a capture of a page whose stream never ends, or goes idle, finishes within the bound, marked cut", async () => {
      for (const [page, cut] of [
        ["forever", /still open after/],
        ["idle", /no event for 3 s/],
      ] as const) {
        const t0 = Date.now();
        const c = await capturePage({ url: `${fx.url}/live/${page}?q=alpha` });
        const took = Date.now() - t0;
        const e = c.exchanges.find((x) => x.request.url.includes(`/api/live/${page}`));
        assert.match(e?.response?.truncated ?? "", cut, JSON.stringify(e?.response));
        assert.ok((parseBody(e!.response!.body ?? "") as unknown[]).length >= 2);
        assert.ok(took < STREAM_MAX_MS + 10_000, `${page}: took ${took} ms`);
      }
    });

    test("an endless stream at tiers 2 and 3 answers within its bound, marked cut, with data", async () => {
      const forever: Operation = {
        ...search,
        name: "forever",
        trigger: { url: `${fx.url}/live/forever?q={q}` },
        request: { ...search.request, url: search.request.url.replace("/api/live/stream", "/api/live/forever") },
        match: { ...search.match, path: "/api/live/forever" },
        response: { format: "json", extract: "[*].data" },
      };
      for (const tier of [2, 3] as const) {
        putOp(SITE, { ...forever, minTier: tier });
        const t0 = Date.now();
        const res = await call(SITE, "forever", { q: `hotel${tier}` }, fast);
        const took = Date.now() - t0;
        assert.equal(res.ok, true, JSON.stringify(res).slice(0, 500));
        assert.equal(res.tier, tier);
        assert.deepEqual((res.data as unknown[])[0], { tick: 0, q: `hotel${tier}` });
        assert.match(res.truncated ?? "", /still open after|browser run ended/);
        assert.ok(took < STREAM_MAX_MS + 15_000, `tier ${tier}: took ${took} ms`);
      }
    });

    test("vetShared says of a stream op what it says of the same request answered as JSON", () => {
      const shared = (o: Operation): Site => ({ name: "live", baseUrl: "https://live.example", operations: [o] });
      const pub = { ...search, request: { ...search.request, url: "https://live.example/api/live/stream?q=alpha" } };
      const json = { ...pub, response: { ...pub.response, contentType: "application/json" } };
      assert.deepEqual(vetShared(shared(pub)), vetShared(shared(json)));
    });

    test("a streamed POST is judged as a plain POST: stopped unless --write or pinned, and a write stays a write", async () => {
      const learn = (path: string, o: { write?: boolean; match?: boolean } = {}) =>
        addOperation({
          site: SITE,
          op: `${path.replace("-", "_")}${o.write ? "_w" : o.match ? "_m" : ""}`,
          trigger: { url: `${fx.url}/live/${path}?q={q}`, steps: [{ action: "click", selector: "#ask" }] },
          examples: [{ q: "alpha" }, { q: "bravo" }],
          ...(o.write ? { write: true } : {}),
          ...(o.match ? { match: { method: "POST", path: `/api/live/${path}` } } : {}),
        });
      const said = async (p: Promise<unknown>) => {
        try {
          await p;
          return "learned";
        } catch (e) {
          return (e as Error).message.replaceAll("ask-plain", "ask").replaceAll("ask_plain", "ask");
        }
      };
      const sent = () => fx.calls.filter((c) => c.method === "POST" && c.path.startsWith("/api/live/ask")).length;
      const before = sent();
      assert.equal(await said(learn("ask")), await said(learn("ask-plain")));
      assert.match(await said(learn("ask")), /stopped in the browser/);
      assert.equal(sent(), before, "nothing was sent while learning");

      const [w, wp] = [await learn("ask", { write: true }), await learn("ask-plain", { write: true })];
      assert.equal(sent(), before, "a write is never sent to learn it");
      assert.deepEqual(
        [w.operation.readOnly, w.operation.minTier, w.operation.slots.map((s) => s.ref ?? s.param)],
        [wp.operation.readOnly, wp.operation.minTier, wp.operation.slots.map((s) => s.ref ?? s.param)],
      );
      assert.equal(w.operation.readOnly, false);
      const refused = await call(SITE, w.operation.name, { q: "x" }, fast);
      const refusedPlain = await call(SITE, wp.operation.name, { q: "x" }, fast);
      assert.deepEqual([refused.class, refusedPlain.class], ["refused", "refused"]);
      assert.equal(sent(), before);

      // pinned with --match, both are sent on each learning run and saved as reads
      const [m, mp] = [await learn("ask", { match: true }), await learn("ask-plain", { match: true })];
      assert.deepEqual([m.operation.readOnly, mp.operation.readOnly], [true, true]);
      const read = await call(SITE, m.operation.name, { q: "india" }, fast);
      assert.equal(read.ok, true, JSON.stringify(read));
      assert.ok(JSON.stringify(read.data).includes("asked india"), JSON.stringify(read.data));
    });

    test("after the stream's field is renamed the call is drift, and heals by recapture", async () => {
      putOp(SITE, search);
      fx.moveStream();
      const res = await call(SITE, "search", { q: "juliet" }, fast);
      assert.equal(res.ok, true, JSON.stringify(res));
      assert.equal(res.healed, true);
      assert.equal(res.heal?.strategy, "recapture");
      assert.deepEqual(res.data, items("juliet"));
      const healed = readSite(SITE).operations.find((o) => o.name === "search")!;
      assert.ok(
        healed.slots.some((s) => s.param === "q" && s.at[0] === "query:query"),
        JSON.stringify(healed.slots),
      );
      const again = await call(SITE, "search", { q: "kilo" }, fast);
      assert.equal(again.tier, 1, JSON.stringify(again));
      assert.deepEqual(again.data, items("kilo"));
    });
  });
});
