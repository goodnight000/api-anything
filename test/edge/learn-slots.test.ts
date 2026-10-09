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
