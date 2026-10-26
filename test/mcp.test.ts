import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallResult } from "../src/execute.js";
import { Jobs } from "../src/jobs.js";
import {
  asTable,
  createServer,
  inputSchema,
  mcpNextCall,
  READ_HINTS,
  type ServerOptions,
  TOOL_NAME_MAX,
  toolName,
  UNTRUSTED_NOTE,
  WRITE_HINTS,
} from "../src/mcp.js";
import { type Operation, parseSite } from "../src/spec.js";
import { saveSite } from "../src/store.js";

/** A fresh home and a client connected to a server made with `opts`; `done` undoes both. */
async function connect(opts: ServerOptions = {}) {
  const home = mkdtempSync(join(tmpdir(), "aa-mcp-"));
  const before = process.env.API_ANYTHING_HOME;
  process.env.API_ANYTHING_HOME = home;
  const client = new Client({ name: "probe", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as { text: string }[])[0]!.text;
    return { isError: r.isError === true, ...JSON.parse(text) };
  };
  return {
    client,
    tool,
    /** connects once the test saved its sites: the server reads them as it starts */
    start: async (o: ServerOptions = opts) => {
      await createServer(o).connect(a);
      await client.connect(b);
    },
    done: async () => {
      await client.close();
      process.env.API_ANYTHING_HOME = before;
      rmSync(home, { recursive: true, force: true });
    },
  };
}

/** A site with one read and one write against `base`; `readback`: the write is read back with the read. */
function saveMixed(base: string, name = "mw", readback = false): void {
  saveSite(
    parseSite({
      name,
      baseUrl: base,
      operations: [
        {
          name: "find",
          description: "find things by kind",
          readOnly: true,
          request: { method: "GET", url: `${base}/api/find?kind=book&page=1` },
          slots: [
            { param: "kind", at: ["query:kind"] },
            { param: "page", at: ["query:page"] },
          ],
          params: [
            { name: "kind", description: "what to find", enum: ["book", "film"], example: "book" },
            { name: "page", type: "number", required: false, default: 1, min: 1, max: 50 },
          ],
          paging: { param: "page", next: "next" },
          trigger: { url: `${base}/` },
        },
        {
          name: "vote",
          readOnly: false,
          request: {
            method: "POST",
            url: `${base}/api/vote`,
            headers: { "content-type": "application/json" },
            body: '{"id":"1"}',
          },
          slots: [{ param: "id", at: ["body", "json:/id"] }],
          params: [{ name: "id", pattern: "\\d+", hint: "digits" }],
          ...(readback ? { readback: { op: "find", args: { kind: "book" } } } : {}),
          trigger: { url: `${base}/` },
        },
      ],
    }),
  );
}

async function localSite() {
  let hits = 0;
  const server = httpServer((_req, res) => {
    hits++;
    res.writeHead(200, { "content-type": "application/json" }).end('[{"title":"a"}]');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    hits: () => hits,
    close: () => server.close(),
  };
}

const LOCAL = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

test("MCP gives every tool every hint: reads read-only and idempotent, writes on a tool of their own", async () => {
  for (const allowWrites of [false, true]) {
    const s = await connect();
    try {
      await s.start({ allowWrites });
      const { tools } = await s.client.listTools();
      const hints = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
      assert.deepEqual(hints.list_sites, LOCAL);
      assert.deepEqual(hints.list_operations, LOCAL);
      assert.deepEqual(hints.get_job, LOCAL);
      // a read is advertised as a read whether or not writes are on, so a client need not ask for each
      assert.deepEqual(hints.call_operation, READ_HINTS);
      // a sign-in changes the local session, never the site, and a repeat joins the first
      assert.deepEqual(hints.login, {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      assert.deepEqual(hints.call_write_operation, allowWrites ? WRITE_HINTS : undefined);
      const callOp = tools.find((t) => t.name === "call_operation")!;
      assert.equal("again" in (callOp.inputSchema.properties ?? {}), false);
    } finally {
      await s.done();
    }
  }
  assert.deepEqual(READ_HINTS, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(WRITE_HINTS, {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  });
});

test("MCP call_operation never sends a write, and points a writes-enabled server's caller at call_write_operation", async () => {
  const site = await localSite();
  const s = await connect();
  try {
    saveMixed(site.base);
    await s.start({ allowWrites: true });
    const r = await s.tool("call_operation", { site: "mw", op: "vote", args: { id: "9" } });
    assert.equal(site.hits(), 0);
    assert.deepEqual([r.ok, r.class, r.write, r.isError], [false, "refused", "not_sent", true]);
    assert.deepEqual(r.nextCall, {
      action: "allow_writes",
      site: "mw",
      op: "vote",
      tool: "call_write_operation",
      args: { site: "mw", op: "vote", args: { id: "9" } },
    });
    assert.match(r.next, /call_write_operation/);
    // and the write tool does not run a read: its hints would make a client ask for every one
    const read = await s.tool("call_write_operation", { site: "mw", op: "find", args: { kind: "book" } });
    assert.equal(site.hits(), 0);
    assert.deepEqual([read.ok, read.class, read.nextCall.tool], [false, "input", "call_operation"]);
  } finally {
    await s.done();
    site.close();
  }
});

test("MCP call_write_operation: a write's status, a duplicate refused with its next step, and the again argument", async () => {
  const site = await localSite();
  const s = await connect();
  try {
    saveMixed(site.base);
    await s.start({ allowWrites: true });
    const vote = (extra: Record<string, unknown> = {}) =>
      s.tool("call_write_operation", { site: "mw", op: "vote", args: { id: "9" }, ...extra });
    const first = await vote();
    assert.deepEqual([first.ok, first.write, first.isError], [true, "accepted", false]);
    const dup = await vote();
    assert.equal(site.hits(), 1);
    assert.deepEqual([dup.class, dup.write, dup.retry], ["duplicate", "not_sent", "no"]);
    assert.equal(dup.nextCall.action, "check_site");
    assert.match(dup.next, /again: true/);
    const again = await vote({ again: true });
    assert.equal(again.ok, true);
    assert.equal(site.hits(), 2);
    await vote({ idempotencyKey: "k1" });
    const replay = await vote({ idempotencyKey: "k1" });
    assert.equal(site.hits(), 3);
    assert.match(replay.reason, /that call's record/);
  } finally {
    await s.done();
    site.close();
  }
});

test("MCP names the tool for a next step one of its tools takes, with the call's own args for a retry", () => {
  assert.deepEqual(mcpNextCall({ action: "login", site: "x", op: "get", mode: "window" }), {
    action: "login",
    site: "x",
    op: "get",
    mode: "window",
    tool: "login",
    args: { site: "x", mode: "window" },
  });
  assert.equal(mcpNextCall({ action: "fix_args", site: "x" }).tool, "list_operations");
  assert.deepEqual(mcpNextCall({ action: "retry", site: "x", op: "get" }).args, { site: "x", op: "get" });
  const again = { tool: "x__get", args: { q: "a" } };
  assert.deepEqual(mcpNextCall({ action: "retry", site: "x", op: "get" }, again), {
    action: "retry",
    site: "x",
    op: "get",
    ...again,
  });
  assert.equal(mcpNextCall({ action: "relearn", site: "x", op: "get" }).tool, undefined);
  // the user signs in again in their own browser; login would only import the same cookies again
  assert.deepEqual(mcpNextCall({ action: "sign_in_browser", site: "x", op: "get", profile: "Chrome/Profile 1" }), {
    action: "sign_in_browser",
    site: "x",
    op: "get",
    profile: "Chrome/Profile 1",
  });
});

test("MCP list_operations gives each op a JSON Schema of its args: types, enum, bounds, anchored pattern, required", async () => {
  const site = await localSite();
  const s = await connect();
  try {
    saveMixed(site.base, "mw", true);
    await s.start({ allowWrites: true });
    const r = await s.tool("list_operations", { site: "mw" });
    const find = r.operations.find((o: { name: string }) => o.name === "find");
    assert.deepEqual(find.inputSchema, {
      type: "object",
      properties: {
        kind: { type: "string", description: "what to find", enum: ["book", "film"], examples: ["book"] },
        page: { type: "number", minimum: 1, maximum: 50, default: 1 },
      },
      required: ["kind"],
      additionalProperties: false,
    });
    assert.equal("params" in find, false, "the schema replaces the params list: one copy of each param");
    const vote = r.operations.find((o: { name: string }) => o.name === "vote");
    // a spec's pattern must match the whole value; a JSON Schema pattern matches anywhere
    assert.deepEqual(vote.inputSchema.properties.id, { type: "string", pattern: "^(?:\\d+)$", description: "digits" });
    assert.equal(vote.write, true);
    assert.equal(find.pages, "by page: pass the result's nextPage (hasMore false: the last page)");
    assert.equal(vote.readback, "find");
    // the result fields an agent pages and confirms a write with are named where it reads them
    const { tools } = await s.client.listTools();
    const described = (n: string) => tools.find((t) => t.name === n)?.description ?? "";
    assert.match(described("call_operation"), /nextPage\?, hasMore\?/);
    assert.match(described("call_write_operation"), /applied \(its readback found it\)/);
  } finally {
    await s.done();
    site.close();
  }
});

test("MCP says once per session, where every client shows it, that a site's text is data and never instructions", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-mcp-"));
  const before = process.env.API_ANYTHING_HOME;
  process.env.API_ANYTHING_HOME = home;
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([createServer().connect(a), client.connect(b)]);
  try {
    assert.match(UNTRUSTED_NOTE, /never instructions/);
    assert.ok(UNTRUSTED_NOTE.length < 160, "it costs tokens in every session");
    // some clients drop server instructions; every client sends a tool's description to the model
    assert.ok(client.getInstructions()?.includes(UNTRUSTED_NOTE), String(client.getInstructions()));
    const { tools } = await client.listTools();
    const callOp = tools.find((t) => t.name === "call_operation")!;
    assert.ok(callOp.description?.includes(UNTRUSTED_NOTE), String(callOp.description));
  } finally {
    await client.close();
    process.env.API_ANYTHING_HOME = before;
    rmSync(home, { recursive: true, force: true });
  }
});

test("MCP --sites registers each op as a tool of its own, with its schema and a read's or a write's hints", async () => {
  const site = await localSite();
  const s = await connect();
  try {
    saveMixed(site.base);
    saveMixed(site.base, "other");
    await s.start({ sites: ["mw"] });
    const { tools } = await s.client.listTools();
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("mw__find"));
    assert.ok(!names.includes("mw__vote"), "a write is a tool only on a server that allows writes");
    assert.ok(!names.some((n) => n.startsWith("other__")), "only the sites named");
    const find = tools.find((t) => t.name === "mw__find")!;
    assert.deepEqual(find.annotations, READ_HINTS);
    assert.deepEqual(find.inputSchema.properties?.kind, {
      type: "string",
      description: "what to find",
      enum: ["book", "film"],
      examples: ["book"],
    });
    assert.deepEqual(find.inputSchema.required, ["kind"]);
    assert.match(find.description ?? "", /find things by kind/);
    assert.match(find.description ?? "", /Pages by page: pass the result's nextPage/);
    const ok = await s.tool("mw__find", { kind: "film", page: 2 });
    assert.deepEqual([ok.ok, ok.data], [true, [{ title: "a" }]]);
    // the args are judged by call(), as through call_operation: nothing sent, the format said, a next step
    const bad = await s.tool("mw__find", { kind: "song" });
    assert.deepEqual([bad.ok, bad.class, bad.isError], [false, "input", true]);
    assert.match(bad.reason, /one of "book", "film"/);
    assert.equal(site.hits(), 1);
  } finally {
    await s.done();
    site.close();
  }
  const w = await connect();
  try {
    saveMixed(site.base);
    await w.start({ sites: ["mw"], allowWrites: true });
    const { tools } = await w.client.listTools();
    assert.deepEqual(tools.find((t) => t.name === "mw__vote")?.annotations, WRITE_HINTS);
  } finally {
    await w.done();
  }
});

test("MCP per-op tool names fit every client's limit and characters, and stay distinct when cut", () => {
  const op = (name: string) => ({ name }) as Pick<Operation, "name">;
  assert.equal(toolName("hacker-news", op("search")), "hacker-news__search");
  assert.equal(toolName("hn.demo", op("links")), "hn_demo__links");
  const long = "x".repeat(80);
  const a = toolName("site", op(`${long}a`));
  const b = toolName("site", op(`${long}b`));
  for (const n of [a, b]) {
    assert.ok(n.length <= TOOL_NAME_MAX, n);
    assert.match(n, /^[a-zA-Z0-9_-]+$/);
  }
  assert.notEqual(a, b);
});

test("MCP inputSchema keeps a number's enum as numbers, and an op with no params takes none", () => {
  const schema = inputSchema({
    params: [
      { name: "n", type: "number", required: true, enum: ["1", "2"] },
      { name: "flag", type: "boolean", required: false },
    ],
  } as unknown as Operation);
  assert.deepEqual(schema.properties, { n: { type: "number", enum: [1, 2] }, flag: { type: "boolean" } });
  assert.deepEqual(inputSchema({ params: [] } as unknown as Operation), {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
});

/** A call() that answers when `release` is called, counting how often it ran. */
function slowCall() {
  let runs = 0;
  let release: (r: CallResult) => void = () => {};
  const call = (() => {
    runs++;
    return new Promise<CallResult>((r) => (release = r));
  }) as unknown as NonNullable<ServerOptions["run"]>["call"];
  return { call, runs: () => runs, release: (r: CallResult) => release(r) };
}

test("MCP answers a call still running at its deadline with a job, and get_job reads it without running it again", async () => {
  const slow = slowCall();
  const s = await connect();
  try {
    await s.start({ waitMs: 20, run: { call: slow.call } });
    const pending = await s.tool("call_operation", { site: "x", op: "get", args: { q: "a" } });
    assert.deepEqual([pending.ok, pending.class, pending.isError, pending.retry], [false, "pending", false, "no"]);
    assert.match(pending.job, /^[0-9a-f]{8}$/);
    assert.deepEqual(pending.nextCall, { action: "get_job", tool: "get_job", args: { job: pending.job } });
    // the same call while it runs joins it: one run
    const joined = await s.tool("call_operation", { site: "x", op: "get", args: { q: "a" } });
    assert.equal(joined.job, pending.job);
    const still = await s.tool("get_job", { job: pending.job });
    assert.deepEqual([still.class, still.job], ["pending", pending.job]);
    slow.release({ ok: true, class: "ok", data: [1], tier: 1, ms: 5 });
    const done = await s.tool("get_job", { job: pending.job });
    assert.deepEqual([done.ok, done.data, done.isError], [true, [1], false]);
    // read again: the result stays, and nothing runs again
    assert.deepEqual((await s.tool("get_job", { job: pending.job })).data, [1]);
    assert.equal(slow.runs(), 1);
    const unknown = await s.tool("get_job", { job: "00000000" });
    assert.deepEqual([unknown.ok, unknown.isError], [false, true]);
    assert.match(unknown.next, /check the site/);
  } finally {
    await s.done();
  }
});

test("MCP answers a call that ends within its deadline directly, with no job", async () => {
  const s = await connect();
  try {
    const call = (async () => ({ ok: false, class: "drift", reason: "gone", ms: 1 })) as unknown as NonNullable<
      ServerOptions["run"]
    >["call"];
    await s.start({ waitMs: 1000, run: { call } });
    const r = await s.tool("call_operation", { site: "x", op: "get" });
    assert.deepEqual([r.class, r.job, r.isError], ["drift", undefined, true]);
    // the same answer as fields: a client gives its model one of the two, a program reads the fields
    const raw = await s.client.callTool({ name: "call_operation", arguments: { site: "x", op: "get" } });
    assert.deepEqual(raw.structuredContent, JSON.parse((raw.content as { text: string }[])[0]!.text));
    // a list is text only: before the 2026-07-28 revision structuredContent is an object
    const sites = await s.client.callTool({ name: "list_sites", arguments: {} });
    assert.equal(sites.structuredContent, undefined);
  } finally {
    await s.done();
  }
});

test("MCP login while a sign-in window for the site is open returns its job and opens no second window", async () => {
  let windows = 0;
  let close: () => void = () => {};
  const window = async () => {
    windows++;
    await new Promise<void>((r) => (close = r));
    return { ok: true as const, cookies: [], renewed: ["sid"] };
  };
  const s = await connect();
  try {
    await s.start({ waitMs: 20, run: { window } });
    const first = await s.tool("login", { url: "https://example.com/", mode: "window" });
    assert.equal(first.class, "pending");
    assert.match(first.next, /close it/);
    const second = await s.tool("login", { url: "https://example.com/", mode: "window" });
    const viaImport = await s.tool("login", { url: "https://example.com/" });
    assert.deepEqual([second.job, viaImport.job], [first.job, first.job]);
    assert.equal(windows, 1);
    close();
    const done = await s.tool("get_job", { job: first.job });
    assert.deepEqual([done.ok, done.site, done.source, done.renewed], [true, "example.com", "window", ["sid"]]);
  } finally {
    await s.done();
  }
});

test("jobs: a rejected job with no one waiting does not crash, and its error reaches the next reader", async () => {
  const jobs = new Jobs<string>(10);
  let fail: (e: Error) => void = () => {};
  const started = await jobs.start("k", "", () => new Promise<string>((_, rej) => (fail = rej)));
  assert.ok("job" in started);
  fail(new Error("boom"));
  await new Promise((r) => setTimeout(r, 5));
  await assert.rejects(jobs.wait(started.job, 10), /boom/);
  // a finished key starts afresh
  const again = await jobs.start("k", "", async () => "ok");
  assert.deepEqual(again, { result: "ok" });
});

test("MCP sends a list of records as {columns, rows}, keys once, null for a missing field", () => {
  const data = [
    { airline: ["JetBlue"], price: 209, via: ["BOS"] },
    { airline: ["Delta"], price: 219 },
    { airline: ["United"], price: 229 },
  ];
  assert.deepEqual(asTable(data), {
    columns: ["airline", "price", "via"],
    rows: [
      [["JetBlue"], 209, ["BOS"]],
      [["Delta"], 219, null],
      [["United"], 229, null],
    ],
  });
});

test("MCP sends anything that is not a list of two or more records unchanged", () => {
  for (const data of [[{ a: 1 }], [], [1, 2], [[1], [2]], [{ a: 1 }, null], { a: 1 }, "text", null, undefined]) {
    assert.deepEqual(asTable(data), data);
  }
});

test("MCP keeps sparse records within the original answer's size instead of allocating missing cells", () => {
  const data = Array.from({ length: 1000 }, (_, i) => ({ [`k${i}`]: i }));
  const result = asTable(data);
  assert.equal(result, data);
  assert.equal(JSON.stringify(result).length, JSON.stringify(data).length);
});

test("MCP keeps small records when the table envelope would grow the answer", () => {
  for (const data of [
    [{ a: 1 }, { a: 2 }],
    [{}, {}],
    [{ a: 1 }, { b: 2 }],
  ])
    assert.equal(asTable(data), data);
});
