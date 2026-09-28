// Does the explored Goodreads API work for inputs nobody used while building it, and does it agree
// with what a person sees? For each book: search -> details -> author's books -> reviews through the
// learned operations, then the same book's page rendered in Chrome (truth.mjs) to compare.
// Usage: node bench/explore/reliability.mjs --spec bench/explore/results/goodreads/goodreads.json > bench/explore/results/goodreads/reliability.jsonl
import { copyFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { renderedBook, renderedTopResult, withPage } from "./truth.mjs";

const { values: v } = parseArgs({ options: { spec: { type: "string" }, ops: { type: "string" }, "title-only": { type: "boolean" } } });
const home = mkdtempSync(join(tmpdir(), "aa-reliability-"));
mkdirSync(join(home, "sites"));
copyFileSync(v.spec, join(home, "sites/goodreads.json"));
process.env.API_ANYTHING_HOME = home;
const { call, closeBrowser } = await import("../../dist/index.js");

// operation and field names as the explorer chose them: { search: [op, param, idField, titleField, authorIdField], ... }
const OPS = JSON.parse(v.ops);

// 30 books across genres and decades ("title author"); none is an example the explorer learned from
export const QUERIES = [
  "Beloved Toni Morrison", "The Remains of the Day Kazuo Ishiguro", "Station Eleven Emily St. John Mandel", "The Road Cormac McCarthy",
  "Gone Girl Gillian Flynn", "The Name of the Rose Umberto Eco", "Never Let Me Go Kazuo Ishiguro", "The Left Hand of Darkness Ursula K. Le Guin",
  "Sapiens Yuval Noah Harari", "Thinking, Fast and Slow Daniel Kahneman", "The Kite Runner Khaled Hosseini", "Rebecca Daphne du Maurier",
  "Normal People Sally Rooney", "The Secret History Donna Tartt", "Anxious People Fredrik Backman", "Klara and the Sun Kazuo Ishiguro",
  "The Three-Body Problem Liu Cixin", "Where the Crawdads Sing Delia Owens", "The Midnight Library Matt Haig", "Atomic Habits James Clear",
  "Frankenstein Mary Shelley", "Jane Eyre Charlotte Bronte", "Neuromancer William Gibson", "The Handmaid's Tale Margaret Atwood",
  "A Little Life Hanya Yanagihara", "Hyperion Dan Simmons", "The Color Purple Alice Walker", "Lonesome Dove Larry McMurtry",
  "The Hitchhiker's Guide to the Galaxy Douglas Adams", "Piranesi Susanna Clarke",
];

// the title part of each query (the rest is the author)
const BOOKS = Object.fromEntries(QUERIES.map((q) => [q, q.replace(/ (Toni Morrison|Kazuo Ishiguro|Emily St\. John Mandel|Cormac McCarthy|Gillian Flynn|Umberto Eco|Ursula K\. Le Guin|Yuval Noah Harari|Daniel Kahneman|Khaled Hosseini|Daphne du Maurier|Sally Rooney|Donna Tartt|Fredrik Backman|Liu Cixin|Delia Owens|Matt Haig|James Clear|Mary Shelley|Charlotte Bronte|William Gibson|Margaret Atwood|Hanya Yanagihara|Dan Simmons|Alice Walker|Larry McMurtry|Douglas Adams|Susanna Clarke)$/, "")]));
const num = (x) => { const d = x == null ? "" : String(x).replace(/[^\d.]/g, ""); return d === "" ? null : Number(d); };
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const rows = (d) => (Array.isArray(d) ? d : d ? [d] : []);

async function step(name, args) {
  const [op] = OPS[name];
  const r = await call("goodreads", op, args);
  return { ok: r.ok, class: r.class, tier: r.tier, ms: r.ms, data: r.data, reason: r.reason };
}

await withPage(async (page) => {
  for (const q of QUERIES) {
    const out = { q, at: new Date().toISOString() };
    const [, sParam, idF, titleF, authorF, countF, nameF] = OPS.search;
    // --title-only searches for the title and uses the author only to choose among the results
    const title = BOOKS[q] ?? q, sq = v["title-only"] ? title : q;
    out.searched = sq;
    const s = await step("search", { [sParam]: sq });
    const results = rows(s.data);
    // Goodreads ranks study guides first for "title author" queries on its own search page too; a
    // caller wants the book itself: the result by an author named in the query with the most ratings.
    const byAuthor = results.filter((x) => norm(q).includes(norm(x?.[nameF])));
    const top = [...byAuthor].sort((a, b) => num(b[countF]) - num(a[countF]))[0];
    const pageTop = await renderedTopResult(page, sq).catch((e) => ({ error: e.message }));
    out.search = { ok: s.ok && results.length > 0, tier: s.tier, ms: s.ms, results: results.length, chosen: top?.[titleF],
      sameTopAsPage: String(results[0]?.[idF]) === String(pageTop.bookId), foundBook: !!top };
    const bookId = top?.[idF], authorId = top?.[authorF];
    if (bookId) {
      const [, bParam, ...bFields] = OPS.book;
      const b = await step("book", { [bParam]: String(bookId) });
      const d = rows(b.data)[0] ?? {};
      const [tF, rF, cF, pF] = bFields;
      const seen = await renderedBook(page, bookId).catch((e) => ({ error: e.message }));
      out.book = { ok: b.ok, tier: b.tier, ms: b.ms, title: d[tF], rating: num(d[rF]), ratingsCount: num(d[cF]), pages: num(d[pF]), rendered: seen };
      out.book.agrees = {
        title: norm(d[tF]) === norm(seen.title),
        rating: num(d[rF]) === seen.rating,
        ratingsCount: !!seen.ratingsCount && Math.abs(num(d[cF]) - seen.ratingsCount) / seen.ratingsCount <= 0.005,
        pages: seen.pages == null || num(d[pF]) === seen.pages,
      };
      if (OPS.reviews) {
        // reviews may be keyed by another id that an op looks up first: [op, param, textField, [viaOp, viaParam, viaField]]
        const [, rParam, textF, via] = OPS.reviews;
        let key = String(bookId);
        if (via) {
          const w = await call("goodreads", via[0], { [via[1]]: key });
          out.reviewKey = { ok: w.ok, tier: w.tier, ms: w.ms };
          key = rows(w.data)[0]?.[via[2]];
        }
        const r = key ? await step("reviews", { [rParam]: String(key) }) : { ok: false };
        out.reviews = { ok: r.ok && rows(r.data).some((x) => x?.[textF]), tier: r.tier, ms: r.ms, count: rows(r.data).length, ...(r.ok ? {} : { class: r.class, reason: String(r.reason).slice(0, 160) }) };
      }
    }
    if (authorId && OPS.author) {
      const [, aParam, aTitleF] = OPS.author;
      const a = await step("author", { [aParam]: String(authorId) });
      out.author = { ok: a.ok && rows(a.data).length > 0, tier: a.tier, ms: a.ms, count: rows(a.data).length, hasBook: rows(a.data).some((x) => norm(x?.[aTitleF]).startsWith(norm(top?.[titleF]).split(" ").slice(0, 2).join(" "))) };
    }
    console.log(JSON.stringify(out));
  }
});
await closeBrowser();
