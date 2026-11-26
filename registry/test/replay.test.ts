/**
 * The registry's own clean replay of versions held for review only because their uploader's client ran
 * none, and the upload funnel `GET /v1/stats` shows. Upstream is a local server standing in for every
 * https site: the Worker's fetch is pointed at it, so nothing leaves localhost.
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, test } from "node:test";
import { REVIEW_CATEGORIES } from "../../src/review.js";
import worker from "../src/worker.js";
import { evidence, install, op, registry, send, site } from "./helpers.js";

const DAY = 86_400_000;
const MINUTE_CRON = "* * * * *";

let seen: { host: string; path: string; cookie?: string }[] = [];
let handle: (req: IncomingMessage, res: ServerResponse) => void;
let origin = "";
/** the site's host, as the Worker asked for it, by the path the stand-in saw */
let hostOf = new Map<string, string>();
const server = createServer((req, res) => {
  seen.push({ host: hostOf.get(req.url ?? "") ?? "", path: req.url ?? "", cookie: req.headers.cookie });
  handle(req, res);
});
const realFetch = globalThis.fetch;

before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.protocol !== "https:") throw new Error(`the test reached for ${url.origin}`);
    hostOf.set(`${url.pathname}${url.search}`, url.hostname);
    return realFetch(`${origin}${url.pathname}${url.search}`, init);
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  server.close();
});
beforeEach(() => {
  seen = [];
  hostOf = new Map();
  handle = (_req, res) =>
    res.writeHead(200, { "content-type": "application/json" }).end('[{"title":"Dune","avgRating":4.3}]');
});

type Env = ReturnType<typeof registry>["env"];
type Raw = ReturnType<typeof registry>["raw"];

const skipped = { ...evidence, cleanReplay: "skipped" as const };

/** A version uploaded with no clean replay: held for review for that reason alone. */
async function held(env: Env, over: { operation?: Record<string, unknown>; site?: Record<string, unknown> } = {}) {
  const r = await send(env, "POST", "/v1/versions", {
    as: install(),
    body: { site: over.site ?? site, operation: over.operation ?? op(), evidence: skipped },
  });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.body.status, "review");
  return r.body as { hash: string; reasons: string[] };
}

const row = (raw: Raw, hash: string) =>
  raw.prepare("SELECT status, reasons, evidence, replays, replayed_at FROM versions WHERE hash = ?").get(hash) as {
    status: string;
    reasons: string | null;
    evidence: string;
    replays: number;
    replayed_at: string | null;
  };

const tick = (env: Env, at = Date.now()) => worker.scheduled({ scheduledTime: at, cron: MINUTE_CRON }, env);

/** A site on its own domain, `n`, with the helpers' read on it. */
const other = (n: number) => {
  const host = `www.example${n}.org`;
  return {
    site: { name: `example${n}-org`, domain: `example${n}.org`, baseUrl: `https://${host}` },
    operation: op({
      request: { method: "GET", url: `https://${host}/api/search?q=dune`, headers: {} },
      trigger: { url: `https://${host}/search?q={q}` },
      match: { host, path: "/api/search" },
    }),
  };
};

describe("the registry's replay of a skipped clean replay", () => {
  test("an ok answer the recipe extracts from makes it a candidate, with the replay on record and no report", async () => {
    const { env, raw } = registry({ TRY_ENABLED: "true" });
    const { hash, reasons } = await held(env);
    assert.deepEqual(reasons, ["its clean replay was skipped, not ok"]);
    const at = Date.now();
    await tick(env, at);
    assert.deepEqual(seen, [{ host: "www.example.com", path: "/api/search?q=dune", cookie: undefined }]);
    const v = row(raw, hash);
    assert.equal(v.status, "candidate");
    assert.equal(v.reasons, null, "the reason is gone");
    const e = JSON.parse(v.evidence);
    assert.equal(e.cleanReplay, "skipped", "what the uploader sent stays as sent");
    assert.deepEqual(e.registryReplay, { at: new Date(at).toISOString(), outcome: "ok" });
    assert.equal((raw.prepare("SELECT COUNT(*) AS n FROM reports").get() as { n: number }).n, 0, "no report");
    // served to others now, as an unconfirmed candidate; nothing promotes it to live
    const served = await send(env, "GET", "/v1/sites/example-com");
    assert.equal(served.status, 200, served.text);
    assert.equal(served.body.operations[0].status, "candidate");
    await tick(env, at + 2 * DAY);
    assert.equal(seen.length, 1, "a candidate is not replayed again");
  });

  test("anything else leaves it in review: tried at most 3 times, at least a day apart, then never again", async () => {
    const { env, raw } = registry({ TRY_ENABLED: "true" });
    handle = (_req, res) => res.writeHead(500, { "content-type": "text/plain" }).end("down");
    const { hash } = await held(env);
    const t0 = Date.now();
    await tick(env, t0);
    assert.deepEqual([row(raw, hash).status, row(raw, hash).replays], ["review", 1]);
    assert.ok(row(raw, hash).reasons, "its reason stays");
    await tick(env, t0 + 60_000);
    await tick(env, t0 + DAY - 60_000);
    assert.equal(seen.length, 1, "not again within the day");
    await tick(env, t0 + DAY);
    await tick(env, t0 + 2 * DAY);
    assert.equal(row(raw, hash).replays, 3);
    await tick(env, t0 + 3 * DAY);
    await tick(env, t0 + 30 * DAY);
    assert.equal(seen.length, 3, "never a fourth time");
    assert.equal(row(raw, hash).status, "review");
  });

  test("an ok with nothing to extract, a redirect off its origin, or a site that never answers is no ok", async () => {
    const { env, raw } = registry({ TRY_ENABLED: "true", TRY_TIMEOUT_MS: "300" });
    const cases: [string, (req: IncomingMessage, res: ServerResponse) => void][] = [
      ["empty", (_q, res) => res.writeHead(200, { "content-type": "application/json" }).end("[]")],
      ["redirect", (_q, res) => res.writeHead(302, { location: "https://cdn.example.com/api/search?q=dune" }).end()],
      ["slow", () => {}],
    ];
    for (const [what, h] of cases) {
      handle = h;
      seen = [];
      const { hash } = await held(env, { operation: op({ name: `search_${what}` }) });
      const t = Date.now();
      await tick(env, t);
      assert.equal(seen.length, 1, `${what}: one request, the redirect not followed`);
      assert.deepEqual([row(raw, hash).status, row(raw, hash).replays], ["review", 1], what);
      assert.ok(Date.now() - t < 5000, `${what}: the tick did not wait on the site`);
      raw.prepare("UPDATE versions SET replays = 3 WHERE hash = ?").run(hash);
    }
  });

  test("a version with a second reason, with no example for a required param, or that is no plain GET is left untouched", async () => {
    const { env, raw } = registry({ TRY_ENABLED: "true" });
    const bare = await held(env, {
      operation: op({ name: "bare", params: [{ name: "q", type: "string", required: true }] }),
    });
    assert.deepEqual(bare.reasons, ["its clean replay was skipped, not ok"]);
    const browser = await held(env, { operation: op({ name: "browser", minTier: 3 }) });
    assert.deepEqual(browser.reasons, ["its clean replay was skipped, not ok"]);
    // last: an op learned signed in makes the site one with a login, which holds every new op after it
    const signedIn = await held(env, { operation: op({ name: "mine", learnedLoggedIn: true }) });
    assert.equal(signedIn.reasons.length, 2);
    await tick(env);
    await tick(env, Date.now() + DAY);
    assert.deepEqual(seen, []);
    for (const v of [signedIn, bare, browser]) {
      const r = row(raw, v.hash);
      assert.equal(r.status, "review");
      assert.deepEqual(JSON.parse(r.reasons!), v.reasons, "its reasons as they were");
      assert.equal(r.replays, 0, "no attempt counted");
    }
  });

  test("an upload cannot claim the registry replayed it", async () => {
    const { env, raw } = registry();
    const r = await send(env, "POST", "/v1/versions", {
      as: install(),
      body: {
        site,
        operation: op(),
        evidence: { ...skipped, registryReplay: { at: "2026-01-01T00:00:00.000Z", outcome: "ok" } },
      },
    });
    assert.equal(r.body.status, "review");
    assert.equal(JSON.parse(row(raw, r.body.hash).evidence).registryReplay, undefined);
  });

  test("off unless TRY_ENABLED is true", async () => {
    for (const vars of [{}, { TRY_ENABLED: "false" }, { TRY_ENABLED: "yes please" }] as Record<string, string>[]) {
      const { env, raw } = registry(vars);
      const { hash } = await held(env);
      await tick(env);
      assert.deepEqual(seen, [], JSON.stringify(vars));
      assert.deepEqual([row(raw, hash).status, row(raw, hash).replays], ["review", 0]);
    }
  });

  test("a handful a tick, one per site, inside the catalog's daily sends", async () => {
    const { env, raw } = registry({ TRY_ENABLED: "true", REPLAY_PER_TICK: "2" });
    const hashes = [];
    for (const n of [1, 2, 3]) hashes.push((await held(env, other(n))).hash);
    const sameSite = await held(env, { ...other(1), operation: { ...other(1).operation, name: "again" } });
    await tick(env);
    assert.equal(seen.length, 2, "two a tick");
    assert.equal(new Set(seen.map((s) => s.host)).size, 2, "never two to one site in a tick");
    await tick(env);
    await tick(env);
    assert.equal(seen.length, 4);
    assert.ok([...hashes, sameSite.hash].every((h) => row(raw, h).status === "candidate"));

    // the day's sends are spent: nothing goes, and nothing is counted
    const spent = registry({ TRY_ENABLED: "true", TRY_PER_DAY_ALL: "1" });
    const a = await held(spent.env, other(4));
    const b = await held(spent.env, other(5));
    seen = [];
    await tick(spent.env);
    await tick(spent.env);
    assert.equal(seen.length, 1);
    const left = [a, b].map((v) => row(spent.raw, v.hash)).find((r) => r.status === "review")!;
    assert.equal(left.replays, 0, "a replay the budget held back is no attempt");
  });
});

describe("the upload funnel in GET /v1/stats", () => {
  test("counts by status and review reasons by category, never a stored reason", async () => {
    const { env, raw } = registry();
    await send(env, "POST", "/v1/versions", { as: install(), body: { site, operation: op(), evidence } });
    await held(env, { operation: op({ name: "skippedOne" }) });
    const secretHost = "private-host.example.com";
    await send(env, "POST", "/v1/versions", {
      as: install(),
      body: {
        site: { ...site, loginCookies: ["sessionSecretCookie"] },
        operation: op({
          name: "readMyInbox",
          learnedLoggedIn: true,
          request: { method: "GET", url: `https://${secretHost}/api/inbox?q=dune`, headers: {} },
          match: { host: secretHost, path: "/api/inbox" },
        }),
        evidence: { ...evidence, cleanReplay: "failed" },
      },
    });
    const r = await send(env, "GET", "/v1/stats");
    assert.equal(r.status, 200, r.text);
    const u = r.body.uploads;
    assert.equal(u.last30Days, 3);
    assert.equal(u.byStatus.candidate, 1);
    assert.equal(u.byStatus.review, 2);
    assert.equal(u.byStatus.live, 0);
    assert.deepEqual(
      Object.keys(u.reviewReasons).sort(),
      [...REVIEW_CATEGORIES].sort(),
      "the fixed set, zeros included",
    );
    assert.equal(u.reviewReasons["clean-replay-skipped"], 1);
    assert.equal(u.reviewReasons["clean-replay-failed"], 1);
    assert.equal(u.reviewReasons["signed-in"], 1);
    assert.equal(u.reviewReasons["login-site"], 1);
    for (const v of Object.values(u.reviewReasons)) assert.equal(typeof v, "number");
    const stored = (
      raw.prepare("SELECT reasons FROM versions WHERE reasons IS NOT NULL").all() as { reasons: string }[]
    ).flatMap((x) => JSON.parse(x.reasons) as string[]);
    assert.ok(stored.length >= 4);
    for (const reason of stored) assert.ok(!r.text.includes(reason), `served a stored reason: ${reason}`);
    for (const word of [secretHost, "sessionSecretCookie", "readMyInbox", "skippedOne"])
      assert.ok(!r.text.includes(word), `served ${word}`);
  });
});
