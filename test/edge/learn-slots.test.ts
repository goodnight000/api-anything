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

/* ------------------------------------------------------- repeated keys */

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
