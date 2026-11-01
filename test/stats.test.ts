/** `stats` and its `--card`: totals over a window of the local call log, and nothing else read or sent. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { BROWSER_MS_PER_CALL, card, stats } from "../src/stats.js";
import type { CallRecord } from "../src/store.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DAY = 24 * 60 * 60_000;
const NOW = Date.parse("2026-10-31T12:00:00.000Z");

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "aa-stats-"));
  process.env.API_ANYTHING_HOME = home;
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

function seed(calls: (Omit<CallRecord, "at"> & { ago: number })[], now = NOW): void {
  const lines = calls.map(({ ago, ...c }) => JSON.stringify({ at: new Date(now - ago).toISOString(), ...c }));
  writeFileSync(join(home, "calls.jsonl"), `${lines.join("\n")}\nnot json\n`);
}

/** Two sites over a month, a call past the 30 days kept, and one that sent nothing. */
function seedMonth(): void {
  seed([
    { ago: 40 * DAY, site: "old", op: "x", class: "ok", tier: 1, ms: 100 },
    { ago: 20 * DAY, site: "goodreads", op: "searchBooks", class: "ok", tier: 1, ms: 300 },
    { ago: 10 * DAY, site: "goodreads", op: "getBook", class: "ok", tier: 1, ms: 500, healed: true },
    { ago: 5 * DAY, site: "google-flights", op: "search", class: "ok", tier: 2, ms: 3000 },
    { ago: 2 * DAY, site: "goodreads", op: "searchBooks", class: "drift", tier: 1, ms: 200 },
    { ago: DAY, site: "google-flights", op: "search", class: "rate", ms: 1 },
    { ago: 60_000, site: "goodreads", op: "follow", class: "ok", tier: 1, ms: 100, write: "accepted" },
  ]);
}

test("stats totals the 30 days kept: tiers, sites, median of sent calls, heals, and the estimate's arithmetic", () => {
  seedMonth();
  const s = stats(30, NOW);
  assert.equal(s.calls, 6, "the 40-day-old call is past the log's 30 days");
  assert.equal(s.okRate, 0.67);
  assert.equal(s.sent, 5, "a cool-down's answer sent nothing");
  assert.deepEqual(s.tiers, { "1": 4, "2": 1 });
  assert.equal(s.plainHttp, 0.8);
  assert.equal(s.sites, 2);
  assert.equal(s.ops, 4);
  assert.deepEqual(s.topSites, [
    { site: "goodreads", calls: 4, okRate: 0.75 },
    { site: "google-flights", calls: 2, okRate: 0.5 },
  ]);
  assert.equal(s.medianMs, 300, "300 of 100, 200, 300, 500 and 3000: the rate answer's 1 ms is not a call's time");
  assert.equal(s.heals, 1);
  assert.equal(s.writes, 1);
  // ok calls that sent: 300, 500, 3000 (slower than the assumption: nothing) and 100 ms
  const expected = [300, 500, 100].reduce((sum, ms) => sum + BROWSER_MS_PER_CALL - ms, 0);
  assert.equal(s.saved.counted, 4);
  assert.equal(s.saved.ms, expected);
  assert.equal(s.saved.minutes, Math.round(expected / 6_000) / 10);
  assert.equal(s.saved.browserMsPerCall, BROWSER_MS_PER_CALL);
  assert.match(s.saved.assumption, /2\.5 s/);
  assert.match(s.saved.assumption, /estimate/);
  assert.equal(s.window.days, 30);
  assert.equal(s.window.until, new Date(NOW).toISOString());
  assert.equal(s.window.since, new Date(NOW - 30 * DAY).toISOString());
  assert.equal(s.window.firstCall, new Date(NOW - 20 * DAY).toISOString());
});

test("a shorter window counts only its own days", () => {
  seedMonth();
  const s = stats(7, NOW);
  assert.equal(s.calls, 4);
  assert.deepEqual(
    s.topSites.map((t) => t.site),
    ["goodreads", "google-flights"],
  );
  assert.equal(s.heals, 0);
});

test("the card is a few plain lines that end with how to get it", () => {
  seedMonth();
  const text = card(stats(30, NOW));
  const lines = text.trimEnd().split("\n");
  assert.ok(lines.length <= 7, text);
  assert.equal(lines[0], "API Anything, last 30 days");
  assert.equal(lines[1], "6 calls to 2 sites, 67% ok, 80% over plain HTTP with no browser");
  assert.equal(lines[2], "median call 300 ms, 1 call repaired after the site changed");
  assert.match(lines[3]!, /^about 7 s of browser-agent time saved \(estimate: 2\.5 s per ok call/);
  assert.equal(lines[4], "top: goodreads 4, google-flights 2");
  assert.deepEqual(lines.slice(-2), ["npx -y api-anything setup", "github.com/goodnight000/api-anything"]);
  assert.doesNotMatch(text, /[{}"]/, "plain text, not JSON");
});

test("with no call log, stats answers zeros and the card still says how to get it", () => {
  const s = stats(30, NOW);
  assert.equal(s.calls, 0);
  assert.equal(s.okRate, 0);
  assert.equal(s.medianMs, undefined);
  assert.equal(s.saved.ms, 0);
  assert.equal(
    card(s),
    "API Anything, last 30 days\nNo calls yet.\nnpx -y api-anything setup\ngithub.com/goodnight000/api-anything\n",
  );
});

function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args],
      // no registry is reachable: a command that tried to send would fail or hang
      { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: home, API_ANYTHING_REGISTRY: "http://127.0.0.1:9" } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    ),
  );
}

test("the CLI prints the JSON, or the card with --card, and refuses a window the log does not keep", async () => {
  // the spawned CLI windows by its own clock, not NOW
  seed([{ ago: 60_000, site: "goodreads", op: "searchBooks", class: "ok", tier: 1, ms: 400 }], Date.now());
  const json = await cli("stats");
  assert.equal(json.code, 0, json.stderr);
  const s = JSON.parse(json.stdout);
  assert.equal(s.ok, true);
  assert.equal(s.calls, 1);
  assert.equal(s.window.days, 30);
  assert.equal(s.saved.ms, BROWSER_MS_PER_CALL - 400);

  const c = await cli("stats", "--card", "--days", "7");
  assert.equal(c.code, 0, c.stderr);
  assert.match(c.stdout, /^API Anything, last 7 days\n1 call to 1 site, 100% ok/);
  assert.match(c.stdout, /npx -y api-anything setup\ngithub\.com\/goodnight000\/api-anything\n$/);

  for (const days of ["0", "31", "2.5", "week"]) {
    const bad = await cli("stats", "--days", days);
    assert.equal(bad.code, 1, days);
    assert.match(JSON.parse(bad.stdout).error, /--days must be a whole number from 1 to 30/);
    assert.match(bad.stderr, /^next: api-anything stats --days 30/m);
  }
  assert.match((await cli("stats", "--help")).stdout, /--card/);
  assert.match((await cli("--help")).stdout, /api-anything stats \[--days n\] \[--card\]/);
});
