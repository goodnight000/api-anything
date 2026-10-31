/** Derived slots: a value the page looks up with an earlier request (a slug's numeric id). */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { call } from "../src/execute.js";
import { learnOperation } from "../src/learn.js";
import { derive, LookupFailed } from "../src/lookup.js";
import { type Operation, parseSite, type Site } from "../src/spec.js";
import { exportSite, saveSite } from "../src/store.js";
import type { Exchange, StoredCookie } from "../src/types.js";
import { vetShared } from "../src/vet.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-derived-"));
process.env.API_ANYTHING_HOME = HOME;

let fx: Fixture;
before(async () => {
  fx = await startFixture();
});
after(async () => {
  await fx.close();
  rmSync(HOME, { recursive: true, force: true });
});
beforeEach(() => {
  fx.calls.length = 0;
});

// a CSRF cookie the page echoes in a header of both requests: a cookie: ref in each template, never its value
const CSRF = "c5rf0123456789abcdef0123";
const SESSION = "sess9876543210fedcba9876";
const cookies = (): StoredCookie[] =>
  [
    ["csrf", CSRF],
    ["sid", SESSION],
  ].map(([name, value]) => ({
    name: name!,
    value: value!,
    domain: "127.0.0.1",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
  }));

/**
 * What a browser saw on /p/<slug>: the page, the lookup of the slug's id, then the reviews by that id;
 * with `like`, the like the page posts instead, intercepted as a write's learning run does.
 */
async function pageRun(slug: string, o: { like?: boolean } = {}): Promise<Exchange[]> {
  const out: Exchange[] = [];
  const headers = {
    accept: "*/*",
    "user-agent": "Mozilla/5.0 Chrome/153.0.0.0",
    referer: `${fx.url}/p/${slug}`,
    cookie: `csrf=${CSRF}; sid=${SESSION}`,
    "x-csrf-token": CSRF,
  };
  const fetched = async (resourceType: string, path: string): Promise<string> => {
    const url = fx.url + path;
    const res = await fetch(url, { headers });
    const body = await res.text();
    out.push({
      id: out.length + 1,
      resourceType,
      request: { method: "GET", url, headers: { ...headers } },
      response: {
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body,
        contentType: res.headers.get("content-type") ?? "",
      },
    });
    return body;
  };
  await fetched("document", `/p/${slug}`);
  const { product } = JSON.parse(await fetched("fetch", `/api/resolve?slug=${slug}`)) as { product: { id: number } };
  if (!o.like) await fetched("fetch", `/api/products/${product.id}/reviews`);
  else
    out.push({
      id: out.length + 1,
      resourceType: "fetch",
      request: {
        method: "POST",
        url: `${fx.url}/api/products/${product.id}/like`,
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ stars: 5 }),
      },
      aborted: true,
    });
  return out;
}

const learnInput = async (o: { like?: boolean; one?: boolean } = {}) => ({
  exchanges: await pageRun("blue-mug", o),
  ...(o.one ? {} : { exchanges2: await pageRun("red-kettle", o) }),
  examples: (o.one ? [{ slug: "blue-mug" }] : [{ slug: "blue-mug" }, { slug: "red-kettle" }]) as
    | [Record<string, unknown>]
    | [Record<string, unknown>, Record<string, unknown>],
  cookies: cookies(),
  // a visitor's cookies, which every guest gets: learned signed out
  guestCookies: ["csrf", "sid"],
  name: o.like ? "like" : "reviews",
  trigger: { url: `${fx.url}/p/{slug}` },
  readOnly: !o.like,
  // the recipe names the reviews: the request that answers them carries no example value
  ...(o.like ? {} : { accepts: (e: Exchange) => (e.response?.body ?? "").includes('"reviews"') }),
});

const shop = (...operations: Operation[]): Site =>
  parseSite({ name: "shop", baseUrl: fx.url, operations: operations.map((x) => ({ ...x })) });

/** Run with a fixture of its own, for a test that changes the server's state. */
async function ownFixture(fn: () => Promise<void>): Promise<void> {
  const saved = fx;
  fx = await startFixture();
  try {
    await fn();
  } finally {
    await fx.close();
    fx = saved;
  }
}

const apiCalls = () => fx.calls.map((c) => `${c.method} ${c.path}`);

test("learning: the reviews' id is looked up by the slug, a template of its own with refs only", async () => {
  const { operation: op, warnings } = learnOperation(await learnInput());
  const derived = op.slots.filter((s) => s.from);
  assert.equal(derived.length, 1, JSON.stringify(op.slots));
  const [slot] = derived;
  assert.deepEqual(slot!.at, ["path:2"]);
  assert.equal(slot!.path, "product.id");
  assert.equal(slot!.from!.request.method, "GET");
  assert.equal(new URL(slot!.from!.request.url).pathname, "/api/resolve");
  assert.deepEqual(
    slot!.from!.slots.find((s) => s.param),
    { param: "slug", at: ["query:slug"] },
  );
  // the slug's only place in the op's own request is the page URL the Referer echoes
  assert.deepEqual(
    op.slots.filter((s) => s.param === "slug" || s.template?.includes("{slug}")).map((s) => s.at),
    [["header:referer"]],
  );
  assert.deepEqual(
    op.params.map((p) => p.name),
    ["slug"],
  );
  assert.equal(op.minTier, 1, warnings.join("; "));
  assert.equal(op.match.path, "/api/products/*/reviews");
  assert.ok(warnings.some((w) => /looked up before each call/.test(w)));

  // no credential in the serialized spec: the CSRF header is a cookie: ref in both templates
  const text = JSON.stringify(op);
  assert.ok(!text.includes(CSRF) && !text.includes(SESSION), text);
  assert.ok(slot!.from!.slots.some((s) => s.ref === "cookie:csrf" && s.at[0] === "header:x-csrf-token"));
  assert.ok(op.slots.some((s) => s.ref === "cookie:csrf"));
});

test("export: the derived leaf and the lookup's example go, and so does every credential", async () => {
  const op = learnOperation(await learnInput()).operation;
  saveSite(shop(op));
  const { spec, secrets } = exportSite("shop");
  assert.deepEqual(secrets, []);
  const [out] = spec.operations;
  assert.equal(new URL(out!.request.url).pathname, "/api/products/0/reviews");
  const from = out!.slots.find((s) => s.from)!.from!;
  assert.equal(decodeURIComponent(new URL(from.request.url).search), "?slug={slug}");
  const text = JSON.stringify(spec);
  for (const v of ["blue-mug", "4821", CSRF, SESSION]) assert.ok(!text.includes(v), v);
});

test("one example: the looked-up value is named as the obstacle, not a click or a login", async () => {
  const input = await learnInput({ one: true });
  assert.throws(
    () => learnOperation(input),
    (e: Error) =>
      /"slug"/.test(e.message) &&
      /an earlier request looked up/.test(e.message) &&
      /product\.id/.test(e.message) &&
      /--example2/.test(e.message),
  );
});

test("a recapture (one run) keeps the derived slot where the op had it", async () => {
  const learned = learnOperation(await learnInput()).operation;
  const { operation: again } = learnOperation({
    ...(await learnInput({ one: true })),
    match: learned.match,
    derived: [{ at: ["path:2"], path: "product.id" }],
  });
  assert.deepEqual(
    again.slots.filter((s) => s.from).map((s) => [s.at, s.path]),
    [[["path:2"], "product.id"]],
  );
});

test("tier 1: the lookup goes first, its answer fills the path, and a lookup that fails sends nothing more", async () => {
  const op = learnOperation(await learnInput()).operation;
  saveSite(shop(op));
  const opts = { maxTier: 1 as const, minIntervalMs: 0 };
  fx.calls.length = 0;

  const r = await call("shop", "reviews", { slug: "green-plate" }, opts);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(JSON.stringify(r.data), /Green plate: holds up well/);
  assert.deepEqual(apiCalls(), ["GET /api/resolve?slug=green-plate", "GET /api/products/6033/reviews"]);
  // the session's cookie fills the lookup's ref as it fills the op's
  assert.equal(fx.calls[0]!.headers["x-csrf-token"], undefined, "no cookie in this session: the header is dropped");

  // a slug that does not exist: the lookup's 404 is the call's answer, and its reviews are never asked for
  fx.calls.length = 0;
  const missing = await call("shop", "reviews", { slug: "no-such-thing" }, opts);
  assert.equal(missing.ok, false);
  assert.equal(missing.class, "input", JSON.stringify(missing));
  // the example's lookup and reviews are what tell "no such slug" from drift
  assert.deepEqual(
    apiCalls().filter((c) => c.includes("/reviews")),
    ["GET /api/products/4821/reviews"],
  );
});

test("a lookup whose answer moved its value is drift: no op request goes out, and heal is reactive", async () => {
  await ownFixture(async () => {
    const op = learnOperation(await learnInput()).operation;
    saveSite(shop(op));
    fx.moveLookup();
    fx.calls.length = 0;
    const r = await call("shop", "reviews", { slug: "green-plate" }, { maxTier: 1, minIntervalMs: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.class, "drift", JSON.stringify(r));
    assert.match(r.reason ?? "", /lookup .*\/api\/resolve.*product\.id/);
    // the stored template, lookup first, every time: the reviews never went out
    assert.ok(apiCalls().length >= 1);
    assert.ok(
      apiCalls().every((c) => c.startsWith("GET /api/resolve")),
      apiCalls().join("\n"),
    );
  });
});

test("a write whose id a read looks up: refused without allowWrites, then the lookup and the write once", async () => {
  await ownFixture(async () => {
    const input = await learnInput({ like: true });
    const { operation: op } = learnOperation(input);
    assert.equal(op.readOnly, false);
    assert.equal(op.request.method, "POST");
    const [slot] = op.slots.filter((s) => s.from);
    assert.deepEqual(slot?.at, ["path:2"]);
    assert.equal(slot!.from!.request.method, "GET");
    saveSite(shop(op));
    fx.calls.length = 0;

    const refused = await call("shop", "like", { slug: "green-plate" }, { maxTier: 1, minIntervalMs: 0 });
    assert.equal(refused.class, "refused");
    assert.deepEqual(apiCalls(), [], "not even the lookup goes without allowWrites");

    const r = await call("shop", "like", { slug: "green-plate" }, { maxTier: 1, minIntervalMs: 0, allowWrites: true });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(apiCalls(), ["GET /api/resolve?slug=green-plate", "POST /api/products/6033/like"]);

    // the lookup fails: the write was not sent, and says so
    fx.calls.length = 0;
    const lost = await call(
      "shop",
      "like",
      { slug: "no-such-thing" },
      { maxTier: 1, minIntervalMs: 0, allowWrites: true },
    );
    assert.equal(lost.ok, false);
    assert.equal(lost.write, "not_sent", JSON.stringify(lost));
    assert.ok(!apiCalls().some((c) => c.startsWith("POST")), apiCalls().join("\n"));
  });
});

test("vet: a shared spec's lookup is a GET on the op's own host, reads one value and holds no credential", () => {
  const op = (from: object, path = "product.id") => ({
    name: "reviews",
    readOnly: true,
    request: { method: "GET", url: "https://shop.example.com/api/products/4821/reviews", headers: {} },
    slots: [{ at: ["path:2"], from, path }],
    params: [{ name: "slug" }],
    trigger: { url: "https://shop.example.com/p/{slug}" },
    match: { method: "GET", host: "shop.example.com", path: "/api/products/*/reviews" },
  });
  const lookup = (url: string, method = "GET", headers: Record<string, string> = {}) => ({
    request: { method, url, headers },
    slots: [{ param: "slug", at: ["query:slug"] }],
  });
  const errors = (o: object) =>
    vetShared(parseSite({ name: "shop", baseUrl: "https://shop.example.com", operations: [o] })).errors;

  assert.deepEqual(errors(op(lookup("https://shop.example.com/api/resolve?slug=blue-mug"))), []);
  assert.ok(errors(op(lookup("https://evil.example.com/api/resolve?slug=blue-mug"))).some((e) => /own host/.test(e)));
  assert.ok(errors(op(lookup("http://127.0.0.1/api/resolve?slug=x"))).some((e) => /lookup/.test(e)));
  assert.ok(errors(op(lookup("https://shop.example.com/api/resolve", "POST"))).some((e) => /not a GET/.test(e)));
  assert.ok(
    errors(op(lookup("https://shop.example.com/api/resolve?slug=x"), "items[*].id")).some((e) => /one value/.test(e)),
  );
  assert.ok(
    errors(
      op(
        lookup("https://shop.example.com/api/resolve?slug=x", "GET", {
          authorization: "Bearer abcdefghijklmnop1234567890",
        }),
      ),
    ).some((e) => /literal credential/.test(e)),
  );
});

// A lookup's answer is text the site's users may write (a bio): it is held to the read rules an arg is.
const graphqlRead = (at: string[], body = '{"query":"query { me { id } }"}') =>
  parseSite({
    name: "shop",
    baseUrl: "https://shop.example.com",
    operations: [
      {
        name: "profile",
        readOnly: true,
        request: {
          method: "POST",
          url: "https://shop.example.com/graphql",
          headers: { "content-type": "application/json" },
          body,
        },
        slots: [
          {
            at,
            from: {
              request: { method: "GET", url: "https://shop.example.com/api/user?name=x", headers: {} },
              slots: [{ param: "name", at: ["query:name"] }],
            },
            path: "user.bio",
          },
        ],
        params: [{ name: "name" }],
        trigger: { url: "https://shop.example.com/u/{name}" },
        match: { method: "POST", host: "shop.example.com", path: "/graphql" },
      },
    ],
  });

test("vet: a looked-up value never fills a read's GraphQL document, its whole body or a header", () => {
  const errors = (s: Site) => vetShared(s).errors.join("\n");
  assert.match(errors(graphqlRead(["body", "json:/query"])), /GraphQL document/);
  assert.match(errors(graphqlRead(["body"])), /whole body/);
  assert.match(errors(graphqlRead(["header:x-http-method-override"])), /path, query or body/);
});

test("a looked-up value that is no identifier is refused before the read is sent, however deep it lands", async () => {
  const answer = (bio: string) => async () => ({
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user: { bio } }),
  });
  const refused = (e: Error) => e instanceof LookupFailed && /not an identifier/.test(e.message);
  const op = graphqlRead(["body", "json:/query"]).operations[0]!;
  await assert.rejects(derive(op, answer("mutation { deleteAccount }")), refused);
  await assert.rejects(derive(op, answer("mutation{deleteAccount}")), refused);
  // a document inside a base64 envelope the vet cannot read: the value alone decides
  const inner = Buffer.from(JSON.stringify([{ query: "query { me { id } }" }])).toString("base64");
  const enveloped = graphqlRead(
    ["body", "json:/requests", "b64", "json:/0/query"],
    JSON.stringify({ requests: inner }),
  );
  await assert.rejects(derive(enveloped.operations[0]!, answer("mutation { deleteAccount }")), refused);
  // an id is what a lookup is for
  const id = await derive(enveloped.operations[0]!, answer("Z2lkOi8vc2hvcC9Qcm9kdWN0LzQ4MjE="));
  assert.equal(
    JSON.parse(Buffer.from(JSON.parse(id.request.body!).requests, "base64").toString())[0].query,
    "Z2lkOi8vc2hvcC9Qcm9kdWN0LzQ4MjE=",
  );
});

test("vet: a read never lets an arg, a lookup or a literal override its method", () => {
  const read = (body: string, slots: object[]) =>
    parseSite({
      name: "shop",
      baseUrl: "https://shop.example.com",
      operations: [
        {
          name: "item",
          readOnly: true,
          request: {
            method: "POST",
            url: "https://shop.example.com/items/1",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
          },
          slots,
          params: [{ name: "id" }],
          trigger: { url: "https://shop.example.com/items/{id}" },
          match: { method: "POST", host: "shop.example.com", path: "/items/*" },
        },
      ],
    });
  const lookup = {
    request: { method: "GET", url: "https://shop.example.com/api/user?name=x", headers: {} },
    slots: [{ param: "id", at: ["query:name"] }],
  };
  const errors = (s: Site) => vetShared(s).errors.join("\n");
  assert.match(
    errors(read("_method=GET&id=1", [{ at: ["form:_method"], from: lookup, path: "user.bio" }])),
    /method override/,
  );
  assert.match(errors(read("id=1&_method=GET", [{ param: "id", at: ["form:_method"] }])), /method override/);
  assert.match(
    errors(read("_method=DELETE&id=1", [{ param: "id", at: ["form:id"] }])),
    /overrides its method to DELETE/,
  );
  assert.doesNotMatch(errors(read("_method=GET&id=1", [{ param: "id", at: ["form:id"] }])), /method/);
});
