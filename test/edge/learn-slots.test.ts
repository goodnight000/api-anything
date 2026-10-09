/**
 * Regressions for the learner's slots (src/learn.ts, src/codec.ts): credentials that reached the
 * spec or were stored under the wrong name, and params the second example proves or disproves.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-edge-slots-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

import { addOperation, type CaptureFile } from "../../src/heal.js";
import { buildRequest } from "../../src/http.js";
import { learnOperation, matches } from "../../src/learn.js";
import { scanSecrets } from "../../src/secrets.js";
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

/* ------------------------------------------------------- repeated keys */

test("a JSON object that repeats a key is refused: its later occurrence could not be blanked", () => {
  assert.throws(
    () => learn([post(`{"q":"nasa","token":"${A}","token":"${B}"}`)], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/token\)/,
  );
  // the later occurrence is an object: its leaves are not at the first one's path either
  assert.throws(
    () => learn([post(`{"q":"nasa","auth":1,"auth":{"token":"${B}"}}`)], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/auth\)/,
  );
  // the repeat is seen in the object itself, so one that holds no leaf at all counts too
  assert.throws(
    () => learn([post('{"q":"nasa","meta":{},"meta":{}}')], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/meta\)/,
  );
  // and so does one in JSON inside a string
  assert.throws(
    () => learn([post(JSON.stringify({ q: "nasa", vars: '{"a":[],"a":[]}' }))], [{ q: "nasa" }]),
    /repeats a key \(body > json:\/vars > json:\/a\)/,
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

/* ------------------------------------------------------------- public */

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

/* ------------------------------------------------ a hole has no transform */

test("a cookie sitting unquoted or URL-decoded next to an arg in one leaf is refused, not left literal", () => {
  const bare = "ajax:4815162342108151623";
  const encoded = "eyJpdiI6IkFCQ0RFRkdISUpLTE1OT1AiLCJ2YWx1ZSI6Ing9In0%3D";
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const cookies = [cookie("JSESSIONID", `"${bare}"`), cookie("XSRF-TOKEN", encoded), cookie("sid", SID)];
  const run = (ctx: string, example: Record<string, unknown> = { q: "nasa" }) =>
    learn([xhr({ url: "https://api.site.test/v1/search?q=nasa", headers: { "x-ctx": ctx } })], [example], { cookies });

  assert.throws(
    () => run(`user=nasa;auth=${bare}`),
    /header:x-ctx holds cookie:JSESSIONID without its quotes.*credential.*Not learned: learn another request .*--pick-request/,
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

  // another cookie holds the same text as stored: it fills the hole exactly, whatever the jar's order
  const both = [cookie("quoted", `"${SID}"`), cookie("raw", SID)];
  const exact = learn(
    [xhr({ url: "https://api.site.test/v1/search?q=nasa", headers: { "x-ctx": `q=nasa;auth=${SID}` } })],
    [{ q: "nasa" }],
    { cookies: both },
  ).operation;
  assert.deepEqual(exact.slots.at(-1), {
    param: "q",
    at: ["header:x-ctx"],
    template: "q={q};auth={cookie:raw}",
  });
  assert.equal(
    buildRequest(exact, { q: "mars" }, { cookies: both, values: {} }).headers["x-ctx"],
    `q=mars;auth=${SID}`,
  );
});

/* --------------------------------------------------- one name, one value */

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

/* ------------------------------------------------------- no overlapping */

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

test("a credential container that yields to a slot inside it keeps nothing else of itself in the spec", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const SID = "q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const cookies = [cookie("sid", SID)];
  // x-csrf-token is a credential by its name, and its value is JSON
  const run = (value: unknown) =>
    learn(
      [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-csrf-token": JSON.stringify(value) } })],
      [{ q: "kittens" }],
      { cookies },
    );
  const slotsOf = (op: ReturnType<typeof learn>["operation"]) =>
    op.slots.map((s) => [s.param ?? s.ref!.replace(/@.*/, ""), s.at.join(" > ")]);

  // a param inside: the opaque token beside it is still the credential
  const header = { q: "kittens", opaque: T, v: "v1" };
  const { operation: op, sessionValues } = run(header);
  assert.ok(!JSON.stringify(op).includes(T), "the token stayed in the spec");
  assert.deepEqual(slotsOf(op), [
    ["q", "query:q"],
    ["q", "header:x-csrf-token > json:/q"],
    ["session:op/x-csrf-token", "header:x-csrf-token > json:/opaque"],
    ["session:op/x-csrf-token", "header:x-csrf-token > json:/v"],
  ]);
  assert.deepEqual(Object.values(sessionValues).sort(), [T, "v1"].sort());
  const sent = buildRequest(op, { q: "puppies" }, { cookies, values: sessionValues });
  assert.deepEqual(JSON.parse(sent.headers["x-csrf-token"]!), { ...header, q: "puppies" });

  // a cookie inside: the same for what sits beside it
  const list = run([SID, "v1"]).operation;
  assert.deepEqual(slotsOf(list), [
    ["q", "query:q"],
    ["cookie:sid", "header:x-csrf-token > json:/0"],
    ["session:op/x-csrf-token", "header:x-csrf-token > json:/1"],
  ]);

  // what cannot be a reference refuses the learn: a number, and a leaf that is only partly a slot
  assert.throws(
    () => run({ q: "kittens", opaque: T, n: 17 }),
    /header:x-csrf-token > json:\/n is a number inside the credential header:x-csrf-token/,
  );
  assert.throws(
    () => run({ sig: "kittens.v2" }),
    /header:x-csrf-token > json:\/sig is only partly a slot inside the credential header:x-csrf-token/,
  );
  // ...whose text, when it is a credential by the header's name on its own, is refused as such
  assert.throws(
    () => run({ sig: `kittens.${T}` }),
    /header:x-csrf-token > json:\/sig holds a param inside text that is a credential \(by the leaf's name, x-csrf-token\)/,
  );
});

test("an empty string beside a slot in a credential container is a reference too", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const U = "Zx9Qw8vLm7Kj6HgF5dS4aP3oI2uY1tRe";
  const run = (value: unknown) =>
    learn(
      [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-csrf-token": JSON.stringify(value) } })],
      [{ q: "kittens" }],
    );
  // the page may fill it on a later load: only a reference there lets a refresh record what it sends
  const { operation: op, sessionValues } = run({ q: "kittens", opaque: "", other: T });
  const refs = op.slots.filter((s) => s.ref);
  assert.deepEqual(
    refs.map((s) => s.at.join(" > ")),
    ["header:x-csrf-token > json:/opaque", "header:x-csrf-token > json:/other"],
  );
  assert.deepEqual(Object.values(sessionValues), ["", T]);
  const later = { ...sessionValues, [refs[0]!.ref!.slice(8)]: U };
  assert.deepEqual(
    JSON.parse(buildRequest(op, { q: "puppies" }, { cookies: [], values: later }).headers["x-csrf-token"]!),
    { q: "puppies", opaque: U, other: T },
  );

  // nothing else in it: every leaf is accounted for, so the container's own unchanged text is no leftover
  const small = run({ q: "kittens", opaque: "" });
  assert.deepEqual(
    small.operation.slots.map((s) => s.at.join(" > ")),
    ["query:q", "header:x-csrf-token > json:/q", "header:x-csrf-token > json:/opaque"],
  );
  assert.equal(
    buildRequest(small.operation, { q: "puppies" }, { cookies: [], values: small.sessionValues }).headers[
      "x-csrf-token"
    ],
    '{"q":"puppies","opaque":""}',
  );
});

test("a credential that is a key of a yielding container refuses the learn: a key cannot be a reference", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const run = (value: unknown, extra: Parameters<typeof learn>[2] = {}) =>
    learn(
      [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-csrf-token": JSON.stringify(value) } })],
      [{ q: "kittens" }],
      extra,
    );
  const refusal = /header:x-csrf-token has an object key that is itself a credential .* Not learned/;
  // the opaque string is the key: its text would stay in the header, in a slot's pointer and in a ref's name
  assert.throws(() => run({ q: "kittens", [T]: "v1" }), refusal);
  // the same when the header is a credential because a cookie holds its whole text
  const header = { q: "kittens", [T]: "v1" };
  assert.throws(() => run(header, { cookies: [cookie("csrf", JSON.stringify(header))] }), refusal);
  // a key that holds no leaf, a key deeper down, and a key that is a known live value
  assert.throws(() => run({ q: "kittens", [T]: {} }), refusal);
  assert.throws(() => run({ q: "kittens", inner: { [T]: "v1" } }), refusal);
  assert.throws(() => run({ q: "kittens", secret123: "v1" }, { cookies: [cookie("sess", "secret123")] }), refusal);
  // the error does not repeat the credential
  assert.throws(
    () => run({ q: "kittens", [T]: "v1" }),
    (e: Error) => !e.message.includes(T),
  );

  // control: an ordinary key, however long, is a name
  const { operation: op } = run({ q: "kittens", includePromotedContentInResults: "v1" });
  assert.deepEqual(
    op.slots.map((s) => s.at.join(" > ")),
    ["query:q", "header:x-csrf-token > json:/q", "header:x-csrf-token > json:/includePromotedContentInResults"],
  );
});

test("a key of a yielding credential container is held against every cookie and stored value, however short", () => {
  const run = (value: unknown, extra: Parameters<typeof learn>[2] = {}) =>
    learn(
      [xhr({ url: "http://127.0.0.1/api/search?q=kittens", headers: { "x-csrf-token": JSON.stringify(value) } })],
      [{ q: "kittens" }],
      extra,
    );
  // the refusal says the way out: the caller's word that the whole header is public
  const refusal = /header:x-csrf-token has an object key that is itself a credential .* --public x-csrf-token/;
  // Five characters are under every other threshold. Without the yield the whole header is blanked,
  // so no text of it may come back as a key: as it is, percent-encoded or in base64.
  const sess = { cookies: [cookie("sess", "aB3dE")] };
  for (const k of ["aB3dE", "%61%42%33%64%45", "YUIzZEU=", "YUIzZEU"])
    assert.throws(() => run({ q: "kittens", [k]: "v1" }, sess), refusal, k);
  assert.throws(() => run({ q: "kittens", inner: { aB3dE: {} } }, sess), refusal, "nested, holding no leaf");
  assert.throws(() => run({ q: "kittens", aB3dE: "v1" }, { cookies: [cookie("sess", '"aB3dE"')] }), refusal);
  // a stored value, whatever it is stored as, and a single character
  assert.throws(() => run({ q: "kittens", dark: "v1" }, { storage: { theme: "dark" } }), refusal);
  const prefs = { prefs: JSON.stringify({ user: { id: "u7" } }) };
  assert.throws(() => run({ q: "kittens", u7: "v1" }, { storage: prefs }), refusal);
  assert.throws(() => run({ q: "kittens", "1": "v1" }, { cookies: [cookie("v", "1")] }), refusal);

  // control: an array's index is no key, and a key that only contains a short value is another name
  const list = run(["kittens", "v1"], { cookies: [cookie("v", "1")] }).operation;
  assert.deepEqual(
    list.slots.map((s) => s.at.join(" > ")),
    ["query:q", "header:x-csrf-token > json:/0", "header:x-csrf-token > json:/1"],
  );
  assert.equal(run({ q: "kittens", v1: "x" }, { cookies: [cookie("v", "1")] }).operation.slots.length, 3);
  // the way out works: the header marked public stays as captured and still takes the arg
  const marked = run({ q: "kittens", aB3dE: "v1" }, { ...sess, public: ["x-csrf-token"] }).operation;
  assert.equal(
    buildRequest(marked, { q: "puppies" }, noSession).headers["x-csrf-token"],
    '{"q":"puppies","aB3dE":"v1"}',
  );
});

test("a path segment that is a reference is a wildcard in the match, as a param's is", () => {
  // the session id rides in the path, with a dot so it does not look like a hash on its own
  const first = "u1.q2Fz9kLmT0vXYb7NcW1pReHs3JuQa8Df";
  const next = "u1.Zx9Qw8vLm7Kj6HgF5dS4aP3oI2uY1tRe";
  const run = (sid: string, q: string) => [
    xhr({ url: `https://api.site.test/api/${sid}/search?q=${q}`, headers: { cookie: `sid=${sid}` } }),
  ];
  const captured = run(first, "kittens");
  const { operation: op, warnings } = learn(captured, [{ q: "kittens" }, { q: "puppies" }], {
    cookies: [cookie("sid", first)],
    exchanges2: run(next, "puppies"),
  });
  assert.deepEqual(
    op.slots.find((s) => s.ref),
    { ref: "cookie:sid", at: ["path:1"] },
  );
  assert.equal(op.match.path, "/api/*/search");
  assert.ok(matches(op.match, captured[0]!.request), "the match must fit the request it was learned from");
  assert.ok(!warnings.some((w) => /no matching request/.test(w)), warnings.join("\n"));
  assert.equal(
    buildRequest(op, { q: "cats" }, { cookies: [cookie("sid", next)], values: {} }).url,
    `https://api.site.test/api/${next}/search?q=cats`,
  );
});

/* ------------------------------------------------- query-id field names */

test("a cookie or stored value is a reference under a persisted-query field name too", () => {
  const body = (fields: Record<string, unknown>) => [
    xhr({
      method: "POST",
      url: "http://localhost/v1/search",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: "kittens", ...fields }),
    }),
  ];
  // A token the page stores and sends as queryId reads exactly like a query id it caches there:
  // the field's name decides nothing about a value that is known to be live.
  for (const name of ["queryId", "doc_id", "sha256Hash", "hash"]) {
    const at = ["body", `json:/${name}`];
    const inside = learn(body({ [name]: `v1:${A}` }), [{ q: "kittens" }], { storage: { token: A } });
    assert.ok(!JSON.stringify(inside.operation).includes(A), `${name}: the stored token stayed in the spec`);
    assert.deepEqual(inside.operation.slots.at(-1), { ref: "session:op/token", at, template: "v1:{session:op/token}" });
    assert.deepEqual(inside.sessionValues, { "op/token": A });
    assert.equal(JSON.parse(inside.operation.request.body!)[name], "");

    const whole = learn(body({ [name]: A }), [{ q: "kittens" }], { storage: { token: A } });
    assert.deepEqual(whole.operation.slots.at(-1), { ref: "session:op/token", at });
    const jar = learn(body({ [name]: `v1:${A}` }), [{ q: "kittens" }], { cookies: [cookie("sid", A)] });
    assert.deepEqual(jar.operation.slots.at(-1), { ref: "cookie:sid", at, template: "v1:{cookie:sid}" });
    // too short to template: the check refuses it there as anywhere else
    assert.throws(
      () => learn(body({ [name]: "v1:Ab3dEf9h" }), [{ q: "kittens" }], { storage: { csrf: "Ab3dEf9h" } }),
      new RegExp(`body > json:/${name} holds the live session value storage:csrf`),
    );
  }

  // so a hash the app keeps in storage is a reference as well, whatever it is kept as
  const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";
  const persisted = { extensions: { persistedQuery: { version: 1, sha256Hash: hash } } };
  const stores: [Record<string, string>, string][] = [
    [{ "pq:Search": hash }, "session:op/pq:Search"],
    [{ "apollo-cache": JSON.stringify({ Search: { id: hash } }) }, "session:op/apollo-cache/Search/id"],
  ];
  for (const [storage, ref] of stores) {
    const { operation: op } = learn(body(persisted), [{ q: "kittens" }], { storage });
    assert.deepEqual(op.slots.at(-1), { ref, at: ["body", "json:/extensions/persistedQuery/sha256Hash"] });
    assert.deepEqual(op.volatile, []);
    assert.ok(!JSON.stringify(op).includes(hash));
  }
  // control: a query id that is in no cookie and no storage stays a volatile anchor
  const { operation: plain } = learn(body(persisted), [{ q: "kittens" }], { storage: { theme: "dark-mode" } });
  assert.deepEqual(plain.slots, [{ param: "q", at: ["body", "json:/q"] }]);
  assert.deepEqual(
    plain.volatile.map((v) => v.at),
    [["body", "json:/extensions/persistedQuery/sha256Hash"]],
  );
  assert.ok(plain.request.body!.includes(hash), "the hash stays in the template for the cheap heal to swap");
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
      new RegExp(
        `keep a credential in the spec: body > json:/${Object.keys(fields)[0]} holds the live cookie ${c.name}\\.`,
      ),
      label,
    );
  }
  // a session value the learner found by name counts too, where no pass reaches its second copy
  assert.throws(
    () => learn([post(JSON.stringify({ q: "kittens", csrf: "Ab3dEf9h", ctx: "v1:Ab3dEf9h" }))], [{ q: "kittens" }]),
    /keep a credential in the spec: body > json:\/ctx holds the live session value csrf\./,
  );
  // control: a header the caller marked public may hold one
  const { operation: op } = learn(
    [xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-ctx": "v1:secret123" } })],
    [{ q: "kittens" }],
    { cookies: [cookie("sess", "secret123")], public: ["x-ctx"] },
  );
  assert.equal(op.request.headers["x-ctx"], "v1:secret123");
});

test("the scan finds a base64 copy whatever sits before it, and of a value too short to decode on its own", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const jar = (value: string) => ({ cookies: [cookie("sid", value)], values: {} });
  const found = (text: string, value: string) => scanSecrets({ state: text }, jar(value)).secrets.length > 0;

  // six characters encode to eight, under the length at which a run is decoded as one
  assert.equal(b64("aB3dE4"), "YUIzZEU0");
  assert.ok(found("YUIzZEU0", "aB3dE4"), "the short value's own encoding");
  // text in front of the encoding shifts what decoding the whole run gives
  assert.ok(found(`prefix${b64(T)}`, T), "after a prefix");
  // the value at each byte offset inside encoded text, in both alphabets
  for (const lead of ["", "x", "xy"]) {
    const inside = b64(`${lead}aB3dE4??>>tail`);
    assert.ok(found(inside, "aB3dE4??>>"), `standard alphabet, offset ${lead.length}: ${inside}`);
    assert.ok(
      found(inside.replace(/\+/g, "-").replace(/\//g, "_"), "aB3dE4??>>"),
      `URL-safe alphabet, offset ${lead.length}`,
    );
  }
  // control: other base64 text, and the encoding of a different value
  assert.ok(!found(b64("nothing to see here, move along"), "aB3dE4"));
  assert.ok(!found(b64("aB3dE5"), "aB3dE4"));

  // and learning refuses both of the reviewer's cases
  for (const [value, state] of [
    ["aB3dE4", "YUIzZEU0"],
    [T, `prefix${b64(T)}`],
  ] as const)
    assert.throws(
      () =>
        learn([post(JSON.stringify({ q: "kittens", state }))], [{ q: "kittens" }], { cookies: [cookie("sid", value)] }),
      /keep a credential in the spec: body > json:\/state holds the live cookie sid\./,
    );
});

test("the scan reports a base64 copy only when the bytes there are the value's", () => {
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const jar = (value: string) => ({ cookies: [cookie("sid", value)], values: {} });
  const found = (text: string, value: string) => scanSecrets({ cursor: text }, jar(value)).secrets.length > 0;

  // "xqbcdef" shares every character of abcdef's encoding that does not touch a neighbour: only
  // the first byte's top bits differ, and those sit in a character the value shares with what precedes it
  assert.equal(Buffer.from("eHFiY2RlZg==", "base64").toString(), "xqbcdef");
  assert.ok(!found("eHFiY2RlZg==", "abcdef"), "another value with the same middle");
  // ...and learning the request that carries such a cursor is no longer refused
  const { operation: op } = learn(
    [post(JSON.stringify({ q: "kittens", cursor: "eHFiY2RlZg==" }))],
    [{ q: "kittens" }],
    {
      cookies: [cookie("sid", "abcdef")],
    },
  );
  assert.equal(JSON.parse(op.request.body!).cursor, "eHFiY2RlZg==");

  // every byte beside the value changed in turn: the value itself is found, a neighbour of it never
  const value = "aB3dE4-z";
  for (let lead = 0; lead < 3; lead++) {
    for (let tail = 0; tail < 3; tail++) {
      const around = (v: string) => b64("xy".slice(0, lead) + v + "pq".slice(0, tail));
      assert.ok(found(`id=${around(value)}&n=1`, value), `missed at offset ${lead}, ${tail} byte(s) after`);
      for (let i = 0; i < value.length; i++) {
        const other = value.slice(0, i) + String.fromCharCode(value.charCodeAt(i) ^ 0x10) + value.slice(i + 1);
        assert.ok(!found(around(other), value), `flagged ${other} at offset ${lead}, ${tail} byte(s) after`);
      }
    }
  }
});

test("the check knows a stored credential that no pass made a reference, and no stored setting", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const run = (fields: Record<string, unknown>, extra: Parameters<typeof learn>[2]) =>
    learn([post(JSON.stringify({ q: "kittens", ...fields }))], [{ q: "kittens" }], extra);

  // under a credential's name, and random-looking inside a JSON entry under an ordinary one
  assert.throws(
    () => run({ state: b64(T) }, { storage: { token: T } }),
    /keep a credential in the spec: body > json:\/state holds the live session value storage:token\./,
  );
  assert.throws(
    () => run({ state: b64(T) }, { storage: { cache: JSON.stringify({ user: { id: T } }) } }),
    /body > json:\/state holds the live session value storage:cache\/user\/id\..*--public/,
  );
  // a short per-session value inside a longer leaf, where no pass templates it
  assert.throws(() => run({ ctx: "v1:Ab3dEf9h" }, { storage: { csrf: "Ab3dEf9h" } }), /storage:csrf/);
  // a value is a credential when any entry that holds it is one, whichever comes first in storage
  const orders: Record<string, string>[] = [
    { saved: "ordinary-value", token: "ordinary-value" },
    { token: "ordinary-value", saved: "ordinary-value" },
    { saved: "ordinary-value", auth: JSON.stringify({ token: "ordinary-value" }) },
  ];
  for (const storage of orders)
    assert.throws(
      () => run({ state: b64("ordinary-value") }, { storage }),
      /holds the live session value storage:/,
      JSON.stringify(storage),
    );

  // a setting is no credential, wherever else it turns up
  const settings = { theme: "dark-mode", prefs: JSON.stringify({ locale: "en-US-posix", tz: "Europe/Berlin" }) };
  const plain = run({ style: "dark-mode-v2", state: b64("en-US-posix|Europe/Berlin") }, { storage: settings });
  assert.deepEqual(plain.operation.slots, [{ param: "q", at: ["body", "json:/q"] }]);
  // ...also once a leaf that equals it has made it a reference: refreshable is not the same as secret
  const locale = "europe-berlin-posix";
  const sent = run({ locale, state: b64(locale) }, { storage: { locale } });
  assert.deepEqual(sent.operation.slots, [
    { param: "q", at: ["body", "json:/q"] },
    { ref: "session:op/locale", at: ["body", "json:/locale"] },
  ]);
  assert.equal(JSON.parse(sent.operation.request.body!).state, b64(locale));
  // but under a credential's name in the request the same stored text is one
  assert.throws(
    () => run({ token: locale, state: b64(locale) }, { storage: { locale } }),
    /holds the live session value locale/,
  );

  // exempt by position: a name the caller marked public, and the caller's own example
  assert.equal(
    JSON.parse(run({ state: b64(T) }, { storage: { token: T }, public: ["state"] }).operation.request.body!).state,
    b64(T),
  );
  const ID = "550e8400-e29b-41d4-a716-446655440000";
  const viewed = learn([xhr({ url: `https://api.site.test/v1/items/${ID}` })], [{ id: ID }], {
    storage: { lastViewed: ID },
  });
  assert.deepEqual(viewed.operation.slots, [{ param: "id", at: ["path:2"] }]);
  // a query-id field name exempts nothing: a stored hash sent there is a ref, and a copy of it elsewhere is found
  const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";
  assert.throws(
    () =>
      run(
        { extensions: { persistedQuery: { sha256Hash: hash } }, state: b64(hash) },
        { storage: { "pq:Search": hash } },
      ),
    /body > json:\/state holds the live session value .*pq:Search/,
  );

  // a credential container whose ref yielded to a param inside it is still looked for whole
  const csrf = JSON.stringify({ q: "kittens", n: "ab" });
  const copied = post(JSON.stringify({ q: "kittens", state: b64(csrf) }), { "x-csrf-token": csrf });
  assert.throws(
    () => learn([copied], [{ q: "kittens" }]),
    /body > json:\/state holds the live session value x-csrf-token\./,
  );
});

/* --------------------------------------------- the text beside a param */

test("the text beside a param in its leaf is judged by the leaf's name, as a whole leaf would be", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const search = "https://api.site.test/v1/search?q=";
  // A credential beside the arg cannot be a reference: no later capture could tell where the arg
  // ends and the credential begins. So every shape of it is refused, with the position and what to do.
  const refused: [string, Parameters<typeof xhr>[0]][] = [
    ["header:x-csrf-token", { url: `${search}kittens`, headers: { "x-csrf-token": `kittens.${T}` } }],
    ["query:token", { url: `${search}kittens&token=kittens.${T}` }],
    ["query:api_key", { url: `${search}kittens&api_key=${T}:kittens` }],
    ["query:token", { url: `${search}kittens&token=a1B2c3D4.kittens.${T}` }],
    ["query:token", { url: `${search}kittens&token=kittens${T}` }],
    ["query:token", { url: `${search}kittens&token=https://sso.site.test/${T}/kittens` }],
  ];
  for (const [at, request] of refused) {
    const name = at.slice(at.indexOf(":") + 1);
    assert.throws(
      () => learn([xhr(request)], [{ q: "kittens" }]),
      new RegExp(
        `^Error: ${at} holds a param inside text that is a credential .* --public ${name}; otherwise learn another request`,
      ),
      request.url,
    );
  }
  // ...and the caller's word that the text is public lets it stay
  const marked = learn([xhr(refused[1]![1])], [{ q: "kittens" }], { public: ["token"] });
  assert.deepEqual(marked.operation.slots.at(-1), { param: "q", at: ["query:token"], template: `{q}.${T}` });
  assert.deepEqual(marked.sessionValues, {});

  // an opaque token is one under any name: a UUID beside the arg, under a name that says nothing
  assert.throws(
    () =>
      learn([xhr({ url: `${search}kittens&ctx=kittens|550e8400-e29b-41d4-a716-446655440000` })], [{ q: "kittens" }]),
    /^Error: query:ctx holds a param inside text that is a credential \(an unbroken random-looking run/,
  );
});

test("structured text beside a param is no credential, whatever the leaf is called", () => {
  // a name that reads like a credential's, and text long and mixed enough to look random as a whole
  const keys = [
    "search:kittens:page1",
    "query:kittens:page:1:sort:relevance",
    "search:kittens:locale:en-US:v2",
    "search:kittens:page1:sort:updated",
    // words and numbers joined by - or _ are structure too, and so is a path
    "kittens-care-guide-2024-v2",
    "list_kittens_sorted_by_price_desc_v2",
    "/v2/items/kittens/reviews/page/1",
  ];
  for (const cacheKey of keys) {
    const { operation: op, sessionValues } = learn(
      [post(JSON.stringify({ q: "kittens", cache_key: cacheKey }))],
      [{ q: "kittens" }],
    );
    const slot = op.slots.at(-1)!;
    assert.deepEqual(
      [slot.param, slot.at.join(" > "), slot.template],
      ["q", "body > json:/cache_key", cacheKey.replace("kittens", "{q}")],
      cacheKey,
    );
    assert.deepEqual(sessionValues, {});
    assert.deepEqual(JSON.parse(buildRequest(op, { q: "tigers" }, noSession).body!), {
      q: "tigers",
      cache_key: cacheKey.replace("kittens", "tigers"),
    });
  }
});

test("beside a param under an ordinary name, a known live value too short to template is refused by the check", () => {
  const ctx = (value: string) => [
    xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-ctx": `kittens.${value}` } }),
  ];
  assert.throws(
    () => learn(ctx("secret123"), [{ q: "kittens" }], { cookies: [cookie("sess", "secret123")] }),
    /keep a credential in the spec: header:x-ctx holds the live cookie sess; the template for header:x-ctx holds the live cookie sess\./,
  );
  assert.throws(
    () => learn(ctx("Ab3dEf9h"), [{ q: "kittens" }], { storage: { csrf: "Ab3dEf9h" } }),
    /keep a credential in the spec: the template for header:x-ctx holds the live session value storage:csrf\./,
  );
  // control: the same leaf with nothing known in it learns
  assert.equal(learn(ctx("Ab3dEf9h"), [{ q: "kittens" }]).operation.slots.length, 2);
});

/* ------------------------------------------- what example 2 disproves */

const noSession = { cookies: [] as StoredCookie[], values: {} as Record<string, string> };
const answer = (q: string) => ({ results: [{ title: `${q} one` }, { title: `${q} two` }] });

test("a place the second example disproves is kept as the constant it is, not filled", () => {
  // "search" is the endpoint's own path segment and the first query; only the query follows in run 2
  const run = (q: string, headers: Record<string, string> = {}) => [
    xhr({ url: `https://site.test/api/search?q=${q}`, headers }, answer(q)),
  ];
  const { operation: op, warnings } = learn(run("search"), [{ q: "search" }, { q: "kitten" }], {
    exchanges2: run("kitten"),
  });
  assert.deepEqual(op.slots, [{ param: "q", at: ["query:q"] }]);
  assert.equal(op.match.path, "/api/search", "the segment is no param, so the match names it");
  assert.equal(buildRequest(op, { q: "puppy" }, noSession).url, "https://site.test/api/search?q=puppy");
  assert.ok(
    warnings.some((w) => /path:1 is "search" in both runs/.test(w)),
    warnings.join("\n"),
  );

  // inside a longer leaf too: the header holds "search" by coincidence and never changes
  const app = { "x-app": "websearch-v2" };
  const templated = learn(run("search", app), [{ q: "search" }, { q: "kitten" }], { exchanges2: run("kitten", app) });
  assert.deepEqual(templated.operation.slots, [{ param: "q", at: ["query:q"] }]);
  assert.equal(buildRequest(templated.operation, { q: "puppy" }, noSession).headers["x-app"], "websearch-v2");

  // a sibling endpoint with the richer answer fits the first match (/api/*) too: run 2 is read on run 1's own path
  const both = (q: string) => [
    ...run(q),
    xhr({ url: `https://site.test/api/suggest?q=${q}` }, { suggestions: Array(40).fill({ text: `${q} and more` }) }),
  ];
  const first = both("search");
  const picked = learn(first, [{ q: "search" }, { q: "kitten" }], { exchanges2: both("kitten"), id: first[0]!.id });
  assert.deepEqual(picked.operation.slots, [{ param: "q", at: ["query:q"] }]);

  // control: one example cannot tell, so both places are filled, with a warning
  const one = learn(run("search"), [{ q: "search" }]);
  assert.equal(one.operation.slots.length, 2);
});

test("a param whose every place the second example disproves is a failure to learn", () => {
  const run = () => [xhr({ url: "https://site.test/api/search?sort=new" }, answer("search"))];
  assert.throws(
    () => learn(run(), [{ q: "search" }, { q: "kitten" }], { exchanges2: run() }),
    /example 2 disproves "q": path:1 is "search" in both runs.*would change nothing/,
  );
});

test("run 2's request is chosen on run 1's evidence: a request that does not answer like it disproves nothing", () => {
  // the path segment is the param; in run 2 the page also pings the first path, which only acknowledges
  const run1 = [xhr({ url: "https://site.test/api/alpha?q=alpha" }, answer("alpha"))];
  const second = (stale: unknown) => [
    xhr({ url: "https://site.test/api/alpha?q=bravo" }, stale),
    xhr({ url: "https://site.test/api/bravo?q=bravo" }, answer("bravo")),
  ];
  const recipe = (e: Exchange) => (e.response?.body ?? "").includes('"results"');
  const cases: [unknown, ((e: Exchange) => boolean) | undefined][] = [
    [{ success: true }, undefined],
    [{ success: true }, recipe],
    // data, but not what the recipe reads
    [{ related: [{ name: "bravo and friends" }, { name: "bravo again" }] }, recipe],
  ];
  for (const [stale, accepts] of cases) {
    const { operation: op } = learn(run1, [{ q: "alpha" }, { q: "bravo" }], { exchanges2: second(stale), accepts });
    assert.deepEqual(op.slots, [
      { param: "q", at: ["path:1"] },
      { param: "q", at: ["query:q"] },
    ]);
    assert.equal(op.match.path, "/api/*");
    assert.equal(buildRequest(op, { q: "charlie" }, noSession).url, "https://site.test/api/charlie?q=charlie");
  }
  // a run 2 with nothing that answers like run 1 is no grounds for dropping a slot
  const alone = learn(run1, [{ q: "alpha" }, { q: "bravo" }], { exchanges2: second({ success: true }).slice(0, 1) });
  assert.equal(alone.operation.slots.length, 2);
  assert.ok(
    alone.warnings.some((w) => /run 2's matching request .* disproves nothing/.test(w)),
    alone.warnings.join("\n"),
  );
});

test("a run 2 request with no answer, or an error for one, is no data answer and disproves nothing", () => {
  const run1 = [xhr({ url: "https://site.test/api/kittens?q=kittens" }, answer("kittens"))];
  const stale = xhr({ url: "https://site.test/api/kittens?q=puppies" });
  const fresh = xhr({ url: "https://site.test/api/puppies?q=puppies" }, answer("puppies"));
  const unanswered: Exchange = { ...stale, response: undefined };
  const failed: Exchange = {
    ...stale,
    response: { ...stale.response!, status: 404, body: '{"error":"no such list"}' },
  };
  for (const old of [unanswered, failed]) {
    const { operation: op } = learn(run1, [{ q: "kittens" }, { q: "puppies" }], { exchanges2: [old, fresh] });
    assert.deepEqual(op.slots, [
      { param: "q", at: ["path:1"] },
      { param: "q", at: ["query:q"] },
    ]);
    assert.equal(buildRequest(op, { q: "tigers" }, noSession).url, "https://site.test/api/tigers?q=tigers");
    // alone, it may show a nonce but takes no slot away
    const alone = learn(run1, [{ q: "kittens" }, { q: "puppies" }], { exchanges2: [old] });
    assert.equal(alone.operation.slots.length, 2);
  }
});

test("a read the caller pinned whose own answer is a flag is its own counterpart in run 2", () => {
  // "is this liked?" answers {"liked":true}: no data by the ranking's lights, and the op all the same
  const liked = (id: number) => [xhr({ url: `https://site.test/api/liked?id=${id}&v=42` }, { liked: true })];
  const { operation: op, warnings } = learn(liked(42), [{ id: 42 }, { id: 43 }], {
    exchanges2: liked(43),
    match: { path: "/api/liked" },
  });
  assert.deepEqual(op.slots, [{ param: "id", at: ["query:id"] }]);
  assert.ok(!warnings.some((w) => /disproves nothing/.test(w)), warnings.join("\n"));
});

/* ------------------------------------------------------ short examples */

// The visitor's own country rides along as gl=US on every request, whatever country is asked for.
const byCountry = (c: string) => [
  xhr({ url: "https://api.site.test/v1/geo?gl=US" }, { stores: Array(60).fill({ city: "Springfield", open: true }) }),
  xhr({ url: `https://api.site.test/v1/top?country=${c}&gl=US&lang=en-${c}` }, answer(`top in ${c}`)),
];

test("a short example is placed where a whole leaf equals it and follows a different second example", () => {
  const { operation: op, exchange } = learn(byCountry("US"), [{ q: "US" }, { q: "CA" }], {
    exchanges2: byCountry("CA"),
  });
  assert.equal(new URL(exchange.request.url).pathname, "/v1/top", "the request whose leaf follows, not the bigger one");
  assert.deepEqual(op.slots, [{ param: "q", at: ["query:country"] }]);
  assert.equal(
    buildRequest(op, { q: "DE" }, noSession).url,
    "https://api.site.test/v1/top?country=DE&gl=US&lang=en-US",
  );

  // a page number: a JSON number beside another 2 that is no page
  const page = (n: number) => [post(JSON.stringify({ q: "kittens", page: n, size: 2 }))];
  const paged = learn(
    page(2),
    [
      { q: "kittens", page: 2 },
      { q: "kittens", page: 3 },
    ],
    { exchanges2: page(3) },
  );
  assert.deepEqual(paged.operation.slots, [
    { param: "q", at: ["body", "json:/q"] },
    { param: "page", at: ["body", "json:/page"] },
  ]);
  assert.equal(paged.operation.params.find((p) => p.name === "page")!.type, "number");
  assert.equal(buildRequest(paged.operation, { q: "cats", page: 7 }, noSession).body, '{"q":"cats","page":7,"size":2}');
  assert.equal(paged.operation.minTier, 1, paged.warnings.join("\n"));
});

test("the evidence for a short example is the same endpoint in run 2, not any request to the host", () => {
  const records = (n: number, of: string) => ({ items: Array.from({ length: n }, (_, i) => ({ id: i, of })) });
  // the feed always asks for US and answers with more; only /top follows the example
  const run = (c: string) => [
    xhr({ url: "https://api.site.test/api/feed?country=US" }, records(100, "US")),
    xhr({ url: `https://api.site.test/api/top?country=${c}` }, records(2, c)),
  ];
  const { operation: op, exchange } = learn(run("US"), [{ country: "US" }, { country: "CA" }], {
    exchanges2: run("CA"),
  });
  assert.equal(new URL(exchange.request.url).pathname, "/api/top");
  assert.deepEqual(op.slots, [{ param: "country", at: ["query:country"] }]);

  // the same endpoint, allowing for path segments that are params themselves
  const posts = (user: string, page: number) => [
    xhr({ url: `https://api.site.test/v1/users/${user}/posts?page=${page}` }, records(3, user)),
  ];
  const paged = learn(
    posts("alice", 2),
    [
      { user: "alice", page: 2 },
      { user: "bobby", page: 3 },
    ],
    { exchanges2: posts("bobby", 3) },
  );
  assert.deepEqual(paged.operation.slots, [
    { param: "user", at: ["path:2"] },
    { param: "page", at: ["query:page"] },
  ]);
  const top = (c: string) => [xhr({ url: `https://api.site.test/v1/top/${c}` }, records(3, c))];
  const segment = learn(top("US"), [{ country: "US" }, { country: "CA" }], { exchanges2: top("CA") });
  assert.deepEqual(segment.operation.slots, [{ param: "country", at: ["path:2"] }]);
});

test("a short example without that evidence is refused, with a hint to pass a second one", () => {
  const hint = /q="US": example values need at least 3 characters.*second example/;
  assert.throws(() => learn(byCountry("US"), [{ q: "US" }]), hint);
  assert.throws(() => learn(byCountry("US"), [{ q: "US" }, { q: "us" }], { exchanges2: byCountry("US") }), hint);
  assert.throws(() => learn(byCountry("US"), [{ q: "US" }, { q: "CA" }]), hint, "a second example needs its run");
  // a second run in which no leaf follows: every US is somebody else's
  assert.throws(
    () =>
      learn(byCountry("US"), [{ q: "US" }, { q: "CA" }], { exchanges2: byCountry("US"), match: { path: "/v1/top" } }),
    /example 2 disproves "q": query:country is "US" in both runs.*query:gl is "US" in both runs/,
  );
  // a second run without the request: nothing confirms the place
  assert.throws(
    () => learn(byCountry("US"), [{ q: "US" }, { q: "CA" }], { exchanges2: [], match: { path: "/v1/top" } }),
    /run 2 produced no request matching .*short example of q/,
  );
  // inside a longer leaf only: a short value is never a part of one
  const lang = (c: string) => [xhr({ url: `https://api.site.test/v1/top?lang=en-${c}` })];
  assert.throws(
    () => learn(lang("US"), [{ q: "US" }, { q: "CA" }], { exchanges2: lang("CA"), match: { path: "/v1/top" } }),
    /"q" \("US"\) is not in the learned request.*whole leaf/,
  );
});

test("a short example in either set asks whole-leaf evidence of both", () => {
  // only the second example is short: it must not be placed inside en-US by way of the first
  const lang = (c: string) => [xhr({ url: `https://api.site.test/v1/top?lang=en-${c}` })];
  assert.throws(
    () => learn(lang("USA"), [{ q: "USA" }, { q: "US" }], { exchanges2: lang("US") }),
    /no captured request carries the example values/,
  );
  assert.throws(
    () => learn(lang("USA"), [{ q: "USA" }, { q: "US" }], { exchanges2: lang("US"), match: { path: "/v1/top" } }),
    /"q" \("USA"\) is not in the learned request.*whole leaf/,
  );
  assert.throws(
    () => learn(lang("USA"), [{ q: "USA" }, { q: "US" }]),
    /example 2 q="US": example values need at least 3 characters.*second example/,
    "a short second example needs its run too",
  );
  // control: whole leaves in both runs
  const whole = (c: string) => [xhr({ url: `https://api.site.test/v1/top?country=${c}&lang=en-${c}` })];
  const { operation: op } = learn(whole("USA"), [{ q: "USA" }, { q: "US" }], { exchanges2: whole("US") });
  assert.deepEqual(op.slots, [{ param: "q", at: ["query:country"] }]);
});

test("add checks a short example before any browser run, and learns one from two captures", async () => {
  const capture = (c: string): CaptureFile => ({
    id: `slots-${c}`,
    at: new Date().toISOString(),
    url: `https://site.test/top?country=${c}`,
    finalUrl: `https://site.test/top?country=${c}`,
    exchanges: byCountry(c),
    cookies: [],
  });
  const add = { site: "slots", op: "top", trigger: { url: "https://site.test/top?country={q}" } };
  // no capture and no Chrome is reached: the check comes first
  await assert.rejects(addOperation({ ...add, examples: [{ q: "US" }] }), /at least 3 characters.*second example/);
  await assert.rejects(
    addOperation({ ...add, examples: [{ q: "US" }, { q: "US" }] }),
    /at least 3 characters.*second example/,
  );
  const r = await addOperation({
    ...add,
    examples: [{ q: "US" }, { q: "CA" }],
    from: { capture: capture("US") },
    from2: capture("CA"),
  });
  assert.deepEqual(r.operation.slots, [{ param: "q", at: ["query:country"] }]);
});
