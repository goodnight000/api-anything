/**
 * End to end against the offline fixture site, in a temp SITE2API_HOME, through the public
 * entry points: addOperation (what `site2api add` runs), call, the CLI, and the MCP server.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromeAvailable, closeBrowser, openBrowser, runTrigger } from "../src/browser.js";
import { call } from "../src/execute.js";
import { addOperation, profileDir } from "../src/heal.js";
import { loadSession, saveSession } from "../src/session.js";
import { staleMark } from "../src/store.js";
import { startFixture, type Fixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "site2api-e2e-"));
process.env.SITE2API_HOME = HOME;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src", "cli.ts");
const SITE = "fixture";
const fast = { minIntervalMs: 0 };

const heals = (): { op: string; strategy: string }[] => {
  try {
    return readFileSync(join(HOME, "heals.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};
const specFile = () => join(HOME, "sites", `${SITE}.json`);

function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  // async on purpose: the fixture server lives in this process and must keep answering
  return new Promise((resolve) =>
    execFile(process.execPath, ["--import", "tsx", CLI, ...args], { cwd: ROOT, env: { ...process.env, SITE2API_HOME: HOME } }, (err, stdout, stderr) =>
      resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    ),
  );
}

describe("e2e", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(async () => {
    await closeBrowser();
    await fx.close();
    rmSync(HOME, { recursive: true, force: true });
  });

  test("1. add getUser from /u/{name} with two examples; call it for a new name at tier 1", async () => {
    const r = await addOperation({
      site: SITE,
      op: "getUser",
      trigger: { url: `${fx.url}/u/{name}` },
      examples: [{ name: "alice" }, { name: "bob" }],
      response: { extract: "data.user", pick: ["name", "followers", "posts[0].text"] },
    });
    assert.equal(r.operation.minTier, 1, r.warnings.join("\n"));
    assert.deepEqual(r.operation.match, { method: "GET", host: "127.0.0.1", path: "/api/graphql/*/UserByName" });
    assert.deepEqual(r.operation.volatile.map((v) => v.anchor), ["UserByName"]);

    const res = await call(SITE, "getUser", { name: "carol" }, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.tier, 1);
    assert.deepEqual(res.data, { name: "carol", followers: 500, "posts[0].text": "hello from carol" });

    const ct0 = loadSession(SITE).cookies.find((c) => c.name === "ct0");
    assert.ok(ct0, "the jar holds the CSRF cookie");
    assert.ok(!readFileSync(specFile(), "utf8").includes(ct0.value), "the spec never holds a credential");
  });

  test("2. after rotate() the call heals by rescan (no browser) and logs it", async () => {
    fx.rotate();
    const res = await call(SITE, "getUser", { name: "dave" }, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.healed, true);
    assert.equal(res.tier, 1);
    assert.deepEqual(heals().map((h) => [h.op, h.strategy]), [["getUser", "rescan"]]);
    assert.ok(readFileSync(specFile(), "utf8").includes(fx.state.userQueryId));
  });

  test("3. heal-loop guard, then a heal by recapture when rescan cannot work", async () => {
    await addOperation({ site: SITE, op: "getUser2", trigger: { url: `${fx.url}/u/{name}` }, examples: [{ name: "alice" }, { name: "bob" }] });
    const spec = JSON.parse(readFileSync(specFile(), "utf8"));
    for (const v of spec.operations.find((o: { name: string }) => o.name === "getUser2").volatile) v.anchor = "NoSuchAnchor";
    writeFileSync(specFile(), JSON.stringify(spec));
    fx.rotate();

    // getUser healed minutes ago: drifting again marks it stale instead of re-healing; the read still answers via the trigger.
    const guarded = await call(SITE, "getUser", { name: "erin" }, fast);
    assert.equal(guarded.ok, true, JSON.stringify(guarded));
    assert.equal(guarded.tier, 3);
    assert.equal(guarded.healed, undefined);
    assert.ok(staleMark(SITE, "getUser"));
    assert.equal(heals().length, 1);

    const res = await call(SITE, "getUser2", { name: "frank" }, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.healed, true);
    assert.deepEqual(heals().at(-1), { ...heals().at(-1), op: "getUser2", strategy: "recapture" });
    const again = await call(SITE, "getUser2", { name: "grace" }, fast);
    assert.equal(again.tier, 1, "the healed template replays at tier 1");
  });

  test("4. a write is learned without being performed and runs only with allowWrites, exactly once", async () => {
    const writes = () => fx.calls.filter((c) => c.path.includes("/CreatePost")).length;
    const r = await addOperation({
      site: SITE,
      op: "createPost",
      trigger: { url: `${fx.url}/compose`, steps: [{ action: "fill", selector: "#text", value: "{text}" }, { action: "click", selector: "#post" }] },
      examples: [{ text: "first draft here" }, { text: "second draft here" }],
      write: true,
    });
    assert.equal(r.operation.readOnly, false);
    assert.equal(writes(), 0, "learning sent no write");

    const refused = await call(SITE, "createPost", { text: "not allowed" }, fast);
    assert.equal(refused.class, "refused");
    assert.equal(writes(), 0);

    const res = await call(SITE, "createPost", { text: "hello from site2api" }, { ...fast, allowWrites: true });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(writes(), 1);
    assert.match(JSON.stringify(res.data), /hello from site2api/);
  });

  test("5. a per-request signature pins the op to tier 3, which answers through the trigger", async () => {
    fx.setRequireSignature(true);
    const r = await addOperation({ site: SITE, op: "feed", trigger: { url: `${fx.url}/feed` }, examples: [{}], match: { path: "/api/signed/feed" } });
    assert.equal(r.operation.minTier, 3, r.warnings.join("\n"));
    const res = await call(SITE, "feed", {}, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.tier, 3);
    assert.deepEqual(res.data, [{ id: "f1", text: "first" }, { id: "f2", text: "second" }]);
  });

  test("6. a login wall served as 200 HTML is auth, with a login hint", async () => {
    await runTrigger({ url: `${fx.url}/login`, profileDir: profileDir() }); // stands in for `site2api login`
    await addOperation({ site: SITE, op: "secret", trigger: { url: `${fx.url}/private` }, examples: [{}], match: { path: "/private" } });
    assert.deepEqual((await call(SITE, "secret", {}, fast)).data, { data: { secret: "only for you" } });

    // log out everywhere: the profile and the jar
    await (await openBrowser({ profileDir: profileDir() })).clearCookies();
    saveSession(SITE, { cookies: [], values: {} });
    const res = await call(SITE, "secret", {}, fast);
    assert.equal(res.ok, false);
    assert.equal(res.class, "auth", JSON.stringify(res));
    assert.match(res.next ?? "", /site2api login fixture/);
  });

  test("7. a rate limit is reported as rate, with no heal and no retry (via the CLI)", async () => {
    await addOperation({ site: SITE, op: "limited", trigger: { url: `${fx.url}/api/limited` }, examples: [{}], match: { path: "/api/limited" } });
    const hits = () => fx.calls.filter((c) => c.path === "/api/limited").length;
    const before = hits();
    const healCount = heals().length;
    const r = await cli("call", SITE, "limited");
    assert.equal(r.code, 1);
    const res = JSON.parse(r.stdout);
    assert.equal(res.class, "rate");
    assert.match(r.stderr, /^next: rate limited/m);
    assert.equal(hits(), before + 1);
    assert.equal(heals().length, healCount);
  });

  test("8. layered f.req form encoding with the XSSI prefix works for a new query", async () => {
    const r = await addOperation({ site: SITE, op: "search", trigger: { url: `${fx.url}/search?q={q}` }, examples: [{ q: "kittens" }, { q: "puppies" }] });
    assert.ok(r.operation.slots.some((s) => s.param === "q" && s.at[0] === "form:f.req" && s.at.length === 3), JSON.stringify(r.operation.slots));
    assert.equal(r.operation.response.xssiPrefix, ")]}'");
    const res = await call(SITE, "search", { q: 'red "pandas" & co' }, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(r.operation.response.extract, "[0][2][0]", "the suggestion steps into the JSON-encoded payload");
    assert.deepEqual((res.data as string[][])[0], ['red "pandas" & co result 1', "https://example.test/red%20%22pandas%22%20%26%20co/1"]);
  });

  test("9. the html recipe on a server-rendered list returns picked items", async () => {
    await addOperation({
      site: SITE,
      op: "listUsers",
      trigger: { url: `${fx.url}/list` },
      examples: [{}],
      match: { path: "/list" },
      response: { html: { items: "li.user", fields: { name: "a.name", followers: "span.followers", href: "a.name@href" } }, pick: ["name", "href"] },
    });
    const res = await call(SITE, "listUsers", {}, fast);
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.data, [
      { name: "alice", href: "/u/alice" },
      { name: "bob", href: "/u/bob" },
      { name: "carol", href: "/u/carol" },
    ]);
  });

  test("10. the MCP server lists 3 meta-tools, calls reads, and hides and refuses writes", async () => {
    const client = new Client({ name: "e2e", version: "0" });
    await client.connect(
      new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", CLI, "mcp"], cwd: ROOT, env: { ...process.env, SITE2API_HOME: HOME } as Record<string, string> }),
    );
    try {
      const tools = await client.listTools();
      assert.deepEqual(tools.tools.map((t) => t.name).sort(), ["call_operation", "list_operations", "list_sites"]);
      assert.equal(tools.tools.find((t) => t.name === "call_operation")?.annotations?.readOnlyHint, true);

      const text = (r: Awaited<ReturnType<typeof client.callTool>>) => JSON.parse((r.content as { text: string }[])[0]!.text);
      const ops = text(await client.callTool({ name: "list_operations", arguments: { site: SITE } }));
      assert.ok(ops.operations.some((o: { name: string }) => o.name === "search"));
      assert.ok(!ops.operations.some((o: { name: string }) => o.name === "createPost"), "writes are hidden");

      const ok = await client.callTool({ name: "call_operation", arguments: { site: SITE, op: "search", args: { q: "otters" } } });
      assert.ok(!ok.isError, JSON.stringify(ok));
      assert.ok(JSON.stringify(text(ok).data).includes("otters result 1"));

      const refused = await client.callTool({ name: "call_operation", arguments: { site: SITE, op: "createPost", args: { text: "nope" } } });
      assert.equal(refused.isError, true);
      assert.equal(text(refused).class, "refused");
    } finally {
      await client.close();
    }
  });
});
