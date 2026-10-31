// Run one task through a Claude Code agent twice: with only a browser (Playwright MCP) and with
// only API Anything (its MCP server). Same model, same prompt, fresh state per trial.
// Usage: node bench/run-agents.mjs [--tasks flights-1,flights-5] [--trials 5] [--arms browser,api] [--out bench/results] [--seed <spec.json>]
// Prints one JSON line per trial; raw event logs go to <out>/raw (not committed).
// Needs the `claude` CLI signed in, Google Chrome, and `npm run build` in this checkout.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const TASKS = {
  "netflix-1":
    "I'm deciding whether to start Stranger Things. Check Netflix's public page at https://www.netflix.com/title/80057281 " +
    "and give me the first 3 episodes shown by default, with their exact episode titles and runtimes. Do not change the season. " +
    'Reply only with a JSON array of 3 objects with keys "title" and "minutes" (a number).',
  "ikea-5":
    "I'm planning IKEA visits in California. Look up the street address of each of these IKEA stores on IKEA's US website: " +
    "Emeryville, East Palo Alto, West Sacramento, Costa Mesa, and San Diego. " +
    'Reply only with a JSON array of 5 objects with keys "store" and "address". Include street, city, state and ZIP in each address.',
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
export function memoryFreePercent() {
  if (process.platform !== "darwin") return null;
  const output = execFileSync("memory_pressure", [], { encoding: "utf8", timeout: 10_000 });
  const free = Number(output.match(/System-wide memory free percentage: (\d+)%/)?.[1]);
  if (!Number.isFinite(free)) throw new Error("Cannot read memory_pressure's free percentage");
  return free;
}

export function runTrial(task, arm, { log, video, onEvent, seed, budget, timeoutMs = 15 * 60_000 } = {}) {
  if (!TASKS[task] || !["api", "browser"].includes(arm)) throw new Error("Unknown task or arm");
  const memoryBefore = memoryFreePercent();
  if (memoryBefore !== null && memoryBefore <= 10) throw new Error("Memory use is at least 90%; not starting a trial");
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
  if (budget !== undefined) args.push("--max-budget-usd", String(budget));
  return new Promise((done) => {
    const child = spawn("claude", args, { cwd: dir, detached: true, stdio: ["ignore", "pipe", "inherit"] });
    const stop = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (e) {
        if (e.code !== "ESRCH") throw e;
      }
    };
    let stopped,
      memoryMin = memoryBefore;
    const timer = setTimeout(() => {
      stopped = "timeout";
      stop();
    }, timeoutMs);
    const memoryTimer = setInterval(() => {
      try {
        const free = memoryFreePercent();
        if (free !== null) memoryMin = Math.min(memoryMin, free);
        if (free !== null && free <= 10) {
          stopped = "memory";
          stop();
        }
      } catch {
        stopped = "memory-check-failed";
        stop();
      }
    }, 5_000);
    let buf = "",
      result;
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = { t: Date.now() - start, ...JSON.parse(line) };
        if (log) appendFileSync(log, `${JSON.stringify(ev)}\n`);
        if (ev.type === "result") result = ev;
        onEvent?.(ev);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(memoryTimer);
      stop();
      done({ arm, code, wallMs: Date.now() - start, result, stopped, memoryBefore, memoryMin });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      clearInterval(memoryTimer);
      done({ arm, code: 1, wallMs: Date.now() - start, error: String(error) });
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
      budget: { type: "string", default: "1" },
      "total-budget": { type: "string", default: "25" },
      "max-minutes": { type: "string", default: "120" },
    },
  });
  // what a person would see right after the trial: live fares, or each book's rendered page
  const { popularSnapshot, gradePopular } = await import("./popular.mjs");
  const truthFor = (task, evidence) =>
    ["netflix-1", "ikea-5"].includes(task)
      ? popularSnapshot(task, evidence)
      : task.startsWith("goodreads")
        ? withPage(async (p) => {
            const out = [];
            for (const id of BOOKS[task]) out.push(await renderedBook(p, id));
            return out;
          })
        : snapshot(task === "flights-1" ? DATES.slice(0, 1) : DATES);
  const raw = join(v.out, "raw");
  mkdirSync(raw, { recursive: true });
  const started = Date.now();
  let spent = 0;
  for (let i = 1; i <= Number(v.trials); i++)
    for (const task of v.tasks.split(",")) {
      for (const arm of v.arms.split(",")) {
        if (spent + Number(v.budget) > Number(v["total-budget"])) throw new Error("Model spend limit reached");
        if (Date.now() - started > Number(v["max-minutes"]) * 60_000 - 6 * 60_000)
          throw new Error("Time limit reached");
        const log = join(raw, `${task}-${arm}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
        const r = await runTrial(task, arm, {
          log,
          seed: v.seed && resolve(v.seed),
          budget: Number(v.budget),
          timeoutMs: 4 * 60_000,
        });
        let truth, truthError;
        if (!r.result?.api_error) {
          try {
            truth = await truthFor(task, log.replace(/\.jsonl$/, "-truth"));
          } catch (e) {
            truthError = String(e);
          }
        }
        const u = r.result?.usage ?? {};
        console.log(
          JSON.stringify({
            task,
            arm,
            trial: i,
            at: new Date().toISOString(),
            code: r.code,
            stopped: r.stopped,
            memoryBefore: r.memoryBefore,
            memoryMin: r.memoryMin,
            isError: r.result?.is_error,
            resultSubtype: r.result?.subtype,
            apiError: r.result?.api_error,
            apiErrorStatus: r.result?.api_error_status,
            modelRan: Object.keys(r.result?.modelUsage ?? {}).length > 0,
            wallMs: r.wallMs,
            durationMs: r.result?.duration_ms,
            costUsd: r.result?.total_cost_usd,
            turns: r.result?.num_turns,
            inTokens: r.result?.usage
              ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
              : undefined,
            outTokens: u.output_tokens,
            answer: r.result?.result,
            truth,
            truthError,
            grade: ["netflix-1", "ikea-5"].includes(task) ? gradePopular(task, r.result?.result, truth) : undefined,
            log: relative(repo, log),
          }),
        );
        spent += r.result?.total_cost_usd ?? 0;
        if (!r.result || r.stopped || !Number.isFinite(r.result.total_cost_usd))
          throw new Error("Trial interrupted or spend unknown; stopping with its record preserved");
        if (r.result.api_error) throw new Error(`Provider failure: ${r.result.api_error}; stopping the batch`);
      }
    }
}
