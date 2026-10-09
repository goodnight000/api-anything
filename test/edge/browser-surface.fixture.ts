/**
 * Edge-case site for the browser-surface probes: pages that never go network-quiet, never fire
 * `load`, open popups, embed iframes, download files, redirect to a login page, debounce search
 * input, and serve very large bodies.
 */
import { createHash } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface EdgeFixture {
  url: string;
  /** path + query of every request, in order */
  calls: string[];
  /** text frames received over /ws (each one a message the page sent: a write over a WebSocket) */
  wsMessages(): number;
  close(): Promise<void>;
}

const html = (res: ServerResponse, body: string, status = 200) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`);
};
const json = (res: ServerResponse, v: unknown, status = 200) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(v));
};
const dataFetch = (name: string) =>
  `<div id="out"></div><script>fetch("/api/data?name="+encodeURIComponent(${JSON.stringify(name)})).then(r=>r.json()).then(v=>{document.getElementById("out").textContent=JSON.stringify(v)})</script>`;

/** A session cookie in base64 with "/", "+" and "=" (percent-encoded whenever a page puts it in a URL). */
export const TOKEN = "q2Fz/9kLmT0vX+Yb7NcW1pRe/Hs3JuQa8Df+Lg6ZoVy4=";

export async function startEdgeFixture(o: { rootRedirect?: boolean } = {}): Promise<EdgeFixture> {
  const calls: string[] = [];
  const hanging = new Set<ServerResponse>();
  let port = 0;
  const server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const name = u.searchParams.get("name") ?? "alice";
    calls.push(u.pathname + u.search);
    switch (u.pathname) {
      case "/api/data":
        return json(res, { data: { name, followers: name.length * 100 } });
      case "/api/search":
        return json(res, { results: [`${u.searchParams.get("q")} one`, `${u.searchParams.get("q")} two`] });
      case "/api/big": {
        const items = Array.from({ length: 20_000 }, (_, i) => ({ id: i, name, pad: "x".repeat(300) }));
        return json(res, { data: { items } });
      }
      case "/api/huge-items":
        // five items, each far bigger than the 20k-char output cap
        return json(res, { data: Array.from({ length: 5 }, (_, i) => ({ id: i, name, blob: "y".repeat(30_000) })) });
      case "/api/beacon":
        res.writeHead(204);
        return res.end();
      case "/api/sse":
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        res.write(": open\n\n");
        hanging.add(res);
        {
          const t = setInterval(() => res.write(": ping\n\n"), 200);
          res.on("close", () => clearInterval(t));
        }
        return;
      case "/hang":
        hanging.add(res); // never answers
        return;
      case "/data-page":
        return html(res, dataFetch(name));
      case "/hang-img":
        return html(res, `${dataFetch(name)}<img src="/hang">`);
      case "/sse-page":
        return html(res, `${dataFetch(name)}<script>new EventSource("/api/sse")</script>`);
      case "/beacon-page":
        return html(
          res,
          `${dataFetch(name)}<script>setInterval(()=>fetch("/api/beacon",{method:"POST",body:"t="+Date.now()}),150)</script>`,
        );
      case "/late":
        // hydration that waits a little before loading its data
        return html(
          res,
          `<div id="out"></div><script>setTimeout(()=>fetch("/api/data?name="+encodeURIComponent(${JSON.stringify(name)})),1200)</script>`,
        );
      case "/debounce":
        // search-as-you-type with a 600 ms debounce, the common typeahead pattern
        return html(
          res,
          `<input id="q"><ul id="out"></ul><script>let t;document.getElementById("q").addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>fetch("/api/search?q="+encodeURIComponent(e.target.value)).then(r=>r.json()).then(v=>{document.getElementById("out").textContent=JSON.stringify(v)}),600)})</script>`,
        );
      case "/popup":
        return html(res, `<a id="open" target="_blank" href="/data-page?name=${encodeURIComponent(name)}">open</a>`);
      case "/iframe":
        return html(res, `<iframe src="/data-page?name=${encodeURIComponent(name)}"></iframe>`);
      case "/file.csv":
        res.writeHead(200, { "content-type": "text/csv", "content-disposition": 'attachment; filename="export.csv"' });
        return res.end(`name,followers\n${name},100\n`);
      case "/dl-page":
        return html(res, `<a id="dl" href="/file.csv?name=${encodeURIComponent(name)}">download</a>${dataFetch(name)}`);
      case "/members":
        // behind a login wall: signed-in visitors carry the sid cookie
        if (/(?:^|; )sid=/.test(req.headers.cookie ?? "")) return html(res, dataFetch(name));
        res.writeHead(302, { location: `/login-page?next=${encodeURIComponent(u.pathname + u.search)}` });
        return res.end();
      case "/login-page":
        return html(
          res,
          `<h1>Sign in</h1><form action="/session" method="post"><input name="username"><input type="password" name="password"><button>Log in</button></form>`,
        );
      case "/big-page":
        return html(
          res,
          `${`<p>${"lorem ipsum ".repeat(50)}</p>`}`.repeat(4000) +
            `<script>fetch("/api/big?name=${encodeURIComponent(name)}")</script>`,
        );
      case "/huge-page":
        return html(res, `<script>fetch("/api/huge-items?name=${encodeURIComponent(name)}")</script>`);
      case "/vote-page":
        // old-school writes that are GETs but not xhr/fetch: an image ping (Hacker News style), a link, a GET form
        return html(
          res,
          `<button id="img" onclick="new Image().src='/api/vote?how=img'">up</button>` +
            `<a id="link" href="/api/vote?how=link">vote</a>` +
            `<form id="f" action="/api/vote" method="get"><input name="how" value="form"><button id="submit">go</button></form>` +
            `<button id="script" onclick="const s=document.createElement('script');s.src='/api/vote?how=script';document.body.appendChild(s)">jsonp</button>` +
            `<button id="iframe" onclick="const f=document.createElement('iframe');f.src='/api/vote?how=iframe';document.body.appendChild(f)">frame</button>` +
            `<button id="post" onclick="fetch('/api/vote?how=post',{method:'POST',body:'up'})">post</button>` +
            dataFetch(name),
        );
      case "/api/vote":
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("voted");
      case "/chat":
        // a chat app: the socket opens at load, the message (the write) goes over it on click
        return html(
          res,
          `<input id="msg" value="hello"><button id="send">send</button><script>const ws=new WebSocket("ws://"+location.host+"/ws");document.getElementById("send").onclick=()=>ws.send(document.getElementById("msg").value)</script>`,
        );
      case "/":
        // like an API host whose root redirects to the main site on another origin
        if (o.rootRedirect) {
          res.writeHead(302, { location: `http://localhost:${port}/landing` });
          return res.end();
        }
        return html(res, "<p>home</p>");
      case "/landing":
        return html(res, "<p>main site</p>");
      case "/tok-page":
        // the page echoes a base64 session cookie, prefixed, inside a query value
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "set-cookie": `tok=${TOKEN}; Path=/; SameSite=Lax`,
        });
        return res.end(
          `<!doctype html><div id="out"></div><script>const t=(document.cookie.match(/(?:^|; )tok=([^;]*)/)||[])[1];fetch("/api/data?name="+encodeURIComponent(${JSON.stringify(name)})+"&auth="+encodeURIComponent("v1:"+t))</script>`,
        );
      default:
        res.writeHead(404);
        return res.end();
    }
  });
  let wsMessages = 0;
  const sockets = new Set<import("node:stream").Duplex>();
  server.on("upgrade", (req, socket) => {
    sockets.add(socket);
    const accept = createHash("sha1")
      .update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    // one frame per chunk is enough here: opcode 1 is a text message, 8 is the close frame
    socket.on("data", (d: Buffer) => void ((d[0]! & 0x0f) === 1 && wsMessages++));
    socket.on("error", () => {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    wsMessages: () => wsMessages,
    close() {
      for (const r of hanging) r.destroy();
      for (const s of sockets) s.destroy();
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fx = await startEdgeFixture();
  process.stdout.write(`${fx.url}\n`);
}
