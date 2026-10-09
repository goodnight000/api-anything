// Cheapest nonstop SFO->JFK fare per date, from Google's "top" and "other" flight lists, to grade
// agent answers. run-agents.mjs takes a snapshot right after each trial, since live fares move.
// Usage: node bench/ground-truth.mjs   (prints one line per date)
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.API_ANYTHING_HOME ??= mkdtempSync(join(tmpdir(), "aa-truth-"));
const { call } = await import("../dist/index.js");

export const DATES = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];

export async function snapshot(dates = DATES) {
  const out = [];
  for (const date of dates) {
    const lists = await Promise.all(
      ["top", "search"].map((op) => call("google-flights", op, { origin: "SFO", destination: "JFK", date })),
    );
    const ok = lists.every((l) => l.ok);
    const nonstop = ok ? lists.flatMap((l) => l.data).filter((f) => !f.via?.length) : [];
    const price = nonstop.length ? Math.min(...nonstop.map((f) => f.price)) : null;
    out.push({
      at: new Date().toISOString(),
      date,
      ok,
      price,
      airlines: [...new Set(nonstop.filter((f) => f.price === price).flatMap((f) => f.airline))],
    });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  for (const s of await snapshot()) console.log(JSON.stringify(s));
