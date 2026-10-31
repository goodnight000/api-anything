import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { type BatchItem, type BatchOptions, type BatchResult, callReads } from "../src/index.js";
import { createServer, READ_HINTS } from "../src/mcp.js";
import { parseSite } from "../src/spec.js";
import { coolDown, saveSite } from "../src/store.js";
import { type Fixture, startFixture } from "./fixture/server.js";

let home: string;
let previousHome: string | undefined;
let fx: Fixture;
beforeEach(async () => {
  previousHome = process.env.API_ANYTHING_HOME;
  home = mkdtempSync(join(tmpdir(), "aa-batch-"));
  process.env.API_ANYTHING_HOME = home;
  fx = await startFixture();
  seed("batch");
});
afterEach(async () => {
  await fx.close();
  if (previousHome === undefined) delete process.env.API_ANYTHING_HOME;
  else process.env.API_ANYTHING_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

function seed(name: string): void {
  saveSite(
    parseSite({
      name,
      baseUrl: fx.url,
      operations: [
        {
          name: "user",
          readOnly: true,
          request: { method: "GET", url: `${fx.url}/api/spa/user?name=alice` },
          slots: [{ param: "name", at: ["query:name"] }],
          params: [{ name: "name" }],
          trigger: { url: `${fx.url}/spa/{name}` },
        },
        {
          name: "limited",
          readOnly: true,
          request: { method: "GET", url: `${fx.url}/api/limited` },
          trigger: { url: fx.url },
        },
        {
          name: "write",
          readOnly: false,
          request: { method: "POST", url: `${fx.url}/api/spa/user` },
          trigger: { url: fx.url },
        },
        {
          name: "pages",
          readOnly: true,
          request: { method: "GET", url: `${fx.url}/api/spa/user?name=1` },
          slots: [{ param: "page", at: ["query:name"] }],
          params: [{ name: "page" }],
          paging: { param: "page", next: "next" },
          response: { extract: "items" },
          trigger: { url: fx.url },
        },
      ],
    }),
  );
}

const user = (name: string, site = "batch"): BatchItem => ({ site, op: "user", args: { name } });
async function collect(items: readonly BatchItem[], opts: BatchOptions = {}) {
  const results: BatchResult[] = [];
  for await (const r of callReads(items, { maxTier: 1, ...opts })) results.push(r);
  return results;
}

test("ordered results, caller ids, partial failures, no caching and normal pacing", async () => {
  const sent: number[] = [];
  const r = await collect(
    [
      { ...user("alice"), id: "first" },
      { site: "batch", op: "missing" },
      { ...user("alice"), id: 0 },
    ],
    {
      fetchImpl: async (...args) => {
        sent.push(Date.now());
        return fetch(...args);
      },
    },
  );
  assert.deepEqual(
    r.map((x) => [x.id, x.site, x.op, x.class]),
    [
      ["first", "batch", "user", "ok"],
      [2, "batch", "missing", "input"],
      [0, "batch", "user", "ok"],
    ],
  );
  assert.deepEqual(r[0]!.data, { name: "alice" });
  assert.deepEqual(r[2]!.data, r[0]!.data);
  assert.equal(r[1]!.retry, "after_fix");
  assert.equal(r[1]!.nextCall?.action, "fix_args");
  assert.ok(r[1]!.next);
  assert.equal(fx.calls.length, 2, "a repeat is sent again, not cached");
  assert.ok(sent[1]! - sent[0]! >= 650, "store.ts's >=700ms send slots still apply");
  assert.equal(
    r.some((x) => "args" in x),
    false,
  );
});

test("writes answer input even if a JS caller supplies allowWrites, and later reads run", async () => {
  const r = await collect([{ site: "batch", op: "write" }, user("after")], { allowWrites: true } as BatchOptions);
  assert.equal(r[0]!.class, "input");
  assert.equal(r[0]!.reason, "writes are not batched");
  assert.equal(r[0]!.write, "not_sent");
  assert.equal(r[1]!.ok, true);
  assert.deepEqual(
    fx.calls.map((x) => x.method),
    ["GET"],
  );
});

test("a rate limit cools the remaining same-site items, including case variants", async () => {
  seed("other");
  const r = await collect(
    [
      ...Array.from({ length: 4 }, () => ({ site: "batch", op: "limited" })),
      user("not sent", "BATCH"),
      user("still works", "other"),
    ],
    { concurrency: 4 },
  );
  assert.deepEqual(
    r.map((x) => x.class),
    ["ok", "ok", "rate", "rate", "rate", "ok"],
  );
  for (const x of r.slice(3, 5)) {
    assert.equal(x.cooling, true);
    assert.equal(x.retry, "after_wait");
    assert.ok(x.retryAfterMs! > 0);
  }
  assert.equal(fx.calls.filter((x) => x.path === "/api/limited").length, 3);
  assert.equal(fx.calls.length, 4);
});

test("an existing block cannot be bypassed by batch options", async () => {
  coolDown("batch", { class: "blocked", reason: "challenge" }, 60_000);
  const [r] = await collect([user("alice")], { ignoreCoolDown: true } as BatchOptions);
  assert.equal(r!.cooling, true);
  assert.equal(r!.class, "blocked");
  assert.equal(fx.calls.length, 0);
});

test("concurrency is bounded across sites; same-site sends remain ordered and nonoverlapping", async () => {
  for (const site of ["a", "b", "c", "d", "e"]) seed(site);
  let active = 0;
  let peak = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let four!: () => void;
  const startedFour = new Promise<void>((r) => {
    four = r;
  });
  const starts: string[] = [];
  const ends: string[] = [];
  const work = collect([user("a1", "a"), user("a2", "A"), ...["b", "c", "d", "e"].map((s) => user(s, s))], {
    concurrency: 4,
    fetchImpl: async (...args) => {
      const name = new URL(String(args[0])).searchParams.get("name")!;
      starts.push(name);
      peak = Math.max(peak, ++active);
      if (starts.length === 4) four();
      if (name === "a1") await gate;
      else await sleep(10);
      if (name === "a2") assert.ok(ends.includes("a1"));
      const r = await fetch(...args);
      active--;
      ends.push(name);
      return r;
    },
  });
  try {
    await startedFour;
    assert.deepEqual(starts, ["a1", "b", "c", "d"]);
    assert.equal(peak, 4);
  } finally {
    release();
  }
  const r = await work;
  assert.deepEqual(
    r.map((x) => (x.data as { name: string }).name),
    ["a1", "a2", "b", "c", "d", "e"],
  );
  assert.ok(peak <= 4);
});

test("caps and invalid options fail before sending; an empty batch is empty", async () => {
  for (const opts of [{ concurrency: 5 }, { concurrency: 0 }, { concurrency: 1.5 }, { maxItems: 201 }, { maxItems: 0 }])
    await assert.rejects(collect([user("alice")], opts), /batch/);
  await assert.rejects(collect(Array.from({ length: 201 }, () => user("alice"))), /at most 200/);
  await assert.rejects(collect([user("alice"), user("bob")], { maxItems: 1 }), /at most 1/);
  assert.equal((await collect(Array.from({ length: 200 }, () => ({ site: "batch", op: "missing" })))).length, 200);
  assert.deepEqual(await collect([]), []);
  assert.equal(fx.calls.length, 0);
});

test("malformed runtime items fail individually without echoing values", async () => {
  const secret = "sensitive-input-do-not-print";
  const r = await collect([null, { ...user("a"), args: secret }, user("after")] as BatchItem[]);
  assert.deepEqual(
    r.map((x) => x.class),
    ["input", "input", "ok"],
  );
  assert.doesNotMatch(JSON.stringify(r), new RegExp(secret));
  assert.equal(fx.calls.length, 1);
});

test("paging and truncation metadata survive unchanged", async () => {
  const [r] = await collect([{ site: "batch", op: "pages", args: { page: "1" } }], {
    fetchImpl: async (...args) => {
      await fetch(...args);
      return new Response(
        JSON.stringify({
          next: "page-two",
          items: Array.from({ length: 300 }, (_, i) => ({ title: `item ${i}`, description: "long ".repeat(100) })),
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(r!.ok, true);
  assert.equal(r!.nextPage, "page-two");
  assert.equal(r!.hasMore, true);
  assert.ok(r!.truncated);
  assert.ok(Array.isArray(r!.data));
});

test("stopping the iterable starts no more sequential calls", async () => {
  for await (const r of callReads([user("first"), user("never")], { maxTier: 1 })) {
    assert.equal(r.ok, true);
    break;
  }
  assert.equal(fx.calls.length, 1);
});

test("stopping concurrent iteration waits for active calls without starting queued items", async () => {
  seed("other");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const starts: string[] = [];
  const reads = callReads([user("first"), user("active", "other"), user("never")], {
    concurrency: 2,
    maxTier: 1,
    fetchImpl: async (...args) => {
      const name = new URL(String(args[0])).searchParams.get("name")!;
      starts.push(name);
      if (name === "active") await gate;
      return fetch(...args);
    },
  });
  try {
    const first = await reads.next();
    assert.equal(first.value!.ok, true);
    let stopped = false;
    const stopping = reads.return(undefined).then(() => {
      stopped = true;
    });
    await sleep(10);
    assert.equal(stopped, false, "return waits for the already active read");
    assert.deepEqual(starts, ["first", "active"]);
    release();
    await stopping;
    assert.equal(fx.calls.length, 2);
    assert.deepEqual(starts, ["first", "active"]);
  } finally {
    release();
    await reads.return(undefined);
  }
});

const ROOT = fileURLToPath(new URL("..", import.meta.url));
function cli(args: string[], stdin = ""): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src/cli.ts"), ...args],
      { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: home } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    );
    child.stdin!.on("error", () => {});
    child.stdin!.end(stdin);
  });
}
const jsonl = (items: unknown[]) => `${items.map((i) => JSON.stringify(i)).join("\n")}\n`;

test("CLI call --json - reads an object, preserving positional overrides", async () => {
  const fromStdin = await cli(["call", "batch", "user", "--max-tier", "1", "--json", "-"], '{"name":"stdin"}');
  assert.equal(fromStdin.code, 0, fromStdin.stdout);
  assert.deepEqual(JSON.parse(fromStdin.stdout).data, { name: "stdin" });
  const r = await cli(["call", "batch", "user", "--max-tier", "1", "--json", "-", "name=override"], '{"name":"stdin"}');
  assert.equal(r.code, 0, r.stdout);
  assert.deepEqual(JSON.parse(r.stdout).data, { name: "override" });
  for (const bad of ['{"name":"secret-from-stdin"', '["secret-from-stdin"]']) {
    const r = await cli(["call", "batch", "user", "--json", "-"], bad);
    assert.equal(r.code, 1);
    assert.doesNotMatch(r.stdout, /secret-from-stdin/);
    assert.match(r.stderr, /call --help/);
  }
  const before = fx.calls.length;
  const oversized = await cli(["call", "batch", "user", "--json", "-"], " ".repeat(4 * 1024 * 1024 + 1));
  assert.equal(oversized.code, 1);
  assert.match(oversized.stdout, /input exceeds 4 MiB/);
  assert.equal(fx.calls.length, before);
});

test("CLI batches stdin and files as ordered JSONL, with partial failure exit status", async () => {
  const records = [user("first"), { site: "batch", op: "write", id: "no" }, user("last")];
  const r = await cli(["batch", "-", "--max-tier", "1", "--concurrency", "4"], jsonl(records));
  assert.equal(r.code, 1);
  const results = r.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    results.map((x) => [x.id, x.class]),
    [
      [1, "ok"],
      ["no", "input"],
      [3, "ok"],
    ],
  );
  assert.equal(results[1].reason, "writes are not batched");
  const file = join(home, "items.jsonl");
  writeFileSync(file, jsonl([user("file")]));
  const fromFile = await cli(["batch", "--input", file, "--max-tier", "1"]);
  assert.equal(fromFile.code, 0, fromFile.stdout);
  assert.equal(JSON.parse(fromFile.stdout).data.name, "file");
  const empty = await cli(["batch"]);
  assert.equal(empty.code, 0);
  assert.equal(empty.stdout, "");
});

test("CLI malformed lines fail individually; size caps and forbidden flags send nothing", async () => {
  const malformed = await cli(["batch", "--max-tier", "1"], `{"secret":"do-not-echo"\n\n${jsonl([user("after")])}`);
  const results = malformed.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(malformed.code, 1);
  assert.deepEqual(
    results.map((x) => x.class),
    ["input", "input", "ok"],
  );
  assert.doesNotMatch(malformed.stdout, /do-not-echo/);
  const before = fx.calls.length;
  for (const [args, text] of [
    [["batch", "--limit", "1"], jsonl([user("a"), user("b")])],
    [["batch"], jsonl(Array.from({ length: 201 }, () => user("a")))],
    [["batch"], "x".repeat(4 * 1024 * 1024 + 1)],
    [["batch", "--concurrency", "5"], jsonl([user("a")])],
    [["batch", "--allow-writes"], jsonl([{ site: "batch", op: "write" }])],
    [["batch", "--force"], jsonl([user("a")])],
    [["batch", "--input", "unused", "-"], ""],
  ] as [string[], string][]) {
    const r = await cli(args, text);
    assert.equal(r.code, 1, r.stdout);
    assert.equal(fx.calls.length, before);
  }
});

async function mcp(waitMs = 25_000) {
  const client = new Client({ name: "batch-test", version: "0" });
  const server = createServer({ allowWrites: true, waitMs });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
    tool: async (name: string, args: Record<string, unknown>) => {
      const r = await client.callTool({ name, arguments: args });
      return {
        isError: r.isError === true,
        structuredContent: r.structuredContent,
        value: JSON.parse((r.content as { text: string }[])[0]!.text),
      };
    },
  };
}

test("MCP batch returns ordered results and single-item retry hints, with a 20-item bound", async () => {
  const s = await mcp();
  try {
    const tools = await s.client.listTools();
    assert.deepEqual(tools.tools.find((t) => t.name === "call_batch")!.annotations, READ_HINTS);
    coolDown("batch", { class: "rate", reason: "wait" }, 60_000);
    const r = await s.tool("call_batch", { items: [user("wait"), { site: "batch", op: "write" }] });
    assert.equal(r.isError, true);
    assert.deepEqual(r.structuredContent, r.value);
    assert.deepEqual(
      r.value.results.map((x: BatchResult) => x.class),
      ["rate", "input"],
    );
    assert.equal(r.value.results[1].reason, "writes are not batched");
    assert.deepEqual(r.value.results[0].nextCall.args, { site: "batch", op: "user", args: { name: "wait" } });
    assert.equal(r.value.results[0].nextCall.tool, "call_operation", "never retry the entire batch");
    const tooMany = await s
      .tool("call_batch", { items: Array.from({ length: 21 }, () => user("a")) })
      .catch(() => ({ isError: true }));
    assert.equal(tooMany.isError, true);
    assert.equal(fx.calls.length, 0);
  } finally {
    await s.close();
  }
});

test("MCP slow batches join a job; get_job returns the same ordered results without repeating sends", async () => {
  const s = await mcp(1);
  try {
    const args = { items: [user("one"), user("two")] };
    const first = await s.tool("call_batch", args);
    assert.equal(first.value.class, "pending");
    assert.equal(first.isError, false);
    const again = await s.tool("call_batch", args);
    assert.equal(again.value.job, first.value.job);
    let result = first;
    for (let i = 0; i < 60 && result.value.class === "pending"; i++) {
      await sleep(50);
      result = await s.tool("get_job", { job: first.value.job });
    }
    assert.equal(result.value.ok, true);
    assert.deepEqual(
      result.value.results.map((x: BatchResult) => x.data),
      [{ name: "one" }, { name: "two" }],
    );
    const repeated = await s.tool("get_job", { job: first.value.job });
    assert.deepEqual(repeated.value, result.value);
    assert.equal(fx.calls.length, 2);
  } finally {
    await s.close();
  }
});
