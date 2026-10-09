// What a person sees on Goodreads, read from the rendered page in real Chrome (no API Anything
// involved): search for the book, open the top result, read its title, rating, ratings count and pages.
// Used to grade agent answers and to check the learned operations.
import { chromium } from "playwright-core";

const text = async (page, sel) =>
  (
    await page
      .locator(sel)
      .first()
      .textContent({ timeout: 15_000 })
      .catch(() => null)
  )
    ?.replace(/\s+/g, " ")
    .trim() ?? null;
const num = (s) => (s ? Number(s.replace(/[^\d.]/g, "")) : null);

/** The rendered book page for a book id. */
export async function renderedBook(page, bookId) {
  await page.goto(`https://www.goodreads.com/book/show/${bookId}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="bookTitle"]').first().waitFor({ timeout: 20_000 });
  return {
    bookId: String(bookId),
    title: await text(page, '[data-testid="bookTitle"]'),
    author: await text(page, '.ContributorLinksList [data-testid="name"]'),
    rating: num(await text(page, ".RatingStatistics__rating")),
    ratingsCount: num(await text(page, '[data-testid="ratingsCount"]')),
    pages: num((await text(page, '[data-testid="pagesFormat"]'))?.match(/([\d,]+) pages/)?.[1]),
  };
}

/** Search as a person would, then read the top result's book page. */
export async function renderedTopResult(page, query) {
  await page.goto(`https://www.goodreads.com/search?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded" });
  const href = await page
    .locator('[data-testid="book-item-title"] a, a.bookTitle')
    .first()
    .getAttribute("href", { timeout: 20_000 });
  return { query, ...(await renderedBook(page, href.match(/show\/(\d+)/)[1])) };
}

export async function withPage(fn) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    // Goodreads serves an empty page to "HeadlessChrome"; a person's browser says "Chrome"
    const userAgent = (
      await browser.newPage().then(async (p) => {
        const ua = await p.evaluate(() => navigator.userAgent);
        await p.close();
        return ua;
      })
    ).replace("HeadlessChrome", "Chrome");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent });
    return await fn(page);
  } finally {
    await browser.close();
  }
}
