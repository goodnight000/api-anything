import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, type Observed } from "../src/classify.ts";
import { OperationSchema, type Operation } from "../src/spec.ts";

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
const html = (status: number, body: string): Observed => ({ status, headers: { "content-type": "text/html; charset=utf-8" }, body });
const cls = (o: Operation, r: Observed) => classify(o, r).class;

test("ok: 2xx JSON with the extract path present", () => {
  assert.deepEqual(classify(op(), json(200, { data: { user: { name: "NASA" } } })), { class: "ok", reason: "ok" });
  assert.equal(cls(op({ response: { format: "json", xssiPrefix: ")]}'", extract: "a" } }), json(200, ')]}\'\n{"a":1}')), "ok");
});

test("drift: 404 on templated API path, persisted-query errors, missing extract, shape change", () => {
  assert.equal(cls(op(), json(404, { message: "Query not found" })), "drift");
  assert.equal(cls(op(), json(200, { errors: [{ message: "PersistedQueryNotFound" }], data: null })), "drift");
  assert.equal(cls(op(), json(400, { errors: [{ message: "The following features cannot be null: x" }] })), "drift");
  assert.equal(cls(op(), json(200, { data: {} })), "drift");
  const shaped = op({
    response: { format: "json", shape: { a: "object", "a.b": "string", "a.c": "number", "a.d": "array", "a.e": "boolean" } },
  });
  assert.equal(cls(shaped, json(200, { a: { b: "x", c: 1, d: [], e: null } })), "ok");
  assert.equal(cls(shaped, json(200, { z: { y: 1 } })), "drift");
  assert.equal(cls(op(), html(200, "<!doctype html><title>x</title><div>app</div>")), "drift", "HTML where JSON expected");
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
    cls(op(), json(401, { message: "Please wait a few minutes before you try again.", require_login: true, status: "fail" })),
    "auth",
    "Instagram require_login wins over the rate wording",
  );
  assert.equal(cls(op(), html(200, '<html><form><input type="password" name="pass"></form></html>')), "auth");
  assert.equal(cls(op(), { ...json(200, { data: { user: {} } }), url: "https://x.com/i/flow/login?redirect=1" }), "auth");
  assert.equal(cls(op(), json(200, { errors: [{ message: "Bad guest token" }], data: null })), "auth");
});

test("rate: 429 and rate-limit wording on errors", () => {
  assert.equal(cls(op(), json(429, {})), "rate");
  assert.equal(cls(op(), json(420, { message: "Rate limit exceeded" })), "rate");
});

test("blocked: vendor challenge pages even at 200, cf-mitigated, bare 403", () => {
  assert.equal(cls(op(), html(403, "<html><head><title>Just a moment...</title></head><script src=/cdn-cgi/challenge-platform/h/b/cf-chl-x></script></html>")), "blocked");
  assert.equal(cls(op(), html(200, '<html><script src="https://ct.captcha-delivery.com/c.js"></script></html>')), "blocked");
  assert.equal(cls(op(), json(403, { url: "https://geo.captcha-delivery.com/captcha/?initialCid=x" })), "blocked");
  assert.equal(cls(op(), html(200, '<div id="px-captcha"></div>')), "blocked");
  assert.equal(cls(op(), html(200, "<html><title>Reddit - Prove your humanity</title></html>")), "blocked");
  assert.equal(cls(op(), html(403, "<H1>Access Denied</H1> Reference #18.1 https://errors.edgesuite.net/18.1")), "blocked");
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
