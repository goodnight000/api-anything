import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { chromeAvailable, closeBrowser } from "../src/browser.js";
import { call } from "../src/execute.js";
import { addOperation, healOperation, runOpTrigger, type CaptureFile } from "../src/heal.js";
import { buildRequest, send } from "../src/http.js";
import { learnOperation } from "../src/learn.js";
import { judge } from "../src/classify.js";
import { parseSite } from "../src/spec.js";
import { loadSession } from "../src/session.js";
import { loadSite, saveSite } from "../src/store.js";
import type { Exchange } from "../src/types.js";

const home = mkdtempSync(join(tmpdir(), "api-anything-release-"));
process.env.API_ANYTHING_HOME = home;
after(async () => { await closeBrowser(); rmSync(home, { recursive: true, force: true }); });
const A = "Zx81kLmN0pQrStUv2wXyZ3aBcD";
const B = "Ys92jKnM1qRsTuVw3xYzA4bCdE";
const exchange = (id: number, body: unknown, response: unknown): Exchange => ({
  id, resourceType: "fetch",
  request: { method: "POST", url: "https://site.test/api", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  response: { status: 200, headers: {}, contentType: "application/json", body: JSON.stringify(response) },
});
const learned = (body: unknown, name = "search") => learnOperation({
  exchanges: [exchange(1, {}, { a: A, b: B }), exchange(2, body, { results: ["kittens"] })],
  examples: [{ q: "kittens" }], cookies: [], name, trigger: { url: "https://site.test/?q={q}" }, readOnly: true,
});

test("distinct issued tokens survive learn and replay, including another operation's session values", () => {
  const body = { q: "kittens", one: { v: A }, two: { v: B } };
  const first = learned(body);
  const other = learned({ q: "kittens", one: { v: B }, two: { v: A } }, "other");
  const session = { cookies: [], values: { ...first.sessionValues, ...other.sessionValues } };
  assert.deepEqual(JSON.parse(buildRequest(first.operation, { q: "kittens" }, session).body!), body);
  assert.deepEqual(JSON.parse(buildRequest(other.operation, { q: "puppies" }, session).body!), { q: "puppies", one: { v: B }, two: { v: A } });
});

test("issued credentials are removed from every compound copy and refresh on replay", () => {
  const body = { q: "kittens", t: A, ctx: `prefix:${A}`, both: `${A}:${B}`, other: B, next: `https://site.test/?q=kittens&t=${A}` };
  const l = learned(body);
  for (const token of [A, B]) assert.ok(!JSON.stringify(l.operation).includes(token), "credential in serialized operation");
  const values = Object.fromEntries(Object.entries(l.sessionValues).map(([k, v]) => [k, v === A ? "fresh-A" : "fresh-B"]));
  const replay = JSON.parse(buildRequest(l.operation, { q: "puppies" }, { cookies: [], values }).body!);
  assert.deepEqual(replay, { q: "puppies", t: "fresh-A", ctx: "prefix:fresh-A", both: "fresh-A:fresh-B", other: "fresh-B", next: "https://site.test/?q=puppies&t=fresh-A" });
});

test("add refuses to save a spec containing a credential it cannot remove", async () => {
  const token = "secret123"; // shorter than compound-token templating supports
  const e = exchange(1, { q: "kittens", ctx: `prefix:${token}` }, { results: ["kittens"] });
  const capture: CaptureFile = { id: "test", at: new Date().toISOString(), url: "https://site.test/?q=kittens", finalUrl: "https://site.test/?q=kittens", exchanges: [e], cookies: [{ name: "session", value: token, domain: "site.test", path: "/", expires: -1, httpOnly: true, secure: true }] };
  await assert.rejects(addOperation({ site: "secret", op: "search", examples: [{ q: "kittens" }], from: { capture, id: 1 } }), /credential/i);
  assert.equal(loadSite("secret"), undefined);
});

test("browser execution and failed-heal fallback never accept data for different arguments", { skip: !chromeAvailable(), timeout: 45_000 }, async () => {
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname === "/page") {
      res.writeHead(200, { "content-type": "text/html" });
      const actual = url.searchParams.get("actual") ?? "kittens";
      res.end(`<html><script>fetch("/api?${actual === "moved" ? "search=puppies2" : `q=${actual}`}&end=2027-05-31")</script></html>`);
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ items: [{ q: url.searchParams.get("q"), end: url.searchParams.get("end") }] }));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    for (const actual of ["kittens", "puppies2", "moved"]) {
    for (const minTier of [3, 1] as const) {
      const site = `fallback-${minTier}-${actual}`;
      saveSite(parseSite({ name: site, baseUrl: base, operations: [{ name: "search", readOnly: true, minTier,
        request: { method: "GET", url: `${base}/api?q=kittens&end=2027-04-30`, headers: {} },
        params: [{ name: "q", example: "kittens" }, { name: "end", example: "2027-04-30" }],
        slots: [{ param: "q", at: ["query:q"] }, { param: "end", at: ["query:end"] }],
        trigger: { url: `${base}/page?actual=${actual}&q={q}&end={end}` }, match: { path: "/api" }, response: { format: "json", extract: "items" },
      }] }));
      const r = await call(site, "search", { q: "puppies", end: "2027-05-31" }, { minIntervalMs: 0, fetchImpl: async () => new Response('{"wrong":true}', { headers: { "content-type": "application/json" } }) });
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.equal(r.data, undefined);
      if (actual !== "kittens" && minTier === 1) {
        let validated = false;
        const h = await healOperation(site, loadSite(site)!.site.operations[0]!, { q: "puppies", end: "2027-05-31" }, { validate: async () => {
          validated = true; return { tier: 1, class: "ok", reason: "accepted", data: ["puppies2"] };
        } });
        assert.equal(validated, false, "must not validate a candidate that changes existing arg meaning");
        assert.equal(h.outcome, "failed");
      }
    }
    }
  } finally {
    await closeBrowser();
    await new Promise<void>((r) => server.close(() => r()));
  }
});


test("a write rejected inside an HTTP 200 response is not success and is never retried", async () => {
  const site = parseSite({ name: "rejected-write", baseUrl: "https://site.test", operations: [{ name: "send", readOnly: false,
    request: { method: "POST", url: "https://site.test/send", headers: {}, body: "{}" }, trigger: { url: "https://site.test/compose" },
  }] });
  saveSite(site);
  for (const format of ["json", "html", "embedded"] as const) {
  site.operations[0]!.response = { format };
  saveSite(site);
  for (const payload of [{ ok: false, error: "recipient unavailable" }, { success: false, message: "not permitted" }]) {
    let sent = 0;
    const result = await call(site.name, "send", {}, { allowWrites: true, minIntervalMs: 0, fetchImpl: async () => {
      sent++; return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    } });
    assert.equal(result.ok, false);
    assert.equal(sent, 1);
  }
  }
  site.operations[0]!.response = { format: "json", extract: "receipt.id" };
  assert.equal(judge(site.operations[0]!, { status: 200, headers: {}, body: '{"accepted":true}' }).class, "ok");
  assert.equal(judge(site.operations[0]!, { status: 204, headers: {}, body: "" }).class, "ok");
});

test("a learned message operation generalizes recipients and content without sending while learning", { skip: !chromeAvailable(), timeout: 45_000 }, async () => {
  const messages: unknown[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === "/compose") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<html><input id="recipient"><textarea id="text"></textarea><button id="send">Send</button><script>
        document.querySelector('#send').onclick = () => fetch('/send', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({recipient:document.querySelector('#recipient').value,text:document.querySelector('#text').value})});
        </script></html>`);
    } else {
      let body = "";
      for await (const chunk of req) body += chunk;
      messages.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ id: messages.length }));
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    await addOperation({ site: "messages", op: "send", write: true, match: { path: "/send" },
      trigger: { url: `${base}/compose`, steps: [{ action: "fill", selector: "#recipient", value: "{recipient}" }, { action: "fill", selector: "#text", value: "{text}" }, { action: "click", selector: "#send" }] },
      examples: [{ recipient: "alice-123", text: "first draft" }, { recipient: "bobby-456", text: "second draft" }],
    });
    assert.equal(messages.length, 0);
    const args = [{ recipient: "carol-789", text: "Hello Carol & team" }, { recipient: "david-012", text: 'Hello "David"' }];
    assert.equal((await call("messages", "send", args[0]!)).class, "refused");
    for (const a of args) assert.equal((await call("messages", "send", a, { allowWrites: true, maxTier: 1, minIntervalMs: 0 })).ok, true);
    assert.deepEqual(messages, args);
  } finally {
    await closeBrowser(); await new Promise<void>((r) => server.close(() => r()));
  }
});


test("compound-only credentials all replay, refresh and stay on their origin", { skip: !chromeAvailable(), timeout: 45_000 }, async () => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/page")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<script>fetch('/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({q:'kittens',ctx:'prefix:fresh-A:fresh-B'})})</script>`);
    } else {
      res.writeHead(200, { "content-type": "application/json" }); res.end('{"results":["kittens"]}');
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const e = exchange(1, { q: "kittens", ctx: `prefix:${A}:${B}` }, { results: ["kittens"] });
    e.request.url = `${base}/api`;
    const learned = learnOperation({ exchanges: [e], examples: [{ q: "kittens" }], cookies: [], storage: { one: A, two: B }, name: "search", trigger: { url: `${base}/page?q={q}` }, readOnly: true });
    const { operation } = learned;
    const session = { cookies: [], values: learned.sessionValues };
    assert.deepEqual(JSON.parse(buildRequest(operation, { q: "puppies" }, session).body!), { q: "puppies", ctx: `prefix:${A}:${B}` });
    let sends = 0;
    await assert.rejects(send(operation, { q: "kittens" }, session, { site: "compound", minIntervalMs: 0, fetchImpl: async () => {
      sends++; return new Response(null, { status: 302, headers: { location: `https://other.test/?token=${B}` } });
    } }), /another origin/);
    assert.equal(sends, 1);
    assert.ok((await runOpTrigger("compound", operation, { q: "kittens" })).matched);
    assert.deepEqual(JSON.parse(buildRequest(operation, { q: "puppies" }, loadSession("compound")).body!), { q: "puppies", ctx: "prefix:fresh-A:fresh-B" });
  } finally {
    await closeBrowser(); await new Promise<void>((r) => server.close(() => r()));
  }
});
