/**
 * The browser layer: installed Chrome via playwright-core, one persistent profile per process.
 * Produces raw Exchanges for the learner (tier 3 / create / heal) and runs tier-2 page fetches.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Cookie, type Page, type Request, type Route } from "playwright-core";
import { siteOf } from "./session.js";
import type { CaptureResult, Exchange, StoredCookie, TriggerStep } from "./types.js";

let current: { profileDir: string; headless: boolean; ctx: Promise<BrowserContext> } | undefined;
let headlessUA: string | undefined;
const originPages = new Map<string, Page>();

/** Paths Playwright's "chrome" channel launches; checked up front so callers can skip cleanly. */
export function chromeAvailable(): boolean {
  const env = process.env;
  const candidates =
    process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : process.platform === "win32"
        ? [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]]
            .filter((d): d is string => !!d)
            .map((d) => join(d, "Google", "Chrome", "Application", "chrome.exe"))
        : ["/opt/google/chrome/chrome"];
  return candidates.some((p) => existsSync(p));
}

// Default headless UA says "HeadlessChrome/<v>" and x.com answers 403. sec-ch-ua already
// carries "Google Chrome", so only the UA string needs the fix.
async function probeHeadlessUA(): Promise<string> {
  const b = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const p = await b.newPage();
    return (await p.evaluate(() => navigator.userAgent)).replace("HeadlessChrome", "Chrome");
  } finally {
    await b.close();
  }
}

/**
 * The process-wide persistent context. A different profileDir or headless mode closes the old one
 * first, since Chrome locks a profile to one running instance.
 */
export function openBrowser({ profileDir, headless = true }: { profileDir: string; headless?: boolean }): Promise<BrowserContext> {
  if (current && current.profileDir === profileDir && current.headless === headless) return current.ctx;
  const prev = current;
  const ctx = (async () => {
    if (prev) await closeContext(prev.ctx);
    if (headless) headlessUA ??= await probeHeadlessUA();
    const c = await chromium.launchPersistentContext(profileDir, {
      channel: "chrome",
      headless,
      userAgent: headless ? headlessUA : undefined,
      viewport: headless ? undefined : null,
      // A service worker's fetches bypass routing (so write interception) and hide requests from capture.
      serviceWorkers: "block",
    });
    c.on("close", () => {
      if (current?.ctx === ctx) current = undefined;
    });
    return c;
  })();
  current = { profileDir, headless, ctx };
  ctx.catch(() => {
    if (current?.ctx === ctx) current = undefined;
  });
  return ctx;
}

async function closeContext(ctx: Promise<BrowserContext>): Promise<void> {
  try {
    await (await ctx).close();
  } catch {
    // launch failed or already closed
  }
}

/**
 * Close the shared context. Call it before a normal exit: an open context keeps the event loop
 * alive. On signals and hard exits Playwright kills the Chrome it launched by itself.
 */
export async function closeBrowser(): Promise<void> {
  const c = current;
  current = undefined;
  originPages.clear();
  if (c) await closeContext(c.ctx);
}

const toStored = (c: Cookie): StoredCookie => ({
  name: c.name,
  value: c.value,
  domain: c.domain,
  path: c.path,
  expires: c.expires,
  httpOnly: c.httpOnly,
  secure: c.secure,
  sameSite: c.sameSite,
});

function siteCookies(cookies: Cookie[], url: string): StoredCookie[] {
  const site = siteOf(new URL(url).hostname);
  return cookies
    .filter((c) => {
      const d = c.domain.replace(/^\./, "");
      return d === site || d.endsWith("." + site);
    })
    .map(toStored);
}

/** The profile's current cookies for url's site: the cheap auth refresh, no page load. */
export async function profileCookies({ url, profileDir }: { url: string; profileDir: string }): Promise<StoredCookie[]> {
  const ctx = await openBrowser({ profileDir });
  return siteCookies(await ctx.cookies(), url);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Binary resources: their bodies are never useful to the learner and are not valid UTF-8.
const NO_BODY = new Set(["image", "media", "font", "stylesheet"]);
const QUIET_MS = 500;

export interface TriggerOptions {
  url: string;
  steps?: TriggerStep[];
  /** open this page first, then reach `url` by an in-app navigation so SPAs fire their XHRs */
  softFrom?: string;
  headless?: boolean;
  profileDir: string;
  /**
   * requests it matches are aborted before leaving the browser (in any tab of the context) and
   * recorded with aborted:true; `acting` is true once the page has loaded and the steps run
   */
  intercept?: (e: Exchange, acting: boolean) => boolean;
  /** extra wait after the network first goes quiet (default 300) */
  settleMs?: number;
  /** overall budget; also the per-action Playwright timeout (default 30000) */
  timeoutMs?: number;
}

async function runStep(page: Page, s: TriggerStep): Promise<void> {
  const need = (v: string | undefined, what: string) => {
    if (!v) throw new Error(`trigger step "${s.action}" needs ${what}`);
    return v;
  };
  switch (s.action) {
    case "click":
      return page.click(need(s.selector, "a selector"));
    case "fill":
      return page.fill(need(s.selector, "a selector"), s.value ?? "");
    case "press":
      return s.selector ? page.press(s.selector, need(s.value, "a key")) : page.keyboard.press(need(s.value, "a key"));
    case "wait":
      if (s.selector) await page.waitForSelector(s.selector);
      else await page.waitForTimeout(s.ms ?? 1000);
      return;
    case "goto":
      await page.goto(need(s.value ?? s.selector, "a url in value"));
      return;
  }
}

/** Load the trigger in the browser and return every exchange it caused, with bodies and cookies. */
export async function runTrigger(o: TriggerOptions): Promise<CaptureResult> {
  const timeout = o.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeout;
  const ctx = await openBrowser(o);
  const page = await ctx.newPage();
  page.setDefaultTimeout(timeout);

  const exchanges: Exchange[] = [];
  const byReq = new Map<Request, Exchange>();
  const reads: Promise<unknown>[] = [];
  let inflight = 0;
  let lastActivity = Date.now();

  const record = (req: Request): Exchange => {
    let ex = byReq.get(req);
    if (!ex) {
      ex = {
        id: exchanges.length + 1,
        resourceType: req.resourceType(),
        request: { method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() ?? undefined },
      };
      exchanges.push(ex);
      byReq.set(req, ex);
    }
    return ex;
  };
  // Never let one stuck body read (streams, long-poll) hold the whole capture.
  const bounded = (p: Promise<unknown>) =>
    reads.push(Promise.race([p, new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())).unref())]));

  page.on("request", (req) => {
    inflight++;
    lastActivity = Date.now();
    const ex = record(req);
    // allHeaders() is what went on the wire: cookie, sec-fetch-*, origin, referer.
    bounded(req.allHeaders().then((h) => (ex.request.headers = h), () => {}));
  });
  const settle = () => {
    inflight--;
    lastActivity = Date.now();
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  // Bodies must be read here: after the next navigation the browser discards them.
  page.on("response", (res) => {
    const ex = record(res.request());
    bounded(
      (async () => {
        const headers = await res.allHeaders().catch(() => res.headers());
        const body = NO_BODY.has(ex.resourceType) ? undefined : await res.text().catch(() => undefined);
        ex.response = { status: res.status(), headers, body, contentType: headers["content-type"] ?? "" };
      })(),
    );
  });

  let acting = false;
  const intercept = o.intercept;
  // Context-wide, so a popup the trigger opens is covered too.
  const guard = intercept
    ? (route: Route) => {
        const ex = record(route.request());
        if (!intercept(ex, acting)) return route.fallback();
        ex.aborted = true;
        return route.abort();
      }
    : undefined;
  if (guard) await ctx.route("**/*", guard);

  // ponytail: sites that long-poll never go quiet, so they pay the whole timeout; add a per-op idle cap if that bites.
  const idle = async (capMs = timeout) => {
    const end = Math.min(deadline, Date.now() + capMs);
    while (Date.now() < end && (inflight > 0 || Date.now() - lastActivity < QUIET_MS)) await sleep(50);
  };

  try {
    if (o.softFrom) {
      await page.goto(o.softFrom);
      await idle(5000);
      const from = page.url();
      const before = exchanges.length;
      // A link the app rendered goes through its router; otherwise the history API plus popstate,
      // which client routers (React Router, TanStack, Next) listen to. An injected <a> would not be routed.
      await page.evaluate((u) => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find((a) => a.href === u && (!a.target || a.target === "_self"));
        if (link) return link.click();
        try {
          history.pushState({}, "", u);
          dispatchEvent(new PopStateEvent("popstate", { state: {} }));
        } catch {
          /* cross-origin: fall through to a plain load */
        }
      }, o.url);
      await idle(5000);
      // ponytail: "fired anything" is the routed signal; a page whose analytics fire on pushState fools it.
      const routed = exchanges.slice(before).some((e) => ["xhr", "fetch", "document"].includes(e.resourceType));
      if (!routed) await page.goto(o.url, { referer: from });
    } else {
      await page.goto(o.url);
    }
    acting = true;
    for (const s of o.steps ?? []) await runStep(page, s);
    await idle();
    await sleep(o.settleMs ?? 300);
    await idle();
    for (let n = -1; n !== reads.length; ) {
      n = reads.length;
      await Promise.allSettled(reads);
    }
    return { exchanges, cookies: siteCookies(await ctx.cookies(), o.url), finalUrl: page.url() };
  } finally {
    if (guard) await ctx.unroute("**/*", guard).catch(() => {});
    await page.close().catch(() => {});
  }
}

export interface PageFetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
  ms: number;
}

/** Tier 2: fetch() from inside a page on the site origin, so TLS, cookies and sec-fetch are the browser's own. */
export async function pageFetch(o: {
  origin: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  profileDir: string;
  headless?: boolean;
}): Promise<PageFetchResult> {
  const ctx = await openBrowser(o);
  let page = originPages.get(o.origin);
  if (!page || page.isClosed()) {
    page = await ctx.newPage();
    await page.goto(o.origin, { waitUntil: "domcontentloaded" });
    originPages.set(o.origin, page);
  }
  // Pseudo-headers are invalid names for fetch(); forbidden ones (cookie, host, ...) the browser drops itself.
  const headers = Object.fromEntries(Object.entries(o.headers).filter(([k]) => !k.startsWith(":")));
  const body = o.method === "GET" || o.method === "HEAD" ? undefined : o.body;
  return page.evaluate(
    async ({ url, method, headers, body }) => {
      const t = performance.now();
      const r = await fetch(url, { method, headers, body, credentials: "include" });
      const h: Record<string, string> = {};
      r.headers.forEach((v, k) => (h[k] = v));
      const text = await r.text();
      return { status: r.status, headers: h, body: text, url: r.url, ms: Math.round(performance.now() - t) };
    },
    { url: o.url, method: o.method, headers, body },
  );
}

/**
 * Open `url` headed so the user can sign in. Resolves when they close the window or press Enter
 * in the terminal; what counts as logged in is the caller's call. Returns the site's cookies.
 */
export async function login({ url, profileDir }: { url: string; profileDir: string }): Promise<StoredCookie[]> {
  const ctx = await openBrowser({ profileDir, headless: false });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url);
  // Closing the last window closes the context, after which cookies can't be read, so keep a snapshot.
  let snapshot = await ctx.cookies();
  const poll = setInterval(() => ctx.cookies().then((c) => (snapshot = c), () => {}), 1000);
  let onEnter = () => {};
  try {
    await new Promise<void>((resolve) => {
      onEnter = resolve;
      ctx.once("close", () => resolve());
      page.once("close", () => resolve());
      process.stdin.once("data", onEnter);
      process.stdin.resume();
    });
    snapshot = await ctx.cookies().catch(() => snapshot);
  } finally {
    clearInterval(poll);
    process.stdin.off("data", onEnter);
    process.stdin.pause();
    await closeBrowser();
  }
  return siteCookies(snapshot, url);
}
