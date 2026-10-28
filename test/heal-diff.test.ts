/**
 * A heal shows its work: the call says how and what changed in the template, the heal log keeps the
 * op as it was, `heals` lists it and `revert` puts it back. The offline fixture, maxTier 1 (rescan).
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { call } from "../src/execute.js";
import { revertHeal } from "../src/heal.js";
import { saveSession } from "../src/session.js";
import { type Operation, parseSite } from "../src/spec.js";
import { appendHeal, loadHeals, loadSite, saveSite, templateHash } from "../src/store.js";
import { type Fixture, PUBLIC_BEARER, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-heal-diff-"));
process.env.API_ANYTHING_HOME = HOME;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CT0 = "c0ffeec0ffeec0ffeec0ffeec0ffee00";
const t1 = { maxTier: 1 as const, minIntervalMs: 0 };

let fx: Fixture;
before(async () => (fx = await startFixture()));
after(async () => {
  await fx.close();
  rmSync(HOME, { recursive: true, force: true });
});

const getUser = (): Operation =>
  parseSite({
    name: "fx",
    baseUrl: fx.url,
    operations: [
      {
        name: "getUser",
        readOnly: true,
        request: {
          method: "GET",
          url: `${fx.url}/api/graphql/${fx.state.userQueryId}/UserByName?variables=${encodeURIComponent('{"name":"alice","withExtras":true}')}`,
          headers: { "x-csrf-token": "", "x-app-version": "2026.09.27-a1b2c3", authorization: PUBLIC_BEARER },
        },
        slots: [
          { param: "name", at: ["query:variables", "json:/name"] },
          { ref: "cookie:ct0", at: ["header:x-csrf-token"] },
        ],
        volatile: [{ at: ["path:2"], shape: { charset: "base64url", length: 22 }, anchor: "UserByName" }],
        trigger: { url: `${fx.url}/u/{name}` },
        params: [{ name: "name", example: "alice" }],
        public: ["authorization"],
        response: { extract: "data.user", pick: ["name", "followers"] },
      },
    ],
  }).operations[0]!;

/** the op as saved before the test's rotate */
let first: Operation;
beforeEach(() => {
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  rmSync(join(HOME, "state.json"), { force: true });
  first = getUser();
  saveSite(parseSite({ name: "fx", baseUrl: fx.url, operations: [first] }));
  saveSession("fx", {
    cookies: [{ name: "ct0", value: CT0, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false }],
    values: {},
  });
});

const cli = (...args: string[]) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args],
      { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    ),
  );

test("a heal says what changed in the template; revert puts the op back as it was", async () => {
  const old = fx.state.userQueryId;
  assert.equal((await call("fx", "getUser", { name: "carol" }, t1)).ok, true);
  fx.rotate();
  const r = await call("fx", "getUser", { name: "dave" }, t1);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.healed, true);
  assert.deepEqual(r.heal, {
    strategy: "rescan",
    changes: [`path: /api/graphql/${old}/UserByName -> /api/graphql/${fx.state.userQueryId}/UserByName`],
  });

  const [logged] = loadHeals("fx");
  assert.deepEqual(logged!.changes, r.heal!.changes);
  assert.equal(logged!.previous!.request.url, first.request.url, "the log keeps the op as it was");
  assert.ok(!JSON.stringify(loadHeals()).includes(CT0), "no live cookie value in the heal log");

  const back = revertHeal("fx", "getUser");
  assert.deepEqual(back.changes, [
    `path: /api/graphql/${fx.state.userQueryId}/UserByName -> /api/graphql/${old}/UserByName`,
  ]);
  const op = loadSite("fx")!.site.operations[0]!;
  assert.deepEqual(op.request, first.request);
  assert.deepEqual(op.slots, first.slots);
  assert.deepEqual(
    loadHeals("fx").map((h) => h.strategy),
    ["rescan", "revert"],
  );
  assert.throws(() => revertHeal("fx", "getUser"), /has no heal to revert/);
});

test("a recapture-style change names each leaf: header, query and the slot that moved, refs not values", async () => {
  const a = first;
  const b: Operation = {
    ...a,
    request: {
      ...a.request,
      url: a.request.url.replace("UserByName?", "UserByName?lang=en&"),
      headers: { ...a.request.headers, "x-app-version": "2026.10.01-ffffff", "x-client": "web" },
    },
  };
  const { templateChanges } = await import("../src/heal.js");
  assert.deepEqual(templateChanges(a, b), [
    'header:x-app-version: "2026.09.27-a1b2c3" -> "2026.10.01-ffffff"',
    'query:lang: added "en"',
    'header:x-client: added "web"',
  ]);
  const moved: Operation = {
    ...a,
    request: { ...a.request, url: `${a.request.url}&user=alice` },
    slots: [{ param: "name", at: ["query:user"] }, a.slots[1]!],
  };
  assert.deepEqual(templateChanges(a, moved), [
    'query:variables > json:/name: "{name}" -> "alice"',
    'query:user: added "{name}"',
  ]);
});

test("revert refuses an op changed after its heal, and one with no heal kept", async () => {
  fx.rotate();
  assert.equal((await call("fx", "getUser", { name: "erin" }, t1)).healed, true);
  const site = loadSite("fx")!.site;
  // learned again (or edited) after the heal: reverting would undo that
  saveSite({
    ...site,
    operations: [{ ...site.operations[0]!, request: { ...site.operations[0]!.request, headers: {} } }],
  });
  assert.throws(() => revertHeal("fx", "getUser"), /changed after its last heal/);
  assert.throws(() => revertHeal("fx", "nope"), /no operation "nope"/);
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  assert.throws(() => revertHeal("fx", "getUser"), /has no heal to revert/);
});

test("revert on a pulled spec's user copy keeps its shared record and gives the op back its version", () => {
  const pulled = parseSite({
    name: "news",
    baseUrl: "https://news.example.com",
    shared: { from: "https://registry.example/v1/sites/news", sha256: "0".repeat(64) },
    operations: [
      {
        name: "top",
        readOnly: true,
        request: { method: "GET", url: "https://news.example.com/api/v1/top?n=10", headers: {} },
        slots: [{ param: "n", at: ["query:n"] }],
        trigger: { url: "https://news.example.com/top" },
        match: { method: "GET", host: "news.example.com", path: "/api/*/top" },
        params: [{ name: "n", example: "10" }],
        version: { hash: "abc123", status: "approved" },
      },
    ],
  });
  const was = pulled.operations[0]!;
  const { version: _v, ...healed } = { ...was, request: { ...was.request, url: was.request.url.replace("v1", "v2") } };
  saveSite({ ...pulled, operations: [healed] });
  appendHeal({ site: "news", op: "top", strategy: "recapture", diff: "", previous: was, saved: templateHash(healed) });
  const r = revertHeal("news", "top");
  assert.deepEqual(r.changes, ["path: /api/v2/top -> /api/v1/top"]);
  const now = loadSite("news")!;
  assert.equal(now.source, "user");
  assert.deepEqual(now.site.shared, pulled.shared);
  assert.deepEqual(now.site.operations[0], was);
});

test("CLI: call prints the heal and how to undo it; heals lists it; revert takes it back", async () => {
  fx.rotate();
  const healed = await cli("call", "fx", "getUser", "name=frank", "--max-tier", "1");
  assert.equal(healed.code, 0, healed.stderr);
  assert.equal(JSON.parse(healed.stdout).heal.strategy, "rescan");
  assert.match(
    healed.stderr,
    /healed getUser by rescan:\n {2}path: \/api\/graphql\/.+\nundo: api-anything revert fx getUser/,
  );

  const listed = JSON.parse((await cli("heals", "fx")).stdout);
  assert.equal(listed.heals.length, 1);
  assert.equal(listed.heals[0].op, "getUser");
  assert.match(listed.heals[0].changes[0], /^path: /);
  assert.equal(listed.heals[0].previous, undefined, "the list is short: no stored op");

  const reverted = await cli("revert", "fx", "getUser");
  assert.equal(reverted.code, 0, reverted.stderr);
  assert.equal(JSON.parse(reverted.stdout).reverted.strategy, "rescan");
  assert.deepEqual(loadSite("fx")!.site.operations[0]!.request, first.request);
  const again = await cli("revert", "fx", "getUser");
  assert.equal(again.code, 1);
  assert.match(again.stdout + again.stderr, /has no heal to revert/);
});
