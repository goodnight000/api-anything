// Run one task through a Claude Code agent twice: with only a browser (Playwright MCP) and with
// only API Anything (its MCP server). Same model, same prompt, fresh state per trial.
// Usage: node bench/run-agents.mjs [--tasks flights-1,flights-5] [--trials 5] [--arms browser,api] [--out bench/results] [--seed <spec.json>]
// Prints one JSON line per trial; raw event logs go to <out>/raw (not committed).
// Needs the `claude` CLI signed in, Google Chrome, and `npm run build` in this checkout.
import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

export const TASKS = {
  "flights-1":
    "On Google Flights, find the cheapest nonstop one-way flight from SFO to JFK departing 2026-10-20. " +
    "Reply with one line: airline, departure time, price in USD.",
  "flights-5":
    "On Google Flights, find the cheapest nonstop one-way flight from SFO to JFK for each departure date " +
    "from 2026-10-20 through 2026-10-24. Reply with one line per date: date, airline, departure time, price in USD.",
  "goodreads-1":
    "On Goodreads, what are the average rating, number of ratings and page count of Circe by Madeline Miller? " +
    "Reply with one line: title, average rating, number of ratings, pages.",
  "goodreads-5":
    "On Goodreads, find the average rating, number of ratings and page count of each of these books: " +
    "Circe by Madeline Miller; The Name of the Wind by Patrick Rothfuss; Educated by Tara Westover; Pachinko by Min Jin Lee; " +
    "The Martian by Andy Weir. Reply with one line per book: title, average rating, number of ratings, pages.",
};
// Goodreads book ids of the asked-for books, pinned from the rendered search page (title search, author checked):
// a "title author" search ranks study guides first, so the grader reads these books' own pages.
const IDS = { circe: "35959740", wind: "186074", educated: "35133922", pachinko: "34051011", martian: "18007564" };
export const BOOKS = {
  "goodreads-1": [IDS.circe],
  "goodreads-5": [IDS.circe, IDS.wind, IDS.educated, IDS.pachinko, IDS.martian],
};
// Goodreads serves an empty page to headless Chrome's default user agent; the browser agent gets a normal one.
const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
export const MODEL = "claude-opus-5-5";
const PLAYWRIGHT_MCP = "@playwright/mcp@0.0.82";
const repo = resolve(import.meta.dirname, "..");

function mcpConfig(task, arm, dir, video, seed) {
  if (arm === "api") {
    // a learned spec the agent should have (bundled specs are always there)
    if (seed) {
      mkdirSync(join(dir, "home/sites"), { recursive: true });
      copyFileSync(seed, join(dir, "home/sites", basename(seed)));
    }
    return {
      "api-anything": {
        command: process.execPath,
        args: [join(repo, "dist/cli.js"), "mcp"],
        env: { API_ANYTHING_HOME: join(dir, "home") },
      },
    };
  }
  const browser = {
    browserName: "chromium",
    launchOptions: { channel: "chrome", headless: true },
    contextOptions: {
      viewport: { width: 1280, height: 800 },
      ...(task.startsWith("goodreads") ? { userAgent: CHROME_UA } : {}),
    },
  };
  if (video) browser.contextOptions.recordVideo = { dir: video, size: { width: 1280, height: 800 } };
  writeFileSync(join(dir, "playwright.json"), JSON.stringify({ browser }));
  return {
    browser: { command: "npx", args: ["-y", PLAYWRIGHT_MCP, "--isolated", "--config", join(dir, "playwright.json")] },
  };
}

// Runs one trial. Every stream-json event is written to <log> with `t`, ms since spawn.
export function runTrial(task, arm, { log, video, onEvent, seed } = {}) {
  const dir = mkdtempSync(join(tmpdir(), `aa-bench-${arm}-`));
  const servers = mcpConfig(task, arm, dir, video, seed);
  writeFileSync(join(dir, "mcp.json"), JSON.stringify({ mcpServers: servers }));
  const args = [
    "-p",
    TASKS[task],
    "--model",
    MODEL,
    "--output-format",
    "stream-json",
    "--verbose",
    "--setting-sources",
    "project",
    "--strict-mcp-config",
    "--mcp-config",
    join(dir, "mcp.json"),
    "--tools",
    "",
    "--allowedTools",
    `mcp__${Object.keys(servers)[0]}`,
    "--no-session-persistence",
  ];
  const start = Date.now();
  return new Promise((done) => {
    const child = spawn("claude", args, { cwd: dir, stdio: ["ignore", "pipe", "inherit"] });
    const timer = setTimeout(() => child.kill("SIGTERM"), 15 * 60_000);
    let buf = "",
      result;
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = { t: Date.now() - start, ...JSON.parse(line) };
        if (log) appendFileSync(log, JSON.stringify(ev) + "\n");
        if (ev.type === "result") result = ev;
        onEvent?.(ev);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ arm, code, wallMs: Date.now() - start, result });
    });
  });
}

// Tool calls and the size of what each returned, from a trial's events.
export function toolCalls(events) {
  const calls = new Map();
  for (const ev of events) {
    for (const c of ev.message?.content ?? []) {
      if (c.type === "tool_use")
        calls.set(c.id, { t: ev.t, tool: c.name.replace(/^mcp__[^_]+__/, ""), input: c.input, resultChars: 0 });
      if (c.type === "tool_result" && calls.has(c.tool_use_id)) {
        const text = []
          .concat(c.content ?? [])
          .map((x) => (typeof x === "string" ? x : (x.text ?? "")))
          .join("");
        Object.assign(calls.get(c.tool_use_id), { done: ev.t, resultChars: text.length, text, isError: !!c.is_error });
      }
    }
  }
  return [...calls.values()];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { snapshot, DATES } = await import("./ground-truth.mjs");
  const { withPage, renderedBook } = await import("./explore/truth.mjs");
  const { values: v } = parseArgs({
    options: {
      tasks: { type: "string", default: "flights-1,flights-5" },
      trials: { type: "string", default: "5" },
      arms: { type: "string", default: "browser,api" },
      out: { type: "string", default: join(repo, "bench/results") },
      seed: { type: "string" },
    },
  });
  // what a person would see right after the trial: live fares, or each book's rendered page
  const truthFor = (task) =>
    task.startsWith("goodreads")
      ? withPage(async (p) => {
          const out = [];
          for (const id of BOOKS[task]) out.push(await renderedBook(p, id));
          return out;
        })
      : snapshot(task === "flights-1" ? DATES.slice(0, 1) : DATES);
  const raw = join(v.out, "raw");
  mkdirSync(raw, { recursive: true });
  for (let i = 1; i <= Number(v.trials); i++)
    for (const task of v.tasks.split(",")) {
      for (const arm of v.arms.split(",")) {
        const log = join(raw, `${task}-${arm}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
        const r = await runTrial(task, arm, { log, seed: v.seed && resolve(v.seed) });
        const truth = await truthFor(task);
        const u = r.result?.usage ?? {};
        console.log(
          JSON.stringify({
            task,
            arm,
            trial: i,
            at: new Date().toISOString(),
            code: r.code,
            wallMs: r.wallMs,
            durationMs: r.result?.duration_ms,
            costUsd: r.result?.total_cost_usd,
            turns: r.result?.num_turns,
            inTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
            outTokens: u.output_tokens,
            answer: r.result?.result,
            truth,
            log: relative(repo, log),
          }),
        );
      }
    }
}
