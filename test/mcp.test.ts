import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { asTable, createServer, mcpNextCall } from "../src/mcp.js";
import { parseSite } from "../src/spec.js";
import { saveSite } from "../src/store.js";

test("MCP names the tool for a next step one of its tools takes, and leaves the CLI's to next", () => {
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
  assert.equal(mcpNextCall({ action: "relearn", site: "x", op: "get" }).tool, undefined);
});

test("MCP call_operation: a write's status, a duplicate refused with its next step, and the again argument", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-mcp-"));
  const before = process.env.API_ANYTHING_HOME;
  process.env.API_ANYTHING_HOME = home;
  let hits = 0;
  const server = httpServer((_req, res) => {
    hits++;
    res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const client = new Client({ name: "probe", version: "0" });
  try {
    saveSite(
      parseSite({
        name: "mw",
        baseUrl: base,
        operations: [
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
            params: [{ name: "id" }],
            trigger: { url: `${base}/` },
          },
        ],
      }),
    );
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer({ allowWrites: true }).connect(a);
    await client.connect(b);
    const vote = async (extra: Record<string, unknown> = {}) => {
      const r = await client.callTool({
        name: "call_operation",
        arguments: { site: "mw", op: "vote", args: { id: "9" }, ...extra },
      });
      return JSON.parse((r.content as { text: string }[])[0]!.text);
    };
    const first = await vote();
    assert.deepEqual([first.ok, first.write], [true, "accepted"]);
    const dup = await vote();
    assert.equal(hits, 1);
    assert.deepEqual([dup.class, dup.write, dup.retry], ["duplicate", "not_sent", "no"]);
    assert.equal(dup.nextCall.action, "check_site");
    assert.match(dup.next, /again: true/);
    const again = await vote({ again: true });
    assert.equal(again.ok, true);
    assert.equal(hits, 2);
    await vote({ idempotencyKey: "k1" });
    const replay = await vote({ idempotencyKey: "k1" });
    assert.equal(hits, 3);
    assert.match(replay.reason, /that call's record/);
  } finally {
    await client.close();
    server.close();
    process.env.API_ANYTHING_HOME = before;
    rmSync(home, { recursive: true, force: true });
  }
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
