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
    () => run({ sig: `kittens.${T}` }),
    /header:x-csrf-token > json:\/sig is only partly a slot inside the credential header:x-csrf-token/,
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

/* -------------------------------------------------- cached query hashes */

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

test("the check knows a stored credential that no pass made a reference, and no stored setting", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const b64 = (s: string) => Buffer.from(s).toString("base64");
  const run = (fields: Record<string, unknown>, extra: Parameters<typeof learn>[2]) =>
    learn([post(JSON.stringify({ q: "kittens", ...fields }))], [{ q: "kittens" }], extra);

  // under a credential's name, and random-looking inside a JSON entry under an ordinary one
  assert.throws(
    () => run({ state: b64(T) }, { storage: { token: T } }),
    /keep a credential in the spec: \$\.request\.body holds the live session value storage:token/,
  );
  assert.throws(
    () => run({ state: b64(T) }, { storage: { cache: JSON.stringify({ user: { id: T } }) } }),
    /\$\.request\.body holds the live session value storage:cache\/user\/id.*--public/,
  );
  // a short per-session value inside a longer leaf, where no pass templates it
  assert.throws(() => run({ ctx: "v1:Ab3dEf9h" }, { storage: { csrf: "Ab3dEf9h" } }), /storage:csrf/);

  // a setting is no credential, wherever else it turns up
  const settings = { theme: "dark-mode", prefs: JSON.stringify({ locale: "en-US-posix", tz: "Europe/Berlin" }) };
  const plain = run({ style: "dark-mode-v2", state: b64("en-US-posix|Europe/Berlin") }, { storage: settings });
  assert.deepEqual(plain.operation.slots, [{ param: "q", at: ["body", "json:/q"] }]);

  // exempt by position: a name the caller marked public, the caller's own example, a cached query hash
  assert.equal(
    JSON.parse(run({ state: b64(T) }, { storage: { token: T }, public: ["state"] }).operation.request.body!).state,
    b64(T),
  );
  const ID = "550e8400-e29b-41d4-a716-446655440000";
  const viewed = learn([xhr({ url: `https://api.site.test/v1/items/${ID}` })], [{ id: ID }], {
    storage: { lastViewed: ID },
  });
  assert.deepEqual(viewed.operation.slots, [{ param: "id", at: ["path:2"] }]);
  const hash = "e0f2a1b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f";
  const cached = run({ extensions: { persistedQuery: { sha256Hash: hash } } }, { storage: { "pq:Search": hash } });
  assert.equal(cached.operation.volatile.length, 1);
  // ...which waives the position, not the value: the same hash elsewhere is still looked for
  assert.throws(
    () =>
      run(
        { extensions: { persistedQuery: { sha256Hash: hash } }, state: b64(hash) },
        { storage: { "pq:Search": hash } },
      ),
    /storage:pq:Search/,
  );

  // a credential container whose ref yielded to a param inside it is still looked for whole
  const csrf = JSON.stringify({ q: "kittens", n: "ab" });
  const copied = post(JSON.stringify({ q: "kittens", state: b64(csrf) }), { "x-csrf-token": csrf });
  assert.throws(() => learn([copied], [{ q: "kittens" }]), /request\.body holds the live session value x-csrf-token/);
});

/* --------------------------------------------- the text beside a param */

test("the text beside a param in its leaf is judged by the leaf's name, as a whole leaf would be", () => {
  const T = "k7Qm9xLp3Rv8Tz1Wn5Ys6Ub4Hc2Jd0Fa";
  const T2 = "Zx9Qw8vLm7Kj6HgF5dS4aP3oI2uY1tRe";
  const search = "https://api.site.test/v1/search?q=";
  // [where the leaf is, the request for an arg and a token, the leaf's text for them]
  const shapes: [string, (q: string, t: string) => Parameters<typeof xhr>[0], (q: string, t: string) => string][] = [
    [
      "header:x-csrf-token",
      (q, t) => ({ url: search + q, headers: { "x-csrf-token": `${q}.${t}` } }),
      (q, t) => `${q}.${t}`,
    ],
    ["query:token", (q, t) => ({ url: `${search}${q}&token=${q}.${t}` }), (q, t) => `${q}.${t}`],
    ["query:api_key", (q, t) => ({ url: `${search}${q}&api_key=${t}:${q}` }), (q, t) => `${t}:${q}`],
  ];
  for (const [at, request, text] of shapes) {
    const { operation: op, sessionValues } = learn([xhr(request("kittens", T))], [{ q: "kittens" }, { q: "puppies" }], {
      exchanges2: [xhr(request("puppies", T2))],
    });
    assert.ok(!JSON.stringify(op).includes(T), `${at}: the token stayed in the spec`);
    const slot = op.slots.find((s) => s.at[0] === at)!;
    assert.equal(slot.template!.replace(/\{session:[^}]+\}/, "<ref>"), text("{q}", "<ref>"));
    assert.deepEqual(Object.values(sessionValues), [T], "the token is stored, without the separator or the arg");
    assert.equal(op.minTier, 1, "another session's token in run 2 is no nonce");
    const sent = buildRequest(op, { q: "tigers" }, { cookies: [], values: sessionValues });
    const got = at.startsWith("header:") ? sent.headers[at.slice(7)] : new URL(sent.url).searchParams.get(at.slice(6));
    assert.equal(got, text("tigers", T));
  }

  // control: a credential-like name whose leftover text is no credential by the same test changes nothing
  const cache = learn([xhr({ url: `${search}kittens&cache_key=search:kittens:page1` })], [{ q: "kittens" }]);
  assert.deepEqual(cache.operation.slots.at(-1), {
    param: "q",
    at: ["query:cache_key"],
    template: "search:{q}:page1",
  });
  assert.deepEqual(cache.sessionValues, {});
  assert.equal(
    buildRequest(cache.operation, { q: "tigers" }, noSession).url,
    `${search}tigers&cache_key=search:tigers:page1`,
  );

  // what cannot be one clean hole refuses, naming the position
  const refused: [string, RegExp][] = [
    [`token=a1B2c3D4.kittens.${T}`, /query:token holds a param inside text that is a credential .* several pieces/],
    [`token=kittens${T}`, /query:token holds a param inside text that is a credential .* nothing separates/],
    [
      `token=https://sso.site.test/${T}/kittens`,
      /query:token holds a param inside text that is a credential .* escaped/,
    ],
  ];
  for (const [pair, why] of refused)
    assert.throws(() => learn([xhr({ url: `${search}kittens&${pair}` })], [{ q: "kittens" }]), why);
});

test("beside a param under an ordinary name, a known live value too short to template is refused by the check", () => {
  const ctx = (value: string) => [
    xhr({ url: "https://api.site.test/v1/search?q=kittens", headers: { "x-ctx": `kittens.${value}` } }),
  ];
  assert.throws(
    () => learn(ctx("secret123"), [{ q: "kittens" }], { cookies: [cookie("sess", "secret123")] }),
    /keep a credential in the spec: .*holds the live cookie sess/,
  );
  assert.throws(
    () => learn(ctx("Ab3dEf9h"), [{ q: "kittens" }], { storage: { csrf: "Ab3dEf9h" } }),
    /keep a credential in the spec: \$\.slots\[1\]\.template holds the live session value storage:csrf/,
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
