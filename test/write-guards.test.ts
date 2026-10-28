/**
 * What a browser run lets out besides the op's own request: a write's tier-3 run stops any unsafe
 * request its learning did not record (a redesign that put "Delete account" where Buy was), and a
 * read's learning stops the unsafe requests its steps send (a click that places an order).
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { browserAvailable, closeBrowser } from "../src/browser.js";
import { call } from "../src/execute.js";
import { addOperation, capturePage, stoppedIn } from "../src/heal.js";
import { parseSite, type Site } from "../src/spec.js";
import { updateSite } from "../src/store.js";
import { vetShared } from "../src/vet.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-guards-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

describe("the shared rules on a write's companions", () => {
  const site = (companions: unknown, readOnly = false): Site =>
    parseSite({
      name: "shop",
      baseUrl: "https://shop.example.com",
      operations: [
        {
          name: "order",
          readOnly,
          request: { method: "POST", url: "https://api.shop.example.com/order", headers: {}, body: "{}" },
          slots: [],
          volatile: [],
          trigger: {
            url: "https://shop.example.com/item/1",
            steps: [{ action: "click", selector: "#buy" }],
            companions,
          },
          match: { method: "POST", host: "api.shop.example.com", path: "/order" },
        },
      ],
    });
  const errors = (s: Site) => vetShared(s).errors.filter((e) => /compan/.test(e));

  test("a write's few unsafe companions on its own site pass", () => {
    assert.deepEqual(errors(site([{ method: "PUT", host: "www.shop.example.com", path: "/cart/*" }])), []);
    assert.deepEqual(errors(site([])), []);
  });

  test("a read's, too many, another site's, a safe or unnamed one do not", () => {
    const cart = { method: "PUT", host: "shop.example.com", path: "/cart" };
    assert.match(errors(site([cart], true)).join("\n"), /a read sends no companion requests/);
    assert.match(errors(site(Array(9).fill(cart))).join("\n"), /9 companion requests; at most 8/);
    assert.match(
      errors(site([{ method: "DELETE", host: "evil.example", path: "/account" }])).join("\n"),
      /companion 1 \(DELETE evil\.example\/account\) is off the op's own site example\.com/,
    );
    for (const bad of [
      { method: "GET", host: "shop.example.com", path: "/cart" },
      { host: "shop.example.com", path: "/cart" },
      { method: "POST", path: "/cart" },
      { method: "POST", host: "shop.example.com" },
    ])
      assert.match(errors(site([bad])).join("\n"), /names no unsafe method, host and path/, JSON.stringify(bad));
  });
});

describe("unsafe requests in browser runs", { skip: !browserAvailable() && "no Chromium browser installed" }, () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(async () => {
    await closeBrowser();
    await fx.close();
  });
  const sent = (path: string) => fx.calls.filter((c) => c.path.startsWith(path)).map((c) => `${c.method} ${c.path}`);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const buy = { url: "", steps: [{ action: "click" as const, selector: "#buy" }] };

  test("a write is learned with its companion recorded, and a tier-3 call sends both, once, and says so", async () => {
    const r = await addOperation({
      site: "shop",
      op: "order",
      trigger: { ...buy, url: `${fx.url}/shop/{item}` },
      examples: [{ item: "fridge" }, { item: "toaster" }],
      match: { method: "POST", path: "/api/order" },
      write: true,
    });
    await sleep(300);
    assert.deepEqual([...sent("/api/cart"), ...sent("/api/order")], [], "learning sent the order or the cart");
    // the item in the cart's path is the example's: a wildcard, like a param's segment in a match
    assert.deepEqual(r.operation.trigger.companions, [{ method: "PUT", host: "127.0.0.1", path: "/api/cart/*" }]);

    updateSite("shop", (s) => ({ ...s!, operations: s!.operations.map((o) => ({ ...o, minTier: 3 as const })) }));
    const res = await call("shop", "order", { item: "kettle" }, { minIntervalMs: 0, allowWrites: true });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.tier, 3);
    assert.deepEqual([...sent("/api/cart"), ...sent("/api/order")], ["PUT /api/cart/kettle", "POST /api/order"]);
    assert.match(res.reason ?? "", /the page also sent PUT \/api\/cart\/kettle, as it did when this write was learned/);
  });

  test("after a redesign whose button deletes the account, a tier-3 call stops the DELETE and names it", async () => {
    updateSite("shop", (s) => ({
      ...s!,
      operations: s!.operations.map((o) => ({
        ...o,
        trigger: { ...o.trigger, url: `${fx.url}/shop/{item}?redesign=1` },
      })),
    }));
    const res = await call("shop", "order", { item: "fridge-t3" }, { minIntervalMs: 0, allowWrites: true });
    await sleep(300);
    assert.deepEqual(sent("/api/account"), [], "the DELETE reached the site");
    assert.equal(res.ok, false);
    assert.equal(res.class, "drift");
    assert.match(res.reason ?? "", /fired no request matching/);
    assert.match(
      res.reason ?? "",
      /the page also tried to send DELETE \/api\/account, which this write's learning did not see the trigger send: stopped in the browser, nothing of it was sent/,
    );
  });

  test("a write learned before companions were recorded still lets them out, and names each", async () => {
    updateSite("shop", (s) => ({
      ...s!,
      operations: s!.operations.map(({ trigger: { companions: _c, ...t }, ...o }) => ({ ...o, trigger: t })),
    }));
    const res = await call("shop", "order", { item: "fridge-old" }, { minIntervalMs: 0, allowWrites: true });
    await sleep(300);
    assert.deepEqual(sent("/api/account"), ["DELETE /api/account"]);
    assert.match(
      res.reason ?? "",
      /the page also sent DELETE \/api\/account: order was learned before api-anything recorded what else a write's trigger sends, so nothing else was stopped; learn it again with add --write/,
    );
  });

  test("a read add whose click places an order stops it, fails before run 2, and saves nothing", async () => {
    const before = fx.calls.length;
    await assert.rejects(
      addOperation({
        site: "shop",
        op: "item",
        trigger: { ...buy, url: `${fx.url}/shop/{item}` },
        examples: [{ item: "fridge" }, { item: "toaster" }],
      }),
      (e: Error) => {
        assert.match(
          e.message,
          /^PUT \/api\/cart\/fridge, POST \/api\/order, sent once the steps ran, were stopped in the browser: nothing was sent\. If it is an action \(an order, a post, a change\), add it again with --write, which never sends it\. Only if it changes nothing \(a search the site sends as PUT\), add it with --match method=PUT --match path=\/api\/cart\/fridge: a pinned request is sent for real on each learning run and saved as a read\. item was not saved$/,
        );
        return true;
      },
    );
    await sleep(300);
    const calls = fx.calls.slice(before).map((c) => `${c.method} ${c.path}`);
    // the page's own load went out, once: run 2 never ran
    assert.deepEqual(calls, ["GET /api/item?id=fridge"]);
  });

  test("capture without --write stops what the steps send, and says so", async () => {
    const before = fx.calls.length;
    const c = await capturePage({ url: `${fx.url}/shop/oven`, steps: buy.steps });
    await sleep(300);
    assert.deepEqual(
      fx.calls.slice(before).map((x) => `${x.method} ${x.path}`),
      ["GET /api/item?id=oven"],
    );
    assert.deepEqual(stoppedIn(c, c.url), { site: ["PUT /api/cart/oven", "POST /api/order"], elsewhere: [] });
    // learning the stopped order from it leads with --write; --match is offered only for what changes nothing
    const order = c.exchanges.find((e) => e.aborted && e.request.url.endsWith("/api/order"))!;
    await assert.rejects(
      addOperation({ site: "shop", op: "item", from: { capture: c, id: order.id }, examples: [{ item: "oven" }] }),
      (e: Error) => {
        assert.match(
          e.message,
          /was stopped in the browser as a possible write, so it has no answer to learn\. If it is an action \(an order, a post, a change\), add it with --write, which never sends it\. Only if it changes nothing \(a search the site sends as POST\), add it with --match method=POST --match path=\/api\/order and --trigger instead of --from: a pinned request is sent for real on each learning run and saved as a read$/,
        );
        return true;
      },
    );
  });

  test("reads sent as POST on a click: a GraphQL query passes, a pinned --match passes with the beacon beside it stopped", async () => {
    const steps = (button: string) => [
      { action: "fill" as const, selector: "#q", value: "{q}" },
      { action: "click" as const, selector: button },
    ];
    const gql = await addOperation({
      site: "finder",
      op: "findGql",
      trigger: { url: `${fx.url}/finder`, steps: steps("#gql") },
      examples: [{ q: "lamp" }, { q: "chair" }],
    });
    assert.equal(gql.operation.readOnly, true);
    assert.match(gql.operation.request.url, /\/api\/gql$/);

    await assert.rejects(
      addOperation({
        site: "finder",
        op: "find",
        trigger: { url: `${fx.url}/finder`, steps: steps("#go") },
        examples: [{ q: "lamp" }, { q: "chair" }],
      }),
      /POST \/api\/track, POST \/api\/find, sent once the steps ran, were stopped|POST \/api\/find, POST \/api\/track, sent once the steps ran, were stopped/,
    );
    const tracked = sent("/api/track").length;
    const pinned = await addOperation({
      site: "finder",
      op: "find",
      trigger: { url: `${fx.url}/finder`, steps: steps("#go") },
      examples: [{ q: "lamp" }, { q: "chair" }],
      match: { method: "POST", path: "/api/find" },
    });
    assert.equal(pinned.operation.readOnly, true);
    assert.match(pinned.operation.request.url, /\/api\/find$/);
    assert.ok(
      pinned.warnings.some((w) =>
        /the steps also sent POST \/api\/track, stopped in the browser \(nothing was sent\)/.test(w),
      ),
      pinned.warnings.join("\n"),
    );
    await sleep(300);
    assert.equal(sent("/api/track").length, tracked, "the beacon left");
    assert.equal(tracked, 0);
  });
});
