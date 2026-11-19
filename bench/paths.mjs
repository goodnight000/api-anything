// Outcomes on paths where a call or a learn can fail, or wait, when it need not. Localhost only, no
// accounts. Each scenario asserts nothing about which revision is right: it records what happened.
// node --import tsx bench/paths.mjs [--repo /path/to/baseline] [--trials 3] [--no-browser]
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    repo: { type: "string", default: "." },
    trials: { type: "string", default: "3" },
    revision: { type: "string" },
    "no-browser": { type: "boolean", default: false },
  },
});
const repo = resolve(values.repo);
const trials = Number(values.trials);
const state = mkdtempSync(join(tmpdir(), "aa-paths-"));
process.env.API_ANYTHING_HOME = state;
// a passphrase seals the same way on every machine, whatever key store it has or lacks
process.env.API_ANYTHING_KEY ??= "bench-paths-passphrase";
const load = (name) => import(pathToFileURL(join(repo, `src/${name}.ts`)).href);
const [{ parseSite }, { call }, { saveSite }, { saveSession }, { callReads }, { browserAvailable, closeBrowser }] =
  await Promise.all([load("spec"), load("execute"), load("store"), load("session"), load("batch"), load("browser")]);
const browser = !values["no-browser"] && browserAvailable();

/** A localhost server answering by `route(req, url)`, counting requests by path. */
async function serve(route) {
  const hits = [];
  const server = createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    hits.push(`${req.method} ${u.pathname}`);
    route(req, res, u);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, hits, close: () => new Promise((ok) => server.close(ok)) };
}
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const scenarios = [];
async function scenario(name, run, n = trials) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const out = await run(i);
    runs.push({ ms: Math.round(performance.now() - t0), ...out });
  }
  scenarios.push({ name, medianMs: median(runs.map((r) => r.ms)), runs });
}

// 1. A bare 403 for the caller's id, and a 429 for the stored example: the site is throttling this client.
await scenario("bare-403-then-429-on-example", async (i) => {
  const s = await serve((_req, res, u) => {
    if (u.pathname === "/page") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<!doctype html><title>p</title>");
    }
    if (u.searchParams.get("id") === "example") return json(res, 429, { message: "slow" }, { "retry-after": "120" });
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
  });
  const site = `rate${i}`;
  saveSite(
    parseSite({
      name: site,
      baseUrl: s.url,
      operations: [
        {
          name: "item",
          readOnly: true,
          trigger: { url: `${s.url}/page?id={id}` },
          request: { method: "GET", url: `${s.url}/api?id=example`, headers: {} },
          params: [{ name: "id", example: "example" }],
          slots: [{ param: "id", at: ["query:id"] }],
        },
      ],
    }),
  );
  const r = await call(site, "item", { id: "secret" }, { minIntervalMs: 0, maxTier: browser ? 3 : 1 });
  await s.close();
  return { class: r.class, tier: r.tier, siteRequests: s.hits.length, retryAfterMs: r.retryAfterMs };
});

// 2. A read whose path holds an arg, called with an arg that spells "login": the site answers 200 JSON.
await scenario("arg-spells-login-path", async (i) => {
  const s = await serve((_req, res, u) => json(res, 200, { article: { slug: u.pathname.split("/").pop() } }));
  const site = `slug${i}`;
  saveSite(
    parseSite({
      name: site,
      baseUrl: s.url,
      operations: [
        {
          name: "article",
          readOnly: true,
          trigger: { url: `${s.url}/a/{slug}` },
          request: { method: "GET", url: `${s.url}/api/articles/hello`, headers: {} },
          params: [{ name: "slug", example: "hello" }],
          slots: [{ param: "slug", at: ["path:2"] }],
          response: { extract: "article" },
        },
      ],
    }),
  );
  const r = await call(site, "article", { slug: "login" }, { minIntervalMs: 0, maxTier: 1 });
  await s.close();
  return { class: r.class, ok: r.ok, siteRequests: s.hits.length };
});

// 3. A GraphQL read refused with a machine code and prose that names no cause.
await scenario("graphql-unauthenticated-code", async (i) => {
  const s = await serve((_req, res) =>
    json(res, 200, { data: null, errors: [{ message: "Access denied", extensions: { code: "UNAUTHENTICATED" } }] }),
  );
  const site = `gql${i}`;
  saveSite(
    parseSite({
      name: site,
      baseUrl: s.url,
      operations: [
        {
          name: "me",
          readOnly: true,
          trigger: { url: `${s.url}/` },
          request: { method: "GET", url: `${s.url}/graphql?q=me`, headers: {} },
          response: { extract: "data.me" },
        },
      ],
    }),
  );
  const r = await call(site, "me", {}, { minIntervalMs: 0, maxTier: 1 });
  await s.close();
  return { class: r.class };
});

// 4. A derived lookup that rotates the session cookie, as a rolling session does; the old value is dead.
await scenario("lookup-rotates-session-cookie", async (i) => {
  const s = await serve((req, res, u) => {
    const sid = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    if (u.pathname === "/resolve")
      return json(res, 200, { id: 42 }, { "set-cookie": "sid=fresh0123456789abcd; Path=/" });
    if (sid !== "fresh0123456789abcd") return json(res, 401, { message: "session expired" });
    json(res, 200, { item: { id: 42, name: "mug" } });
  });
  const site = `rot${i}`;
  saveSite(
    parseSite({
      name: site,
      baseUrl: s.url,
      operations: [
        {
          name: "item",
          readOnly: true,
          trigger: { url: `${s.url}/p/{slug}` },
          request: { method: "GET", url: `${s.url}/items/7`, headers: {} },
          params: [{ name: "slug", example: "mug" }],
          slots: [
            {
              at: ["path:1"],
              path: "id",
              from: {
                request: { method: "GET", url: `${s.url}/resolve?slug=mug`, headers: {} },
                slots: [{ param: "slug", at: ["query:slug"] }],
              },
            },
          ],
          response: { extract: "item" },
        },
      ],
    }),
  );
  const cookie = { domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false };
  saveSession(site, { cookies: [{ ...cookie, name: "sid", value: "stale0123456789abcd" }], values: {} });
  const r = await call(site, "item", { slug: "mug" }, { minIntervalMs: 0, maxTier: 1 });
  await s.close();
  return { class: r.class, ok: r.ok, siteRequests: s.hits.length };
});

// 5. A batch of five reads that wants one field of each: what the agent reads back.
await scenario("batch-five-reads-one-field", async (i) => {
  const s = await serve((_req, res, u) =>
    json(res, 200, {
      user: {
        name: u.searchParams.get("name"),
        bio: "x".repeat(400),
        links: Array.from({ length: 10 }, (_, k) => `https://example.com/${k}`),
      },
    }),
  );
  const site = `batch${i}`;
  saveSite(
    parseSite({
      name: site,
      baseUrl: s.url,
      operations: [
        {
          name: "user",
          readOnly: true,
          trigger: { url: `${s.url}/u/{name}` },
          request: { method: "GET", url: `${s.url}/api?name=alice`, headers: {} },
          params: [{ name: "name", example: "alice" }],
          slots: [{ param: "name", at: ["query:name"] }],
          response: { extract: "user" },
        },
      ],
    }),
  );
  const items = ["a", "b", "c", "d", "e"].map((name) => ({
    site,
    op: "user",
    args: { name },
    view: { fields: ["name"] },
  }));
  const results = [];
  for await (const r of callReads(items, { maxTier: 1 })) results.push(r);
  await s.close();
  return {
    ok: results.every((r) => r.ok),
    classes: results.map((r) => r.class),
    dataChars: results.reduce((n, r) => n + (r.data === undefined ? 0 : JSON.stringify(r.data).length), 0),
  };
});

// 6. learn_site on a page that serves a bot challenge that never solves (the repo's own fixture).
if (browser) {
  const { startFixture } = await import(pathToFileURL(join(repo, "test/fixture/server.ts")).href);
  const { learnSite } = await load("learnsite");
  const fx = await startFixture();
  await scenario("learn-site-bot-challenge", async (i) => {
    const r = await learnSite(
      {
        site: `walled${i}`,
        op: "walled",
        trigger: `${fx.url}/challenged?q={q}`,
        args: { q: "alice" },
        args2: { q: "bobby" },
        args3: { q: "carol" },
      },
      { minIntervalMs: 0 },
    );
    return {
      ok: r.ok,
      nextCall: r.nextCall?.action,
      // one capture per browser run of the page
      captures: r.captures?.length ?? 0,
    };
  });
  await fx.close();
}
await closeBrowser();

const sourceHash = createHash("sha256");
for (const file of readdirSync(join(repo, "src"))
  .filter((n) => n.endsWith(".ts"))
  .sort())
  sourceHash.update(file).update(readFileSync(join(repo, "src", file)));
console.log(
  JSON.stringify(
    {
      repo,
      revision: values.revision,
      node: process.version,
      browser,
      sourceSha256: sourceHash.digest("hex"),
      scenarios,
    },
    null,
    2,
  ),
);
rmSync(state, { recursive: true, force: true });
