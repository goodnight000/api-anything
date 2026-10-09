/**
 * Round-3 regressions: challenge verify POSTs under a read's guard, SPA locations and beacon acks,
 * server-issued credentials, echo evidence on an explicit pick, tier-2 navigation retries, zero
 * results on HTML recipes, encoded cookies in param templates, embedded IPs, soft challenge
 * titles, disguised GET writes, and the agent surface (MCP next hints, site notes, inspect, param
 * patterns).
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chromeAvailable, closeBrowser, pageFetch, runTrigger } from "../../src/browser.js";
import { classify } from "../../src/classify.js";
import { call } from "../../src/execute.js";
import { addOperation, capturePage, profileDir, runOpTrigger } from "../../src/heal.js";
import { buildRequest } from "../../src/http.js";
import { learnOperation } from "../../src/learn.js";
import { mcpNext, createServer as mcpServer } from "../../src/mcp.js";
import { type Operation, parseSite } from "../../src/spec.js";
import { exportSite, loadSite, saveSite } from "../../src/store.js";
import type { Exchange, StoredCookie } from "../../src/types.js";

const TMP = mkdtempSync(join(tmpdir(), "aa-round3-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
let homes = 0;
const newHome = () => {
  const h = join(TMP, `home${++homes}`);
  mkdirSync(join(h, "sites"), { recursive: true });
  process.env.API_ANYTHING_HOME = h;
  return h;
};
newHome();
const noChrome = !chromeAvailable() && "Google Chrome not installed";
const noSession = { cookies: [] as StoredCookie[], values: {} as Record<string, string> };

let nextId = 1;
function ex(
  type: string,
  req: { method?: string; url: string; headers?: Record<string, string>; body?: string },
  body = '{"results":[{"id":1},{"id":2}]}',
  contentType = "application/json",
  resHeaders: Record<string, string> = {},
): Exchange {
  return {
    id: nextId++,
    resourceType: type,
    request: {
      method: req.method ?? "GET",
      url: req.url,
      headers: req.headers ?? {},
      ...(req.body !== undefined ? { body: req.body } : {}),
    },
    response: { status: 200, headers: resHeaders, contentType, body },
  };
}
const learn = (
  exchanges: Exchange[],
  examples: [Record<string, unknown>],
  extra: Partial<Parameters<typeof learnOperation>[0]> = {},
) =>
  learnOperation({
    exchanges,
    examples,
    cookies: [],
    name: "op",
    trigger: { url: "https://site.test/" },
    readOnly: true,
    ...extra,
  });

async function listen(
  handler: Parameters<typeof createServer>[1],
  host = "127.0.0.1",
): Promise<{ server: Server; base: string }> {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, host, r));
  return { server, base: `http://${host}:${(server.address() as AddressInfo).port}` };
}
const html = (res: import("node:http").ServerResponse, body: string, status = 200) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`);
};

/* ------------------------------------------------ 2: SPA locations, acks */

describe("a beacon that echoes the SPA's pushState location is not learned", () => {
  const page = ex("document", { url: "https://site.test/" }, "<html><input id=q></html>", "text/html");
  const data = ex("fetch", {
    method: "POST",
    url: "https://site.test/api/graphql",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "a1b2c3", v: Buffer.from("notion").toString("base64") }),
  });
  const beacon = (res: string) =>
    ex(
      "fetch",
      {
        method: "POST",
        url: "https://events.other.test/v1/p",
        headers: { "content-type": "text/plain", referer: "https://site.test/" },
        body: JSON.stringify({
          properties: { search: "?q=notion" },
          context: { page: { url: "https://site.test/search?q=notion" } },
        }),
      },
      res,
    );

  test("the page's live location (pushState, finalUrl) makes the beacon's leaves echoes", () => {
    const b = beacon('{"id":"evt_0192837465"}');
    // control: with only the document and the Referer, the echo goes unseen
    assert.equal(learn([page, data, b], [{ q: "notion" }]).exchange.id, b.id);
    assert.throws(
      () => learn([page, data, b], [{ q: "notion" }], { pages: ["https://site.test/search?q=notion"] }),
      /no captured request carries the example values/,
    );
  });

  test("a read whose chosen answer is a data-less ack is refused, unless the request was picked by id", () => {
    const b = beacon('{"success":true}');
    assert.throws(
      () => learn([page, data, b], [{ q: "notion" }]),
      /answers without data .*--pick-request.*--html or --embedded/,
    );
    assert.equal(learn([page, data, b], [{ q: "notion" }], { id: b.id }).exchange.id, b.id);
    // an answer carrying the example is data, however small
    const small = ex("fetch", { url: "https://site.test/api/user?name=alice" }, '{"user":{"name":"alice"}}');
    assert.equal(learn([small], [{ name: "alice" }]).exchange.id, small.id);
  });
});

/* ------------------------------------------------ 3: server-issued creds */

describe("a token an earlier response issued is a session: ref, whatever its name", () => {
  const TOK = "Zx81kLmN0pQrStUv2wXyZ3aBcD";
  const boot = () => ex("fetch", { url: "https://site.test/api/bootstrap" }, JSON.stringify({ t: TOK }));
  for (const [label, req] of [
    ["a query param named t", { url: `https://api.site.test/v1/search?q=kittens&t=${TOK}` }],
    ["a neutral header", { url: "https://api.site.test/v1/search?q=kittens", headers: { "x-ctx": TOK } }],
  ] as const) {
    test(label, () => {
      const { operation: op, sessionValues } = learn([boot(), ex("fetch", req)], [{ q: "kittens" }]);
      assert.ok(!JSON.stringify(op).includes(TOK), "the token is literal in the spec");
      const ref = op.slots.find((s) => s.ref)!;
      assert.match(ref.ref!, /^session:op\//);
      assert.equal(sessionValues[ref.ref!.slice(8)], TOK);
      const r = buildRequest(
        op,
        { q: "cats" },
        { cookies: [], values: { [ref.ref!.slice(8)]: "Fresh0Token1Value2Xyz345" } },
      );
      assert.ok(JSON.stringify(r).includes("Fresh0Token1Value2Xyz345"), "a refreshed value is sent");
    });
  }

  test("a later response does not count, and a persisted-query hash stays a volatile anchor", () => {
    const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f";
    const req = ex("fetch", { url: `https://api.site.test/v1/search?q=kittens&hash=${hash}` });
    const { operation: op } = learn(
      [ex("fetch", { url: "https://site.test/api/meta" }, JSON.stringify({ hash })), req],
      [{ q: "kittens" }],
    );
    assert.deepEqual(
      op.slots.filter((s) => s.ref),
      [],
    );
    assert.equal(op.volatile.length, 1);
    const later = learn(
      [
        ex("fetch", { url: `https://api.site.test/v1/search?q=kittens&t=${TOK}` }),
        ex("fetch", { url: "https://site.test/api/after" }, JSON.stringify({ t: TOK })),
      ],
      [{ q: "kittens" }],
    );
    assert.deepEqual(
      later.operation.slots.filter((s) => s.ref),
      [],
    );
  });

  test("a key in a per-user script sent with the session cookie is not public; one in a static bundle is", () => {
    const key = "Uk7pQ2mZ9xVb4NcR8sLd3Tg6";
    const api = () => ex("fetch", { url: "https://api.site.test/v1/search?q=kittens", headers: { "x-api-key": key } });
    const perUser = ex(
      "script",
      { url: "https://site.test/api/me/config.js", headers: { cookie: "sess=abc" } },
      `window.__CFG__={user:"alice",apiKey:"${key}"};`,
      "application/javascript",
    );
    const { operation: op } = learn([perUser, api()], [{ q: "kittens" }]);
    assert.equal(op.public, undefined);
    assert.ok(!JSON.stringify(op).includes(key));
    const bundle = ex(
      "script",
      { url: "https://site.test/static/main.3f9a.js", headers: { cookie: "sess=abc" } },
      `var k="${key}";`,
      "application/javascript",
      { "cache-control": "public, max-age=31536000, immutable" },
    );
    const shipped = learn([bundle, api()], [{ q: "kittens" }]).operation;
    assert.deepEqual(shipped.public, ["x-api-key"]);
    assert.equal(shipped.request.headers["x-api-key"], key);
  });

  test("bearer and pwd name credentials", () => {
    for (const q of [`bearer=${TOK}`, `pwd=${TOK}`]) {
      const { operation: op } = learn(
        [ex("fetch", { url: `https://api.site.test/v1/search?q=kittens&${q}` })],
        [{ q: "kittens" }],
      );
      assert.ok(!JSON.stringify(op).includes(TOK), q);
    }
  });
});

/* ----------------------------------------------- 4: echo on explicit pick */

test("a route resolver whose only arg is the page path learns when picked by id", () => {
  const exs = [
    ex("document", { url: "https://site.test/facebook/react" }, "<html><div id=app></div></html>", "text/html"),
    ex(
      "fetch",
      {
        method: "POST",
        url: "https://site.test/api/route",
        headers: { "content-type": "application/json", referer: "https://site.test/facebook/react" },
        body: JSON.stringify({ path: "/facebook/react", locale: "en" }),
      },
      '{"data":{"repo":{"name":"react","stars":1}}}',
    ),
  ];
  const input = { trigger: { url: "https://site.test/{repo}" } };
  assert.throws(() => learn(exs, [{ repo: "facebook/react" }], input), /no captured request carries/);
  const { operation: op } = learn(exs, [{ repo: "facebook/react" }], { ...input, id: exs[1]!.id });
  assert.deepEqual(JSON.parse(buildRequest(op, { repo: "vercel/next.js" }, noSession).body!), {
    path: "/vercel/next.js",
    locale: "en",
  });
});

/* ------------------------------------------ 7: encoded cookie, no escape */

test("a param template finds a percent-encoded cookie in a leaf with no escape of its own", () => {
  const TOKEN = "q2Fz/9kLmT0vX+Yb7NcW1pRe/Hs3JuQa8Df+Lg6ZoVy4=";
  const cookies: StoredCookie[] = [
    { name: "tok", value: TOKEN, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false },
  ];
  const e = ex(
    "fetch",
    {
      url: "http://127.0.0.1/api/data",
      headers: { cookie: `tok=${TOKEN}`, "x-ctx": `user=alice;auth=${encodeURIComponent(TOKEN)}` },
    },
    '{"data":{"name":"alice"}}',
  );
  const { operation: op } = learnOperation({
    exchanges: [e],
    examples: [{ name: "alice" }],
    cookies,
    name: "op",
    trigger: { url: "http://127.0.0.1/p?name={name}" },
    readOnly: true,
  });
  assert.ok(!JSON.stringify(op).includes(encodeURIComponent(TOKEN)), "the encoded cookie is literal in the spec");
  const fresh = "ZZFz/9kLmT0vX+Yb7NcW1pRe/Hs3JuQa8Df+Lg6ZoVy4=";
  const r = buildRequest(op, { name: "bob" }, { cookies: [{ ...cookies[0]!, value: fresh }], values: {} });
  assert.equal(r.headers["x-ctx"], `user=bob;auth=${encodeURIComponent(fresh)}`);
});

/* ------------------------------------------------ 8: embedded IP export */

test("export flags an IP inside a longer leaf, not a version string", () => {
  newHome();
  const warn = (name: string, body: string, headers: Record<string, string> = {}) => {
    saveSite(
      parseSite({
        name,
        baseUrl: "https://s.test",
        operations: [
          {
            name: "op",
            readOnly: true,
            request: {
              method: "POST",
              url: "https://s.test/api",
              headers: { "content-type": "application/json", ...headers },
              body,
            },
            trigger: { url: "https://s.test/" },
          },
        ],
      }),
    );
    return exportSite(name).warnings.filter((w) => /IP address/.test(w));
  };
  assert.equal(warn("a", JSON.stringify({ addr: "73.162.10.4:51234" })).length, 1);
  assert.equal(warn("b", "{}", { "x-forwarded-for": "73.162.10.4, 10.0.0.1" }).length, 1);
  assert.equal(warn("c", JSON.stringify({ ctx: "ip=73.162.10.4&geo=US" })).length, 1);
  assert.equal(warn("d", JSON.stringify({ remoteHost: "73.162.10.4" })).length, 1);
  assert.deepEqual(
    warn(
      "e",
      JSON.stringify({
        ua: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
        v: "v1.2.3.4",
        at: "2026-09-27T12:30:45.123Z",
      }),
    ),
    [],
  );
});

/* ------------------------------------------- 6, 9: classifier (HTML pages) */

describe("HTML recipes", () => {
  const op = (items: string) =>
    parseSite({
      name: "s",
      baseUrl: "https://s.test",
      operations: [
        {
          name: "op",
          readOnly: true,
          request: { method: "GET", url: "https://s.test/s?q=kittens", headers: {} },
          slots: [{ param: "q", at: ["query:q"] }],
          params: [{ name: "q", example: "kittens" }],
          trigger: { url: "https://s.test/s?q={q}" },
          response: { format: "html", html: { items, fields: { t: "" } } },
        },
      ],
    }).operations[0]!;
  const page = (body: string, title = "Search") => ({
    status: 200,
    headers: { "content-type": "text/html" },
    body: `<html><head><title>${title}</title></head><body>${body}</body></html>`,
  });

  test("a page titled like a robot check is not a wall when the recipe finds its items", () => {
    const r = classify(
      op("li.r"),
      page("<li class=r>x</li>".repeat(50), "Robot check-in: how our warehouse robots work"),
    );
    assert.equal(r.class, "ok", r.reason);
    assert.equal(
      classify(op("li.r"), page("<p>solve this</p>", "Robot check")).class,
      "blocked",
      "without the data the title still counts",
    );
  });

  test("zero results: the items' container is there and empty", () => {
    assert.equal(
      classify(op("ul.results li.r"), page("<h1>No results for zzqx</h1><ul class=results></ul>")).class,
      "ok",
    );
    const renamed = classify(op("ul.results li.r"), page("<ul class=results><li class=result>a</li></ul>"));
    assert.equal(renamed.class, "drift", "items under another class are a renamed selector");
    assert.equal(renamed.missing, true);
    assert.equal(
      classify(op("li.r"), page("<ul></ul>")).missing,
      true,
      "no container in the selector: the example replay decides",
    );
    assert.equal(
      classify(op("#search > .item"), page("<div id=search><p>No results</p></div>")).missing,
      true,
      "no tag: any element in the container is not emptiness",
    );
    assert.equal(classify(op("#search > .item"), page("<div id=search></div>")).class, "ok");
  });

  test("call: an empty results page is ok [] with one request, no example replay", async () => {
    newHome();
    saveSite(
      parseSite({
        name: "z",
        baseUrl: "https://z.test",
        operations: [
          { ...op("ul.results li.r"), request: { method: "GET", url: "https://z.test/s?q=kittens", headers: {} } },
        ],
      }),
    );
    let n = 0;
    const fetchImpl = (async (u: string | URL | Request) => {
      n++;
      const q = new URL(String(u)).searchParams.get("q");
      return new Response(
        q === "zzqx"
          ? "<html><body><ul class=results></ul></body></html>"
          : `<html><body><ul class=results><li class=r>${q}</li></ul></body></html>`,
        { headers: { "content-type": "text/html" } },
      );
    }) as typeof fetch;
    const r = await call("z", "op", { q: "zzqx" }, { fetchImpl, maxTier: 1, minIntervalMs: 0 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, []);
    assert.equal(n, 1);
  });
});

/* ------------------------------------ 11a, 11f: call-level input answers */

describe("input answers", () => {
  const base = (over: Record<string, unknown> = {}) =>
    parseSite({
      name: "p",
      baseUrl: "https://p.test",
      operations: [
        {
          name: "op",
          readOnly: true,
          request: { method: "GET", url: "https://p.test/api/profile?id=alice&date=2027-04-15", headers: {} },
          slots: [
            { param: "id", at: ["query:id"] },
            { param: "date", at: ["query:date"] },
          ],
          params: [
            { name: "id", example: "alice" },
            { name: "date", example: "2027-04-15", pattern: "\\d{4}-\\d{2}-\\d{2}", hint: "a date as YYYY-MM-DD" },
          ],
          trigger: { url: "https://p.test/{id}" },
          response: { format: "json", extract: "profile" },
          ...over,
        },
      ],
    });
  const json = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

  test("an arg that fails the param's pattern is input with the hint, and nothing is sent", async () => {
    newHome();
    saveSite(base());
    let n = 0;
    const r = await call(
      "p",
      "op",
      { id: "bob", date: "Oct 21" },
      {
        fetchImpl: (async () => {
          n++;
          return json({ profile: {} });
        }) as typeof fetch,
        maxTier: 1,
        minIntervalMs: 0,
      },
    );
    assert.equal(r.class, "input", JSON.stringify(r));
    assert.match(r.reason ?? "", /param "date" must be a date as YYYY-MM-DD, got "Oct 21"/);
    assert.equal(n, 0);
    assert.throws(
      () =>
        parseSite({ ...base(), operations: [{ ...base().operations[0]!, params: [{ name: "id", pattern: "([" }] }] }),
      /valid regular expression/,
    );
  });

  test("a missing entity's bare 403 answers input fast and never calls it a bot wall", async () => {
    newHome();
    saveSite(base());
    let n = 0;
    const fetchImpl = (async (u: string | URL | Request) => {
      n++;
      return String(u).includes("alice")
        ? json({ profile: { name: "Alice" } })
        : json({ message: "This profile can't be accessed", status: 403 }, 403);
    }) as typeof fetch;
    const r = await call("p", "op", { id: "zzqx-no-such-person", date: "2027-04-15" }, { fetchImpl, minIntervalMs: 0 });
    assert.equal(r.class, "input", JSON.stringify(r));
    assert.equal(r.tier, 1);
    assert.equal(n, 2);
    assert.doesNotMatch(r.reason ?? "", /bot wall/);
  });
});

/* -------------------------------------- 11c, 11d, 11e: the agent surface */

describe("agent surface", () => {
  test("MCP next hints name MCP tools, and CLI-only commands say so", () => {
    assert.equal(
      mcpNext("check the args against: api-anything ops linkedin; do not heal or re-add"),
      'check the args against: list_operations {"site":"linkedin"}; do not heal or re-add',
    );
    assert.match(
      mcpNext("ask the user to run: api-anything login x; then retry once"),
      /^the login tool \{"site":"x"\}/,
    );
    assert.match(
      mcpNext("api-anything heal x getUser; if that fails, re-learn it with api-anything add x getUser ..."),
      /CLI: run them in your shell; with no shell, ask the user to run them in a terminal\)$/,
    );
    assert.equal(mcpNext("api-anything sites lists what exists"), "list_sites lists what exists");
    assert.doesNotMatch(
      mcpNext(
        "only if the user asked for this write: rerun with --allow-writes (MCP: start the server with --allow-writes)",
      ),
      /rerun/,
    );
  });

  test("over MCP, call_operation's next and list_operations' notes and param hints", async () => {
    const home = newHome();
    saveSite(
      parseSite({
        name: "notes",
        baseUrl: "https://n.test",
        operations: [
          {
            name: "get",
            readOnly: true,
            request: { method: "GET", url: "https://n.test/api?d=2027-04-15", headers: {} },
            slots: [{ param: "d", at: ["query:d"] }],
            params: [{ name: "d", pattern: "\\d{4}-\\d{2}-\\d{2}", hint: "a date as YYYY-MM-DD" }],
            trigger: { url: "https://n.test/" },
          },
        ],
      }),
    );
    writeFileSync(join(home, "sites", "notes.md"), "# notes\nAirport codes only, not metro codes.\n");
    const [a, b] = InMemoryTransport.createLinkedPair();
    await mcpServer().connect(a);
    const client = new Client({ name: "r3", version: "0" });
    await client.connect(b);
    try {
      const text = (r: Awaited<ReturnType<Client["callTool"]>>) =>
        JSON.parse((r.content as { text: string }[])[0]!.text);
      const ops = text(await client.callTool({ name: "list_operations", arguments: { site: "notes" } }));
      assert.match(ops.notes, /Airport codes only/);
      assert.equal(ops.operations[0].params[0].hint, "a date as YYYY-MM-DD");
      const bad = text(
        await client.callTool({
          name: "call_operation",
          arguments: { site: "notes", op: "get", args: { d: "tomorrow" } },
        }),
      );
      assert.equal(bad.class, "input");
      assert.equal(bad.next, 'check the args against: list_operations {"site":"notes"}');
      assert.equal(loadSite("notes")!.site.name, "notes");
    } finally {
      await client.close();
    }
  });

  test("ops prints the notes and each param's format; inspect decodes layered bodies by default", async () => {
    const home = newHome();
    const ROOT = fileURLToPath(new URL("../..", import.meta.url));
    const cli = (...args: string[]) =>
      new Promise<{ code: number; stdout: string }>((resolve) =>
        execFile(
          process.execPath,
          ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args],
          { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: home } },
          (err, stdout) => resolve({ code: err ? 1 : 0, stdout }),
        ),
      );
    saveSite(
      parseSite({
        name: "notes",
        baseUrl: "https://n.test",
        operations: [
          {
            name: "get",
            readOnly: true,
            request: { method: "GET", url: "https://n.test/api?d=2027-04-15", headers: {} },
            slots: [{ param: "d", at: ["query:d"] }],
            params: [
              { name: "d", example: "2027-04-15", hint: "a date as YYYY-MM-DD", pattern: "\\d{4}-\\d{2}-\\d{2}" },
            ],
            trigger: { url: "https://n.test/" },
          },
        ],
      }),
    );
    writeFileSync(join(home, "sites", "notes.md"), "Airport codes only.\n");
    const ops = JSON.parse((await cli("ops", "notes")).stdout);
    assert.equal(ops.notes, "Airport codes only.");
    assert.deepEqual(ops.operations[0].params, ['d:string (e.g. "2027-04-15"; a date as YYYY-MM-DD)']);

    const payload = JSON.stringify([[["SFO", "JFK", 209]], [["SFO", "EWR", 254]]]);
    const fReq = JSON.stringify([null, JSON.stringify([["SFO"], ["JFK"]])]);
    mkdirSync(join(home, "captures"), { recursive: true });
    const capture = {
      id: "cbatch",
      at: new Date().toISOString(),
      url: "https://g.test/",
      finalUrl: "https://g.test/",
      cookies: [],
      exchanges: [
        {
          id: 1,
          resourceType: "xhr",
          request: {
            method: "POST",
            url: "https://g.test/_/data/batchexecute?rt=c",
            headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: `f.req=${encodeURIComponent(fReq)}&at=x`,
          },
          response: {
            status: 200,
            headers: {},
            contentType: "application/json",
            body: `)]}'\n\n${JSON.stringify([["wrb.fr", "rpc", payload, null]])}`,
          },
        },
      ],
    };
    writeFileSync(join(home, "captures", "cbatch.json"), JSON.stringify(capture));
    const shown = JSON.parse((await cli("inspect", "cbatch", "1")).stdout);
    assert.deepEqual(shown.data, [["wrb.fr", "rpc", JSON.parse(payload), null]]);
    assert.deepEqual(shown.request.body, { "f.req": [null, [["SFO"], ["JFK"]]], at: "x" });
  });
});

/* ---------------------------------------------------------------- browser */

describe("browser", { skip: noChrome }, () => {
  after(() => closeBrowser());

  test("1. a read's tier-3 run lets a JS challenge POST its proof, then guards the real page", async () => {
    newHome();
    let verifies = 0;
    let tracks = 0;
    const { server, base } = await listen((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      if (u.pathname === "/hotels") {
        if (!/aws-waf-token=ok/.test(req.headers.cookie ?? "")) {
          res.writeHead(202, { "content-type": "text/html" });
          // AWS WAF-style: the page solves a proof, POSTs it, and reloads once the token cookie is set
          return res.end(
            `<!doctype html><html><head><title></title><script>window.awsWafCookieDomainList=[];window.gokuProps={"key":"k"};</script>` +
              `<script>setTimeout(()=>fetch("/__challenge_ab12/mp_verify",{method:"POST",body:"proof"}).then(r=>r.ok&&location.reload()),300)</script></head><body></body></html>`,
          );
        }
        return html(
          res,
          `<div>${u.searchParams.get("q")} hotels</div><script>fetch("/api/list?q=${encodeURIComponent(u.searchParams.get("q") ?? "")}");fetch("/api/track",{method:"POST",body:"x"})</script>`,
        );
      }
      if (u.pathname === "/__challenge_ab12/mp_verify" && req.method === "POST") {
        verifies++;
        res.writeHead(200, { "set-cookie": "aws-waf-token=ok; Path=/", "content-type": "text/plain" });
        return res.end("ok");
      }
      if (u.pathname === "/api/track") {
        tracks++;
        return res.writeHead(204).end();
      }
      if (u.pathname === "/api/list") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ items: [{ name: `${u.searchParams.get("q")} 1` }] }));
      }
      res.writeHead(404).end();
    });
    try {
      const op: Operation = parseSite({
        name: "hot",
        baseUrl: base,
        operations: [
          {
            name: "list",
            readOnly: true,
            request: { method: "GET", url: `${base}/api/list?q=Madrid`, headers: {} },
            slots: [{ param: "q", at: ["query:q"] }],
            params: [{ name: "q", example: "Madrid" }],
            trigger: { url: `${base}/hotels?q={q}` },
            match: { method: "GET", path: "/api/list" },
            response: { format: "json", extract: "items" },
          },
        ],
      }).operations[0]!;
      const run = await runOpTrigger("hot", op, { q: "Porto" });
      assert.ok(verifies >= 1, "the challenge's verify POST reached the server");
      assert.equal(
        run.matched?.response?.status,
        200,
        JSON.stringify(
          run.capture.exchanges.map((e) => [e.request.method, e.request.url, e.response?.status, e.aborted]),
        ),
      );
      assert.match(run.matched?.response?.body ?? "", /Porto 1/);
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(tracks, 0, "once the real page loaded, an unsafe request that is not the op's own was aborted");
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  test("2. a capture records the SPA's pushState location, so add refuses the analytics beacon", async () => {
    newHome();
    const beacons: string[] = [];
    const b = await listen((req, res) => {
      let s = "";
      req.on("data", (d) => (s += d));
      req.on("end", () => {
        if (req.method === "POST") beacons.push(s);
        res.writeHead(200, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        });
        res.end('{"success":true}');
      });
    }, "localhost");
    const a = await listen((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      if (u.pathname === "/api/graphql") {
        let s = "";
        req.on("data", (d) => (s += d));
        req.on("end", () => {
          const q = Buffer.from(JSON.parse(s).v, "base64").toString();
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ data: { results: [{ name: `${q} one` }, { name: `${q} two` }] } }));
        });
        return;
      }
      html(
        res,
        `<input id=q><div id=out></div><script>document.getElementById('q').addEventListener('keydown', async (e) => { if (e.key !== 'Enter') return; const q = e.target.value;
          const r = await fetch('/api/graphql', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ id: 'a1b2c3', v: btoa(q) }) });
          document.getElementById('out').textContent = JSON.stringify(await r.json());
          history.pushState({}, '', '/search?q=' + encodeURIComponent(q));
          fetch('${b.base}/v1/p', { method: 'POST', headers: {'content-type':'text/plain'}, body: JSON.stringify({ event: 'search', properties: { search: location.search }, context: { page: { url: location.href } } }) });
        });</script>`,
      );
    });
    try {
      const steps = [
        { action: "fill" as const, selector: "#q", value: "{q}" },
        { action: "press" as const, selector: "#q", value: "Enter" },
      ];
      const run = await runTrigger({
        url: `${a.base}/`,
        steps: [
          { action: "fill", selector: "#q", value: "notion" },
          { action: "press", selector: "#q", value: "Enter" },
        ],
        profileDir: profileDir(),
      });
      assert.ok(run.locations?.includes(`${a.base}/search?q=notion`), JSON.stringify(run.locations));
      await assert.rejects(
        addOperation({
          site: "spa",
          op: "search",
          trigger: { url: `${a.base}/`, steps },
          examples: [{ q: "notion" }, { q: "figma" }],
        }),
        /no captured request carries|answers without data/,
      );
      assert.equal(loadSite("spa"), undefined, "nothing was saved");
    } finally {
      for (const s of [a.server, b.server]) {
        s.closeAllConnections();
        s.close();
      }
    }
  });

  test("5. a tier-2 read retries once when the origin page navigates mid-fetch; a write never does", async () => {
    newHome();
    const { server, base } = await listen((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      if (u.pathname === "/api/slow") {
        setTimeout(() => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end('{"ok":1}');
        }, 700);
        return;
      }
      // the origin page navigates itself once, shortly after load (an interstitial's redirect)
      html(
        res,
        `<script>if(!sessionStorage.getItem("n")){sessionStorage.setItem("n","1");setTimeout(()=>location.href="/?again=1",150)}</script>`,
      );
    });
    try {
      const other = base.replace("127.0.0.1", "localhost");
      await assert.rejects(
        pageFetch({ origin: base, url: `${base}/api/slow`, method: "GET", headers: {}, profileDir: profileDir() }),
        /Execution context was destroyed/,
      );
      const r = await pageFetch({
        origin: other,
        url: `${other}/api/slow`,
        method: "GET",
        headers: {},
        profileDir: profileDir(),
        retryOnNavigation: true,
      });
      assert.equal(r.status, 200);
      assert.equal(r.body, '{"ok":1}');
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  test("10. learning a write aborts a stylesheet, font or media load pointed at the site's own endpoint", async () => {
    newHome();
    const votes: string[] = [];
    let css = 0;
    const { server, base } = await listen((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      if (u.pathname === "/api/vote") {
        votes.push(u.search);
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("ok");
      }
      if (u.pathname === "/static/app.css") {
        css++;
        res.writeHead(200, { "content-type": "text/css" });
        return res.end("body{color:#111}");
      }
      html(
        res,
        `<button id=go onclick="` +
          `const l=document.createElement('link');l.rel='stylesheet';l.href='/api/vote?how=css';document.head.appendChild(l);` +
          `new Audio('/api/vote?how=audio').load();` +
          `new FontFace('x','url(/api/vote?how=font)').load().catch(()=>{});` +
          `const s=document.createElement('link');s.rel='stylesheet';s.href='/static/app.css';document.head.appendChild(s)">go</button>`,
      );
    });
    try {
      await capturePage({
        url: `${base}/p`,
        steps: [
          { action: "click", selector: "#go" },
          { action: "wait", ms: 1000 },
        ],
        write: true,
      });
      await new Promise((r) => setTimeout(r, 300));
      assert.deepEqual(votes, [], "a disguised GET write reached the server");
      assert.equal(css, 1, "a real stylesheet still loads");
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
