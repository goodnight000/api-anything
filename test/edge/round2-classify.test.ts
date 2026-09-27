/**
 * Round-2 regressions for the classifier and the call path: a hard output cap, empty picks, CSRF
 * and WAF false positives, a write answered with a sign-in form, empty results, and cross-origin
 * redirects that would carry session values.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { classify } from "../../src/classify.ts";
import { call } from "../../src/execute.ts";
import { capOutput, pick } from "../../src/extract.ts";
import { saveSession } from "../../src/session.ts";
import { parseSite, type Operation } from "../../src/spec.ts";
import { saveSite } from "../../src/store.ts";

const TMP = mkdtempSync(join(tmpdir(), "aa-round2-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
let homes = 0;
const newHome = () => {
  const h = join(TMP, `home${++homes}`);
  mkdirSync(join(h, "sites"), { recursive: true });
  process.env.API_ANYTHING_HOME = h;
  return h;
};
newHome();

/* ------------------------------------------------------------ 4, 13: output */

describe("output", () => {
  const cases: Record<string, unknown> = {
    "10k numeric members": Object.fromEntries(Array.from({ length: 10_000 }, (_, i) => [`k${i}`, 1_234_567_890 + i])),
    "5k short strings": Object.fromEntries(Array.from({ length: 5_000 }, (_, i) => [`k${i}`, `short value ${i}`])),
    "id-keyed map": { data: Object.fromEntries(Array.from({ length: 3_000 }, (_, i) => [`u${i}`, { id: i, name: `user ${i}`, bio: "x".repeat(20) }])) },
    "deep wide": { a: { b: { c: Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`z${i}`, i])) } } },
  };
  for (const [name, value] of Object.entries(cases)) {
    test(`the cap is a hard guarantee and the note is true: ${name}`, () => {
      const t0 = performance.now();
      const r = capOutput(value);
      const ms = performance.now() - t0;
      const n = JSON.stringify(r.data).length;
      assert.ok(n <= 20_000, `${n} chars`);
      assert.ok(n > 15_000, `kept only ${n} chars`);
      assert.ok(ms < 1000, `${Math.round(ms)} ms`);
      assert.match(r.truncated ?? "", new RegExp(`cut to ${n} of ${JSON.stringify(value).length} chars`));
      const keys = Object.keys(value as object).length;
      assert.match(r.truncated ?? "", new RegExp(`showing ${Object.keys(r.data as object).length} of ${keys} keys`));
    });
  }

  test("pick drops items that come out empty (shelves, ads, logo entities)", () => {
    const items = [{ title: "a", id: 1 }, { shelf: { x: 1 } }, { title: "b" }, { logo: "l" }];
    assert.deepEqual(pick(items, ["title", "id"]), [{ title: "a", id: 1 }, { title: "b" }]);
  });
});

/* ------------------------------------------------------------ 7, 8, 11, 12: classify */

const op = (over: Partial<Record<string, unknown>> = {}): Operation =>
  parseSite({
    name: "c",
    baseUrl: "https://c.test",
    operations: [
      {
        name: "o",
        readOnly: true,
        request: { method: "GET", url: "https://c.test/api/search?q=alice", headers: {} },
        slots: [{ param: "q", at: ["query:q"] }],
        params: [{ name: "q", example: "alice" }],
        trigger: { url: "https://c.test/s?q={q}" },
        response: { format: "json", extract: "results" },
        ...over,
      },
    ],
  }).operations[0]!;
const obs = (status: number, body: string, ct = "application/json", headers: Record<string, string> = {}) => ({ status, headers: { "content-type": ct, ...headers }, body });
const html = "text/html; charset=utf-8";

describe("classifier", () => {
  test("a 400/422 form page that merely carries a CSRF token is not auth; an explicit CSRF failure is", () => {
    const write = op({ readOnly: false, request: { method: "POST", url: "https://c.test/users", headers: {}, body: "u=alice" }, slots: [{ param: "q", at: ["form:u"] }] });
    const rails = `<!doctype html><html><head><meta name="csrf-param" content="authenticity_token"><meta name="csrf-token" content="Zm9vYmFy"></head><body><div id="error_explanation">Username has already been taken</div><form action="/users" method="post"><input type="hidden" name="authenticity_token" value="Zm9vYmFy"><input name="user[username]"><input type="password" name="user[password]"></form></body></html>`;
    const django = `<html><body><form method="post"><input type="hidden" name="csrfmiddlewaretoken" value="abc123"><ul class="errorlist"><li>This field is required.</li></ul><input name="username"><input type="password" name="password1"></form></body></html>`;
    assert.notEqual(classify(write, obs(422, rails, html)).class, "auth");
    assert.notEqual(classify(write, obs(400, django, html)).class, "auth");
    assert.notEqual(classify(write, obs(400, '{"error":"name is invalid","allowedHeaders":"content-type, x-csrf-token"}')).class, "auth");
    for (const body of ['{"error":"CSRF token mismatch"}', "CSRF verification failed. Request aborted.", "ActionController::InvalidAuthenticityToken", '{"message":"Invalid CSRF token"}']) {
      assert.equal(classify(write, obs(422, body, "text/plain")).class, "auth", body);
      assert.equal(classify(write, obs(403, body, "text/plain")).class, "auth", body);
    }
    assert.equal(classify(write, obs(419, "Page Expired", html)).class, "auth");
  });

  test("a vendor's script on an ordinary page is not a bot wall; its interstitial is", () => {
    const page = op({ response: { format: "html", html: { items: "li", fields: { t: "" } } } });
    const awsSdk = `<!doctype html><html><head><title>Results</title><script src="https://abcd.us-east-1.token.awswaf.com/abcd/e5f6/challenge.js"></script></head><body><ul><li>one</li><li>two</li></ul></body></html>`;
    assert.equal(classify(page, obs(200, awsSdk, html)).class, "ok");
    const dd404 = `<!doctype html><html><head><title>Not found</title><script src="https://js.datadome.co/tags.js"></script></head><body>No such user</body></html>`;
    assert.notEqual(classify(op({ slots: [{ param: "q", at: ["path:1"] }], request: { method: "GET", url: "https://c.test/u/alice", headers: {} } }), obs(404, dd404, html)).class, "blocked");
    assert.equal(classify(op(), obs(200, '{"results":[{"id":1}]}', "application/json", { "x-kpsdk-ct": "abc", "x-kpsdk-r": "1-x" })).class, "ok", "Kasada headers on a 2xx with data");
    // the real walls still are
    assert.equal(classify(op(), obs(429, "<html></html>", html, { "x-kpsdk-ct": "abc" })).class, "blocked");
    assert.equal(classify(op(), obs(403, `<html><script src="https://js.datadome.co/tags.js"></script><iframe src="https://geo.captcha-delivery.com/captcha/?initialCid=x"></iframe></html>`, html)).class, "blocked");
    assert.equal(classify(page, obs(202, `<html><script>window.awsWafCookieDomainList=[];window.gokuProps={}</script><script src="https://x.token.awswaf.com/x/challenge.js"></script></html>`, html)).class, "blocked");
    assert.equal(classify(page, obs(405, `<html><script src="https://x.captcha.awswaf.com/x/captcha.js"></script></html>`, html)).class, "blocked", "an SDK marker on a challenge status");
  });

  test("a write answered 200 with a sign-in form where JSON was learned is auth; a change-password page is still ok", () => {
    const write = op({ readOnly: false, request: { method: "POST", url: "https://c.test/api/like", headers: {}, body: '{"q":"alice"}' }, slots: [{ param: "q", at: ["body", "json:/q"] }], response: { format: "json" } });
    const signIn = `<!doctype html><html><body><form action="/login" method="post"><input name="email"><input type="password" name="password"><button>Sign in</button></form></body></html>`;
    assert.equal(classify(write, obs(200, signIn, html)).class, "auth");
    assert.equal(classify(write, obs(200, '<!doctype html><h1>Settings saved</h1><form><input type="password" name="new"></form>', html)).class, "ok");
    // an op whose learned answer is itself a page: its 2xx page is the answer
    assert.equal(classify({ ...write, response: { ...write.response, contentType: "text/html" } }, obs(200, signIn, html)).class, "ok");
  });

  test("an empty result list is ok (no results), not drift", () => {
    const o = op({ response: { format: "json", extract: "results", shape: { results: "array", "results[]": "object", "results[].id": "number", "results[].name": "string", "results[].url": "string", total: "number" } } });
    assert.equal(classify(o, obs(200, '{"results":[],"total":0}')).class, "ok");
    assert.equal(classify(o, obs(200, '{"total":0}')).class, "drift", "a missing target is still missing");
  });
});

/* ------------------------------------------------------------ call-level */

describe("call", () => {
  const home = newHome();
  const site = (name: string, over: Record<string, unknown>) => saveSite(parseSite({ name, baseUrl: "https://c.test", operations: [{ ...op(), ...over, name: "o" }] }));
  let hits: string[] = [];
  const fetchImpl = (h: (url: string, init?: RequestInit) => Response) =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      hits.push(`${init?.method ?? "GET"} ${String(input)} ${init?.body ?? ""}`);
      return h(String(input), init);
    }) as typeof fetch;
  const t1 = (h: (url: string, init?: RequestInit) => Response) => ({ fetchImpl: fetchImpl(h), maxTier: 1 as const, minIntervalMs: 0 });
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

  test("a search with no results returns ok with [] and replays nothing", async () => {
    process.env.API_ANYTHING_HOME = home;
    site("empty", {});
    hits = [];
    const r = await call("empty", "o", { q: "zzqxnonexistent" }, t1(() => json({ results: [] })));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, []);
    assert.equal(hits.length, 1, "no example replay");
  });

  test("no data for these args while the examples answer: says the operation works", async () => {
    process.env.API_ANYTHING_HOME = home;
    site("nodata", {});
    const r = await call("nodata", "o", { q: "bob" }, t1((url) => json(url.includes("alice") ? { results: [{ id: 1 }] } : {})));
    assert.equal(r.class, "input");
    assert.match(r.reason ?? "", /no results for these args .*; the example args still return data, so the operation works/);
  });

  test("a cross-origin 307 is not followed when the body carries a session value", async () => {
    process.env.API_ANYTHING_HOME = home;
    site("redir", {
      readOnly: false,
      request: { method: "POST", url: "https://c.test/api/post", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "q=alice&fb_dtsg=PLACEHOLDER" },
      slots: [
        { param: "q", at: ["form:q"] },
        { ref: "session:fb_dtsg", at: ["form:fb_dtsg"] },
      ],
    });
    saveSession("redir", { cookies: [], values: { fb_dtsg: "SECRET_DTSG_VALUE" } });
    hits = [];
    const r = await call("redir", "o", { q: "x" }, { ...t1((url) => (url.startsWith("https://c.test/") ? new Response(null, { status: 307, headers: { location: "https://other.test/collect" } }) : json({ ok: 1 }))), allowWrites: true });
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.match(r.reason ?? "", /not following the HTTP 307 redirect to https:\/\/other\.test/);
    assert.deepEqual(hits.filter((h) => h.includes("other.test")), [], "the other origin got nothing");
    // same origin, or no session value aboard: followed as before
    site("redir2", { request: { method: "GET", url: "https://c.test/api/search?q=alice", headers: {} } });
    hits = [];
    const ok = await call("redir2", "o", { q: "x" }, t1((url) => (url.startsWith("https://c.test/") ? new Response(null, { status: 307, headers: { location: "https://other.test/api" } }) : json({ results: [{ id: 1 }] }))));
    assert.equal(ok.ok, true, JSON.stringify(ok));
  });
});
