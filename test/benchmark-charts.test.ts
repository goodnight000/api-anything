import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("benchmark summaries retain failed and ungraded trials and exclude absent measurements", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-charts-"));
  try {
    const results = join(dir, "bench/results/synthetic");
    mkdirSync(results, { recursive: true });
    const script = join(dir, "bench/charts.mjs");
    copyFileSync(new URL("../bench/charts.mjs", import.meta.url), script);
    const trials = [
      {
        task: "flights-1",
        arm: "api",
        code: 0,
        answer: "$100",
        truth: [{ date: "2026-10-20", price: 100 }],
        wallMs: 1000,
        costUsd: 0.1,
        inTokens: 10,
        outTokens: 5,
      },
      { task: "flights-1", arm: "api", code: 1, wallMs: 5000 },
      {
        task: "flights-1",
        arm: "api",
        code: 0,
        answer: "no snapshot",
        wallMs: 2000,
        costUsd: 0.2,
        inTokens: 20,
        outTokens: 5,
      },
    ];
    writeFileSync(join(results, "trials.jsonl"), trials.map((t) => JSON.stringify(t)).join("\n"));
    execFileSync(process.execPath, [script, "synthetic"]);
    const summary = JSON.parse(readFileSync(join(results, "summary.json"), "utf8"));
    const api = summary.agents["flights-1/api"];
    assert.equal(api.attempts, 3);
    assert.equal(api.completed, 2);
    assert.equal(api.failed, 1);
    assert.equal(api.graded, 1);
    assert.equal(api.ungraded, 2);
    assert.equal(api.correct, "not graded");
    assert.deepEqual(api.seconds, { n: 3, median: 2, min: 1, max: 5 });
    assert.equal(api.costUsd.n, 2);
    assert.equal(api.tokens.n, 2);
    assert.deepEqual(api.inputTokens, { n: 2, median: 15, min: 10, max: 20 });
    assert.deepEqual(summary.agents["flights-1/browser"].seconds, { n: 0, median: null, min: null, max: null });
    copyFileSync(join(results, "trials.jsonl"), join(dir, "bench/results/trials.jsonl"));
    execFileSync(process.execPath, [script]);
    for (const mode of ["light", "dark"]) {
      const chart = readFileSync(join(dir, `docs/media/agent-benchmark-${mode}.svg`), "utf8");
      assert.match(chart, /N\/A \(no measurement\)/);
      assert.match(chart, /1 of 3 attempts graded/);
      assert.ok(!chart.includes("Every answer was checked"));
      assert.ok(!chart.includes("NaN"));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
