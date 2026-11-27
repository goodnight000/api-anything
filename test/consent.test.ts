/**
 * A cookie-consent wall by redirect (Google's consent.google.com for an EU visitor). Every tier and
 * response format answers `error` naming the page: no heal, no stale mark, no cool-down. Learning
 * and capturing say the same. Answering the question once in api-anything's window makes the same
 * calls answer at every tier, and nothing of it reaches the spec or the clean replay.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright-core";
import { browserAvailable, closeBrowser, openBrowser } from "../src/browser.js";
import { type CaseResult, verifySite } from "../src/checks.js";
import { classify } from "../src/classify.js";
import { cleanCall } from "../src/clean.js";
import { type CallResult, call } from "../src/execute.js";
import { addOperation, challengePage, consentWall, profileDir } from "../src/heal.js";
import { learnSite } from "../src/learnsite.js";
import { visitorChoices, windowLogin } from "../src/login.js";
import { learnTool } from "../src/mcp-learn.js";
import { loadSession, mergeCapture } from "../src/session.js";
import { type Operation, OperationSchema, parseSite } from "../src/spec.js";
import { cooling, loadSite, saveSite, staleMark } from "../src/store.js";
import type { CaptureResult, StoredCookie } from "../src/types.js";
import { vetShared } from "../src/vet.js";
import { type Fixture, FLIGHTS, startFixture } from "./fixture/server.js";
import { siteEntries } from "./verify-live.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-consent-"));
process.env.API_ANYTHING_HOME = HOME;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const fast = { minIntervalMs: 0 };
after(() => rmSync(HOME, { recursive: true, force: true }));

/** The fixture's flights as a JSON read, an html read and an embedded read, at `minTier`. */
function saveFlights(name: string, base: string, minTier: 1 | 2 | 3 = 1, over: Partial<Operation> = {}): void {
  const op = (opName: string, url: string, path: string, response: Record<string, unknown>) => ({
    name: opName,
    readOnly: true,
    minTier,
    request: { method: "GET", url: `${base}${url}?q=AMS`, headers: {} },
    slots: [{ param: "q", at: ["query:q"] }],
    params: [{ name: "q", example: "BER" }],
    trigger: { url: `${base}/eu/flights?q={q}` },
    match: { method: "GET", path },
    response,
    ...over,
  });
  saveSite(
    parseSite({
      name,
      baseUrl: base,
      operations: [
        op("api", "/api/eu/flights", "/api/eu/flights", { extract: "flights" }),
        op("page", "/eu/flights", "/eu/flights", {
          format: "html",
          html: { items: "ul.flights li.f", fields: { to: ".to", price: ".price" } },
        }),
        op("state", "/eu/flights", "/eu/flights", {
          format: "embedded",
          embedded: { regex: "window.DATA = (\\{)" },
          extract: "flights",
        }),
      ],
    }),
  );
}

/** The answer to a read the site sent to its consent page, and nothing healed, stale or cooling for it. */
function walled(r: CallResult, site: string, op: string, tier: number, signedIn = false): void {
  const mode = signedIn ? undefined : "window";
  const said = JSON.stringify(r);
  assert.deepEqual([r.ok, r.class, r.wall, r.tier], [false, "error", "consent", tier], said);
  assert.match(r.reason ?? "", /the site's cookie-consent page, instead of the data/, said);
  assert.doesNotMatch(r.reason ?? "", /drift|heal|stale/, said);
  assert.deepEqual(r.nextCall, { action: "login", site, op, ...(mode ? { mode } : {}) });
  assert.equal(r.retry, "after_fix");
  assert.match(r.next ?? "", mode ? new RegExp(`api-anything login ${site} --window`) : /in their browser/, said);
  assert.equal(staleMark(site, op), undefined, "nothing stale");
  assert.equal(cooling(site), undefined, "no cool-down");
  assert.equal(existsSync(join(HOME, "heals.jsonl")), false, "no heal ran");
}

const cookie = (name: string, value: string, domain = "127.0.0.1"): StoredCookie => ({
  name,
  value,
  domain,
  path: "/",
  expires: -1,
  httpOnly: false,
  secure: false,
});

test("a page at a consent address gets one verdict whichever tier read it, at any size", () => {
  const trigger = "https://www.example.com/flights?q=AMS";
  const asked = "https://www.example.com/api/flights?q=AMS";
  const landed = "https://www.example.com/consent?continue=%2Fflights";
  const pad = `<!-- ${"x".repeat(66_000)} -->`;
  const html = (title: string, body: string) =>
    `<!doctype html><html><head><title>${title}</title></head><body>${body}${pad}</body></html>`;
  const consent =
    '<h1>Before you continue</h1><p>We use cookies and data to deliver our services.</p><form action="/consent/save"><button name="choice" value="reject">Reject all</button></form>';
  const pages: [string, number, string, "blocked" | "consent" | "other"][] = [
    ["a challenge past 64 KB", 200, html("One moment", '<div id="cf-chl-widget"></div>'), "blocked"],
    ["a consent page past 64 KB", 200, html("Before you continue", consent), "consent"],
    [
      "a sign-in page",
      200,
      html("Sign in", '<form action="/session"><input name="email"><input type="password" name="pw"></form>'),
      "other",
    ],
    ["an outage", 503, html("Service unavailable", "<p>We use cookies. Back soon.</p>"), "other"],
  ];
  const op = OperationSchema.parse({
    name: "api",
    readOnly: true,
    request: { method: "GET", url: asked, headers: {} },
    slots: [],
    params: [],
    trigger: { url: trigger },
    response: { format: "json", extract: "flights" },
  });
  for (const [what, status, body, verdict] of pages) {
    const headers = { "content-type": "text/html; charset=utf-8" };
    const one = classify(op, { status, headers, body, url: landed, redirected: true });
    const capture: CaptureResult = {
      finalUrl: landed,
      cookies: [],
      exchanges: [
        {
          id: 1,
          resourceType: "document",
          request: { method: "GET", url: trigger, headers: {} },
          response: { status: 302, headers: { location: landed }, contentType: "text/plain", body: "" },
        },
        {
          id: 2,
          resourceType: "document",
          request: { method: "GET", url: landed, headers: {} },
          response: { status, headers, contentType: headers["content-type"], body },
        },
      ],
    };
    const three = consentWall(capture, trigger) ? "consent" : challengePage(capture) ? "blocked" : "other";
    const tier1 = one.wall === "consent" ? "consent" : one.class === "blocked" ? "blocked" : "other";
    assert.deepEqual([tier1, three], [verdict, verdict], `${what}: tier 1 ${one.class} (${one.reason})`);
  }
});
describe("a consent wall at tier 1, cleared once", () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(() => fx.close());

  test("each format answers error naming the consent page, with one request and no climb, heal or stale mark", async () => {
    saveFlights("eu-t1", fx.url);
    for (const op of ["api", "page", "state"]) {
      const before = fx.calls.length;
      walled(await call("eu-t1", op, { q: "AMS" }, fast), "eu-t1", op, 1);
      // the JSON read's request, once: no second try, no example args, no heal's replay
      if (op === "api")
        assert.deepEqual(
          fx.calls.slice(before).map((c) => c.path),
          ["/api/eu/flights?q=AMS"],
        );
    }
  });

  test("verify calls a consent wall inconclusive, as a challenge or a sign-in page, and the live record says so", async () => {
    const v = await verifySite("eu-t1", fast);
    const cases = v.results.filter((r): r is CaseResult => "outcome" in r);
    assert.ok(cases.length >= 3, JSON.stringify(v.results));
    for (const c of cases) assert.equal(c.outcome, "inconclusive", JSON.stringify(c));
    assert.deepEqual(v.newlyFailing, [], "a healthy op is put on no failure list");
    const entries = siteEntries({
      site: "eu-t1",
      ops: ["api", "page", "state"],
      values: ["BER"],
      at: new Date().toISOString(),
      output: { ok: true, results: v.results as never },
    });
    assert.deepEqual(
      entries.map((e) => e.result),
      ["inconclusive", "inconclusive", "inconclusive"],
    );
  });

  test("the clean call carries the wall", async () => {
    const op = loadSite("eu-t1")!.site.operations.find((o) => o.name === "api")!;
    const r = await cleanCall(op, { q: "AMS" }, { site: "eu-t1", ...fast });
    assert.deepEqual([r.class, r.wall], ["error", "consent"], JSON.stringify(r));
  });

  test("the cookies the consent step set reach tier 1, alone, and keep answering; nothing of them is in the spec", async () => {
    // what a window keeps: the choice, not a sign-in it held already nor a cookie every visitor gets
    const signedIn = cookie("sessionid", "0123456789abcdef");
    const kept = visitorChoices(
      [signedIn],
      [signedIn, cookie("eu_choice", "reject"), cookie("app_session", "guest-value")],
      ["app_session"],
    );
    assert.deepEqual(
      kept.map((c) => c.name),
      ["eu_choice"],
    );
    const spec = JSON.stringify(loadSite("eu-t1")!.site);
    mergeCapture("eu-t1", kept);
    for (const op of ["api", "page", "state", "api"]) {
      const before = fx.calls.length;
      const r = await call("eu-t1", op, { q: "AMS" }, fast);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.tier, 1);
      if (op === "api") {
        assert.deepEqual(r.data, FLIGHTS.AMS);
        assert.deepEqual(
          fx.calls.slice(before).map((c) => c.headers.cookie),
          ["eu_choice=reject"],
        );
      } else assert.equal((r.data as unknown[]).length, FLIGHTS.AMS!.length);
    }
    // the spec is as it was: no cookie value and no new ref
    assert.equal(JSON.stringify(loadSite("eu-t1")!.site), spec);
    assert.doesNotMatch(spec, /eu_choice|reject/);
  });

  test("the clean replay sends nothing of the user's, so a consent-walled site replays as the wall", async () => {
    const op = loadSite("eu-t1")!.site.operations.find((o) => o.name === "api")!;
    const before = fx.calls.length;
    const r = await cleanCall(op, { q: "AMS" }, { site: "eu-t1", ...fast });
    assert.equal(r.class, "error");
    assert.match(r.reason, /cookie-consent page/);
    assert.deepEqual(
      fx.calls.slice(before).map((c) => c.headers.cookie),
      [undefined],
    );
  });
});

describe("a consent wall on a consent.<site> host", () => {
  const CONSENT =
    '<!doctype html><html><head><title>Before you continue</title></head><body><h1>Before you continue</h1><form action="https://consent.example.com/save" method="post"><button>Reject all</button><button>Accept all</button></form><a href="https://accounts.example.com/ServiceLogin">Sign in</a></body></html>';
  const sent: { url: string; cookie?: string }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const c = (init?.headers as Record<string, string> | undefined)?.cookie;
    sent.push({ url: url.href, ...(c ? { cookie: c } : {}) });
    if (url.hostname === "consent.example.com")
      return new Response(CONSENT, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (!/(^|; )eu_choice=/.test(c ?? ""))
      return new Response("", {
        status: 302,
        headers: { location: `https://consent.example.com/m?continue=${encodeURIComponent(url.href)}&hl=en` },
      });
    return new Response(JSON.stringify({ flights: FLIGHTS.AMS }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const opts = { fetchImpl, maxTier: 1 as const, ...fast };

  test("a public read: error and a window to answer it in; with the choice in the jar, ok", async () => {
    saveFlights("walled", "https://www.example.com");
    const r = await call("walled", "api", { q: "AMS" }, opts);
    walled(r, "walled", "api", 1);
    assert.match(r.reason ?? "", /redirected to https:\/\/consent\.example\.com\/m\?continue=/);
    // the site's own address, shown as a spec's is
    assert.match(r.next ?? "", /\(https:\/\/consent\.example\.com\/m\?continue=https%3A%2F%2Fwww\.example\.com/);
    assert.equal(
      sent.at(-1)!.url,
      "https://consent.example.com/m?continue=https%3A%2F%2Fwww.example.com%2Fapi%2Feu%2Fflights%3Fq%3DAMS&hl=en",
    );

    mergeCapture("walled", [{ ...cookie("eu_choice", "reject", ".example.com"), secure: true }]);
    for (let i = 0; i < 2; i++) {
      const ok = await call("walled", "api", { q: "AMS" }, opts);
      assert.equal(ok.ok, true, JSON.stringify(ok));
      assert.deepEqual(ok.data, FLIGHTS.AMS);
      assert.equal(sent.at(-1)!.cookie, "eu_choice=reject");
    }
    // the spec still passes the rules a shared spec is held to, and names no cookie
    const spec = loadSite("walled")!.site;
    assert.deepEqual(vetShared(spec).errors, []);
    assert.doesNotMatch(JSON.stringify(spec), /eu_choice/);
  });

  test("a signed-in read: the page is finished in the everyday browser, then login imports it", async () => {
    saveFlights("walled-in", "https://www.example.com", 1, { learnedLoggedIn: true });
    walled(await call("walled-in", "api", { q: "AMS" }, opts), "walled-in", "api", 1, true);
  });
});

describe("a consent wall at tiers 2 and 3, learning on it, and the window that clears it", {
  skip: !browserAvailable() && "no Chromium browser installed",
}, () => {
  let fx: Fixture;
  before(async () => {
    // the fixture is on localhost, which MCP learn_site refuses to load anywhere else
    learnTool.publicOnly = false;
    fx = await startFixture();
    saveFlights("eu", fx.url);
    saveFlights("eu2", fx.url, 2);
    saveFlights("eu3", fx.url, 3);
  });
  after(async () => {
    learnTool.publicOnly = true;
    await closeBrowser();
    await fx.close();
  });

  test("tier 2's page fetch and tier 3's trigger run answer error naming the consent page", async () => {
    walled(await call("eu", "api", { q: "AMS" }, fast), "eu", "api", 1);
    walled(await call("eu2", "api", { q: "AMS" }, fast), "eu2", "api", 2);
    walled(await call("eu2", "page", { q: "AMS" }, fast), "eu2", "page", 2);
    walled(await call("eu3", "api", { q: "AMS" }, fast), "eu3", "api", 3);
    walled(await call("eu3", "page", { q: "AMS" }, fast), "eu3", "page", 3);
  });

  test("add and learn_site on the walled page say consent, not that no request carries the examples", async () => {
    await assert.rejects(
      addOperation({
        site: "eu-add",
        op: "flights",
        trigger: { url: `${fx.url}/eu/flights?q={q}` },
        examples: [{ q: "AMS" }, { q: "BER" }],
        response: { extract: "flights" },
      }),
      /cookie-consent page, instead of the data.*api-anything login eu-add --window/,
    );
    const r = await learnSite(
      {
        site: "eu-learn",
        trigger: `${fx.url}/eu/flights?q={q}`,
        args: { q: "AMS" },
        args2: { q: "BER" },
        args3: { q: "CDG" },
        fresh: true,
      },
      fast,
    );
    assert.deepEqual([r.ok, r.wall], [false, "consent"], JSON.stringify(r));
    assert.match(r.error ?? "", /\/eu\/consent\?continue=.*cookie-consent page/);
    assert.doesNotMatch(r.error ?? "", /carries the example values/);
    assert.deepEqual(r.nextCall, { action: "login", site: "eu-learn", mode: "window" });
    assert.equal(loadSite("eu-learn"), undefined, "nothing saved");
  });

  test("a run that ends on a consent address with an outage or a challenge is that, not a consent step", async () => {
    for (const [kind, cls] of [
      ["eudown", "error"],
      ["euwall", "blocked"],
    ] as const) {
      const site = `${kind}-3`;
      saveSite(
        parseSite({
          name: site,
          baseUrl: fx.url,
          operations: [
            {
              name: "api",
              readOnly: true,
              minTier: 3,
              request: { method: "GET", url: `${fx.url}/api/${kind}/flights?q=AMS`, headers: {} },
              slots: [{ param: "q", at: ["query:q"] }],
              params: [{ name: "q", example: "BER" }],
              trigger: { url: `${fx.url}/${kind}/flights?q={q}` },
              match: { method: "GET", path: `/api/${kind}/flights` },
              response: { extract: "flights" },
            },
          ],
        }),
      );
      const r = await call(site, "api", { q: "AMS" }, fast);
      const said = JSON.stringify(r);
      assert.equal(r.wall, undefined, said);
      assert.equal(r.class, cls, said);
      assert.doesNotMatch(r.reason ?? "", /cookie-consent/, said);
      if (kind === "eudown") assert.match(r.reason ?? "", /503/, said);

      await assert.rejects(
        addOperation({
          site: `${kind}-add`,
          op: "flights",
          trigger: { url: `${fx.url}/${kind}/flights?q={q}` },
          examples: [{ q: "AMS" }, { q: "BER" }],
          response: { extract: "flights" },
        }),
        (e: Error) => !/cookie-consent/.test(e.message),
      );
      const learned = await learnSite(
        {
          site: `${kind}-learn`,
          trigger: `${fx.url}/${kind}/flights?q={q}`,
          args: { q: "AMS" },
          args2: { q: "BER" },
          args3: { q: "CDG" },
          fresh: true,
        },
        fast,
      );
      assert.equal(learned.ok, false);
      assert.notEqual(learned.wall, "consent", JSON.stringify(learned));
      assert.doesNotMatch(learned.error ?? "", /cookie-consent/);
    }
  });

  test("a large challenge at a consent address is blocked at tiers 1 and 3; a consent page as large is a consent at both", async () => {
    for (const [kind, cls, wall] of [
      ["eubig", "blocked", undefined],
      ["eubigok", "error", "consent"],
    ] as const) {
      for (const tier of [1, 3] as const) {
        const site = `${kind}-t${tier}`;
        saveSite(
          parseSite({
            name: site,
            baseUrl: fx.url,
            operations: [
              {
                name: "api",
                readOnly: true,
                minTier: tier,
                request: { method: "GET", url: `${fx.url}/api/${kind}/flights?q=AMS`, headers: {} },
                slots: [{ param: "q", at: ["query:q"] }],
                params: [{ name: "q", example: "BER" }],
                trigger: { url: `${fx.url}/${kind}/flights?q={q}` },
                match: { method: "GET", path: `/api/${kind}/flights` },
                response: { extract: "flights" },
              },
            ],
          }),
        );
        const r = await call(site, "api", { q: "AMS" }, { ...fast, maxTier: tier });
        assert.deepEqual([r.class, r.wall], [cls, wall], JSON.stringify(r));
      }
    }
  });
  test("capture says the page is the consent page", async () => {
    // the CLI runs Chrome on the same profile: this process lets go of it first
    await closeBrowser();
    const out = await new Promise<string>((resolve, reject) =>
      execFile(
        process.execPath,
        ["--import", "tsx", join(ROOT, "src", "cli.ts"), "capture", `${fx.url}/eu/flights?q=AMS`],
        { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
        (err, stdout, stderr) => (err ? reject(new Error(`${err.message}\n${stderr}`)) : resolve(stdout)),
      ),
    );
    const c = JSON.parse(out) as { wall?: string; finalUrl: string; next: string };
    assert.equal(c.wall, "consent", out);
    assert.match(c.finalUrl, /\/eu\/consent\?continue=/);
    assert.match(c.next, /cookie-consent page.*login <site> --window/);
    // an outage or a challenge at a consent address is no consent step
    for (const kind of ["eudown", "euwall"]) {
      const o = await new Promise<string>((resolve, reject) =>
        execFile(
          process.execPath,
          ["--import", "tsx", join(ROOT, "src", "cli.ts"), "capture", `${fx.url}/${kind}/flights?q=AMS`],
          { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
          (err, stdout, stderr) => (err ? reject(new Error(`${err.message}\n${stderr}`)) : resolve(stdout)),
        ),
      );
      const d = JSON.parse(o) as { wall?: string; next: string };
      assert.equal(d.wall, undefined, o);
      assert.doesNotMatch(d.next, /cookie-consent/, o);
    }
  });

  test("the user answers once in the window: the choice alone is kept, and every tier answers from then on", async () => {
    const before = loadSession("eu");
    const pending = windowLogin("eu", `${fx.url}/eu/flights?q=AMS`, { waitForEnter: false });
    let page: Page | undefined;
    for (let i = 0; i < 300 && !page; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const ctx = await openBrowser({ profileDir: profileDir(), headless: false });
      page = ctx.pages().find((p) => p.url().includes("/eu/consent"));
    }
    assert.ok(page, "the window opened on the consent page");
    await page.click("text=Reject all");
    await page.waitForURL(/\/eu\/flights\?q=AMS/);
    // a read of the jar after the cookie landed, as the window does every half second
    await new Promise((r) => setTimeout(r, 1200));
    await page.close({ runBeforeUnload: true });
    const w = await pending;
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(w.ok && w.kept, ["eu_choice"]);
    const after = loadSession("eu");
    assert.deepEqual(
      after.cookies.map((c) => `${c.name}=${c.value}`),
      ["eu_choice=reject"],
    );
    assert.equal(after.source, before.source, "no sign-in was recorded");

    for (const [site, op, tier] of [
      ["eu", "api", 1],
      ["eu", "page", 1],
      ["eu2", "api", 2],
      ["eu3", "api", 3],
      ["eu3", "page", 3],
      ["eu", "api", 1],
    ] as const) {
      const r = await call(site, op, { q: "AMS" }, fast);
      assert.equal(r.ok, true, `${site} ${op}: ${JSON.stringify(r)}`);
      assert.equal(r.tier, tier);
      assert.equal((r.data as unknown[]).length, FLIGHTS.AMS!.length);
    }
    assert.equal(existsSync(join(HOME, "heals.jsonl")), false, "no heal ran");
  });
});
