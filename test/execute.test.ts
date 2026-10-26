/** The ladder's rules with an injected fetch and maxTier 1 (no browser): writes, heal guards, rate. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { type CallResult, call, finish, stepOf } from "../src/execute.js";
import { type Attempt, PROFILE_HINT } from "../src/heal.js";
import { saveSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { saveSite, staleMark } from "../src/store.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-exec-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const QID = "Aa1Bb2Cc3Dd4Ee5Ff6Gg7H";
const NEW = "Zz9Yy8Xx7Ww6Vv5Uu4Tt3S";
const site = parseSite({
  name: "t",
  baseUrl: "https://t.test",
  operations: [
    {
      name: "user",
      readOnly: true,
      request: { method: "GET", url: `https://t.test/api/${QID}/User?name=alice`, headers: {} },
      slots: [{ param: "name", at: ["query:name"] }],
      volatile: [{ at: ["path:1"], shape: { charset: "base64url", length: 22 }, anchor: "User" }],
      trigger: { url: "https://t.test/u/{name}" },
      params: [{ name: "name" }],
      response: { extract: "user" },
    },
    {
      name: "post",
      readOnly: false,
      request: {
        method: "POST",
        url: "https://t.test/api/post",
        headers: { "content-type": "application/json" },
        body: '{"text":"x"}',
      },
      slots: [{ param: "text", at: ["body", "json:/text"] }],
      trigger: { url: "https://t.test/compose" },
      params: [{ name: "text" }],
    },
  ],
});

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
const heals = () => {
  try {
    return readFileSync(join(HOME, "heals.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

beforeEach(() => {
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  rmSync(join(HOME, "writes.json"), { force: true });
  saveSite(site);
  seen = [];
});

test("different object and array args check the working examples before healing", async () => {
  for (const [type, example, given] of [
    ["object", { q: "alice" }, { q: "missing" }],
    ["array", ["a", "b"], ["a,b"]],
  ] as const) {
    for (const status of [200, 403]) {
      saveSite(
        parseSite({
          name: "t",
          baseUrl: "https://t.test",
          operations: [
            {
              name: "structured",
              readOnly: true,
              request: {
                method: "POST",
                url: "https://t.test/api/search",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ filter: example }),
              },
              slots: [{ param: "filter", at: ["body", "json:/filter"] }],
              params: [{ name: "filter", type, example }],
              trigger: { url: "https://t.test/search" },
              response: { extract: "items" },
            },
          ],
        }),
      );
      const sent: unknown[] = [];
      const r = await call(
        "t",
        "structured",
        { filter: given },
        opts((_url, init) => {
          const filter = JSON.parse(init?.body as string).filter;
          sent.push(filter);
          return JSON.stringify(filter) === JSON.stringify(example) ? json({ items: [example] }) : json({}, status);
        }),
      );
      assert.equal(r.class, "input", JSON.stringify(r));
      assert.deepEqual(sent.at(-1), example);
      assert.equal(sent.length, status === 200 ? 3 : 2);
      assert.equal(heals().length, 0);
    }
  }
});

test("writes: refused without allowWrites; 5xx and network errors are ambiguous and never retried", async () => {
  assert.equal(
    (
      await call(
        "t",
        "post",
        { text: "hi" },
        opts(() => json({})),
      )
    ).class,
    "refused",
  );
  assert.equal(seen.length, 0);

  const r = await call("t", "post", { text: "hi" }, { ...opts(() => json({ error: "boom" }, 502)), allowWrites: true });
  assert.equal(r.ok, false);
  assert.equal(seen.length, 1);
  assert.match(r.next ?? "", /may have gone through/);

  seen = [];
  // the 502 may have gone through: the same write again needs the override
  const n = await call(
    "t",
    "post",
    { text: "hi" },
    { ...opts(() => Promise.reject(new TypeError("fetch failed"))), allowWrites: true, again: true },
  );
  assert.equal(n.class, "error");
  assert.equal(seen.length, 1);
  assert.match(n.next ?? "", /may have gone through/);
});

test("drift heals by rescan and retries once; drifting again within 10 min marks it stale instead", async () => {
  let current = QID;
  const h: Handler = (url) => {
    if (url === "https://t.test/u/bob")
      return new Response('<script src="/app.js"></script>', { headers: { "content-type": "text/html" } });
    if (url === "https://t.test/app.js") return new Response(`r=[{id:"${current}",name:"User"}]`);
    if (url.includes(`/api/${current}/User`)) return json({ user: { name: new URL(url).searchParams.get("name") } });
    return new Response("", { status: 404 });
  };
  current = NEW;
  const r = await call("t", "user", { name: "bob" }, opts(h));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.healed, true);
  assert.deepEqual(r.data, { name: "bob" });
  assert.deepEqual(
    heals().map((x) => x.strategy),
    ["rescan"],
  );

  current = "Qq1Ww2Ee3Rr4Tt5Yy6Uu7I";
  // the bundle now serves an id the template does not have, but the op was healed seconds ago
  const again = await call("t", "user", { name: "bob" }, opts(h));
  assert.equal(again.class, "drift");
  assert.match(again.reason ?? "", /stale/);
  assert.ok(staleMark("t", "user"));
  assert.equal(heals().length, 1, "not re-healed");
});

test("a byte-identical rescan is not a heal; rate is reported without heal or retry", async () => {
  const h: Handler = (url) => {
    if (url.endsWith("/u/bob")) return new Response(`<script>r={id:"${QID}",name:"User"}</script>`);
    if (url.includes("/api/")) return new Response("", { status: 404 });
    return new Response("", { status: 404 });
  };
  const r = await call("t", "user", { name: "bob" }, opts(h));
  assert.equal(r.ok, false);
  assert.equal(heals().length, 0);

  seen = [];
  const rate = await call(
    "t",
    "user",
    { name: "bob" },
    opts(() => json({ message: "Too many requests" }, 429)),
  );
  assert.equal(rate.class, "rate");
  assert.equal(seen.length, 1);
  assert.match(rate.next ?? "", /do not retry/);
});

test("no data for an arg while the example still returns data is input, not drift: no heal, a second try and one example request", async () => {
  saveSite(
    parseSite({
      name: "nf",
      baseUrl: "https://t.test",
      operations: [
        {
          name: "user",
          readOnly: true,
          request: { method: "GET", url: "https://t.test/api/User?name=alice", headers: {} },
          slots: [{ param: "name", at: ["query:name"] }],
          trigger: { url: "https://t.test/u/{name}" },
          params: [{ name: "name", example: "alice" }],
          response: { extract: "data.user" },
        },
      ],
    }),
  );
  const h: Handler = (url) => {
    const name = new URL(url).searchParams.get("name");
    return name === "alice" ? json({ data: { user: { name } } }) : json({ data: {} });
  };
  const r = await call("nf", "user", { name: "zzqq_no_such_user" }, opts(h));
  assert.equal(r.class, "input", JSON.stringify(r));
  assert.match(r.reason ?? "", /example args still return data/);
  assert.match(r.next ?? "", /do not heal/);
  assert.equal(seen.length, 3);
  assert.equal(heals().length, 0);

  // when the example fails too, it is drift and the heal runs
  seen = [];
  const d = await call(
    "nf",
    "user",
    { name: "bob" },
    opts(() => json({ data: {} })),
  );
  assert.equal(d.class, "drift");
  assert.ok(seen.length >= 2);
});

test("a write answered 204, HTML or plain text is ok, sent once", async () => {
  for (const res of [
    new Response(null, { status: 204 }),
    new Response("<html>Posted!</html>", { headers: { "content-type": "text/html" } }),
    new Response("OK"),
  ]) {
    seen = [];
    const r = await call("t", "post", { text: "hi" }, { ...opts(() => res), allowWrites: true, again: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(seen.length, 1);
  }
});

test("add --from a capture judges the op on the captured response: a wrong --extract is a warning, a right one a preview", async () => {
  const { addOperation } = await import("../src/heal.js");
  const capture = {
    id: "cfake1",
    at: "",
    url: "https://t.test/u/nasa",
    cookies: [],
    finalUrl: "https://t.test/u/nasa",
    exchanges: [
      {
        id: 7,
        resourceType: "fetch",
        request: { method: "GET", url: "https://t.test/api/User?screen_name=nasa", headers: {} },
        response: {
          status: 200,
          headers: {},
          contentType: "application/json",
          body: '{"data":{"user_result":{"name":"NASA","followers":9}}}',
        },
      },
    ],
  };
  const bad = await addOperation({
    site: "addfrom",
    op: "u",
    examples: [{ screen_name: "nasa" }],
    from: { capture, id: 7 },
    response: { extract: "data.user.result" },
  });
  assert.ok(
    bad.warnings.some((w) =>
      /on the captured response this op says drift: extract path "data.user.result" missing.*add --from cfake1/.test(w),
    ),
    bad.warnings.join("\n"),
  );
  assert.equal(bad.preview, undefined);
  assert.equal(bad.operation.trigger.url, "https://t.test/u/{screen_name}");
  const good = await addOperation({
    site: "addfrom",
    op: "u",
    examples: [{ screen_name: "nasa" }],
    from: { capture, id: 7 },
    response: { extract: "data.user_result", pick: ["name"] },
  });
  assert.deepEqual(good.preview, { first: { name: "NASA" } });
  assert.equal(good.replaced, true);
});

test("capped below the tier a wall needs: the reason says what tier 1 met", async () => {
  const wall = new Response("<html><title>Just a moment...</title></html>", {
    status: 403,
    headers: { "content-type": "text/html", "cf-mitigated": "challenge" },
  });
  const r = await call(
    "t",
    "user",
    { name: "bob" },
    opts(() => wall),
  );
  assert.equal(r.class, "blocked");
  assert.match(r.reason ?? "", /tier 1 was blocked \(Cloudflare.*\); needs tier 2, capped at 1/);
});

const LIVE = "Sx9Qw2Lm7Rt4Vb8Nc3KdPz";

test("a response that echoes a live credential never puts it in reason, whole or cut at the snippet's end", async () => {
  saveSession("t", {
    cookies: [{ name: "sid", value: LIVE, domain: "t.test", path: "/", expires: -1, httpOnly: true, secure: true }],
    values: {},
  });
  try {
    const whole = await call(
      "t",
      "user",
      { name: "bob" },
      opts(() => json({ error: `invalid session ${LIVE} for ${encodeURIComponent(LIVE)}` }, 401)),
    );
    assert.equal(whole.class, "auth", JSON.stringify(whole));
    assert.ok(!(whole.reason ?? "").includes(LIVE.slice(0, 8)), whole.reason ?? "");
    assert.match(whole.reason ?? "", /\[redacted\]/);
    // the 160-character snippet ends inside the value: no prefix of it is left either
    for (const cut of [4, 10, LIVE.length - 1]) {
      const body = `${"x".repeat(160 - cut - 9)}session: ${LIVE}`;
      const r = await call(
        "t",
        "user",
        { name: "bob" },
        opts(() => new Response(body, { status: 401 })),
      );
      assert.ok(!(r.reason ?? "").includes(LIVE.slice(0, 4)), `${cut}: ${r.reason}`);
    }
  } finally {
    rmSync(join(HOME, "sessions"), { recursive: true, force: true });
  }
});

test("the same write while the last one is unsettled is refused unless the caller says again", async () => {
  const w = { ...opts(() => json({ ok: true })), allowWrites: true };
  const first = await call("t", "post", { text: "same" }, w);
  assert.equal(first.ok, true);
  assert.equal(first.write, "accepted");
  const dup = await call("t", "post", { text: "same" }, w);
  assert.equal(seen.length, 1, "not sent a second time");
  assert.equal(dup.ok, false);
  assert.equal(dup.class, "duplicate");
  assert.equal(dup.write, "not_sent");
  assert.equal(dup.retry, "no");
  assert.equal(dup.nextCall?.action, "check_site");
  assert.match(dup.next ?? "", /again/);
  // other args are another write
  assert.equal((await call("t", "post", { text: "other" }, w)).ok, true);
  assert.equal(seen.length, 2);
  // an explicit override sends it
  const again = await call("t", "post", { text: "same" }, { ...w, again: true });
  assert.equal(again.ok, true);
  assert.equal(seen.length, 3);
  // the args themselves are never stored
  const ledger = readFileSync(join(HOME, "writes.json"), "utf8");
  assert.ok(!ledger.includes("same") && !ledger.includes("other"), ledger);
});

test("a write that did not run does not hold back the next one, and one a dead process left sending does", async () => {
  const w = (h: Handler) => ({ ...opts(h), allowWrites: true });
  const refused = await call(
    "t",
    "post",
    { text: "x" },
    w(() => json({ error: "forbidden" }, 403)),
  );
  assert.equal(refused.write, "not_applied", JSON.stringify(refused));
  assert.notEqual(refused.retry, "no");
  assert.equal(
    (
      await call(
        "t",
        "post",
        { text: "x" },
        w(() => json({ ok: true })),
      )
    ).write,
    "accepted",
  );
  assert.equal(seen.length, 2);

  // a record still "sending" is a write whose process died mid-send: it may have gone through
  const all = JSON.parse(readFileSync(join(HOME, "writes.json"), "utf8"));
  for (const r of all) r.status = "sending";
  writeFileSync(join(HOME, "writes.json"), JSON.stringify(all));
  const dup = await call(
    "t",
    "post",
    { text: "x" },
    w(() => json({ ok: true })),
  );
  assert.equal(dup.class, "duplicate");
  assert.match(dup.reason ?? "", /may have gone through/);
  assert.equal(seen.length, 2);

  // outside the window it goes
  for (const r of all) r.at -= 11 * 60_000;
  writeFileSync(join(HOME, "writes.json"), JSON.stringify(all));
  assert.equal(
    (
      await call(
        "t",
        "post",
        { text: "x" },
        w(() => json({ ok: true })),
      )
    ).ok,
    true,
  );
  assert.equal(seen.length, 3);
});

test("an idempotency key returns the first call's record instead of sending, and is refused for other args", async () => {
  const w = (h: Handler, idempotencyKey: string) => ({ ...opts(h), allowWrites: true, idempotencyKey });
  const first = await call(
    "t",
    "post",
    { text: "k" },
    w(() => json({ ok: true }), "order-1"),
  );
  assert.equal(first.write, "accepted");
  const repeat = await call(
    "t",
    "post",
    { text: "k" },
    w(() => json({ ok: true }), "order-1"),
  );
  assert.equal(seen.length, 1, "not sent");
  assert.equal(repeat.ok, true);
  assert.equal(repeat.write, "accepted");
  assert.match(repeat.reason ?? "", /that call's record/);
  // a new key is a new write, whatever the args: the caller said so
  assert.equal(
    (
      await call(
        "t",
        "post",
        { text: "k" },
        w(() => json({ ok: true }), "order-2"),
      )
    ).ok,
    true,
  );
  assert.equal(seen.length, 2);
  const other = await call(
    "t",
    "post",
    { text: "different" },
    w(() => json({ ok: true }), "order-1"),
  );
  assert.equal(other.class, "input");
  assert.equal(other.write, "not_sent");
  assert.equal(seen.length, 2);

  // a key whose write may have gone through answers with that, not with a send
  const ambiguous = await call(
    "t",
    "post",
    { text: "m" },
    w(() => json({}, 502), "order-3"),
  );
  assert.equal(ambiguous.write, "may_have_applied");
  const again = await call(
    "t",
    "post",
    { text: "m" },
    w(() => json({ ok: true }), "order-3"),
  );
  assert.equal(seen.length, 3);
  assert.equal(again.ok, false);
  assert.equal(again.write, "may_have_applied");
  assert.equal(again.retry, "no");
  assert.equal(again.nextCall?.action, "check_site");
  // a key whose write did not run is free to send again
  await call(
    "t",
    "post",
    { text: "n" },
    w(() => json({}, 403), "order-4"),
  );
  assert.equal(
    (
      await call(
        "t",
        "post",
        { text: "n" },
        w(() => json({ ok: true }), "order-4"),
      )
    ).write,
    "accepted",
  );
  assert.equal(seen.length, 5);
});

/*
 * The contract over every class, a read and a write, and what was sent: each result's fields agree,
 * and no write that went through or may have says it can be sent again.
 */
test("contract: class x read/write x sent says consistent write, retry and nextCall", () => {
  const read = site.operations[0]!;
  const write = site.operations[1]!;
  const classes: CallResult["class"][] = [
    "ok",
    "drift",
    "auth",
    "rate",
    "blocked",
    "input",
    "error",
    "refused",
    "duplicate",
  ];
  const sends: [string, Attempt[]][] = [
    ["nothing", []],
    ["profile busy", [{ tier: 2, class: "error", reason: "busy", hint: PROFILE_HINT, unsent: true }]],
    ["answered 403", [{ tier: 1, class: "blocked", reason: "403", status: 403 }]],
    ["answered 502", [{ tier: 1, class: "error", reason: "502", status: 502, server: true }]],
    ["no answer", [{ tier: 1, class: "error", reason: "timeout", ambiguous: true, server: true }]],
    ["tier-3 401", [{ tier: 3, class: "auth", reason: "401", status: 401 }]],
    ["refused in a 2xx", [{ tier: 1, class: "error", reason: "ok:false", status: 200, rejected: true }]],
    ["rate, retry after", [{ tier: 1, class: "rate", reason: "429", status: 429, retryAfterMs: 120_000 }]],
    ["accepted", [{ tier: 1, class: "ok", reason: "ok", status: 200 }]],
  ];
  const ACTIONS = new Set([
    "retry",
    "login",
    "heal",
    "relearn",
    "fix_args",
    "list_sites",
    "check_site",
    "allow_writes",
    "raise_tier",
    "install_browser",
    "report",
  ]);
  let rows = 0;
  for (const op of [read, write])
    for (const c of classes)
      for (const [what, log] of sends) {
        const ok = c === "ok";
        // only a combination a call can produce: an ok result came from an ok attempt, and the other way round
        if (ok !== (what === "accepted")) continue;
        const last = log.at(-1);
        const r = finish({ ok, class: c, ...(last && !ok ? stepOf(last) : {}) }, op, "t", log);
        const row = `${op.readOnly ? "read" : "write"} ${c} after ${what}: ${JSON.stringify(r)}`;
        rows++;
        if (op.readOnly) assert.equal(r.write, undefined, row);
        else assert.ok(r.write, row);
        if (!op.readOnly && !log.length) assert.equal(r.write, "not_sent", row);
        if (!op.readOnly && what === "profile busy") assert.equal(r.write, "not_sent", row);
        if (!op.readOnly && (what === "answered 403" || what === "refused in a 2xx"))
          assert.equal(r.write, "not_applied", row);
        if (!op.readOnly && ["answered 502", "no answer", "tier-3 401"].includes(what))
          assert.equal(r.write, "may_have_applied", row);
        if (ok) {
          assert.equal(r.retry, undefined, row);
          assert.equal(r.nextCall, undefined, row);
          continue;
        }
        assert.ok(r.retry, row);
        assert.ok(r.nextCall && ACTIONS.has(r.nextCall.action), row);
        assert.equal(r.nextCall?.site, "t", row);
        // the rule this contract exists for
        if (r.write === "accepted" || r.write === "may_have_applied") {
          assert.equal(r.retry, "no", row);
          assert.equal(r.nextCall?.action, "check_site", row);
        }
        if (r.retry === "safe" || r.retry === "after_wait")
          assert.ok(op.readOnly || r.write === "not_sent" || r.write === "not_applied", row);
        if (!op.readOnly) assert.notEqual(r.nextCall?.action, "heal", row);
        if (r.retry === "after_wait" && what === "rate, retry after") assert.equal(r.retryAfterMs, 120_000, row);
        if (c === "duplicate") assert.equal(r.retry, "no", row);
      }
  assert.ok(rows > 100, String(rows));
});

test("contract through call(): a read's rate limit and a write's three outcomes", async () => {
  const rate = await call(
    "t",
    "user",
    { name: "bob" },
    opts(() => new Response("slow down", { status: 429, headers: { "retry-after": "120" } })),
  );
  assert.deepEqual([rate.class, rate.retry, rate.retryAfterMs, rate.write], ["rate", "after_wait", 120_000, undefined]);
  assert.equal(rate.nextCall?.action, "retry");

  const w = (h: Handler) => ({ ...opts(h), allowWrites: true, again: true });
  const cases: [Handler | undefined, Partial<CallResult>][] = [
    [() => json({ ok: true }), { ok: true, write: "accepted" }],
    [() => json({ error: "no" }, 403), { write: "not_applied" }],
    [() => json({ error: "boom" }, 502), { write: "may_have_applied", retry: "no" }],
    [() => Promise.reject(new TypeError("fetch failed")), { write: "may_have_applied", retry: "no" }],
    [undefined, { class: "refused", write: "not_sent", retry: "after_fix" }],
  ];
  for (const [h, want] of cases) {
    const r = await call("t", "post", { text: "c" }, h ? w(h) : opts(() => json({})));
    for (const [k, v] of Object.entries(want)) assert.equal(r[k as keyof CallResult], v, `${k}: ${JSON.stringify(r)}`);
  }
  const unknown = await call(
    "t",
    "post",
    { nope: 1 },
    w(() => json({})),
  );
  assert.deepEqual([unknown.class, unknown.write, unknown.nextCall?.action], ["input", "not_sent", "fix_args"]);
});
