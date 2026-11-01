/** What the catalog shows search engines and visitors: site page metadata, wanted pages, public stats, credit. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CSP } from "../src/pages.js";
import { evidence, install, op, registry, report, seed, send, site } from "./helpers.js";

const NET1 = "198.51.100.7";
const NET2 = "192.0.2.44";
const NET3 = "203.0.113.80";
type Env = ReturnType<typeof registry>["env"];

const ask = (env: Env, q: string, ip: string) => send(env, "GET", `/v1/search?q=${encodeURIComponent(q)}`, { ip });

/** A site an install shared, on example.org, promoted by installs on two other networks. */
async function community(env: Env) {
  const host = "www.example.org";
  const operation = op({
    name: "getShelf",
    request: { method: "GET", url: `https://${host}/api/shelf?q=dune`, headers: {} },
    trigger: { url: `https://${host}/shelf?q={q}` },
    match: { host, path: "/api/shelf" },
  });
  const ours = { name: "example-org", domain: "example.org", baseUrl: `https://${host}` };
  const uploader = install();
  const up = await send(env, "POST", "/v1/versions", { as: uploader, body: { site: ours, operation, evidence } });
  assert.equal(up.status, 201, up.text);
  await report(env, install(), up.body.hash, "ok", NET1);
  await report(env, install(), up.body.hash, "ok", NET2);
  return { hash: up.body.hash as string, uploader };
}

/** The JSON-LD blocks of a page, parsed. */
const structured = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].map((m) => JSON.parse(m[1]!));

describe("site pages for search engines", () => {
  const hostile = '</script><script>alert("x")</script>';

  test("title, description, canonical, OpenGraph, Twitter and JSON-LD, all escaped", async () => {
    const { env } = registry();
    await seed(env, {
      site: { ...site, displayName: `Books ${hostile}`, description: `Ratings & "reviews" ${hostile}` },
      operations: [op(), op({ name: "get_book_details", description: "One book" })],
    });
    const r = await send(env, "GET", "/sites/example-com");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-security-policy"), CSP, "the CSP is unchanged");
    assert.match(
      r.text,
      /<title>Books &lt;\/script&gt;.* API for AI agents: get book details, search books \| API Anything<\/title>/,
    );
    assert.match(r.text, /<meta name="description" content="Unofficial Books &lt;\/script&gt;/);
    assert.match(r.text, /<link rel="canonical" href="https:\/\/registry\.test\/sites\/example-com">/);
    assert.match(r.text, /<meta property="og:url" content="https:\/\/registry\.test\/sites\/example-com">/);
    assert.match(r.text, /<meta name="twitter:card" content="summary">/);
    assert.match(r.text, /<meta name="twitter:title" content="Books &lt;/);
    assert.equal(r.text.match(/<script>/g)?.length, 1, "the copy buttons' script is the only one that runs");
    assert.equal(r.text.match(/<\/script>/g)?.length, 2, "no spec string closes a script element");
    const [ld] = structured(r.text);
    const api = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "WebAPI");
    assert.equal(api.name, `Books ${hostile} API (unofficial)`, "the JSON escapes read back as the text");
    assert.equal(api.url, "https://registry.test/sites/example-com");
    assert.equal(api.about.url, "https://example.com");
    assert.ok(ld["@graph"].some((n: { "@type": string }) => n["@type"] === "BreadcrumbList"));
  });

  test("a seeded site says so; a site an install shared carries the badge, on its page and the home list", async () => {
    const { env } = registry();
    await seed(env, { site, operations: [op()] });
    const { uploader } = await community(env);
    const seeded = await send(env, "GET", "/sites/example-com");
    assert.match(seeded.text, /Seeded by the maintainers\./);
    assert.doesNotMatch(seeded.text, /taught by an install/);
    const ours = await send(env, "GET", "/sites/example-org");
    assert.equal(ours.status, 200);
    assert.match(ours.text, /taught by an install<\/span> First shared by an API Anything install/);
    assert.ok(!ours.text.includes(uploader.key), "the uploader's key is never shown");
    const home = await send(env, "GET", "/");
    const row = (name: string) => home.text.split(`href="/sites/${name}"`)[1]!.split("</li>")[0]!;
    assert.match(row("example-org"), /taught by an install/);
    assert.doesNotMatch(row("example-com"), /taught by an install/);
  });
});

describe("wanted pages", () => {
  test("a domain in demand has a page with the commands to teach it, linked from home and the sitemap", async () => {
    const { env } = registry();
    await seed(env, { site, operations: [op()] });
    await ask(env, "https://www.zillow.com/homedetails/1", NET1);
    await ask(env, "zillow.com", NET2);
    await ask(env, "redfin.com", NET3);
    const r = await send(env, "GET", "/wanted/zillow.com");
    assert.equal(r.status, 200, r.text);
    assert.equal(r.headers.get("content-security-policy"), CSP);
    assert.match(r.text, /<title>zillow\.com API for AI agents: asked for on 2 networks, nobody has taught it yet/);
    assert.match(r.text, /<link rel="canonical" href="https:\/\/registry\.test\/wanted\/zillow\.com">/);
    assert.doesNotMatch(r.text, /noindex/);
    assert.match(r.text, /npx -y api-anything setup/);
    assert.match(
      r.text,
      /npx -y api-anything learn &#39;https:\/\/zillow\.com\/search\?q=\{q\}&#39; --args q=&lt;value&gt; --args2 q=&lt;another value&gt; --args3 q=&lt;a third&gt;/,
    );
    assert.match(r.text, /href="\/#wanted"/);
    const one = await send(env, "GET", "/wanted/redfin.com");
    assert.equal(one.status, 200);
    assert.match(one.text, /<meta name="robots" content="noindex">/, "one network is too thin to index");
    const home = await send(env, "GET", "/");
    assert.match(home.text, /<a href="\/wanted\/zillow\.com">zillow\.com<\/a>/);
    assert.match(home.text, /<a href="\/wanted\/redfin\.com">redfin\.com<\/a>/);
    const map = await send(env, "GET", "/sitemap.xml");
    assert.match(map.text, /<loc>https:\/\/registry\.test\/wanted\/zillow\.com<\/loc>/);
    assert.doesNotMatch(map.text, /wanted\/redfin/, "a page marked noindex is not in the sitemap");
  });

  test("no page for a domain nobody asked for, anything but a clean registrable domain, or old demand", async () => {
    const { env, raw } = registry();
    await ask(env, "zillow.com", NET1);
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString();
    const insert = raw.prepare("INSERT INTO demand (domain, network, at) VALUES (?, ?, ?)");
    insert.run("stale.com", "n1", old);
    for (const junk of ["<script>alert(1)</script>.com", "localhost", "a..b.com", "www.zillow.com", "zillow.com:80"])
      insert.run(junk, "n1", new Date().toISOString());
    for (const path of [
      "/wanted/booking.com",
      "/wanted/stale.com",
      "/wanted/www.zillow.com",
      "/wanted/a..b.com",
      "/wanted/localhost",
      "/wanted/ZILLOW.COM",
      "/wanted/zillow.com.",
      "/wanted/1.2.3.4",
      `/wanted/${encodeURIComponent("<script>alert(1)</script>.com")}`,
    ])
      assert.equal((await send(env, "GET", path)).status, 404, path);
    const home = await send(env, "GET", "/");
    assert.doesNotMatch(home.text, /<script>alert|a\.\.b|localhost|zillow\.com:80/, "unclean demand is not listed");
    assert.match(home.text, /href="\/wanted\/zillow\.com"/);
    const map = await send(env, "GET", "/sitemap.xml");
    assert.doesNotMatch(map.text, /wanted\//);
  });

  test("once a site covers the domain, its wanted page moves to the site's page", async () => {
    const { env } = registry();
    await ask(env, "example.org", NET1);
    await ask(env, "example.org", NET2);
    assert.equal((await send(env, "GET", "/wanted/example.org")).status, 200);
    await community(env);
    const r = await send(env, "GET", "/wanted/example.org");
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/sites/example-org");
  });
});

describe("public stats", () => {
  test("aggregate counts only, and the home page shows them", async () => {
    const { env } = registry();
    await seed(env, { site, operations: [op()] });
    const { hash, uploader } = await community(env);
    const failing = install();
    await report(env, failing, hash, "fail", NET3);
    await report(env, install(), hash, "auth", NET3);
    await ask(env, "zillow.com", NET1);
    const r = await send(env, "GET", "/v1/stats");
    assert.equal(r.status, 200, r.text);
    const { generated, ...counts } = r.body;
    assert.ok(Date.parse(generated));
    assert.deepEqual(counts, {
      installs: { last7Days: 5, last30Days: 5 },
      calls: { last7Days: 4, ok: 2, okRate: 0.667 },
      sites: { live: 2, operations: 2 },
      community: { sites: 1, operations: 1, uploadsLast30Days: 1 },
      wanted: 1,
    });
    for (const secret of [uploader.key, failing.key]) assert.ok(!r.text.includes(secret), "no key is served");
    assert.doesNotMatch(r.text, /[0-9a-f]{64}/, "no hash is served");
    const home = await send(env, "GET", "/");
    assert.match(
      home.text,
      /<p class="proof">5 installs active this week · 4 calls this week · 1 site taught by the community<\/p>/,
    );
  });

  test("an empty registry answers zeros, with no ok rate", async () => {
    const { env } = registry();
    const r = await send(env, "GET", "/v1/stats");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.calls, { last7Days: 0, ok: 0 });
    assert.deepEqual(r.body.installs, { last7Days: 0, last30Days: 0 });
  });

  test("the stats and wanted pages are cached at the edge like the other public reads", async () => {
    const { env } = registry();
    await ask(env, "zillow.com", NET1);
    const store = new Map<string, Response>();
    const g = globalThis as { caches?: unknown };
    g.caches = {
      default: {
        match: async (r: Request) => store.get(r.url)?.clone(),
        put: async (r: Request, res: Response) => void store.set(r.url, res),
      },
    };
    try {
      await send(env, "GET", "/v1/stats");
      await send(env, "GET", "/wanted/zillow.com");
      assert.deepEqual([...store.keys()].sort(), [
        "https://registry.test/v1/stats",
        "https://registry.test/wanted/zillow.com",
      ]);
    } finally {
      delete g.caches;
    }
  });
});
