// Without an agent: how long until a script has the flight list?
//   browser: launch headless Chrome, open the results page, wait until prices render
//   api:     one `api-anything call` in a new process (fresh state), tier 1
// Usage: node bench/transport.mjs [--trials 10] >> bench/results/transport.jsonl
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const repo = resolve(import.meta.dirname, "..");
const date = "2026-10-20";
// The page google-flights.search itself loads (its trigger URL).
const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from SFO to JFK on ${date} one way`)}&hl=en-US&gl=US&curr=USD`;
const { values: v } = parseArgs({ options: { trials: { type: "string", default: "10" } } });

async function browserTrial() {
  const start = performance.now();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let requests = 0;
    page.on("request", () => requests++);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => [...document.querySelectorAll("li")].filter((li) => /\$\d/.test(li.innerText)).length >= 5,
      null,
      { timeout: 60_000 },
    );
    return { ms: Math.round(performance.now() - start), requests };
  } finally {
    await browser.close();
  }
}

function apiTrial() {
  const start = performance.now();
  const out = execFileSync(
    process.execPath,
    [join(repo, "dist/cli.js"), "call", "google-flights", "search", "origin=SFO", "destination=JFK", `date=${date}`],
    {
      env: { ...process.env, API_ANYTHING_HOME: mkdtempSync(join(tmpdir(), "aa-transport-")) },
    },
  );
  const r = JSON.parse(out);
  if (!r.ok) throw new Error(`api call failed: ${r.class} ${r.reason}`);
  return { ms: Math.round(performance.now() - start), tier: r.tier, results: r.data.length };
}

for (let i = 1; i <= Number(v.trials); i++) {
  for (const [arm, run] of [
    ["browser", browserTrial],
    ["api", apiTrial],
  ]) {
    console.log(JSON.stringify({ arm, trial: i, at: new Date().toISOString(), ...(await run()) }));
  }
}
