/**
 * Sharing specs: the shared rules (and that every bundled spec passes them, the CI gate), pull from a
 * registry on localhost, and publish through a stand-in for the GitHub CLI.
 */
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { verifySite } from "../src/checks.js";
import { call, heal } from "../src/execute.js";
import { healOperation } from "../src/heal.js";
import { plan, submit, writeOutbox } from "../src/publish.js";
import { pull } from "../src/registry.js";
import { loadSession, mergeCapture, saveSession } from "../src/session.js";
import { parseSite, type Site } from "../src/spec.js";
import { loadSite, registryDir, saveSite, userSitesDir } from "../src/store.js";
import { LIMITS, vetShared } from "../src/vet.js";

const BUNDLED = new URL("../sites/", import.meta.url);

const spec = (over: Record<string, unknown> = {}, op: Record<string, unknown> = {}): Site =>
  parseSite({
    name: "demo",
    baseUrl: "https://news.example.com",
    description: "front page and search",
    operations: [
      {
        name: "search",
        request: { method: "GET", url: "https://news.example.com/api/search?q=kittens", headers: {} },
        slots: [{ param: "q", at: ["query:q"] }],
        params: [{ name: "q" }],
        trigger: { url: "https://news.example.com/search?q={q}" },
        match: { host: "news.example.com", path: "/api/search" },
        response: { format: "json", extract: "hits" },
        readOnly: true,
        ...op,
      },
    ],
    ...over,
  });
const errors = (s: Site, notes?: string) => vetShared(s, notes).errors;

test("every bundled spec passes the shared rules: CI runs this on every pull request to sites/", () => {
  for (const f of readdirSync(BUNDLED).filter((f) => f.endsWith(".json"))) {
    const md = new URL(f.replace(/\.json$/, ".md"), BUNDLED);
    const text = readFileSync(new URL(f, BUNDLED), "utf8");
    assert.ok(Buffer.byteLength(text) <= LIMITS.file, `${f} is over the ${LIMITS.file} bytes pull takes`);
    assert.deepEqual(errors(parseSite(JSON.parse(text)), existsSync(md) ? readFileSync(md, "utf8") : undefined), [], f);
  }
});

test("the shared rules refuse what a hostile or careless spec could do with someone's sessions", () => {
  assert.deepEqual(errors(spec()), []);
  const refused: [string, Site, RegExp][] = [
    ["http", spec({}, { trigger: { url: "http://news.example.com/s" } }), /trigger .* is not https/],
    ["an IP", spec({}, { request: { method: "GET", url: "https://10.0.0.2/api", headers: {} } }), /no public host/],
    ["an intranet host", spec({ baseUrl: "https://jira.corp.internal" }), /baseUrl has no public host/],
    [
      "localhost goto",
      spec(
        {},
        { trigger: { url: "https://news.example.com/", steps: [{ action: "goto", value: "https://localhost/x" }] } },
      ),
      /goto .* no public host/,
    ],
    [
      "a literal bearer",
      spec(
        {},
        {
          request: {
            method: "GET",
            url: "https://news.example.com/api",
            headers: { authorization: "Bearer Zx9Qw8vLm7Kj6HgF5dS4aP3oI2uY1tRe" },
          },
        },
      ),
      /literal credential/,
    ],
    [
      "a DELETE read",
      spec({}, { request: { method: "DELETE", url: "https://news.example.com/api", headers: {} } }),
      /DELETE request cannot be a read/,
    ],
    [
      "a mutation read",
      spec(
        {},
        {
          request: {
            method: "POST",
            url: "https://news.example.com/graphql",
            headers: {},
            body: '{"query":"mutation Del { deleteAccount }"}',
          },
        },
      ),
      /GraphQL mutation cannot be a read/,
    ],
    [
      "a mutation behind a newline and a comment",
      spec(
        {},
        {
          request: {
            method: "POST",
            url: "https://news.example.com/graphql",
            headers: {},
            body: JSON.stringify({ query: "# list\nmutation Del { deleteAccount }" }),
          },
        },
      ),
      /GraphQL mutation cannot be a read/,
    ],
    [
      "a document a param fills",
      spec(
        {},
        {
          request: { method: "POST", url: "https://news.example.com/graphql", headers: {}, body: '{"query":"{ a }"}' },
          slots: [{ param: "q", at: ["body", "json:/query"] }],
        },
      ),
      /a read whose GraphQL document a param fills/,
    ],
    [
      "a whole body a param is",
      spec(
        {},
        {
          request: { method: "POST", url: "https://news.example.com/api", headers: {}, body: "{}" },
          slots: [{ param: "q", at: ["body", "json:"] }],
        },
      ),
      /a read whose whole body a param is/,
    ],
    [
      "a mutation behind an escaped block-string quote",
      spec(
        {},
        {
          request: {
            method: "POST",
            url: "https://news.example.com/graphql",
            headers: {},
            body: JSON.stringify({ query: 'query Q { a(s: """x \\""" { """) } mutation M { del }' }),
          },
        },
      ),
      /GraphQL mutation cannot be a read/,
    ],
    [
      "a raw application/graphql mutation",
      spec(
        {},
        {
          request: {
            method: "POST",
            url: "https://news.example.com/gql",
            headers: { "content-type": "application/graphql" },
            body: "mutation { del }",
          },
        },
      ),
      /GraphQL mutation cannot be a read/,
    ],
    [
      "an arg spliced into the document through a ref slot's template",
      spec(
        {},
        {
          request: { method: "POST", url: "https://news.example.com/graphql", headers: {}, body: '{"query":"{ a }"}' },
          slots: [{ ref: "cookie:sid", at: ["body", "json:/query"], template: "{q}" }],
        },
      ),
      /a read whose GraphQL document a param fills/,
    ],
    ["a match of anything", spec({}, { match: { method: "POST" } }), /match names no host, path or operationName/],
    ["a command in a name", spec({}, { name: "search; rm -rf ~ #" }), /operation name .* is not a letter/],
    ["a catastrophic regex", spec({}, { params: [{ name: "q", pattern: "^(a+)+$" }] }), /nests a quantifier/],
    ["a long description", spec({}, { description: "x".repeat(501) }), /description is 501 characters/],
  ];
  for (const [what, s, re] of refused) assert.match(errors(s).join("\n"), re, what);
  assert.match(errors(spec(), "n".repeat(9000)).join(), /notes are 9000 bytes/);
  const field = spec(
    {},
    {
      request: {
        method: "POST",
        url: "https://news.example.com/graphql",
        headers: {},
        body: '{"query":"query Q { mutation(s: \\"mutation\\") }"}',
      },
    },
  );
  assert.deepEqual(errors(field), [], "a field or a string named mutation is no mutation");
  const named = spec(
    {},
    {
      request: {
        method: "POST",
        url: "https://news.example.com/graphql",
        headers: {},
        body: '{"query":"query mutation { viewer { name } }"}',
      },
    },
  );
  assert.deepEqual(errors(named), [], "a query named mutation is a query");
  // what a human reviews rather than a rule refuses
  const warned = vetShared(
    spec(
      {},
      {
        request: { method: "POST", url: "https://api.algolia.net/q", headers: {}, body: "{}" },
        match: { host: "api.algolia.net" },
      },
    ),
  ).warnings;
  assert.match(warned.join("\n"), /off the spec's own site example\.com/);
  assert.match(warned.join("\n"), /a read sent as POST/);
});

test("a provider key one account owns is refused in a shared spec and in its notes; a Google web key is a warning", () => {
  // assembled at run time, so no key-shaped literal sits in this file for a secret scanner to find
  const body = "A1b2C3d4E5f6G7h8J9k0".repeat(3);
  const keys: [string, string][] = [
    ["a GitHub token", `ghp_${body.slice(0, 36)}`],
    ["a GitHub token", `gho_${body.slice(0, 36)}`],
    ["a GitHub token", `github_pat_${body.slice(0, 22)}_${body}`],
    ["an OpenAI or Anthropic key", `sk-${body}`],
    ["an OpenAI or Anthropic key", `sk-proj-${body}`],
    ["an OpenAI or Anthropic key", `sk-ant-api03-${body}`],
    ["an AWS access key", `AKIA${"Q7X2M9K4R1T8W3Z6"}`],
    ["an AWS access key", `ASIA${"Q7X2M9K4R1T8W3Z6"}`],
    ["a Slack token", `xoxb-${"1234567890"}-${body}`],
    ["a Slack token", `xoxp-${"1234567890"}-${body}`],
    ["a private key", `-----BEGIN RSA ${"PRIVATE"} KEY-----\nMIIEpAIBAAKCAQEA${body}`],
    ["a private key", `-----BEGIN OPENSSH ${"PRIVATE"} KEY-----`],
  ];
  const headed = (value: string, op: Record<string, unknown> = {}) =>
    spec(
      {},
      {
        request: { method: "GET", url: "https://news.example.com/api/search?q=kittens", headers: { "x-k": value } },
        ...op,
      },
    );
  for (const [what, key] of keys) {
    const e = errors(headed(key)).join("\n");
    assert.match(e, new RegExp(`headers\\.x-k holds ${what}`), key);
    assert.ok(!e.includes(key), "the error does not repeat the key");
    // `public` waives a shared bearer's warning, never this: no provider issues one of these to every user
    assert.match(errors(headed(key, { public: ["x-k"] })).join("\n"), new RegExp(`x-k holds ${what}`), key);
    assert.match(errors(spec(), `## Calling\nset ${key} first\n`).join("\n"), new RegExp(`notes hold ${what}`), key);
    const url = `https://news.example.com/api/search?q=kittens&k=${encodeURIComponent(key)}`;
    assert.match(
      errors(headed("x", { request: { method: "GET", url, headers: {} } })).join("\n"),
      new RegExp(what),
      `${key} in a URL`,
    );
  }
  // words and ids that share a prefix are not keys
  for (const text of [
    "sk-hynix-ddr5-memory-kit-black-edition-2024",
    "task-A1b2C3d4E5f6G7h8J9k0A1b2",
    "ghp_settings_page",
    "AKIA12345",
    "MY_AKIAQ7X2M9K4R1T8W3Z6Q7",
    "xoxb-",
    "-----BEGIN PUBLIC KEY-----",
  ])
    assert.deepEqual(errors(headed(text)), [], text);
  const google = `AIza${"SyA1b2C3d4E5f6G7h8J9k0A1b2C3d4E5f6G"}`;
  assert.deepEqual(errors(headed(google)), []);
  assert.match(vetShared(headed(google)).warnings.join("\n"), /x-k holds a Google API key/);
  assert.match(vetShared(spec(), `key: ${google}`).warnings.join("\n"), /notes hold a Google API key/);
  // the export scan's shape heuristics read the notes too
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJl"].join(".");
  assert.match(vetShared(spec(), `token ${jwt}`).warnings.join("\n"), /notes look like a JWT/);
});

/* --------------------------------------------------------------- pull */

let server: Server;
const served = new Map<string, { status?: number; body: string; headers?: Record<string, string> }>();
before(async () => {
  server = createServer((req, res) => {
    const f = served.get(req.url ?? "");
    res.writeHead(f?.status ?? (f ? 200 : 404), f?.headers ?? {});
    res.end(f?.body ?? "");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.API_ANYTHING_REGISTRY = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  process.env.API_ANYTHING_HOME = mkdtempSync(join(tmpdir(), "aa-registry-"));
  served.clear();
});
const share = (s: Site, notes?: string) => {
  served.set(`/sites/${s.name}.json`, { body: JSON.stringify(s) });
  if (notes !== undefined) served.set(`/sites/${s.name}.md`, { body: notes });
};
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

test("pull: someone's spec lands in the registry copy, marked as theirs, and calls like any other", async () => {
  share(spec(), "Search is stories only.\n");
  const r = await pull("demo");
  assert.deepEqual(r.operations, [{ op: "search(q)", method: "GET", hosts: ["news.example.com"] }]);
  assert.deepEqual(r.warnings, [], "pull's own record of the spec's hash is no warning");
  assert.equal(r.shadowedBy, undefined);
  const loaded = loadSite("demo")!;
  assert.equal(loaded.source, "registry");
  assert.equal(loaded.site.shared?.sha256, r.sha256);
  assert.equal(readFileSync(join(registryDir(), "demo.md"), "utf8"), "Search is stories only.\n");
  const sent: string[] = [];
  const res = await call(
    "demo",
    "search",
    { q: "cats" },
    {
      maxTier: 1,
      minIntervalMs: 0,
      fetchImpl: async (u) => {
        sent.push(String(u));
        return json({ hits: [{ title: "cats" }] });
      },
    },
  );
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.deepEqual(sent, ["https://news.example.com/api/search?q=cats"]);
});

test("a registry file pull did not write (no record of its pull) is refused, not trusted", async () => {
  share(spec());
  await pull("demo");
  writeFileSync(join(registryDir(), "demo.json"), JSON.stringify(spec()));
  assert.throws(() => loadSite("demo"), /a pulled spec without its record/);
});

test("a spec someone else wrote never gets a session value from before the binding; the user's own still does", async () => {
  const unbound = (site: string) => {
    const s = loadSession(site);
    saveSession(site, { ...s, values: { ...s.values, "search/legacy": "old-value" } });
  };
  const run = (site: string) =>
    call(site, "search", { q: "cats" }, { maxTier: 1, minIntervalMs: 0, fetchImpl: async () => json({ hits: [] }) });
  share(spec());
  await pull("demo");
  unbound("demo");
  await run("demo");
  assert.equal(loadSession("demo").values["search/legacy"], undefined);
  // a forced heal too, whose validation sends the template
  unbound("demo");
  await heal(
    "demo",
    "search",
    { q: "cats" },
    { maxTier: 1, minIntervalMs: 0, fetchImpl: async () => json({ hits: [] }) },
  );
  assert.equal(loadSession("demo").values["search/legacy"], undefined);
  saveSite({ ...spec(), name: "mine" });
  unbound("mine");
  await run("mine");
  assert.equal(loadSession("mine").values["search/legacy"], "old-value");
});

test("pull refuses what it cannot trust, and writes nothing then", async () => {
  await assert.rejects(pull("demo"), /no shared spec for "demo"/);
  share(spec({}, { request: { method: "DELETE", url: "https://news.example.com/api", headers: {} } }));
  await assert.rejects(pull("demo"), /fails the shared rules: search: a DELETE request cannot be a read/);
  served.set("/sites/demo.json", { body: JSON.stringify({ ...spec(), name: "other" }) });
  await assert.rejects(pull("demo"), /is the spec of "other", not "demo"/);
  served.set("/sites/demo.json", { body: "x".repeat(300 * 1024) });
  await assert.rejects(pull("demo"), /is over 262144 bytes/);
  // a redirect could move the fetch anywhere
  served.set("/sites/demo.json", { status: 302, body: "", headers: { location: "https://evil.example.net/x.json" } });
  await assert.rejects(pull("demo"));
  await assert.rejects(pull("../demo"), /invalid site name/);
  assert.equal(existsSync(join(registryDir(), "demo.json")), false);
});

test("pull: one name is one session, so a spec for another site under a name in use is refused", async () => {
  saveSite(
    spec(
      { baseUrl: "https://www.othersite.com" },
      {
        request: { method: "GET", url: "https://www.othersite.com/api", headers: {} },
        trigger: { url: "https://www.othersite.com/" },
        match: { path: "/api" },
      },
    ),
  );
  share(spec());
  await assert.rejects(pull("demo"), /a local spec "demo" is for https:\/\/www\.othersite\.com/);
});

test("pull drops session values from before their binding; bound ones stay", async () => {
  mergeCapture("demo", [], { from: "https://news.example.com/api", values: { "search/x-key": "bound-value" } });
  const s = loadSession("demo");
  saveSession("demo", { ...s, values: { ...s.values, legacy: "unbound-value" } });
  share(spec());
  await pull("demo");
  assert.deepEqual(loadSession("demo").values, { "search/x-key": "bound-value" });
});

test("pull again names what changed; the user's own copy wins and is reported", async () => {
  share(spec());
  await pull("demo");
  share(spec({}, { description: "now with a description" }));
  assert.deepEqual((await pull("demo")).changed, { added: [], changed: ["search"], removed: [] });
  saveSite({ ...spec(), shared: undefined });
  assert.equal((await pull("demo")).shadowedBy, join(userSitesDir(), "demo.json"));
});

// an op whose request carries a token a rescan looks for in the trigger page, near its anchor
const tokened = spec(
  {},
  {
    request: { method: "GET", url: `https://news.example.com/api/search?q=kittens&t=${"a1".repeat(16)}`, headers: {} },
    volatile: [{ at: ["query:t"], shape: { charset: "hex", length: 32 }, anchor: "apiToken" }],
  },
);

test("a heal's user copy of a pulled spec is still someone else's: checked on load, healed by recapture only", async () => {
  share(tokened);
  await pull("demo");
  const pulled = loadSite("demo")!.site;
  // a heal writes a user copy that keeps the mark; tightened rules still apply to it
  saveSite({ ...pulled, operations: [{ ...pulled.operations[0]!, trigger: { url: "http://news.example.com/" } }] });
  assert.throws(() => loadSite("demo"), /fails the shared rules/);
  saveSite(pulled);
  // a rescan would send a token found in the site's pages to the URL the spec chose: not for a shared spec
  let fetched = 0;
  const healOp = (site: string) =>
    healOperation(
      site,
      loadSite(site)!.site.operations[0]!,
      { q: "cats" },
      {
        browser: false,
        validate: async () => ({ tier: 1, class: "drift", reason: "x" }),
        fetchImpl: async () => {
          fetched++;
          return new Response("<html></html>", { headers: { "content-type": "text/html" } });
        },
      },
    );
  await healOp("demo");
  assert.equal(fetched, 0, "a shared spec's heal fetched a page to rescan");
  saveSite({ ...tokened, name: "own" });
  await healOp("own");
  assert.ok(fetched > 0, "the user's own spec rescans as before");
});

/* ------------------------------------------------------------ publish */

const BEARER = "Bearer Zx9Qw8vLm7Kj6HgF5dS4aP3oI2uY1tRe";

test("publish refuses a live value even under a name the op lists as public", () => {
  saveSite(
    spec(
      {},
      {
        request: {
          method: "GET",
          url: "https://news.example.com/api/search?q=kittens",
          headers: { authorization: BEARER },
        },
        public: ["authorization"],
      },
    ),
  );
  mergeCapture("demo", [], { from: "https://news.example.com/api", values: { "search/authorization": BEARER } });
  assert.match(plan("demo").errors.join("\n"), /holds the live session value search\/authorization/);
});

test("publish refuses a live value wherever it sits in the outgoing bytes, a key included, and an oversized file", () => {
  saveSite(spec({}, { response: { format: "html", html: { items: "li", fields: { [BEARER]: "a" } } } }));
  mergeCapture("demo", [], { from: "https://news.example.com/api", values: { "search/authorization": BEARER } });
  assert.match(plan("demo").errors.join("\n"), /sites\/demo\.json holds the live session value search\/authorization/);
  saveSite(spec({}, { description: "d", params: [{ name: "q", description: "x".repeat(400) }] }));
  const many = Array.from({ length: 50 }, (_, i) => ({
    ...spec().operations[0]!,
    name: `op${i}`,
    request: { ...spec().operations[0]!.request, headers: { "x-pad": "p".repeat(6000) } },
  }));
  saveSite({ ...spec(), operations: many });
  assert.match(plan("demo").errors.join("\n"), /sites\/demo\.json is \d+ bytes; at most 262144/);
});

test("publish previews what may be the publisher's own, and strips their history", () => {
  saveSite(
    spec(
      {},
      {
        request: { method: "GET", url: "https://news.example.com/api/users/4815162/search?q=kittens", headers: {} },
        trigger: {
          url: "https://news.example.com/search?q={q}",
          steps: [{ action: "fill", selector: "#email", value: "me@mail.example.com" }],
        },
        learnedAt: "2026-10-01T00:00:00Z",
      },
    ),
  );
  writeFileSync(join(userSitesDir(), "demo.md"), "Ask jo@example.org about 123e4567-e89b-12d3-a456-426614174000.\n");
  const p = plan("demo");
  assert.deepEqual(p.errors, []);
  const personal = p.personal.join("\n");
  assert.match(personal, /holds an email address \(me@mail\.example\.com\)/);
  assert.match(personal, /has 4815162 in its path/);
  assert.match(personal, /types the literal "me@mail\.example\.com"/);
  assert.match(personal, /the notes holds? an email address/);
  assert.match(personal, /the notes holds? an id \(123e4567/);
  assert.equal(p.files[0]!.text.includes("learnedAt"), false);
  assert.deepEqual(
    p.files.map((f) => f.path),
    ["sites/demo.json", "sites/demo.md"],
  );
});

test("the shared rules cap allowed values and checks, and refuse checks on a write and an unproven op", () => {
  assert.deepEqual(
    errors(
      spec(
        {},
        {
          params: [{ name: "q", enum: ["kittens", "puppies"] }],
          checks: [{ args: { q: "zzzz" }, expect: "empty", purpose: "no story is called zzzz" }],
        },
      ),
    ),
    [],
  );
  const refused: [string, Site, RegExp][] = [
    [
      "a huge enum",
      spec({}, { params: [{ name: "q", enum: Array.from({ length: 101 }, (_, i) => `v${i}`) }] }),
      /param q lists 101 values; at most 100/,
    ],
    [
      "a long enum value",
      spec({}, { params: [{ name: "q", enum: ["x".repeat(501)] }] }),
      /enum value is 501 characters/,
    ],
    [
      "many checks",
      spec({}, { checks: Array.from({ length: 11 }, (_, i) => ({ args: { q: `q${i}xx` }, expect: "result" })) }),
      /11 checks; at most 10/,
    ],
    [
      "a long check arg",
      spec({}, { checks: [{ args: { q: "x".repeat(501) }, expect: "result" }] }),
      /check 1 arg q is 501/,
    ],
    [
      "a check arg no param takes",
      spec({}, { checks: [{ args: { page: "2" }, expect: "result" }] }),
      /sets page, which is no param/,
    ],
    [
      "a check on a write",
      spec(
        {},
        {
          readOnly: false,
          request: { method: "POST", url: "https://news.example.com/api/s", headers: {} },
          checks: [{ args: { q: "abc" }, expect: "result" }],
        },
      ),
      /a write has checks/,
    ],
    [
      "unproven",
      spec({}, { unproven: { params: ["q"], reason: "example 2 (q=cats) was answered with example 1's data" } }),
      /nothing shows the server reads q/,
    ],
  ];
  for (const [what, s, re] of refused) assert.match(errors(s).join("\n"), re, what);
});

test("the shared rules check paging: a param of the read that goes in a slot, and a path to one value", () => {
  const optional = [{ name: "q", required: false }];
  assert.deepEqual(
    errors(spec({}, { params: optional, paging: { param: "q", next: 'data.search["page-info"].next' } })),
    [],
  );
  // numbered pages: the caller gives the page number
  assert.deepEqual(errors(spec({}, { paging: { param: "q" } })), []);
  const html = { format: "html", html: { items: "li", fields: { t: "a" } } };
  const refused: [string, Site, RegExp][] = [
    [
      "a required cursor",
      spec({}, { paging: { param: "q", next: "next" } }),
      /paging param q is required, so the first page cannot be asked for/,
    ],
    ["no such param", spec({}, { paging: { param: "page" } }), /search: paging param page is no param of it/],
    [
      "a param in no slot",
      spec({}, { params: [{ name: "q" }, { name: "page", required: false }], paging: { param: "page" } }),
      /paging param page goes in no slot of its request/,
    ],
    [
      "a write",
      spec(
        {},
        {
          readOnly: false,
          request: { method: "POST", url: "https://news.example.com/api/s?q=x", headers: {} },
          paging: { param: "q" },
        },
      ),
      /a write has no pages/,
    ],
    ["html", spec({}, { response: html, paging: { param: "q", next: "next" } }), /paging next reads JSON/],
    ["many values", spec({}, { paging: { param: "q", next: "hits[*].cursor" } }), /paging next .* one value/],
    ["not a path", spec({}, { paging: { param: "q", next: "a..b" } }), /paging next "a\.\.b" is not a path/],
    ["long", spec({}, { paging: { param: "q", next: "a".repeat(201) } }), /paging next is 201 characters/],
  ];
  for (const [what, s, re] of refused) assert.match(errors(s).join("\n"), re, what);
});

test("the shared rules check a write's readback: a read of the same site, given the write's values", () => {
  const read = spec().operations[0]!;
  const withWrite = (readback: Record<string, unknown>, onRead?: Record<string, unknown>) =>
    spec({
      operations: [
        { ...read, ...(onRead ? { readback: onRead } : {}) },
        {
          name: "post",
          readOnly: false,
          request: { method: "POST", url: "https://news.example.com/api/post", headers: {}, body: '{"title":"x"}' },
          slots: [{ param: "title", at: ["body", "json:/title"] }],
          params: [{ name: "title" }],
          trigger: { url: "https://news.example.com/submit" },
          match: { host: "news.example.com", path: "/api/post" },
          readback,
        },
      ],
    });
  assert.deepEqual(errors(withWrite({ op: "search", args: { q: "{title}" } })), []);
  assert.deepEqual(
    errors(withWrite({ op: "search", args: { q: "new" }, find: { field: "title", equals: "{title}" } })),
    [],
  );
  const refused: [string, Site, RegExp][] = [
    ["no such op", withWrite({ op: "nope", args: { q: "{title}" } }), /post: readback op nope is no operation of demo/],
    ["a write", withWrite({ op: "post", args: { title: "{title}" } }), /readback op post is a write/],
    [
      "on a read",
      withWrite({ op: "search", args: { q: "{title}" } }, { op: "search", args: { q: "{q}" } }),
      /search: a read has no readback/,
    ],
    [
      "an arg no param takes",
      withWrite({ op: "search", args: { q: "{title}", page: "2" } }),
      /readback sets page, which is no param of search/,
    ],
    [
      "a required param unset",
      withWrite({ op: "search", find: { field: "title", equals: "{title}" } }),
      /readback leaves search's required q unset/,
    ],
    [
      "a hole no write param fills",
      withWrite({ op: "search", args: { q: "{name}" } }),
      /readback fills \{name\}, which is no param of post/,
    ],
    [
      "nothing of this write",
      withWrite({ op: "search", args: { q: "kittens" } }),
      /readback uses none of post's params/,
    ],
    ["long", withWrite({ op: "search", args: { q: `{title}${"x".repeat(500)}` } }), /readback arg q is 507 characters/],
  ];
  for (const [what, s, re] of refused) assert.match(errors(s).join("\n"), re, what);
});

test("publish runs on verify's record: every counted check passes, inconclusive ones are shown, and the record goes in the pull request", async () => {
  const answers: Record<string, () => Response> = {
    kittens: () => json({ hits: [{ title: "kittens everywhere" }] }),
    zzzz: () => json({ hits: [] }),
    cats: () => new Response("slow down", { status: 429 }),
  };
  const fetchImpl = (async (u: string | URL | Request) =>
    answers[new URL(String(u)).searchParams.get("q")!]!()) as typeof fetch;
  const opts = { maxTier: 1 as const, minIntervalMs: 0, fetchImpl };
  saveSite(
    spec(
      {},
      {
        params: [{ name: "q", example: "kittens" }],
        unproven: { params: ["q"], reason: "example 2 (q=cats) was answered with example 1's data" },
        checks: [
          { args: { q: "zzzz" }, expect: "empty", purpose: "no story is called zzzz" },
          { args: { q: "cats" }, expect: "result" },
        ],
      },
    ),
  );
  const before = plan("demo", { keepExamples: true }).errors.join("\n");
  assert.match(
    before,
    /search: example 2 \(q=cats\) was answered with example 1's data, so nothing shows the server reads q: add it again/,
  );
  assert.match(before, /search: its checks have not run on this version of it: api-anything verify demo/);

  const v = await verifySite("demo", opts);
  assert.deepEqual(
    v.results.map((r) => ("outcome" in r ? [r.case, r.outcome, r.got] : r)),
    [
      ["example", "pass", "result"],
      ["check 1", "pass", "empty"],
      ["check 2", "inconclusive", "rate"],
    ],
  );
  // the example and check 1 differ only in q and answer differently: q is read after all
  assert.deepEqual(v.proven, ["search"]);
  assert.equal(loadSite("demo")!.site.operations[0]!.unproven, undefined);
  const p = plan("demo", { keepExamples: true });
  assert.deepEqual(p.errors, []);
  assert.match(p.personal.join("\n"), /checks\[0\] sends q=zzzz: is every value public/);

  writeOutbox(p);
  const up = "repos/goodnight000/api-anything";
  const gh = fakeGh({
    "GET user": { login: "octo", id: 42 },
    [`POST ${up}/forks`]: { full_name: "octo/api-anything" },
    [`GET ${up}/git/ref/heads/main`]: { object: { sha: "a".repeat(40) } },
    "POST repos/octo/api-anything/git/refs": {},
    "PUT repos/octo/api-anything/contents/sites/demo.json": {},
    [`POST ${up}/pulls`]: { html_url: "https://github.com/goodnight000/api-anything/pull/8" },
  });
  await submit("demo", { keepExamples: true, retryMs: 1 });
  const body = String(gh.log().find((c) => c.args[3] === `${up}/pulls`)!.input?.body);
  assert.match(body, /\| `search` \| example \| result \| pass \|/);
  assert.match(body, /\| `search` \| check 1 \(q=zzzz\): no story is called zzzz \| empty \| pass \|/);
  assert.match(body, /\| `search` \| check 2 \(q=cats\) \| result \| inconclusive \(rate\) \|/);

  // a check that fails holds the spec back
  answers.cats = () => json({ hits: [] });
  await verifySite("demo", opts);
  assert.match(plan("demo").errors.join("\n"), /search: check 2 \(q=cats\) expects result, and answered empty/);
  // and a changed op has no record until verify runs on it again
  const s = loadSite("demo")!.site;
  s.operations[0]!.checks = s.operations[0]!.checks!.slice(0, 1);
  saveSite(s);
  assert.match(plan("demo").errors.join("\n"), /its checks have not run on this version/);
});

test("verify asks a paged read for its next page: page 1 again fails and holds publish back", async () => {
  const pages: Record<string, unknown> = {
    "": { hits: [{ t: "a" }, { t: "b" }], next: "c2" },
    c2: { hits: [{ t: "c" }], next: null },
  };
  let answer = (after: string) => pages[after];
  const fetchImpl = (async (u: string | URL | Request) =>
    json(answer(new URL(String(u)).searchParams.get("after") ?? ""))) as typeof fetch;
  const opts = { maxTier: 1 as const, minIntervalMs: 0, fetchImpl };
  const paged = (paging: Record<string, unknown>, example?: string) =>
    spec(
      {},
      {
        request: { method: "GET", url: "https://news.example.com/api/search?q=kittens&after=", headers: {} },
        slots: [
          { param: "q", at: ["query:q"] },
          { param: "after", at: ["query:after"] },
        ],
        params: [
          { name: "q", example: "kittens" },
          { name: "after", required: false, ...(example ? { example } : {}) },
        ],
        paging,
      },
    );
  const cases = async () =>
    (await verifySite("demo", opts)).results.map((r) => ("outcome" in r ? [r.case, r.outcome, r.got] : r));

  saveSite(paged({ param: "after", next: "next" }));
  assert.deepEqual(await cases(), [
    ["example", "pass", "result"],
    ["next page", "pass", "result"],
  ]);
  // a server that ignores the cursor answers page 1 again
  answer = () => pages[""];
  assert.deepEqual((await cases())[1], ["next page", "fail", "page 1 again"]);
  assert.match(
    plan("demo", { keepExamples: true }).errors.join("\n"),
    /search: next page expects result, and answered page 1 again/,
  );
  // one page only: nothing to go on to, which tests nothing
  answer = () => pages.c2;
  const one = (await verifySite("demo", opts)).results[1]!;
  assert.deepEqual("outcome" in one && [one.outcome, one.got], ["inconclusive", "no next page"]);
  assert.match(
    "reason" in one ? (one.reason ?? "") : "",
    /page 1 answered no next page at next: give search an example with more than one page/,
  );

  // numbered pages: the example's page plus one
  answer = (page) => ({ hits: [{ t: `p${page}` }] });
  saveSite(paged({ param: "after" }, "1"));
  assert.deepEqual((await cases())[1], ["next page", "pass", "result"]);
  answer = () => ({ hits: [{ t: "p1" }] });
  assert.deepEqual((await cases())[1], ["next page", "fail", "page 1 again"]);
  // and with no page number to add one to, it is not asked
  saveSite(paged({ param: "after" }));
  assert.deepEqual((await cases())[1], ["next page", "inconclusive", "no next page"]);
});

test("a server that failed or could not be reached is inconclusive: call says server, through every finishing step", async () => {
  saveSite(spec({}, { params: [{ name: "q" }], checks: [{ args: { q: "kittens" }, expect: "result" }] }));
  for (const fetchImpl of [
    (async () => new Response("upstream down", { status: 503 })) as unknown as typeof fetch,
    (async () => {
      throw new TypeError("fetch failed: connection reset");
    }) as unknown as typeof fetch,
  ]) {
    const opts = { maxTier: 1 as const, minIntervalMs: 0, fetchImpl };
    const r = await call("demo", "search", { q: "kittens" }, opts);
    assert.equal(r.ok, false);
    assert.equal(r.server, true, JSON.stringify(r));
    const v = await verifySite("demo", opts);
    assert.deepEqual(
      v.results.map((x) => ("outcome" in x ? [x.case, x.outcome] : x)),
      [["check 1", "inconclusive"]],
    );
  }
  // a refusal of the request itself is the op's answer, not the server's failure
  const r = await call(
    "demo",
    "search",
    { q: "kittens" },
    {
      maxTier: 1,
      minIntervalMs: 0,
      fetchImpl: (async () => new Response("bad request", { status: 422 })) as unknown as typeof fetch,
    },
  );
  assert.equal(r.server, undefined, JSON.stringify(r));
});

/** A stand-in for `gh`: logs each call and answers from a route table, 404 for anything else. */
function fakeGh(routes: Record<string, unknown>): { log: () => { args: string[]; input?: Record<string, unknown> }[] } {
  const dir = mkdtempSync(join(tmpdir(), "aa-gh-"));
  const bin = join(dir, "gh.cjs");
  writeFileSync(join(dir, "routes.json"), JSON.stringify(routes));
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  fs.appendFileSync(${JSON.stringify(join(dir, "log"))}, JSON.stringify({ args, input: input ? JSON.parse(input) : undefined }) + "\\n");
  const routes = JSON.parse(fs.readFileSync(${JSON.stringify(join(dir, "routes.json"))}, "utf8"));
  const key = args[2] + " " + args[3];
  const r = routes[key] ?? routes[key.split("?")[0]];
  if (r === undefined) { process.stderr.write("gh: Not Found (HTTP 404)\\n"); process.exit(1); }
  if (r && r.status >= 400) { process.stderr.write("gh: refused (HTTP " + r.status + ")\\n"); process.exit(1); }
  process.stdout.write(JSON.stringify(r));
});
`,
  );
  chmodSync(bin, 0o755);
  process.env.API_ANYTHING_GH = bin;
  return {
    log: () =>
      readFileSync(join(dir, "log"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
  };
}

test("publish --yes sends exactly the preview, as a pull request from the user's fork under a noreply address", async () => {
  saveSite(spec());
  await assert.rejects(submit("demo"), /no preview of demo yet/);
  writeOutbox(plan("demo"));
  saveSite(spec({ description: "changed after the preview" }));
  await assert.rejects(submit("demo"), /demo changed since its preview/);
  const p = plan("demo");
  writeOutbox(p);

  const up = "repos/goodnight000/api-anything";
  const gh = fakeGh({
    "GET user": { login: "octo", id: 42 },
    [`POST ${up}/forks`]: { full_name: "octo/api-anything" },
    "POST repos/octo/api-anything/merge-upstream": {},
    [`GET ${up}/git/ref/heads/main`]: { object: { sha: "a".repeat(40) } },
    "POST repos/octo/api-anything/git/refs": {},
    "PUT repos/octo/api-anything/contents/sites/demo.json": {},
    [`POST ${up}/pulls`]: { html_url: "https://github.com/goodnight000/api-anything/pull/7" },
  });
  const r = await submit("demo", { retryMs: 1 });
  assert.deepEqual(r, {
    pr: "https://github.com/goodnight000/api-anything/pull/7",
    branch: `share/demo-${p.sha256.slice(0, 10)}`,
    fork: "octo/api-anything",
    update: false,
  });
  const calls = gh.log();
  // every call is `gh api --method M path`, the body on stdin: nothing from the spec is an argument
  for (const c of calls) assert.deepEqual(c.args.slice(0, 2), ["api", "--method"]);
  const put = calls.find((c) => c.args[2] === "PUT")!;
  const who = { name: "octo", email: "42+octo@users.noreply.github.com" };
  assert.deepEqual([put.input?.author, put.input?.committer], [who, who]);
  assert.equal(Buffer.from(String(put.input?.content), "base64").toString(), p.files[0]!.text);
  const pr = calls.find((c) => c.args[3] === `${up}/pulls`)!;
  assert.equal(pr.input?.head, `octo:${r.branch}`);
  assert.match(String(pr.input?.title), /^Add demo \(1 operation\)$/);
});

test("a publish that fails after its files reached the fork says they are public there", async () => {
  saveSite(spec());
  writeOutbox(plan("demo"));
  const up = "repos/goodnight000/api-anything";
  fakeGh({
    "GET user": { login: "octo", id: 42 },
    [`POST ${up}/forks`]: { full_name: "octo/api-anything" },
    [`GET ${up}/git/ref/heads/main`]: { object: { sha: "a".repeat(40) } },
    "POST repos/octo/api-anything/git/refs": {},
    "PUT repos/octo/api-anything/contents/sites/demo.json": {},
    [`POST ${up}/pulls`]: { status: 403 },
  });
  await assert.rejects(
    submit("demo", { retryMs: 1 }),
    /HTTP 403.*sites\/demo\.json may already be public in your fork octo\/api-anything, branch share\/demo-/,
  );
});
