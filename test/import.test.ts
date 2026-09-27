/**
 * Cookie import from a synthetic encrypted Chromium DB, a Firefox DB, and file exports. No real
 * browser, no Keychain: API_ANYTHING_BROWSER_ROOTS injects roots and the Safe Storage password.
 */
import assert from "node:assert/strict";
import { mkdtempSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cookiesFromFile, importFromBrowsers, type BrowserRoot } from "../src/import.ts";
import { makeChromiumDb, makeFirefoxDb } from "./fixture/cookie-db.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "aa-import-"));
const inject = (roots: BrowserRoot[]) => (process.env.API_ANYTHING_BROWSER_ROOTS = JSON.stringify(roots));
const li = { host_key: ".linkedin.com", name: "li_at", value: "AQEDreallylongtokenvalue" };
const js = { host_key: ".linkedin.com", name: "JSESSIONID", value: '"ajax:1234567890"' };

test("decrypts a v10 Chromium cookie (meta version >= 24 strips the host_key hash)", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [li, js], { password: "s3cret-keychain-pw", metaVersion: 24 });
  inject([{ name: "Chrome", family: "chromium", root, password: "s3cret-keychain-pw" }]);

  const r = importFromBrowsers({ url: "https://www.linkedin.com", loginCookies: ["li_at", "JSESSIONID"] });
  assert.ok(r);
  assert.equal(r.source, "chrome:Default");
  const byName = Object.fromEntries(r.cookies.map((c) => [c.name, c.value]));
  assert.equal(byName.li_at, "AQEDreallylongtokenvalue");
  assert.equal(byName.JSESSIONID, '"ajax:1234567890"', "quotes preserved for the csrf transform");
});

test("meta version < 24 does not strip a prefix", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [{ host_key: ".x.com", name: "auth_token", value: "0123456789abcdef" }], { password: "pw", metaVersion: 18 });
  inject([{ name: "Chrome", family: "chromium", root, password: "pw" }]);
  const r = importFromBrowsers({ url: "https://x.com" });
  assert.equal(r?.cookies.find((c) => c.name === "auth_token")?.value, "0123456789abcdef");
});

test("chooses the profile that has all loginCookies, not merely the most recent one", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [{ host_key: ".linkedin.com", name: "bcookie", value: "somebrowseridxxxx" }], { password: "pw" });
  makeChromiumDb(join(root, "Profile 2"), [li, js], { password: "pw" });
  // Make Default the most recently used, so only the loginCookies rule picks Profile 2.
  utimesSync(join(root, "Default", "Network", "Cookies"), new Date(), new Date());
  utimesSync(join(root, "Profile 2", "Network", "Cookies"), new Date(Date.now() - 100000), new Date(Date.now() - 100000));
  inject([{ name: "Chrome", family: "chromium", root, password: "pw" }]);

  const r = importFromBrowsers({ url: "https://www.linkedin.com", loginCookies: ["li_at", "JSESSIONID"] });
  assert.equal(r?.source, "chrome:Profile 2");
});

test("unknown site: most recently used profile with cookies for the site wins", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [{ host_key: ".reddit.com", name: "reddit_session", value: "oldsessionvalue1" }], { password: "pw" });
  makeChromiumDb(join(root, "Profile 1"), [{ host_key: ".reddit.com", name: "reddit_session", value: "newsessionvalue2" }], { password: "pw" });
  utimesSync(join(root, "Default", "Network", "Cookies"), new Date(Date.now() - 100000), new Date(Date.now() - 100000));
  utimesSync(join(root, "Profile 1", "Network", "Cookies"), new Date(), new Date());
  inject([{ name: "Chrome", family: "chromium", root, password: "pw" }]);

  const r = importFromBrowsers({ url: "https://reddit.com" });
  assert.equal(r?.source, "chrome:Profile 1");
  assert.equal(r?.cookies[0]!.value, "newsessionvalue2");
});

test("--profile pin overrides selection; a missing pin throws", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [li, js], { password: "pw" });
  makeChromiumDb(join(root, "Profile 2"), [{ host_key: ".linkedin.com", name: "li_at", value: "differentprofilexx" }], { password: "pw" });
  inject([{ name: "Chrome", family: "chromium", root, password: "pw" }]);

  assert.equal(importFromBrowsers({ url: "https://linkedin.com", pin: { profile: "Profile 2" } })?.cookies[0]!.value, "differentprofilexx");
  assert.throws(() => importFromBrowsers({ url: "https://linkedin.com", pin: { browser: "chrome", profile: "Nope" } }), /no browser profile/);
});

test("only the site's own cookies are read", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [li, { host_key: ".evil.com", name: "li_at", value: "shouldnotappearxx" }], { password: "pw" });
  inject([{ name: "Chrome", family: "chromium", root, password: "pw" }]);
  const r = importFromBrowsers({ url: "https://linkedin.com" });
  assert.deepEqual(r?.cookies.map((c) => c.domain), [".linkedin.com"]);
});

test("a wrong Safe Storage password skips cookies rather than failing", () => {
  const root = tmp();
  makeChromiumDb(join(root, "Default"), [li], { password: "the-real-pw" });
  inject([{ name: "Chrome", family: "chromium", root, password: "the-wrong-pw" }]);
  // decryption yields garbage or throws per-cookie; the import returns undefined (nothing usable).
  const r = importFromBrowsers({ url: "https://linkedin.com" });
  assert.ok(!r || r.cookies.every((c) => c.value !== "AQEDreallylongtokenvalue"));
});

test("Firefox plaintext moz_cookies", () => {
  const root = tmp();
  makeFirefoxDb(join(root, "abc.default-release"), [{ host_key: "www.linkedin.com", name: "li_at", value: "firefoxtokenvalue", expires_utc: 2000000000 }]);
  inject([{ name: "Firefox", family: "firefox", root }]);
  const r = importFromBrowsers({ url: "https://linkedin.com" });
  assert.equal(r?.source, "firefox:abc.default-release");
  assert.equal(r?.cookies[0]!.value, "firefoxtokenvalue");
  assert.equal(r?.cookies[0]!.expires, 2000000000);
});

test("cookiesFromFile parses Netscape and JSON exports", () => {
  const netscape = [
    "# Netscape HTTP Cookie File",
    "#HttpOnly_.linkedin.com\tTRUE\t/\tTRUE\t2000000000\tli_at\tAQEDtoken",
    "www.linkedin.com\tFALSE\t/\tFALSE\t0\tlang\ten",
  ].join("\n");
  const parsed = cookiesFromFile(netscape, "https://linkedin.com");
  const liAt = parsed.find((c) => c.name === "li_at")!;
  assert.deepEqual([liAt.value, liAt.path, liAt.secure, liAt.httpOnly, liAt.expires], ["AQEDtoken", "/", true, true, 2000000000]);
  assert.equal(parsed.find((c) => c.name === "lang")!.secure, false);

  const json = JSON.stringify([{ name: "li_at", value: "AQEDjson", domain: ".linkedin.com", path: "/", secure: true, httpOnly: true, expirationDate: 1999999999.5 }]);
  const fromJson = cookiesFromFile(json, "https://linkedin.com");
  assert.deepEqual(fromJson[0], { name: "li_at", value: "AQEDjson", domain: ".linkedin.com", path: "/", expires: 1999999999, httpOnly: true, secure: true, sameSite: undefined });
});
