/**
 * Aliases in the registry: a maintainer's claim that searches for a domain should get a site. Only a seed or
 * the admin route sets one, never an upload; it is a search key, never a host an op may call.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN, evidence, install, op, registry, seed, send, site } from "./helpers.js";

type Env = ReturnType<typeof registry>["env"];
const search = (env: Env, q: string, ip = "198.51.100.7") =>
  send(env, "GET", `/v1/search?q=${encodeURIComponent(q)}`, { ip });
const setAliases = (env: Env, name: string, aliases: unknown, token = ADMIN) =>
  send(env, "POST", `/v1/admin/sites/${name}/aliases`, {
    body: { aliases },
    headers: { authorization: `Bearer ${token}` },
  });

const suggest = op({
  name: "search",
  request: { method: "GET", url: "https://v3.sg.media-imdb.com/suggestion/x/dune.json", headers: {} },
  slots: [{ param: "q", at: ["path:2"], template: "{q}.json" }],
  trigger: { url: "https://v3.sg.media-imdb.com/suggestion/x/{q}.json" },
  match: { host: "v3.sg.media-imdb.com", path: "/suggestion/x/*" },
});
const imdb = { name: "imdb", domain: "media-imdb.com", baseUrl: "https://v3.sg.media-imdb.com", displayName: "IMDb" };
const seedImdb = (env: Env, aliases: string[] = ["imdb.com"]) =>
  seed(env, { site: { ...imdb, aliases }, operations: [suggest] });

const findOp = (host: string, path: string) =>
  op({
    request: { method: "GET", url: `https://${host}${path}?q=dune`, headers: {} },
    trigger: { url: `https://${host}${path}?q={q}` },
    match: { host, path },
  });
const names = (r: { body: { matches: { name: string }[] } }) => r.body.matches.map((m) => m.name);

test("a seeded alias finds the site by that domain or a URL on it, below a site on the domain itself", async () => {
  const { env } = registry();
  assert.equal((await seedImdb(env)).status, 200);
  for (const q of ["imdb.com", "https://www.imdb.com/title/tt0111161/"]) {
    const r = await search(env, q);
    assert.deepEqual(names(r), ["imdb"], q);
    assert.deepEqual(r.body.matches[0].matched, ["imdb.com"]);
    assert.equal(r.body.matches[0].domain, "media-imdb.com");
    assert.deepEqual(r.body.matches[0].aliases, ["imdb.com"]);
  }
  const served = await send(env, "GET", "/v1/sites/imdb");
  assert.deepEqual(served.body.aliases, ["imdb.com"], "a pull carries them");
  const index = await send(env, "GET", "/v1/index");
  assert.deepEqual(index.body.sites[0].aliases, ["imdb.com"]);
  assert.deepEqual(index.body.sites[0].domains, ["media-imdb.com"]);

  // a site on imdb.com itself, as confirmed: the exact domain ranks first
  const own = { name: "imdb-com", domain: "imdb.com", baseUrl: "https://www.imdb.com" };
  assert.equal((await seed(env, { site: own, operations: [findOp("www.imdb.com", "/find")] })).status, 200);
  assert.deepEqual(names(await search(env, "imdb.com")), ["imdb-com", "imdb"]);
  // an alias the site already held stays through a reseed
  assert.equal((await seedImdb(env)).status, 200);
  assert.deepEqual((await send(env, "GET", "/v1/sites/imdb")).body.aliases, ["imdb.com"]);
});

test("a domain an alias covers is no demand: not recorded, not listed, not counted, and its wanted page is the site's", async () => {
  const { env, raw } = registry();
  await seedImdb(env);
  for (const ip of ["198.51.100.7", "192.0.2.44"]) await search(env, "https://www.imdb.com/find?q=dune", ip);
  assert.equal((raw.prepare("SELECT COUNT(*) AS n FROM demand").get() as { n: number }).n, 0);
  // rows from before the alias was set
  const insert = raw.prepare("INSERT INTO demand (domain, network, at) VALUES (?, ?, ?)");
  for (const domain of ["imdb.com", "zillow.com"])
    for (const network of ["n1", "n2"]) insert.run(domain, network, new Date().toISOString());
  const demand = await send(env, "GET", "/v1/demand");
  assert.deepEqual(
    demand.body.demand.map((d: { domain: string }) => d.domain),
    ["zillow.com"],
  );
  assert.equal((await send(env, "GET", "/v1/stats")).body.wanted, 1);
  assert.doesNotMatch((await send(env, "GET", "/")).text, /imdb\.com/);
  const page = await send(env, "GET", "/wanted/imdb.com");
  assert.equal(page.status, 301);
  assert.equal(page.headers.get("location"), "/sites/imdb");
  assert.equal((await send(env, "GET", "/wanted/zillow.com")).status, 200);
});

test("an upload never sets or changes an alias: a stranger cannot make a site answer for google.com", async () => {
  const { env } = registry();
  const stranger = install();
  const up = await send(env, "POST", "/v1/versions", {
    as: stranger,
    body: { site: { ...site, aliases: ["google.com"] }, operation: op(), evidence },
  });
  assert.equal(up.status, 201, up.text);
  assert.deepEqual((await search(env, "google.com")).body.matches, []);
  assert.equal((await send(env, "GET", "/v1/sites/example-com", { as: stranger })).body.aliases, undefined);

  // nor on a seeded site that has some
  await seedImdb(env);
  const again = await send(env, "POST", "/v1/versions", {
    as: stranger,
    body: { site: { ...imdb, aliases: ["google.com", "imdb.de"] }, operation: { ...suggest, name: "other" }, evidence },
  });
  assert.equal(again.status, 201, again.text);
  assert.deepEqual((await send(env, "GET", "/v1/sites/imdb")).body.aliases, ["imdb.com"]);
  assert.deepEqual((await search(env, "google.com")).body.matches, []);
});

test("the admin route sets a site's aliases behind the maintainer's token, and refuses bad ones and collisions", async () => {
  const { env } = registry();
  await seed(env, { site: { ...site, name: "books" }, operations: [op()] });
  assert.equal((await setAliases(env, "books", ["example.org"], "wrong")).status, 403);
  assert.equal((await setAliases(env, "nobody", ["example.org"])).status, 404);
  const set = await setAliases(env, "books", ["example.org", "example.co.uk"]);
  assert.equal(set.status, 200, set.text);
  assert.deepEqual(set.body, { site: "books", aliases: ["example.co.uk", "example.org"] });
  assert.deepEqual(names(await search(env, "example.co.uk")), ["books"]);

  for (const [bad, re] of [
    [["www.example.org"], /alias "www\.example\.org" is not/],
    [["corp-zeta.internal"], /alias "corp-zeta\.internal" is not/],
    [["example.com"], /alias "example\.com" is the site's own domain/],
    ["example.org", /the body is \{ aliases/],
  ] as const) {
    const r = await setAliases(env, "books", bad);
    assert.equal(r.status, bad === "example.org" ? 400 : 422, r.text);
    assert.match(`${r.body.error}\n${(r.body.reasons ?? []).join("\n")}`, re);
  }

  // another site's alias, and another served site's own domain
  await seedImdb(env);
  const taken = await setAliases(env, "books", ["imdb.com"]);
  assert.equal(taken.status, 422);
  assert.match(taken.body.reasons.join("\n"), /imdb\.com is already an alias of imdb/);
  const domain = await setAliases(env, "imdb", ["example.com"]);
  assert.equal(domain.status, 422);
  assert.match(domain.body.reasons.join("\n"), /example\.com is the domain of the served site books/);
  assert.deepEqual((await send(env, "GET", "/v1/sites/books")).body.aliases, ["example.co.uk", "example.org"]);

  // an empty list clears them
  assert.equal((await setAliases(env, "books", [])).status, 200);
  assert.deepEqual((await search(env, "example.org")).body.matches, []);
});

test("a seed sets its aliases, and refuses one another site holds or that is another served site's domain", async () => {
  const { env } = registry();
  await seedImdb(env);
  // the same site again keeps its own
  assert.equal((await seedImdb(env)).status, 200);
  const other = { name: "films", domain: "example.com", baseUrl: "https://www.example.com" };
  const taken = await seed(env, { site: { ...other, aliases: ["imdb.com"] }, operations: [op()] });
  assert.equal(taken.status, 422);
  assert.match(taken.body.reasons.join("\n"), /imdb\.com is already an alias of imdb/);
  assert.equal((await send(env, "GET", "/v1/sites/films")).status, 404, "a refused seed stores nothing");
  await seed(env, { site: other, operations: [op()] });
  const domain = await seed(env, { site: { ...imdb, aliases: ["imdb.com", "example.com"] }, operations: [suggest] });
  assert.equal(domain.status, 422);
  assert.match(domain.body.reasons.join("\n"), /example\.com is the domain of the served site films/);
  // a reseed without them leaves the site with none
  assert.equal((await seed(env, { site: imdb, operations: [suggest] })).status, 200);
  assert.equal((await send(env, "GET", "/v1/sites/imdb")).body.aliases, undefined);
});

test("an alias is no host an op may call: an upload sending to it is off its site", async () => {
  const { env } = registry();
  await seedImdb(env);
  const up = await send(env, "POST", "/v1/versions", {
    as: install(),
    body: { site: imdb, operation: findOp("www.imdb.com", "/find"), evidence },
  });
  assert.equal(up.status, 201, up.text);
  assert.equal(up.body.status, "review");
  assert.match(up.body.reasons.join("\n"), /sends to or opens www\.imdb\.com, off its site media-imdb\.com/);
});

test("related: another region's confirmed site is named beside no match, and the asked domain stays demand", async () => {
  const { env, raw } = registry();
  const amazon = { name: "amazon", domain: "amazon.com", baseUrl: "https://www.amazon.com", displayName: "Amazon" };
  await seed(env, { site: amazon, operations: [findOp("www.amazon.com", "/s")] });
  const r = await search(env, "https://www.amazon.in/s?k=kettle");
  assert.deepEqual(r.body.matches, []);
  assert.deepEqual(r.body.related, [
    {
      name: "amazon",
      domain: "amazon.com",
      displayName: "Amazon",
      note: "another region's site: it does not cover amazon.in",
    },
  ]);
  assert.deepEqual(
    raw
      .prepare("SELECT domain FROM demand")
      .all()
      .map((d) => (d as { domain: string }).domain),
    ["amazon.in"],
  );
  // a match leaves no room for a hint
  assert.equal((await search(env, "amazon.com")).body.related, undefined);

  // the label before the public suffix, by the Public Suffix List
  await seed(env, {
    site: { name: "shop-au", domain: "example.com.au", baseUrl: "https://www.example.com.au" },
    operations: [findOp("www.example.com.au", "/find")],
  });
  assert.deepEqual(
    (await search(env, "example.co.uk")).body.related.map((x: { name: string }) => x.name),
    ["shop-au"],
  );
  assert.equal((await search(env, "sample.co.uk")).body.related, undefined);
  // a site on a private suffix is related to nothing, either way
  await seed(env, {
    site: { name: "pages", domain: "foo.github.io", baseUrl: "https://foo.github.io" },
    operations: [findOp("foo.github.io", "/find")],
  });
  assert.equal((await search(env, "foo.com")).body.related, undefined);
  assert.equal((await search(env, "amazon.github.io")).body.related, undefined);
  // a site nobody confirmed says nothing about another domain
  const up = await send(env, "POST", "/v1/versions", {
    as: install(),
    body: {
      site: { name: "zillow-com", domain: "zillow.com", baseUrl: "https://www.zillow.com" },
      operation: findOp("www.zillow.com", "/find"),
      evidence,
    },
  });
  assert.equal(up.status, 201, up.text);
  assert.equal((await search(env, "zillow.de")).body.related, undefined);
});
