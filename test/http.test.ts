import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { buildRequest, send } from "../src/http.js";
import type { Session } from "../src/session.js";
import { type Operation, OperationSchema } from "../src/spec.js";
import type { StoredCookie } from "../src/types.js";

const cookie = (name: string, value: string, domain: string): StoredCookie => ({
  name,
  value,
  domain,
  path: "/",
  expires: -1,
  httpOnly: false,
  secure: false,
});

const op = (over: Record<string, unknown> = {}): Operation =>
  OperationSchema.parse({
    name: "reply",
    request: {
      method: "post",
      url: "https://x.com/i/api/graphql/ID/CreateTweet",
      headers: { "content-type": "application/json", "x-csrf-token": "", authorization: "", "csrf-token": "" },
      body: '{"variables":{"tweet_text":"hi","reply":{"in_reply_to_tweet_id":"1"},"count":20,"dark":false},"queryId":"ID"}',
    },
    slots: [
      { param: "text", at: ["body", "json:/variables/tweet_text"] },
      { param: "tweet_id", at: ["body", "json:/variables/reply/in_reply_to_tweet_id"] },
      { param: "count", at: ["body", "json:/variables/count"] },
      { param: "dark", at: ["body", "json:/variables/dark"] },
      { ref: "cookie:ct0", at: ["header:x-csrf-token"] },
      { ref: "cookie:JSESSIONID", transform: "strip-quotes", at: ["header:csrf-token"] },
      { ref: "session:authorization", at: ["header:authorization"] },
    ],
    params: [
      { name: "text" },
      { name: "tweet_id" },
      { name: "count", type: "number", default: 20 },
      { name: "dark", type: "boolean", required: false },
    ],
    trigger: { url: "https://x.com/compose" },
    readOnly: false,
    ...over,
  });

const session: Session = {
  cookies: [
    cookie("ct0", "csrf123", ".x.com"),
    cookie("JSESSIONID", '"ajax:42"', ".x.com"),
    cookie("elsewhere", "no", ".other.com"),
  ],
  values: { authorization: "Bearer PUBLIC" },
};

test("buildRequest fills params with native types, refs with transforms, and scopes cookies", () => {
  const req = buildRequest(
    op(),
    { text: 'He said "hi"', tweet_id: "2085462611575857621", count: "1234567890123456789", dark: "false" },
    session,
  );
  assert.equal(req.method, "POST");
  assert.equal(
    req.body,
    '{"variables":{"tweet_text":"He said \\"hi\\"","reply":{"in_reply_to_tweet_id":"2085462611575857621"},"count":1234567890123456789,"dark":false},"queryId":"ID"}',
  );
  assert.equal(req.headers["x-csrf-token"], "csrf123");
  assert.equal(req.headers["csrf-token"], "ajax:42");
  assert.equal(req.headers.authorization, "Bearer PUBLIC");
  assert.equal(req.headers.cookie, 'ct0=csrf123; JSESSIONID="ajax:42"');
});

test("buildRequest: defaults, missing required params, bad types, missing session values drop the header", () => {
  const req = buildRequest(op(), { text: "a", tweet_id: "5" }, { cookies: [], values: {} });
  assert.match(req.body!, /"count":20,"dark":false/);
  assert.equal("authorization" in req.headers, false);
  assert.equal("x-csrf-token" in req.headers, false);
  assert.equal(req.headers.cookie, undefined);
  assert.throws(() => buildRequest(op(), { text: "a" }, session), /missing required param "tweet_id"/);
  assert.throws(() => buildRequest(op(), { text: "a", tweet_id: "1", dark: "yes" }, session), /must be boolean/);
});

test("template slots fill a substring of the leaf", () => {
  const search = OperationSchema.parse({
    name: "search",
    request: { method: "GET", url: "https://a.test/s?q=from%3Anasa%20lang%3Aen&n=1", headers: {} },
    slots: [{ param: "user", at: ["query:q"], template: "from:{user} lang:en" }],
    params: [{ name: "user" }],
    trigger: { url: "https://a.test/" },
    readOnly: true,
  });
  assert.equal(
    buildRequest(search, { user: "esa" }, { cookies: [], values: {} }).url,
    "https://a.test/s?q=from%3Aesa%20lang%3Aen&n=1",
  );
});

test("send: injectable fetch, returns status/headers/body/url/ms", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const r = await send(op(), { text: "a", tweet_id: "5" }, session, { site: "t1", fetchImpl, minIntervalMs: 0 });
  assert.equal(r.status, 200);
  assert.equal(r.body, '{"ok":true}');
  assert.equal(r.headers["content-type"], "application/json");
  assert.equal(seen!.init.method, "POST");
  assert.equal((seen!.init.headers as Record<string, string>)["x-csrf-token"], "csrf123");
  assert.ok(r.ms >= 0);
});

test("send against a local server: GET has no body, per-site pacing, timeout", async () => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/slow")) return void setTimeout(() => res.end("late"), 500);
    res.setHeader("content-type", "text/plain");
    res.end(`${req.method} ${req.url} ${req.headers.cookie ?? ""}`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const get = OperationSchema.parse({
      name: "g",
      request: { method: "GET", url: `${base}/items?id=1`, headers: {} },
      slots: [{ param: "id", at: ["query:id"] }],
      params: [{ name: "id" }],
      trigger: { url: base },
      readOnly: true,
    });
    const local: Session = { cookies: [cookie("sid", "abc", "127.0.0.1")], values: {} };
    // pacing is measured where fetch is called, so server/network jitter can't flake it
    const calls: number[] = [];
    const timed = ((url: string, init: RequestInit) => {
      calls.push(Date.now());
      return fetch(url, init);
    }) as typeof fetch;
    const a = await send(get, { id: "123" }, local, { site: "pace", minIntervalMs: 150, fetchImpl: timed });
    const b = await send(get, { id: "456" }, local, { site: "pace", minIntervalMs: 150, fetchImpl: timed });
    assert.equal(a.body, "GET /items?id=123 sid=abc");
    assert.equal(b.body, "GET /items?id=456 sid=abc");
    assert.ok(calls[1]! - calls[0]! >= 149, `paced ${calls[1]! - calls[0]!} ms apart`);
    assert.equal(a.url, `${base}/items?id=123`);

    const slow = { ...get, request: { ...get.request, url: `${base}/slow?id=1` } };
    await assert.rejects(
      send(slow, { id: "1" }, local, { site: "slow", minIntervalMs: 0, timeoutMs: 50 }),
      /no response within 50 ms/,
    );
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("send: a cross-origin redirect drops cookie-derived and session headers; same-origin keeps them", async () => {
  let seen: Record<string, unknown> = {};
  const other = createServer((req, res) => {
    seen = req.headers;
    res.setHeader("content-type", "application/json");
    res.end('{"landed":true}');
  });
  await new Promise<void>((r) => other.listen(0, "127.0.0.1", r));
  const otherUrl = `http://127.0.0.1:${(other.address() as AddressInfo).port}/landing`;
  let sameHeaders: Record<string, unknown> = {};
  const site = createServer((req, res) => {
    if (req.url === "/away") return void res.writeHead(302, { location: otherUrl }).end();
    if (req.url === "/here") return void res.writeHead(307, { location: "/final" }).end();
    sameHeaders = req.headers;
    res.setHeader("content-type", "application/json");
    res.end("{}");
  });
  await new Promise<void>((r) => site.listen(0, "localhost", r));
  const base = `http://localhost:${(site.address() as AddressInfo).port}`;
  const me = (path: string) =>
    OperationSchema.parse({
      name: "me",
      readOnly: true,
      request: { method: "GET", url: `${base}${path}`, headers: { "x-csrf-token": "", "x-keep": "1" } },
      slots: [{ ref: "cookie:ct0", at: ["header:x-csrf-token"] }],
      trigger: { url: base },
    });
  const local: Session = { cookies: [cookie("ct0", "SECRET-CSRF-COOKIE-VALUE", "localhost")], values: {} };
  try {
    const r = await send(me("/away"), {}, local, { site: "redir", minIntervalMs: 0 });
    assert.equal(r.body, '{"landed":true}');
    assert.equal(r.url, otherUrl);
    assert.equal(seen["x-csrf-token"], undefined);
    assert.equal(seen.cookie, undefined);
    assert.equal(seen["x-keep"], "1");
    await send(me("/here"), {}, local, { site: "redir", minIntervalMs: 0 });
    assert.equal(sameHeaders["x-csrf-token"], "SECRET-CSRF-COOKIE-VALUE");
    assert.equal(sameHeaders.cookie, "ct0=SECRET-CSRF-COOKIE-VALUE");
  } finally {
    for (const s of [site, other]) {
      s.closeAllConnections();
      s.close();
    }
  }
});
