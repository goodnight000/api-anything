import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { chromeAvailable, closeBrowser, pageFetch, runTrigger } from "../src/browser.js";
import { PUBLIC_BEARER, startFixture, type Fixture } from "./fixture/server.js";

describe("fixture site (plain http)", () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(() => fx.close());

  test("stale queryId and old bundle 404 after rotate", async () => {
    const { userQueryId, build } = fx.state;
    fx.rotate();
    assert.notEqual(fx.state.userQueryId, userQueryId);
    assert.match(fx.state.userQueryId, /^[\w-]{22}$/);
    const stale = await fetch(`${fx.url}/api/graphql/${userQueryId}/UserByName?variables=%7B%7D`);
    assert.equal(stale.status, 404);
    assert.equal(await stale.text(), "");
    assert.equal((await fetch(`${fx.url}/static/app.${build}.js`)).status, 404);
    const js = await (await fetch(`${fx.url}/static/app.${fx.state.build}.js`)).text();
    assert.ok(js.includes(`{queryId:"${fx.state.userQueryId}",operationName:"UserByName"`));
  });

  test("login wall, rate limit, html list", async () => {
    const wall = await fetch(`${fx.url}/private`);
    assert.equal(wall.status, 200);
    assert.match(wall.headers.get("content-type") ?? "", /html/);
    const ok = await fetch(`${fx.url}/private`, { headers: { cookie: "session=abc" } });
    assert.deepEqual(await ok.json(), { data: { secret: "only for you" } });
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await fetch(`${fx.url}/api/limited`)).status);
    assert.deepEqual(codes, [200, 200, 429]);
    assert.match(await (await fetch(`${fx.url}/list`)).text(), /<li class="user"><a class="name" href="\/u\/alice">alice<\/a>/);
  });
});

describe("browser", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  let fx: Fixture;
  let profileDir: string;
  before(async () => {
    fx = await startFixture();
    profileDir = await mkdtemp(join(tmpdir(), "site2api-profile-"));
  });
  after(async () => {
    await closeBrowser();
    await fx.close();
    await rm(profileDir, { recursive: true, force: true });
  });

  let gqlUrl = "";
  let csrf = "";

  test("runTrigger captures the GraphQL read with wire headers and bodies", async () => {
    const r = await runTrigger({ url: `${fx.url}/u/alice`, profileDir });
    const gql = r.exchanges.find((e) => e.request.url.includes("/UserByName?"));
    assert.ok(gql, "UserByName exchange captured");
    const ct0 = r.cookies.find((c) => c.name === "ct0");
    assert.ok(ct0);
    assert.equal(gql.request.headers["x-csrf-token"], ct0.value);
    assert.match(gql.request.headers.cookie ?? "", /ct0=/);
    assert.equal(gql.request.headers["x-app-version"], "2026.09.27-a1b2c3");
    assert.equal(gql.request.headers["sec-fetch-site"], "same-origin");
    assert.doesNotMatch(gql.request.headers["user-agent"] ?? "", /HeadlessChrome/);
    assert.doesNotMatch(gql.request.headers["sec-ch-ua"] ?? "", /Headless/);
    assert.equal(gql.response?.status, 200);
    assert.equal(JSON.parse(gql.response?.body ?? "").data.user.name, "alice");

    const doc = r.exchanges.find((e) => e.resourceType === "document");
    assert.match(doc?.response?.body ?? "", new RegExp(`/static/app\\.${fx.state.build}\\.js`));
    assert.equal(r.finalUrl, `${fx.url}/u/alice`);
    gqlUrl = gql.request.url;
    csrf = ct0.value;
  });

  test("softFrom reaches the target by an in-page navigation", async () => {
    const r = await runTrigger({ url: `${fx.url}/u/bob`, softFrom: `${fx.url}/`, profileDir });
    const gql = r.exchanges.find((e) => e.request.url.includes("/UserByName?"));
    assert.match(decodeURIComponent(gql?.request.url ?? ""), /"name":"bob"/);
    assert.equal(r.finalUrl, `${fx.url}/u/bob`);
  });

  test("softFrom on a client-routed SPA stays in the app: through its own link, or history + popstate", async () => {
    for (const name of ["bob", "dave"]) {
      // bob has a link the app rendered; dave has none, so only the history API can route there
      const r = await runTrigger({ url: `${fx.url}/spa/${name}`, softFrom: `${fx.url}/spa/alice`, profileDir });
      assert.equal(r.exchanges.filter((e) => e.resourceType === "document").length, 1, `${name}: no second page load`);
      assert.ok(r.exchanges.some((e) => e.request.url.endsWith(`/api/spa/user?name=${name}`)), `${name}: the route's XHR fired`);
      assert.equal(r.finalUrl, `${fx.url}/spa/${name}`);
    }
  });

  test("write interception covers service workers and GETs sent by a UI action", async () => {
    const hits = () => fx.calls.filter((c) => c.path === "/api/sw-write" || c.path.startsWith("/api/follow")).length;
    const guard = (e: { request: { method: string }; resourceType: string }, acting: boolean) =>
      e.request.method !== "GET" || (acting && ["xhr", "fetch"].includes(e.resourceType));
    // A worker installed on an earlier visit would proxy fetches past page routing; site2api blocks workers.
    await runTrigger({ url: `${fx.url}/sw`, profileDir, intercept: guard });
    const sw = await runTrigger({ url: `${fx.url}/sw`, profileDir, intercept: guard });
    const follow = await runTrigger({ url: `${fx.url}/follow/alice`, steps: [{ action: "click", selector: "#follow" }], profileDir, intercept: guard });
    assert.equal(hits(), 0, "no write reached the server");
    assert.ok(sw.exchanges.some((e) => e.request.url.endsWith("/api/sw-write") && e.aborted));
    assert.ok(follow.exchanges.some((e) => e.request.url.endsWith("/api/follow?user=alice") && e.aborted));
  });

  test("intercept aborts the write before it reaches the server", async () => {
    const r = await runTrigger({
      url: `${fx.url}/compose`,
      profileDir,
      steps: [
        { action: "fill", selector: "#text", value: "hello world" },
        { action: "click", selector: "#post" },
      ],
      intercept: (e) => e.request.method === "POST" && e.request.url.includes("/CreatePost"),
    });
    const w = r.exchanges.find((e) => e.request.url.includes("/CreatePost"));
    assert.ok(w);
    assert.equal(w.aborted, true);
    assert.equal(w.response, undefined);
    assert.deepEqual(JSON.parse(w.request.body ?? "").variables, { text: "hello world" });
    assert.equal(fx.calls.filter((c) => c.path.includes("CreatePost")).length, 0);
  });

  test("layered form encoding and per-request signatures come through", async () => {
    const s = await runTrigger({ url: `${fx.url}/search?q=pizza`, profileDir });
    const rpc = s.exchanges.find((e) => e.request.url.includes("/api/rpc"));
    assert.equal(rpc?.resourceType, "xhr");
    assert.match(decodeURIComponent(rpc?.request.body ?? ""), /pizza/);
    assert.ok(rpc?.response?.body?.startsWith(")]}'"));

    fx.setRequireSignature(true);
    const f = await runTrigger({ url: `${fx.url}/feed`, profileDir });
    const feed = f.exchanges.find((e) => e.request.url.endsWith("/api/signed/feed"));
    assert.equal(feed?.response?.status, 200);
    const replay = await pageFetch({ origin: fx.url, url: feed!.request.url, method: "GET", headers: { "x-sig": feed!.request.headers["x-sig"] }, profileDir });
    assert.equal(replay.status, 403, "a reused signature is rejected");
    fx.setRequireSignature(false);
  });

  test("pageFetch runs fetch() on the site origin with the profile's cookies", async () => {
    const r = await pageFetch({ origin: fx.url, url: gqlUrl, method: "GET", headers: { "x-csrf-token": csrf, authorization: PUBLIC_BEARER }, profileDir });
    assert.equal(r.status, 200);
    assert.equal(JSON.parse(r.body).data.user.name, "alice");
    assert.match(r.headers["content-type"], /json/);
    assert.equal(typeof r.ms, "number");
    const call = fx.calls.at(-1);
    assert.doesNotMatch(String(call?.headers["user-agent"]), /HeadlessChrome/);
  });
});
