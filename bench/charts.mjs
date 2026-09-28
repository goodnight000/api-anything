// Summarize bench/results and draw the README charts (light and dark SVG).
// Usage: node bench/charts.mjs [v0.1.0]   -> bench/results[/v0.1.0]/summary.json, docs/media/*.svg
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
const res = join(repo, "bench/results", process.argv[2] ?? ""), media = join(repo, "docs/media");
const draw = !process.argv[2]; // `node bench/charts.mjs v0.1.0` only summarizes an older batch
const lines = (f) => (existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const stats = (xs) => ({ n: xs.length, median: median(xs), min: Math.min(...xs), max: Math.max(...xs) });

// An answer is correct when each date's quoted price matches the snapshot taken right after that
// trial. Ties make the airline ambiguous, so only the price is graded. A batch without per-trial
// snapshots is not graded: fares moved within minutes.
// Goodreads: each book's line must give the rendered page's rating (2 decimals) and its ratings count
// within 3% ("1.48 million" counts). Page count depends on the edition, so it is not graded.
function countsIn(line) {
  const scale = { million: 1e6, m: 1e6, thousand: 1e3, k: 1e3 };
  return [...line.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(million|thousand|m|k)?\b/gi)].map((m) => Number(m[1].replace(/,/g, "")) * (scale[m[2]?.toLowerCase()] ?? 1)).filter((n) => n >= 1000);
}
function bookOk(answer, book) {
  const key = book.title.split(/[:(]/)[0].trim().toLowerCase();
  const line = answer.split("\n").find((l) => l.toLowerCase().includes(key));
  if (!line) return false;
  const rating = Number(line.match(/\b([1-5]\.\d{2})\b/)?.[1]);
  return Math.abs(rating - book.rating) < 0.005 && countsIn(line).some((n) => Math.abs(n - book.ratingsCount) / book.ratingsCount <= 0.03);
}

function correct(task, answer, truth) {
  if (task.startsWith("goodreads")) return truth.every((b) => bookOk(answer ?? "", b));
  const priceOk = (date, price) => truth.some((g) => g.date === date && g.price === price);
  if (task === "flights-1") return priceOk("2026-10-20", Number(answer.match(/\$(\d+)/)?.[1]));
  return [20, 21, 22, 23, 24].every((d) => {
    const line = answer.split("\n").find((l) => new RegExp(`(2026-10-${d}|Oct(ober)?\\.? ${d}\\b|10/${d}\\b)`).test(l) && /\$\d/.test(l));
    return !!line && priceOk(`2026-10-${d}`, Number(line.match(/\$(\d+)/)[1]));
  });
}

const trials = lines(join(res, "trials.jsonl")).filter((t) => t.code === 0).map((t) => ({ ...t, correct: t.truth ? correct(t.task, t.answer, t.truth) : null }));
const transport = lines(join(res, "transport.jsonl"));
const summary = { agents: {}, transport: {} };
for (const task of [...new Set(trials.map((t) => t.task))]) {
  for (const arm of ["browser", "api"]) {
    const ts = trials.filter((t) => t.task === task && t.arm === arm);
    summary.agents[`${task}/${arm}`] = { correct: ts.every((t) => t.correct !== null) ? ts.filter((t) => t.correct).length : "not graded", seconds: stats(ts.map((t) => t.wallMs / 1000)), costUsd: stats(ts.map((t) => t.costUsd)), tokens: stats(ts.map((t) => t.inTokens + t.outTokens)) };
  }
}
for (const arm of ["browser", "api"]) {
  const ts = transport.filter((t) => t.arm === arm);
  if (ts.length) summary.transport[arm] = { seconds: stats(ts.map((t) => t.ms / 1000)), ...(arm === "browser" ? { requests: stats(ts.map((t) => t.requests)) } : {}) };
}
writeFileSync(join(res, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

// Palette validated with the dataviz validator (categorical slots 1-2, both modes).
const THEMES = {
  light: { surface: "#fcfcfb", text: "#0b0b0b", text2: "#52514e", muted: "#898781", grid: "#e1e0d9", api: "#2a78d6", browser: "#eb6834" },
  dark: { surface: "#1a1a19", text: "#e0e0dc", text2: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", api: "#3987e5", browser: "#d95926" },
};
const FONT = "Geist, Inter, 'Helvetica Neue', Arial, sans-serif";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Horizontal bars (median) with a min-max whisker, grouped by row, one panel per measure.
function barPanel(c, x0, y0, w, { title, rows, fmt, max }) {
  const labelW = 132, plotW = w - labelW - 70, bar = 16, gap = 6, groupGap = 22;
  let y = y0 + 34, out = `<text x="${x0}" y="${y0 + 14}" fill="${c.text}" font-size="15" font-weight="600">${esc(title)}</text>`;
  const sx = (v) => x0 + labelW + (v / max) * plotW;
  for (const row of rows) {
    out += `<text x="${x0}" y="${y + bar + gap / 2 + 4}" fill="${c.text2}" font-size="13">${esc(row.label)}</text>`;
    for (const arm of ["browser", "api"]) {
      const s = row[arm], x1 = sx(s.median), bx = x0 + labelW, r = Math.min(4, x1 - bx);
      out += `<path d="M${bx},${y} H${x1 - r} a${r},${r} 0 0 1 ${r},${r} V${y + bar - r} a${r},${r} 0 0 1 ${-r},${r} H${bx} Z" fill="${c[arm]}"><title>${arm === "api" ? "API Anything" : "Browser"}: median ${fmt(s.median)}, range ${fmt(s.min)}-${fmt(s.max)}, n=${s.n}</title></path>`;
      out += `<line x1="${sx(s.min)}" x2="${sx(s.max)}" y1="${y + bar / 2}" y2="${y + bar / 2}" stroke="${c.text2}" stroke-width="1"/>`;
      out += `<text x="${Math.max(x1, sx(s.max)) + 8}" y="${y + bar - 3}" fill="${c.text}" font-size="13" font-variant-numeric="tabular-nums">${esc(fmt(s.median))}</text>`;
      y += bar + gap;
    }
    y += groupGap - gap;
  }
  out += `<line x1="${x0 + labelW}" x2="${x0 + labelW}" y1="${y0 + 28}" y2="${y - groupGap + 4}" stroke="${c.grid}" stroke-width="1"/>`;
  return { svg: out, bottom: y };
}

function legend(c, x, y) {
  return [["browser", "Agent + browser (Playwright MCP)"], ["api", "Agent + API Anything (MCP)"]].map(([arm, label], i) => {
    const lx = x + i * 270;
    return `<rect x="${lx}" y="${y - 10}" width="12" height="12" rx="3" fill="${c[arm]}"/><text x="${lx + 18}" y="${y}" fill="${c.text2}" font-size="13">${label}</text>`;
  }).join("");
}

function svg(w, h, body, c, desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(desc)}" font-family="${FONT}">` +
    `<rect width="${w}" height="${h}" rx="12" fill="${c.surface}"/>${body}</svg>\n`;
}

mkdirSync(media, { recursive: true });
const A = summary.agents, taskLabel = { "flights-1": "1 date", "flights-5": "5 dates" };
const tasks = Object.keys(taskLabel).filter((t) => A[`${t}/api`]?.seconds.n);
for (const [mode, c] of draw ? Object.entries(THEMES) : []) {
  if (tasks.length) {
    const rows = (k) => tasks.map((t) => ({ label: taskLabel[t], browser: A[`${t}/browser`][k], api: A[`${t}/api`][k] }));
    const maxOf = (k) => Math.max(...tasks.flatMap((t) => [A[`${t}/browser`][k].max, A[`${t}/api`][k].max]));
    const time = barPanel(c, 24, 56, 440, { title: "Time to answer", rows: rows("seconds"), fmt: (v) => `${v.toFixed(1)} s`, max: maxOf("seconds") });
    const cost = barPanel(c, 488, 56, 440, { title: "Cost per task", rows: rows("costUsd"), fmt: (v) => `$${v.toFixed(3)}`, max: maxOf("costUsd") });
    const n = A[`${tasks[0]}/api`].seconds.n, h = Math.max(time.bottom, cost.bottom) + 46;
    const body = legend(c, 24, 30) + time.svg + cost.svg +
      `<text x="24" y="${h - 32}" fill="${c.muted}" font-size="12">Bar = median of ${n} runs, line = range. Task: cheapest nonstop SFO to JFK on Google Flights, for 1 date and for 5 dates.</text>` +
      `<text x="24" y="${h - 14}" fill="${c.muted}" font-size="12">Claude Opus 5.5 in Claude Code, same prompt. Cost as reported by Claude Code at API rates. Every answer was checked against live fares.</text>`;
    writeFileSync(join(media, `agent-benchmark-${mode}.svg`), svg(952, h, body, c, "Agent time and cost per task, browser versus API Anything"));
  }
  if (summary.transport.api) {
    const T = summary.transport;
    const p = barPanel(c, 24, 56, 904, { title: "Without an agent: time until a script has the flight list", rows: [{ label: "1 search", browser: T.browser.seconds, api: T.api.seconds }], fmt: (v) => `${v.toFixed(2)} s`, max: T.browser.seconds.max });
    const h = p.bottom + 46;
    const body = legend(c, 24, 30).replace("Agent + browser (Playwright MCP)", "Headless Chrome, page load").replace("Agent + API Anything (MCP)", "api-anything call, tier 1") + p.svg +
      `<text x="24" y="${h - 32}" fill="${c.muted}" font-size="12">Bar = median of ${T.api.seconds.n} runs, line = range. Chrome is launched each run and waits until prices render (median ${Math.round(T.browser.requests.median)} requests).</text>` +
      `<text x="24" y="${h - 14}" fill="${c.muted}" font-size="12">The call runs in a new process with fresh state and fetches the same server-rendered results page.</text>`;
    writeFileSync(join(media, `transport-${mode}.svg`), svg(952, h, body, c, "Scripted browser page load versus API Anything call"));
  }
}
console.log(JSON.stringify(summary, null, 2));
