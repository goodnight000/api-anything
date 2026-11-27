/**
 * What a call that met a wall is told, from what that call may carry (wall.ts): a write that may have
 * run is never invited to a second send, and a call no window reaches is never sent to one. Each hint
 * is followed as an agent would follow it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import { type CallResult, call } from "../src/execute.js";
import { resolver } from "../src/http.js";
import { mcpNext } from "../src/mcp.js";
import { saveSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { status } from "../src/status.js";
import { coolDown, saveSite } from "../src/store.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-wall-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const BASE = "https://wall.example.com";
const CHALLENGE = () =>
  new Response("<!doctype html><html><head><title>Just a moment...</title></head><body>checking</body></html>", {
    status: 200,
    headers: { "content-type": "text/html", "cf-mitigated": "challenge" },
  });
const CONSENT_AT = `${BASE}/consent?continue=%2Fapi%2Fdata`;
const CONSENT_PAGE = () =>
  new Response(
    '<!doctype html><html><head><title>Before you continue</title></head><body><p>We use cookies.</p><form action="/consent/save"><button name="choice" value="reject">Reject all</button></form></body></html>',
    { status: 200, headers: { "content-type": "text/html" } },
  );

const write = {
  name: "post",
  readOnly: false,
  match: { method: "POST", path: "/api/post" },
  request: {
    method: "POST",
    url: `${BASE}/api/post`,
    headers: { "content-type": "application/json" },
    body: '{"text":"x"}',
  },
  slots: [{ param: "text", at: ["body", "json:/text"] }],
  trigger: { url: `${BASE}/compose` },
  params: [{ name: "text" }],
};
const read = {
  name: "data",
  readOnly: true,
  match: { method: "GET", path: "/api/data" },
  request: { method: "GET", url: `${BASE}/api/data`, headers: {} },
  slots: [],
  params: [],
  trigger: { url: `${BASE}/data` },
  response: { extract: "items" },
};
const searchPost = {
  name: "search",
  readOnly: true,
  match: { method: "POST", path: "/api/search" },
  request: { method: "POST", url: `${BASE}/api/search`, headers: { "content-type": "application/json" }, body: "{}" },
  slots: [],
  params: [],
  trigger: { url: `${BASE}/search` },
  response: { extract: "items" },
};
const SHARED = { from: "https://registry.example/v1/sites/w", sha256: "0".repeat(64) };

function spec(name: string, ops: unknown[], shared?: Record<string, unknown>) {
  saveSite(parseSite({ name, baseUrl: `${BASE}/`, operations: ops, ...(shared ? { shared } : {}) }));
}

let cookies: (string | null)[] = [];
const fetchWith = (h: (url: string) => Response): typeof fetch =>
  (async (input: string | URL | Request, init?: RequestInit) => {
    const hs = new Headers(init?.headers);
    cookies.push(hs.get("cookie"));
    return h(String(input));
  }) as typeof fetch;
const fast = { minIntervalMs: 0, maxTier: 1 as const, allowWrites: true };
// a pulled spec goes only to public addresses; no DNS query leaves the machine
const realLookup = resolver.lookup;
beforeEach(() => {
  cookies = [];
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "writes.json"), { force: true });
  resolver.lookup = async () => [{ address: "93.184.215.14" }];
});
afterEach(() => {
  resolver.lookup = realLookup;
  delete process.env.API_ANYTHING_CDP;
});

/** Words that ask for the same request again. */
const RESEND = /retry once|then retry|retry the call|send it again|--window/;

describe("a write that may have run, behind a wall", () => {
  const kinds: [string, Record<string, unknown> | undefined, boolean][] = [
    ["the user's own spec", undefined, false],
    ["a spec a human pulled", SHARED, false],
    ["a spec a human pulled, attached", SHARED, true],
    ["a spec an agent pulled", { ...SHARED, by: "agent" }, false],
    ["a spec an agent pulled, attached", { ...SHARED, by: "agent" }, true],
  ];
  for (const [what, shared, attach] of kinds)
    test(`${what}: a 200 challenge page answers check_site, retry no, and prose that asks for no second send`, async () => {
      spec("wall-w", [write], shared);
      // only its presence counts: nothing at tier 1 connects to it
      if (attach) process.env.API_ANYTHING_CDP = "http://127.0.0.1:9";
      const r = await call("wall-w", "post", { text: "hi" }, { ...fast, fetchImpl: fetchWith(CHALLENGE) });
      assert.equal(r.write, "may_have_applied", JSON.stringify(r));
      assert.equal(r.retry, "no");
      assert.equal(r.nextCall?.action, "check_site");
      assert.match(r.next ?? "", /^the write may have gone through: check the site before any retry/);
      assert.doesNotMatch(r.next ?? "", RESEND, String(r.next));
      assert.doesNotMatch(mcpNext(r.next ?? ""), RESEND);
      // followed: the agent checks the site and sends nothing; a repeat of the call is held back unsent
      const before = cookies.length;
      const again = await call("wall-w", "post", { text: "hi" }, { ...fast, fetchImpl: fetchWith(CHALLENGE) });
      assert.equal(again.class, "duplicate", JSON.stringify(again));
      assert.equal(cookies.length, before, "nothing more was sent");
    });
});

describe("a call no window reaches", () => {
  /** A site that lets a call through once its consent cookie rides along, else walls it as `wall` does. */
  const site =
    (wall: "consent" | "challenge") =>
    (url: string): Response => {
      if (cookies.at(-1)?.includes("consent=yes"))
        return new Response('{"items":[1]}', { status: 200, headers: { "content-type": "application/json" } });
      if (wall === "challenge") return CHALLENGE();
      return url.includes("/consent")
        ? CONSENT_PAGE()
        : new Response("", { status: 302, headers: { location: CONSENT_AT } });
    };
  const kept = () =>
    saveSession("wall-r", {
      cookies: [
        {
          name: "consent",
          value: "yes",
          domain: "wall.example.com",
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: true,
        },
      ],
      values: {},
    });

  const rows: [string, unknown, Record<string, unknown>, Record<string, unknown>, RegExp][] = [
    [
      "a candidate op of a pulled spec",
      { ...read, version: { hash: "a".repeat(64), status: "candidate" } },
      SHARED,
      { op: { ...read, version: { hash: "a".repeat(64), status: "live" } } },
      /no maintainer has confirmed yet.*wait until the registry confirms the version, then pull the site again/,
    ],
    [
      "a POST read of a spec an agent pulled",
      searchPost,
      { ...SHARED, by: "agent" },
      { shared: SHARED },
      /an agent pulled wall-r.*a POST of a spec an agent pulled sends none of the stored cookies.*in a terminal: api-anything pull wall-r/,
    ],
  ];
  for (const attach of [false, true])
    for (const [what, op, shared, fixed, says] of rows)
      test(`${what}${attach ? ", attached" : ""}: its consent wall says no window helps and what does, and the claim holds`, async () => {
        spec("wall-r", [op], shared);
        if (attach) process.env.API_ANYTHING_CDP = "http://127.0.0.1:9";
        // what a window would have kept for the site is in the jar
        kept();
        const name = (op as { name: string }).name;
        const r: CallResult = await call("wall-r", name, {}, { ...fast, fetchImpl: fetchWith(site("consent")) });
        assert.equal(r.wall, "consent", JSON.stringify(r));
        assert.match(r.next ?? "", says);
        assert.match(r.next ?? "", /nothing a window keeps reaches it: do not retry as it is/);
        assert.doesNotMatch(r.next ?? "", /--window|login/, String(r.next));
        assert.deepEqual([r.nextCall?.action, r.retry], ["report", "no"]);
        assert.doesNotMatch(mcpNext(r.next ?? ""), /the login tool/);
        // the claim: the kept cookie never rode along, so a retry as it is meets the same wall
        assert.ok(
          cookies.every((c) => c === null),
          JSON.stringify(cookies),
        );
        const again = await call("wall-r", name, {}, { ...fast, fetchImpl: fetchWith(site("consent")) });
        assert.equal(again.wall, "consent");
        // what works, followed: the version confirmed, or the user's own pull, sends the kept cookie and answers
        spec(
          "wall-r",
          [{ ...(op as object), ...((fixed.op as object) ?? {}) }],
          (fixed.shared as Record<string, unknown>) ?? shared,
        );
        cookies = [];
        const through = await call("wall-r", name, {}, { ...fast, fetchImpl: fetchWith(site("consent")) });
        assert.equal(through.ok, true, JSON.stringify(through));
      });

  test("a cool-down after a block says the same as the call, in call and in status", async () => {
    spec("wall-r", [{ ...read, version: { hash: "a".repeat(64), status: "candidate" } }], SHARED);
    coolDown("wall-r", { class: "blocked", reason: "challenge", op: "data" }, 60_000);
    const r = await call("wall-r", "data", {}, { ...fast, fetchImpl: fetchWith(site("challenge")) });
    assert.equal(r.cooling, true, JSON.stringify(r));
    assert.match(r.next ?? "", /do not retry before retryAfterMs.*nothing a window keeps reaches it/);
    assert.doesNotMatch(r.next ?? "", /--window/);
    assert.deepEqual([r.nextCall?.action, r.retry], ["report", "no"]);
    const p = status("wall-r").problems.find((x) => x.problem === "cooling");
    assert.match(p?.next ?? "", /nothing a window keeps reaches it/);
    assert.doesNotMatch(p?.next ?? "", /--window/);
  });

  test("a pulled spec's cool-down while attached names api-anything's own browser, in call and in status", async () => {
    spec("wall-r", [read], SHARED);
    process.env.API_ANYTHING_CDP = "http://127.0.0.1:9";
    coolDown("wall-r", { class: "blocked", reason: "challenge", op: "data" }, 60_000);
    const r = await call("wall-r", "data", {}, { ...fast, fetchImpl: fetchWith(site("challenge")) });
    assert.match(r.next ?? "", /unset API_ANYTHING_CDP and run api-anything login wall-r --window/);
    assert.equal(r.nextCall?.action, "report");
    const p = status("wall-r").problems.find((x) => x.problem === "cooling");
    assert.match(p?.next ?? "", /unset API_ANYTHING_CDP and run api-anything login wall-r --window/);
    // the user's own spec keeps the window, attached or not
    spec("wall-r", [read]);
    const own = await call("wall-r", "data", {}, { ...fast, fetchImpl: fetchWith(site("challenge")) });
    assert.match(own.next ?? "", /To look sooner, ask the user to run api-anything login wall-r --window/);
    assert.deepEqual(own.nextCall, { action: "login", mode: "window", site: "wall-r", op: "data" });
  });
});
