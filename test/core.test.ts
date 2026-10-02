import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OperationSchema, getPath, operationNameOf, replay, rescanOperation, type Operation, type ReplayTransport, type Request } from "../src/core.ts";

/** Every module `entry` reaches through relative imports, and every package or builtin they name. */
function importGraph(entry: string): { files: Set<string>; external: Set<string> } {
  const files = new Set<string>();
  const external = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    for (const m of source.matchAll(/^(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gm)) {
      if (m[1]!.startsWith("./")) visit(m[1]!.slice(2).replace(/\.js$/, ".ts"));
      else external.add(m[1]!);
    }
  };
  visit(entry);
  return { files, external };
}

test("the core entry reaches no file system, browser or session store", () => {
  const { files, external } = importGraph("core.ts");
  assert.deepEqual([...external].sort(), ["node-html-parser", "tldts", "zod"]);
  for (const f of ["browser.ts", "session.ts", "store.ts", "heal.ts", "execute.ts", "login.ts", "import.ts", "mcp.ts", "cli.ts"]) {
    assert.ok(!files.has(f), `core reaches ${f}`);
  }
});

const op = (over: Record<string, unknown> = {}): Operation =>
  OperationSchema.parse({
    name: "search",
    request: { method: "GET", url: "https://site.test/api/search?q=kittens", headers: { "x-csrf": "" } },
    slots: [
      { param: "q", at: ["query:q"] },
      { ref: "cookie:csrf", at: ["header:x-csrf"] },
    ],
    params: [{ name: "q" }],
    trigger: { url: "https://site.test/?q={q}" },
    response: { format: "json", extract: "results", pick: ["name"] },
    readOnly: true,
    ...over,
  });
const session = { cookies: [{ name: "csrf", value: "tok-123456", domain: "site.test", path: "/", expires: -1, httpOnly: false, secure: false }], values: {} };
const answer = (body: unknown, status = 200): ReplayTransport => async () => ({ status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("replay sends the filled request once and returns what the response held before pick", async () => {
  const sent: Request[] = [];
  const signal = new AbortController().signal;
  let passed: AbortSignal | undefined;
  const r = await replay(op(), { q: "puppies" }, session, {
    signal,
    transport: async (request, s) => {
      sent.push(request);
      passed = s;
      return { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ results: [{ name: "rex", age: 3 }], next: "page2" }) };
    },
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.url, "https://site.test/api/search?q=puppies");
  assert.equal(sent[0]!.headers["x-csrf"], "tok-123456");
  assert.equal(sent[0]!.headers.cookie, "csrf=tok-123456");
  assert.equal(passed, signal);
  assert.equal(r.class, "ok");
  assert.deepEqual(r.data, [{ name: "rex" }]);
  // the page marker and the dropped field are still there for the embedder's own completeness check
  assert.deepEqual(r.decoded, { results: [{ name: "rex", age: 3 }], next: "page2" });
});

test("replay never retries, heals or follows up: a failure is one send, classified", async () => {
  let sends = 0;
  const r = await replay(op(), { q: "puppies" }, session, { transport: async () => (sends++, { status: 404, headers: {}, body: "gone" }) });
  assert.equal(sends, 1);
  assert.equal(r.sent, true);
  assert.equal(r.status, 404);
  assert.notEqual(r.class, "ok");
  assert.equal(r.data, undefined);
  const missing = await replay(op(), { q: "puppies" }, session, { transport: answer({ other: 1 }) });
  assert.equal(missing.class, "drift");
  assert.equal(missing.missing, true);
  const thrown = await replay(op(), { q: "puppies" }, session, { transport: async () => { throw new Error("socket hang up"); } });
  assert.deepEqual([thrown.class, thrown.sent, thrown.reason], ["error", true, "socket hang up"]);
});

test("replay sends nothing for a write, bad args or an aborted signal", async () => {
  let sends = 0;
  const transport: ReplayTransport = async () => (sends++, { status: 200, headers: {}, body: "{}" });
  const write = await replay(op({ readOnly: false }), { q: "x" }, session, { transport });
  assert.equal(write.class, "refused");
  assert.equal((await replay(op(), {}, session, { transport })).class, "input");
  assert.equal((await replay(op(), { q: "x", typo: 1 }, session, { transport })).class, "input");
  assert.equal((await replay(op(), { q: "x" }, session, { transport, signal: AbortSignal.abort() })).class, "error");
  assert.equal(sends, 0);
});

test("rescanOperation swaps a rotated id using only the caller's fetch", async () => {
  const OLD = "Zx81kLmN0pQrStUv2wXyZ3";
  const NEW = "Ys92jKnM1qRsTuVw3xYzA4";
  const rotated = op({
    request: { method: "GET", url: `https://site.test/graphql/${OLD}/Search?q=kittens`, headers: { "user-agent": "UA" } },
    slots: [{ param: "q", at: ["query:q"] }],
    volatile: [{ at: ["path:1"], shape: { charset: "base64url", length: 22 }, anchor: "Search" }],
  });
  const asked: [string, Record<string, string>][] = [];
  const pages: Record<string, string> = {
    "https://site.test/?q=puppies": '<script src="/static/app.js"></script>',
    "https://site.test/static/app.js": `e.exports={queryId:"${NEW}",operationName:"Search"}`,
  };
  const healed = await rescanOperation(rotated, { q: "puppies" }, async (url, headers) => (asked.push([url, headers]), { text: pages[url] ?? "", url }));
  assert.equal(healed?.operation.request.url, `https://site.test/graphql/${NEW}/Search?q=kittens`);
  assert.deepEqual(asked, [
    ["https://site.test/?q=puppies", { "user-agent": "UA" }],
    ["https://site.test/static/app.js", { "user-agent": "UA" }],
  ]);
});

test("the host reads paths and operation names the way a spec's extract and match do", () => {
  assert.deepEqual(getPath({ sections: [{ items: [1] }, { items: [2, 3] }] }, "sections[*].items"), [1, 2, 3]);
  assert.equal(getPath({ a: 1 }, "b.c"), undefined);
  assert.equal(operationNameOf({ method: "POST", url: "https://site.test/graphql", headers: {}, body: JSON.stringify({ operationName: "Search" }) }), "Search");
});
