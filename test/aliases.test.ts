/**
 * A site's aliases: the other registrable domains it is known by. They are search keys and nothing else:
 * a lookup by domain or URL finds the site by one, and no op, cookie or session reaches further for it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resolver } from "../src/http.js";
import { learnSite } from "../src/learnsite.js";
import { resolveLoginTarget } from "../src/login.js";
import { createServer } from "../src/mcp.js";
import { pull, search } from "../src/registry.js";
import { versionHashText } from "../src/registry-api.js";
import { indexEntry, matchQuery, relatedDomain } from "../src/search.js";
import { cookieValue } from "../src/session.js";
import { parseSite, type Site } from "../src/spec.js";
import { loadSite } from "../src/store.js";
import { cleanDomain, vetShared } from "../src/vet.js";
import { type FakeRegistry, hashOf, served, startRegistry } from "./fixture/registry.js";

const BUNDLED = new URL("../sites/", import.meta.url);
const bundled = (name: string) => parseSite(JSON.parse(readFileSync(new URL(`${name}.json`, BUNDLED), "utf8")));

const spec = (over: Record<string, unknown> = {}, op: Record<string, unknown> = {}): Site =>
  parseSite({
    name: "suggest",
    baseUrl: "https://v3.suggest-cdn.example.net",
    description: "title search",
    operations: [
      {
        name: "search",
        request: { method: "GET", url: "https://v3.suggest-cdn.example.net/x/dune.json", headers: {} },
        slots: [{ param: "q", at: ["path:1"], template: "{q}.json" }],
        params: [{ name: "q", example: "dune" }],
        trigger: { url: "https://v3.suggest-cdn.example.net/x/{q}.json" },
        match: { host: "v3.suggest-cdn.example.net", path: "/x/*" },
        response: { format: "json", extract: "d" },
        readOnly: true,
        ...op,
      },
    ],
    ...over,
  });

let fake: FakeRegistry;
const realLookup = resolver.lookup;
before(async () => {
  fake = await startRegistry();
  process.env.API_ANYTHING_REGISTRY = fake.url;
  resolver.lookup = async () => [{ address: "93.184.215.14" }];
});
after(() => {
  resolver.lookup = realLookup;
  return fake.close();
});
beforeEach(() => {
  process.env.API_ANYTHING_HOME = mkdtempSync(join(tmpdir(), "aa-aliases-"));
  fake.sites.clear();
  fake.raw.clear();
  fake.matches = [];
  fake.related = [];
  fake.received.length = 0;
});

test("an alias is a bare lowercase registrable domain on a public suffix, as demand records one", () => {
  for (const d of ["imdb.com", "amazon.co.uk", "foo.github.io"]) assert.equal(cleanDomain(d), true, d);
  for (const d of ["www.imdb.com", "IMDb.com", "co.uk", "nas.local", "shop.example", "192.168.7.20"])
    assert.equal(cleanDomain(d), false, d);
  const refused: [string, string[], RegExp][] = [
    ["upper case", ["IMDb.com"], /alias "IMDb\.com" is not/],
    ["a host, not its registrable domain", ["www.example.org"], /alias "www\.example\.org" is not/],
    ["a public suffix alone", ["co.uk"], /alias "co\.uk" is not/],
    ["a name of someone's own network", ["nas.local"], /alias "nas\.local" is not/],
    ["an internal name", ["corp-zeta.internal"], /alias "corp-zeta\.internal" is not/],
    ["an address", ["192.168.7.20"], /alias "192\.168\.7\.20" is not/],
    ["a URL", ["https://example.org"], /alias "https:\/\/example\.org" is not/],
    ["the site's own domain", ["example.net"], /alias "example\.net" is the site's own domain/],
    ["the same one twice", ["example.org", "example.org"], /alias "example\.org" is listed twice/],
    ["more than ten", Array.from({ length: 11 }, (_, i) => `site-${i}.com`), /11 aliases; at most 10/],
  ];
  for (const [why, aliases, re] of refused) assert.match(vetShared(spec({ aliases })).errors.join("\n"), re, why);
  assert.deepEqual(vetShared(spec({ aliases: ["example.org", "example.co.uk"] })).errors, []);
});

test("the bundled imdb spec is known by imdb.com, and the alias left its op's version hash as it was", () => {
  const imdb = bundled("imdb");
  assert.deepEqual(imdb.aliases, ["imdb.com"]);
  assert.deepEqual(vetShared(imdb).errors, []);
  // the hash the registry has served the op under since it was seeded
  assert.equal(hashOf("imdb", imdb.operations[0]!), "4bb5117b097368e4913ff1673786b2a890ecb3b6a93c0d4336249c97a1c5b3d3");
  // a version's hash is over the site's name and the op alone: no site-level field reaches it
  const { aliases: _, ...bare } = imdb;
  for (const op of imdb.operations)
    assert.equal(versionHashText(imdb.name, op), versionHashText(bare.name, parseSite(bare).operations[0]!));
  for (const aliases of [[], ["example.org"], ["imdb.com", "example.org"]]) {
    const s = parseSite({ ...imdb, aliases });
    assert.deepEqual(
      s.operations.map((op) => hashOf(s.name, op)),
      imdb.operations.map((op) => hashOf(imdb.name, op)),
    );
  }
});

test("a lookup by domain or URL matches a site's domain or an alias, the exact domain first", () => {
  const imdb = bundled("imdb");
  const entry = indexEntry(imdb, "");
  assert.deepEqual(entry.domains, ["media-imdb.com"], "an alias is no domain the ops call");
  assert.deepEqual(entry.aliases, ["imdb.com"]);
  for (const q of ["imdb.com", "www.imdb.com", "https://www.imdb.com/title/tt0111161/?ref_=fn_al_tt_1"])
    assert.deepEqual(matchQuery(entry, q), { score: 90, matched: ["imdb.com"], unmatched: [] }, q);
  assert.equal(matchQuery(entry, "media-imdb.com").score, 100);
  assert.equal(matchQuery(entry, "imdb.de").score, 0);
});

test("search finds a bundled site by the domain people know it by, or a full URL of it", async () => {
  for (const q of ["imdb.com", "https://www.imdb.com/title/tt0111161/"]) {
    const r = await search(q);
    assert.equal(r.matches[0]?.site, "imdb", q);
    assert.deepEqual(r.matches[0]?.matched, ["imdb.com"], q);
    assert.equal(r.matches[0]?.domain, "media-imdb.com", "the domain its ops call, as ever");
    assert.deepEqual(r.matches[0]?.aliases, ["imdb.com"]);
  }
  // a site of the user's own on that very domain comes first
  const own = spec(
    { name: "imdb-com", baseUrl: "https://www.imdb.com" },
    {
      request: { method: "GET", url: "https://www.imdb.com/find?q=dune", headers: {} },
      slots: [{ param: "q", at: ["query:q"] }],
      trigger: { url: "https://www.imdb.com/find?q={q}" },
      match: { host: "www.imdb.com", path: "/find" },
    },
  );
  const r = await search("imdb.com", { local: [bundled("imdb"), own] });
  assert.deepEqual(
    r.matches.map((m) => m.site),
    ["imdb-com", "imdb"],
  );
});

test("a registry match found by an alias keeps it, and a pull writes the served aliases into the copy", async () => {
  const site = spec({ aliases: ["example.org"] });
  fake.matches = [
    {
      name: "suggest",
      domain: "example.net",
      aliases: ["example.org"],
      operations: [
        {
          name: "search",
          signature: "search(q)",
          status: "live",
          confirmations: 2,
          params: [{ name: "q", type: "string", required: true }],
        },
      ],
    },
  ];
  const r = await search("https://www.example.org/titles", { local: [] });
  assert.equal(r.matches[0]?.site, "suggest");
  assert.deepEqual(r.matches[0]?.matched, ["example.org"]);
  assert.deepEqual(r.matches[0]?.aliases, ["example.org"]);

  // the registry's own rules hold what it serves; a client still keeps only clean ones
  fake.sites.set("suggest", { ...served(site), aliases: ["example.org", "corp-zeta.internal", "example.net"] });
  await pull("suggest");
  assert.deepEqual(loadSite("suggest")!.site.aliases, ["example.org"]);
});

test("an alias gives an op no new host, no cookie and no session", async () => {
  const imdb = bundled("imdb");
  // an op that calls the alias is still off the spec's own site
  const offsite = spec(
    { aliases: ["example.org"] },
    { request: { method: "GET", url: "https://www.example.org/find?q=dune", headers: {} } },
  );
  assert.match(
    vetShared(offsite).warnings.join("\n"),
    /sends to or opens www\.example\.org, off the spec's own site example\.net/,
  );
  // a cookie of the alias's domain is never one of the site's
  const cookies = [
    { name: "session-id", value: "s1", domain: ".imdb.com", path: "/", expires: -1, httpOnly: false, secure: true },
  ];
  assert.equal(cookieValue(cookies, "session-id", imdb.operations[0]!.request.url), undefined);
  // signing in to the alias's domain is not signing in to the site: its session stays its own domain's
  for (const target of ["imdb.com", "https://www.imdb.com/registration/signin"])
    assert.notEqual(resolveLoginTarget(target).site, "imdb", target);
  // learn_site never saves a page of the alias into the site
  const r = await learnSite({
    site: "imdb",
    trigger: "https://www.imdb.com/find?q={q}",
    args: { q: "dune" },
    args2: { q: "alien" },
    args3: { q: "heat" },
    captures: ["none-1", "none-2"],
  });
  assert.deepEqual([r.ok, r.class], [false, "refused"], JSON.stringify(r));
  assert.match(r.error ?? "", /imdb\.com is only a search alias of imdb/);
});

test("related: another region's site differs only in the public suffix; a private suffix is related to nothing", () => {
  const yes: [string, string][] = [
    ["amazon.in", "amazon.com"],
    ["amazon.com", "amazon.co.uk"],
    ["example.co.uk", "example.com.au"],
  ];
  const no: [string, string][] = [
    ["amazon.com", "amazon.com"],
    ["amazon.in", "amazonaws.com"],
    ["example.co.uk", "sample.com.au"],
    ["shop.example.co", "example.com"],
    ["foo.github.io", "foo.com"],
    ["foo.com", "foo.github.io"],
    ["foo.github.io", "foo.gitlab.io"],
    ["foo.blogspot.com", "foo.com"],
    ["localhost", "localhost.com"],
    ["nas.local", "nas.com"],
    ["www.amazon.in", "amazon.com"],
  ];
  for (const [a, b] of yes) assert.equal(relatedDomain(a, b), true, `${a} ${b}`);
  for (const [a, b] of no) assert.equal(relatedDomain(a, b), false, `${a} ${b}`);
});

test("a search for another region's domain is no match: the related site is a hint, the registry's checked again here", async () => {
  fake.related = [
    { name: "amazon", domain: "amazon.com", displayName: "Amazon" },
    // not related to amazon.in: dropped whatever the registry says
    { name: "amazonaws", domain: "amazonaws.com" },
  ];
  const r = await search("amazon.in", { local: [] });
  assert.deepEqual(r.matches, []);
  assert.deepEqual(r.related, [
    {
      site: "amazon",
      domain: "amazon.com",
      displayName: "Amazon",
      installed: false,
      note: "another region's site: it does not cover amazon.in",
    },
  ]);
  // this machine's sites count too, offline or not
  fake.related = [];
  const local = await search("https://www.amazon.in/s?k=kettle");
  assert.deepEqual(
    local.matches.filter((m) => m.site === "amazon"),
    [],
    "amazon.com's spec is no answer for amazon.in",
  );
  assert.equal(local.related?.[0]?.site, "amazon");
  assert.equal(local.related?.[0]?.installed, true);
});

test("MCP: find_sites and list_sites show a site's aliases, and another region's site only as related, never to call", async () => {
  const client = new Client({ name: "probe", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
  const tool = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args });
    assert.notEqual(r.isError, true, JSON.stringify(r.content));
    return JSON.parse((r.content as { text: string }[])[0]!.text);
  };
  try {
    const found = await tool("find_sites", { query: "https://www.imdb.com/title/tt0111161/" });
    assert.equal(found.matches[0].site, "imdb");
    assert.deepEqual(found.matches[0].aliases, ["imdb.com"]);
    assert.deepEqual(found.nextCall, { tool: "list_operations", args: { site: "imdb" } });
    const listed = await tool("list_sites", {});
    assert.deepEqual(listed.find((s: { name: string }) => s.name === "imdb").aliases, ["imdb.com"]);

    const other = await tool("find_sites", { query: "amazon.in" });
    assert.deepEqual(other.matches, []);
    assert.equal(other.related[0].site, "amazon");
    assert.match(
      other.next,
      /nothing covers the asked domain\. related names another region's site \(amazon\.com, as amazon\)/,
    );
    assert.match(other.next, /not an answer for it\. Tell the user so rather than calling it/);
    assert.doesNotMatch(JSON.stringify(other.nextCall ?? {}), /amazon/);
  } finally {
    await client.close();
  }
});
