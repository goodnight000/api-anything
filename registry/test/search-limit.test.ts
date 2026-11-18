/** GET /v1/search, unauthenticated, is limited per subscriber by a Workers Rate Limiting binding, before any D1 read. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { D1Database } from "../src/store.js";
import type { Env, RateLimiter } from "../src/worker.js";
import { registry, send } from "./helpers.js";

/** A stand-in binding: records each key it is asked about, and answers `allow`. */
function limiter(allow = true): RateLimiter & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    limit: async ({ key }) => {
      keys.push(key);
      return { success: allow };
    },
  };
}

const search = (env: Env, ip: string, q = "book ratings") =>
  send(env, "GET", `/v1/search?q=${encodeURIComponent(q)}`, { ip });

test("a search the limiter refuses is a 429 with Retry-After, and touches no D1", async () => {
  const { env } = registry();
  const untouched: D1Database = {
    prepare: () => assert.fail("a refused search read D1"),
    batch: async () => assert.fail("a refused search wrote D1"),
  };
  const r = await search({ ...env, DB: untouched, SEARCH_LIMITER: limiter(false) }, "198.51.100.7");
  assert.equal(r.status, 429, r.text);
  assert.equal(r.headers.get("retry-after"), "60");
  assert.match(r.body.error, /too many searches/);
  // a demand search is refused the same way, before demand is recorded
  const d = await search({ ...env, DB: untouched, SEARCH_LIMITER: limiter(false) }, "198.51.100.7", "zillow.com");
  assert.equal(d.status, 429, d.text);
});

test("Retry-After is the binding's period in registry/wrangler.jsonc", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const line = config.split("\n").find((l) => l.includes('"SEARCH_LIMITER"'));
  assert.match(line ?? "", /"period": 60\b/);
});

test("a search the limiter allows is answered; with no binding, search is unlimited", async () => {
  const { env } = registry();
  const allow = limiter();
  assert.equal((await search({ ...env, SEARCH_LIMITER: allow }, "198.51.100.7")).status, 200);
  assert.equal(allow.keys.length, 1);
  for (let i = 0; i < 200; i++) assert.equal((await search(env, "198.51.100.7", `q${i}`)).status, 200);
});

test("the limit's key is an IPv6 /48 or a whole IPv4 address, salted and hashed", async () => {
  const { env } = registry();
  const keyOf = async (ip: string) => {
    const l = limiter();
    await search({ ...env, SEARCH_LIMITER: l }, ip);
    return l.keys[0]!;
  };
  const a = await keyOf("2001:db8:abcd:1::1");
  assert.equal(await keyOf("2001:db8:abcd:ffff:1:2:3:4"), a, "one /48 is one subscriber");
  assert.equal(await keyOf("2001:0db8:abcd::9"), a, "however it is written");
  assert.notEqual(await keyOf("2001:db8:abce::1"), a, "another /48");
  const v4 = await keyOf("203.0.113.9");
  assert.equal(await keyOf("203.0.113.9"), v4);
  assert.equal(await keyOf("::ffff:203.0.113.9"), v4, "a v4-mapped address is the v4 address");
  assert.notEqual(await keyOf("203.0.113.10"), v4, "IPv4 is per address, not per /24");
  assert.match(v4, /^[0-9a-f]{32}$/, "a hash, never the address");
  const other = registry({ SALT: "another-salt" }).env;
  const l = limiter();
  await search({ ...other, SEARCH_LIMITER: l }, "203.0.113.9");
  assert.notEqual(l.keys[0], v4, "salted");
});

test("at the edge, a search the cache answers is never counted", async () => {
  const { env } = registry();
  const l = limiter();
  const store = new Map<string, Response>();
  const g = globalThis as { caches?: unknown };
  g.caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  };
  try {
    for (let i = 0; i < 3; i++) assert.equal((await search({ ...env, SEARCH_LIMITER: l }, "198.51.100.7")).status, 200);
    assert.equal(l.keys.length, 1);
  } finally {
    delete g.caches;
  }
});
