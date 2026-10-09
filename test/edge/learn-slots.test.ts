/**
 * Regressions for the learner's slots (src/learn.ts, src/codec.ts): credentials that reached the
 * spec or were stored under the wrong name, and params the second example proves or disproves.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRequest } from "../../src/http.js";
import { learnOperation } from "../../src/learn.js";
import type { Exchange, StoredCookie } from "../../src/types.js";

const A = "Zx81kLmN0pQrStUv2wXyZ3aBcD";
const B = "Ys92jKnM1qRsTuVw3xYzA4bCdE";

let nextId = 1;
function xhr(
  req: { method?: string; url: string; headers?: Record<string, string>; body?: string },
  resBody: unknown = { results: [{ id: 1 }, { id: 2 }] },
): Exchange {
  return {
    id: nextId++,
    resourceType: "fetch",
    request: {
      method: req.method ?? "GET",
      url: req.url,
      headers: req.headers ?? {},
      ...(req.body !== undefined ? { body: req.body } : {}),
    },
    response: { status: 200, headers: {}, contentType: "application/json", body: JSON.stringify(resBody) },
  };
}
const post = (body: string, headers: Record<string, string> = {}) =>
  xhr({
    method: "POST",
    url: "https://api.site.test/v1/search",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

type Examples = [Record<string, unknown>] | [Record<string, unknown>, Record<string, unknown>];
const learn = (exchanges: Exchange[], examples: Examples, extra: Partial<Parameters<typeof learnOperation>[0]> = {}) =>
  learnOperation({
    exchanges,
    examples,
    cookies: [],
    name: "op",
    trigger: { url: "https://site.test/" },
    readOnly: true,
    ...extra,
  });

const cookie = (name: string, value: string): StoredCookie => ({
  name,
  value,
  domain: "site.test",
  path: "/",
  expires: -1,
  httpOnly: true,
  secure: false,
});

/* ------------------------------------------------------- 1: repeated keys */

test("a JSON object that repeats a key is refused: its later occurrence could not be blanked", () => {
  assert.throws(
    () => learn([post(`{"q":"nasa","token":"${A}","token":"${B}"}`)], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/token\)/,
  );
  // the later occurrence is an object: its leaves are not at the first one's path either
  assert.throws(
    () => learn([post(`{"q":"nasa","auth":1,"auth":{"token":"${B}"}}`)], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/auth\/token\)/,
  );
  // control: a repeated query key has a position of its own
  const { operation: op } = learn(
    [xhr({ url: `https://api.site.test/v1/search?q=nasa&t=${A}&t=${B}` })],
    [{ q: "nasa" }],
  );
  assert.equal(
    new URL(buildRequest(op, { q: "mars" }, { cookies: [], values: {} }).url).search,
    `?q=mars&t=${A}&t=${B}`,
  );
});

/* ------------------------------------------------------------- 5: public */

test("a name the caller marked public is a constant in every pass", () => {
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const ex = xhr({
    // token: a per-session field by name; sv: equal to a stored value
    url: `https://api.site.test/v1/search?q=kittens&token=${A}&sv=${B}`,
    // x-app: equal to a cookie; x-ctx: a cookie inside a longer leaf
    headers: { "x-app": SID, "x-ctx": `v1:${SID}`, cookie: `sid=${SID}` },
  });
  const input = { cookies: [cookie("sid", SID)], storage: { cached: B } };
  const names = ["sv", "token", "x-app", "x-ctx"];
  // control: each of the four is a reference when nobody says otherwise
  assert.deepEqual(
    learn([ex], [{ q: "kittens" }], input)
      .operation.slots.flatMap((s) => (s.ref ? [s.at[0]!.split(":")[1]] : []))
      .sort(),
    names,
  );
  const { operation: op, sessionValues } = learn([ex], [{ q: "kittens" }], { ...input, public: names });
  assert.deepEqual(op.slots, [{ param: "q", at: ["query:q"] }]);
  assert.deepEqual(sessionValues, {});
  assert.deepEqual(op.public, names);
  const r = buildRequest(op, { q: "cats" }, { cookies: [], values: {} });
  assert.equal(r.url, `https://api.site.test/v1/search?q=cats&token=${A}&sv=${B}`);
  assert.deepEqual([r.headers["x-app"], r.headers["x-ctx"]], [SID, `v1:${SID}`]);
});

/* ------------------------------------------------ 2: a hole has no transform */

test("a cookie sitting unquoted or URL-decoded next to an arg in one leaf is refused, not left literal", () => {
  const bare = "ajax:4815162342108151623";
  const encoded = "eyJpdiI6IkFCQ0RFRkdISUpLTE1OT1AiLCJ2YWx1ZSI6Ing9In0%3D";
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const cookies = [cookie("JSESSIONID", `"${bare}"`), cookie("XSRF-TOKEN", encoded), cookie("sid", SID)];
  const run = (ctx: string, example: Record<string, unknown> = { q: "nasa" }) =>
    learn([xhr({ url: "https://api.site.test/v1/search?q=nasa", headers: { "x-ctx": ctx } })], [example], { cookies });

  assert.throws(
    () => run(`user=nasa;auth=${bare}`),
    /header:x-ctx holds cookie:JSESSIONID without its quotes.*credential/,
  );
  assert.throws(
    () => run(`user=nasa;xsrf=${decodeURIComponent(encoded)}`),
    /header:x-ctx holds cookie:XSRF-TOKEN URL-decoded.*credential/,
  );
  // the same in a leaf no param is in: only one of its credentials can be transformed when filled
  assert.throws(
    () => run(`${bare}:${decodeURIComponent(encoded)}`),
    /header:x-ctx holds cookie:XSRF-TOKEN URL-decoded/,
  );

  // control: a copy as stored is a hole, and an unquoted copy alone in its leaf is a ref with a transform
  for (const ctx of [`user=nasa;auth="${bare}";s=${SID}`, `v1:${bare}`]) {
    const { operation: op } = run(ctx);
    assert.ok(!JSON.stringify(op).includes(bare) && !JSON.stringify(op).includes(SID), JSON.stringify(op.slots));
    assert.equal(buildRequest(op, { q: "nasa" }, { cookies, values: {} }).headers["x-ctx"], ctx);
  }
});

/* --------------------------------------------------- 3: one name, one value */

test("a stored value found inside a longer leaf never takes over another credential's name", () => {
  // storage calls A "token"; the request's own token field holds B, and A rides inside other leaves
  const bodies = [
    { q: "kittens", token: B, ctx: `v1:${A}`, again: `v2:${A}` },
    { q: "kittens", token: B, next: `/search?q=kittens&t=${A}` },
  ];
  for (const body of bodies) {
    const { operation: op, sessionValues } = learn([post(JSON.stringify(body))], [{ q: "kittens" }], {
      storage: { token: A },
    });
    assert.ok(!JSON.stringify(op).includes(A) && !JSON.stringify(op).includes(B));
    assert.deepEqual(Object.values(sessionValues).sort(), [B, A], "each value is stored once, under its own name");
    const r = buildRequest(op, { q: "kittens" }, { cookies: [], values: sessionValues });
    assert.deepEqual(JSON.parse(r.body!), body);
  }
});

/* ------------------------------------------------------- 6: no overlapping */

test("a ref for a whole container yields to the params and refs inside it", () => {
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const session = { cookies: [cookie("sid", SID)], values: {} };
  const jar = { cookies: session.cookies };
  const send = (op: ReturnType<typeof learn>["operation"]) => buildRequest(op, { q: "puppies" }, session);

  // the app saved its last request in localStorage, and a field inside it is the session cookie
  const body = JSON.stringify({ q: "kittens", token: SID, page: 1 });
  const saved = learn([post(body)], [{ q: "kittens" }], { ...jar, storage: { lastRequest: body } });
  assert.deepEqual(saved.operation.slots, [
    { param: "q", at: ["body", "json:/q"] },
    { ref: "cookie:sid", at: ["body", "json:/token"] },
  ]);
  assert.deepEqual(saved.sessionValues, {});
  assert.deepEqual(JSON.parse(send(saved.operation).body!), { q: "puppies", token: SID, page: 1 });

  // only a param inside: the body is still filled, not blanked whole
  const plain = JSON.stringify({ q: "kittens", page: 1 });
  const onlyParam = learn([post(plain)], [{ q: "kittens" }], { storage: { lastRequest: plain } });
  assert.deepEqual(onlyParam.operation.slots, [{ param: "q", at: ["body", "json:/q"] }]);
  assert.equal(send(onlyParam.operation).body, '{"q":"puppies","page":1}');

  // a session header that is JSON, holding the cookie
  const header = learn(
    [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-csrf-token": `["${SID}",1]` } })],
    [{ q: "kittens" }],
    jar,
  );
  assert.deepEqual(
    header.operation.slots.filter((s) => s.ref),
    [{ ref: "cookie:sid", at: ["header:x-csrf-token", "json:/0"] }],
  );
  assert.equal(send(header.operation).headers["x-csrf-token"], `["${SID}",1]`);

  // control: nothing inside has a slot, so the whole container is one ref
  const state = '{"tab":"all","n":3}';
  const whole = learn(
    [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-state": state } })],
    [{ q: "kittens" }],
    { storage: { state } },
  );
  assert.deepEqual(
    whole.operation.slots.filter((s) => s.ref),
    [{ ref: "session:op/state", at: ["header:x-state"] }],
  );
  assert.deepEqual(whole.sessionValues, { "op/state": state });
});

/* -------------------------------------------------- 4: cached query hashes */

test("a persisted-query hash the app caches in storage stays a volatile anchor at any length", () => {
  const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";
  const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } });
  const ex = xhr({
    url: `https://site.test/graphql?operationName=Search&variables=${encodeURIComponent('{"q":"nasa"}')}&extensions=${encodeURIComponent(extensions)}`,
  });
  const stores: Record<string, string>[] = [
    { "pq:Search": hash },
    { "apollo-cache": JSON.stringify({ Search: { id: hash } }) },
  ];
  for (const storage of stores) {
    const { operation: op, sessionValues } = learn([ex], [{ q: "nasa" }], { storage });
    assert.deepEqual(
      op.slots.filter((s) => s.ref),
      [],
    );
    assert.deepEqual(sessionValues, {});
    assert.deepEqual(
      op.volatile.map((v) => [v.at, v.anchor]),
      [[["query:extensions", "json:/persistedQuery/sha256Hash"], "Search"]],
    );
    assert.ok(op.request.url.includes(hash), "the hash stays in the template for the cheap heal to swap");
  }
});

/* ------------------------------------------- the check behind every pass */

test("learning refuses a request it could not clear of a live value, in any encoding the save scan reads", () => {
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const cases: [string, StoredCookie, Record<string, unknown>][] = [
    ["a cookie too short to template, inside a longer leaf", cookie("sess", "secret123"), { ctx: "v1:secret123" }],
    ["a cookie in base64", cookie("sid", SID), { state: Buffer.from(`sid=${SID}`).toString("base64") }],
    [
      "a cookie percent-encoded twice",
      cookie("sid", `${SID}/=`),
      { next: encodeURIComponent(`/cb?s=${encodeURIComponent(`${SID}/=`)}`) },
    ],
  ];
  for (const [label, c, fields] of cases) {
    assert.throws(
      () => learn([post(JSON.stringify({ q: "kittens", ...fields }))], [{ q: "kittens" }], { cookies: [c] }),
      new RegExp(`keep a credential in the spec: \\$\\.request\\.body holds the live cookie ${c.name}`),
      label,
    );
  }
  // a session value the learner found by name counts too, where no pass reaches its second copy
  assert.throws(
    () => learn([post(JSON.stringify({ q: "kittens", csrf: "Ab3dEf9h", ctx: "v1:Ab3dEf9h" }))], [{ q: "kittens" }]),
    /keep a credential in the spec: \$\.request\.body holds the live session value csrf/,
  );
  // control: a header the caller marked public may hold one
  const { operation: op } = learn(
    [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-ctx": "v1:secret123" } })],
    [{ q: "kittens" }],
    { cookies: [cookie("sess", "secret123")], public: ["x-ctx"] },
  );
  assert.equal(op.request.headers["x-ctx"], "v1:secret123");
});
