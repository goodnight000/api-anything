import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { hooks, learnSite } from "../src/learnsite.js";
import { createServer } from "../src/mcp.js";
import { learnTool } from "../src/mcp-learn.js";
import { HOLDOUT_PURPOSE } from "../src/share.js";
import { loadSite } from "../src/store.js";
import { notARead } from "../src/vet.js";
import { startRegistry } from "./fixture/registry.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function tools(): Promise<string[]> {
  const client = new Client({ name: "probe", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
  try {
    return (await client.listTools()).tools.map((t) => t.name);
  } finally {
    await client.close();
  }
}

test("learn_site is listed by default, and hidden when learning is off", async () => {
  assert.ok((await tools()).includes("learn_site"));
  learnTool.enabled = false;
  try {
    const names = await tools();
    assert.ok(!names.includes("learn_site"));
    assert.ok(names.includes("call_operation"));
  } finally {
    learnTool.enabled = true;
  }
});

test("api-anything mcp --no-learn serves no learn_site; a write asked of learn_site is refused", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-mcp-learn-"));
  const env = { ...(process.env as Record<string, string>), API_ANYTHING_HOME: home };
  const serve = (...flags: string[]) =>
    new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", join(ROOT, "src", "cli.ts"), "mcp", ...flags],
      cwd: ROOT,
      env,
    });
  const off = new Client({ name: "probe", version: "0" });
  const on = new Client({ name: "probe", version: "0" });
  try {
    await off.connect(serve("--no-learn"));
    assert.ok(!(await off.listTools()).tools.some((t) => t.name === "learn_site"));
    await on.connect(serve());
    const r = await on.callTool({
      name: "learn_site",
      arguments: {
        trigger: "http://127.0.0.1:1/compose",
        args: { t: "aaa" },
        args2: { t: "bbb" },
        args3: { t: "ccc" },
        write: true,
      },
    });
    const out = JSON.parse((r.content as { text: string }[])[0]!.text);
    assert.equal(r.isError, true);
    assert.deepEqual([out.ok, out.class], [false, "refused"]);
  } finally {
    await off.close();
    await on.close();
    rmSync(home, { recursive: true, force: true });
  }
});

/* ------------------------------------------- learn_site from captures, no browser */

// no browser can launch here: every test below runs from saved captures and plain HTTP
process.env.API_ANYTHING_BROWSER = "/nonexistent/chromium";

type Exchange = { method: string; path: string; body?: string; answer: unknown };

/**
 * A local site that answers each request with the JSON its path and `q` say, and records what reached it.
 * `slow`: the q values it answers only after `ms`.
 */
async function site(slow: { q: string[]; ms: number } = { q: [], ms: 0 }) {
  const hits: string[] = [];
  const server = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hits.push(`${req.method} ${req.url}${body ? ` ${body}` : ""}`);
      const q = new URL(req.url ?? "/", "http://x").searchParams.get("q") ?? /"q":"(\w+)"/.exec(body)?.[1] ?? "x";
      setTimeout(
        () => {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ items: [{ name: `${q} one` }, { name: `${q} two` }] }));
        },
        slow.q.includes(q) ? slow.ms : 0,
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { base, hits, close: () => new Promise<void>((r) => server.close(() => r())) };
}

/** Save a capture of the page `/shop?q=<q>` that made `requests`, as a browser run would have. */
function capture(home: string, id: string, base: string, q: string, requests: Exchange[]): string {
  const page = `${base}/shop?q=${q}`;
  const exchanges = [
    {
      id: 1,
      resourceType: "document",
      request: { method: "GET", url: page, headers: {} },
      response: {
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<html>shop</html>",
        contentType: "text/html",
      },
    },
    ...requests.map((r, i) => ({
      id: i + 2,
      resourceType: "fetch",
      request: {
        method: r.method,
        url: `${base}${r.path.replaceAll("{q}", q)}`,
        headers: r.body ? { "content-type": "application/json" } : {},
        ...(r.body ? { body: r.body.replaceAll("{q}", q) } : {}),
      },
      response: {
        status: 200,
        headers: { "content-type": "application/json" },
        contentType: "application/json",
        body: JSON.stringify(r.answer).replaceAll("{q}", q),
      },
    })),
  ];
  mkdirSync(join(home, "captures"), { recursive: true });
  writeFileSync(
    join(home, "captures", `${id}.json`),
    JSON.stringify({ id, at: new Date().toISOString(), url: page, finalUrl: page, cookies: [], exchanges }),
  );
  return id;
}

const items = { items: [{ name: "{q} one" }, { name: "{q} two" }] };
const mutation = {
  method: "POST",
  path: "/graphql",
  body: JSON.stringify({
    query: "mutation AddToCart($q: String!) { addToCart(item: $q) { items { name } } }",
    variables: { q: "{q}" },
  }),
  answer: { data: { addToCart: items } },
};

test("learn_site refuses a GraphQL mutation, a POST or a PUT as a read, picked or chosen, and sends nothing", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-learn-write-"));
  process.env.API_ANYTHING_HOME = home;
  const s = await site();
  const shares: unknown[] = [];
  hooks.share = async (...a) => {
    shares.push(a);
    return [];
  };
  try {
    const writes: [string, Exchange, { pickRequest?: number; extract?: string }][] = [
      ["a GraphQL mutation, picked", mutation, { pickRequest: 2, extract: "data.addToCart.items" }],
      ["a GraphQL mutation, automatic", mutation, {}],
      ["a JSON POST", { method: "POST", path: "/api/cart", body: '{"q":"{q}"}', answer: items }, {}],
      ["a PUT", { method: "PUT", path: "/api/cart?q={q}", answer: items }, { pickRequest: 2 }],
      [
        "a persisted GraphQL query, by its hash only",
        {
          method: "POST",
          path: "/graphql",
          body: JSON.stringify({
            operationName: "AddToCart",
            variables: { q: "{q}" },
            extensions: { persistedQuery: { version: 1, sha256Hash: "9f2c" } },
          }),
          answer: { data: { addToCart: items } },
        },
        { pickRequest: 2, extract: "data.addToCart.items" },
      ],
    ];
    for (const [n, [what, request, choice]] of writes.entries()) {
      const r = await learnSite(
        {
          site: "shop",
          op: "lookup",
          trigger: `${s.base}/shop?q={q}`,
          args: { q: "alice" },
          args2: { q: "bobby" },
          args3: { q: "carol" },
          captures: [
            capture(home, `w${n}a`, s.base, "alice", [request]),
            capture(home, `w${n}b`, s.base, "bobby", [request]),
          ],
          ...choice,
        },
        { minIntervalMs: 0 },
      );
      assert.deepEqual([r.ok, r.class], [false, "refused"], `${what}: ${JSON.stringify(r)}`);
      assert.match(r.error ?? "", /is not a read: .*learn_site learns reads only, and sent nothing/, what);
      assert.match(r.next ?? "", /add .*--write/, what);
      assert.equal(loadSite("shop"), undefined, `${what}: nothing saved`);
    }
    assert.deepEqual(s.hits, [], "no request reached the site: no holdout call, no clean replay");
    assert.equal(shares.length, 0);
  } finally {
    await s.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test("learn_site's automatic pick passes over a write for the read; the consent prompt and next list what may be the user's", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-learn-read-"));
  process.env.API_ANYTHING_HOME = home;
  const s = await site();
  const personal = ["$.operation.request.url holds an email address (me@mail.example.com)"];
  hooks.share = async (site, ops, o) =>
    o?.consent
      ? [{ site, op: ops[0]!, shared: true }]
      : [
          {
            site,
            op: ops[0]!,
            shared: false,
            needsConsent: true,
            reason: "it may hold something of the user's own",
            personal,
          },
        ];
  const read = { method: "GET", path: "/api/search?q={q}", answer: items };
  let runs = 0;
  const caps = () => [
    capture(home, `r${++runs}a`, s.base, "alice", [mutation, read]),
    capture(home, `r${runs}b`, s.base, "bobby", [mutation, read]),
  ];
  const input = {
    site: "shop",
    op: "search",
    trigger: `${s.base}/shop?q={q}`,
    args: { q: "alice" },
    args2: { q: "bobby" },
    args3: { q: "carol" },
  };
  try {
    const asked: string[] = [];
    const r = await learnSite(
      { ...input, captures: caps() as [string, string] },
      {
        minIntervalMs: 0,
        consent: async (m) => {
          asked.push(m);
          return false;
        },
      },
    );
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.chosen?.method, "GET");
    assert.deepEqual(r.data, [{ name: "alice one" }, { name: "alice two" }]);
    assert.equal(loadSite("shop")!.site.operations[0]!.request.method, "GET");
    assert.ok(
      s.hits.every((h) => h.startsWith("GET /api/search")),
      `only the read reached the site: ${s.hits.join("; ")}`,
    );
    assert.equal(asked.length, 1);
    assert.match(asked[0]!, /me@mail\.example\.com/, "the prompt shows what may be theirs");
    assert.doesNotMatch(asked[0]!, /what you asked/, "no promise the scan cannot keep");
    assert.equal(r.shared?.shared, false);

    // no way to ask: the agent is told to ask, with the same items
    const r2 = await learnSite({ ...input, op: "search2", captures: caps() as [string, string] }, { minIntervalMs: 0 });
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.match(r2.next ?? "", /me@mail\.example\.com.*api-anything publish shop search2 --yes/);

    // the holdout is recorded as learn_site's own check, the one kind an automatic share carries
    assert.deepEqual(loadSite("shop")!.site.operations.find((o) => o.name === "search")!.checks, [
      { args: { q: "carol" }, expect: "result", purpose: HOLDOUT_PURPOSE },
    ]);
  } finally {
    await s.close();
    rmSync(home, { recursive: true, force: true });
  }
});

test("notARead: GET, HEAD and a GraphQL query sent as POST read; a mutation, other methods and a body the caller writes do not", () => {
  const op = (method: string, url: string, body?: string, slots: { param?: string; at: string[] }[] = []) => ({
    request: {
      method,
      url,
      headers: body ? { "content-type": "application/json" } : ({} as Record<string, string>),
      ...(body ? { body } : {}),
    },
    slots,
    params: slots.flatMap((s) => (s.param ? [{ name: s.param, type: "string" as const, required: true }] : [])),
  });
  const query = JSON.stringify({ query: "query Q($q: String) { search(q: $q) { id } }", variables: { q: "x" } });
  assert.equal(notARead(op("GET", "https://a.example.com/api?q=x")), undefined);
  assert.equal(notARead(op("head", "https://a.example.com/api")), undefined);
  assert.equal(notARead(op("POST", "https://a.example.com/graphql", query)), undefined);
  assert.match(
    notARead(
      op("POST", "https://a.example.com/graphql", JSON.stringify({ query: "mutation { like(id: 1) { ok } }" })),
    )!,
    /GraphQL mutation/,
  );
  assert.match(notARead(op("GET", "https://a.example.com/graphql?query=mutation%20%7B%20x%20%7D"))!, /mutation/);
  assert.match(
    notARead(op("POST", "https://a.example.com/api/search", '{"q":"x"}'))!,
    /a POST that is not a GraphQL query/,
  );
  assert.match(notARead(op("DELETE", "https://a.example.com/api/x"))!, /a DELETE/);
  // a persisted query names its document by a hash: it could be a mutation
  const persisted = JSON.stringify({
    operationName: "Q",
    variables: {},
    extensions: { persistedQuery: { sha256Hash: "ab" } },
  });
  assert.match(notARead(op("POST", "https://a.example.com/graphql", persisted))!, /no query document/);
  assert.match(
    notARead(op("POST", "https://a.example.com/graphql", JSON.stringify([JSON.parse(query), JSON.parse(persisted)])))!,
    /no query document/,
    "a batch with one persisted item",
  );
  assert.match(notARead(op("POST", "https://a.example.com/graphql", "operationName=Q&id=12"))!, /no query document/);
  assert.equal(
    notARead(op("GET", `https://a.example.com/graphql?extensions=${encodeURIComponent(persisted)}`)),
    undefined,
  );
  assert.match(
    notARead(op("POST", "https://a.example.com/graphql", query, [{ param: "body", at: ["body"] }]))!,
    /whole body/,
  );
  assert.match(
    notARead(op("POST", "https://a.example.com/graphql", query, [{ param: "doc", at: ["json:/query"] }]))!,
    /GraphQL document/,
  );
});

test("MCP learn_site loads only https pages on a public host; the CLI's learn takes the user's own", async () => {
  const client = new Client({ name: "probe", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  await client.connect(b);
  try {
    for (const trigger of [
      "http://127.0.0.1:8080/s?q={q}",
      "https://localhost/s?q={q}",
      "https://192.168.1.1/s?q={q}",
      "https://[::1]/s?q={q}",
      "http://www.example.com/s?q={q}",
      "https://router.lan/s?q={q}",
    ]) {
      const r = await client.callTool({
        name: "learn_site",
        arguments: { trigger, args: { q: "aaa" }, args2: { q: "bbb" }, args3: { q: "ccc" } },
      });
      const out = JSON.parse((r.content as { text: string }[])[0]!.text);
      assert.equal(r.isError, true, trigger);
      assert.deepEqual([out.ok, out.class], [false, "refused"], trigger);
      assert.match(out.error, /only https pages on a public host/, trigger);
    }
  } finally {
    await client.close();
  }
  // learnSite itself (the CLI's learn) goes on with a localhost trigger: here to the missing captures
  const r = await learnSite({
    trigger: "http://127.0.0.1:1/s?q={q}",
    args: { q: "aaa" },
    args2: { q: "bbb" },
    args3: { q: "ccc" },
    captures: ["none-1", "none-2"],
  });
  assert.match(r.error ?? "", /no capture "none-1"/);
});

test("a new site is named as the registry names it: the name it serves the domain under, else the domain with dots as dashes", async () => {
  process.env.API_ANYTHING_HOME = mkdtempSync(join(tmpdir(), "aa-learn-name-"));
  const reg = await startRegistry();
  const was = process.env.API_ANYTHING_REGISTRY;
  process.env.API_ANYTHING_REGISTRY = reg.url;
  // the registry serves shelfari.com as shelf (as a seed keeps its name), and a lookalike on another domain
  reg.matches = [
    { name: "goodreads-reviews", domain: "example.net", operations: [] },
    { name: "shelf", domain: "shelfari.com", operations: [] },
  ];
  const learn = (trigger: string, site?: string) =>
    learnSite({
      trigger,
      ...(site ? { site } : {}),
      args: { q: "aaa" },
      args2: { q: "bbb" },
      args3: { q: "ccc" },
      captures: ["none-1", "none-2"],
    });
  try {
    await names(reg, learn);
  } finally {
    if (was === undefined) delete process.env.API_ANYTHING_REGISTRY;
    else process.env.API_ANYTHING_REGISTRY = was;
    await reg.close();
  }
});

async function names(
  reg: Awaited<ReturnType<typeof startRegistry>>,
  learn: (trigger: string, site?: string) => ReturnType<typeof learnSite>,
) {
  assert.equal((await learn("https://www.shelfari.com/search?q={q}")).site, "shelf");
  assert.ok(
    reg.received.some((r) => r.path === "/v1/search?q=shelfari.com&limit=10"),
    "the registry was asked for the domain",
  );
  assert.equal((await learn("https://www.crates.io/search?q={q}")).site, "crates-io");
  assert.equal((await learn("https://search.lobste.rs/s?q={q}")).site, "lobste-rs");
  assert.equal(
    (await learn("https://news.ycombinator.com/s?q={q}")).site,
    "hacker-news",
    "a site this machine has on that host",
  );
  assert.equal((await learn("https://docs.example.co.uk/s?q={q}")).site, "example-co-uk");
  // a name the user gives is theirs: shareOps uploads it under the registry's name
  assert.equal((await learn("https://crates.io/search?q={q}", "rust")).site, "rust");
  // a local trigger is never shared, so the registry is not asked about it
  const asked = reg.received.length;
  await learn("http://127.0.0.1:1/s?q={q}");
  assert.equal(reg.received.length, asked);
}

test("a learn_site still running at the deadline answers with a job, and its result comes with structuredContent", async () => {
  const home = mkdtempSync(join(tmpdir(), "aa-learn-job-"));
  process.env.API_ANYTHING_HOME = home;
  // the holdout call (args3) takes longer than the server's deadline
  const s = await site({ q: ["carol"], ms: 600 });
  hooks.share = async () => [];
  learnTool.publicOnly = false;
  const client = new Client({ name: "probe", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer({ waitMs: 150 }).connect(a);
  await client.connect(b);
  try {
    const read = { method: "GET", path: "/api/search?q={q}", answer: items };
    const first = await client.callTool({
      name: "learn_site",
      arguments: {
        site: "shop",
        op: "lookup",
        trigger: `${s.base}/shop?q={q}`,
        args: { q: "alice" },
        args2: { q: "bobby" },
        args3: { q: "carol" },
        captures: [capture(home, "ja", s.base, "alice", [read]), capture(home, "jb", s.base, "bobby", [read])],
        pickRequest: 2,
        extract: "items",
      },
    });
    const pending = first.structuredContent as { class: string; job: string };
    assert.equal(pending.class, "pending", JSON.stringify(first));
    let done = pending as { class: string; job: string; ok?: boolean };
    while (done.class === "pending")
      done = (await client.callTool({ name: "get_job", arguments: { job: pending.job } }))
        .structuredContent as typeof done;
    assert.equal(done.ok, true, JSON.stringify(done));
    assert.ok(loadSite("shop")?.site.operations.some((o) => o.name === "lookup"));
  } finally {
    learnTool.publicOnly = true;
    await client.close();
    await s.close();
    rmSync(home, { recursive: true, force: true });
  }
});
