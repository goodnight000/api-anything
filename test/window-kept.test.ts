/**
 * What the sign-in window keeps and answers when no sign-in it knows appeared: analytics alone keep
 * nothing and answer as a window that saw nothing; a cookie that may carry an account is kept but
 * never called a consent, and the answer says what to do whichever the user did. A session filled
 * this way is never judged public.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as httpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Page } from "playwright-core";
import { browserAvailable, closeBrowser, openBrowser } from "../src/browser.js";
import { profileDir } from "../src/heal.js";
import { visitorChoices, windowAnswer, windowLogin } from "../src/login.js";
import { createServer } from "../src/mcp.js";
import { isPublic } from "../src/publish.js";
import { loadSession } from "../src/session.js";
import { parseSite } from "../src/spec.js";
import { loadSite, saveSite } from "../src/store.js";
import type { StoredCookie } from "../src/types.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-window-kept-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const cookie = (name: string, value = "v-0123456789"): StoredCookie => ({
  name,
  value,
  domain: "127.0.0.1",
  path: "/",
  expires: -1,
  httpOnly: false,
  secure: false,
});

test("analytics and tracking cookies alone are not a visitor's choice; a consent or a cleared challenge is", () => {
  const names = (c: StoredCookie[]) => c.map((x) => x.name);
  assert.deepEqual(
    names(visitorChoices([], [cookie("_ga"), cookie("_gid"), cookie("_fbp"), cookie("_hjSessionUser_1")], [])),
    [],
  );
  assert.deepEqual(names(visitorChoices([], [cookie("_ga"), cookie("OptanonConsent"), cookie("cf_clearance")], [])), [
    "OptanonConsent",
    "cf_clearance",
  ]);
  // a name nothing knows may be a consent or a sign-in: kept, and told apart in the answer
  assert.deepEqual(names(visitorChoices([], [cookie("_ga"), cookie("PHPSESSID")], [])), ["PHPSESSID"]);
});

test("the answer for kept cookies: a known consent says retry; one that may carry an account is never called a consent", () => {
  const how = "api-anything login shop --window";
  const consent = windowAnswer(
    "shop",
    { ok: true, cookies: [], renewed: [], kept: ["OptanonConsent"], account: [] },
    how,
  );
  assert.equal(consent.ok, true);
  assert.equal(consent.loggedIn, false);
  assert.match(String(consent.warning), /OptanonConsent.*cookie consent or a cleared challenge/);
  assert.match(String(consent.next), /^retry the call/);
  assert.match(String(consent.next), /loginCookies/);

  const unknown = windowAnswer(
    "shop",
    { ok: true, cookies: [], renewed: [], kept: ["PHPSESSID"], account: ["PHPSESSID"] },
    how,
  );
  assert.deepEqual([unknown.ok, unknown.loggedIn, unknown.kept], [true, false, ["PHPSESSID"]]);
  assert.doesNotMatch(String(unknown.warning), /consent/, "a cookie that may carry an account is not called a consent");
  assert.match(String(unknown.warning), /PHPSESSID may carry an account/);
  assert.match(String(unknown.next), /answered a consent page or cleared a challenge.*retry the call/);
  assert.match(
    String(unknown.next),
    /signed in.*did not recognize.*PHPSESSID.*loginCookies.*api-anything login shop --window/,
  );

  const signedIn = windowAnswer("shop", { ok: true, cookies: [cookie("sessionid")], renewed: ["sessionid"] }, how);
  assert.deepEqual(signedIn, {
    ok: true,
    site: "shop",
    source: "window",
    cookies: ["sessionid"],
    loggedIn: true,
    renewed: ["sessionid"],
  });
});

/** A site whose pages set analytics from script; /signin gives a session cookie of a name nothing knows. */
function shop(): Promise<{ base: string; server: Server }> {
  const page = `<html><body><p>shop</p><script>document.cookie = "_ga=GA1.1.1234567890.1700000000; path=/"; document.cookie = "_gid=GA1.1.987654321.1700000000; path=/";</script></body></html>`;
  const server = httpServer((req, res) => {
    if (req.url === "/signin") {
      res.writeHead(302, { location: "/", "set-cookie": "PHPSESSID=9f8e7d6c5b4a39281706f5e4; Path=/; HttpOnly" });
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page);
  });
  return new Promise((r) =>
    server.listen(0, "127.0.0.1", () =>
      r({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server }),
    ),
  );
}

async function windowPage(part = "127.0.0.1"): Promise<Page> {
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const page = (await openBrowser({ profileDir: profileDir(), headless: false }))
      .pages()
      .find((p) => p.url().includes(part));
    if (page) return page;
  }
  throw new Error("the window did not open");
}

/** The user closes the window once the window has read the jar after what they did. */
async function userCloses(page: Page): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200));
  await page.close({ runBeforeUnload: true });
}

describe("the window on a site with analytics", {
  skip: !browserAvailable() && "no Chromium browser installed",
}, () => {
  let base: string;
  let server: Server;
  before(async () => ({ base, server } = await shop()));
  after(async () => {
    await closeBrowser();
    await new Promise((r) => server.close(r));
  });

  test("closed with nothing done: the analytics are not kept, and it answers ok false with the reason", async () => {
    const pending = windowLogin("trk", `${base}/`, { waitForEnter: false });
    await userCloses(await windowPage());
    const w = await pending;
    assert.equal(w.ok, false, JSON.stringify(w));
    assert.match(w.ok ? "" : w.reason, /no sign-in seen: no login cookie appeared while the window was open/);
    assert.deepEqual(loadSession("trk").cookies, [], "the stored session is unchanged");
  });

  test("in api-anything's own browser too, ending one window ends that window alone", async () => {
    const stop = new AbortController();
    const first = windowLogin("trk", `${base}/?w=1`, { waitForEnter: false, signal: stop.signal });
    const one = await windowPage("w=1");
    const second = windowLogin("trk", `${base}/?w=2`, { waitForEnter: false });
    const two = await windowPage("w=2");
    assert.notEqual(one, two, "each window has a page of its own");
    // the MCP server's cap on the first, then the user closes the second
    stop.abort();
    await first;
    assert.deepEqual([one.isClosed(), two.isClosed()], [true, false], "the other window is still open");
    await userCloses(two);
    await second;
  });

  test("a sign-in by a cookie name nothing knows: kept, said plainly over MCP, and the session is never public", async () => {
    saveSite(
      parseSite({
        name: "php",
        baseUrl: `${base}/`,
        operations: [
          {
            name: "list",
            readOnly: true,
            trigger: { url: `${base}/` },
            match: { method: "GET", path: "/api/list" },
            request: { method: "GET", url: `${base}/api/list`, headers: {} },
            slots: [],
            volatile: [],
            params: [],
            response: { format: "json" },
          },
        ],
      }),
    );
    const client = new Client({ name: "agent", version: "0" });
    const [x, y] = InMemoryTransport.createLinkedPair();
    await createServer({ waitMs: 120_000 }).connect(x);
    await client.connect(y);
    let r: Record<string, unknown>;
    try {
      const pending = client.callTool({ name: "login", arguments: { site: "php", mode: "window" } });
      const page = await windowPage();
      await page.goto(`${base}/signin`);
      await userCloses(page);
      r = JSON.parse(((await pending).content as { text: string }[])[0]!.text);
    } finally {
      await client.close();
    }
    assert.deepEqual([r.ok, r.loggedIn, r.kept], [true, false, ["PHPSESSID"]], JSON.stringify(r));
    assert.doesNotMatch(String(r.warning), /consent/);
    assert.match(String(r.next), /did not recognize.*PHPSESSID.*loginCookies/);
    const s = loadSession("php");
    assert.deepEqual(
      s.cookies.map((c) => c.name),
      ["PHPSESSID"],
      "the analytics were not kept",
    );
    const spec = loadSite("php")!.site;
    const op = spec.operations[0]!;
    assert.equal(
      isPublic(spec, op, { cleanReplay: "ok" }, s),
      false,
      "a session holding the kept cookie is not public",
    );
    assert.equal(
      isPublic(spec, op, { cleanReplay: "ok" }, { cookies: [] }),
      true,
      "the same op with no such cookie would be",
    );
  });
});
