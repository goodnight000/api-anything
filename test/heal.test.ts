/**
 * Heal edge cases against small local servers: which args a recapture learns from, what a failed
 * heal leaves behind, what validates a candidate, and that call() never throws.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { chromeAvailable, closeBrowser } from "../src/browser.js";
import { call } from "../src/execute.js";
import { addOperation } from "../src/heal.js";
import { parseSite } from "../src/spec.js";
import { loadSite, saveSite, staleMark } from "../src/store.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-heal-"));
process.env.API_ANYTHING_HOME = HOME;
const fast = { minIntervalMs: 0 };

async function serve(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; base: string }> {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe("heal", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  const servers: Server[] = [];
  after(async () => {
    await closeBrowser();
    for (const s of servers) {
      s.closeAllConnections();
      s.close();
    }
    rmSync(HOME, { recursive: true, force: true });
  });

  // A search API that renames q -> term after a deploy; the page JS follows along.
  let version = "v1";
  let pageLoads = 0;
  const search = () =>
    serve((req, res) => {
      const u = new URL(req.url!, "http://x");
      const key = version === "v1" ? "q" : version === "v2" ? "term" : "gone";
      if (u.pathname.startsWith("/api/")) {
        if (!u.searchParams.has(key))
          return void res.writeHead(400, { "content-type": "application/json" }).end('{"error":"unknown argument"}');
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(
          JSON.stringify({ results: [{ q: u.searchParams.get(key), page: u.searchParams.get("page") }, { q: "x" }] }),
        );
      }
      pageLoads++;
      res.writeHead(200, { "content-type": "text/html" });
      if (version === "v3") return void res.end("<html><body>search is down</body></html>");
      res.end(`<html><body><script>const p=new URLSearchParams(location.search);
fetch("/api/search?${key}="+encodeURIComponent(p.get("q"))+"&page="+encodeURIComponent(p.get("page")||"1"))</script></body></html>`);
    });

  test("recapture with an omitted optional arg keeps every param's slot (defaults filled)", async () => {
    const { server, base } = await search();
    servers.push(server);
    version = "v1";
    await addOperation({
      site: "s1",
      op: "search",
      trigger: { url: `${base}/s?q={q}&page={page}` },
      examples: [
        { q: "hello", page: "100" },
        { q: "world", page: "200" },
      ],
      response: { extract: "results" },
    });
    const site = loadSite("s1")!.site;
    site.operations[0]!.params[1] = { ...site.operations[0]!.params[1]!, required: false, default: "100" };
    saveSite(site);
    version = "v2";
    const r = await call("s1", "search", { q: "cats" }, fast);
    assert.equal(r.healed, true, JSON.stringify(r));
    const op = loadSite("s1")!.site.operations[0]!;
    assert.deepEqual([...new Set(op.slots.flatMap((s) => (s.param ? [s.param] : [])))].sort(), ["page", "q"]);
    const later = await call("s1", "search", { q: "dogs", page: "250" }, fast);
    assert.deepEqual((later.data as unknown[])[0], { q: "dogs", page: "250" });
  });

  test("recapture with a short arg (page=2) learns from the op's examples instead", async () => {
    const { server, base } = await search();
    servers.push(server);
    version = "v1";
    await addOperation({
      site: "s2",
      op: "search",
      trigger: { url: `${base}/s?q={q}&page={page}` },
      examples: [
        { q: "hello", page: "100" },
        { q: "world", page: "200" },
      ],
      response: { extract: "results" },
    });
    version = "v2";
    const r = await call("s2", "search", { q: "cats", page: "2" }, fast);
    assert.equal(r.healed, true, JSON.stringify(r));
    assert.deepEqual((r.data as unknown[])[0], { q: "cats", page: "2" });
  });

  test("a failed heal marks the op stale, so the next call skips the browser", async () => {
    const { server, base } = await search();
    servers.push(server);
    version = "v2";
    await addOperation({
      site: "s3",
      op: "search",
      trigger: { url: `${base}/s?q={q}&page={page}` },
      examples: [
        { q: "hello", page: "100" },
        { q: "world", page: "200" },
      ],
      response: { extract: "results" },
    });
    version = "v3"; // the page no longer fires the request: nothing can heal
    const loads = pageLoads;
    const failed = await call("s3", "search", { q: "cats", page: "3" }, fast);
    assert.equal(failed.ok, false);
    assert.match(failed.reason ?? "", /heal failed/);
    assert.ok(staleMark("s3", "search"), "a failed heal leaves a stale mark");
    const between = pageLoads;
    const again = await call("s3", "search", { q: "cats", page: "4" }, fast);
    assert.equal(again.ok, false);
    assert.match(again.reason ?? "", /stale/);
    assert.ok(between > loads);
    assert.equal(pageLoads, between, "no browser run while stale (the trigger never answered either)");
  });

  test("a tier-3 op's heal candidate is validated by replaying it, not by rerunning the site's trigger", async () => {
    const QID = "Aa1Bb2Cc3Dd4Ee5Ff6Gg7H";
    const DECOY = "Qq1Rr2Ss3Tt4Uu5Vv6Ww7X";
    const apiPaths: string[] = [];
    let n = 0;
    const { server, base } = await serve((req, res) => {
      const u = new URL(req.url!, "http://x");
      if (u.pathname.startsWith("/api/")) {
        apiPaths.push(u.pathname);
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(JSON.stringify(n++ === 0 ? { hiccup: true } : { user: { name: "bob" } }));
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<html><body><script>var unrelated={id:"${DECOY}",operationName:"User"};
fetch("/api/"+"${QID.slice(0, 11)}"+"${QID.slice(11)}"+"/User?name="+location.pathname.split("/")[2]);</script></body></html>`);
    });
    servers.push(server);
    saveSite(
      parseSite({
        name: "m",
        baseUrl: base,
        operations: [
          {
            name: "user",
            readOnly: true,
            minTier: 3,
            request: { method: "GET", url: `${base}/api/${QID}/User?name=alice`, headers: {} },
            slots: [{ param: "name", at: ["query:name"] }],
            volatile: [{ at: ["path:1"], shape: { charset: "base64url", length: 22 }, anchor: "User" }],
            trigger: { url: `${base}/u/{name}` },
            match: { method: "GET", path: "/api/*/User" },
            params: [{ name: "name" }],
            response: { extract: "user" },
          },
        ],
      }),
    );
    await call("m", "user", { name: "bob" }, fast);
    assert.ok(apiPaths.includes(`/api/${DECOY}/User`), `the candidate itself was sent: ${JSON.stringify(apiPaths)}`);
  });

  test("call() never throws when the heal's browser run fails", async () => {
    saveSite(
      parseSite({
        name: "d",
        baseUrl: "http://127.0.0.1:9",
        operations: [
          {
            name: "get",
            readOnly: true,
            request: { method: "GET", url: "http://api.d.test/v1/thing?q=abc", headers: {} },
            slots: [{ param: "q", at: ["query:q"] }],
            trigger: { url: "http://127.0.0.1:9/page?q={q}" },
            params: [{ name: "q" }],
          },
        ],
      }),
    );
    const fetchImpl = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const r = await call("d", "get", { q: "abc" }, { ...fast, fetchImpl });
    assert.equal(r.ok, false);
    assert.equal(r.class, "drift");
    assert.match(r.reason ?? "", /heal failed/);
  });
});
