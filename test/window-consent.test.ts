/**
 * A site that gives every visitor its consent cookie "pending" and changes only its value on the
 * choice (issue #84's shape), beside a visitor id it gives anew on every page. The window keeps what the
 * user changed after the page loaded, and nothing the load set; what it keeps reaches every tier, in
 * api-anything's own browser too when the site gives the answer no expiry.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import type { Page } from "playwright-core";
import { browserAvailable, closeBrowser, openBrowser } from "../src/browser.js";
import { call } from "../src/execute.js";
import { profileDir } from "../src/heal.js";
import { resolveLoginTarget, windowLogin } from "../src/login.js";
import { loadSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { saveSite } from "../src/store.js";
import { type Fixture, FLIGHTS, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-window-consent-"));
process.env.API_ANYTHING_HOME = HOME;
const fast = { minIntervalMs: 0 };
after(() => rmSync(HOME, { recursive: true, force: true }));

/** `kind`'s flights read at `minTier` under `name`, its baseUrl the walled page, as a hint opens it. */
function saveFlights(fx: Fixture, kind: string, name: string, minTier: 1 | 2 | 3): void {
  const page = minTier === 3;
  saveSite(
    parseSite({
      name,
      baseUrl: `${fx.url}/${kind}/flights?q=AMS`,
      operations: [
        {
          name: "flights",
          readOnly: true,
          minTier,
          request: { method: "GET", url: `${fx.url}${page ? "" : "/api"}/${kind}/flights?q=AMS`, headers: {} },
          slots: [{ param: "q", at: ["query:q"] }],
          params: [{ name: "q", example: "BER" }],
          trigger: { url: `${fx.url}/${kind}/flights?q={q}` },
          match: { method: "GET", path: `${page ? "" : "/api"}/${kind}/flights` },
          response: page
            ? { format: "html", html: { items: "ul.flights li.f", fields: { to: ".to", price: ".price" } } }
            : { extract: "flights" },
        },
      ],
    }),
  );
}

/** The window's tab, once it shows a page whose address holds `part`: what the user sees. */
async function windowTab(part: string): Promise<Page> {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const page = (await openBrowser({ profileDir: profileDir(), headless: false }))
      .pages()
      .find((p) => p.url().includes(part));
    if (page) return page;
  }
  throw new Error(`the window did not show ${part}`);
}

/** The user closes the window once the window has read the jar after what they did. */
async function userCloses(page: Page): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200));
  await page.close({ runBeforeUnload: true });
}

/** The window the hint `next` names, opened as written: `api-anything login <site> --window`. */
function followed(next: string): Promise<Awaited<ReturnType<typeof windowLogin>>> {
  const site = /api-anything login ([\w.-]+) --window/.exec(next)?.[1];
  assert.ok(site, next);
  const t = resolveLoginTarget(site);
  return windowLogin(t.site, t.url, { waitForEnter: false });
}

describe("a consent cookie every visitor gets pending", {
  skip: !browserAvailable() && "no Chromium browser installed",
}, () => {
  let fx: Fixture;
  before(async () => {
    fx = await startFixture();
    for (const kind of ["pend", "pends"]) {
      saveFlights(fx, kind, kind, 1);
      saveFlights(fx, kind, `${kind}2`, 2);
      saveFlights(fx, kind, `${kind}3`, 3);
    }
  });
  after(async () => {
    await closeBrowser();
    await fx.close();
  });

  test("a window closed with nothing done keeps nothing, the visitor id the load gave included, and answers ok false", async () => {
    const r = await call("pend", "flights", { q: "AMS" }, fast);
    assert.equal(r.wall, "consent", JSON.stringify(r));
    // tier 1 merged what the site gave it: the pending value and a visitor id
    const before = loadSession("pend");
    assert.equal(before.cookies.find((c) => c.name === "pend_consent")?.value, "pending");
    const pending = followed(r.next ?? "");
    await userCloses(await windowTab("/pend/consent"));
    const w = await pending;
    assert.equal(w.ok, false, JSON.stringify(w));
    assert.deepEqual(loadSession("pend").cookies, before.cookies, "the stored session is unchanged");
  });

  test("the pending consent answered in the window is kept alone, and tiers 1, 2 and 3 answer from then on", async () => {
    const r = await call("pend", "flights", { q: "AMS" }, fast);
    assert.equal(r.wall, "consent", JSON.stringify(r));
    const visit = (s: ReturnType<typeof loadSession>) => s.cookies.find((c) => c.name === "pend_visit")?.value;
    const before = visit(loadSession("pend"));
    const pending = followed(r.next ?? "");
    const page = await windowTab("/pend/consent");
    await page.click("text=Reject all");
    await page.waitForURL(/\/pend\/flights\?q=AMS/);
    await userCloses(page);
    const w = await pending;
    assert.equal(w.ok, true, JSON.stringify(w));
    // the visitor id changed too, on every load: the site's, not the user's answer
    assert.deepEqual(w.ok && w.kept, ["pend_consent"]);
    const jar = loadSession("pend");
    assert.equal(jar.cookies.find((c) => c.name === "pend_consent")?.value, "reject");
    assert.equal(visit(jar), before, "the window's visitor ids were not kept");
    for (const [site, tier] of [
      ["pend", 1],
      ["pend2", 2],
      ["pend3", 3],
    ] as const) {
      const a = await call(site, "flights", { q: "AMS" }, fast);
      assert.equal(a.ok, true, `${site}: ${JSON.stringify(a)}`);
      assert.equal(a.tier, tier);
      assert.equal((a.data as unknown[]).length, FLIGHTS.AMS!.length);
    }
  });

  test("an answer the site gives no expiry reaches tiers 2 and 3 of api-anything's own browser, after it closed", async () => {
    await closeBrowser();
    rmSync(profileDir(), { recursive: true, force: true });
    const r = await call("pends2", "flights", { q: "AMS" }, fast);
    assert.equal(r.wall, "consent", JSON.stringify(r));
    // the hint names the site whose session the window fills: tier 1's jar, and the profile for all
    const pending = followed(r.next ?? "");
    const page = await windowTab("/pends/consent");
    await page.click("text=Reject all");
    await page.waitForURL(/\/pends\/flights\?q=AMS/);
    await userCloses(page);
    const w = await pending;
    assert.deepEqual(w.ok && w.kept, ["pends_consent"], JSON.stringify(w));
    const kept = loadSession("pends2").cookies.find((c) => c.name === "pends_consent");
    assert.equal(kept?.expires, -1, "the jar keeps it as the site set it");
    // the browser the window ran in is closed: what tiers 2 and 3 carry is the profile on disk
    await closeBrowser();
    for (const [site, tier] of [
      ["pends2", 2],
      ["pends3", 3],
    ] as const) {
      const a = await call(site, "flights", { q: "AMS" }, fast);
      assert.equal(a.ok, true, `${site}: ${JSON.stringify(a)}`);
      assert.equal(a.tier, tier);
    }
  });
});
