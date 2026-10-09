import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, type Observed } from "../src/classify.js";
import { type Operation, OperationSchema } from "../src/spec.js";

const op = (over: Record<string, unknown> = {}): Operation =>
  OperationSchema.parse({
    name: "getUser",
    request: { method: "GET", url: "https://x.com/i/api/graphql/ID/UserByScreenName?variables=%7B%7D", headers: {} },
    slots: [{ param: "screen_name", at: ["query:variables", "json:/screen_name"] }],
    trigger: { url: "https://x.com/{screen_name}" },
    params: [{ name: "screen_name" }],
    response: { format: "json", extract: "data.user" },
    readOnly: true,
    ...over,
  });

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Observed => ({
  status,
  headers: { "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const html = (status: number, body: string): Observed => ({
  status,
  headers: { "content-type": "text/html; charset=utf-8" },
  body,
});
const cls = (o: Operation, r: Observed) => classify(o, r).class;

test("ok: 2xx JSON with the extract path present", () => {
  assert.deepEqual(classify(op(), json(200, { data: { user: { name: "NASA" } } })), { class: "ok", reason: "ok" });
  assert.equal(
    cls(op({ response: { format: "json", xssiPrefix: ")]}'", extract: "a" } }), json(200, ')]}\'\n{"a":1}')),
    "ok",
  );
});

test("drift: 404 on templated API path, persisted-query errors, missing extract, shape change", () => {
  assert.equal(cls(op(), json(404, { message: "Query not found" })), "drift");
  assert.equal(cls(op(), json(200, { errors: [{ message: "PersistedQueryNotFound" }], data: null })), "drift");
  assert.equal(cls(op(), json(400, { errors: [{ message: "The following features cannot be null: x" }] })), "drift");
  assert.equal(cls(op(), json(200, { data: {} })), "drift");
  const shaped = op({
    response: {
      format: "json",
      shape: { a: "object", "a.b": "string", "a.c": "number", "a.d": "array", "a.e": "boolean" },
    },
  });
  assert.equal(cls(shaped, json(200, { a: { b: "x", c: 1, d: [], e: null } })), "ok");
  assert.equal(cls(shaped, json(200, { z: { y: 1 } })), "drift");
  assert.equal(
    cls(op(), html(200, "<!doctype html><title>x</title><div>app</div>")),
    "drift",
    "HTML where JSON expected",
  );
  assert.equal(cls(op(), json(200, "not json at all")), "drift");
});

test("404 with the param in the URL path is input (the entity does not exist)", () => {
  const byPath = op({ slots: [{ param: "screen_name", at: ["path:0"] }] });
  assert.equal(cls(byPath, json(404, {})), "input");
});

test("auth: 401, 403 with login markers, require_login, HTML login page, login redirect, GraphQL auth error", () => {
  assert.equal(cls(op(), json(401, { errors: [{ code: 32, message: "Could not authenticate you" }] })), "auth");
  assert.equal(cls(op(), json(403, { message: "login_required" })), "auth");
  assert.equal(
    cls(
      op(),
      json(401, { message: "Please wait a few minutes before you try again.", require_login: true, status: "fail" }),
    ),
    "auth",
    "Instagram require_login wins over the rate wording",
  );
  assert.equal(cls(op(), html(200, '<html><form><input type="password" name="pass"></form></html>')), "auth");
  assert.equal(
    cls(op(), { ...json(200, { data: { user: {} } }), url: "https://x.com/i/flow/login?redirect=1" }),
    "auth",
  );
  assert.equal(cls(op(), json(200, { errors: [{ message: "Bad guest token" }], data: null })), "auth");
});

test("rate: 429 and rate-limit wording on errors", () => {
  assert.equal(cls(op(), json(429, {})), "rate");
  assert.equal(cls(op(), json(420, { message: "Rate limit exceeded" })), "rate");
});

test("blocked: vendor challenge pages even at 200, cf-mitigated, bare 403", () => {
  assert.equal(
    cls(
      op(),
      html(
        403,
        "<html><head><title>Just a moment...</title></head><script src=/cdn-cgi/challenge-platform/h/b/cf-chl-x></script></html>",
      ),
    ),
    "blocked",
  );
  assert.equal(
    cls(op(), html(200, '<html><script src="https://ct.captcha-delivery.com/c.js"></script></html>')),
    "blocked",
  );
  assert.equal(cls(op(), json(403, { url: "https://geo.captcha-delivery.com/captcha/?initialCid=x" })), "blocked");
  assert.equal(cls(op(), html(200, '<div id="px-captcha"></div>')), "blocked");
  assert.equal(cls(op(), html(200, "<html><title>Reddit - Prove your humanity</title></html>")), "blocked");
  assert.equal(
    cls(op(), html(403, "<H1>Access Denied</H1> Reference #18.1 https://errors.edgesuite.net/18.1")),
    "blocked",
  );
  assert.equal(cls(op(), { ...json(403, ""), headers: { "cf-mitigated": "challenge" } }), "blocked");
  assert.equal(cls(op(), json(403, "")), "blocked");
  const reason = classify(op(), html(200, "<html><title>Just a moment...</title></html>")).reason;
  assert.match(reason, /Cloudflare/);
});

test("a large legit HTML page that mentions recaptcha is not blocked", () => {
  const page = op({ response: { format: "html", html: { items: "tr.athing", fields: { t: "a" } } }, slots: [] });
  const body = `<html><script src="https://www.google.com/recaptcha/api.js"></script>${"<tr class=athing><td><a>x</a></td></tr>".repeat(3000)}</html>`;
  assert.equal(cls(page, html(200, body)), "ok");
  assert.equal(cls(page, html(200, "<html><p>nothing here</p></html>")), "drift");
});

test("input: 400 naming a param; error: 5xx and unexplained GraphQL errors", () => {
  assert.equal(cls(op(), json(400, { error: "screen_name is invalid" })), "input");
  assert.equal(cls(op(), json(400, { error: "something odd" })), "error");
  assert.equal(cls(op(), json(503, "upstream")), "error");
  assert.equal(cls(op(), json(200, { errors: [{ message: "User has been suspended" }], data: null })), "error");
});

test("embedded: missing data is drift, present is ok", () => {
  const emb = op({ response: { format: "embedded", embedded: { regex: "data:(\\[)" } } });
  assert.equal(cls(emb, html(200, "<script>x({data:[1,2]})</script>")), "ok");
  assert.equal(cls(emb, html(200, "<script>nothing</script>")), "drift");
});

test("auth and rate signals win over drift when the data is gone (X code 215, Instagram 200 JSON, csrf 403)", () => {
  assert.equal(cls(op(), json(400, { errors: [{ message: "Bad Authentication data", code: 215 }] })), "auth");
  assert.equal(
    cls(
      op(),
      json(403, { errors: [{ code: 353, message: "This request requires a matching csrf cookie and header." }] }),
    ),
    "auth",
  );
  assert.equal(cls(op(), json(200, { message: "login_required", require_login: true, status: "fail" })), "auth");
  assert.equal(
    cls(
      op(),
      json(200, { message: "Please wait a few minutes before you try again.", require_login: false, status: "fail" }),
    ),
    "rate",
  );
  assert.equal(cls(op(), json(200, { errors: [{ message: "Rate limit exceeded" }], data: {} })), "rate");
  assert.equal(
    cls(op(), json(200, { data: { user: { bio: "I rate limit my coffee" } } })),
    "ok",
    "wording alone does not matter when the data is there",
  );
});

test("missing data is drift flagged missing, so the caller can check the example args first", () => {
  assert.deepEqual(classify(op(), json(200, { data: {} })), {
    class: "drift",
    reason: 'extract path "data.user" missing',
    missing: true,
  });
  // a read's 404 on a query-param API may be "no such user": the example args tell (edge EC-09)
  assert.equal(
    classify(op(), json(404, "")).missing,
    true,
    "a read's 404 on a templated API path is checked against the examples",
  );
  assert.equal(classify(op({ readOnly: false }), json(404, "")).missing, undefined, "a write's 404 is plain drift");
  // Next.js /_next/data/<buildId>/u/<name>.json: 404 after a deploy is not "no such user"
  const next = op({
    slots: [{ param: "screen_name", at: ["path:4"], template: "{screen_name}.json" }],
    volatile: [{ at: ["path:2"], shape: { charset: "base64url", length: 21 }, anchor: "u" }],
  });
  assert.deepEqual(classify(next, html(404, "<html>404</html>")), {
    class: "drift",
    reason: "HTTP 404",
    missing: true,
  });
});

test("a write's 2xx is ok whatever the body; judge hands back the text; a bad recipe is an error, not a throw", async () => {
  const { judge } = await import("../src/classify.js");
  const write = op({ readOnly: false, response: { format: "json" } });
  for (const r of [
    json(204, ""),
    html(200, "<html><body>Liked!</body></html>"),
    { status: 200, headers: {}, body: "OK" },
  ]) {
    assert.equal(cls(write, r), "ok", r.body);
  }
  assert.deepEqual(judge(write, { status: 200, headers: {}, body: "OK" }), {
    class: "ok",
    reason: "HTTP 200, non-JSON body",
    data: "OK",
  });
  // the write ran; a landing page with a change-password form is not a login wall (edge EC-05)
  assert.equal(cls(write, html(200, '<form><input type="password"></form>')), "ok");
  assert.equal(cls(write, json(200, { errors: [{ message: "denied" }], data: null })), "error");
  const bad = op({ response: { format: "html", html: { items: "li[", fields: {} } } });
  assert.equal(judge(bad, html(200, "<li>x</li>")).class, "error");
});

test("a logged-out page that only links a sign-in page (Google's ServiceLogin button) is not auth; a sign-in form or a ServiceLogin redirect is", () => {
  const link = `<html><body><a href="https://accounts.google.com/ServiceLogin?hl=en">Sign in</a><div>Explore destinations</div></body></html>`;
  const embedded = op({
    request: { method: "GET", url: "https://www.google.com/travel/flights?q=x", headers: {} },
    response: { format: "embedded", embedded: { regex: "key: 'ds:1'[^[]*data:(\\[)" } },
  });
  const listed = op({
    request: { method: "GET", url: "https://s.test/search?q=x", headers: {} },
    response: { format: "html", html: { items: "li.r", fields: { t: "" } } },
  });
  for (const o of [embedded, listed]) {
    const c = classify(o, html(200, link));
    assert.equal(c.class, "drift", c.reason);
    assert.equal(c.missing, true);
    const form = `<html><form action="/signin"><input name="email"><input type="password" name="pw"></form></html>`;
    assert.equal(cls(o, html(200, form)), "auth");
    assert.equal(cls(o, { ...html(200, link), url: "https://accounts.google.com/ServiceLogin?continue=x" }), "auth");
    assert.equal(cls(o, html(200, "<html><p>Please sign in to continue</p></html>")), "auth");
  }
});

test("an extract ending in [*] returns the items: the learned shape is compared per item", () => {
  const items = op({
    response: {
      format: "json",
      extract: "[*]",
      shape: { "[]": "object", "[].id": "string", "[].title": "string", "[].rating": "string", "[].count": "number" },
    },
  });
  assert.equal(
    cls(
      items,
      json(200, [
        { id: "1", title: "Dune", rating: "4.29", count: 10 },
        { id: "2", title: "Emma", rating: "4.0", count: 3 },
      ]),
    ),
    "ok",
  );
  assert.equal(cls(items, json(200, [{ other: 1 }, { other: 2 }])), "drift");
  const nested = op({
    response: {
      format: "json",
      extract: "results[*]",
      shape: {
        results: "array",
        "results[]": "object",
        "results[].a": "string",
        "results[].b": "number",
        "results[].c": "boolean",
      },
    },
  });
  assert.equal(cls(nested, json(200, { results: [{ a: "x", b: 1, c: true }] })), "ok");
});
