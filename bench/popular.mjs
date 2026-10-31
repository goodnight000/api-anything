// Rendered-page truth and predeclared graders. No API Anything extraction is used here.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

export const STORES = ["emeryville", "east-palo-alto", "west-sacramento", "costa-mesa", "san-diego"];

export async function popularSnapshot(task, evidence) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const startedAt = new Date().toISOString();
  const rows = [];
  try {
    for (const key of task === "netflix-1" ? ["netflix"] : STORES) {
      // New signed-out context for each page, with the browser arm's default UA and viewport.
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      try {
        const url =
          key === "netflix" ? "https://www.netflix.com/title/80057281" : `https://www.ikea.com/us/en/stores/${key}/`;
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        if (!response?.ok()) throw new Error(`Truth page returned ${response?.status()}: ${url}`);
        if (key === "netflix") {
          await page.getByRole("heading", { name: "Episodes", exact: true }).waitFor({ timeout: 20_000 });
          // The visible numbered episode cards, not Netflix's embedded data or the spec's recipe.
          const cards = await page
            .locator("li")
            .evaluateAll((elements) =>
              elements
                .filter((e) => e.checkVisibility() && /\n\d+\. Chapter/.test(e.innerText))
                .map((e) => e.innerText),
            );
          for (const card of cards.slice(0, 3)) {
            const title = card.match(/(?:^|\n)\d+\. (Chapter[^\n]+)/)?.[1]?.trim();
            const minutes = Number(card.match(/(?:^|\n)(\d+)m(?:\n|$)/)?.[1]);
            if (!title || !Number.isFinite(minutes)) throw new Error("Missing episode title/runtime in rendered card");
            rows.push({ title, minutes, url });
          }
        } else {
          await page.getByRole("heading", { name: "Address", exact: true }).waitFor({ timeout: 20_000 });
          // Read the visible Address section, independently of the spec's CSS recipe.
          const body = await page.locator("body").innerText();
          const block = body.match(/\nAddress\n([\s\S]*?)\nOpening hours/)?.[1]?.trim();
          const address = block
            ?.replace(/^IKEA[^\n]*\n/, "")
            .replace(/\s+/g, " ")
            .trim();
          if (!address || !/\bCA\s+\d{5}\b/.test(address)) throw new Error(`Missing rendered address: ${url}`);
          rows.push({ store: key.replaceAll("-", " "), address, url, at: new Date().toISOString() });
        }
        if (evidence) {
          writeFileSync(`${evidence}-${key}.txt`, await page.locator("body").innerText());
          await page.screenshot({ path: `${evidence}-${key}.png` });
        }
      } finally {
        await page.close();
      }
    }
    if (rows.length !== (task === "netflix-1" ? 3 : 5))
      throw new Error("Truth snapshot does not contain all required results");
    return { startedAt, endedAt: new Date().toISOString(), source: "rendered Chrome DOM", rows };
  } finally {
    await browser.close();
  }
}

const normalize = (s) =>
  typeof s === "string"
    ? s
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
    : "";
const storeName = (s) => normalize(s).replace(/^ikea /, "");
const addressText = (s) =>
  normalize(s)
    .replace(/^ikea (emeryville|east palo alto|west sacramento|costa mesa|san diego) /, "")
    .replace(
      /\b(street|avenue|boulevard|drive|road|california)\b/g,
      (word) => ({ street: "st", avenue: "ave", boulevard: "blvd", drive: "dr", road: "rd", california: "ca" })[word],
    );

export function gradePopular(task, answer, truth) {
  const count = task === "netflix-1" ? 3 : 5;
  if (!truth?.rows || truth.rows.length !== count) return { correct: null, reason: "missing truth" };
  let rows;
  try {
    rows = JSON.parse(
      (answer ?? "")
        .trim()
        .replace(/^```(?:json)?\s*\n?/, "")
        .replace(/\n?```$/, ""),
    );
  } catch {
    return { correct: false, reason: "answer is not JSON" };
  }
  if (!Array.isArray(rows) || rows.length !== count)
    return { correct: false, reason: `expected exactly ${count} rows` };
  if (task === "netflix-1") {
    const matches = truth.rows.filter(
      (expected, i) =>
        normalize(rows[i]?.title?.replace(/^\d+\.\s*/, "")) === normalize(expected.title) &&
        rows[i]?.minutes === expected.minutes,
    ).length;
    return { correct: matches === 3, matches, required: 3 };
  }
  if (task !== "ikea-5") throw new Error(`Unknown popular task: ${task}`);
  const matches = truth.rows.filter((expected) =>
    rows.some(
      (r) =>
        storeName(r?.store) === storeName(expected.store) && addressText(r?.address) === addressText(expected.address),
    ),
  ).length;
  return { correct: matches === 5, matches, required: 5 };
}
