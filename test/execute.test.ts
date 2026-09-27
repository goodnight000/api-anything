/** The ladder's rules with an injected fetch and maxTier 1 (no browser): writes, heal guards, rate. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { call } from "../src/execute.ts";
import { parseSite } from "../src/spec.ts";
import { saveSite, staleMark } from "../src/store.ts";

const HOME = mkdtempSync(join(tmpdir(), "site2api-exec-"));
process.env.SITE2API_HOME = HOME;
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
      request: { method: "POST", url: "https://t.test/api/post", headers: { "content-type": "application/json" }, body: '{"text":"x"}' },
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
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const opts = (h: Handler) => ({ fetchImpl: fake(h), maxTier: 1 as const, minIntervalMs: 0 });
const heals = () => {
  try {
    return readFileSync(join(HOME, "heals.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};

beforeEach(() => {
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  saveSite(site);
  seen = [];
});

test("writes: refused without allowWrites; 5xx and network errors are ambiguous and never retried", async () => {
  assert.equal((await call("t", "post", { text: "hi" }, opts(() => json({})))).class, "refused");
  assert.equal(seen.length, 0);

  const r = await call("t", "post", { text: "hi" }, { ...opts(() => json({ error: "boom" }, 502)), allowWrites: true });
  assert.equal(r.ok, false);
  assert.equal(seen.length, 1);
  assert.match(r.next ?? "", /may have gone through/);

  seen = [];
  const n = await call("t", "post", { text: "hi" }, { ...opts(() => Promise.reject(new TypeError("fetch failed"))), allowWrites: true });
  assert.equal(n.class, "error");
  assert.equal(seen.length, 1);
  assert.match(n.next ?? "", /may have gone through/);
});

test("drift heals by rescan and retries once; drifting again within 10 min marks it stale instead", async () => {
  let current = QID;
  const h: Handler = (url) => {
    if (url === "https://t.test/u/bob") return new Response('<script src="/app.js"></script>', { headers: { "content-type": "text/html" } });
    if (url === "https://t.test/app.js") return new Response(`r=[{id:"${current}",name:"User"}]`);
    if (url.includes(`/api/${current}/User`)) return json({ user: { name: new URL(url).searchParams.get("name") } });
    return new Response("", { status: 404 });
  };
  current = NEW;
  const r = await call("t", "user", { name: "bob" }, opts(h));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.healed, true);
  assert.deepEqual(r.data, { name: "bob" });
  assert.deepEqual(heals().map((x) => x.strategy), ["rescan"]);

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
  const rate = await call("t", "user", { name: "bob" }, opts(() => json({ message: "Too many requests" }, 429)));
  assert.equal(rate.class, "rate");
  assert.equal(seen.length, 1);
  assert.match(rate.next ?? "", /do not retry/);
});

test("no data for an arg while the example still returns data is input, not drift: no heal, one extra request", async () => {
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
  assert.equal(seen.length, 2);
  assert.equal(heals().length, 0);

  // when the example fails too, it is drift and the heal runs
  seen = [];
  const d = await call("nf", "user", { name: "bob" }, opts(() => json({ data: {} })));
  assert.equal(d.class, "drift");
  assert.ok(seen.length >= 2);
});

test("a write answered 204, HTML or plain text is ok, sent once", async () => {
  for (const res of [new Response(null, { status: 204 }), new Response("<html>Posted!</html>", { headers: { "content-type": "text/html" } }), new Response("OK")]) {
    seen = [];
    const r = await call("t", "post", { text: "hi" }, { ...opts(() => res), allowWrites: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(seen.length, 1);
  }
});

test("add --from a capture judges the op on the captured response: a wrong --extract is a warning, a right one a preview", async () => {
  const { addOperation } = await import("../src/heal.ts");
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
        response: { status: 200, headers: {}, contentType: "application/json", body: '{"data":{"user_result":{"name":"NASA","followers":9}}}' },
      },
    ],
  };
  const bad = await addOperation({ site: "addfrom", op: "u", examples: [{ screen_name: "nasa" }], from: { capture, id: 7 }, response: { extract: "data.user.result" } });
  assert.ok(bad.warnings.some((w) => /on the captured response this op says drift: extract path "data.user.result" missing.*add --from cfake1/.test(w)), bad.warnings.join("\n"));
  assert.equal(bad.preview, undefined);
  assert.equal(bad.operation.trigger.url, "https://t.test/u/{screen_name}");
  const good = await addOperation({ site: "addfrom", op: "u", examples: [{ screen_name: "nasa" }], from: { capture, id: 7 }, response: { extract: "data.user_result", pick: ["name"] } });
  assert.deepEqual(good.preview, { first: { name: "NASA" } });
  assert.equal(good.replaced, true);
});
