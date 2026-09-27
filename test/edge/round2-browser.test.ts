/**
 * Round-2 regressions for the browser layer: a popup's WebSocket sends are dropped while learning a
 * write, and a run waits out a JS challenge that reloads the page.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer as httpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { chromeAvailable, closeBrowser, runTrigger } from "../../src/browser.ts";
import { capturePage, profileDir } from "../../src/heal.ts";

const TMP = mkdtempSync(join(tmpdir(), "aa-round2-"));
after(() => rmSync(TMP, { recursive: true, force: true }));
let homes = 0;
const newHome = () => {
  const h = join(TMP, `home${++homes}`);
  mkdirSync(join(h, "sites"), { recursive: true });
  process.env.API_ANYTHING_HOME = h;
  return h;
};
newHome();
const noChrome = !chromeAvailable() && "Google Chrome not installed";

/* ------------------------------------------------------------ 5, 6: browser */

describe("browser", { skip: noChrome }, () => {
  let wsMessages = 0;
  const server = httpServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const page = (body: string, status = 200) => {
      res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`);
    };
    if (u.pathname === "/pop") return page(`<button id="popupws" onclick="window.open('/chat2')">chat</button>`);
    if (u.pathname === "/chat2") return page(`<script>const ws=new WebSocket("ws://"+location.host+"/ws");ws.onopen=()=>ws.send("a private message")</script>`);
    if (u.pathname === "/hotels") {
      // AWS WAF-style interstitial that takes a while to solve, then reloads with its token cookie
      const delay = Number(u.searchParams.get("delay") ?? 2500);
      if (!/aws-waf-token=ok/.test(req.headers.cookie ?? "")) {
        res.writeHead(202, { "content-type": "text/html" });
        return res.end(
          `<!doctype html><html><head><title></title><script>window.awsWafCookieDomainList=['127.0.0.1'];window.gokuProps={"key":"k"};</script><script>setTimeout(()=>{document.cookie="aws-waf-token=ok; path=/";location.reload()},${delay})</script></head><body></body></html>`,
        );
      }
      return page(`<div class="card">${u.searchParams.get("q")} hotel</div><script>fetch("/api/list")</script>`);
    }
    if (u.pathname === "/api/list") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end('{"items":[1,2]}');
    }
    res.writeHead(404);
    res.end();
  });
  const sockets = new Set<import("node:stream").Duplex>();
  server.on("upgrade", (req, socket) => {
    sockets.add(socket);
    const accept = createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.on("data", (d: Buffer) => void ((d[0]! & 0x0f) === 1 && wsMessages++));
    socket.on("error", () => {});
  });
  let url = "";
  const ready = new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  after(async () => {
    await closeBrowser();
    for (const s of sockets) s.destroy();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  });

  test("capture --write: a WebSocket message sent from a popup the steps open never reaches the server", async () => {
    await ready;
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    newHome();
    const steps = [{ action: "click" as const, selector: "#popupws" }, { action: "wait" as const, ms: 1500 }];
    await capturePage({ url: `${url}/pop`, steps, write: true });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(wsMessages, 0, "the popup's message was sent while learning a write");
    // control: without --write the same page does send it (the fixture works)
    await capturePage({ url: `${url}/pop`, steps });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(wsMessages, 1);
  });

  test("a run waits out a JS challenge that reloads after a couple of seconds, instead of ending on the interstitial", async () => {
    await ready;
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    newHome();
    const withMatch = await runTrigger({ url: `${url}/hotels?q=Madrid&delay=2500`, profileDir: profileDir(), match: (e) => e.request.url.includes("/hotels") });
    const docs = withMatch.exchanges.filter((e) => e.request.url.includes("/hotels") && e.response);
    assert.equal(docs.at(-1)?.response?.status, 200, `documents: ${docs.map((d) => d.response?.status).join(",")}`);
    assert.match(docs.at(-1)?.response?.body ?? "", /Madrid hotel/);
    newHome(); // a fresh profile: challenged again
    const plain = await runTrigger({ url: `${url}/hotels?q=Porto&delay=3000`, profileDir: profileDir() });
    assert.ok(plain.exchanges.some((e) => e.request.url.endsWith("/api/list") && e.response?.status === 200), "the real page's data request was captured");
  });
});
