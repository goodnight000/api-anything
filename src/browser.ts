/**
 * The browser layer: installed Chrome via playwright-core, one persistent profile per process.
 * Produces raw Exchanges for the learner (tier 3 / create / heal) and runs tier-2 page fetches.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { chromium, type BrowserContext, type Cookie, type Page, type Request, type Response, type Route } from "playwright-core";
import { siteOf } from "./session.js";
import type { CaptureResult, Exchange, StoredCookie, TriggerStep } from "./types.js";

let current: { profileDir: string; headless: boolean; ctx: Promise<BrowserContext> } | undefined;
let headlessUA: string | undefined;
const originPages = new Map<string, Page>();

// Chrome locks a profile to one process. A long-lived process (the MCP server) releases it after
// this much idle time (an agent's calls are seconds apart, so Chrome would mostly relaunch anyway),
// and a second process waits up to LOCK_WAIT_MS for it.
const IDLE_CLOSE_MS = 3_000;
const LOCK_WAIT_MS = 15_000;
const LOCKED = /ProcessSingleton|profile (directory )?is already in use|SingletonLock/i;

/** Another process holds api-anything's Chrome profile. */
export class ProfileInUse extends Error {
  constructor(dir: string) {
    super(`the api-anything Chrome profile is in use by another process (an MCP server or another api-anything command): ${dir}`);
    this.name = "ProfileInUse";
  }
}

let users = 0;
let idleTimer: NodeJS.Timeout | undefined;
function scheduleIdleClose(): void {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void (users === 0 && closeBrowser()), IDLE_CLOSE_MS);
  idleTimer.unref();
}
/** Mark the browser busy; the returned function releases it (and starts the idle clock). */
function hold(): () => void {
  users++;
  clearTimeout(idleTimer);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--users === 0) scheduleIdleClose();
  };
}

async function launch(profileDir: string, options: Parameters<typeof chromium.launchPersistentContext>[1]): Promise<BrowserContext> {
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      return await chromium.launchPersistentContext(profileDir, options);
    } catch (e) {
      if (!LOCKED.test((e as Error).message)) throw e;
      if (Date.now() > until) throw new ProfileInUse(profileDir);
      await sleep(500);
    }
  }
}

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
  if (users === 0) scheduleIdleClose();
  if (current && current.profileDir === profileDir && current.headless === headless) return current.ctx;
  const prev = current;
  const ctx = (async () => {
    if (prev) await closeContext(prev.ctx);
    if (headless) headlessUA ??= await probeHeadlessUA();
    const c = await launch(profileDir, {
      channel: "chrome",
      headless,
      userAgent: headless ? headlessUA : undefined,
      viewport: headless ? undefined : null,
      // A service worker's fetches bypass routing (so write interception) and hide requests from capture.
      serviceWorkers: "block",
      // Playwright's own SIGTERM handler keeps the process alive; Chrome exits with its pipe anyway.
      handleSIGTERM: false,
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
  const release = hold();
  try {
    const ctx = await openBrowser({ profileDir });
    return siteCookies(await ctx.cookies(), url);
  } finally {
    release();
  }
}

/** Put imported cookies into api-anything's own Chrome profile, so tier 2/3 and heals are logged in too. */
export async function addCookiesToProfile(cookies: StoredCookie[], profileDir: string): Promise<void> {
  if (!cookies.length) return;
  const release = hold();
  try {
  const ctx = await openBrowser({ profileDir });
  // Playwright wants a domain that starts with a dot or an exact host; a leading-dot domain plus path is safe.
  await ctx.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    })),
  );
  } finally {
    release();
  }
}

/** Clear one site's cookies from the profile: any host under the registrable domain. */
export async function clearProfileCookies(site: string, profileDir: string): Promise<void> {
  const release = hold();
  try {
    const ctx = await openBrowser({ profileDir });
    const esc = site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await ctx.clearCookies({ domain: new RegExp(`(^|\\.)${esc}$`) });
  } finally {
    release();
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Binary resources: their bodies are never useful to the learner and are not valid UTF-8. A stream's never ends.
const NO_BODY = new Set(["image", "media", "font", "stylesheet", "eventsource", "websocket"]);
const QUIET_MS = 500;
// Streams never finish; a request open this long is a long poll or a hung tracker, not the data.
const LONG_LIVED = new Set(["eventsource", "websocket"]);
const LONG_MS = 3000;
// An endpoint hit more often than this is polling or a beacon: its repeats are not "still loading".
const REPEATS = 2;
// Pages that fetch their data a moment after load (deferred hydration): how long to wait for a first XHR.
const FIRST_XHR_MS = 2000;
// With an op's match: how long a quiet page may go without firing it before the run gives up on it.
const MATCH_GRACE_MS = 3000;

export interface TriggerOptions {
  url: string;
  steps?: TriggerStep[];
  /** open this page first, then reach `url` by an in-app navigation so SPAs fire their XHRs */
  softFrom?: string;
  headless?: boolean;
  profileDir: string;
  /**
   * requests it matches are aborted before leaving the browser (in any tab the run opens) and
   * recorded with aborted:true; `acting` is true once the page has loaded and the steps run. A
   * WebSocket message the page sends is asked as resourceType "websocket", method "SEND".
   */
  intercept?: (e: Exchange, acting: boolean) => boolean;
  /**
   * the op's own request: the run waits for one to answer (up to the budget), then ends after a
   * short settle instead of waiting for the whole page to go quiet
   */
  match?: (e: Exchange) => boolean;
  /** extra wait after the network first goes quiet (default 300) */
  settleMs?: number;
  /** overall budget; also the per-action Playwright timeout (default 30000) */
  timeoutMs?: number;
}

/** A page load that treats "this URL is a download" as loaded (the request is still captured). */
async function goto(page: Page, url: string, referer?: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", ...(referer ? { referer } : {}) });
  } catch (e) {
    if (!/Download is starting|net::ERR_ABORTED/.test((e as Error).message)) throw e;
  }
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
      return goto(page, need(s.value ?? s.selector, "a url in value"));
  }
}

/** The request body as the server gets it: a gzip/deflate/br-encoded body (YouTube's innertube) decoded. */
function requestBody(req: Request): string | undefined {
  const enc = (req.headers()["content-encoding"] ?? "").toLowerCase();
  const buf = enc ? req.postDataBuffer() : null;
  if (buf) {
    try {
      return (enc.includes("gzip") ? gunzipSync(buf) : enc.includes("br") ? brotliDecompressSync(buf) : inflateSync(buf)).toString("utf8");
    } catch {
      /* not really encoded: fall through */
    }
  }
  return req.postData() ?? undefined;
}

/** Load the trigger in the browser and return every exchange it caused, with bodies and cookies. */
export async function runTrigger(o: TriggerOptions): Promise<CaptureResult> {
  const timeout = o.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeout;
  const release = hold();
  let ctx: BrowserContext;
  let page: Page;
  try {
    ctx = await openBrowser(o);
    page = await ctx.newPage();
  } catch (e) {
    release();
    throw e;
  }
  page.setDefaultTimeout(timeout);

  // This run's pages: its own and any popup they open. The context is shared with concurrent runs.
  const own = new Set<Page>([page]);
  const ownerOf = (req: Request): Page | undefined => {
    try {
      return req.frame().page();
    } catch {
      return undefined; // a service worker's request
    }
  };
  const adopt = async (p: Page | undefined) => {
    if (!p || own.has(p)) return !!p;
    const opener = await p.opener().catch(() => null);
    if (opener && own.has(opener)) own.add(p);
    return own.has(p);
  };
  const mine = (req: Request) => {
    const p = ownerOf(req);
    return !!p && own.has(p);
  };

  const exchanges: Exchange[] = [];
  const byReq = new Map<Request, Exchange>();
  const reads: Promise<unknown>[] = [];
  const pending = new Map<Request, number>();
  const hits = new Map<string, number>();
  let lastActivity = Date.now();

  const record = (req: Request): Exchange => {
    let ex = byReq.get(req);
    if (!ex) {
      ex = {
        id: exchanges.length + 1,
        resourceType: req.resourceType(),
        request: { method: req.method(), url: req.url(), headers: req.headers(), body: requestBody(req) },
      };
      exchanges.push(ex);
      byReq.set(req, ex);
    }
    return ex;
  };
  // Never let one stuck body read (streams, long-poll) hold the whole capture.
  const bounded = (p: Promise<unknown>) =>
    reads.push(Promise.race([p, new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())).unref())]));

  const onRequest = (req: Request) => {
    if (!mine(req)) return;
    const ex = record(req);
    // allHeaders() is what went on the wire: cookie, sec-fetch-*, origin, referer.
    bounded(req.allHeaders().then((h) => (ex.request.headers = h), () => {}));
    let endpoint = req.url();
    try {
      const u = new URL(endpoint);
      endpoint = `${req.method()} ${u.origin}${u.pathname}`;
    } catch {
      /* keep the raw url */
    }
    const n = (hits.get(endpoint) ?? 0) + 1;
    hits.set(endpoint, n);
    if (LONG_LIVED.has(req.resourceType()) || n > REPEATS) return;
    pending.set(req, Date.now());
    lastActivity = Date.now();
  };
  const onDone = (req: Request) => {
    if (pending.delete(req)) lastActivity = Date.now();
  };
  // Bodies must be read here: after the next navigation the browser discards them.
  const onResponse = (res: Response) => {
    if (!mine(res.request())) return;
    const ex = record(res.request());
    bounded(
      (async () => {
        const headers = await res.allHeaders().catch(() => res.headers());
        const body = NO_BODY.has(ex.resourceType) ? undefined : await res.text().catch(() => undefined);
        ex.response = { status: res.status(), headers, body, contentType: headers["content-type"] ?? "" };
      })(),
    );
  };
  const onPage = (p: Page) => void adopt(p);
  ctx.on("page", onPage);
  ctx.on("request", onRequest);
  ctx.on("requestfinished", onDone);
  ctx.on("requestfailed", onDone);
  ctx.on("response", onResponse);

  let acting = false;
  const intercept = o.intercept;
  // Context-wide, so a popup the run opens is covered too; other runs' requests pass through.
  const guard = intercept
    ? async (route: Route) => {
        const req = route.request();
        if (!(await adopt(ownerOf(req)))) return route.fallback();
        const ex = record(req);
        if (!intercept(ex, acting)) return route.fallback();
        ex.aborted = true;
        return route.abort();
      }
    : undefined;

  const quiet = () => ![...pending.values()].some((t) => Date.now() - t < LONG_MS) && Date.now() - lastActivity >= QUIET_MS;
  const idle = async (capMs = timeout) => {
    const end = Math.min(deadline, Date.now() + capMs);
    while (Date.now() < end && !quiet()) await sleep(50);
  };
  const answered = () => exchanges.some((e) => o.match!(e) && (e.response || e.aborted));

  try {
    if (guard) await ctx.route("**/*", guard);
    if (intercept) {
      // A chat "send" goes over an open socket, where no HTTP route sees it.
      await page.routeWebSocket(/.*/, (ws) => {
        const server = ws.connectToServer();
        ws.onMessage((m) => {
          const ex: Exchange = { id: 0, resourceType: "websocket", request: { method: "SEND", url: ws.url(), headers: {} } };
          if (!intercept(ex, acting)) server.send(m);
        });
      });
    }
    if (o.softFrom) {
      await goto(page, o.softFrom);
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
      if (!routed) await goto(page, o.url, from);
    } else {
      await goto(page, o.url);
    }
    acting = true;
    for (const s of o.steps ?? []) await runStep(page, s);
    if (o.match) {
      // The op's own request answering is the signal; then a short settle catches a challenge's reload.
      // A page quiet for a few seconds without it is not going to send it (a login wall, a 404 page).
      while (Date.now() < deadline && !answered() && !(quiet() && Date.now() - lastActivity > MATCH_GRACE_MS)) await sleep(50);
      await sleep(o.settleMs ?? 300);
      await idle(3000);
    } else {
      await idle();
      await sleep(o.settleMs ?? 300);
      await idle();
      if (!exchanges.some((e) => e.resourceType === "xhr" || e.resourceType === "fetch")) {
        const end = Math.min(deadline, Date.now() + FIRST_XHR_MS);
        while (Date.now() < end && !exchanges.some((e) => e.resourceType === "xhr" || e.resourceType === "fetch")) await sleep(50);
        await idle();
      }
    }
    // Bodies still arriving get a short grace, not the whole budget: a hung long poll is not the data.
    const grace = new Promise((r) => setTimeout(r, Math.min(5000, Math.max(0, deadline - Date.now()))).unref());
    const settled = (async () => {
      for (let n = -1; n !== reads.length; ) {
        n = reads.length;
        await Promise.allSettled(reads);
      }
    })();
    await Promise.race([settled, grace]);
    // Tokens an SPA keeps in web storage (not the jar); learning turns a request repeating one into a session: ref.
    const storage = await page
      .evaluate(() => Object.fromEntries([localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => [k, s.getItem(k) ?? ""])).filter(([, v]) => v.length <= 16_384)))
      .catch(() => ({}));
    return { exchanges, cookies: siteCookies(await ctx.cookies(), o.url), finalUrl: page.url(), storage };
  } finally {
    ctx.off("page", onPage);
    ctx.off("request", onRequest);
    ctx.off("requestfinished", onDone);
    ctx.off("requestfailed", onDone);
    ctx.off("response", onResponse);
    if (guard) await ctx.unroute("**/*", guard).catch(() => {});
    for (const p of own) await p.close().catch(() => {});
    release();
  }
}

export interface PageFetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
  ms: number;
  /** the fetch followed a redirect */
  redirected?: boolean;
}

/** A page on `origin` to fetch from: its root, or a blank stand-in when the root redirects elsewhere (api.* to www). */
async function originPage(ctx: BrowserContext, origin: string, timeout: number): Promise<Page> {
  let page = originPages.get(origin);
  if (page && !page.isClosed()) return page;
  page = await ctx.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout }).catch(() => {});
  let here = "";
  try {
    here = new URL(page.url()).origin;
  } catch {
    /* about:blank */
  }
  if (here !== origin) {
    // Same-origin is what matters for fetch(): serve a blank document at an unused path, never sent to the site.
    const blank = `${origin}/__api_anything_blank__`;
    await page.route(blank, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title></title>" }));
    await page.goto(blank, { waitUntil: "domcontentloaded", timeout });
  }
  originPages.set(origin, page);
  return page;
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
  timeoutMs?: number;
}): Promise<PageFetchResult> {
  const timeoutMs = o.timeoutMs ?? 30_000;
  const release = hold();
  try {
    const ctx = await openBrowser(o);
    const page = await originPage(ctx, o.origin, timeoutMs);
    // Pseudo-headers are invalid names for fetch(); forbidden ones (cookie, host, ...) the browser drops itself.
    const headers = Object.fromEntries(Object.entries(o.headers).filter(([k]) => !k.startsWith(":")));
    const body = o.method === "GET" || o.method === "HEAD" ? undefined : o.body;
    const run = page.evaluate(
      async ({ url, method, headers, body, timeoutMs }) => {
        const t = performance.now();
        const r = await fetch(url, { method, headers, body, credentials: "include", signal: AbortSignal.timeout(timeoutMs) });
        const h: Record<string, string> = {};
        r.headers.forEach((v, k) => (h[k] = v));
        const text = await r.text();
        return { status: r.status, headers: h, body: text, url: r.url, ms: Math.round(performance.now() - t), redirected: r.redirected };
      },
      { url: o.url, method: o.method, headers, body, timeoutMs },
    );
    // the page itself can hang (a stuck renderer): the budget holds either way
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no response within ${timeoutMs} ms`)), timeoutMs + 1000);
    });
    try {
      return await Promise.race([run, late]);
    } catch (e) {
      if (/TimeoutError|timed out|signal timed out/i.test((e as Error).message)) throw new Error(`no response within ${timeoutMs} ms`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  } finally {
    release();
  }
}

/**
 * Open `url` headed so the user can sign in. Resolves when they close the window or press Enter
 * in the terminal; what counts as logged in is the caller's call. Returns the site's cookies.
 */
export async function login({ url, profileDir, waitForEnter = true }: { url: string; profileDir: string; waitForEnter?: boolean }): Promise<StoredCookie[]> {
  const release = hold();
  try {
    return await loginWindow(url, profileDir, waitForEnter);
  } finally {
    release();
  }
}

async function loginWindow(url: string, profileDir: string, waitForEnter: boolean): Promise<StoredCookie[]> {
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
      // The MCP server's stdin is its transport; only the CLI reads Enter.
      if (waitForEnter) {
        process.stdin.once("data", onEnter);
        process.stdin.resume();
      }
    });
    snapshot = await ctx.cookies().catch(() => snapshot);
  } finally {
    clearInterval(poll);
    if (waitForEnter) {
      process.stdin.off("data", onEnter);
      process.stdin.pause();
    }
    await closeBrowser();
  }
  return siteCookies(snapshot, url);
}
