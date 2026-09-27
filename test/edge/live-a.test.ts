/**
 * Edge probes for dimension "live-a": deterministic offline repros of what live runs against
 * YouTube, Airbnb, Reddit, Amazon, Product Hunt and Booking.com showed. Tests that fail today
 * assert the correct behaviour, so they pass once the bug is fixed. Chrome probes skip without Chrome.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { chromeAvailable, closeBrowser, openBrowser } from "../../src/browser.ts";
import { classify } from "../../src/classify.ts";
import { call } from "../../src/execute.ts";
import { capOutput } from "../../src/extract.ts";
import { addOperation, profileDir } from "../../src/heal.ts";
import { learnOperation } from "../../src/learn.ts";
import { saveSession } from "../../src/session.ts";
import { OperationSchema, type Operation } from "../../src/spec.ts";
import { loadSite, saveSite } from "../../src/store.ts";
import { startLiveFixture, type LiveFixture } from "./live-a.fixture.ts";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-edge-live-a-"));
process.env.API_ANYTHING_HOME = HOME;
const fast = { minIntervalMs: 0 };
const noChrome = !chromeAvailable() && "Google Chrome not installed";

let fx: LiveFixture;
before(async () => {
  fx = await startLiveFixture();
});
after(async () => {
  await closeBrowser();
  await fx.close();
  rmSync(HOME, { recursive: true, force: true });
});
beforeEach(() => {
  rmSync(join(HOME, "state.json"), { force: true });
  rmSync(join(HOME, "heals.jsonl"), { force: true });
  fx.hits.length = 0;
  fx.setDown(false);
});

const heals = (): { op: string; strategy: string; diff: string }[] => {
  try {
    return readFileSync(join(HOME, "heals.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
};
const opOf = (site: string, name: string) => loadSite(site)!.site.operations.find((o) => o.name === name)!;
const setMinTier = (site: string, name: string, minTier: 1 | 2 | 3) => {
  const s = loadSite(site)!.site;
  saveSite({ ...s, operations: s.operations.map((o) => (o.name === name ? { ...o, minTier } : o)) });
};
const forgetBrowserAndJar = async (site: string) => {
  await (await openBrowser({ profileDir: profileDir() })).clearCookies();
  saveSession(site, { cookies: [], values: {} });
};

/* -------------------------------------------------- referer template with non-Latin-1 args */

describe("a param templated into a header (Airbnb's referer)", () => {
  const SITE = "hdr";
  before(() => {
    const learned = learnOperation({
      exchanges: [
        {
          id: 1,
          resourceType: "fetch",
          request: {
            method: "GET",
            url: `${fx.url}/api/find?q=kittens`,
            headers: { accept: "application/json", referer: `${fx.url}/find/kittens` },
          },
          response: { status: 200, headers: { "content-type": "application/json" }, contentType: "application/json", body: '{"results":["kittens one","kittens two"]}' },
        },
      ],
      examples: [{ q: "kittens" }],
      cookies: [],
      name: "find",
      trigger: { url: `${fx.url}/find/{q}` },
      readOnly: true,
    });
    saveSite({ name: SITE, baseUrl: fx.url, operations: [learned.operation] });
  });

  test("learning makes the referer a templated slot (precondition, passes today)", () => {
    const slot = opOf(SITE, "find").slots.find((s) => s.at[0] === "header:referer");
    assert.equal(slot?.template, `${fx.url}/find/{q}`);
  });

  test("an ASCII value with a space is sent and answered (passes today)", async () => {
    const r = await call(SITE, "find", { q: "new york" }, { ...fast, maxTier: 1 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, ["new york one", "new york two"]);
  });

  test("BUG: a CJK value (東京) must not crash tier 1 with a ByteString error", async () => {
    const r = await call(SITE, "find", { q: "東京" }, { ...fast, maxTier: 1 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, ["東京 one", "東京 two"]);
  });

  test("BUG: a Latin-1 value (São Paulo) goes into the referer percent-encoded, as a browser sends it", async () => {
    const r = await call(SITE, "find", { q: "São Paulo" }, { ...fast, maxTier: 1 });
    assert.equal(r.ok, true, JSON.stringify(r));
    const hit = fx.hits.find((h) => h.path.startsWith("/api/find"));
    assert.equal(hit?.rawReferer, `${fx.url}/find/S%C3%A3o%20Paulo`);
  });
});

/* ------------------------------------------------------------- classifier: bot walls */

describe("bot walls seen live must classify as blocked", () => {
  const op = (format: "json" | "html"): Operation =>
    OperationSchema.parse({
      name: "search",
      request: { method: "GET", url: "https://shop.example/s?k=kettle", headers: {} },
      slots: [{ param: "k", at: ["query:k"] }],
      trigger: { url: "https://shop.example/s?k={k}" },
      match: { method: "GET", host: "shop.example", path: "/s" },
      response: format === "html" ? { format, html: { items: "div.result", fields: { t: "" } } } : { format, extract: "results" },
      params: [{ name: "k", type: "string", required: true, example: "kettle" }],
      readOnly: true,
    });

  test("a Cloudflare interstitial is blocked (passes today)", () => {
    const c = classify(op("html"), { status: 403, headers: { "content-type": "text/html" }, body: "<html><title>Just a moment...</title></html>" });
    assert.equal(c.class, "blocked");
  });

  test("BUG: Booking.com's AWS WAF interstitial (202 + awsWafCookieDomainList + challenge.js) is blocked, not drift", () => {
    const body =
      '<!DOCTYPE html><html lang="en"><head><title></title><script>window.awsWafCookieDomainList = [\'booking.com\'];</script>' +
      '<script src="https://www.booking.com/__challenge_h78IRKX3kpQxScCExxShBNwRUlb/d8c14d4960ca/a18a4859af9c/challenge.js"></script></head><body></body></html>';
    for (const f of ["html", "json"] as const) {
      const c = classify(op(f), { status: 202, headers: { "content-type": "text/html" }, body });
      assert.equal(c.class, "blocked", `${f}: ${JSON.stringify(c)}`);
    }
  });

  test("BUG: Amazon's automated-access wall (503) is blocked, not error", () => {
    const body =
      "<!-- To discuss automated access to Amazon data please contact api-services-support@amazon.com. For information about migrating to our APIs refer to our Marketplace APIs --><!doctype html><html><head><title>Sorry! Something went wrong!</title></head><body></body></html>";
    const c = classify(op("html"), { status: 503, headers: { "content-type": "text/html" }, body });
    assert.equal(c.class, "blocked", JSON.stringify(c));
  });

  test("BUG: Reddit's 200 JS proof-of-work page (auto-submitted 'solution' form, js_challenge) is blocked, not drift", () => {
    const body =
      '<!DOCTYPE html><html lang="en"><head><title>Reddit</title><script>document.addEventListener("DOMContentLoaded",async function(){var e=document.forms[0],n=(e.onsubmit=function(t){return!0},await(async e=>e+e)("8e41418a7cbe71e1"));e.elements.namedItem("solution").value=n,e.requestSubmit()},{once:!0});</script></head>' +
      '<body><main><form method="get"><input type="hidden" name="js_challenge" value="1"><input type="hidden" name="solution"></form></main></body></html>';
    const c = classify(op("html"), { status: 200, headers: { "content-type": "text/html" }, body });
    assert.equal(c.class, "blocked", JSON.stringify(c));
  });

  test("a large (>64 KB) Reddit 'Prove your humanity' reCAPTCHA page on an html op is blocked", () => {
    const body = `<!doctype html><html><head><title>Reddit - Prove your humanity</title></head><body>${"<div>x</div>".repeat(8000)}<div class="g-recaptcha"></div></body></html>`;
    assert.ok(body.length > 64_000);
    const c = classify(op("html"), { status: 200, headers: { "content-type": "text/html" }, body });
    assert.equal(c.class, "blocked", JSON.stringify(c));
  });
});

/* ------------------------------------------------------------------ capOutput */

test("BUG (low): inspect/call output whose first item alone exceeds the cap returns data: [] (reads as 'no results')", () => {
  const big = [{ blob: "x".repeat(25_000) }, { blob: "y" }];
  const r = capOutput(big);
  assert.ok(Array.isArray(r.data));
  assert.ok((r.data as unknown[]).length > 0, `data is empty: ${r.truncated}`);
});

/* ------------------------------------------------------------------ Chrome probes */

describe("browser-backed live patterns", { skip: noChrome }, () => {
  test("BUG: add with --html learns the HTML document, not a JSON telemetry beacon that echoes the page URL", async () => {
    const r = await addOperation({
      site: "shop",
      op: "search",
      trigger: { url: `${fx.url}/shop?q={q}` },
      examples: [{ q: "kettle" }, { q: "toaster" }],
      response: { html: { items: "li.r", fields: { title: "" } } },
    });
    assert.equal(new URL(r.operation.request.url).pathname, "/shop", `learned ${r.operation.request.method} ${r.operation.request.url}`);
    assert.equal(r.operation.request.method, "GET");
    const c = await call("shop", "search", { q: "blender" }, fast);
    assert.equal(c.ok, true, JSON.stringify(c));
    assert.deepEqual(c.data, [{ title: "blender result 1" }, { title: "blender result 2" }]);
  });

  test("add --from with the document pinned learns an html op that answers new args (passes today)", async () => {
    const r = await addOperation({
      site: "shop2",
      op: "search",
      trigger: { url: `${fx.url}/shop?q={q}` },
      examples: [{ q: "kettle" }, { q: "toaster" }],
      match: { method: "GET", path: "/shop" },
      response: { html: { items: "li.r", fields: { title: "" } } },
    });
    assert.equal(new URL(r.operation.request.url).pathname, "/shop");
    const c = await call("shop2", "search", { q: "blender" }, fast);
    assert.equal(c.ok, true, JSON.stringify(c));
    assert.equal(c.tier, 1);
  });

  test("BUG: a gzip-compressed request body (YouTube innertube, content-encoding: gzip) is learned as a tier-1 body slot", async () => {
    const r = await addOperation({
      site: "gz",
      op: "search",
      trigger: { url: `${fx.url}/gz?q={q}` },
      examples: [{ q: "kittens" }, { q: "puppies" }],
      match: { method: "POST", path: "/api/gz" },
    });
    // Today: the body is captured as lossy UTF-8, q is found only in the referer, and the changing
    // gzip bytes read as a nonce, so minTier 3 (a browser run per call). With a trigger whose URL
    // lacks q (YouTube's search box), add fails outright.
    assert.ok(r.operation.slots.some((s) => s.param === "q" && s.at[0] === "body"), JSON.stringify(r.operation.slots));
    assert.equal(r.operation.minTier, 1, r.warnings.join("\n"));
    const c = await call("gz", "search", { q: "otters" }, fast);
    assert.equal(c.ok, true, JSON.stringify(c));
    assert.equal(c.tier, 1);
    assert.deepEqual(c.data, [{ title: "otters video" }]);
  });

  test("BUG (critical): a param found only in the referer never yields an op that returns the example's data for new args", async () => {
    let learned = true;
    try {
      await addOperation({
        site: "b64",
        op: "search",
        trigger: { url: `${fx.url}/b64?q={q}` },
        examples: [{ q: "kittens" }],
        match: { method: "POST", path: "/api/b64" },
      });
    } catch (e) {
      // the correct outcome: "example value ... is not in the learned request"
      assert.match((e as Error).message, /not in the learned request/);
      learned = false;
    }
    if (learned) {
      const c = await call("b64", "search", { q: "otters" }, fast);
      // Today: ok:true, tier 1, data [{title:"kittens result"}] -- the example's data, silently.
      assert.ok(!JSON.stringify(c.data ?? null).includes("kittens"), `silent wrong data: ${JSON.stringify(c)}`);
    }
  });

  test("BUG: at tier 3 the challenge interstitial that precedes the real page is not taken as the answer (Booking.com)", async () => {
    await addOperation({
      site: "hotels",
      op: "search",
      trigger: { url: `${fx.url}/hotels?q={q}` },
      examples: [{ q: "Lisbon" }, { q: "Porto" }],
      match: { method: "GET", path: "/hotels" },
      response: { html: { items: "div.card", fields: { name: "" } } },
    });
    setMinTier("hotels", "search", 3);
    await forgetBrowserAndJar("hotels");
    const r = await call("hotels", "search", { q: "Madrid" }, fast);
    // Today: class "input" ("the thing probably does not exist") for a perfectly valid city.
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.data, [{ name: "Madrid hotel 1" }, { name: "Madrid hotel 2" }]);
  });

  test("BUG: a WAF interstitial at tier 1 is not 'drift': no heal is logged and challenge params are not baked into the template", async () => {
    await addOperation({
      site: "hotels2",
      op: "search",
      trigger: { url: `${fx.url}/hotels?q={q}` },
      examples: [{ q: "Lisbon" }, { q: "Porto" }],
      match: { method: "GET", path: "/hotels" },
      response: { html: { items: "div.card", fields: { name: "" } } },
    });
    await forgetBrowserAndJar("hotels2");
    const r = await call("hotels2", "search", { q: "Madrid" }, fast);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(heals().filter((h) => h.op === "search"), [], "a bot challenge is not drift");
    assert.ok(!opOf("hotels2", "search").request.url.includes("chal_t"), opOf("hotels2", "search").request.url);
  });

  test("BUG: when even the example args get no data, the verdict is not 'input' (the site is down, not the args)", async () => {
    await addOperation({
      site: "status",
      op: "search",
      trigger: { url: `${fx.url}/status?q={q}` },
      examples: [{ q: "alpha" }, { q: "bravo" }],
      match: { method: "GET", path: "/status" },
      response: { html: { items: "div.item", fields: { name: "" } } },
    });
    fx.setDown(true);
    const withExample = await call("status", "search", { q: "alpha" }, fast);
    assert.notEqual(withExample.class, "input", `the op's own example args got: ${JSON.stringify(withExample)}`);
    const withNew = await call("status", "search", { q: "charlie" }, fast);
    assert.notEqual(withNew.class, "input", `examples fail too, so the args are not the problem: ${JSON.stringify(withNew)}`);
  });

  test("a no-results query while the example still answers is 'input' (passes today)", async () => {
    fx.setDown(false);
    await addOperation({
      site: "status2",
      op: "search",
      trigger: { url: `${fx.url}/status?q={q}` },
      examples: [{ q: "alpha" }, { q: "bravo" }],
      match: { method: "GET", path: "/status" },
      response: { html: { items: "div.item", fields: { name: "" } } },
    });
    const ok = await call("status2", "search", { q: "delta" }, fast);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    const none = await call("status2", "search", { q: "zzqxv" }, fast);
    assert.equal(none.class, "input", JSON.stringify(none));
    assert.deepEqual(heals(), []);
  });
});
