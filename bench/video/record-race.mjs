// Start both agents at the same moment on one task and keep what the video needs:
// the browser agent's screen (Playwright's recordVideo) and a trimmed timeline of both runs.
// Usage: node bench/video/record-race.mjs [--task flights-5]
// Writes bench/video/raw/ (full logs, the .webm and timeline.json; not committed). Rename it to
// raw-runN before the next race, then render the chosen run with render.mjs.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { MODEL, runTrial, TASKS, toolCalls } from "../run-agents.mjs";

const here = import.meta.dirname;
const { values: v } = parseArgs({ options: { task: { type: "string", default: "flights-5" } } });
const raw = join(here, "raw");
rmSync(raw, { recursive: true, force: true });
mkdirSync(join(raw, "footage"), { recursive: true });

const logs = { browser: join(raw, "browser.jsonl"), api: join(raw, "api.jsonl") };
const recordedAt = new Date().toISOString();
const [browser, api] = await Promise.all([
  runTrial(v.task, "browser", { log: logs.browser, video: join(raw, "footage") }),
  runTrial(v.task, "api", { log: logs.api }),
]);

function preview(text) {
  try {
    const d = JSON.parse(text).data;
    return d?.columns ? { columns: d.columns, rows: d.rows.slice(0, 8), total: d.rows.length } : null;
  } catch {
    return null;
  }
}

function summarize(arm, run) {
  const events = readFileSync(logs[arm], "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  // Tokens the model read and wrote, summed per model response (stream-json repeats a
  // response's usage on each of its content blocks, so count each message id once).
  let tokens = 0;
  const usage = [],
    seen = new Set();
  for (const ev of events) {
    const u = ev.type === "assistant" && ev.message?.usage;
    if (!u || seen.has(ev.message.id)) continue;
    seen.add(ev.message.id);
    tokens +=
      u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + u.output_tokens;
    usage.push({ t: ev.t, tokens });
  }
  const r = run.result ?? {};
  return {
    // For API Anything calls, the first rows of the returned table (public flight data) for the video.
    calls: toolCalls(events).map((c) => ({
      t: c.t,
      done: c.done,
      tool: c.tool,
      input: JSON.stringify(c.input).slice(0, 300),
      resultChars: c.resultChars,
      isError: c.isError,
      ...(arm === "api" && c.tool === "call_operation" ? { preview: preview(c.text) } : {}),
    })),
    usage,
    end: {
      t: run.wallMs,
      durationMs: r.duration_ms,
      costUsd: r.total_cost_usd,
      turns: r.num_turns,
      answer: r.result,
      exit: run.code,
    },
  };
}

const footage = readdirSync(join(raw, "footage")).filter((f) => f.endsWith(".webm"));
writeFileSync(
  join(raw, "timeline.json"),
  JSON.stringify(
    {
      recordedAt,
      model: MODEL,
      task: v.task,
      prompt: TASKS[v.task],
      footage,
      browser: summarize("browser", browser),
      api: summarize("api", api),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    browser: { wallMs: browser.wallMs, cost: browser.result?.total_cost_usd },
    api: { wallMs: api.wallMs, cost: api.result?.total_cost_usd },
    footage,
  }),
);
