/**
 * Round-2 regressions for the learner (src/learn.ts, src/codec.ts, src/heal.ts, src/store.ts):
 * location echoes, beacons, credentials under any name or encoding, rescan association, flag
 * binding, concurrent spec writes and trigger templating. One browser test covers web storage.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-edge-r2-"));
process.env.API_ANYTHING_HOME = HOME;

import { chromeAvailable, closeBrowser } from "../../src/browser.ts";
import { call } from "../../src/execute.ts";
import { addOperation, putOperation, rescan, runOpTrigger, templatizeUrl, type CaptureFile } from "../../src/heal.ts";
import { buildRequest } from "../../src/http.ts";
import { learnOperation } from "../../src/learn.ts";
import { loadSession, saveSession } from "../../src/session.ts";
import { parseSite, type Operation } from "../../src/spec.ts";
import { exportSite, loadSite, saveSite, scanSecrets, updateSite } from "../../src/store.ts";
import type { Exchange, StoredCookie } from "../../src/types.ts";

after(() => rmSync(HOME, { recursive: true, force: true }));

let nextId = 1;
function xhr(req: { method?: string; url: string; headers?: Record<string, string>; body?: string }, resBody: unknown = { results: [{ id: 1 }, { id: 2 }] }, contentType = "application/json"): Exchange {
  return {
    id: nextId++,
    resourceType: "fetch",
    request: { method: req.method ?? "GET", url: req.url, headers: req.headers ?? {}, ...(req.body !== undefined ? { body: req.body } : {}) },
    response: { status: 200, headers: {}, contentType, body: typeof resBody === "string" ? resBody : JSON.stringify(resBody) },
  };
}
const doc = (url: string, body = "<html></html>"): Exchange => ({ ...xhr({ url }, body, "text/html"), resourceType: "document" });
const script = (url: string, body: string): Exchange => ({ ...xhr({ url }, body, "application/javascript"), resourceType: "script" });
const learn = (exchanges: Exchange[], examples: [Record<string, unknown>], extra: Partial<Parameters<typeof learnOperation>[0]> = {}) =>
  learnOperation({ exchanges, examples, cookies: [], name: "op", trigger: { url: "https://site.test/" }, readOnly: true, ...extra });
const noSession = { cookies: [] as StoredCookie[], values: {} as Record<string, string> };
const cookie = (name: string, value: string): StoredCookie => ({ name, value, domain: "site.test", path: "/", expires: -1, httpOnly: true, secure: false });

/* ------------------------------------------------- LC-01: location echoes */

describe("an example found only in an echo of the page's location is not evidence", () => {
  const page = doc("https://site.test/facebook/react");
  const cases: [string, Exchange][] = [
    ["analytics context.page.url in the body", xhr({ method: "POST", url: "https://api.site.test/repos/facebook/react", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: { page: { url: "https://site.test/facebook/react" } } }) })],
    ["an x-page-path header", xhr({ url: "https://api.site.test/repos/facebook/react", headers: { "x-page-path": "/facebook/react" } })],
    ["a src= query param holding the page URL", xhr({ url: `https://api.site.test/repos/facebook/react?src=${encodeURIComponent("https://site.test/facebook/react")}` })],
    ["a twice-encoded redirect= param", xhr({ url: `https://api.site.test/repos/facebook/react?redirect=${encodeURIComponent(encodeURIComponent("https://site.test/facebook/react"))}` })],
  ];
  for (const [label, ex] of cases) {
    test(label, () => {
      assert.throws(() => learn([page, ex], [{ repo: "facebook/react" }], { match: { path: "/repos/*/*" } }), /not in the learned request/);
    });
  }

  test("the page URL is also known from the filled trigger when the capture has no document", () => {
    const ex = xhr({ url: "https://api.site.test/repos/facebook/react", headers: { "x-page-path": "/facebook/react" } });
    assert.throws(() => learn([ex], [{ repo: "facebook/react" }], { match: { path: "/repos/*/*" }, trigger: { url: "https://site.test/{repo}" } }), /not in the learned request/);
  });

  test("control: a request that carries the value itself still learns, and its echo follows the arg", () => {
    const ex = xhr({ url: "https://api.site.test/search?q=react", headers: { "x-page-path": "/search?q=react" } });
    const { operation: op } = learn([doc("https://site.test/search?q=react"), ex], [{ q: "react" }]);
    const r = buildRequest(op, { q: "vue" }, noSession);
    assert.equal(new URL(r.url).searchParams.get("q"), "vue");
    assert.equal(r.headers["x-page-path"], "/search?q=vue");
  });
});

/* --------------------------------------------------- Product Hunt beacons */

test("a Segment-style beacon echoing the page is not learned over the SSR document (Product Hunt)", () => {
  const page = doc("https://www.site.test/search?q=notion", `<html><body>${'<li class="p">Notion</li>'.repeat(50)}</body></html>`);
  const beacon = xhr(
    {
      method: "POST",
      url: "https://e.site.test/v1/p",
      headers: { "content-type": "application/json", referer: "https://www.site.test/search?q=notion" },
      body: JSON.stringify({ type: "page", properties: { path: "/search", search: "?q=notion", url: "https://www.site.test/search?q=notion" }, context: { page: { search: "?q=notion", url: "https://www.site.test/search?q=notion" } } }),
    },
    { success: true },
  );
  const r = learn([page, beacon], [{ q: "notion" }], { trigger: { url: "https://www.site.test/search?q={q}" } });
  assert.equal(r.exchange.id, page.id, `learned ${r.exchange.request.url}`);
});

test("an ack answer ({success:true}) ranks below a real answer even when it carries the value exactly", () => {
  const page = doc("https://www.site.test/search?q=notion", `<html>${"<p>notion</p>".repeat(40)}</html>`);
  const beacon = xhr({ method: "POST", url: "https://e.site.test/v1/t", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "search", properties: { term: "notion" } }) }, { success: true });
  assert.equal(learn([page, beacon], [{ q: "notion" }]).exchange.id, page.id);
});

/* -------------------------------------------- LC-03: credentials, any name */

const TOKEN = "Zx81kLmN0pQrStUv2wXyZ3aBcD";

describe("a credential under any name stays out of the spec", () => {
  const cases: [string, Parameters<typeof xhr>[0], string][] = [
    ["auth_token query", { url: `https://api.site.test/v1/search?q=kittens&auth_token=${TOKEN}` }, "auth_token"],
    ["api_key query", { url: `https://api.site.test/v1/search?q=kittens&api_key=${TOKEN}` }, "api_key"],
    ["sid query", { url: `https://api.site.test/v1/search?q=kittens&sid=${TOKEN}` }, "sid"],
    ["refresh_token JSON", { method: "POST", url: "https://api.site.test/v1/search", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "kittens", refresh_token: TOKEN }) }, "refresh_token"],
    ["authToken JSON", { method: "POST", url: "https://api.site.test/v1/search", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "kittens", authToken: TOKEN }) }, "authToken"],
    ["id_token form", { method: "POST", url: "https://api.site.test/v1/search", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `q=kittens&id_token=${TOKEN}` }, "id_token"],
    ["x-api-key header", { url: "https://api.site.test/v1/search?q=kittens", headers: { "x-api-key": TOKEN } }, "x-api-key"],
    ["x-session-id header", { url: "https://api.site.test/v1/search?q=kittens", headers: { "x-session-id": TOKEN } }, "x-session-id"],
  ];
  for (const [label, req, name] of cases) {
    test(label, () => {
      const { operation: op, sessionValues } = learn([xhr(req)], [{ q: "kittens" }]);
      assert.ok(!JSON.stringify(op).includes(TOKEN), "the token is literal in the spec");
      assert.equal(sessionValues[`op/${name}`], TOKEN, "its value goes to the session store");
      assert.ok(JSON.stringify(buildRequest(op, { q: "cats" }, { cookies: [], values: sessionValues })).includes(TOKEN), "a call sends it from the session store");
    });
  }

  test("a value the page keeps in localStorage (inside a JSON entry, under a plain name) is a session: ref", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl";
    const storage = { "sb-proj-auth": JSON.stringify({ access_token: jwt, expires_at: 1 }), theme: "dark" };
    const ex = xhr({ method: "POST", url: "https://api.site.test/v1/search", headers: { "content-type": "application/json", "x-user": jwt }, body: JSON.stringify({ q: "kittens", u: `v1:${jwt}` }) });
    const { operation: op, sessionValues } = learn([ex], [{ q: "kittens" }], { storage });
    assert.ok(!JSON.stringify(op).includes(jwt));
    const refs = op.slots.filter((s) => s.ref).map((s) => [s.ref, s.at.join(" > ")]);
    assert.deepEqual(refs, [["session:op/sb-proj-auth/access_token", "header:x-user"], ["session:op/sb-proj-auth/access_token", "body > json:/u"]]);
    assert.equal(sessionValues["op/sb-proj-auth/access_token"], jwt);
    const r = buildRequest(op, { q: "cats" }, { cookies: [], values: sessionValues });
    assert.equal(r.headers["x-user"], jwt);
    assert.deepEqual(JSON.parse(r.body!), { q: "cats", u: `v1:${jwt}` });
  });

  test("a credential-named key the site ships in its own JS is public: kept literal, listed, and export allows it", () => {
    const key = "d306zoyjsyarp7ifhu67rjxn52tv0t20";
    const ex = xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-site-api-key": key } });
    const { operation: op } = learn([script("https://site.test/main.js", `var cfg={apiKey:"${key}"};`), ex], [{ q: "kittens" }]);
    assert.equal(op.request.headers["x-site-api-key"], key);
    assert.deepEqual(op.public, ["x-site-api-key"]);
    saveSite(parseSite({ name: "shipped", baseUrl: "https://site.test", operations: [op] }));
    assert.deepEqual(exportSite("shipped").secrets, []);
  });

  test("public hashes, traceparent and client versions are not credentials", () => {
    const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";
    const trace = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";
    const ex = xhr({
      url: `https://site.test/api/v3/StaysSearch/${hash}?operationName=StaysSearch&variables=${encodeURIComponent('{"q":"paris"}')}&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }))}`,
      headers: { traceparent: trace, "x-client-version": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", "x-client-request-id": "0x9f8e7d6c5b4a39281706f5e4d3c2b1a0" },
    });
    const { operation: op } = learn([ex], [{ q: "paris" }]);
    assert.deepEqual(op.slots.filter((s) => s.ref), []);
    assert.equal(op.request.headers.traceparent, trace);
    assert.ok(op.request.url.includes(hash));
  });

  test("export refuses a credential-named literal in a hand-written spec, and allows it once marked public", () => {
    const op = learn([xhr({ url: "https://api.site.test/v1/search?q=kittens" })], [{ q: "kittens" }]).operation;
    const leaky = { ...op, request: { ...op.request, url: `https://api.site.test/v1/search?q=kittens&api_key=${TOKEN}`, headers: { "x-auth-token": TOKEN } } };
    saveSite(parseSite({ name: "leaky", baseUrl: "https://api.site.test", operations: [leaky] }));
    const r = exportSite("leaky");
    assert.equal(r.secrets.length, 2, r.secrets.join("\n"));
    assert.ok(r.secrets.some((s) => s.includes("api_key")) && r.secrets.some((s) => s.includes("x-auth-token")));
    saveSite(parseSite({ name: "leaky", baseUrl: "https://api.site.test", operations: [{ ...leaky, public: ["api_key", "x-auth-token"] }] }));
    assert.deepEqual(exportSite("leaky").secrets, []);
  });
});

/* ------------------------------------------- cookies in every encoding */

const COOKIE = "q2Fz/9kLmT0vX+Yb7NcW1pRe/Hs3JuQa8Df+Lg6ZoVy4=";

test("a cookie inside a twice-encoded next= URL is a templated ref, refilled at the same depth", () => {
  const url = `https://site.test/api/data?name=alice&next=${encodeURIComponent(`/cb?auth=${encodeURIComponent(COOKIE)}`)}`;
  const cookies = [cookie("tok", COOKIE)];
  const ex = xhr({ url, headers: { cookie: `tok=${COOKIE}` } });
  const { operation: op } = learnOperation({ exchanges: [ex], examples: [{ name: "alice" }], cookies, name: "op", trigger: { url: "https://site.test/p?name={name}" }, readOnly: true });
  const spec = JSON.stringify(op);
  for (const f of [COOKIE, encodeURIComponent(COOKIE), encodeURIComponent(encodeURIComponent(COOKIE))]) assert.ok(!spec.includes(f), `cookie in the spec as ${f}`);
  assert.equal(buildRequest(op, { name: "alice" }, { cookies, values: {} }).url, url);
});

test("a leaf holding both an arg and a credential (next=/search?q=<arg>&auth=<cookie>) keeps the credential a ref", () => {
  const next = (q: string, tok: string) => encodeURIComponent(`/search?q=${q}&auth=${encodeURIComponent(tok)}`);
  const url = (q: string, tok: string) => `https://site.test/api/data?name=${q}&next=${next(q, tok)}`;
  const COOKIE2 = "Zx9/Qw8vLm7+Kj6HgF5dS4aP3oI2uY1t";
  const { operation: op, warnings } = learnOperation({
    exchanges: [xhr({ url: url("alice", COOKIE), headers: { cookie: `tok=${COOKIE}` } })],
    exchanges2: [xhr({ url: url("bob", COOKIE2), headers: { cookie: `tok=${COOKIE2}` } })],
    examples: [{ name: "alice" }, { name: "bob" }],
    cookies: [cookie("tok", COOKIE)],
    name: "op",
    trigger: { url: "https://site.test/p?name={name}" },
    readOnly: true,
  });
  const spec = JSON.stringify(op);
  for (const f of [COOKIE, encodeURIComponent(COOKIE), encodeURIComponent(encodeURIComponent(COOKIE))]) assert.ok(!spec.includes(f), `cookie in the spec as ${f}`);
  assert.equal(op.minTier, 1, `the session hole is no nonce: ${warnings.join("; ")}`);
  assert.ok(!warnings.some((w) => /run 2 has/.test(w)), warnings.join("; "));
  assert.equal(buildRequest(op, { name: "carol" }, { cookies: [cookie("tok", COOKIE2)], values: {} }).url, url("carol", COOKIE2));
  // a session value in the same place is refilled from the session store
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl";
  const s = learn([xhr({ url: `https://site.test/api/data?name=alice&next=${next("alice", jwt)}` })], [{ name: "alice" }], { storage: { at: jwt }, trigger: { url: "https://site.test/p?name={name}" } });
  assert.ok(!JSON.stringify(s.operation).includes(encodeURIComponent(jwt)));
  assert.equal(s.sessionValues["op/at"], jwt);
  assert.equal(buildRequest(s.operation, { name: "bob" }, { cookies: [], values: s.sessionValues }).url, `https://site.test/api/data?name=bob&next=${next("bob", jwt)}`);
});

test("the secret scan finds a live value percent-encoded once or twice, JSON-escaped, \\u-escaped and base64'd", () => {
  const tok = "ab/cd+ef12=";
  const s = { cookies: [cookie("sid", tok)], values: {} };
  const forms = {
    pct: `https://s.test/api?x=${encodeURIComponent(tok)}`,
    doublePct: `https://s.test/api?next=${encodeURIComponent(`/cb?t=${encodeURIComponent(tok)}`)}`,
    jsonEscapedThenPct: `https://s.test/api?v=${encodeURIComponent(JSON.stringify({ t: tok }).replace(/\//g, "\\/"))}`,
    base64: `https://s.test/api?state=${Buffer.from(JSON.stringify({ t: tok })).toString("base64")}`,
    base64url: `https://s.test/api?state=${Buffer.from(JSON.stringify({ t: tok })).toString("base64url")}`,
    unicodeEscape: JSON.stringify({ t: tok.replace(/\+/g, "\\u002b") }),
    strayPercent: `100% of https://s.test/api?x=${encodeURIComponent(tok)}`,
  };
  for (const [k, v] of Object.entries(forms)) assert.ok(scanSecrets({ url: v }, s).secrets.length, `missed ${k}`);
  assert.deepEqual(scanSecrets({ url: "https://s.test/api?x=abcdef" }, s).secrets, [], "control");
});

test("export flags a literal IP address (innertube remoteHost), not versions or loopback", () => {
  const body = JSON.stringify({ context: { client: { remoteHost: "203.0.113.7", clientVersion: "2.20260927.01.00", ip6: "2001:db8::7" } }, query: "kittens" });
  const op = learn([xhr({ method: "POST", url: "https://www.site.test/youtubei/v1/search", headers: { "content-type": "application/json", "user-agent": "Chrome/140.0.0.0", "x-forwarded-for": "127.0.0.1" }, body })], [{ query: "kittens" }]).operation;
  saveSite(parseSite({ name: "ip", baseUrl: "https://www.site.test", operations: [op] }));
  const ips = exportSite("ip").warnings.filter((w) => w.includes("IP address"));
  assert.equal(ips.length, 2, ips.join("\n"));
  assert.ok(ips[0]!.includes("203.0.113.7") && ips[1]!.includes("2001:db8::7"));
});

/* ---------------------------------------------- HEAL-2/3: rescan variants */

describe("rescan associates the token with the anchor's own module", () => {
  const A = "2".repeat(16);
  const B = "3".repeat(16);
  const C = "4".repeat(16);
  const run = async (bundle: string, readOnly: boolean) => {
    const fetchImpl = (async (u: string) =>
      String(u).endsWith("/app.js") ? new Response(bundle) : new Response('<html><script src="/app.js"></script></html>')) as typeof fetch;
    const op = parseSite({
      name: "s",
      baseUrl: "https://s.example",
      operations: [
        {
          name: "q",
          readOnly,
          request: { method: "POST", url: "https://s.example/graphql/query", headers: {}, body: `doc_id=${"1".repeat(16)}&fb_api_req_friendly_name=ProfileQuery` },
          volatile: [{ at: ["form:doc_id"], shape: { charset: "digits", length: 16 }, anchor: "ProfileQuery" }],
          trigger: { url: "https://s.example/p" },
        },
      ],
    }).operations[0]!;
    return (await rescan("s", op, {}, fetchImpl))?.diff.split("-> ")[1];
  };
  test("Meta modules with 'use strict'; inside", async () => {
    const bundle =
      `__d("FeedQuery_instagramRelayOperation",[],(function(a,b,c,d,e,f){"use strict";e.exports="${A}"}),null);` +
      `__d("ProfileQuery_instagramRelayOperation",[],(function(a,b,c,d,e,f){"use strict";e.exports="${B}"}),null);`;
    assert.equal(await run(bundle, true), B);
    assert.equal(await run(bundle, false), B);
  });
  test("the anchor also named in another statement (a log message) next to another id", async () => {
    const bundle = `log("ProfileQuery failed",{doc:"${C}"});__d("ProfileQuery_instagramRelayOperation",[],(function(a,b,c,d,e,f){e.exports="${B}"}),null);`;
    assert.equal(await run(bundle, true), B);
    assert.equal(await run(bundle, false), B);
  });
  test("an array of records, id first: the anchor's own record", async () => {
    assert.equal(await run(`[{id:"${A}",name:"FeedQuery"},{id:"${B}",name:"ProfileQuery"},{id:"${C}",name:"StoryQuery"}]`, true), B);
  });
});

/* ------------------------------------------------------- LC-07: one flag */

test("a boolean example never binds to a lone flag under another key", () => {
  const ex = xhr({ method: "POST", url: "https://api.site.test/gql", headers: { "content-type": "application/json" }, body: JSON.stringify({ variables: { screen_name: "nasa", withVoice: true } }) });
  assert.throws(() => learn([ex], [{ screen_name: "nasa", includeReplies: true }]), /none with the key "includeReplies"/);
  const own = xhr({ method: "POST", url: "https://api.site.test/gql", headers: { "content-type": "application/json" }, body: JSON.stringify({ variables: { screen_name: "nasa", includeReplies: true } }) });
  const { operation: op } = learn([own], [{ screen_name: "nasa", includeReplies: true }]);
  assert.deepEqual(op.slots.find((s) => s.param === "includeReplies")?.at, ["body", "json:/variables/includeReplies"]);
});

/* ----------------------------------------------- EC-19: concurrent writes */

test("an add saves under the site lock with a fresh read, so a concurrent add's op survives", async () => {
  // Run 1 and run 2 differ in a nonce, so add replays the template once (an await) before saving;
  // another add lands during that replay.
  const capture = (q: string, nonce: string): CaptureFile => {
    const url = `https://site.test/search?q=${q}`;
    return { id: `c${nextId++}`, at: new Date().toISOString(), url, exchanges: [xhr({ url: `https://site.test/api/search?q=${q}&n=${nonce}` })], cookies: [], finalUrl: url };
  };
  const other: Operation = learn([xhr({ url: "https://site.test/api/user?name=alice" })], [{ name: "alice" }], { name: "user" }).operation;
  const fetchImpl = (async () => {
    updateSite("race", (s) => putOperation(s ?? { name: "race", baseUrl: "https://site.test", operations: [] }, other));
    return new Response(JSON.stringify({ results: [{ id: 1 }, { id: 2 }] }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const r = await addOperation({ site: "race", op: "search", examples: [{ q: "hello" }, { q: "world" }], from: { capture: capture("hello", "Zq81kPq0aB3dF7") }, from2: capture("world", "Mm4nR7sT1uV5wX"), fetchImpl });
  assert.equal(r.replaced, false);
  assert.deepEqual(loadSite("race")!.site.operations.map((o) => o.name).sort(), ["search", "user"]);
});

/* ------------------------------------------------- LC-02: trigger template */

test("a value equal to a path segment and to a query value under another key templates both", () => {
  assert.equal(templatizeUrl("https://s.test/u/nasa?tab=nasa", { name: "nasa" }), "https://s.test/u/{name}?tab={name}");
  assert.equal(templatizeUrl("https://s.test/r/python/search?q=python", { q: "python" }), "https://s.test/r/python/search?q={q}", "a key named like the param is its position");
});

/* --------------------------------------------- web storage, in the browser */

describe("a token the page keeps in localStorage", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  let server: Server;
  const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.Zm9vYmFyYmF6cXV4";
  after(async () => {
    await closeBrowser();
    server?.closeAllConnections();
    server?.close();
  });
  test("is captured, learned as a templated session: ref (never in the spec), replayed at tier 1, and refreshed by a trigger run", async () => {
    server = createServer((req, res) => {
      const u = new URL(req.url!, "http://x");
      if (u.pathname === "/p") {
        res.writeHead(200, { "content-type": "text/html" });
        return res.end(
          `<script>localStorage.setItem("app-auth", JSON.stringify({jwt:${JSON.stringify(JWT)}}));` +
            `fetch("/api/data?name="+encodeURIComponent(new URLSearchParams(location.search).get("name")),{headers:{"x-user-jwt":"v1:"+${JSON.stringify(JWT)}}})</script>`,
        );
      }
      if (u.pathname === "/api/data") {
        const ok = req.headers["x-user-jwt"] === `v1:${JWT}`;
        res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
        return res.end(JSON.stringify(ok ? { data: { name: u.searchParams.get("name") } } : { error: "login" }));
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const r = await addOperation({ site: "store", op: "get", trigger: { url: `${base}/p?name={name}` }, examples: [{ name: "alice" }, { name: "bobby" }], response: { extract: "data" } });
    assert.ok(!JSON.stringify(loadSite("store")!.site).includes(JWT), "the token is in the spec");
    assert.deepEqual(r.operation.slots.filter((s) => s.ref).map((s) => s.ref), ["session:get/app-auth/jwt"]);
    assert.equal(loadSession("store").values["get/app-auth/jwt"], JWT);
    const got = await call("store", "get", { name: "carol" }, { maxTier: 1, minIntervalMs: 0 });
    assert.equal(got.ok, true, JSON.stringify(got));
    assert.deepEqual(got.data, { name: "carol" });
    // a trigger run refreshes the value from the site's own request: the token, not the whole "v1:<token>" leaf
    saveSession("store", { ...loadSession("store"), values: {} });
    await runOpTrigger("store", loadSite("store")!.site.operations[0]!, { name: "dave" });
    assert.equal(loadSession("store").values["get/app-auth/jwt"], JWT);
  });
});
