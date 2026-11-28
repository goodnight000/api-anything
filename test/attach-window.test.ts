/**
 * The sign-in window while attached (API_ANYTHING_CDP): a tab of api-anything's own context in the
 * browser the user runs, never a window of api-anything's own profile. A bot challenge the "user"
 * clears there, a consent they answer and a sign-in they make reach the next calls in that browser,
 * by the hint the call answered with; the user's own tab and cookie come through untouched.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Page } from "playwright-core";
import { AttachError, attachLock } from "../src/attach.js";
import { browserChoice, closeBrowser, openBrowser, ProfileInUse, pageFetch } from "../src/browser.js";
import { call, stepOf } from "../src/execute.js";
import { addOperation, profileDir } from "../src/heal.js";
import { resolver } from "../src/http.js";
import { learnSite } from "../src/learnsite.js";
import { claim, lockPath } from "../src/lock.js";
import { resolveLoginTarget, windowLogin } from "../src/login.js";
import { createServer } from "../src/mcp.js";
import { loadSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { cooling, loadSite, saveSite } from "../src/store.js";
import { type Fixture, FLIGHTS, startFixture } from "./fixture/server.js";
import {
  freePort,
  sleep,
  startUserBrowser,
  stopUserBrowser,
  type UserBrowser,
  userCookies,
  userSignIn,
  userTabs,
} from "./fixture/user-browser.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-attach-window-"));
process.env.API_ANYTHING_HOME = HOME;
// before API_ANYTHING_CDP is set: the browser to start for the "user"
const BIN = browserChoice()?.bin;
const fast = { minIntervalMs: 0 };
after(() => {
  delete process.env.API_ANYTHING_CDP;
  rmSync(HOME, { recursive: true, force: true });
});

/** One read of `path` at `minTier`, the page `trigger` its tier-3 run opens. */
const read = (base: string, name: string, path: string, minTier: 2 | 3, extract: string, trigger = path) => ({
  name,
  readOnly: true,
  minTier,
  trigger: { url: `${base}${trigger}` },
  match: { method: "GET", path: path.split("?")[0] },
  request: { method: "GET", url: `${base}${path}`, headers: {} },
  slots: [],
  volatile: [],
  params: [],
  response: { format: "json", extract },
});

/** The window's tab, once it shows a page whose address holds `part`: what the user sees. */
async function windowTab(part: string): Promise<Page> {
  for (let i = 0; i < 300; i++) {
    await sleep(100);
    const ctx = await openBrowser({ profileDir: profileDir(), headless: false });
    const page = ctx.pages().find((p) => p.url().includes(part));
    if (page) return page;
  }
  throw new Error(`no tab of api-anything's showed ${part}`);
}

/** The user closes the window's tab, once the window has read the jar after what they did. */
async function userCloses(page: Page): Promise<void> {
  await sleep(1200);
  await page.close({ runBeforeUnload: true });
}

describe("the sign-in window in an attached browser", { skip: !BIN && "no Chromium browser installed" }, () => {
  let fx: Fixture;
  let port: number;
  let user: UserBrowser | undefined;
  /** the tab the user had open before api-anything attached */
  let tab: { id: string; url: string };
  const USER_COOKIE = "user_own_session=only-the-users";
  const sentUserCookie = () => fx.calls.some((c) => String(c.headers.cookie ?? "").includes("user_own_session"));
  /** the user's browser is as they left it: their tab alone, their cookie, none of the window's */
  const untouched = async (...windowCookies: string[]) => {
    assert.deepEqual(await userTabs(port), [tab], "only the user's own tab is open");
    const theirs = await userCookies(port);
    assert.ok(theirs.includes(USER_COOKIE), "the user's cookie is still in their browser");
    for (const name of windowCookies)
      assert.ok(!theirs.some((c) => c.startsWith(`${name}=`)), `${name} is not in the user's own context`);
    assert.equal(sentUserCookie(), false, "the user's own cookie never reaches a request of api-anything's");
    assert.equal(existsSync(profileDir()), false, "api-anything's own profile was never made or opened");
  };

  before(async () => {
    fx = await startFixture();
    port = await freePort();
    user = await startUserBrowser(BIN!, port, `${fx.url}/list`);
    [tab] = await userTabs(port);
    await userSignIn(port, fx.url, USER_COOKIE);
    process.env.API_ANYTHING_CDP = `http://127.0.0.1:${port}`;
  });
  after(async () => {
    await closeBrowser();
    delete process.env.API_ANYTHING_CDP;
    await stopUserBrowser(user);
    await fx.close();
    rmSync(lockPath(attachLock(`127.0.0.1:${port}`)), { force: true });
  });

  test("a challenge: the call's login step, followed over MCP, opens the tab; what the user cleared there answers at tiers 2 and 3, and after an idle close", async () => {
    saveSite(
      parseSite({
        name: "gate",
        baseUrl: `${fx.url}/gate/`,
        operations: [
          read(fx.url, "data", "/api/gate/data", 2, "data.items", "/gate/"),
          read(fx.url, "page", "/api/gate/data", 3, "data.items", "/gate/"),
        ],
      }),
    );
    const walled = await call("gate", "data", {}, fast);
    assert.equal(walled.class, "blocked", JSON.stringify(walled));
    assert.deepEqual(walled.nextCall, { action: "login", mode: "window", site: "gate", op: "data" });
    assert.match(walled.next ?? "", /api-anything login gate --window \(a new window of the browser the user runs/);
    assert.ok(cooling("gate"), "the site cools down, as any blocked one");

    const client = new Client({ name: "agent", version: "0" });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await createServer({ waitMs: 120_000 }).connect(x);
    await client.connect(y);
    try {
      const pending = client.callTool({
        name: "login",
        arguments: { site: walled.nextCall!.site, mode: walled.nextCall!.mode },
      });
      const page = await windowTab("/gate/");
      assert.equal(await page.title(), "Just a moment...", "the window shows the challenge");
      assert.ok((await userTabs(port)).length > 1, "the window is a tab of the browser the user runs");
      await page.click("#verify");
      await page.waitForSelector("#through");
      await userCloses(page);
      const r = JSON.parse(((await pending).content as { text: string }[])[0]!.text);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual([r.loggedIn, r.kept], [false, ["gate_clearance"]]);
    } finally {
      await client.close();
    }
    assert.equal(cooling("gate"), undefined, "the window ended the cool-down");
    assert.ok(
      loadSession("gate").cookies.some((c) => c.name === "gate_clearance"),
      "the clearance is in the jar",
    );
    // the window closed its own tab and nothing else: the call's page stays until the context is idle
    assert.ok(!(await userTabs(port)).some((t) => t.url.includes("/gate/")), "the window's tab is gone");
    for (const [op, tier] of [
      ["data", 2],
      ["page", 3],
    ] as const) {
      const r = await call("gate", op, {}, fast);
      assert.equal(r.ok, true, `${op}: ${JSON.stringify(r)}`);
      assert.equal(r.tier, tier);
      assert.deepEqual(r.data, ["past the gate"]);
    }
    await sleep(4500);
    assert.deepEqual(await userTabs(port), [tab], "idle close took api-anything's tabs");
    const again = await call("gate", "data", {}, fast);
    assert.equal(again.ok, true, JSON.stringify(again));
    assert.equal(again.tier, 2);
    await closeBrowser();
    await untouched("gate_clearance");
  });

  test("past the challenge, add learns the page; capture and learn_site, which carry no stored cookies, say to use add", async () => {
    const added = await addOperation({
      site: "gate",
      op: "learned",
      trigger: { url: `${fx.url}/gate/` },
      examples: [{}],
      match: { path: "/api/gate/data" },
      response: { extract: "data.items" },
    });
    assert.equal(added.operation.name, "learned", added.warnings.join("\n"));
    // the context add's runs used is still open, holding the jar's clearance: learn_site's runs carry none of it
    const learned = await learnSite(
      { site: "gate", trigger: `${fx.url}/gate/{q}`, args: { q: "a" }, args2: { q: "b" }, args3: { q: "c" } },
      fast,
    );
    assert.equal(learned.ok, false, JSON.stringify(learned));
    assert.match(learned.error ?? "", /bot challenge/);
    assert.match(
      learned.next ?? "",
      /api-anything login gate --window \(a new window of the browser the user runs.*api-anything add gate/,
    );
    await closeBrowser();
    await untouched("gate_clearance");
  });

  test("a consent wall: the call's next, followed as the CLI would, opens the tab; the choice the user made there answers at tier 2", async () => {
    saveSite(
      parseSite({
        name: "eu",
        baseUrl: `${fx.url}/eu/flights?q=AMS`,
        operations: [read(fx.url, "flights", "/api/eu/flights?q=AMS", 2, "flights", "/eu/flights?q=AMS")],
      }),
    );
    const walled = await call("eu", "flights", {}, fast);
    assert.deepEqual([walled.class, walled.wall], ["error", "consent"], JSON.stringify(walled));
    assert.deepEqual(walled.nextCall, { action: "login", mode: "window", site: "eu", op: "flights" });
    const target = /api-anything login (\S+) --window \(a new window of the browser the user runs/.exec(
      walled.next ?? "",
    )?.[1];
    assert.equal(target, "eu", walled.next ?? "");
    const t = resolveLoginTarget(target);
    const pending = windowLogin(t.site, t.url, { loginCookies: t.loginCookies, waitForEnter: false });
    const page = await windowTab("/eu/consent");
    await page.click("text=Reject all");
    await page.waitForURL(/\/eu\/flights\?q=AMS/);
    await userCloses(page);
    const w = await pending;
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(w.ok && w.kept, ["eu_choice"]);
    const r = await call("eu", "flights", {}, fast);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 2);
    assert.equal((r.data as unknown[]).length, FLIGHTS.AMS!.length);
    await closeBrowser();
    await untouched("eu_choice");
  });

  test("a sign-in in the window keeps the session as it does unattached, and the next window starts signed in", async () => {
    saveSite(
      parseSite({
        name: "members",
        baseUrl: `${fx.url}/members`,
        operations: [read(fx.url, "me", "/api/members/me", 2, "data", "/members")],
      }),
    );
    const url = `${fx.url}/members`;
    const pending = windowLogin("members", url, { waitForEnter: false });
    const page = await windowTab("/members");
    await page.goto(`${fx.url}/members/signin`);
    await userCloses(page);
    const w = await pending;
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(w.ok && w.renewed, ["auth_token"]);
    const s = loadSession("members");
    assert.equal(s.source, "window");
    assert.deepEqual(s.guestCookies, ["app_session"]);
    assert.ok(s.cookies.some((c) => c.name === "auth_token"));
    const r = await call("members", "me", {}, fast);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 2);
    assert.deepEqual(r.data, { name: "alice" });
    // the window starts with the stored session, as api-anything's own profile would hold it: reopened
    // and closed, it proves nothing new
    const again = windowLogin("members", url, { waitForEnter: false });
    await userCloses(await windowTab("/members"));
    const w2 = await again;
    assert.equal(w2.ok, false);
    assert.match(w2.ok ? "" : w2.reason, /no new sign-in: the window already held auth_token when it opened/);
    await closeBrowser();
    await untouched("auth_token", "app_session");
  });

  test("ending one sign-in tab ends that tab alone: another window's tab and a call in flight go on", async () => {
    saveSite(
      parseSite({
        name: "duo",
        baseUrl: `${fx.url}/list`,
        operations: [read(fx.url, "slow", "/api/slow/data?ms=2500", 2, "data", "/list")],
      }),
    );
    const first = windowLogin("duo", `${fx.url}/list?w=1`, { waitForEnter: false });
    const one = await windowTab("w=1");
    const stop = new AbortController();
    const second = windowLogin("duo", `${fx.url}/list?w=2`, { waitForEnter: false, signal: stop.signal });
    const two = await windowTab("w=2");
    const third = windowLogin("duo", `${fx.url}/list?w=3`, { waitForEnter: false });
    const three = await windowTab("w=3");
    const inFlight = call("duo", "slow", {}, fast);
    await sleep(500);
    // the user closes the first tab while the call's page waits for its answer
    await one.close({ runBeforeUnload: true });
    await first;
    assert.deepEqual([two.isClosed(), three.isClosed()], [false, false], "the other windows' tabs are still open");
    // the MCP server's cap ends its window the same way: that tab alone
    stop.abort();
    await second;
    assert.deepEqual([two.isClosed(), three.isClosed()], [true, false], "the capped window closed its own tab only");
    const r = await inFlight;
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, ["slow"]);
    await three.close({ runBeforeUnload: true });
    await third;
    await closeBrowser();
    await untouched();
  });

  test("what the window keeps is read after the last thing the user did, however soon the tab closes", async () => {
    // a cookie a script sets, and one a response sets, each the moment before the tab closes
    const cases: [string, (p: Page) => Promise<void>, string][] = [
      [
        "late-script",
        async (p) => {
          await p.evaluate("document.cookie = 'late_choice=yes; path=/'");
        },
        "late_choice",
      ],
      [
        "late-response",
        async (p) => void (await p.goto(`${fx.url}/eu/consent/save?choice=reject&continue=%2Feu%2Fflights`)),
        "eu_choice",
      ],
    ];
    for (const [site, act, name] of cases) {
      const pending = windowLogin(site, `${fx.url}/list?late=${site}`, { waitForEnter: false });
      const page = await windowTab(`late=${site}`);
      // the window has read the page as it opened
      await sleep(700);
      await act(page);
      await page.close({ runBeforeUnload: true });
      const w = await pending;
      assert.equal(w.ok, true, `${site}: ${JSON.stringify(w)}`);
      assert.ok(w.ok && w.kept?.includes(name), `${site}: ${JSON.stringify(w)}`);
      assert.ok(
        loadSession(site).cookies.some((c) => c.name === name),
        `${site}: ${name} is in the jar`,
      );
    }
    await closeBrowser();
    await untouched("late_choice", "eu_choice");
  });
  test("the window while another process is attached fails as ProfileInUse, after the wait, and over MCP says to wait", async () => {
    await closeBrowser();
    const release = await claim(attachLock(`127.0.0.1:${port}`), 0);
    assert.ok(release);
    const client = new Client({ name: "agent", version: "0" });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await createServer({ waitMs: 60_000 }).connect(x);
    await client.connect(y);
    try {
      const t0 = Date.now();
      await assert.rejects(windowLogin("members", `${fx.url}/members`, { waitForEnter: false }), (e: Error) => {
        assert.ok(e instanceof ProfileInUse, e.message);
        assert.match(e.message, /in use by another api-anything process/);
        return true;
      });
      assert.ok(Date.now() - t0 >= 14_000, "it waited for the other process first");
      const r = JSON.parse(
        (
          (await client.callTool({ name: "login", arguments: { site: "members", mode: "window" } })).content as {
            text: string;
          }[]
        )[0]!.text,
      );
      assert.equal(r.ok, false);
      assert.match(r.error, /in use by another api-anything process/);
      assert.match(r.next, /holds the browser profile; it lets go after a few seconds idle/);
    } finally {
      release();
      await client.close();
    }
    await untouched();
  });

  test("the window with nothing at the endpoint fails at once with the attach hint, and the site is sent nothing", async () => {
    const was = process.env.API_ANYTHING_CDP;
    process.env.API_ANYTHING_CDP = `http://127.0.0.1:${await freePort()}`;
    const asked = () => fx.calls.filter((c) => c.path.startsWith("/members")).length;
    const before = asked();
    try {
      const t0 = Date.now();
      await assert.rejects(
        windowLogin("members", `${fx.url}/members`, { waitForEnter: false }),
        (e: Error) =>
          e instanceof AttachError && /nothing answers/.test(e.message) && /remote-debugging-port/.test(e.next),
      );
      assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms`);
      assert.equal(asked(), before, "no guest probe reached the site");
      // loopback CDP with API_ANYTHING_PROXY set still resolves cleanly to the DevTools check
      process.env.API_ANYTHING_CDP = `http://127.0.0.1:${await freePort()}`;
      process.env.API_ANYTHING_PROXY = "http://127.0.0.1:9";
      await assert.rejects(
        windowLogin("members", `${fx.url}/members`, { waitForEnter: false }),
        (e: Error) => e instanceof AttachError && /nothing answers/.test(e.message),
      );
      assert.equal(asked(), before, "no guest probe reached the site");
    } finally {
      process.env.API_ANYTHING_CDP = was;
      delete process.env.API_ANYTHING_PROXY;
    }
  });

  test("a pulled spec walled while attached: the hint sends the user to api-anything's own browser, and following it answers", async () => {
    // a spec someone else wrote is https-only; its walls, met at tier 1 here, say what a call would
    saveSite(
      parseSite({
        name: "gate-pulled",
        baseUrl: "https://gate.example.com/",
        operations: [
          {
            ...read("https://gate.example.com", "data", "/api/gate/data", 2, "data.items", "/gate/"),
            minTier: 1,
          },
        ],
        shared: { from: "https://registry.example/v1/sites/gate-pulled", sha256: "0".repeat(64) },
      }),
    );
    // the site sends a visitor to its consent step: met at tier 1, which climbs no further for it
    const consentAt = "https://gate.example.com/consent?continue=%2Fapi%2Fgate%2Fdata";
    const fetchImpl = (async (input: string | URL | Request) =>
      String(input).includes("/consent")
        ? new Response(
            '<!doctype html><html><head><title>Before you continue</title></head><body><p>We use cookies.</p><form action="/consent/save"><button name="choice" value="reject">Reject all</button></form></body></html>',
            { status: 200, headers: { "content-type": "text/html" } },
          )
        : new Response("", { status: 302, headers: { location: consentAt } })) as unknown as typeof fetch;
    // a public address, as the guard on someone else's spec asks; no DNS query leaves the machine
    const realLookup = resolver.lookup;
    resolver.lookup = async () => [{ address: "93.184.215.14" }];
    let walled: Awaited<ReturnType<typeof call>>;
    try {
      walled = await call("gate-pulled", "data", {}, { ...fast, fetchImpl });
    } finally {
      resolver.lookup = realLookup;
    }
    assert.deepEqual([walled.class, walled.wall], ["error", "consent"], JSON.stringify(walled));
    assert.match(
      walled.next ?? "",
      /pulled from the catalog.*attached browser.*unset API_ANYTHING_CDP and run api-anything login gate-pulled --window/,
    );
    assert.deepEqual(walled.nextCall, { action: "report", site: "gate-pulled", op: "data" });
    // a challenge the browser tiers met says the same step
    const pulled = loadSite("gate-pulled")!.site.operations[0]!;
    assert.deepEqual(
      stepOf({ tier: 2, class: "blocked", reason: "Cloudflare challenge page (HTTP 403)" }, pulled, "gate-pulled")
        .nextCall,
      {
        action: "report",
      },
    );
    // the user's own spec keeps the window: the attached window does reach its calls
    assert.deepEqual(stepOf({ tier: 2, class: "blocked", reason: "x" }, pulled, "gate").nextCall, {
      action: "login",
      mode: "window",
    });
    // followed as written: in api-anything's own browser the window keeps the clearance in the profile,
    // and a page fetch with nothing of the jar put in (as a pulled spec's is sent) carries it
    await closeBrowser();
    const was = process.env.API_ANYTHING_CDP;
    delete process.env.API_ANYTHING_CDP;
    try {
      const pending = windowLogin("gate-pulled-own", `${fx.url}/gate/`, { waitForEnter: false });
      const page = await windowTab("/gate/");
      await page.click("#verify");
      await page.waitForSelector("#through");
      await userCloses(page);
      assert.equal((await pending).ok, true);
      const r = await pageFetch({
        origin: fx.url,
        url: `${fx.url}/api/gate/data`,
        method: "GET",
        headers: {},
        profileDir: profileDir(),
      });
      assert.equal(r.status, 200, r.body.slice(0, 200));
      assert.match(r.body, /past the gate/);
    } finally {
      await closeBrowser();
      process.env.API_ANYTHING_CDP = was;
      rmSync(profileDir(), { recursive: true, force: true });
    }
  });
  test("the browser killed while the window waits fails the login with the reason, keeps the session, and leaves nothing hanging", async () => {
    const before = loadSession("members");
    const seen: unknown[] = [];
    const on = (e: unknown) => seen.push(e);
    process.on("unhandledRejection", on);
    try {
      const pending = windowLogin("members", `${fx.url}/members`, { waitForEnter: false }).then(
        () => assert.fail("the window answered with its browser gone"),
        (e: Error) => e,
      );
      await windowTab("/members");
      const killed = Date.now();
      await stopUserBrowser(user);
      user = undefined;
      const e = await pending;
      assert.ok(e instanceof AttachError, e.message);
      assert.match(e.message, /the attached browser \(API_ANYTHING_CDP\) went away while the sign-in window was open/);
      assert.ok(Date.now() - killed < 8000, `it took ${Date.now() - killed} ms to fail`);
      assert.deepEqual(loadSession("members"), before, "the stored session is as it was");
      await sleep(300);
    } finally {
      process.off("unhandledRejection", on);
    }
    assert.deepEqual(seen.map(String), []);
    // the next window, with the browser still gone, fails as any attached call does
    await assert.rejects(
      windowLogin("members", `${fx.url}/members`, { waitForEnter: false }),
      (e: Error) => e instanceof AttachError && /nothing answers/.test(e.message),
    );
  });
});
