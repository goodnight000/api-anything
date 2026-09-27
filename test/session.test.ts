import assert from "node:assert/strict";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cookieHeaderFor, cookieValue, home, loadSession, loggedIn, mergeCapture, parseCookieHeader, safeName } from "../src/session.ts";
import type { StoredCookie } from "../src/types.ts";

const c = (name: string, value: string, domain: string, extra: Partial<StoredCookie> = {}): StoredCookie => ({
  name, value, domain, path: "/", expires: -1, httpOnly: false, secure: false, ...extra,
});

test("RFC 6265 domain, path, secure and expiry matching", () => {
  const now = 1_800_000_000_000;
  const jar = [
    c("auth_token", "AAA", ".x.com", { secure: true }),
    c("host_only", "B", "x.com"),
    c("scoped", "C", ".x.com", { path: "/i/api" }),
    c("expired", "D", ".x.com", { expires: now / 1000 - 1 }),
    c("future", "E", ".x.com", { expires: now / 1000 + 60 }),
    c("other", "F", ".example.com"),
  ];
  assert.equal(cookieHeaderFor(jar, "https://x.com/i/api/graphql", now), "scoped=C; auth_token=AAA; host_only=B; future=E");
  assert.equal(cookieHeaderFor(jar, "https://api.x.com/1.1/x.json", now), "auth_token=AAA; future=E", "host-only cookie not sent to a subdomain");
  assert.equal(cookieHeaderFor(jar, "http://x.com/i/apiary", now), "host_only=B; future=E", "no secure cookie over http, /i/api does not match /i/apiary");
  assert.equal(cookieHeaderFor(jar, "https://notx.com/", now), "");
  assert.equal(cookieHeaderFor([c("s", "1", "localhost", { secure: true })], "http://localhost:8080/"), "s=1");
});

test("cookieValue prefers a cookie that would be sent to the URL", () => {
  const jar = [c("ct0", "wrong", ".other.com"), c("ct0", "right", ".x.com")];
  assert.equal(cookieValue(jar, "ct0", "https://x.com/i/api"), "right");
  assert.equal(cookieValue(jar, "ct0"), "wrong");
  assert.equal(cookieValue(jar, "nope"), undefined);
});

test("parseCookieHeader keeps quotes for transforms", () => {
  assert.deepEqual(parseCookieHeader('li_at=abc; JSESSIONID="ajax:123"; bad'), { li_at: "abc", JSESSIONID: '"ajax:123"' });
});

test("loggedIn heuristic and explicit loginCookies", () => {
  const guest = [c("guest_id", "v1%3A17000000", ".x.com"), c("gt", "1840000000000000000", ".x.com"), c("__cf_bm", "xxxxxxxxxxxx", ".x.com")];
  assert.equal(loggedIn(guest), false);
  assert.equal(loggedIn([...guest, c("auth_token", "0123456789abcdef", ".x.com")]), true);
  assert.equal(loggedIn([c("sessionid", "1234567890%3Aabc", ".instagram.com")]), true);
  assert.equal(loggedIn([c("li_at", "AQEDAxxxxxxxx", ".linkedin.com")], ["li_at", "JSESSIONID"]), false);
  assert.equal(loggedIn([c("auth_token", "0123456789abcdef", ".x.com", { expires: 1 })]), false, "expired does not count");
});

test("session store: SITE2API_HOME override, 0700 dirs, 0600 files, merge by name/domain/path", () => {
  process.env.SITE2API_HOME = mkdtempSync(join(tmpdir(), "s2a-"));
  assert.equal(home(), process.env.SITE2API_HOME);
  assert.deepEqual(loadSession("x"), { cookies: [], values: {}, updatedAt: undefined });
  mergeCapture("x", [c("ct0", "one", ".x.com"), c("old", "gone", ".x.com", { expires: 1 })], { authorization: "Bearer A" });
  const s = mergeCapture("x", [c("ct0", "two", ".x.com")], { "x-guest-token": "123" });
  assert.deepEqual(s.cookies.map((k) => k.value), ["two"]);
  assert.deepEqual(s.values, { authorization: "Bearer A", "x-guest-token": "123" });
  assert.deepEqual(loadSession("x").cookies.map((k) => k.value), ["two"]);
  const file = join(home(), "sessions", "x.json");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(join(home(), "sessions")).mode & 0o777, 0o700);
  assert.throws(() => loadSession("../etc"), /invalid site name/);
  assert.throws(() => safeName("a/b"));
});

test("cookieValue never hands a cookie to another site, nor a Secure one over http", () => {
  const bank = [c("sid", "SECURE-ONLY-SESSION", ".bank.test", { secure: true, httpOnly: true })];
  assert.equal(cookieValue(bank, "sid", "http://evil.test/"), undefined);
  assert.equal(cookieValue(bank, "sid", "http://www.bank.test/"), undefined, "Secure cookie over http");
  const host = [c("csrftoken", "tok123456", "www.site.test")];
  assert.equal(cookieValue(host, "csrftoken", "https://api.site.test/v1"), "tok123456", "same site: page JS echoes it to its API host");
});
