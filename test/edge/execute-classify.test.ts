/**
 * Edge cases for execution, HTTP and classification. Each test is a regression for a bug that was
 * fixed. Chrome-only tests skip without Chrome.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { addCookiesToProfile, chromeAvailable, closeBrowser } from "../../src/browser.js";
import { classify, judge, type Observed } from "../../src/classify.js";
import { call } from "../../src/execute.js";
import { capOutput } from "../../src/extract.js";
import { profileDir } from "../../src/heal.js";
import { importSession } from "../../src/login.js";
import { cookieHeaderFor, cookieValue, loadSession, saveSession } from "../../src/session.js";
import { type Operation, OperationSchema, parseSite } from "../../src/spec.js";
import { rememberTier, saveSite } from "../../src/store.js";
import type { StoredCookie } from "../../src/types.js";
import { makeChromiumDb } from "../fixture/cookie-db.js";
import { type Fixture, startFixture } from "./execute-classify.fixture.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-edge-exec-"));
process.env.API_ANYTHING_HOME = HOME;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let fx: Fixture;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  await closeBrowser();
  fx.close();
  rmSync(HOME, { recursive: true, force: true });
});
beforeEach(() => {
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "sessions"), { recursive: true, force: true });
  fx.hits.length = 0;
  fx.otherHits.length = 0;
});

const cookie = (name: string, value: string, domain: string, extra: Partial<StoredCookie> = {}): StoredCookie => ({
  name,
  value,
  domain,
  path: "/",
  expires: -1,
  httpOnly: false,
  secure: false,
  ...extra,
});

/** A read op on the fixture: GET <path>, extract "items". */
const rd = (name: string, path: string, over: Record<string, unknown> = {}) => ({
  name,
  readOnly: true,
  request: { method: "GET", url: `${fx.base}${path}`, headers: {} },
  trigger: { url: `${fx.base}/` },
  response: { format: "json", extract: "items" },
  ...over,
});

function site(name: string, ...operations: Record<string, unknown>[]) {
  saveSite(parseSite({ name, baseUrl: fx.base, operations }));
}
const t1 = { maxTier: 1 as const, minIntervalMs: 0, timeoutMs: 3000 };

/* ----------------------------------------------------------------- cookies and redirects */

describe("tier 1 cookies and redirects", () => {
  test("a cookie set on a redirect hop is sent on the next hop (consent/session bootstrap)", async () => {
    site("boot", rd("list", "/bootstrap"));
    const r = await call("boot", "list", {}, t1);
    const second = fx.hits.find((h) => h.url === "/needs-step");
    assert.equal(second?.headers.cookie, "step=1", "the Set-Cookie of the 302 must ride on the follow-up request");
    assert.equal(r.ok, true, JSON.stringify(r));
  });

  test("a Set-Cookie from a tier-1 answer is persisted, so the next call presents the rotated value", async () => {
    site("rot", rd("list", "/rotate"));
    fx.state.rotate = 0;
    const a = await call("rot", "list", {}, t1);
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.ok(
      loadSession("rot").cookies.some((c) => c.name === "tok" && c.value === "1"),
      "tok=1 from the answer is in the jar",
    );
    const b = await call("rot", "list", {}, t1);
    assert.equal(b.ok, true, JSON.stringify(b));
  });

  test("cross-origin redirects drop authorization, ref'd headers and cookies; 303 turns POST into GET", async () => {
    site(
      "xo",
      {
        ...rd("me", "/away?s=302"),
        request: {
          method: "GET",
          url: `${fx.base}/away?s=302`,
          headers: { authorization: "", "x-csrf-token": "", "x-keep": "1" },
        },
        slots: [
          { ref: "session:authorization", at: ["header:authorization"] },
          { ref: "cookie:ct0", at: ["header:x-csrf-token"] },
        ],
        response: { format: "json" },
      },
      {
        name: "post307",
        readOnly: false,
        request: {
          method: "POST",
          url: `${fx.base}/away?s=307`,
          headers: { authorization: "Bearer PUBLIC-LITERAL", "content-type": "application/json" },
          body: "{}",
        },
        trigger: { url: `${fx.base}/` },
        response: { format: "json" },
      },
    );
    saveSession("xo", {
      cookies: [cookie("ct0", "SECRET-CSRF-VALUE-123", "127.0.0.1")],
      values: { authorization: "Bearer SECRET-BEARER" },
    });
    const r = await call("xo", "me", {}, t1);
    assert.equal(r.ok, true, JSON.stringify(r));
    const h = fx.otherHits[0]!.headers;
    assert.equal(h.authorization, undefined);
    assert.equal(h["x-csrf-token"], undefined);
    assert.equal(h.cookie, undefined);
    assert.equal(h["x-keep"], "1");

    fx.otherHits.length = 0;
    const w = await call("xo", "post307", {}, { ...t1, allowWrites: true });
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.equal(fx.otherHits[0]!.method, "POST", "307 keeps the method");
    assert.equal(
      fx.otherHits[0]!.headers.authorization,
      undefined,
      "even a literal authorization is dropped cross-origin",
    );
  });

  test("a redirect loop ends with a non-ok answer instead of hanging", async () => {
    site("loop", rd("l", "/loop"));
    const r = await call("loop", "l", {}, t1);
    assert.equal(r.ok, false);
    assert.equal(r.class, "error");
    assert.ok(fx.hits.length <= 6);
  });

  test("a redirect to a login page where JSON was expected is auth", async () => {
    site("tl", rd("l", "/to-login"));
    const r = await call("tl", "l", {}, t1);
    assert.equal(r.class, "auth", JSON.stringify(r));
  });

  test("jar scoping: longest path first for duplicate names, expired never sent, Secure only over https/localhost", () => {
    const now = 1_800_000_000_000;
    const jar = [
      cookie("sid", "root", ".shop.test"),
      cookie("sid", "api", ".shop.test", { path: "/api" }),
      cookie("old", "x", ".shop.test", { expires: now / 1000 - 1 }),
      cookie("sec", "s", ".shop.test", { secure: true }),
    ];
    assert.equal(cookieHeaderFor(jar, "http://shop.test/api/v1", now), "sid=api; sid=root");
    assert.equal(cookieHeaderFor(jar, "https://shop.test/apix", now), "sid=root; sec=s");
    assert.equal(cookieValue(jar, "sid", "https://shop.test/api/v1", now), "api");
    assert.equal(cookieValue(jar, "sid", "https://evil-shop.test/api", now), undefined, "no suffix match across sites");
  });

  test("a cookie: ref never takes another site's cookie under a multi-label public suffix (co.uk, github.io)", () => {
    // browser.ts siteCookies keeps every cookie whose domain ends in siteOf(host); for bbc.co.uk that is ".co.uk",
    // so the shared profile's argos.co.uk cookies land in bbc's jar
    const jar = [
      cookie("csrftoken", "ARGOS-SECRET", ".argos.co.uk", { secure: true }),
      cookie("csrftoken", "ALICE-SECRET", "alice.github.io", { secure: true }),
    ];
    assert.equal(cookieValue(jar, "csrftoken", "https://api.bbc.co.uk/x"), undefined);
    assert.equal(cookieValue(jar, "csrftoken", "https://mallory.github.io/api"), undefined);
  });
});

/* ----------------------------------------------------------------- bodies */

describe("response bodies", () => {
  test("gzip, br, deflate and zstd bodies are decoded", async () => {
    site("enc", ...["gzip", "br", "deflate", "zstd"].map((e) => rd(e, `/enc?e=${e}`)));
    for (const e of ["gzip", "br", "deflate", "zstd"]) {
      const r = await call("enc", e, {}, t1);
      assert.deepEqual(r.data, [{ name: "café ☕" }], `${e}: ${JSON.stringify(r)}`);
    }
  });

  test("a UTF-8 BOM before JSON parses", async () => {
    site("bom", rd("b", "/bom"));
    const r = await call("bom", "b", {}, t1);
    assert.deepEqual(r.data, [1], JSON.stringify(r));
  });

  test("the declared charset is honoured (ISO-8859-1 JSON, Shift_JIS HTML)", async () => {
    site(
      "cs",
      rd("latin", "/latin1"),
      rd("sjis", "/sjis", { response: { format: "html", html: { items: "li.i", fields: { t: "" } } } }),
    );
    const l = await call("cs", "latin", {}, t1);
    const s = await call("cs", "sjis", {}, t1);
    assert.deepEqual({ latin: l.data, sjis: s.data }, { latin: [{ name: "café" }], sjis: [{ t: "日本" }] });
  });

  test("an MB-scale JSON array comes back capped at an item boundary with a truncation note", async () => {
    site("big", rd("b", "/huge"));
    const r = await call("big", "b", {}, t1);
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.data) && r.data.length > 10 && r.data.length < 50_000);
    assert.ok(JSON.stringify(r).length < 22_000, `output ${JSON.stringify(r).length} chars`);
    assert.match(r.truncated ?? "", /showing \d+ of 50000 items/);
  });

  test("an array whose first item alone exceeds the cap still returns some data", async () => {
    site("fat", rd("f", "/fat-item"));
    const r = await call("fat", "f", {}, t1);
    assert.equal(r.ok, true);
    assert.ok(r.truncated);
    assert.ok(
      Array.isArray(r.data) && r.data.length >= 1,
      `data: ${JSON.stringify(r.data).slice(0, 80)} / ${r.truncated}`,
    );
  });

  test("capping a long string keeps a prefix of the string itself, not of its JSON encoding", () => {
    const html = '<div class="a">\n'.repeat(3000);
    const { data } = capOutput(html);
    assert.equal(typeof data, "string");
    assert.ok(html.startsWith(data as string), `starts with ${JSON.stringify((data as string).slice(0, 30))}`);
  });

  test("capping an object with a big nested array returns a JSON value, not cut JSON text", () => {
    const value = {
      user: { id: 1 },
      timeline: Array.from({ length: 2000 }, (_, i) => ({ id: i, text: "tweet text here" })),
    };
    const { data } = capOutput(value);
    assert.equal(typeof data, "object", `got a ${typeof data}: ${JSON.stringify(data).slice(0, 60)}`);
  });

  test("a read answered 204 with no body is not ok, and is sent once", async () => {
    site("e204", rd("e", "/empty"));
    const r = await call("e204", "e", {}, t1);
    assert.notEqual(r.class, "ok");
    assert.equal(fx.hits.length, 1, "exactly one request");
  });

  test("an empty 204 read while the example args still answer is input (the missing-data check), not a heal", async () => {
    site("m204", {
      ...rd("s", "/maybe?q=alice"),
      slots: [{ param: "q", at: ["query:q"] }],
      params: [{ name: "q", example: "alice" }],
    });
    const r = await call("m204", "s", { q: "zz_no_results" }, t1);
    assert.equal(r.class, "input", JSON.stringify(r));
  });
});

/* ----------------------------------------------------------------- transport failures */

describe("timeouts and network errors", () => {
  test("a body that stalls after the headers times out with a clear reason", async () => {
    site("stall", rd("s", "/stall"));
    const t0 = Date.now();
    const r = await call("stall", "s", {}, { ...t1, timeoutMs: 300 });
    assert.equal(r.class, "error");
    assert.match(r.reason ?? "", /no response within 300 ms/);
    assert.ok(Date.now() - t0 < 2500);
  });

  test("a server that never answers times out; a reset is an error; a write reset is sent once and flagged ambiguous", async () => {
    site("net", rd("n", "/never"), rd("r", "/reset"), {
      name: "w",
      readOnly: false,
      request: { method: "POST", url: `${fx.base}/reset`, headers: {}, body: "x=1" },
      trigger: { url: `${fx.base}/` },
    });
    assert.match((await call("net", "n", {}, { ...t1, timeoutMs: 200 })).reason ?? "", /no response within 200 ms/);
    assert.equal((await call("net", "r", {}, t1)).class, "error");
    fx.hits.length = 0;
    const w = await call("net", "w", {}, { ...t1, allowWrites: true });
    assert.equal(w.class, "error");
    assert.equal(fx.hits.length, 1);
    assert.match(w.next ?? "", /may have gone through/);
  });

  test("a network error names its cause (refused, DNS), not just 'fetch failed'", async () => {
    const port = await new Promise<number>((r) => {
      const s = createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = (s.address() as { port: number }).port;
        s.close(() => r(p));
      });
    });
    saveSite(
      parseSite({
        name: "down",
        baseUrl: `http://127.0.0.1:${port}`,
        operations: [{ ...rd("d", "/"), request: { method: "GET", url: `http://127.0.0.1:${port}/x`, headers: {} } }],
      }),
    );
    const r = await call("down", "d", {}, t1);
    assert.equal(r.class, "error");
    assert.match(r.reason ?? "", /ECONNREFUSED|refused/i, `reason: ${r.reason}`);

    const dns = (async () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("getaddrinfo ENOTFOUND api.nowhere.test"), { code: "ENOTFOUND" }),
      });
    }) as typeof fetch;
    const d = await call("down", "d", {}, { ...t1, fetchImpl: dns });
    assert.match(d.reason ?? "", /ENOTFOUND/, `reason: ${d.reason}`);
  });

  test("429 reports the server's Retry-After (seconds and HTTP date)", async () => {
    site("rl", rd("s", "/r429?ra=120"), rd("d", `/r429?ra=${encodeURIComponent("Wed, 21 Oct 2026 07:28:00 GMT")}`));
    const s = await call("rl", "s", {}, t1);
    assert.equal(s.class, "rate");
    assert.match(`${s.reason} ${s.next}`, /120/, JSON.stringify(s));
    const d = await call("rl", "d", {}, t1);
    assert.match(`${d.reason} ${d.next}`, /2026-10-21|Oct 2026/, JSON.stringify(d));
  });
});

/* ----------------------------------------------------------------- classification */

const gqlOp = (over: Record<string, unknown> = {}): Operation =>
  OperationSchema.parse({
    name: "user",
    request: { method: "GET", url: "https://g.test/graphql?q=1", headers: {} },
    slots: [{ param: "login", at: ["query:q"] }],
    params: [{ name: "login" }],
    trigger: { url: "https://g.test/{login}" },
    response: { format: "json", extract: "data.user" },
    readOnly: true,
    ...over,
  });
const obs = (
  status: number,
  body: string,
  ct = "application/json",
  headers: Record<string, string> = {},
): Observed => ({
  status,
  headers: { "content-type": ct, ...headers },
  body,
});

describe("classification", () => {
  test("challenge pages from every listed vendor are blocked, whatever the status", () => {
    const o = gqlOp();
    const cases: [string, Observed][] = [
      [
        "Cloudflare 403",
        obs(
          403,
          "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><script>window._cf_chl_opt={}</script></body></html>",
          "text/html",
        ),
      ],
      ["Cloudflare cf-mitigated", obs(403, "", "text/html", { "cf-mitigated": "challenge" })],
      ["Cloudflare 503", obs(503, "<title>Just a moment...</title>", "text/html")],
      ["Cloudflare WAF", obs(403, "<title>Attention Required! | Cloudflare</title>", "text/html")],
      [
        "Akamai",
        obs(
          403,
          '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY>Reference #18.1 <a href="https://errors.edgesuite.net/18.1">',
          "text/html",
        ),
      ],
      ["DataDome JSON", obs(403, '{"url":"https://geo.captcha-delivery.com/captcha/?initialCid=AHrlqAAA"}')],
      ["PerimeterX JSON", obs(403, '{"appId":"PXu6b0qd2S","blockScript":"/u6b0qd2S/captcha/captcha.js","vid":"x"}')],
      ["PerimeterX 200 page", obs(200, "<html><body><div id=px-captcha></div>Press & Hold</body></html>", "text/html")],
      [
        "reCAPTCHA 200 interstitial",
        obs(200, '<html><div class="g-recaptcha" data-sitekey="x"></div></html>', "text/html"),
      ],
    ];
    for (const [name, r] of cases) assert.equal(classify(o, r).class, "blocked", name);
    assert.equal(
      classify(o, obs(429, "<title>Access denied | Error 1015</title> You are being rate limited", "text/html")).class,
      "rate",
    );
  });

  test("Imperva/Incapsula and Kasada interstitials are blocked (tier escalation), not drift or rate", () => {
    const o = gqlOp();
    const incapsula = obs(
      200,
      '<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=5074a744"></script></head><body><iframe src="/_Incapsula_Resource?CWUDNSAI=9">Request unsuccessful. Incapsula incident ID: 1</iframe></body></html>',
      "text/html",
    );
    assert.equal(classify(o, incapsula).class, "blocked", "Imperva");
    const kasada = obs(
      429,
      '<html><script src="/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3/ips.js"></script></html>',
      "text/html",
      { "x-kpsdk-ct": "abc" },
    );
    assert.equal(classify(o, kasada).class, "blocked", "Kasada");
  });

  test("400 with a CSRF marker is auth (DESIGN: 400/403 with login or CSRF markers)", () => {
    const w = gqlOp({ readOnly: false, response: { format: "json" } });
    assert.equal(classify(w, obs(403, '{"error":"CSRF token mismatch"}')).class, "auth");
    assert.equal(classify(w, obs(400, '{"error":"CSRF token mismatch"}')).class, "auth");
  });

  test("5xx is error (retry hint), 4xx without markers is not auth", () => {
    assert.equal(
      classify(gqlOp(), obs(503, "Service Unavailable", "text/plain", { "retry-after": "30" })).class,
      "error",
    );
    assert.equal(classify(gqlOp(), obs(500, '{"error":"internal"}')).class, "error");
    assert.equal(classify(gqlOp(), obs(403, '{"message":"CSRF token missing or incorrect."}')).class, "auth");
    assert.equal(classify(gqlOp(), obs(401, "")).class, "auth");
  });

  test("JSON served as text/html is still JSON; an HTML login page where JSON was expected is auth", () => {
    assert.equal(classify(gqlOp(), obs(200, '{"data":{"user":{"id":1}}}', "text/html; charset=utf-8")).class, "ok");
    assert.equal(
      classify(gqlOp(), obs(200, '<!doctype html><form><input name=u><input type="password"></form>', "text/html"))
        .class,
      "auth",
    );
  });

  test("GraphQL errors with null data map to rate/auth/drift/error", () => {
    const o = gqlOp();
    assert.equal(classify(o, obs(200, '{"errors":[{"message":"Rate limit exceeded"}],"data":null}')).class, "rate");
    assert.equal(classify(o, obs(200, '{"errors":[{"message":"Bad guest token"}]}')).class, "auth");
    assert.equal(classify(o, obs(200, '{"errors":[{"message":"PersistedQueryNotFound"}]}')).class, "drift");
  });

  test("GraphQL partial data: errors next to a null extract target are not a successful null", () => {
    const o = gqlOp();
    const rate = judge(
      o,
      obs(200, '{"data":{"user":null},"errors":[{"message":"Rate limit exceeded","path":["user"]}]}'),
    );
    assert.equal(rate.class, "rate", JSON.stringify(rate));
    const nf = judge(
      o,
      obs(
        200,
        `{"data":{"user":null},"errors":[{"type":"NOT_FOUND","path":["user"],"message":"Could not resolve to a User with the login of 'zz'."}]}`,
      ),
    );
    assert.notEqual(nf.class, "ok", JSON.stringify(nf));
    // errors on an unrelated field with the target present: still ok
    assert.equal(
      judge(o, obs(200, '{"data":{"user":{"id":1},"ads":null},"errors":[{"message":"x","path":["ads"]}]}')).class,
      "ok",
    );
  });

  test("a write answered 2xx is ok even when the landing page has a password field (it ran)", () => {
    const w = gqlOp({ readOnly: false, response: { format: "json" } });
    assert.equal(classify(w, obs(204, "", "")).class, "ok");
    const saved = judge(
      w,
      obs(200, '<!doctype html><h1>Settings saved</h1><form><input type="password" name="new"></form>', "text/html"),
    );
    assert.equal(saved.class, "ok", JSON.stringify(saved));
  });
});

/* ----------------------------------------------------------------- the ladder */

describe("execution ladder", () => {
  test("404 for an unknown entity on a query-param API is input after the example check, not a heal", async () => {
    site("nf404", {
      ...rd("user", "/api/user?name=alice"),
      slots: [{ param: "name", at: ["query:name"] }],
      params: [{ name: "name", example: "alice" }],
      response: { format: "json", extract: "user" },
    });
    const ok = await call("nf404", "user", { name: "alice" }, t1);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    const r = await call("nf404", "user", { name: "zz_nobody" }, t1);
    assert.equal(r.class, "input", JSON.stringify(r));
  });

  test("a remembered escalation does not stop --max-tier 1 from trying tier 1", async () => {
    site("mem", rd("l", "/plain"));
    rememberTier("mem", "l", 2);
    const r = await call("mem", "l", {}, t1);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 1);
  });

  test("an unknown arg name (a typo) is refused instead of silently using the default", async () => {
    site("typo", {
      ...rd("items", "/api/items?page=1"),
      slots: [{ param: "page", at: ["query:page"] }],
      params: [{ name: "page", default: "1", required: false }],
    });
    const r = await call("typo", "items", { pgae: "7" }, t1);
    assert.equal(r.class, "input", JSON.stringify(r));
    assert.equal(fx.hits.length, 0, "nothing sent");
  });

  test("a numeric arg in a form that would be rounded past 2^53 is input, and nothing is sent", async () => {
    site("big", {
      ...rd("items", "/api/items?page=1"),
      slots: [{ param: "page", at: ["query:page"] }],
      params: [{ name: "page", type: "number" }],
    });
    const r = await call("big", "items", { page: "9007199254740993e0" }, t1);
    assert.equal(r.class, "input", JSON.stringify(r));
    assert.match(r.reason ?? "", /would lose precision/);
    assert.equal(fx.hits.length, 0, "nothing sent");
    assert.deepEqual((await call("big", "items", { page: "9007199254740993" }, t1)).data, [
      { page: "9007199254740993" },
    ]);
  });

  test("a corrupt session or state file is reported as such: not 'check the args', and call() does not throw", async () => {
    site("corrupt", rd("l", "/plain"));
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(HOME, "sessions"), { recursive: true });
    writeFileSync(join(HOME, "sessions", "corrupt.json"), '{"cookies":[{"name":"a"');
    const s = await call("corrupt", "l", {}, t1);
    assert.notEqual(s.class, "input", JSON.stringify(s));
    rmSync(join(HOME, "sessions", "corrupt.json"));
    writeFileSync(join(HOME, "state.json"), '{"tier":');
    await assert.doesNotReject(call("corrupt", "l", {}, t1));
  });

  test("in-process concurrent calls to one site are paced and all answer", async () => {
    site("conc", rd("l", "/plain"));
    const t0 = Date.now();
    const rs = await Promise.all([1, 2, 3].map(() => call("conc", "l", {}, { ...t1, minIntervalMs: 100 })));
    assert.ok(rs.every((r) => r.ok));
    assert.ok(Date.now() - t0 >= 190, "3 requests at 100 ms spacing");
  });
});

/* ----------------------------------------------------------------- writes gating */

describe("allowWrites at every entry point", () => {
  const writeSite = () =>
    site("wr", rd("read", "/plain"), {
      name: "follow",
      readOnly: false,
      request: {
        method: "POST",
        url: `${fx.base}/api/follow`,
        headers: { "content-type": "application/json" },
        body: '{"id":"1"}',
      },
      trigger: { url: `${fx.base}/` },
      response: { format: "json" },
    });

  test("library: call refused without allowWrites, heal always refuses a write; nothing sent", async () => {
    writeSite();
    const r = await call("wr", "follow", {}, t1);
    assert.equal(r.class, "refused");
    const { heal } = await import("../../src/execute.js");
    assert.equal((await heal("wr", "follow", {}, { ...t1, allowWrites: true })).class, "refused");
    assert.equal(fx.hits.length, 0);
  });

  test("MCP: writes hidden and refused unless the server allows them", async () => {
    writeSite();
    const { createServer: mcp } = await import("../../src/mcp.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const server = mcp({});
    await server.connect(a);
    const client = new Client({ name: "probe", version: "0" });
    await client.connect(b);
    const list = await client.callTool({ name: "list_operations", arguments: { site: "wr" } });
    assert.doesNotMatch(JSON.stringify(list), /follow/);
    const r = await client.callTool({ name: "call_operation", arguments: { site: "wr", op: "follow", args: {} } });
    assert.match(JSON.stringify(r), /refused/);
    assert.equal(fx.hits.length, 0);
    await client.close();
  });

  const cli = (...args: string[]) =>
    new Promise<{ code: number; out: string; err: string }>((resolve) => {
      const p = spawn(process.execPath, ["--import", "tsx", join(ROOT, "src/cli.ts"), ...args], {
        cwd: ROOT,
        env: { ...process.env, API_ANYTHING_HOME: HOME },
      });
      let out = "";
      let err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("close", (code) => resolve({ code: code ?? -1, out, err }));
    });

  test("CLI: a write without --allow-writes is refused; --dry redacts every credential and sends nothing", async () => {
    writeSite();
    site("dry", {
      ...rd("me", "/plain"),
      request: { method: "GET", url: `${fx.base}/plain`, headers: { authorization: "", "x-csrf-token": "" } },
      slots: [
        { ref: "session:authorization", at: ["header:authorization"] },
        { ref: "cookie:ct0", at: ["header:x-csrf-token"] },
      ],
    });
    saveSession("dry", {
      cookies: [cookie("ct0", "LIVE-CSRF-SECRET-1", "127.0.0.1")],
      values: { authorization: "Bearer LIVE-BEARER-SECRET" },
    });
    const w = await cli("call", "wr", "follow");
    assert.equal(w.code, 1);
    assert.match(w.out, /refused/);
    const d = await cli("call", "dry", "me", "--dry");
    assert.equal(d.code, 0, d.err);
    assert.doesNotMatch(d.out, /LIVE-/);
    assert.match(d.out, /<ct0>/);
    assert.equal(fx.hits.length, 0);
    // verify runs reads only
    const v = await cli("verify", "wr");
    assert.equal(fx.hits.filter((h) => h.method === "POST").length, 0, v.out);
  });

  test("CLI: an invalid --max-tier is rejected", async () => {
    site("mt", rd("l", "/plain"));
    const r = await cli("call", "mt", "l", "--max-tier", "abc");
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.err, /max-tier/);
  });
});

test("auth stays at tier 1 when no browser tier may run, and when a login is on record", async () => {
  site("pickyoff", rd("items", "/api/picky"));
  // capped at tier 1: the answer is the site's, with the login hint, not "needs tier 2"
  const capped = await call("pickyoff", "items", {}, t1);
  assert.equal(capped.class, "auth", JSON.stringify(capped));
  assert.equal(capped.tier, 1);
  assert.match(capped.next ?? "", /api-anything login pickyoff/);
  // a login was run for this site (its source is recorded, though its cookies are gone): recovery, not a probe
  saveSession("pickyoff", { cookies: [], values: {}, source: "window" });
  fx.hits.length = 0;
  const known = await call("pickyoff", "items", {}, { maxTier: 2, minIntervalMs: 0, timeoutMs: 3000 });
  assert.equal(known.class, "auth", JSON.stringify(known));
  assert.equal(known.tier, 1);
  assert.equal(fx.hits.filter((h) => h.url === "/api/picky").length, 1, "one request, no page fetch");
});

/* ----------------------------------------------------------------- Chrome-only */

describe("browser tiers", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  test("a write whose POST was redirected (303) to a 403 page ran: it is not re-sent at tier 2", async () => {
    site("prg", {
      name: "follow",
      readOnly: false,
      request: {
        method: "POST",
        url: `${fx.base}/api/follow`,
        headers: { "content-type": "application/json" },
        body: '{"id":"1"}',
      },
      trigger: { url: `${fx.base}/` },
      response: { format: "json" },
    });
    const r = await call("prg", "follow", {}, { allowWrites: true, maxTier: 2, minIntervalMs: 0, timeoutMs: 5000 });
    const posts = fx.hits.filter((h) => h.method === "POST" && h.url === "/api/follow").length;
    assert.equal(posts, 1, `POST sent ${posts} times; result ${JSON.stringify(r)}`);
  });

  test("a param's default reaches the tier-3 trigger: the page opens with it, not with a literal {page}", async () => {
    site("deftrig", {
      ...rd("items", "/api/items?page=1", { minTier: 3 }),
      slots: [{ param: "page", at: ["query:page"] }],
      params: [{ name: "page", default: "7", required: false }],
      trigger: { url: `${fx.base}/paged?page={page}` },
      match: { path: "/api/items" },
    });
    const r = await call("deftrig", "items", {}, { minIntervalMs: 0, timeoutMs: 5000 });
    const pages = fx.hits.filter((h) => h.url.startsWith("/paged")).map((h) => h.url);
    assert.deepEqual(pages, ["/paged?page=7"], JSON.stringify(r));
    assert.equal(r.tier, 3, JSON.stringify(r));
    assert.deepEqual(r.data, [{ page: "7" }]);
  });

  test("auth at tier 2 re-imports the browser session into the profile and retries once; a write is not resent", async () => {
    site("t2auth", rd("me", "/api/me", { minTier: 2 }), {
      ...rd("save", "/api/me", { minTier: 2 }),
      readOnly: false,
      request: { method: "POST", url: `${fx.base}/api/me`, headers: {}, body: "x=1" },
    });
    const root = mkdtempSync(join(HOME, "everyday-browser-"));
    // the human signs in in their everyday browser; the server honours only that session
    const signIn = (sid: string) => {
      fx.state.sid = sid;
      makeChromiumDb(join(root, "Default"), [{ host_key: "127.0.0.1", name: "sid", value: sid }], { password: "pw" });
    };
    const me = () => fx.hits.filter((h) => h.url === "/api/me").length;
    const o = { maxTier: 2 as const, minIntervalMs: 0, timeoutMs: 5000 };
    process.env.API_ANYTHING_BROWSER_ROOTS = JSON.stringify([
      { name: "Chrome", family: "chromium", root, password: "pw" },
    ]);
    try {
      signIn("first");
      assert.equal((await importSession("t2auth", `${fx.base}/`))?.source, "chrome:Default");
      assert.deepEqual((await call("t2auth", "me", {}, o)).data, [{ me: "first" }]);

      signIn("second");
      fx.hits.length = 0;
      const r = await call("t2auth", "me", {}, o);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.tier, 2);
      assert.deepEqual(r.data, [{ me: "second" }]);
      assert.equal(me(), 2, "one retry");

      // logged out with nothing new to import: one retry, then the login hint
      fx.state.sid = "third";
      fx.hits.length = 0;
      const out = await call("t2auth", "me", {}, o);
      assert.equal(out.class, "auth", JSON.stringify(out));
      assert.match(out.next ?? "", /api-anything login t2auth/);
      assert.equal(me(), 2, "at most once per call");

      // a write answered 200 with the login page may have run: never resent
      fx.hits.length = 0;
      const w = await call("t2auth", "save", {}, { ...o, allowWrites: true });
      assert.equal(w.class, "auth", JSON.stringify(w));
      assert.equal(me(), 1, "the write was sent once");
    } finally {
      delete process.env.API_ANYTHING_BROWSER_ROOTS;
    }
  });

  test("a tier-3 read's own request may be sent on by a 307, to its own origin or another", async () => {
    for (const far of [false, true]) {
      const q = far ? "?far=1" : "";
      site(`signed${q ? "far" : ""}`, {
        ...rd("q", `/read${q}`, { minTier: 3, trigger: { url: `${fx.base}/signed-page${q}` } }),
        request: { method: "POST", url: `${fx.base}/read${q}`, headers: {}, body: "final" },
        match: { method: "POST", path: "/read" },
      });
      fx.hits.length = 0;
      fx.otherHits.length = 0;
      const r = await call(`signed${q ? "far" : ""}`, "q", {}, { maxTier: 3, minIntervalMs: 0, timeoutMs: 5000 });
      const posts = (hits: typeof fx.hits) => hits.filter((h) => h.method === "POST").map((h) => `${h.url} ${h.body}`);
      // the check is reached, wherever it is, and then the page asks for the data
      assert.deepEqual(
        [...posts(fx.hits), ...posts(fx.otherHits)].sort(),
        ["/answer initial", `/read${q} final`, `/read${q} initial`],
        JSON.stringify(r),
      );
      assert.equal(posts(fx.otherHits).length, far ? 1 : 0);
      assert.equal(r.tier, 3, JSON.stringify(r));
      assert.deepEqual(r.data, [{ name: "alice" }]);
    }
  });

  test("auth at tier 3 re-imports the browser session into the profile and retries once", async () => {
    site(
      "t3auth",
      rd("me", "/api/me", { minTier: 3, trigger: { url: `${fx.base}/me-page` }, match: { path: "/api/me" } }),
    );
    const root = mkdtempSync(join(HOME, "everyday-browser-"));
    const signIn = (sid: string) => {
      fx.state.sid = sid;
      makeChromiumDb(join(root, "Default"), [{ host_key: "127.0.0.1", name: "sid", value: sid }], { password: "pw" });
    };
    const me = () => fx.hits.filter((h) => h.url === "/api/me").length;
    const o = { minIntervalMs: 0, timeoutMs: 5000 };
    process.env.API_ANYTHING_BROWSER_ROOTS = JSON.stringify([
      { name: "Chrome", family: "chromium", root, password: "pw" },
    ]);
    try {
      signIn("first");
      assert.equal((await importSession("t3auth", `${fx.base}/`))?.source, "chrome:Default");
      assert.deepEqual((await call("t3auth", "me", {}, o)).data, [{ me: "first" }]);

      signIn("second");
      fx.hits.length = 0;
      const r = await call("t3auth", "me", {}, o);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.tier, 3);
      assert.deepEqual(r.data, [{ me: "second" }]);
      assert.equal(me(), 2, "one retry");

      // logged out with nothing new to import: one retry, then the login hint
      fx.state.sid = "third";
      fx.hits.length = 0;
      const out = await call("t3auth", "me", {}, o);
      assert.equal(out.class, "auth", JSON.stringify(out));
      assert.match(out.next ?? "", /api-anything login t3auth/);
      assert.equal(me(), 2, "at most once per call");
    } finally {
      delete process.env.API_ANYTHING_BROWSER_ROOTS;
    }
  });

  test("a tier-3 write that ran and was then redirected to a refusal is not sent again by auth recovery", async () => {
    site("t3write", {
      ...rd("save", "/api/save", {
        minTier: 3,
        trigger: { url: `${fx.base}/save-page` },
        match: { method: "POST", path: "/api/save" },
      }),
      readOnly: false,
      request: { method: "POST", url: `${fx.base}/api/save`, headers: {}, body: "x=1" },
    });
    // a session to re-import, so recovery would have something to retry with
    const root = mkdtempSync(join(HOME, "everyday-browser-"));
    makeChromiumDb(join(root, "Default"), [{ host_key: "127.0.0.1", name: "sid", value: "any" }], { password: "pw" });
    process.env.API_ANYTHING_BROWSER_ROOTS = JSON.stringify([
      { name: "Chrome", family: "chromium", root, password: "pw" },
    ]);
    try {
      assert.equal((await importSession("t3write", `${fx.base}/`))?.source, "chrome:Default");
      fx.hits.length = 0;
      const r = await call("t3write", "save", {}, { allowWrites: true, minIntervalMs: 0, timeoutMs: 5000 });
      const saves = fx.hits.filter((h) => h.method === "POST" && h.url === "/api/save").length;
      assert.equal(saves, 1, `the write was sent ${saves} times; result ${JSON.stringify(r)}`);
      assert.equal(r.ok, false);
      assert.match(r.next ?? "", /check the site/);
      assert.doesNotMatch(r.next ?? "", /retry once/);
    } finally {
      delete process.env.API_ANYTHING_BROWSER_ROOTS;
    }
  });

  test("auth at tier 2 from a stale cookie behind a header ref: the jar is refreshed from the profile, one retry", async () => {
    site(
      "t2csrf",
      rd("items", "/api/csrf", {
        minTier: 2,
        request: { method: "GET", url: `${fx.base}/api/csrf`, headers: { "x-csrf": "" } },
        slots: [{ ref: "cookie:ct", at: ["header:x-csrf"] }],
      }),
    );
    // the site rotated its token in the profile; the jar still holds the old one
    await addCookiesToProfile([cookie("ct", "fresh", "127.0.0.1")], profileDir());
    saveSession("t2csrf", { cookies: [cookie("ct", "stale", "127.0.0.1")], values: {} });
    const r = await call("t2csrf", "items", {}, { maxTier: 2, minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 2);
    assert.deepEqual(r.data, [{ ct: "fresh" }]);
    assert.equal(fx.hits.filter((h) => h.url === "/api/csrf").length, 2, "one retry");
  });

  test("auth at tier 2: a cookie: ref the refreshed jar cannot place is a failed call, not a thrown one", async () => {
    site(
      "t2wrap",
      rd("items", "/api/csrf", {
        minTier: 2,
        request: { method: "GET", url: `${fx.base}/api/csrf`, headers: { "x-wrap": "{}" } },
        slots: [{ ref: "cookie:ct", at: ["header:x-wrap", "json:/token"] }],
      }),
    );
    // with no ct in the jar the slot is skipped; the profile has one, and it has nowhere to go in "{}"
    await addCookiesToProfile([cookie("ct", "fresh", "127.0.0.1")], profileDir());
    saveSession("t2wrap", { cookies: [], values: {} });
    const r = await call("t2wrap", "items", {}, { maxTier: 2, minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.match(r.reason ?? "", /JSON pointer/);
  });

  test("auth at tier 2 for a read with a session: ref: one trigger run refreshes the value and answers", async () => {
    site(
      "t2token",
      rd("items", "/api/token", {
        minTier: 2,
        request: { method: "GET", url: `${fx.base}/api/token`, headers: { "x-token": "" } },
        slots: [{ ref: "session:x-token", at: ["header:x-token"] }],
        trigger: { url: `${fx.base}/tokened` },
        match: { path: "/api/token" },
      }),
    );
    const o = { minIntervalMs: 0, timeoutMs: 5000 };
    const r = await call("t2token", "items", {}, o);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 3);
    assert.match(r.reason ?? "", /^tier 2 said auth .*refreshed the session/);
    assert.equal((await call("t2token", "items", {}, o)).tier, 2, "the refreshed value serves tier 2");
  });

  test("auth with no login on record gets one attempt from a real page before giving up, and the tier that answers is remembered", async () => {
    site("picky", rd("items", "/api/picky"));
    const o = { minIntervalMs: 0, timeoutMs: 5000 };
    fx.hits.length = 0;
    const r = await call("picky", "items", {}, o);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 2);
    assert.deepEqual(r.data, [{ picky: "ok" }]);
    assert.match(r.reason ?? "", /tier 1 said auth with no login on record/);
    // the next call starts where this one got through
    fx.hits.length = 0;
    assert.equal((await call("picky", "items", {}, o)).tier, 2);
    assert.equal(fx.hits.filter((h) => h.url === "/api/picky").length, 1, "tier 1 was not tried again");
  });

  test("when the page says auth too, the call ends exactly as it would have: tier 1's auth and the login hint", async () => {
    // /api/me answers its login page to everyone but the one session it honours
    site("walled", rd("me", "/api/me"));
    fx.state.sid = "nobody-has-this";
    fx.hits.length = 0;
    const r = await call("walled", "me", {}, { minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.class, "auth", JSON.stringify(r));
    assert.equal(r.tier, 1);
    assert.match(r.next ?? "", /api-anything login walled/);
    const fromPage = fx.hits.filter((h) => h.url === "/api/me" && /Chrome\//.test(String(h.headers["user-agent"])));
    assert.equal(fromPage.length, 1, "one attempt from a page, and no trigger run");
  });

  test("a write is never given the page attempt: it ends as tier 1's auth, and no page sent it", async () => {
    // 401 is an answer a write may be retried after, so only the read-only rule keeps this one from the page
    const url = `${fx.base}/api/picky?status=401`;
    site(
      "pickywrite",
      rd("save", "/api/picky", { readOnly: false, request: { method: "POST", url, headers: {}, body: "x=1" } }),
    );
    fx.hits.length = 0;
    const r = await call("pickywrite", "save", {}, { allowWrites: true, minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.class, "auth", JSON.stringify(r));
    assert.equal(r.tier, 1);
    // recovery may send it once more after a 401, with the profile's cookies: that is plain HTTP too
    assert.ok(fx.hits.filter((h) => h.method === "POST").length <= 2);
    assert.equal(
      fx.hits.filter((h) => /Chrome\//.test(String(h.headers["user-agent"]))).length,
      0,
      "no page was opened",
    );
  });

  test("a login that recovery finds counts: with one in the jar by then, auth is the answer and no page is opened", async () => {
    // nothing on record at the start; the Chrome profile holds a login cookie the wall does not care about
    site(
      "pickyin",
      rd("items", "/api/picky", { request: { method: "GET", url: `${fx.base}/api/picky`, headers: {} } }),
    );
    await addCookiesToProfile([cookie("sessionid", "signed-in-elsewhere", "127.0.0.1")], profileDir());
    fx.hits.length = 0;
    const r = await call("pickyin", "items", {}, { minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.class, "auth", JSON.stringify(r));
    assert.equal(r.tier, 1);
    assert.equal(
      fx.hits.filter((h) => /Chrome\//.test(String(h.headers["user-agent"]))).length,
      0,
      "no page was opened",
    );
  });

  test("recovery comes before the page attempt: a fresher cookie in the Chrome profile answers at tier 1", async () => {
    // a session with no source (one saved by an older version), an empty jar, and the cookie only in the profile
    site("legacy", rd("me", "/api/me"));
    fx.state.sid = "profile-only";
    await addCookiesToProfile([cookie("sid", "profile-only", "127.0.0.1")], profileDir());
    saveSession("legacy", { cookies: [], values: {} });
    fx.hits.length = 0;
    const r = await call("legacy", "me", {}, { minIntervalMs: 0, timeoutMs: 5000 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 1);
    assert.deepEqual(r.data, [{ me: "profile-only" }]);
    const fromPage = fx.hits.filter((h) => h.url === "/api/me" && /Chrome\//.test(String(h.headers["user-agent"])));
    assert.equal(fromPage.length, 0, "the jar was refreshed from the profile and plain HTTP answered");
  });

  test("tier 2 honours timeoutMs", async () => {
    site("t2slow", rd("n", "/never", { minTier: 2 }), rd("up", "/plain", { minTier: 2 }));
    // timeoutMs bounds the wait for the site's answer, not Chrome's first start in this process
    // (many seconds on a busy machine): have the browser up on the origin before the clock starts.
    assert.equal((await call("t2slow", "up", {}, { maxTier: 2, minIntervalMs: 0 })).ok, true);
    const t0 = Date.now();
    const r = await Promise.race([
      call("t2slow", "n", {}, { maxTier: 2, minIntervalMs: 0, timeoutMs: 1000 }),
      new Promise<"hung">((res) => setTimeout(() => res("hung"), 15_000).unref()),
    ]);
    assert.notEqual(r, "hung", `no answer after ${Date.now() - t0} ms with timeoutMs 1000`);
  });

  test("a second process (CLI next to a running MCP server) can still use tier 2", async () => {
    await closeBrowser();
    site("two", rd("l", "/plain", { minTier: 2 }));
    const holder = `
      import { call } from ${JSON.stringify(join(ROOT, "src/execute.ts"))};
      const r = await call("two", "l", {}, { minIntervalMs: 0 });
      console.log("HOLDER " + r.ok);
      await new Promise((r) => setTimeout(r, 8000)); // an MCP server stays up with Chrome open
      process.exit(0);
    `;
    const p = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", holder], {
      cwd: ROOT,
      env: { ...process.env, API_ANYTHING_HOME: HOME },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        p.stdout.on("data", (d) => (/HOLDER true/.test(String(d)) ? resolve() : reject(new Error(String(d)))));
        p.on("close", () => reject(new Error("holder exited")));
      });
      const r = await call("two", "l", {}, { minIntervalMs: 0 });
      assert.equal(
        r.ok,
        true,
        `${r.class}: ${(r.reason ?? "").slice(0, 200)} (reason ${(r.reason ?? "").length} chars)`,
      );
    } finally {
      p.kill();
    }
  });
});

/* ----------------------------------------------------------------- two processes */

test("two processes merging browser cookies into one jar lose nothing", async () => {
  const script = (tag: string) => `
    import { mergeCapture } from ${JSON.stringify(join(ROOT, "src/session.ts"))};
    for (let i = 0; i < 150; i++) mergeCapture("race", [{ name: "${tag}" + i, value: "v", domain: "race.test", path: "/", expires: -1, httpOnly: false, secure: false }]);
  `;
  const run = (tag: string) =>
    new Promise<number>((resolve) => {
      const p = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script(tag)], {
        cwd: ROOT,
        env: { ...process.env, API_ANYTHING_HOME: HOME },
        stdio: "inherit",
      });
      p.on("close", (c) => resolve(c ?? -1));
    });
  const codes = await Promise.all([run("a"), run("b")]);
  assert.deepEqual(codes, [0, 0]);
  const n = loadSession("race").cookies.length;
  assert.equal(n, 300, `jar kept ${n} of 300 cookies`);
});

test("two processes writing state.json (tier memory, stale marks) lose nothing", async () => {
  const script = (tag: string) => `
    import { rememberTier } from ${JSON.stringify(join(ROOT, "src/store.ts"))};
    for (let i = 0; i < 150; i++) rememberTier("race", "${tag}" + i, 2);
  `;
  const run = (tag: string) =>
    new Promise<number>((resolve) => {
      const p = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script(tag)], {
        cwd: ROOT,
        env: { ...process.env, API_ANYTHING_HOME: HOME },
        stdio: "inherit",
      });
      p.on("close", (c) => resolve(c ?? -1));
    });
  assert.deepEqual(await Promise.all([run("a"), run("b")]), [0, 0]);
  const { readFileSync } = await import("node:fs");
  const n = Object.keys(JSON.parse(readFileSync(join(HOME, "state.json"), "utf8")).tier).length;
  assert.equal(n, 300, `state kept ${n} of 300 tier entries`);
});
