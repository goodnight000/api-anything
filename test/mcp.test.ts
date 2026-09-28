import assert from "node:assert/strict";
import { test } from "node:test";
import { asTable } from "../src/mcp.js";

test("MCP sends a list of records as {columns, rows}, keys once, null for a missing field", () => {
  const data = [{ airline: ["JetBlue"], price: 209, via: ["BOS"] }, { airline: ["Delta"], price: 219 }];
  assert.deepEqual(asTable(data), { columns: ["airline", "price", "via"], rows: [[["JetBlue"], 209, ["BOS"]], [["Delta"], 219, null]] });
});

test("MCP sends anything that is not a list of two or more records unchanged", () => {
  for (const data of [[{ a: 1 }], [], [1, 2], [[1], [2]], [{ a: 1 }, null], { a: 1 }, "text", null, undefined]) {
    assert.deepEqual(asTable(data), data);
  }
});
