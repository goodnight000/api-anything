import assert from "node:assert/strict";
import { test } from "node:test";
import { getAt } from "../src/codec.ts";
import { buildRequest } from "../src/http.ts";
import { learnOperation, matches, rankCandidates } from "../src/learn.ts";
import type { Exchange, StoredCookie } from "../src/types.ts";

const cookie = (name: string, value: string, domain = ".x.com"): StoredCookie => ({
  name, value, domain, path: "/", expires: -1, httpOnly: false, secure: true,
});

const X_COOKIES = [cookie("ct0", "c0ffee0123456789abcdef"), cookie("auth_token", "a1b2c3d4e5f60718293a"), cookie("gt", "1840000000000000001")];
const BEARER = "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7";

function xExchanges(handle: string, txn: string, id0 = 1): Exchange[] {
  const variables = JSON.stringify({ screen_name: handle, withSafetyMode: true });
  const features = JSON.stringify({ hidden_profile_subscriptions_enabled: true });
  return [
    {
      id: id0,
      resourceType: "document",
      request: { method: "GET", url: `https://x.com/${handle}`, headers: { "user-agent": "Mozilla/5.0 Chrome/153.0.0.0" } },
      response: { status: 200, headers: {}, body: `<html><title>${handle} / X</title></html>`, contentType: "text/html; charset=utf-8" },
    },
    {
      id: id0 + 1,
      resourceType: "script",
      request: { method: "GET", url: "https://abs.twimg.com/responsive-web/main.abc.js", headers: {} },
      response: { status: 200, headers: {}, body: "var x", contentType: "application/javascript" },
    },
    {
      id: id0 + 2,
      resourceType: "xhr",
      request: {
        method: "POST",
        url: `https://www.google-analytics.com/g/collect?v=2&dl=https%3A%2F%2Fx.com%2F${handle}`,
        headers: {},
      },
      response: { status: 204, headers: {}, contentType: "" },
    },
    {
      id: id0 + 3,
      resourceType: "xhr",
      request: {
        method: "GET",
        url: `https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`,
        headers: {
          ":authority": "x.com",
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br, zstd",
          authorization: BEARER,
          cookie: "ct0=c0ffee0123456789abcdef; auth_token=a1b2c3d4e5f60718293a; gt=1840000000000000001",
          "x-csrf-token": "c0ffee0123456789abcdef",
          "x-guest-token": "1840000000000000001",
          "x-client-transaction-id": txn,
          "x-twitter-auth-type": "OAuth2Session",
          referer: `https://x.com/${handle}`,
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 Chrome/153.0.0.0",
        },
      },
      response: {
        status: 200,
        headers: {},
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          data: { user: { result: { rest_id: "11348282", legacy: { screen_name: handle.toUpperCase(), name: "Name", followers_count: 1 } } } },
        }),
      },
    },
  ];
}

const trigger = { url: "https://x.com/{screen_name}" };

test("X-like GraphQL GET: params, cookie/session refs, volatile anchor, match, headers, response", () => {
  const { operation: op, warnings, sessionValues } = learnOperation({
    exchanges: xExchanges("nasa", "txnAAAAAAAAAAAAAAAAAAAAAAA"),
    exchanges2: xExchanges("spacex", "txnBBBBBBBBBBBBBBBBBBBBBBB", 10),
    examples: [{ screen_name: "nasa" }, { screen_name: "spacex" }],
    cookies: X_COOKIES,
    name: "getUser",
    trigger,
    readOnly: true,
  });

  assert.ok(op.request.url.startsWith("https://x.com/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?"));
  assert.deepEqual(
    op.slots.filter((s) => s.param),
    [
      { param: "screen_name", at: ["query:variables", "json:/screen_name"] },
      { param: "screen_name", at: ["header:referer"], template: "https://x.com/{screen_name}" },
    ],
  );
  assert.deepEqual(
    op.slots.filter((s) => s.ref).map((s) => [s.ref, s.at.join()]).sort(),
    [
      ["cookie:ct0", "header:x-csrf-token"],
      ["cookie:gt", "header:x-guest-token"],
      ["session:authorization", "header:authorization"],
      ["session:x-client-transaction-id", "header:x-client-transaction-id"],
    ],
  );
  assert.deepEqual(sessionValues, { authorization: BEARER, "x-client-transaction-id": "txnAAAAAAAAAAAAAAAAAAAAAAA" });

  // header policy: verbatim minus pseudo/cookie/accept-encoding; per-op headers like x-twitter-auth-type stay
  assert.deepEqual(Object.keys(op.request.headers).sort(), [
    "accept", "authorization", "referer", "sec-fetch-site", "user-agent", "x-client-transaction-id", "x-csrf-token", "x-guest-token", "x-twitter-auth-type",
  ]);
  const serialized = JSON.stringify(op);
  for (const secret of ["c0ffee0123456789abcdef", "a1b2c3d4e5f60718293a", "1840000000000000001", "1Zv7", "txnAAAA"]) {
    assert.ok(!serialized.includes(secret), `spec must not hold ${secret}`);
  }

  assert.deepEqual(op.volatile, [{ at: ["path:3"], shape: { charset: "base64url", length: 22 }, anchor: "UserByScreenName" }]);
  assert.deepEqual(op.match, { method: "GET", host: "x.com", path: "/i/api/graphql/*/UserByScreenName" });
  assert.equal(op.minTier, 1);
  assert.equal(op.learnedLoggedIn, true);
  assert.deepEqual(op.params, [{ name: "screen_name", type: "string", required: true, example: "nasa" }]);
  assert.equal(op.response.format, "json");
  assert.equal(op.response.extract, "data.user.result.legacy");
  assert.equal(op.response.shape!["data.user.result.rest_id"], "string");
  assert.ok(!warnings.some((w) => /nonce|ambiguous|run 2 has/.test(w)), warnings.join("\n"));

  // replay with a new arg and a live session
  const req = buildRequest(op, { screen_name: "esa" }, { cookies: X_COOKIES, values: sessionValues });
  assert.deepEqual(getAt(req, ["query:variables", "json:"]), { screen_name: "esa", withSafetyMode: true });
  assert.equal(req.headers.referer, "https://x.com/esa");
  assert.equal(req.headers["x-csrf-token"], "c0ffee0123456789abcdef");
  assert.equal(req.headers["x-guest-token"], "1840000000000000001");
  assert.equal(req.headers.authorization, BEARER);
  assert.match(req.headers.cookie!, /auth_token=a1b2c3d4e5f60718293a/);
});

test("rankCandidates drops noise and puts the XHR carrying the args first", () => {
  const ranked = rankCandidates(xExchanges("nasa", "t"), { screen_name: "nasa" });
  assert.deepEqual(ranked.map((c) => c.id), [4, 1]);
  assert.deepEqual(ranked[0]!.hits, ["screen_name"]);
  assert.equal(ranked[1]!.resourceType, "document");
  assert.deepEqual(rankCandidates(xExchanges("nasa", "t")).map((c) => c.id), [4, 1]);
});

test("matches uses stable identity only", () => {
  const req = xExchanges("nasa", "t")[3]!.request;
  assert.ok(matches({ method: "GET", host: "x.com", path: "/i/api/graphql/*/UserByScreenName" }, req));
  assert.ok(!matches({ path: "/i/api/graphql/*/UserTweets" }, req));
  assert.ok(!matches({ method: "POST" }, req));
  assert.ok(!matches({ operationName: "UserByScreenName" }, req), "operationName comes from the body/form, not the path");
});

function flights(origin: string, dest: string, reqid: string, id: number, bgr: string): Exchange {
  const inner = JSON.stringify([[null, null, null, "HKUJcc"], [null, null, 1, [[[[[origin, 0]]], [[[dest, 0]]], null, 0, null, null, "2026-11-12"], [[[[dest, 0]]], [[[origin, 0]]], null, 0, null, null, "2026-11-16"]]]]);
  return {
    id,
    resourceType: "xhr",
    request: {
      method: "POST",
      url: `https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults?f.sid=-5170&bl=boq_travel-frontend-flights-ui_20260922.02_p0&hl=en-US&_reqid=${reqid}&rt=c`,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "x-goog-batchexecute-bgr": bgr,
        "x-same-domain": "1",
      },
      body: `f.req=${encodeURIComponent(JSON.stringify([null, inner]))}&`,
    },
    response: {
      status: 200,
      headers: {},
      contentType: "application/json; charset=utf-8",
      body: `)]}'\n\n120\n[["wrb.fr",null,"[[\\"United\\",\\"${dest}\\"]]"]]\n`,
    },
  };
}

test("Google Flights: triple-encoded form params, value in several roles, counter vs nonce, XSSI", () => {
  const learned = learnOperation({
    exchanges: [flights("SFO", "JFK", "4521", 1, '[";u6W4pcHQ-one"]')],
    exchanges2: [flights("OAK", "LAX", "8837", 2, '[";u6W4pcHQ-two"]')],
    examples: [{ origin: "SFO", destination: "JFK" }, { origin: "OAK", destination: "LAX" }],
    cookies: [],
    name: "search",
    trigger: { url: "https://www.google.com/travel/flights?q={origin}+to+{destination}" },
    readOnly: true,
  });
  const op = learned.operation;
  const byParam = (p: string) => op.slots.filter((s) => s.param === p).map((s) => s.at.slice(2).join());
  assert.deepEqual(byParam("origin"), ["json:/1/3/0/0/0/0/0", "json:/1/3/1/1/0/0/0"]);
  assert.deepEqual(byParam("destination"), ["json:/1/3/0/1/0/0/0", "json:/1/3/1/0/0/0/0"]);
  assert.ok(learned.warnings.some((w) => /"destination" appears in 2 places/.test(w)));
  assert.ok(learned.warnings.some((w) => /query:_reqid varies between runs/.test(w)));
  assert.equal(op.minTier, 1);
  assert.deepEqual(learned.sessionValues, { "x-goog-batchexecute-bgr": '[";u6W4pcHQ-one"]' });
  assert.equal(op.response.xssiPrefix, ")]}'");

  const req = buildRequest(op, { origin: "SEA", destination: "BOS" }, { cookies: [], values: learned.sessionValues });
  const inner = JSON.parse(JSON.parse(new URLSearchParams(req.body).get("f.req")!)[1]);
  assert.deepEqual(inner[1][3][0].slice(0, 2), [[[["SEA", 0]]], [[["BOS", 0]]]]);
  assert.deepEqual(inner[1][3][1].slice(0, 2), [[[["BOS", 0]]], [[["SEA", 0]]]]);
  assert.equal(req.headers["x-goog-batchexecute-bgr"], '[";u6W4pcHQ-one"]');
});

test("a high-entropy value that changes without an arg change is a nonce: minTier 3", () => {
  const ex = (q: string, sig: string, id: number): Exchange => ({
    id,
    resourceType: "fetch",
    request: { method: "GET", url: `https://shop.test/api/search?q=${q}&sig=${sig}`, headers: {} },
    response: { status: 200, headers: {}, contentType: "application/json", body: `{"items":[{"name":"${q} one"},{"name":"${q} two"}]}` },
  });
  const { operation, warnings } = learnOperation({
    exchanges: [ex("kettle", "f3a9c1d2e4b5a6c7", 1)],
    exchanges2: [ex("toaster", "0b1c2d3e4f5a6b7c", 2)],
    examples: [{ q: "kettle" }, { q: "toaster" }],
    cookies: [],
    name: "search",
    trigger: { url: "https://shop.test/?q={q}" },
    readOnly: true,
  });
  assert.equal(operation.minTier, 3);
  assert.ok(warnings.some((w) => /nonce.*query:sig/.test(w)));
  assert.equal(operation.response.extract, "items");
});

test("LinkedIn-style quoted JSESSIONID echoed without quotes -> strip-quotes cookie ref", () => {
  const { operation } = learnOperation({
    exchanges: [
      {
        id: 1,
        resourceType: "fetch",
        request: {
          method: "GET",
          url: "https://www.linkedin.com/voyager/api/graphql?variables=(start:0,query:(keywords:rustacean))&queryId=voyagerSearchDashClusters.52fec77d08aa4598c8a056ca6bce6c11",
          headers: { "csrf-token": "ajax:4815162342", cookie: 'JSESSIONID="ajax:4815162342"; li_at=AQEDAxxxxxxxxxx' },
        },
        response: { status: 200, headers: {}, contentType: "application/vnd.linkedin.normalized+json+2.1", body: '{"included":[{"title":"rustacean"}]}' },
      },
    ],
    examples: [{ keywords: "rustacean" }],
    cookies: [],
    name: "searchPeople",
    trigger: { url: "https://www.linkedin.com/search/results/people/?keywords={keywords}" },
    readOnly: true,
  });
  assert.deepEqual(
    operation.slots.find((s) => s.ref),
    { ref: "cookie:JSESSIONID", transform: "strip-quotes", at: ["header:csrf-token"] },
  );
  assert.deepEqual(operation.slots[0], {
    param: "keywords",
    at: ["query:variables"],
    template: "(start:0,query:(keywords:{keywords}))",
  });
  assert.equal(operation.request.headers["csrf-token"], "");
  const req = buildRequest(operation, { keywords: "zig" }, { cookies: [cookie("JSESSIONID", '"ajax:1"', ".linkedin.com")], values: {} });
  assert.ok(req.url.includes("variables=(start:0,query:(keywords:zig))&queryId="), req.url);
  assert.equal(req.headers["csrf-token"], "ajax:1");
});

test("Instagram-style form POST: friendly name is the anchor and the match operationName; JSON number params", () => {
  // variables carries a bare 19-digit JSON number, which URLSearchParams can't produce from a JS object
  const variables = '{"first":12345,"username":"nasa","id":2085462611575857621}';
  const body = `av=0&__user=0&fb_api_req_friendly_name=PolarisProfilePostsTabContentQuery&variables=${encodeURIComponent(variables)}&doc_id=27553725110923321`;
  const { operation } = learnOperation({
    exchanges: [
      {
        id: 7,
        resourceType: "xhr",
        request: {
          method: "POST",
          url: "https://www.instagram.com/api/graphql",
          headers: { "content-type": "application/x-www-form-urlencoded", "x-ig-app-id": "936619743392459", "x-fb-lsd": "AVqbxe3J_YA" },
          body,
        },
        response: { status: 200, headers: {}, contentType: "text/javascript; charset=utf-8", body: '{"data":{"user":{"edges":[{"n":1},{"n":2}]}}}' },
      },
    ],
    examples: [{ username: "nasa", first: 12345, id: "2085462611575857621" }],
    cookies: [],
    name: "posts",
    trigger: { url: "https://www.instagram.com/{username}/" },
    readOnly: true,
  });
  assert.deepEqual(operation.volatile, [
    { at: ["form:doc_id"], shape: { charset: "digits", length: 17 }, anchor: "PolarisProfilePostsTabContentQuery" },
  ]);
  assert.deepEqual(operation.match, { method: "POST", host: "www.instagram.com", path: "/api/graphql", operationName: "PolarisProfilePostsTabContentQuery" });
  const types = Object.fromEntries(operation.params.map((p) => [p.name, p.type]));
  assert.deepEqual(types, { username: "string", first: "number", id: "number" });
  assert.equal(operation.request.headers["x-ig-app-id"], "936619743392459");
  const req = buildRequest(operation, { username: "esa", first: "12", id: "1999999999999999999" }, { cookies: [], values: {} });
  assert.equal(new URLSearchParams(req.body).get("variables"), '{"first":12,"username":"esa","id":1999999999999999999}');
});

test("HTML document op and an aborted write both learn", () => {
  const doc = learnOperation({
    exchanges: [
      {
        id: 1,
        resourceType: "document",
        request: { method: "GET", url: "https://news.ycombinator.com/from?site=github.com", headers: {} },
        response: { status: 200, headers: {}, contentType: "text/html; charset=utf-8", body: "<tr class=athing>github.com</tr>" },
      },
    ],
    examples: [{ site: "github.com" }],
    cookies: [],
    name: "fromSite",
    trigger: { url: "https://news.ycombinator.com/from?site={site}" },
    readOnly: true,
  });
  assert.equal(doc.operation.response.format, "html");
  assert.ok(doc.warnings.some((w) => /response is HTML/.test(w)));

  const write = learnOperation({
    exchanges: [
      {
        id: 3,
        resourceType: "fetch",
        aborted: true,
        request: {
          method: "POST",
          url: "https://x.com/i/api/graphql/znCaGhOrM6q7DbrQdOYgPw/CreateTweet",
          headers: { "content-type": "application/json" },
          body: '{"variables":{"tweet_text":"hello from site2api"},"queryId":"znCaGhOrM6q7DbrQdOYgPw"}',
        },
      },
    ],
    examples: [{ text: "hello from site2api" }],
    cookies: [],
    name: "post",
    trigger: { url: "https://x.com/compose/post" },
    readOnly: false,
  });
  assert.deepEqual(write.operation.slots, [{ param: "text", at: ["body", "json:/variables/tweet_text"] }]);
  assert.equal(write.operation.readOnly, false);
  assert.deepEqual(write.operation.response, { format: "json" });
  assert.equal(write.operation.learnedLoggedIn, false);
});

test("example validation and pick errors", () => {
  const base = { exchanges: xExchanges("nasa", "t"), cookies: [], name: "g", trigger, readOnly: true };
  assert.throws(() => learnOperation({ ...base, examples: [{ screen_name: "na" }] }), /at least 3 characters/);
  assert.throws(() => learnOperation({ ...base, examples: [{ a: "nasa", b: "NASA" }] }), /must be distinct/);
  assert.throws(() => learnOperation({ ...base, examples: [{ screen_name: "nobody-here" }] }), /no captured request carries/);
  assert.throws(() => learnOperation({ ...base, examples: [{ screen_name: "nasa" }], id: 99 }), /no captured request with id 99/);
  const byId = learnOperation({ ...base, examples: [{ screen_name: "nasa" }], id: 1 });
  assert.equal(byId.operation.request.url, "https://x.com/nasa");
  assert.deepEqual(byId.operation.slots, [{ param: "screen_name", at: ["path:0"] }]);
  assert.deepEqual(byId.operation.match.path, "/*");
});

test("per-session form tokens (Google at, Meta fb_dtsg) become session refs, and a public header can stay literal", () => {
  const AT = "AJpMio3qL0x-Vw8nZ2rT9kYb4HsE:1727430000000";
  const DTSG = "NAcNq8Yx2b3LmPq:17:1727430000";
  const body = `f.req=${encodeURIComponent(JSON.stringify([[["rpc1", JSON.stringify(["paris"]), null, "generic"]]]))}&at=${encodeURIComponent(AT)}&fb_dtsg=${encodeURIComponent(DTSG)}&`;
  const exchanges: Exchange[] = [
    {
      id: 1,
      resourceType: "xhr",
      request: { method: "POST", url: "https://www.google.test/_/rpc?rpcids=rpc1", headers: { "content-type": "application/x-www-form-urlencoded", authorization: BEARER }, body },
      response: { status: 200, headers: {}, contentType: "application/json", body: '[["paris",1]]' },
    },
  ];
  const base = { exchanges, examples: [{ city: "paris" }] as [Record<string, unknown>], cookies: [], name: "s", trigger: { url: "https://www.google.test/s?q={city}" }, readOnly: true };
  const { operation: op, sessionValues } = learnOperation(base);
  assert.ok(op.slots.some((s) => s.ref === "session:at" && s.at[0] === "form:at"));
  assert.ok(op.slots.some((s) => s.ref === "session:fb_dtsg"));
  assert.equal(sessionValues.at, AT);
  assert.ok(!op.request.body!.includes(encodeURIComponent(AT)) && !op.request.body!.includes(encodeURIComponent(DTSG)), op.request.body);
  assert.equal(op.request.headers.authorization, "", "authorization is a session ref by default");

  const pub = learnOperation({ ...base, public: ["Authorization"] }).operation;
  assert.equal(pub.request.headers.authorization, BEARER);
  assert.deepEqual(pub.public, ["authorization"]);
  assert.ok(!pub.slots.some((s) => s.ref === "session:authorization"));
});

test("an example value not in the chosen request is an error, not a param that changes nothing", () => {
  const exchanges: Exchange[] = [
    {
      id: 1,
      resourceType: "fetch",
      request: { method: "GET", url: "https://a.test/api/feed", headers: {} },
      response: { status: 200, headers: {}, contentType: "application/json", body: '{"items":[{"q":"sqlite"}]}' },
    },
  ];
  assert.throws(
    () => learnOperation({ exchanges, examples: [{ q: "sqlite" }], cookies: [], name: "s", trigger: { url: "https://a.test/?q={q}" }, readOnly: true, id: 1 }),
    /"q" \("sqlite"\) is not in the learned request/,
  );
});

test("a learned template keeps the leaf's own {name} text (minified GraphQL selection)", () => {
  const body = JSON.stringify({ query: 'query{repository(owner:"octocat",name:"hello-world"){name}}' });
  const L = learnOperation({
    exchanges: [
      {
        id: 1,
        resourceType: "fetch",
        request: { method: "POST", url: "https://g.test/graphql", headers: { "content-type": "application/json" }, body },
        response: { status: 200, headers: {}, contentType: "application/json", body: '{"data":{"repository":{"name":"hello-world"}}}' },
      },
    ],
    examples: [{ owner: "octocat", name: "hello-world" }],
    cookies: [],
    name: "repo",
    trigger: { url: "https://g.test/{owner}/{name}" },
    readOnly: true,
  });
  const out = buildRequest(L.operation, { owner: "torvalds", name: "linux" }, { cookies: [], values: {} }).body!;
  assert.equal(JSON.parse(out).query, 'query{repository(owner:"torvalds",name:"linux"){name}}');
});

test("telemetry that logs the page URL does not count as carrying the args", () => {
  const ex = (id: number, url: string, body?: string): Exchange => ({
    id,
    resourceType: "xhr",
    request: { method: body ? "POST" : "GET", url, headers: {}, ...(body ? { body } : {}) },
    response: { status: 200, headers: {}, contentType: "application/json", body: "{}" },
  });
  const ranked = rankCandidates([ex(1, "https://x.test/1.1/viewer_context.json", JSON.stringify({ page: "https://x.test/nasa" })), ex(2, "https://api.x.test/User?screen_name=nasa")], {
    screen_name: "nasa",
  });
  assert.deepEqual(ranked.map((c) => [c.id, c.hits]), [[2, ["screen_name"]], [1, []]]);
  const video: Exchange = { ...ex(3, "https://video.test/seg-1.m4s?nasa"), response: { status: 200, headers: {}, contentType: "video/mp4", body: "x" } };
  assert.deepEqual(rankCandidates([video], { screen_name: "nasa" }), [], "media fetched by XHR is noise");
});
