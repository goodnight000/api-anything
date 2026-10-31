/**
 * `verify` as an unattended job meets it: a stale read heals, each case remembers when its outcome
 * began, a read with no login to run with is skipped, and a write gets a preflight in place of a send.
 * An injected fetch and maxTier 1: no browser, no network.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { loadRecord, type Preflight, verifySite } from "../src/checks.js";
import { call } from "../src/execute.js";
import { saveSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { beginWrite, markStale, saveSite, settleWrite, staleMark } from "../src/store.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-checks-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const QID = "Aa1Bb2Cc3Dd4Ee5Ff6Gg7H";
const NEW = "Zz9Yy8Xx7Ww6Vv5Uu4Tt3S";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let seen: { url: string; method: string }[] = [];
const fake = (h: Handler): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, method: init?.method ?? "GET" });
    return h(url, init);
  }) as typeof fetch;
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const opts = (h: Handler) => ({ fetchImpl: fake(h), maxTier: 1 as const, minIntervalMs: 0 });

const search = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: "search",
  readOnly: true,
  request: { method: "GET", url: "https://t.test/api/search?q=kittens", headers: {} },
  slots: [{ param: "q", at: ["query:q"] }],
  params: [{ name: "q", example: "kittens" }],
  trigger: { url: "https://t.test/search?q={q}" },
  match: { host: "t.test", path: "/api/search" },
  response: { format: "json", extract: "hits" },
  ...over,
});
const site = (...operations: Record<string, unknown>[]) =>
  parseSite({ name: "t", baseUrl: "https://t.test", operations });

beforeEach(() => {
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  rmSync(join(HOME, "writes.json"), { force: true });
  rmSync(join(HOME, "checks"), { recursive: true, force: true });
  rmSync(join(HOME, "sessions"), { recursive: true, force: true });
  seen = [];
});

test("verify heals a read marked stale: the stored template is sent first, and the heal clears the mark", async () => {
  saveSite(
    site({
      name: "user",
      readOnly: true,
      request: { method: "GET", url: `https://t.test/api/${QID}/User?name=alice`, headers: {} },
      slots: [{ param: "name", at: ["query:name"] }],
      volatile: [{ at: ["path:1"], shape: { charset: "base64url", length: 22 }, anchor: "User" }],
      trigger: { url: "https://t.test/u/{name}" },
      params: [{ name: "name", example: "alice" }],
      response: { extract: "user" },
    }),
  );
  const h: Handler = (url) => {
    if (url === "https://t.test/u/alice")
      return new Response('<script src="/app.js"></script>', { headers: { "content-type": "text/html" } });
    if (url === "https://t.test/app.js") return new Response(`r=[{id:"${NEW}",name:"User"}]`);
    if (url.includes(`/api/${NEW}/User`)) return json({ user: { name: new URL(url).searchParams.get("name") } });
    return new Response("", { status: 404 });
  };
  // the site moved the request minutes after a heal: a call marked the op stale and stopped healing it
  markStale("t", "user", "drifted again within 10 min of a heal");
  const v = await verifySite("t", opts(h));
  const example = v.results[0]!;
  assert.ok("outcome" in example);
  assert.equal(example.outcome, "pass", JSON.stringify(example));
  // the stored template went first; the heal followed, from the page and the bundle, and the cases
  // ran once more on the healed op: that run is the one judged
  assert.ok(seen[0]!.url.includes(`/api/${QID}/User`), seen[0]!.url);
  assert.ok(seen.some((s) => s.url === "https://t.test/app.js"));
  assert.deepEqual(
    readFileSync(join(HOME, "heals.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l).strategy),
    ["rescan"],
  );
  assert.equal(staleMark("t", "user"), undefined, "a saved heal clears the mark");
  assert.equal(loadRecord("t").user?.results[0]?.outcome, "pass");
  assert.deepEqual(v.newlyFailing, []);

  // a plain call is still held by a fresh mark: only verify (and heal) go past it
  markStale("t", "user", "drifted again within 10 min of a heal");
  const held = await call(
    "t",
    "user",
    { name: "alice" },
    opts(() => new Response("", { status: 404 })),
  );
  assert.match(held.reason ?? "", /stale until/);
});

test("each case remembers when its outcome began, and verify says what newly fails and what recovered", async () => {
  saveSite(site(search({ checks: [{ args: { q: "zzzz" }, expect: "empty" }] })));
  let empty = false;
  const h: Handler = (url) =>
    new URL(url).searchParams.get("q") === "zzzz" && empty
      ? json({ hits: [] })
      : json({ hits: [{ title: "kittens everywhere" }] });

  const first = await verifySite("t", opts(h));
  assert.deepEqual(first.newlyFailing, ["search"]);
  assert.deepEqual(first.recovered, []);
  const began = first.failingSince.search;
  assert.ok(began, JSON.stringify(first));
  const rec = loadRecord("t").search!;
  assert.deepEqual(
    rec.results.map((r) => [r.case, r.outcome, r.since]),
    [
      ["example", "pass", rec.at],
      ["check 1", "fail", rec.at],
    ],
  );
  assert.equal(began, rec.at);

  await new Promise((r) => setTimeout(r, 5));
  const again = await verifySite("t", opts(h));
  assert.deepEqual(again.newlyFailing, [], "still failing is not newly failing");
  assert.equal(again.failingSince.search, began, "the failure's start stands");
  const later = loadRecord("t").search!;
  assert.notEqual(later.at, rec.at);
  assert.equal(later.results[1]!.since, began);
  assert.equal(later.results[0]!.since, rec.at, "a passing case keeps its start too");
  // the result rows carry since as the record does
  const row = again.results[1]!;
  assert.ok("outcome" in row && row.since === began);

  empty = true;
  const fixed = await verifySite("t", opts(h));
  assert.deepEqual(fixed.recovered, ["search"]);
  assert.deepEqual(fixed.newlyFailing, []);
  assert.deepEqual(fixed.failingSince, {});
  const now = loadRecord("t").search!;
  assert.equal(now.results[1]!.outcome, "pass");
  assert.equal(now.results[1]!.since, now.at, "a changed outcome starts over");
});

test("a read learned signed in is skipped while no login is on record; one with a login runs", async () => {
  saveSite(site(search({ learnedLoggedIn: true })));
  const h: Handler = () => json({ hits: [{ title: "mine" }] });
  const v = await verifySite("t", opts(h));
  assert.deepEqual(v.results, [
    {
      op: "search",
      skipped: "needs login: search was learned signed in, and no login is on record for t: api-anything login t",
    },
  ]);
  assert.equal(seen.length, 0, "nothing was sent");
  assert.equal(loadRecord("t").search, undefined);

  // a login put a cookie in the jar (and recorded where it came from): the case runs
  saveSession("t", {
    cookies: [
      {
        name: "sessionid",
        value: "s3cr3tsessionvalue",
        domain: "t.test",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: true,
      },
    ],
    values: {},
    source: "file",
  });
  const ran = await verifySite("t", opts(h));
  const row = ran.results[0]!;
  assert.ok("outcome" in row && row.outcome === "pass", JSON.stringify(row));
  assert.equal(seen.length, 1);
});

test("a write is never sent: its preflight says what a call would need first", async () => {
  const addTodo: Record<string, unknown> = {
    name: "addTodo",
    readOnly: false,
    learnedLoggedIn: true,
    request: {
      method: "POST",
      url: "https://t.test/api/todos",
      headers: { "content-type": "application/json", "x-csrf": "tok" },
      body: '{"title":"buy milk"}',
    },
    slots: [
      { param: "title", at: ["body", "json:/title"] },
      { ref: "session:csrf", at: ["header:x-csrf"] },
    ],
    params: [{ name: "title", example: "buy milk" }],
    trigger: { url: "https://t.test/todos" },
    match: { host: "t.test", path: "/api/todos" },
    readback: { op: "search", args: {}, find: { field: "title", equals: "{title}" } },
  };
  saveSite(site(search(), addTodo));
  let hits: unknown[] = [];
  const h: Handler = (_url, init) => {
    if (init?.method === "POST") throw new Error("a write was sent");
    return json({ hits });
  };

  const bare = await verifySite("t", opts(h));
  assert.equal(seen.filter((s) => s.method === "POST").length, 0);
  const row = bare.results.find((r) => r.op === "addTodo")!;
  assert.ok("preflight" in row, JSON.stringify(row));
  const p: Preflight = row.preflight;
  assert.equal(p.ok, false);
  assert.equal(p.builds, true, "the template fills; what is missing is listed");
  assert.equal(p.learnedLoggedIn, true);
  assert.equal(p.loggedIn, false);
  assert.match(p.reason ?? "", /session value csrf has not been captured/);
  assert.match(p.next ?? "", /needs a trigger run/);
  assert.match(p.reason ?? "", /learned signed in, and the jar holds no live login cookie/);
  assert.match(p.reason ?? "", /its readback search answered fail/);
  assert.deepEqual(p.readback, { op: "search", outcome: "fail" });
  assert.equal(p.unconfirmed, 0);
  // the preflight holds no value of the session, and nothing of the request
  assert.ok(!JSON.stringify(p).includes("tok"));

  // a trigger run captured the value, a login filled the jar, the readback's read answers, and one
  // earlier write was accepted without its readback finding it
  hits = [{ title: "something" }];
  saveSession("t", {
    cookies: [
      {
        name: "sessionid",
        value: "s3cr3tsessionvalue",
        domain: "t.test",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: true,
      },
    ],
    values: { csrf: "live-csrf-value-123" },
    valueHosts: { csrf: "t.test" },
    source: "file",
  });
  const gate = beginWrite("t", "addTodo", { title: "later: milk" });
  assert.ok(gate.send);
  settleWrite(gate.id, "accepted", { ok: true, class: "ok" });
  const applied = beginWrite("t", "addTodo", { title: "eggs" });
  assert.ok(applied.send);
  settleWrite(applied.id, "applied", { ok: true, class: "ok" });

  const ready = await verifySite("t", opts(h));
  const ok = ready.results.find((r) => r.op === "addTodo")!;
  assert.ok("preflight" in ok);
  assert.equal(ok.preflight.ok, true, JSON.stringify(ok.preflight));
  assert.equal(ok.preflight.loggedIn, true);
  assert.deepEqual(ok.preflight.readback, { op: "search", outcome: "pass" });
  assert.equal(ok.preflight.unconfirmed, 1, "the accepted write, not the applied one");
  assert.ok(!JSON.stringify(ok.preflight).includes("live-csrf-value"));
  assert.equal(seen.filter((s) => s.method === "POST").length, 0);
});

test("a write with no example for a required param does not build, and one with a param the op refuses says why", async () => {
  const write = (params: unknown[], body: string): Record<string, unknown> => ({
    name: "post",
    readOnly: false,
    request: { method: "POST", url: "https://t.test/api/post", headers: {}, body },
    slots: [{ param: "n", at: ["body", "json:/n"] }],
    params,
    trigger: { url: "https://t.test/compose" },
    match: { host: "t.test", path: "/api/post" },
  });
  saveSite(site(write([{ name: "n", required: true }], '{"n":1}')));
  const none = (
    await verifySite(
      "t",
      opts(() => json({})),
    )
  ).results[0]!;
  assert.ok("preflight" in none);
  assert.equal(none.preflight.builds, false);
  assert.match(none.preflight.reason ?? "", /no example for n/);
  saveSite(site(write([{ name: "n", example: "x", min: 1 }], '{"n":1}')));
  const bad = (
    await verifySite(
      "t",
      opts(() => json({})),
    )
  ).results[0]!;
  assert.ok("preflight" in bad);
  assert.equal(bad.preflight.builds, false);
  assert.match(bad.preflight.reason ?? "", /param "n" must be/);
  assert.equal(seen.length, 0);
});
