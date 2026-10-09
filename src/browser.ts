/**
 * The browser layer: installed Chrome via playwright-core, one persistent profile per process.
 * Produces raw Exchanges for the learner (tier 3 / create / heal) and runs tier-2 page fetches.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import {
  type BrowserContext,
  type Cookie,
  chromium,
  type Frame,
  type Page,
  type Request,
  type Response,
  type Route,
} from "playwright-core";
import { botWall } from "./classify.js";
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
    super(
      `the api-anything Chrome profile is in use by another process (an MCP server or another api-anything command): ${dir}`,
    );
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

async function launch(
  profileDir: string,
  options: Parameters<typeof chromium.launchPersistentContext>[1],
): Promise<BrowserContext> {
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
export function openBrowser({
  profileDir,
  headless = true,
}: {
  profileDir: string;
  headless?: boolean;
}): Promise<BrowserContext> {
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
      return d === site || d.endsWith(`.${site}`);
    })
    .map(toStored);
}

/** The profile's current cookies for url's site: the cheap auth refresh, no page load. */
export async function profileCookies({
  url,
  profileDir,
}: {
  url: string;
  profileDir: string;
}): Promise<StoredCookie[]> {
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
// How long a bot challenge's interstitial may take to solve itself and load the real page.
const CHALLENGE_WAIT_MS = 15_000;

type SocketGuard = (e: Exchange) => boolean;
const socketGuards = new WeakMap<BrowserContext, { guards: Set<SocketGuard>; ready: Promise<void> }>();

/**
 * Drop WebSocket messages a page sends while `guard` says so, in every page of the context (a
 * popup's socket opens before a per-page route could be set). One context-wide route, installed
 * once; returns the function that removes this guard.
 * ponytail: a socket can't be traced to its page, so a concurrent run's sends are guarded too
 * while a write is being learned; that errs on the side of not sending.
 */
async function guardSockets(ctx: BrowserContext, guard: SocketGuard): Promise<() => void> {
  let g = socketGuards.get(ctx);
  if (!g) {
    const guards = new Set<SocketGuard>();
    const ready = ctx.routeWebSocket(/.*/, (ws) => {
      const server = ws.connectToServer();
      ws.onMessage((m) => {
        const ex: Exchange = {
          id: 0,
          resourceType: "websocket",
          request: { method: "SEND", url: ws.url(), headers: {} },
        };
        if (![...guards].some((drop) => drop(ex))) server.send(m);
      });
    });
    g = { guards, ready };
    socketGuards.set(ctx, g);
  }
  g.guards.add(guard);
  await g.ready;
  return () => g.guards.delete(guard);
}

// How long a page gets to be emptied, and then to close, before the run ends without waiting for it.
const SEAL_MS = 5000;
/** A call into a page, given up on after a while: a hung renderer answers nothing, and evaluate() and close() have no timeout. */
const within = <T>(p: Promise<T>, otherwise: T): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((r) => {
    timer = setTimeout(() => r(otherwise), SEAL_MS);
  });
  // cleared when the call settles first: a timer left running keeps the process alive for its 5 s
  return Promise.race([p.catch(() => otherwise), late]).finally(() => clearTimeout(timer));
};

/**
 * Who opened each tab of a browser, kept on a DevTools session of the browser itself. That session
 * outlives every page, so a tab can be asked about, and closed, after the tab that opened it is
 * gone; and the record is kept as tabs appear, since the browser forgets who opened a tab once the
 * opener is closed (as does Playwright's opener()).
 */
interface Tabs {
  /** each tab the browser reported, with the tab that opened it */
  openerOf: Map<string, string>;
  /** the tabs that have closed */
  gone: Set<string>;
  /** called whenever a tab closes */
  watchers: Set<() => void>;
  /** resolves with every tab the browser has now in the record */
  sync(): Promise<void>;
  /** close a tab, whether or not Playwright has a page for it */
  close(targetId: string): Promise<unknown>;
}
const tabRecords = new WeakMap<BrowserContext, Promise<Tabs>>();
function tabsOf(ctx: BrowserContext): Promise<Tabs> {
  let record = tabRecords.get(ctx);
  if (!record) {
    record = (async () => {
      const browser = ctx.browser();
      if (!browser) throw new Error("this browser gives no session to watch its tabs through");
      const cdp = await browser.newBrowserCDPSession();
      const tabs: Tabs = {
        openerOf: new Map(),
        gone: new Set(),
        watchers: new Set(),
        sync: async () => (await cdp.send("Target.getTargets")).targetInfos.forEach(note),
        close: (targetId) => cdp.send("Target.closeTarget", { targetId }),
      };
      const note = (t: { targetId: string; openerId?: string }) =>
        void (t.openerId && tabs.openerOf.set(t.targetId, t.openerId));
      cdp.on("Target.targetCreated", (e) => note(e.targetInfo));
      cdp.on("Target.targetDestroyed", (e) => {
        tabs.gone.add(e.targetId);
        for (const changed of [...tabs.watchers]) changed();
      });
      await cdp.send("Target.setDiscoverTargets", { discover: true });
      return tabs;
    })();
    tabRecords.set(ctx, record);
    record.catch(() => tabRecords.delete(ctx));
  }
  return record;
}

/**
 * One page's requests as Chrome pauses them, below Playwright's routes, on a DevTools session of
 * our own. A route is not asked about every request. Playwright continues by itself, calling no
 * handler: every hop of a redirect (so an asset the guard allowed can be sent on to a write), and
 * any paused request that has no network id, which is what a document sends as it unloads (a
 * pagehide beacon, a keepalive fetch, an image ping) and a deferred fetchLater(). `drop` is asked
 * about each request, and told whether a route will see it too; a hop keeps the resource type of
 * the request that was redirected.
 * ponytail: a frame on another site is a target of its own. Its redirect hops would need a tap on
 * the frame; what it sends as it unloads is seen by no session, its own included (tried: the
 * target is gone before the document unloads), only by interception on the browser target, for
 * every run at once.
 */
interface Tap {
  /** the page's DevTools target */
  id: string;
  /** resolves once every request paused so far has its answer */
  answered(): Promise<void>;
}
async function tap(ctx: BrowserContext, page: Page, drop: (e: Exchange, routed: boolean) => boolean): Promise<Tap> {
  const cdp = await ctx.newCDPSession(page);
  const answers = new Set<Promise<unknown>>();
  cdp.on("Fetch.requestPaused", (e) => {
    const ex: Exchange = {
      id: 0,
      resourceType: e.resourceType.toLowerCase(),
      request: {
        method: e.request.method,
        url: e.request.url + (e.request.urlFragment ?? ""),
        headers: Object.fromEntries(Object.entries(e.request.headers).map(([k, v]) => [k.toLowerCase(), v])),
        body: e.request.postData,
      },
    };
    const { requestId } = e;
    const answer = (
      drop(ex, !!e.networkId && !e.redirectedRequestId)
        ? cdp.send("Fetch.failRequest", { requestId, errorReason: "Aborted" })
        : cdp.send("Fetch.continueRequest", { requestId })
    ).catch(() => {}); // the request or its page is gone
    answers.add(answer);
    void answer.then(() => answers.delete(answer));
  });
  const enable = () => cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await enable();
  return {
    id: (await cdp.send("Target.getTargetInfo")).targetInfo.targetId,
    async answered() {
      // a round trip through the browser: every request it paused before this has been reported
      await enable().catch(() => {});
      await Promise.all(answers);
    },
  };
}

export interface TriggerOptions {
  url: string;
  steps?: TriggerStep[];
  /** open this page first, then reach `url` by an in-app navigation so SPAs fire their XHRs */
  softFrom?: string;
  headless?: boolean;
  profileDir: string;
  /**
   * requests it matches are aborted before leaving the browser (in any tab the run opens) and
   * recorded with aborted:true; `acting` is true once the page has loaded and the steps run, and
   * false again while the page is a bot challenge's interstitial (its own verify POSTs must go
   * through, or it never reloads). A WebSocket message the page sends is asked as resourceType
   * "websocket", method "SEND".
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
      return (
        enc.includes("gzip") ? gunzipSync(buf) : enc.includes("br") ? brotliDecompressSync(buf) : inflateSync(buf)
      ).toString("utf8");
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
  let tabs: Tabs | undefined;
  try {
    ctx = await openBrowser(o);
    // a guarded run does not start without the browser's record of who opens which tab
    if (o.intercept) tabs = await tabsOf(ctx);
    page = await ctx.newPage();
  } catch (e) {
    release();
    throw e;
  }
  page.setDefaultTimeout(timeout);

  const exchanges: Exchange[] = [];
  let acting = false;
  const intercept = o.intercept;
  // Set when the run ends: from then on nothing its pages send may leave.
  let sealed = false;
  /** each guarded page's tap, once attached (undefined when that failed) */
  const taps = new Map<Page, Promise<Tap | undefined>>();
  /** the DevTools targets of the pages the run holds, closed ones included */
  const held = new Set<string>();
  const cover = (p: Page) => {
    if (!intercept || taps.has(p)) return;
    const drop = (ex: Exchange, routed: boolean) => {
      // What a route will see is the route's to judge, until the run ends: then this is the last word.
      if (routed && !sealed) return false;
      // Once sealed everything is stopped, but only what the guard itself stops joins the capture:
      // a write a page sends as it leaves can be learned, the rest of a closing page's traffic is noise.
      if (!intercept(ex, acting)) return sealed;
      exchanges.push({ ...ex, id: exchanges.length + 1, aborted: true });
      return true;
    };
    const attached = tap(ctx, p, drop).then(
      (t) => {
        held.add(t.id);
        return t;
      },
      () => undefined,
    );
    taps.set(p, attached);
  };
  /**
   * The open tabs that pages of the run opened (and the tabs those opened, through closed ones too)
   * which the run does not hold: Playwright has not reported them yet, or reported them when their
   * opener was already closed.
   */
  const strays = () => {
    if (!tabs) return [];
    const kin = new Set(held);
    for (let n = -1; n !== kin.size; ) {
      n = kin.size;
      for (const [id, opener] of tabs.openerOf) if (kin.has(opener)) kin.add(id);
    }
    return [...kin].filter((id) => !held.has(id) && !tabs.gone.has(id));
  };
  /**
   * Whether a tab that has no page yet can be this run's, with the record brought up to date first
   * (so that a tab the browser has only just opened is in it). When the browser cannot be asked, it can.
   */
  const mayOwnNewTab = async () =>
    !tabs ||
    !(await tabs.sync().then(
      () => true,
      () => false,
    )) ||
    strays().length > 0;

  // This run's pages: its own and any popup they open. The context is shared with concurrent runs.
  const own = new Set<Page>([page]);
  const ownerOf = (req: Request): Page | undefined => {
    try {
      return req.frame().page();
    } catch {
      return undefined; // a service worker's request, or a new tab's first navigation (its page comes later)
    }
  };
  /** pages found to be no stray of the run: not asked about again (who opened a tab does not change) */
  const foreign = new WeakSet<Page>();
  /** Whether a page is one of the run's strays, by its target: Playwright's opener() is null once the opener closed. */
  const stray = async (p: Page) => {
    if (!strays().length || foreign.has(p)) return false;
    const cdp = await ctx.newCDPSession(p).catch(() => undefined);
    const id = (await cdp?.send("Target.getTargetInfo").catch(() => undefined))?.targetInfo.targetId;
    void cdp?.detach().catch(() => {});
    if (!id) return false; // already closing: nothing left of it to guard
    const yes = strays().includes(id);
    if (!yes) foreign.add(p);
    return yes;
  };
  const adopt = async (p: Page | undefined) => {
    if (!p || own.has(p)) return !!p;
    const opener = await p.opener().catch(() => null);
    if ((opener && own.has(opener)) || (await stray(p))) {
      own.add(p);
      cover(p);
    }
    return own.has(p);
  };
  const mine = (req: Request) => {
    const p = ownerOf(req);
    return !!p && own.has(p);
  };

  /** top-level documents of the run's first page, in order */
  const docs: Exchange[] = [];
  /** response bodies being read, so a guard can wait for the latest document's */
  const bodies = new Map<Exchange, Promise<unknown>>();
  /** every URL the first page's main frame had, history API changes included (an SPA's pushState) */
  const locations = new Set<string>();
  const onNavigated = (f: Frame) => void (f === page.mainFrame() && locations.add(f.url()));
  page.on("framenavigated", onNavigated);
  const byReq = new Map<Request, Exchange>();
  const reads: Promise<unknown>[] = [];
  const pending = new Map<Request, number>();
  // Resolves when the first page starts its next document: the old one's requests never finish then.
  let navigated = () => {};
  let nextDoc = new Promise<void>((r) => (navigated = r));
  const hits = new Map<string, number>();
  let lastActivity = Date.now();

  const describe = (req: Request): Exchange => ({
    id: 0,
    resourceType: req.resourceType(),
    request: { method: req.method(), url: req.url(), headers: req.headers(), body: requestBody(req) },
  });
  const record = (req: Request): Exchange => {
    let ex = byReq.get(req);
    if (!ex) {
      ex = { ...describe(req), id: exchanges.length + 1 };
      exchanges.push(ex);
      byReq.set(req, ex);
    }
    return ex;
  };
  // Never let one stuck body read (streams, long-poll) hold the whole capture.
  const bounded = (p: Promise<unknown>) =>
    reads.push(Promise.race([p, new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())).unref())]));
  /** A new tab's aborted first navigation joins the capture once its page shows the tab was this run's. */
  const claim = async (req: Request) => {
    for (const end = Date.now() + 2000; !ownerOf(req) && Date.now() < end; ) await sleep(50);
    if (await adopt(ownerOf(req))) record(req).aborted = true;
  };

  const onRequest = (req: Request) => {
    if (!mine(req)) return;
    const ex = record(req);
    if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
      docs.push(ex);
      // A challenge's verify POST, cut off by the reload it triggered, would hold "quiet" and the body reads.
      for (const r of pending.keys()) if (r !== req) pending.delete(r);
      navigated();
      nextDoc = new Promise<void>((r) => (navigated = r));
    }
    // allHeaders() is what went on the wire: cookie, sec-fetch-*, origin, referer.
    bounded(
      req.allHeaders().then(
        (h) => (ex.request.headers = h),
        () => {},
      ),
    );
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
    const read = (async () => {
      const headers = await res.allHeaders().catch(() => res.headers());
      const body = NO_BODY.has(ex.resourceType) ? undefined : await res.text().catch(() => undefined);
      ex.response = { status: res.status(), headers, body, contentType: headers["content-type"] ?? "" };
    })();
    bodies.set(ex, read);
    // a body its document outlives by 2 s is not coming (Playwright never settles it)
    const gone = nextDoc.then(() => sleep(2000));
    bounded(Promise.race([read, gone]));
  };
  /** adoptions under way: a tab that has just been reported is not in `own` yet */
  const adopting = new Set<Promise<unknown>>();
  const onPage = (p: Page) => {
    const a = adopt(p).catch(() => {});
    adopting.add(a);
    void a.then(() => adopting.delete(a));
  };
  ctx.on("page", onPage);
  ctx.on("request", onRequest);
  ctx.on("requestfinished", onDone);
  ctx.on("requestfailed", onDone);
  ctx.on("response", onResponse);

  // The latest top-level document of this run's first page, when it is a bot challenge's interstitial.
  const walled = () => {
    const d = docs.at(-1);
    return (
      !!d?.response &&
      !!botWall({ status: d.response.status, headers: d.response.headers, body: d.response.body ?? "" })
    );
  };
  /** walled(), once the latest document's body is in (bounded: a stuck read is not a wall) */
  const walledNow = async () => {
    const d = docs.at(-1);
    if (d && !d.response) await Promise.race([bodies.get(d), sleep(3000)]);
    return walled();
  };
  // A JS challenge solves itself by POSTing a proof (AWS WAF's mp_verify, Cloudflare's
  // challenge-platform), then reloads: while it is on screen, the steps are not acting yet.
  const actingNow = async () => acting && !(await walledNow());
  /** requests the guard has been asked about and not answered yet */
  let deciding = 0;
  // Context-wide, so a popup the run opens is covered too; other runs' requests pass through.
  const guard = intercept
    ? async (route: Route) => {
        deciding++;
        try {
          const req = route.request();
          const owner = ownerOf(req);
          // A new tab's first navigation is routed before its page exists, and Playwright reports
          // the page only once that navigation commits: waiting for the owner would wait forever.
          // The browser says who opened each tab, though not which tab a request is from: the
          // request is judged as this run's own unless the run has no stray tab. Two runs opening
          // a tab at the same moment cannot be told apart, and then stopping the other run's tab
          // is the lesser harm.
          const orphan = !owner && !req.serviceWorker();
          if (orphan ? !(await mayOwnNewTab()) : !(await adopt(owner))) return await route.fallback();
          const ex = orphan ? describe(req) : record(req);
          if (!intercept(ex, await actingNow())) return await route.fallback();
          ex.aborted = true;
          if (orphan) bounded(claim(req));
          return await route.abort();
        } finally {
          deciding--;
        }
      }
    : undefined;

  const quiet = () =>
    ![...pending.values()].some((t) => Date.now() - t < LONG_MS) && Date.now() - lastActivity >= QUIET_MS;
  const idle = async (capMs = timeout) => {
    const end = Math.min(deadline, Date.now() + capMs);
    while (Date.now() < end && !quiet()) await sleep(50);
  };
  const answered = () => exchanges.some((e) => o.match!(e) && (e.response || e.aborted));
  let dropSocketSends: (() => void) | undefined;
  const waitForData = async () => {
    if (o.match) {
      // The op's own request answering is the signal; then a short settle.
      // A page quiet for a few seconds without it is not going to send it (a login wall, a 404 page).
      while (Date.now() < deadline && !answered() && !(quiet() && Date.now() - lastActivity > MATCH_GRACE_MS))
        await sleep(50);
      await sleep(o.settleMs ?? 300);
      await idle(3000);
      return;
    }
    await idle();
    await sleep(o.settleMs ?? 300);
    await idle();
    if (!exchanges.some((e) => e.resourceType === "xhr" || e.resourceType === "fetch")) {
      const end = Math.min(deadline, Date.now() + FIRST_XHR_MS);
      while (Date.now() < end && !exchanges.some((e) => e.resourceType === "xhr" || e.resourceType === "fetch"))
        await sleep(50);
      await idle();
    }
  };
  /** Wait (bounded) for a challenge interstitial to solve itself; true when a real document replaced it. */
  const outwait = async () => {
    if (!(await walledNow())) return false;
    const end = Math.min(deadline, Date.now() + CHALLENGE_WAIT_MS);
    const seen = docs.length;
    while (Date.now() < end && (docs.length === seen || !docs.at(-1)!.response || walled())) await sleep(100);
    return docs.length > seen && !walled();
  };

  /** Nothing of the run is left open: neither a page it holds nor a stray tab. */
  const gone = () => [...own].every((p) => p.isClosed()) && !strays().length;
  /**
   * The end of a run, as one sequence; true when every page of the run is known to be closed.
   * A guarded run's pages are emptied before they are closed, with their sessions and the guards
   * still live. A page that is being closed still sends (its pagehide handlers fire a beacon, a
   * client re-sends what the guard just failed), and by then nothing stops it: Playwright calls no
   * route handler for a page once close() was called, and Chrome sends a request that is paused in
   * a session on to the network when the session detaches. So each page goes to about:blank under
   * the seal first: its document unloads here, what it sends last fails, and the page that is
   * closed afterwards has nothing left to send. A tab of the run that has no page (Playwright has
   * not reported it, or its opener was closed by the time it did) is closed through the browser.
   * Pages keep being adopted meanwhile, and this goes round until there is nothing new. Every
   * step is bounded: a page that will not be emptied or closed does not hold the run.
   */
  const closePages = async (): Promise<boolean> => {
    if (guard) {
      sealed = true;
      const emptied = new Set<Page>();
      for (const end = Date.now() + 3 * SEAL_MS; Date.now() < end; ) {
        await Promise.all([...adopting, ...taps.values()]);
        const fresh = [...own].filter((p) => !emptied.has(p) && !p.isClosed());
        for (const p of fresh) {
          emptied.add(p);
          const tapped = await taps.get(p);
          // A round trip through the new document, then (in `answered`) through the browser:
          // whatever the old one sent as it unloaded has been paused and failed before either returns.
          if (
            await within(
              p.goto("about:blank", { timeout: SEAL_MS }).then(() => true),
              false,
            )
          )
            await within(
              p.evaluate(() => 0),
              0,
            );
          if (tapped) await within(tapped.answered(), undefined);
        }
        while (deciding > 0 && Date.now() < end) await sleep(20);
        // Through the browser's own session: a stray has no page to close it by, and the page
        // that opened it may be gone.
        await within(Promise.resolve(tabs?.sync()), undefined);
        const lost = strays();
        for (const id of lost) await within(Promise.resolve(tabs?.close(id)), undefined);
        if (!fresh.length && !lost.length) break;
        if (lost.length) await sleep(20); // until the browser reports them gone
      }
    }
    await Promise.all([...own].map((p) => within(p.close(), undefined)));
    return gone();
  };

  try {
    if (guard) await ctx.route("**/*", guard);
    // A chat "send" goes over an open socket, where no HTTP route sees it; a popup's socket too.
    if (intercept) dropSocketSends = await guardSockets(ctx, (ex) => intercept(ex, acting));
    // in place before the first document, so that what it defers (fetchLater) passes through it
    cover(page);
    if (intercept && !(await taps.get(page))) throw new Error("could not attach the request guard to the page");
    if (o.softFrom) {
      await goto(page, o.softFrom);
      await idle(5000);
      const from = page.url();
      const before = exchanges.length;
      // A link the app rendered goes through its router; otherwise the history API plus popstate,
      // which client routers (React Router, TanStack, Next) listen to. An injected <a> would not be routed.
      const routing = page.evaluate((u) => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find(
          (a) => a.href === u && (!a.target || a.target === "_self"),
        );
        if (link) return link.click();
        try {
          history.pushState({}, "", u);
          dispatchEvent(new PopStateEvent("popstate", { state: {} }));
        } catch {
          /* cross-origin: fall through to a plain load */
        }
      }, o.url);
      await within(routing, undefined);
      await idle(5000);
      // ponytail: "fired anything" is the routed signal; a page whose analytics fire on pushState fools it.
      const routed = exchanges.slice(before).some((e) => ["xhr", "fetch", "document"].includes(e.resourceType));
      if (!routed) await goto(page, o.url, from);
    } else {
      await goto(page, o.url);
    }
    acting = true;
    // steps typed into a challenge interstitial would time out on selectors the real page has
    if (o.steps?.length) await outwait();
    for (const s of o.steps ?? []) await runStep(page, s);
    await waitForData();
    // A JS challenge (AWS WAF, Cloudflare) solves itself and reloads, often after a second or more:
    // judging now would take the interstitial for the page. Wait (bounded) for a real document.
    if (await outwait()) await waitForData();
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
    const storage = await within(
      page.evaluate(() =>
        Object.fromEntries(
          [localStorage, sessionStorage]
            .flatMap((s) => Object.keys(s).map((k) => [k, s.getItem(k) ?? ""]))
            .filter(([, v]) => v.length <= 16_384),
        ),
      ),
      {},
    );
    return {
      exchanges,
      cookies: siteCookies(await ctx.cookies(), o.url),
      finalUrl: page.url(),
      storage,
      locations: [...locations],
    };
  } finally {
    page.off("framenavigated", onNavigated);
    ctx.off("request", onRequest);
    ctx.off("requestfinished", onDone);
    ctx.off("requestfailed", onDone);
    ctx.off("response", onResponse);
    const lift = async () => {
      ctx.off("page", onPage);
      if (guard) await ctx.unroute("**/*", guard).catch(() => {});
      dropSocketSends?.();
    };
    // New tabs are still adopted while the run ends: one opened now is the run's to close as well.
    // The pages are closed before the guards are lifted: an open page still sends (a client's
    // retry; Chrome reloads an aborted navigation's error page after a second), and unrouting
    // releases what is paused.
    if (await closePages()) await lift();
    else {
      // Not known to be closed (a hung renderer, a close that failed): the guards stay until the
      // run's pages and its stray tabs are all gone, whichever goes last. That includes the socket
      // guard, though it drops every run's sends: a page that is still open can still write, and
      // time passing is no sign that it cannot. The browser is released regardless.
      const retire = () => {
        if (!gone()) return;
        tabs?.watchers.delete(retire);
        void lift();
      };
      tabs?.watchers.add(retire);
      for (const p of own) p.once("close", retire);
    }
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
    await page.route(blank, (r) =>
      r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title></title>" }),
    );
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
  /**
   * a read: when the origin page navigates mid-fetch (its own challenge or redirect destroys the
   * context), wait for it to load and fetch once more. A write is never resent: it may have left.
   */
  retryOnNavigation?: boolean;
}): Promise<PageFetchResult> {
  const timeoutMs = o.timeoutMs ?? 30_000;
  const release = hold();
  try {
    const ctx = await openBrowser(o);
    // Pseudo-headers are invalid names for fetch(); forbidden ones (cookie, host, ...) the browser drops itself.
    const headers = Object.fromEntries(Object.entries(o.headers).filter(([k]) => !k.startsWith(":")));
    const body = o.method === "GET" || o.method === "HEAD" ? undefined : o.body;
    const once = async (page: Page) => {
      const run = page.evaluate(
        async ({ url, method, headers, body, timeoutMs }) => {
          const t = performance.now();
          const r = await fetch(url, {
            method,
            headers,
            body,
            credentials: "include",
            signal: AbortSignal.timeout(timeoutMs),
          });
          const h: Record<string, string> = {};
          r.headers.forEach((v, k) => {
            h[k] = v;
          });
          const text = await r.text();
          return {
            status: r.status,
            headers: h,
            body: text,
            url: r.url,
            ms: Math.round(performance.now() - t),
            redirected: r.redirected,
          };
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
        if (/TimeoutError|timed out|signal timed out/i.test((e as Error).message))
          throw new Error(`no response within ${timeoutMs} ms`);
        throw e;
      } finally {
        clearTimeout(timer);
      }
    };
    const page = await originPage(ctx, o.origin, timeoutMs);
    try {
      return await once(page);
    } catch (e) {
      if (!o.retryOnNavigation || !/Execution context was destroyed|navigat/i.test((e as Error).message)) throw e;
      // waitForFunction outlives a context swap (a bare load-state wait can resolve on the old document)
      await page
        .waitForFunction(() => document.readyState !== "loading", undefined, { timeout: timeoutMs })
        .catch(() => {});
      // it may have landed on another origin (a challenge's redirect): start from a fresh page on ours
      let here = "";
      try {
        here = new URL(page.url()).origin;
      } catch {
        /* about:blank */
      }
      if (here !== o.origin) {
        originPages.delete(o.origin);
        await page.close().catch(() => {});
      }
      return await once(here === o.origin ? page : await originPage(ctx, o.origin, timeoutMs));
    }
  } finally {
    release();
  }
}

/**
 * Open `url` headed so the user can sign in. Resolves when they close the window or press Enter
 * in the terminal; what counts as logged in is the caller's call. Returns the site's cookies.
 */
export async function login({
  url,
  profileDir,
  waitForEnter = true,
}: {
  url: string;
  profileDir: string;
  waitForEnter?: boolean;
}): Promise<StoredCookie[]> {
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
  const poll = setInterval(
    () =>
      ctx.cookies().then(
        (c) => (snapshot = c),
        () => {},
      ),
    1000,
  );
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
