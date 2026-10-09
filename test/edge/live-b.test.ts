/**
 * live-b: deterministic repros of what live real-site creation (IMDb, GitHub, eBay, Yelp, Zillow,
 * Kayak, Skyscanner, Craigslist, Wikipedia) exposed. Bodies and request shapes are trimmed copies of
 * what those sites served on 2026-09-27. Failing tests assert the correct behaviour, so they pass
 * once the bug is fixed. The one Chrome probe skips without Chrome.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { chromeAvailable, closeBrowser } from "../../src/browser.ts";
import { classify } from "../../src/classify.ts";
import { call } from "../../src/execute.ts";
import { addOperation, type CaptureFile, capturePage } from "../../src/heal.ts";
import { learnOperation, rankCandidates } from "../../src/learn.ts";
import type { Operation } from "../../src/spec.ts";
import type { Exchange } from "../../src/types.ts";
import { type Fixture, startFixture } from "./live-b.fixture.ts";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-edge-live-b-"));
process.env.API_ANYTHING_HOME = HOME;
after(async () => {
  await closeBrowser();
  rmSync(HOME, { recursive: true, force: true });
});

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";
let nextId = 1;
function ex(o: {
  url: string;
  method?: string;
  kind?: string;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  status?: number;
  type?: string;
  body?: string;
  headers?: Record<string, string>;
}): Exchange {
  const type = o.type ?? "application/json";
  return {
    id: nextId++,
    resourceType: o.kind ?? "document",
    request: {
      method: o.method ?? "GET",
      url: o.url,
      headers: { "user-agent": UA, accept: "*/*", ...(o.reqHeaders ?? {}) },
      ...(o.reqBody !== undefined ? { body: o.reqBody } : {}),
    },
    response: {
      status: o.status ?? 200,
      headers: { "content-type": type, ...(o.headers ?? {}) },
      body: o.body ?? "",
      contentType: type,
    },
  };
}
const capture = (url: string, exchanges: Exchange[]): CaptureFile => ({
  id: `c-live-b-${nextId++}`,
  at: new Date().toISOString(),
  url,
  exchanges,
  cookies: [],
  finalUrl: url,
});
const htmlDoc = (url: string, body: string, status = 200, reqHeaders?: Record<string, string>) =>
  ex({ url, type: "text/html; charset=utf-8", body, status, reqHeaders });
function htmlOp(url: string, args: Record<string, string>, items = "li.r"): Operation {
  const op = learnOperation({
    exchanges: [htmlDoc(url, `<ul><li class="r">${Object.values(args).join(" ")}</li></ul>`)],
    examples: [args],
    cookies: [],
    name: "page",
    trigger: { url },
    readOnly: true,
  }).operation;
  return { ...op, response: { ...op.response, format: "html", html: { items, fields: { t: "" } } } };
}

/* ------------------------------------------------------------- bot walls */

// IMDb (AWS WAF, 2026-09-27): first a 202 JS challenge, then a 405 "Human Verification" CAPTCHA.
const AWS_WAF_202 = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title></title>
<script type="text/javascript">window.awsWafCookieDomainList = ['imdb.com']; window.gokuProps = {"key":"AQIDAH","iv":"CgAFeDJ3","context":"Qut7eVe"};</script>
<script src="https://fb423e1ef94f.6277d64d.us-east-1.token.awswaf.com/fb423e1ef94f/c3382d439950/916d943f6a58/challenge.js"></script>
</head><body><div id="challenge-container"></div>
<script type="text/javascript">AwsWafIntegration.saveReferrer(); AwsWafIntegration.getToken().then(() => { window.location.reload(true); });</script>
<noscript><h1>JavaScript is disabled</h1>In order to continue, we need to verify that you're not a robot. This requires JavaScript. Enable JavaScript and then reload the page.</noscript>
</body></html>`;
const AWS_WAF_405 = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Human Verification</title>
<script type="text/javascript">window.awsWafCookieDomainList = ['imdb.com']; window.gokuProps = {"key":"AQIDAH","iv":"CgAGhDLu","context":"x24rUs"};</script>
<script src="https://fb423e1ef94f.6277d64d.us-east-1.token.awswaf.com/fb423e1ef94f/c3382d439950/916d943f6a58/challenge.js"></script>
<script src="https://fb423e1ef94f.6277d64d.us-east-1.captcha.awswaf.com/fb423e1ef94f/c3382d439950/916d943f6a58/captcha.js"></script>
</head><body><div id="captcha-container"></div>
<noscript><h1>JavaScript is disabled</h1>In order to continue, you need to verify that you're not a robot by solving a CAPTCHA puzzle.</noscript>
</body></html>`;
const DATADOME_403 = `<html lang="en"><head><title>yelp.com</title><style>#cmsg{animation: A 1.5s;}</style></head><body style="margin:0"><p id="cmsg">Please enable JS and disable any ad blocker</p><script data-cfasync="false">var dd={'rt':'c','cid':'AHrlqAAAAAMA','hsh':'3BD2468B','t':'bv','s':45183,'e':'x','host':'geo.captcha-delivery.com','cookie':'x'}</script><script data-cfasync="false" src="https://ct.captcha-delivery.com/c.js"></script></body></html>`;
const PERIMETERX_403 = `<!DOCTYPE html><html lang="en"><head><title>Access to this page has been denied</title></head><body><div id="px-captcha"></div><script>window._pxAppId = 'PXHYx10rg3';</script><p>Press &amp; Hold to confirm you are a human (and not a bot).</p></body></html>`;

describe("bot-wall classification", () => {
  const title = htmlOp("https://www.imdb.com/title/tt1375666/", { id: "tt1375666" }, "h1");

  test("AWS WAF 405 'Human Verification' CAPTCHA page (IMDb) is blocked, not error", () => {
    const c = classify(title, {
      status: 405,
      headers: { "content-type": "text/html; charset=UTF-8" },
      body: AWS_WAF_405,
    });
    assert.equal(c.class, "blocked", c.reason);
  });

  test("AWS WAF 202 JS challenge page (IMDb) is blocked, not drift", () => {
    const c = classify(title, {
      status: 202,
      headers: { "content-type": "text/html; charset=UTF-8" },
      body: AWS_WAF_202,
    });
    assert.equal(c.class, "blocked", c.reason);
  });

  test("regression: DataDome 403 (Yelp) and PerimeterX 403 (Zillow, Skyscanner) are blocked", () => {
    assert.equal(
      classify(title, { status: 403, headers: { "content-type": "text/html" }, body: DATADOME_403 }).class,
      "blocked",
    );
    assert.equal(
      classify(title, { status: 403, headers: { "content-type": "text/html" }, body: PERIMETERX_403 }).class,
      "blocked",
    );
  });

  test("add on a page that served a bot challenge does not tell the agent to fix its recipe", async () => {
    const url = "https://www.yelp.com/search?find_desc=pizza&find_loc=SF";
    const r = await addOperation({
      site: "yelp-edge",
      op: "search",
      examples: [{ q: "pizza" }],
      response: { html: { items: "[data-testid=serp-ia-card]", fields: { name: "h3 a" } } },
      from: { capture: capture(url, [htmlDoc(url, DATADOME_403, 403)]), id: undefined },
    });
    const w = r.warnings.find((x) => /blocked/.test(x));
    assert.ok(w, `a blocked warning: ${r.warnings.join(" | ")}`);
    assert.doesNotMatch(w, /Fix --extract/, "a bot wall is not fixed by editing --extract/--html");
    assert.match(w, /login/, "points at api-anything login to clear the challenge");
  });
});

/* --------------------------------------------------------------- picking */

describe("request picking", () => {
  test("a document whose URL ends in .js (github.com/mrdoob/three.js) is a candidate, not an asset", () => {
    const doc = htmlDoc(
      "https://github.com/mrdoob/three.js",
      "<html><body><strong itemprop=name><a>three.js</a></strong></body></html>",
    );
    const ranked = rankCandidates([doc], { owner: "mrdoob", repo: "three.js" });
    assert.deepEqual(
      ranked.map((c) => c.id),
      [doc.id],
    );
  });

  test("add --from with repo=next.js learns the document", async () => {
    const url = "https://github.com/vercel/next.js";
    const r = await addOperation({
      site: "gh-edge",
      op: "repo",
      examples: [{ owner: "vercel", repo: "next.js" }],
      response: { html: { items: "#hdr", fields: { name: "a" } } },
      from: { capture: capture(url, [htmlDoc(url, `<div id="hdr"><a>next.js</a></div>`)]) },
    });
    assert.equal(r.operation.request.url, url);
  });

  test("regression: a plain document path still ranks", () => {
    const doc = htmlDoc("https://github.com/microsoft/playwright", "<html>playwright</html>");
    assert.equal(rankCandidates([doc], { repo: "playwright" })[0]?.id, doc.id);
  });

  test("with --embedded, add picks the document the recipe resolves on, not a POST whose multipart body merely contains the value as a substring (GitHub search)", async () => {
    const url = "https://github.com/search?q=playwright&type=repositories";
    const results = {
      payload: { blackbirdSearchRoute: { results: [{ hl_name: "microsoft/<em>playwright</em>", followers: 96753 }] } },
    };
    const doc = htmlDoc(
      url,
      `<html><body><script type="application/json" data-target="react-app.embeddedData">${JSON.stringify(results)}</script></body></html>`,
    );
    const b = "----WebKitFormBoundaryeZEwOAxK1zXOg1LT";
    const sponsor = ex({
      url: "https://github.com/sponsors/batch_deferred_sponsor_buttons",
      method: "POST",
      kind: "fetch",
      reqHeaders: { "content-type": `multipart/form-data; boundary=${b}`, referer: url },
      reqBody: `--${b}\r\nContent-Disposition: form-data; name="_method"\r\n\r\nGET\r\n--${b}\r\nContent-Disposition: form-data; name="items[item-85809106][repo_name]"\r\n\r\ninvisible_playwright_mcp\r\n--${b}--\r\n`,
      body: JSON.stringify({ "item-85809106": "<button>Sponsor</button>".repeat(200) }),
    });
    const r = await addOperation({
      site: "gh-edge",
      op: "search",
      examples: [{ q: "playwright" }],
      response: {
        embedded: { regex: 'data-target="react-app.embeddedData">(\\{)' },
        extract: "payload.blackbirdSearchRoute.results",
      },
      from: { capture: capture(url, [doc, sponsor]) },
    });
    assert.equal(r.operation.request.method, "GET", r.warnings.join(" | "));
    assert.equal(r.operation.request.url, url);
    assert.ok(r.preview, `preview resolves: ${r.warnings.join(" | ")}`);
  });
});

/* ----------------------------------------------------------- conditional */

describe("conditional request headers", () => {
  test("If-None-Match / If-Modified-Since from a revalidating browser are not stored in the template", () => {
    const url = "https://github.com/search?q=playwright&type=repositories";
    const op = learnOperation({
      exchanges: [
        htmlDoc(url, "<ul><li class=r>playwright</li></ul>", 200, {
          "if-none-match": 'W/"25f941cd5c0f1f789be9542912883d9d"',
          "if-modified-since": "Sat, 26 Sep 2026 10:00:00 GMT",
        }),
      ],
      examples: [{ q: "playwright" }],
      cookies: [],
      name: "search",
      trigger: { url: "https://github.com/search?q={q}&type=repositories" },
      readOnly: true,
    }).operation;
    assert.equal(op.request.headers["if-none-match"], undefined);
    assert.equal(op.request.headers["if-modified-since"], undefined);
  });

  describe("capture then add (the SKILL flow) on a site with stable ETags", {
    skip: !chromeAvailable() && "Google Chrome not installed",
  }, () => {
    let fx: Fixture;
    before(async () => (fx = await startFixture()));
    after(async () => fx.close());

    test("verify (the example args) still answers ok at tier 1", async () => {
      await capturePage({ url: `${fx.url}/s?q=alpha` });
      const r = await addOperation({
        site: "etag",
        op: "search",
        trigger: { url: `${fx.url}/s?q={q}` },
        examples: [{ q: "alpha" }, { q: "bravo" }],
        response: { html: { items: "li.r", fields: { t: "a" } } },
      });
      const res = await call("etag", "search", { q: "alpha" }, { minIntervalMs: 0, maxTier: 1 });
      assert.equal(
        res.ok,
        true,
        `${JSON.stringify(res)}; stored if-none-match=${r.operation.request.headers["if-none-match"]}; server saw ${JSON.stringify(fx.conditional)}`,
      );
    });
  });
});

/* ------------------------------------------------------------ drift shape */

describe("shape drift", () => {
  // Normalized responses key entities by id (Kayak's legs/segments/airports, X's globalObjects).
  const learnFrom = (body: unknown) =>
    learnOperation({
      exchanges: [ex({ url: "https://api.example.com/search?q=sfo", kind: "fetch", body: JSON.stringify(body) })],
      examples: [{ q: "sfo" }],
      cookies: [],
      name: "search",
      trigger: { url: "https://example.com/s/{q}" },
      readOnly: true,
    }).operation;
  const entity = (code: string) => ({ code, name: `${code} airport`, city: "x", lat: 1, lng: 2, tz: "z" });

  test("an id-keyed entity map with different ids for new args is not a shape change", () => {
    const op = learnFrom({
      results: [{ id: "r1", from: "SFO", to: "JFK" }],
      airports: { SFO: entity("SFO"), JFK: entity("JFK") },
    });
    const c = classify(op, {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        results: [{ id: "r9", from: "BOS", to: "SEA" }],
        airports: { BOS: entity("BOS"), SEA: entity("SEA") },
      }),
    });
    assert.equal(c.class, "ok", c.reason);
  });

  test("regression: a real shape change (the data moved) is still drift", () => {
    const op = learnFrom({ results: [{ id: "r1", from: "SFO", to: "JFK", price: 1, carrier: "UA" }] });
    const c = classify(op, {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: { items: [{ a: 1 }] } }),
    });
    assert.equal(c.class, "drift");
  });
});

/* -------------------------------------------------------------- 400 input */

describe("400 classification", () => {
  test("a 400 that names no param is error, even when a slot ends in an array index (json:/legs/0)", () => {
    const op = learnOperation({
      exchanges: [
        ex({
          url: "https://www.kayak.com/i/api/search/dynamic/flights/poll",
          method: "POST",
          kind: "fetch",
          reqHeaders: { "content-type": "application/json" },
          reqBody: JSON.stringify({ legs: [{ origin: { airports: ["SFO"] } }] }),
          body: JSON.stringify({ results: [{ from: "SFO" }] }),
        }),
      ],
      examples: [{ origin: "SFO" }],
      cookies: [],
      name: "flights",
      trigger: { url: "https://www.kayak.com/flights/{origin}-JFK" },
      readOnly: true,
    }).operation;
    assert.deepEqual(op.slots.find((s) => s.param)?.at, ["body", "json:/legs/0/origin/airports/0"]);
    const c = classify(op, {
      status: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "upstream failure", retry: 0 }),
    });
    assert.equal(c.class, "error", c.reason);
  });

  test("regression: Wikipedia-style 404 on a templated path is input", () => {
    const op = htmlOp("https://en.wikipedia.org/wiki/Platypus", { title: "Platypus" }, "#content");
    assert.equal(
      classify(op, {
        status: 404,
        headers: { "content-type": "text/html" },
        body: "<html>Wikipedia does not have an article with this exact name.</html>",
      }).class,
      "input",
    );
  });
});
