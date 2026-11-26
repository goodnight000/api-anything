/**
 * API_ANYTHING_CDP: the browser tiers in a Chromium someone else started with a DevTools port on this
 * machine, as a guest. The browser here is started by the test with its own temporary profile, and
 * stands in for the user's: a tab the user had open, and a cookie of theirs, must come through
 * untouched.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { AttachError, attachLock } from "../src/attach.js";
import {
  addCookiesToProfile,
  browserAvailable,
  browserChoice,
  clearProfileSite,
  closeBrowser,
  openBrowser,
  pageFetch,
  profileCookies,
  runTrigger,
} from "../src/browser.js";
import { call } from "../src/execute.js";
import { addOperation, capturePage, PROFILE_HINT, profileDir } from "../src/heal.js";
import { claim, lockPath } from "../src/lock.js";
import { logout } from "../src/login.js";
import { loadSession, saveSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { saveSite } from "../src/store.js";
import type { StoredCookie } from "../src/types.js";
import { type Fixture, PUBLIC_BEARER, startFixture } from "./fixture/server.js";
import {
  freePort,
  sleep,
  startUserBrowser,
  stopUserBrowser,
  type UserBrowser,
  userCookies,
  userTabs,
} from "./fixture/user-browser.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOME = mkdtempSync(join(tmpdir(), "api-anything-attach-"));
process.env.API_ANYTHING_HOME = HOME;
// before API_ANYTHING_CDP is set: the browser to start for the "user"
const BIN = browserChoice()?.bin;
const fast = { minIntervalMs: 0 };
after(() => {
  delete process.env.API_ANYTHING_CDP;
  rmSync(HOME, { recursive: true, force: true });
});

/** The rejections nothing handled while `run` ran, and a moment after. */
async function unhandledDuring(run: () => Promise<void>): Promise<string[]> {
  const seen: unknown[] = [];
  const on = (e: unknown) => seen.push(e);
  process.on("unhandledRejection", on);
  try {
    await run();
    await sleep(300);
  } finally {
    process.off("unhandledRejection", on);
  }
  return seen.map(String);
}

/** A cookie of the user's own spec's jar. */
const JAR_COOKIE: StoredCookie = {
  name: "carried",
  value: "from-the-jar",
  domain: "127.0.0.1",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: false,
};

const minTier2 = (fx: Fixture) =>
  parseSite({
    name: "attached",
    baseUrl: fx.url,
    operations: [
      {
        name: "secret",
        readOnly: true,
        minTier: 2,
        trigger: { url: `${fx.url}/private` },
        match: { method: "GET", path: "/private" },
        request: { method: "GET", url: `${fx.url}/private`, headers: {} },
        slots: [],
        volatile: [],
        params: [],
        response: { format: "json", extract: "data" },
      },
    ],
  });

describe("API_ANYTHING_CDP refused before anything connects", () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(async () => {
    delete process.env.API_ANYTHING_CDP;
    delete process.env.API_ANYTHING_PROXY;
    await closeBrowser();
    await fx.close();
  });
  const fetchOnce = () =>
    pageFetch({ origin: fx.url, url: `${fx.url}/list`, method: "GET", headers: {}, profileDir: profileDir() });

  test("the setting makes the browser tiers available, with or without a browser installed here", () => {
    process.env.API_ANYTHING_CDP = "http://127.0.0.1:9";
    assert.equal(browserAvailable(), true);
  });

  test("an endpoint that is not this machine's loopback address, or not a DevTools URL, is refused at once", async () => {
    for (const endpoint of [
      "http://10.0.0.1:9222",
      "http://192.168.1.20:9222",
      "http://[2001:db8::1]:9222",
      "http://0.0.0.0:9222",
      "ws://10.0.0.1:9222/devtools/browser/0f6e",
      "https://127.0.0.1:9222",
      "127.0.0.1:9222",
      "9222",
    ]) {
      process.env.API_ANYTHING_CDP = endpoint;
      const t0 = Date.now();
      await assert.rejects(fetchOnce(), (e: Error) => {
        assert.ok(e instanceof AttachError, `${endpoint}: ${e.message}`);
        assert.match(e.message, /API_ANYTHING_CDP/, endpoint);
        assert.ok(e.next.length > 0);
        return true;
      });
      // refused before a connection is tried: one to 10.0.0.1 would wait out its timeout
      assert.ok(Date.now() - t0 < 1000, `${endpoint} took ${Date.now() - t0} ms`);
    }
    process.env.API_ANYTHING_CDP = "http://10.0.0.1:9222";
    await assert.rejects(fetchOnce(), /loopback/);
  });

  test("nothing listening at the endpoint is refused cleanly, and a call says so in a result", async () => {
    process.env.API_ANYTHING_CDP = `http://127.0.0.1:${await freePort()}`;
    await assert.rejects(fetchOnce(), (e: Error) => e instanceof AttachError && /nothing answers/.test(e.message));
    saveSite(minTier2(fx));
    const r = await call("attached", "secret", {}, fast);
    assert.equal(r.ok, false);
    assert.equal(r.class, "error");
    assert.match(r.reason ?? "", /nothing answers/);
    assert.match(r.next ?? "", /remote-debugging-port/);
    assert.equal(
      fx.calls.filter((c) => c.path === "/private").length,
      0,
      "nothing was sent to the site, from Node either",
    );
  });

  test("the combination with API_ANYTHING_PROXY is refused", async () => {
    process.env.API_ANYTHING_CDP = "http://127.0.0.1:9222";
    process.env.API_ANYTHING_PROXY = "http://127.0.0.1:9";
    try {
      await assert.rejects(fetchOnce(), (e: Error) => e instanceof AttachError && /API_ANYTHING_PROXY/.test(e.message));
    } finally {
      delete process.env.API_ANYTHING_PROXY;
    }
  });

  /** A local server that answers /json/version as a browser's DevTools endpoint does, and nothing else. */
  const fakeDevTools = async () => {
    const server = httpServer((req, res) => {
      const { port } = server.address() as AddressInfo;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/fake` }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    return { host: `127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
  };

  test("the attach lock is in a directory of this OS user's alone, so another user's lock never blocks it", () => {
    const file = lockPath(attachLock("127.0.0.1:9222"));
    if (process.platform === "win32") return; // the temp directory is the user's own there
    const dir = dirname(file);
    assert.notEqual(dir, tmpdir(), "not in the temp directory every user shares");
    const s = statSync(dir);
    assert.equal(s.uid, process.getuid!());
    assert.equal(s.mode & 0o077, 0, "no other user can enter it");
  });

  test("a lock that cannot be opened, or a lock directory that is not this user's alone, is refused cleanly with a next", async () => {
    saveSite(minTier2(fx));
    const devtools = await fakeDevTools();
    process.env.API_ANYTHING_CDP = `http://${devtools.host}`;
    const lock = lockPath(attachLock(devtools.host));
    const refused = async (what: string, why: RegExp) => {
      await assert.rejects(fetchOnce(), (e: Error) => {
        assert.ok(e instanceof AttachError, `${what}: ${e.name}: ${e.message}`);
        assert.match(e.message, why, what);
        assert.ok(e.next.length > 0, what);
        return true;
      });
      const r = await call("attached", "secret", {}, fast);
      assert.deepEqual([r.ok, r.class], [false, "error"], `${what}: ${JSON.stringify(r)}`);
      assert.match(r.reason ?? "", why, what);
      assert.ok((r.next ?? "").length > 0, `${what}: a next`);
    };
    try {
      // what another OS user's lock file is to this process: there, and not to be opened
      rmSync(lock, { recursive: true, force: true });
      mkdirSync(lock);
      await refused("a directory in the lock's place", /lock .*could not be opened/);
      rmSync(lock, { recursive: true, force: true });
      if (process.getuid?.() !== 0) {
        writeFileSync(lock, "");
        chmodSync(lock, 0);
        await refused("a lock file this user may not open", /lock .*could not be opened/);
        rmSync(lock, { force: true });
      }
      if (process.platform !== "win32") {
        const dir = dirname(lock);
        chmodSync(dir, 0o777);
        try {
          await refused("a lock directory others may write to", /not a directory of this user's alone/);
        } finally {
          chmodSync(dir, 0o700);
        }
      }
    } finally {
      rmSync(lock, { recursive: true, force: true });
      await devtools.close();
    }
  });
});

describe("attached to a running Chromium", { skip: !BIN && "no Chromium browser installed" }, () => {
  let fx: Fixture;
  let port: number;
  let user: UserBrowser | undefined;
  /** the tab the user had open before api-anything attached */
  let tab: { id: string; url: string };
  const USER_COOKIE = "user_own_session=only-the-users";
  const sentUserCookie = () => fx.calls.some((c) => String(c.headers.cookie ?? "").includes("user_own_session"));
  /** the user signs in to the site in their own browser */
  const signIn = async () => {
    const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const [name, value] = USER_COOKIE.split("=");
    await b.contexts()[0]!.addCookies([{ name: name!, value: value!, url: fx.url }]);
    await b.close();
  };

  before(async () => {
    fx = await startFixture();
    port = await freePort();
    user = await startUserBrowser(BIN!, port, `${fx.url}/list`);
    [tab] = await userTabs(port);
    await signIn();
    process.env.API_ANYTHING_CDP = `http://localhost:${port}`;
  });
  after(async () => {
    await closeBrowser();
    delete process.env.API_ANYTHING_CDP;
    await stopUserBrowser(user);
    await fx.close();
    rmSync(lockPath(attachLock(`127.0.0.1:${port}`)), { force: true });
  });

  test("a tier-3 trigger run and a tier-2 page fetch answer, in tabs of api-anything's own", async () => {
    const r = await runTrigger({ url: `${fx.url}/u/alice`, profileDir: profileDir() });
    const gql = r.exchanges.find((e) => e.request.url.includes("/UserByName?"));
    assert.equal(gql?.response?.status, 200);
    assert.equal(JSON.parse(gql?.response?.body ?? "").data.user.name, "alice");
    const ct0 = r.cookies.find((c) => c.name === "ct0");
    assert.ok(ct0, "the run's own cookies come back");
    const f = await pageFetch({
      origin: fx.url,
      url: gql!.request.url,
      method: "GET",
      headers: { "x-csrf-token": ct0.value, authorization: PUBLIC_BEARER },
      profileDir: profileDir(),
      // the jar the run's cookies were merged into, as a call of the user's own spec passes it
      jar: r.cookies,
    });
    assert.equal(f.status, 200);
    assert.equal(JSON.parse(f.body).data.user.name, "alice");
    // while attached, the user's tab is still there and api-anything's are beside it
    assert.ok((await userTabs(port)).some((t) => t.id === tab.id && t.url === tab.url));
    assert.equal(sentUserCookie(), false, "the user's own cookie never reaches a request of api-anything's");
  });

  test("add learns an operation in the attached browser, and calls of it answer at tiers 1 and 3", async () => {
    const r = await addOperation({
      site: "fixture",
      op: "getUser",
      trigger: { url: `${fx.url}/u/{name}` },
      examples: [{ name: "alice" }, { name: "bob" }],
      response: { extract: "data.user", pick: ["name"] },
    });
    assert.equal(r.operation.minTier, 1, r.warnings.join("\n"));
    const one = await call("fixture", "getUser", { name: "carol" }, fast);
    assert.equal(one.ok, true, JSON.stringify(one));
    fx.setRequireSignature(true);
    try {
      const feed = await addOperation({
        site: "fixture",
        op: "feed",
        trigger: { url: `${fx.url}/feed` },
        examples: [{}],
        match: { path: "/api/signed/feed" },
      });
      assert.equal(feed.operation.minTier, 3, feed.warnings.join("\n"));
      const three = await call("fixture", "feed", {}, fast);
      assert.equal(three.ok, true, JSON.stringify(three));
      assert.equal(three.tier, 3);
    } finally {
      fx.setRequireSignature(false);
    }
    assert.equal(sentUserCookie(), false);
  });

  test("the jar's cookies of the user's own spec reach the attached tabs; the browser's own sign-in never does", async () => {
    saveSite(minTier2(fx));
    const session: StoredCookie = {
      name: "session",
      value: "from-the-jar",
      domain: "127.0.0.1",
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: false,
    };
    saveSession("attached", { cookies: [session], values: {} });
    const r = await call("attached", "secret", {}, fast);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 2);
    assert.deepEqual(r.data, { secret: "only for you" });
    assert.equal(sentUserCookie(), false);
    // tier 1 still sends from the sealed jar, which holds no cookie of the user's browser
    assert.deepEqual(
      loadSession("attached").cookies.map((c) => c.name),
      ["session"],
    );
  });

  test("one process at a time is attached: another waits for it, then fails with the profile's hint", async () => {
    await closeBrowser();
    // what another api-anything process attached to this browser holds
    const release = await claim(attachLock(`127.0.0.1:${port}`), 0);
    assert.ok(release);
    try {
      const t0 = Date.now();
      const r = await call("attached", "secret", {}, fast);
      assert.equal(r.ok, false);
      assert.match(r.reason ?? "", /in use by another api-anything process/);
      assert.equal(r.next, PROFILE_HINT);
      assert.ok(Date.now() - t0 >= 14_000, "it waited for the other process first");
    } finally {
      release();
    }
    await assert.doesNotReject(
      pageFetch({ origin: fx.url, url: `${fx.url}/list`, method: "GET", headers: {}, profileDir: profileDir() }),
    );
    const again = await claim(attachLock(`127.0.0.1:${port}`), 0);
    again?.();
    assert.equal(again, undefined, "the lock is held while attached");
  });

  test("api-anything's own profile is never opened while attached, and nothing in the user's browser is cleared", async () => {
    await assert.rejects(profileCookies({ url: fx.url, profileDir: profileDir() }), AttachError);
    await assert.rejects(
      addCookiesToProfile(
        [{ name: "a", value: "b", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false }],
        profileDir(),
      ),
      AttachError,
    );
    await assert.rejects(clearProfileSite("127.0.0.1", profileDir()), AttachError);
    const out = await logout("attached");
    assert.equal(out.session, true, "the jar is removed");
    assert.notEqual(out.profile, "cleared");
    assert.equal(existsSync(profileDir()), false, "no browser profile of api-anything's was made or opened");
    assert.ok((await userCookies(port)).includes(USER_COOKIE), "the user's cookie is still in their browser");
  });

  test("logout while attached leaves none of the site's cookies in api-anything's context, and the next call carries none", async () => {
    saveSite(minTier2(fx));
    const session = { ...JAR_COOKIE, name: "session", value: fx.mintSession() };
    saveSession("attached", { cookies: [session], values: {} });
    const signedIn = await call("attached", "secret", {}, fast);
    assert.equal(signedIn.ok, true, JSON.stringify(signedIn));
    const ctx = await openBrowser({ profileDir: profileDir() });
    assert.ok(
      (await ctx.cookies()).some((c) => c.name === "session"),
      "the call's context holds the jar's cookie",
    );
    await logout("attached");
    assert.deepEqual(
      (await ctx.cookies()).filter((c) => c.domain.replace(/^\./, "") === "127.0.0.1").map((c) => c.name),
      [],
      "the context the call left open holds none of the site's cookies",
    );
    const after = await call("attached", "secret", {}, fast);
    assert.notEqual(after.ok, true, JSON.stringify(after));
    assert.equal(
      loadSession("attached").cookies.some((c) => c.name === "session"),
      false,
      "no run merged the old sign-in back into the jar",
    );
    assert.ok((await userCookies(port)).includes(USER_COOKIE), "the user's own context is untouched");
  });

  test("a run that carries no stored cookies, right after or during one that carries the jar, carries none of it; neither breaks the other", async () => {
    const sent = (tag: string) =>
      fx.calls.filter((c) => c.path.includes(`tag=${tag}`)).map((c) => String(c.headers.cookie ?? ""));
    const page = (tag: string) => `${fx.url}/api/result-list?tag=${tag}`;
    const carried = `${JAR_COOKIE.name}=${JAR_COOKIE.value}`;
    await runTrigger({ url: page("own1"), profileDir: profileDir(), jar: [JAR_COOKIE] });
    await capturePage({ url: page("bare1") });
    assert.ok(sent("own1").length && sent("own1").every((h) => h.includes(carried)), JSON.stringify(sent("own1")));
    assert.ok(sent("bare1").length && sent("bare1").every((h) => !h.includes(carried)), JSON.stringify(sent("bare1")));
    // at once: the jar's run loads a second page after the bare run has started
    const own = runTrigger({
      url: page("own2"),
      profileDir: profileDir(),
      jar: [JAR_COOKIE],
      steps: [
        { action: "wait", ms: 2000 },
        { action: "goto", value: page("own3") },
      ],
    });
    await sleep(500);
    const bare = capturePage({ url: page("bare2") });
    const [o, b] = await Promise.all([own, bare]);
    for (const tag of ["own2", "own3"])
      assert.ok(
        sent(tag).length && sent(tag).every((h) => h.includes(carried)),
        `${tag}: ${JSON.stringify(sent(tag))}`,
      );
    assert.ok(sent("bare2").length && sent("bare2").every((h) => !h.includes(carried)), JSON.stringify(sent("bare2")));
    assert.ok(o.cookies.some((c) => c.name === JAR_COOKIE.name));
    assert.equal(
      b.cookies.some((c) => c.name === JAR_COOKIE.name),
      false,
      "the bare run read none of the jar back",
    );
    assert.equal(sentUserCookie(), false);
  });
  test("idle close and closeBrowser() leave the browser and the user's tab as they were, and take api-anything's tabs", async () => {
    await runTrigger({ url: `${fx.url}/u/alice`, profileDir: profileDir() });
    await pageFetch({ origin: fx.url, url: `${fx.url}/list`, method: "GET", headers: {}, profileDir: profileDir() });
    assert.ok((await userTabs(port)).length > 1, "api-anything's tab is open while it is busy");
    // the idle close comes 3 s after the last use
    await sleep(4500);
    assert.deepEqual(await userTabs(port), [tab]);
    assert.equal(user!.proc.exitCode, null, "the browser is still running");
    await pageFetch({ origin: fx.url, url: `${fx.url}/list`, method: "GET", headers: {}, profileDir: profileDir() });
    await closeBrowser();
    assert.deepEqual(await userTabs(port), [tab]);
    assert.equal(user!.proc.exitCode, null);
    assert.ok((await userCookies(port)).includes(USER_COOKIE));
  });

  test("the browser going away mid-run fails the call with the reason; the next fails cleanly, and recovers once it is back", async () => {
    const unhandled = await unhandledDuring(async () => {
      const t0 = Date.now();
      let ended = 0;
      const run = runTrigger({
        url: `${fx.url}/u/alice`,
        profileDir: profileDir(),
        timeoutMs: 20_000,
        steps: [{ action: "wait", ms: 15_000 }],
      }).then(
        () => assert.fail("the run answered with its browser gone"),
        (e: Error) => {
          ended = Date.now();
          return e;
        },
      );
      await sleep(2000);
      const killed = Date.now();
      await stopUserBrowser(user);
      user = undefined;
      assert.match((await run).message, /^the attached browser \(API_ANYTHING_CDP\) went away during the call: /);
      assert.ok(
        ended - killed < 8000,
        `the run took ${ended - killed} ms to fail after the browser went (${ended - t0} in all)`,
      );
      await assert.rejects(
        pageFetch({ origin: fx.url, url: `${fx.url}/list`, method: "GET", headers: {}, profileDir: profileDir() }),
        (e: Error) => e instanceof AttachError && /nothing answers/.test(e.message),
      );
      user = await startUserBrowser(BIN!, port, `${fx.url}/list`);
      const back = await runTrigger({ url: `${fx.url}/u/alice`, profileDir: profileDir() });
      assert.ok(back.exchanges.some((e) => e.request.url.includes("/UserByName?") && e.response?.status === 200));
      [tab] = await userTabs(port);
      await signIn();
    });
    assert.deepEqual(unhandled, []);
  });

  const childEnv = () => {
    const env: NodeJS.ProcessEnv = { ...process.env, API_ANYTHING_CDP: `http://127.0.0.1:${port}` };
    // each file makes a home of its own; and node --test skips the files of a run started inside a test
    delete env.API_ANYTHING_HOME;
    delete env.NODE_TEST_CONTEXT;
    return env;
  };
  /** One `node --test` run of existing test files, with this browser attached. */
  const suite = (files: string[], pattern?: string) =>
    new Promise<{ code: number; out: string }>((resolve) =>
      execFile(
        process.execPath,
        [
          "--import",
          "tsx",
          "--test",
          "--test-reporter=tap",
          // one file at a time, as one process at a time attaches to a browser
          "--test-concurrency=1",
          ...(pattern ? [`--test-name-pattern=${pattern}`] : []),
          ...files,
        ],
        {
          cwd: ROOT,
          env: childEnv(),
          maxBuffer: 64 * 1024 * 1024,
          timeout: 15 * 60_000,
        },
        (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, out: stdout + stderr }),
      ),
    );
  const counts = (out: string) =>
    Object.fromEntries(
      ["tests", "pass", "fail", "skipped", "cancelled"].map((k) => [
        k,
        Number(new RegExp(`^# ${k} (\\d+)`, "m").exec(out)?.[1] ?? Number.NaN),
      ]),
    );

  // the files that prove the write guards, the socket guard and the dialog answers, as they are
  const WHOLE = ["test/write-guards.test.ts", "test/dialogs.test.ts", "test/edge/round2-browser.test.ts"];
  const PICKED = ["test/browser.test.ts", "test/edge/browser-surface.test.ts"];
  const GUARD_TESTS =
    "write interception|intercept aborts|capture --write|cannot perform a write|still sends no write|known write's match|no page yet when the run ends|opener has closed|only page closes|socket guard";

  test("the existing write-guard, WebSocket-guard and dialog tests pass in attached mode", {
    timeout: 1_800_000,
  }, async () => {
    // the files' processes take the browser in turn
    await closeBrowser();
    const whole = await suite(WHOLE);
    const picked = await suite(PICKED, GUARD_TESTS);
    for (const [name, r] of [
      ["whole files", whole],
      ["picked tests", picked],
    ] as const) {
      const n = counts(r.out);
      const failed = r.out.split("\n").filter((l) => /^\s*not ok /.test(l));
      assert.equal(r.code, 0, `${name}: ${failed.join("\n")}\n${r.out.slice(-4000)}`);
      assert.equal(n.fail, 0, `${name}: ${r.out.slice(-4000)}`);
      assert.equal(n.cancelled, 0, name);
      assert.equal(n.skipped, 0, `${name}: nothing is skipped for want of a browser`);
      assert.ok(n.pass >= (name === "whole files" ? 30 : 15), `${name}: ${JSON.stringify(n)}`);
    }
    assert.deepEqual(await userTabs(port), [tab], "the runs left the user's tab alone and took their own");
    assert.ok((await userCookies(port)).includes(USER_COOKIE));
    assert.equal(sentUserCookie(), false);
  });

  test("the stream tests' browser cases pass in attached mode", { timeout: 900_000 }, async () => {
    await closeBrowser();
    const r = await suite(["test/stream.test.ts"]);
    const n = counts(r.out);
    const failed = r.out.split("\n").filter((l) => /^\s*not ok /.test(l));
    assert.equal(r.code, 0, `${failed.join("\n")}\n${r.out.slice(-4000)}`);
    assert.equal(n.fail, 0, r.out.slice(-4000));
    assert.equal(n.cancelled, 0);
    assert.equal(n.skipped, 0, "nothing is skipped for want of a browser");
    // the file's browser cases, learned and called at every tier, among the rest
    assert.ok(n.pass >= 30, JSON.stringify(n));
    assert.match(r.out, /^\s*ok \d+ - learned and called at every tier$/m);
    assert.deepEqual(await userTabs(port), [tab], "the runs left the user's tab alone and took their own");
    assert.ok((await userCookies(port)).includes(USER_COOKIE));
    assert.equal(sentUserCookie(), false);
  });
});
