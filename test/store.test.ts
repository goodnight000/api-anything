import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  appendHeal, clearStale, lastHealAt, listSites, loadSite, markStale, rememberedTier, rememberTier, saveSite, staleList, staleMark,
} from "../src/store.ts";
import type { Site } from "../src/spec.ts";

const site = (description: string): Site => ({
  name: "demo",
  baseUrl: "https://demo.test",
  description,
  operations: [
    {
      name: "get",
      request: { method: "GET", url: "https://demo.test/a", headers: {} },
      slots: [],
      volatile: [],
      trigger: { url: "https://demo.test/" },
      match: {},
      response: { format: "json" },
      params: [],
      readOnly: true,
      minTier: 1,
      learnedLoggedIn: false,
    },
  ],
});

function fresh() {
  process.env.SITE2API_HOME = mkdtempSync(join(tmpdir(), "s2a-store-"));
  const bundled = mkdtempSync(join(tmpdir(), "s2a-bundled-"));
  return { home: process.env.SITE2API_HOME, bundled };
}

test("resolution: user copy wins over bundled; save writes a user copy", () => {
  const { home, bundled } = fresh();
  writeFileSync(join(bundled, "demo.json"), JSON.stringify({ ...site("bundled"), unknownField: 1 }));
  writeFileSync(join(bundled, "other.json"), JSON.stringify({ ...site("other"), name: "other" }));
  const b = loadSite("demo", bundled)!;
  assert.equal(b.source, "bundled");
  assert.equal(b.site.description, "bundled");
  assert.equal((b.site as Record<string, unknown>).unknownField, undefined, "unknown fields stripped");

  const path = saveSite(site("healed"));
  assert.equal(path, join(home, "sites", "demo.json"));
  assert.equal(statSync(path).mode & 0o777, 0o600);
  const u = loadSite("demo", bundled)!;
  assert.equal(u.source, "user");
  assert.equal(u.site.description, "healed");
  assert.deepEqual(listSites(bundled), ["demo", "other"]);
  assert.equal(loadSite("missing", bundled), undefined);
  assert.throws(() => loadSite("../x", bundled), /invalid site name/);

  mkdirSync(join(home, "sites"), { recursive: true });
  writeFileSync(join(home, "sites", "bad.json"), JSON.stringify({ name: "bad" }));
  assert.throws(() => loadSite("bad", bundled), /bad\.json: invalid site spec/);
});

test("heal log appends JSONL and records the heal time", () => {
  const { home } = fresh();
  appendHeal({ site: "x", op: "getUser", strategy: "rescan", diff: "queryId A -> B" }, 1000);
  appendHeal({ site: "x", op: "getUser", strategy: "recapture", diff: "header added" }, 2000);
  const lines = readFileSync(join(home, "heals.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].strategy, "recapture");
  assert.equal(lastHealAt("x", "getUser"), 2000);
  assert.equal(lastHealAt("x", "other"), undefined);
});

test("stale marks expire after their TTL and carry a reason; tiers are remembered", () => {
  fresh();
  markStale("x", "getUser", "healed twice in 10 min", 30 * 60_000, 0);
  assert.deepEqual(staleMark("x", "getUser", 1000), { until: 30 * 60_000, reason: "healed twice in 10 min" });
  assert.equal(staleMark("x", "getUser", 30 * 60_000), undefined);
  assert.deepEqual(staleList(1000), [{ site: "x", op: "getUser", until: 30 * 60_000, reason: "healed twice in 10 min" }]);
  clearStale("x", "getUser");
  assert.equal(staleMark("x", "getUser", 1000), undefined);

  assert.equal(rememberedTier("x", "getUser"), undefined);
  rememberTier("x", "getUser", 2);
  assert.equal(rememberedTier("x", "getUser"), 2);
});

test("secret scan: exact live values are secrets; heuristics only warn, and URL paths do not trip them", async () => {
  const { scanSecrets } = await import("../src/store.ts");
  const session = { cookies: [{ name: "sid", value: '"abc123secret"', domain: "x.test", path: "/", expires: -1, httpOnly: true, secure: true }], values: { authorization: "Bearer zzzzzzzz" } };
  const spec = { url: "https://x.test/api/graphql/SfvBzVjFV1WLibrBOSdD6w/UserByScreenNameAndMore/extra/segments", h: { a: "abc123secret", b: "eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl" } };
  const r = scanSecrets(spec, session);
  assert.deepEqual(r.secrets, ["$.h.a holds the live cookie sid"]);
  assert.deepEqual(r.warnings, ["$.h.b looks like a JWT; check it is public"]);
});
