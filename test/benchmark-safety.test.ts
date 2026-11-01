import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the exploration benchmark refuses traversal before deleting state or launching a paid agent", () => {
  for (const name of ["../../..", "../outside", "nested/run", "nested\\run", "/tmp/outside"]) {
    const repo = mkdtempSync(join(tmpdir(), "aa-bench-safety-"));
    try {
      mkdirSync(join(repo, "bench/explore"), { recursive: true });
      const script = join(repo, "bench/explore/run-explore.mjs");
      copyFileSync(fileURLToPath(new URL("../bench/explore/run-explore.mjs", import.meta.url)), script);
      copyFileSync(
        fileURLToPath(new URL("../bench/run-agents.mjs", import.meta.url)),
        join(repo, "bench/run-agents.mjs"),
      );
      const sentinel = join(repo, "must-remain");
      writeFileSync(sentinel, "preserve this checkout");
      const result = spawnSync(process.execPath, [script, "--name", name, "--prompt", join(repo, "missing-prompt")], {
        encoding: "utf8",
        timeout: 5000,
      });
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /--name must be a run name/);
      assert.doesNotMatch(result.stderr, /ENOENT|spawn claude/);
      assert.equal(existsSync(sentinel), true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});

test("the agent benchmark stops after one provider quota error without opening a truth browser", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-bench-quota-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const fake = join(bin, "claude");
    writeFileSync(
      fake,
      `#!${process.execPath}\nconsole.log(JSON.stringify({type:"result",subtype:"success",is_error:true,api_error:"usage_limit_reached",api_error_status:429,total_cost_usd:0,usage:{input_tokens:0,output_tokens:0},result:"quota exhausted"}));process.exitCode=1;\n`,
    );
    chmodSync(fake, 0o755);
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL("../bench/run-agents.mjs", import.meta.url)),
        "--tasks",
        "netflix-1,ikea-5",
        "--trials",
        "5",
        "--out",
        join(dir, "results"),
      ],
      {
        encoding: "utf8",
        timeout: 15_000,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      },
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Provider failure: usage_limit_reached/);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 1);
    const trial = JSON.parse(lines[0]);
    assert.equal(trial.apiErrorStatus, 429);
    assert.equal(trial.costUsd, 0);
    assert.equal(trial.truth, undefined);
    assert.equal(trial.truthError, undefined);
    assert.match(readFileSync(trial.log, "utf8"), /quota exhausted/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
