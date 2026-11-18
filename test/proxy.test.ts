import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, describe, test } from "node:test";
import { browserAvailable, closeBrowser, openBrowser } from "../src/browser.js";
import { call } from "../src/execute.js";
import { RedirectRefused, send } from "../src/http.js";
import { guestCookieNames } from "../src/login.js";
import {
  browserProxy,
  bypassList,
  CleartextRefused,
  proxied,
  proxyConfig,
  redactProxy,
  refuseCleartext,
  siteFetch,
} from "../src/proxy.js";
import { type Session, saveSession } from "../src/session.js";
import { OperationSchema, parseSite } from "../src/spec.js";
import { saveSite } from "../src/store.js";
import { type FixtureProxy, startProxy } from "./fixture/proxy.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-proxy-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const cfg = (proxy: string, noProxy = "") =>
  proxyConfig({ API_ANYTHING_PROXY: proxy, API_ANYTHING_NO_PROXY: noProxy })!;

describe("proxy config", () => {
  test("nothing set, or only the standard variables: no proxy", () => {
    assert.equal(proxyConfig({}), undefined);
    assert.equal(proxyConfig({ API_ANYTHING_PROXY: "  " }), undefined);
    assert.equal(
      proxyConfig({ HTTPS_PROXY: "http://p:1", HTTP_PROXY: "http://p:1", https_proxy: "http://p:1" }),
      undefined,
    );
    assert.equal(proxied("https://a.com/", undefined), false);
  });

  test("NO_PROXY entries tier 1 cannot match as Chrome would, and undecodable credentials, are refused", () => {
    for (const e of ["10.0.0.0/8", "*corp.com", "a.*.com"])
      assert.throws(() => cfg("http://p:1", e), new RegExp(`entry ${e.replace(/[.*]/g, "\\$&")} is not supported`));
    assert.doesNotThrow(() => cfg("http://p:1", "*.corp.com,*,<-loopback>"));
    assert.throws(
      () => proxyConfig({ API_ANYTHING_PROXY: "http://u:p%zz@h.example:1" }),
      (e: Error) => /not validly percent-encoded/.test(e.message) && !e.message.includes("p%zz"),
    );
    // a name that starts with 127 is no loopback address
    assert.equal(proxied("http://127.example.com/", cfg("http://p:1")), true);
  });

  test("an unusable value is refused without quoting its credentials", () => {
    assert.throws(() => proxyConfig({ API_ANYTHING_PROXY: "not a url" }), /is not a URL/);
    assert.throws(
      () => proxyConfig({ API_ANYTHING_PROXY: "socks5://user:hunter22@p.example:1080" }),
      (e: Error) => /http:\/\/ or https:\/\//.test(e.message) && !e.message.includes("hunter22"),
    );
  });

  test("API_ANYTHING_NO_PROXY: a name covers its subdomains, a port only that port, * every host", () => {
    const c = cfg("http://p.example:3128", "a.com, .b.com,*.c.com d.com:8443 10.0.0.5 ::1");
    for (const [url, through] of [
      ["https://a.com/x", false],
      ["https://www.a.com/x", false],
      ["https://nota.com/x", true],
      ["https://b.com/", false],
      ["https://x.b.com/", false],
      ["https://x.c.com/", false],
      ["https://d.com/", true],
      ["https://d.com:8443/", false],
      ["http://10.0.0.5/", false],
      ["http://[::1]:9/", false],
      ["https://e.com/", true],
    ] as const)
      assert.equal(proxied(url, c), through, url);
    assert.equal(proxied("https://anything.example/", cfg("http://p:1", "*")), false);
  });

  test("loopback bypasses the proxy, as Chrome's default does, unless <-loopback> says otherwise", () => {
    const c = cfg("http://p:1");
    for (const url of ["http://localhost:3000/", "http://127.0.0.1:9/", "http://[::1]:9/", "http://app.localhost/"])
      assert.equal(proxied(url, c), false, url);
    assert.equal(proxied("http://127.0.0.1:9/", cfg("http://p:1", "<-loopback>")), true);
  });

  test("the bypass list Chrome is given matches the same hosts", () => {
    assert.equal(
      bypassList(cfg("http://p:1", "a.com,.b.com,*.c.com,d.com:8443,10.0.0.5,::1,[::2]:80,<-loopback>").noProxy),
      "a.com,*.a.com,b.com,*.b.com,c.com,*.c.com,d.com:8443,*.d.com:8443,10.0.0.5,[::1],[::2]:80,<-loopback>",
    );
    assert.deepEqual(browserProxy(cfg("http://us%40r:p%3Ass@p.example:3128", "a.com")), {
      server: "http://p.example:3128",
      bypass: "a.com,*.a.com,localhost,127.0.0.1,[::1]",
      username: "us@r",
      password: "p:ss",
    });
    assert.deepEqual(browserProxy(cfg("https://p.example")), {
      server: "https://p.example",
      bypass: "localhost,127.0.0.1,[::1]",
    });
    // <-loopback> asked for: no loopback host is named, so it goes through
    assert.equal(browserProxy(cfg("http://p:1", "<-loopback>"))?.bypass, "<-loopback>");
    assert.equal(browserProxy(cfg("http://p:1", "*")), undefined);
    assert.equal(browserProxy(undefined), undefined);
  });

  test("redactProxy takes the URL and its credentials out of a message", () => {
    const c = cfg("http://alice:s3cr%40t@p.example:3128");
    const out = redactProxy("connect http://alice:s3cr%40t@p.example:3128/ failed: s3cr@t s3cr%40t", c);
    assert.ok(!out.includes("s3cr"), out);
    assert.match(out, /p\.example:3128/);
  });

  test("plain http through the proxy with a session is refused; https, no session, or a bypassed host are not", () => {
    const c = cfg("http://p.example:3128");
    assert.throws(() => refuseCleartext("http://a.com/x", true, c), CleartextRefused);
    assert.doesNotThrow(() => refuseCleartext("https://a.com/x", true, c));
    assert.doesNotThrow(() => refuseCleartext("http://a.com/x", false, c));
    assert.doesNotThrow(() => refuseCleartext("http://a.com/x", true, cfg("http://p:1", "a.com")));
    assert.doesNotThrow(() => refuseCleartext("http://a.com/x", true, undefined));
  });
});

describe("site traffic through a local proxy", () => {
  let proxy: FixtureProxy;
  let site: { url: string; hits: IncomingMessage[]; close(): Promise<void> };
  const saved = { ...process.env };

  before(async () => {
    proxy = await startProxy({ user: "u", pass: "hunter22" });
    const hits: IncomingMessage[] = [];
    const server = createServer((req, res) => {
      hits.push(req);
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "/landed", "set-cookie": "sid=1; Path=/" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json", "set-cookie": "visitor=1; Path=/" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    site = {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      hits,
      close: () => new Promise((r) => server.close(() => r())),
    };
  });
  after(async () => {
    await closeBrowser();
    await proxy.close();
    await site.close();
  });
  afterEach(() => {
    process.env.API_ANYTHING_PROXY = saved.API_ANYTHING_PROXY;
    process.env.API_ANYTHING_NO_PROXY = saved.API_ANYTHING_NO_PROXY;
    if (saved.API_ANYTHING_PROXY === undefined) delete process.env.API_ANYTHING_PROXY;
    if (saved.API_ANYTHING_NO_PROXY === undefined) delete process.env.API_ANYTHING_NO_PROXY;
    proxy.seen.length = 0;
    site.hits.length = 0;
  });
  const use = (creds = "u:hunter22", noProxy = "<-loopback>") => {
    process.env.API_ANYTHING_PROXY = `http://${creds}@127.0.0.1:${proxy.port}`;
    process.env.API_ANYTHING_NO_PROXY = noProxy;
  };
  const target = () => new URL(site.url).host;
  const op = (slots: unknown[] = []) =>
    OperationSchema.parse({
      name: "items",
      readOnly: true,
      request: { method: "GET", url: `${site.url}/api/items?q=a`, headers: {} },
      slots: [{ param: "q", at: ["query:q"] }, ...slots],
      trigger: { url: `${site.url}/` },
      params: [{ name: "q" }],
    });
  const none: Session = { cookies: [], values: {} };

  test("tier 1 goes through the proxy, with its credentials, and answers as before", async () => {
    use();
    const r = await send(op(), { q: "b" }, none, { site: "px", minIntervalMs: 0 });
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), { ok: true, path: "/api/items?q=b" });
    // plain http goes to the proxy whole, as Chrome sends it: a stock Squid refuses CONNECT to port 80
    assert.deepEqual(proxy.seen, [{ method: "GET", target: `${site.url}/api/items?q=b`, authorized: true }]);
    assert.equal(site.hits.length, 1);
  });

  test("a username with an empty password (an API-key proxy) still authenticates at tier 1", async () => {
    const keyed = await startProxy({ user: "APIKEY", pass: "" });
    try {
      process.env.API_ANYTHING_PROXY = `http://APIKEY:@127.0.0.1:${keyed.port}`;
      process.env.API_ANYTHING_NO_PROXY = "<-loopback>";
      assert.equal((await send(op(), { q: "b" }, none, { site: "px", minIntervalMs: 0 })).status, 200);
      assert.deepEqual(
        keyed.seen.map((s) => s.authorized),
        [true],
      );
    } finally {
      await keyed.close();
    }
  });

  test("a redirect whose next hop would carry a cookie over plain http is refused as the redirect's, after the first was sent", async () => {
    use();
    const redirecting = OperationSchema.parse({
      name: "go",
      readOnly: false,
      request: { method: "POST", url: `${site.url}/redirect`, headers: {}, body: "a=1" },
      slots: [],
      trigger: { url: `${site.url}/` },
      params: [],
    });
    await assert.rejects(
      () => send(redirecting, {}, none, { site: "px", minIntervalMs: 0 }),
      (e: Error) =>
        e instanceof RedirectRefused &&
        !(e instanceof CleartextRefused) &&
        /not following the HTTP 302/.test(e.message),
    );
    assert.deepEqual(
      site.hits.map((h) => h.url),
      ["/redirect"],
    );
  });

  test("a host in API_ANYTHING_NO_PROXY, and every catalog-style plain fetch, go direct", async () => {
    use("u:hunter22", `<-loopback>,127.0.0.1`);
    assert.equal((await send(op(), { q: "b" }, none, { site: "px", minIntervalMs: 0 })).status, 200);
    use();
    // nothing global was set: Node's own fetch, which registry and report traffic use, is untouched
    assert.equal((await fetch(`${site.url}/registry`)).status, 200);
    assert.deepEqual(proxy.seen, []);
    assert.equal(site.hits.length, 2);
  });

  test("no proxy set: nothing changes", async () => {
    assert.equal((await siteFetch(`${site.url}/x`)).status, 200);
    assert.deepEqual(proxy.seen, []);
  });

  test("a proxy that refuses the credentials fails the call without quoting them", async () => {
    use("u:wrong-pass");
    await assert.rejects(
      () => send(op(), { q: "b" }, none, { site: "px", minIntervalMs: 0 }),
      (e: Error) => {
        assert.ok(!e.message.includes("wrong-pass"), e.message);
        assert.match(e.message, new RegExp(`127\\.0\\.0\\.1:${proxy.port}`));
        return true;
      },
    );
    assert.equal(site.hits.length, 0);
  });

  test("a session over plain http is refused before anything reaches the proxy", async () => {
    use();
    const cookies = [
      { name: "sid", value: "abc", domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false },
    ];
    const withRef = op([{ ref: "cookie:sid", at: ["header:x-sid"] }]);
    await assert.rejects(
      () => send(withRef, { q: "b" }, { cookies, values: {} }, { site: "px", minIntervalMs: 0 }),
      CleartextRefused,
    );
    // the jar alone (a Cookie header) is refused too
    await assert.rejects(
      () => send(op(), { q: "b" }, { cookies, values: {} }, { site: "px", minIntervalMs: 0 }),
      CleartextRefused,
    );
    assert.deepEqual(proxy.seen, []);
    assert.equal(site.hits.length, 0);
  });

  test("login's signed-out probe goes through the proxy too", async () => {
    use();
    assert.deepEqual(await guestCookieNames(`${site.url}/`), ["visitor"]);
    assert.deepEqual(proxy.seen, [{ method: "GET", target: `${site.url}/`, authorized: true }]);
  });

  test("the browser goes through the proxy too", {
    skip: !browserAvailable() && "no Chromium browser installed",
  }, async () => {
    use();
    await closeBrowser();
    const profile = mkdtempSync(join(HOME, "profile-"));
    const ctx = await openBrowser({ profileDir: profile });
    const page = await ctx.newPage();
    const res = await page.goto(`${site.url}/page`);
    assert.equal(res?.status(), 200);
    await page.close();
    await closeBrowser();
    // Chrome sends a plain-http page's request to an http proxy whole (a CONNECT is for https)
    assert.ok(
      proxy.seen.some((s) => s.authorized && (s.target === `${site.url}/page` || s.target === target())),
      JSON.stringify(proxy.seen),
    );
    assert.ok(site.hits.some((h) => h.url === "/page"));
  });

  test("the browser stops a plain-http request through the proxy that would carry the profile's cookies", {
    skip: !browserAvailable() && "no Chromium browser installed",
  }, async () => {
    use();
    await closeBrowser();
    const ctx = await openBrowser({ profileDir: mkdtempSync(join(HOME, "profile-")) });
    await ctx.addCookies([{ name: "sid", value: "S", domain: "127.0.0.1", path: "/" }]);
    const page = await ctx.newPage();
    await assert.rejects(() => page.goto(`${site.url}/held`), /ERR_ACCESS_DENIED|ERR_FAILED/);
    await page.close();
    await closeBrowser();
    assert.ok(!proxy.seen.some((s) => s.target.includes("/held")), JSON.stringify(proxy.seen));
    assert.ok(!site.hits.some((h) => h.url === "/held"));
  });

  test("with no <-loopback>, the browser calls a loopback site directly, as tier 1 does", {
    skip: !browserAvailable() && "no Chromium browser installed",
  }, async () => {
    use("u:hunter22", "");
    await closeBrowser();
    const ctx = await openBrowser({ profileDir: mkdtempSync(join(HOME, "profile-")) });
    const page = await ctx.newPage();
    assert.equal((await page.goto(`${site.url}/direct`))?.status(), 200);
    await page.close();
    await closeBrowser();
    assert.deepEqual(proxy.seen, []);
    assert.ok(site.hits.some((h) => h.url === "/direct"));
  });
});

test("call(): plain http through the proxy with a session answers an unsent error that says why", async () => {
  const was = { proxy: process.env.API_ANYTHING_PROXY, browser: process.env.API_ANYTHING_BROWSER };
  process.env.API_ANYTHING_PROXY = "http://u:hunter22@p.example:3128";
  process.env.API_ANYTHING_BROWSER = "/nonexistent/chromium";
  try {
    saveSite(
      parseSite({
        name: "plain",
        baseUrl: "http://plain.example",
        operations: [
          {
            name: "me",
            readOnly: true,
            request: { method: "GET", url: "http://plain.example/api/me", headers: {} },
            slots: [],
            trigger: { url: "http://plain.example/" },
            params: [],
          },
        ],
      }),
    );
    saveSession("plain", {
      cookies: [
        { name: "sid", value: "S-1", domain: "plain.example", path: "/", expires: -1, httpOnly: true, secure: false },
      ],
      values: {},
    });
    const sent: string[] = [];
    const fetchImpl = (async (u: string | URL | Request) => {
      sent.push(String(u));
      return new Response("{}");
    }) as typeof fetch;
    const r = await call("plain", "me", {}, { fetchImpl, maxTier: 1, minIntervalMs: 0 });
    assert.deepEqual([r.ok, r.class], [false, "error"], JSON.stringify(r));
    assert.match(r.reason ?? "", /plain http, so the proxy would read this session's cookies/);
    assert.match(r.reason ?? "", /p\.example:3128/);
    assert.ok(!JSON.stringify(r).includes("hunter22"));
    assert.match(r.next ?? "", /API_ANYTHING_NO_PROXY/);
    assert.deepEqual(sent, []);
  } finally {
    for (const [k, v] of [
      ["API_ANYTHING_PROXY", was.proxy],
      ["API_ANYTHING_BROWSER", was.browser],
    ] as const)
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
  }
});
