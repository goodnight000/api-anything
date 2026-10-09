/**
 * Offline stand-ins for patterns seen live on YouTube, Airbnb, Reddit, Amazon and Booking.com
 * (dimension "live-a"). Each route mimics one real-world behaviour the framework mishandled.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";

export interface Hit {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  /** raw header bytes as they came off the wire, latin1-decoded by Node */
  rawReferer?: string;
  body: string;
}

export interface LiveFixture {
  url: string;
  hits: Hit[];
  /** /status pages answer "temporarily unavailable" (no results, for every query) */
  setDown(down: boolean): void;
  close(): Promise<void>;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

// Booking.com's AWS WAF interstitial: 202, a small page that loads challenge.js, sets a cookie and
// reloads the same URL with &chal_t=... appended.
const wafPage = (target: string) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title></title>
<script type="text/javascript">window.awsWafCookieDomainList = ['127.0.0.1'];</script>
<script type="text/javascript" src="/__challenge_h78IRKX3kpQxScCExxShBNwRUlb/d8c14d4960ca/challenge.js"></script>
<script>document.cookie="aws-waf-token=ok; path=/";location.replace(${JSON.stringify(target)});</script>
</head><body><noscript>JavaScript is disabled</noscript></body></html>`;

function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function startLiveFixture(): Promise<LiveFixture> {
  const hits: Hit[] = [];
  let down = false;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? "/", "http://fixture");
    const p = u.pathname;
    const raw = await readRaw(req);
    const gz = /gzip/i.test(String(req.headers["content-encoding"] ?? ""));
    let body = "";
    try {
      body = (gz ? gunzipSync(raw) : raw).toString("utf8");
    } catch {
      body = raw.toString("latin1");
    }
    const refIdx = req.rawHeaders.findIndex((h, i) => i % 2 === 0 && h.toLowerCase() === "referer");
    hits.push({
      method: req.method ?? "GET",
      path: p + u.search,
      headers: req.headers,
      rawReferer: refIdx >= 0 ? req.rawHeaders[refIdx + 1] : undefined,
      body,
    });
    const q = u.searchParams.get("q") ?? "";
    const cookie = String(req.headers.cookie ?? "");
    const send = (status: number, type: string, text: string) => {
      res.writeHead(status, { "content-type": type });
      res.end(text);
    };
    const html = (markup: string, status = 200) =>
      send(
        status,
        "text/html; charset=utf-8",
        `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title></head><body>${markup}</body></html>`,
      );

    // Amazon/Reddit shape: server-rendered list, plus a telemetry beacon (JSON in, JSON out) carrying the page URL and title.
    if (p === "/shop") {
      return html(
        `<ul>${[1, 2].map((n) => `<li class="r">${esc(q)} result ${n}</li>`).join("")}</ul>` +
          `<script>fetch("/svc/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({events:[{page:{url:location.href,title:"Results for "+new URLSearchParams(location.search).get("q")}}]})})</script>`,
      );
    }
    if (p === "/svc/events") return send(200, "application/json", '{"ok":1}');

    // An API whose query rides base64-encoded inside the JSON body (the learner can't see it);
    // only the referer shows the search term in the clear.
    if (p === "/b64") {
      return html(
        `<div id="out"></div><script>fetch("/api/b64",{method:"POST",headers:{"content-type":"application/json"},` +
          `body:JSON.stringify({payload:btoa(JSON.stringify({query:new URLSearchParams(location.search).get("q")}))})})` +
          `.then(r=>r.json()).then(v=>{document.getElementById("out").textContent=JSON.stringify(v)})</script>`,
      );
    }
    if (p === "/api/b64") {
      try {
        const v = JSON.parse(
          Buffer.from((JSON.parse(body) as { payload: string }).payload, "base64").toString("utf8"),
        ) as { query: string };
        return send(200, "application/json", JSON.stringify({ results: [{ title: `${v.query} result` }] }));
      } catch {
        return send(400, "application/json", '{"error":"bad payload"}');
      }
    }

    // YouTube innertube shape: the page POSTs a gzip-compressed JSON body with content-encoding: gzip.
    if (p === "/gz") {
      return html(
        `<div id="out"></div><script>(async()=>{const q=new URLSearchParams(location.search).get("q");` +
          `const s=new Blob([JSON.stringify({context:{client:{clientName:"WEB"}},query:q})]).stream().pipeThrough(new CompressionStream("gzip"));` +
          `const b=await new Response(s).arrayBuffer();` +
          `const r=await fetch("/api/gz",{method:"POST",headers:{"content-type":"application/json","content-encoding":"gzip"},body:b});` +
          `document.getElementById("out").textContent=JSON.stringify(await r.json())})()</script>`,
      );
    }
    if (p === "/api/gz") {
      try {
        const v = JSON.parse(body) as { query?: string };
        return send(200, "application/json", JSON.stringify({ results: [{ title: `${v.query} video` }] }));
      } catch {
        return send(400, "application/json", '{"error":"bad request body"}');
      }
    }

    // Airbnb shape: a JSON API whose referer carries the search term (a templated header).
    if (p === "/api/find") return send(200, "application/json", JSON.stringify({ results: [`${q} one`, `${q} two`] }));

    // Booking.com shape: without the WAF cookie, a 202 interstitial that reloads with &chal_t=.
    if (p === "/hotels") {
      if (!/aws-waf-token=ok/.test(cookie))
        return send(202, "text/html", wafPage(`${p}${u.search}&chal_t=1790531654141&force_referer=`));
      return html(`${[1, 2].map((n) => `<div class="card">${esc(q)} hotel ${n}</div>`).join("")}`);
    }

    // A site whose search is down for every query (200 "try again later" page, no results).
    if (p === "/status") {
      if (down) return html("<p>Service temporarily unavailable. Please try again later.</p>");
      if (q.startsWith("zz")) return html("<p>No results.</p>");
      return html(`${[1, 2].map((n) => `<div class="item">${esc(q)} item ${n}</div>`).join("")}`);
    }

    send(404, "text/plain", "not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    setDown: (d) => {
      down = d;
    },
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}
