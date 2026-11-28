import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSite, TriggerStepSchema } from "../src/spec.js";

test("a wait step may name a condition instead of a fixed sleep", () => {
  const step = TriggerStepSchema.parse({ action: "wait", selector: "#ready", state: "attached", ms: 5000 });
  assert.equal(step.state, "attached");
  assert.equal(
    TriggerStepSchema.parse({ action: "wait", value: "Loading complete", ms: 2000 }).value,
    "Loading complete",
  );
  assert.equal(TriggerStepSchema.parse({ action: "wait", ms: 1000 }).ms, 1000);
});

test("a site spec keeps a wait step's condition", () => {
  const site = parseSite({
    name: "x",
    baseUrl: "https://x.test",
    operations: [
      {
        name: "r",
        readOnly: true,
        request: { method: "GET", url: "https://x.test/r" },
        trigger: { url: "https://x.test", steps: [{ action: "wait", selector: "#ready", state: "visible" }] },
      },
    ],
  });
  assert.equal(site.operations[0]!.trigger.steps![0]!.state, "visible");
});
