// Run one task through a Claude Code agent twice: with only a browser (Playwright MCP) and with
// only API Anything (its MCP server). Same model, same prompt, fresh state per trial.
// Usage: node bench/run-agents.mjs [--tasks flights-1,flights-5] [--trials 5] [--arms browser,api] [--out bench/results]
// Prints one JSON line per trial; raw event logs go to <out>/raw (not committed).
// Needs the `claude` CLI signed in, Google Chrome, and `npm run build` in this checkout.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

export const TASKS = {
  "flights-1": "On Google Flights, find the cheapest nonstop one-way flight from SFO to JFK departing 2026-10-20. " +
    "Reply with one line: airline, departure time, price in USD.",
  "flights-5": "On Google Flights, find the cheapest nonstop one-way flight from SFO to JFK for each departure date " +
    "from 2026-10-20 through 2026-10-24. Reply with one line per date: date, airline, departure time, price in USD.",
};
export const MODEL = "claude-opus-5-5";
const PLAYWRIGHT_MCP = "@playwright/mcp@0.0.82";
const repo = resolve(import.meta.dirname, "..");

function mcpConfig(arm, dir, video) {
  if (arm === "api") {
    return { "api-anything": { command: process.execPath, args: [join(repo, "dist/cli.js"), "mcp"], env: { API_ANYTHING_HOME: join(dir, "home") } } };
  }
  const browser = { browserName: "chromium", launchOptions: { channel: "chrome", headless: true }, contextOptions: { viewport: { width: 1280, height: 800 } } };
  if (video) browser.contextOptions.recordVideo = { dir: video, size: { width: 1280, height: 800 } };
  writeFileSync(join(dir, "playwright.json"), JSON.stringify({ browser }));
  return { browser: { command: "npx", args: ["-y", PLAYWRIGHT_MCP, "--isolated", "--config", join(dir, "playwright.json")] } };
}

// Runs one trial. Every stream-json event is written to <log> with `t`, ms since spawn.
export function runTrial(task, arm, { log, video, onEvent } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `aa-bench-${arm}-`));
  const servers = mcpConfig(arm, dir, video);
  writeFileSync(join(dir, "mcp.json"), JSON.stringify({ mcpServers: servers }));
  const args = [
    "-p", TASKS[task], "--model", MODEL, "--output-format", "stream-json", "--verbose",
    "--setting-sources", "project", "--strict-mcp-config", "--mcp-config", join(dir, "mcp.json"),
    "--tools", "", "--allowedTools", `mcp__${Object.keys(servers)[0]}`, "--no-session-persistence",
  ];
  const start = Date.now();
  return new Promise((done) => {
    const child = spawn("claude", args, { cwd: dir, stdio: ["ignore", "pipe", "inherit"] });
    const timer = setTimeout(() => child.kill("SIGTERM"), 15 * 60_000);
    let buf = "", result;
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = { t: Date.now() - start, ...JSON.parse(line) };
        if (log) appendFileSync(log, JSON.stringify(ev) + "\n");
        if (ev.type === "result") result = ev;
        onEvent?.(ev);
      }
    });
    child.on("close", (code) => { clearTimeout(timer); done({ arm, code, wallMs: Date.now() - start, result }); });
  });
}

// Tool calls and the size of what each returned, from a trial's events.
export function toolCalls(events) {
  const calls = new Map();
  for (const ev of events) {
    for (const c of ev.message?.content ?? []) {
      if (c.type === "tool_use") calls.set(c.id, { t: ev.t, tool: c.name.replace(/^mcp__[^_]+__/, ""), input: c.input, resultChars: 0 });
      if (c.type === "tool_result" && calls.has(c.tool_use_id)) {
        const text = [].concat(c.content ?? []).map((x) => (typeof x === "string" ? x : x.text ?? "")).join("");
        Object.assign(calls.get(c.tool_use_id), { done: ev.t, resultChars: text.length, text, isError: !!c.is_error });
      }
    }
  }
  return [...calls.values()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { snapshot, DATES } = await import("./ground-truth.mjs");
  const { values: v } = parseArgs({ options: { tasks: { type: "string", default: Object.keys(TASKS).join(",") }, trials: { type: "string", default: "5" }, arms: { type: "string", default: "browser,api" }, out: { type: "string", default: join(repo, "bench/results") } } });
  const raw = join(v.out, "raw");
  mkdirSync(raw, { recursive: true });
  for (let i = 1; i <= Number(v.trials); i++) for (const task of v.tasks.split(",")) {
    for (const arm of v.arms.split(",")) {
      const log = join(raw, `${task}-${arm}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
      const r = await runTrial(task, arm, { log });
      const truth = await snapshot(task === "flights-1" ? DATES.slice(0, 1) : DATES);
      const u = r.result?.usage ?? {};
      console.log(JSON.stringify({ task, arm, trial: i, at: new Date().toISOString(), code: r.code, wallMs: r.wallMs, durationMs: r.result?.duration_ms, costUsd: r.result?.total_cost_usd, turns: r.result?.num_turns, inTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), outTokens: u.output_tokens, answer: r.result?.result, truth, log: relative(repo, log) }));
    }
  }
}
