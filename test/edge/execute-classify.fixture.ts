/** Edge-case site for the execute/classify probes: redirects, cookies, encodings, slow and broken responses. */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { brotliCompressSync, deflateSync, gzipSync, zstdCompressSync } from "node:zlib";

export interface Hit {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

export interface Fixture {
  /** http://127.0.0.1:<port> */
  base: string;
  /** a second origin (another server), for cross-origin redirects */
  other: string;
  hits: Hit[];
  otherHits: Hit[];
  /** `rotate`: a counter the /rotate route bumps. `sid`: the session cookie value /api/me honours. */
  state: { rotate: number; sid: string };
  close(): void;
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((r) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => r(s));
  });

const json = (res: ServerResponse, v: unknown, status = 200, headers: Record<string, string | string[]> = {}) =>
  void res.writeHead(status, { "content-type": "application/json", ...headers }).end(JSON.stringify(v));

export async function startFixture(): Promise<Fixture> {
  const hits: Hit[] = [];
  const otherHits: Hit[] = [];
  const state = { rotate: 0, sid: "none" };

  const other = createServer(async (req, res) => {
    otherHits.push({ method: req.method!, url: req.url!, headers: req.headers, body: await readBody(req) });
    json(res, { landed: true });
  });
  await new Promise<void>((r) => other.listen(0, "localhost", r));
  const otherBase = `http://localhost:${(other.address() as AddressInfo).port}`;

  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    hits.push({ method: req.method!, url: req.url!, headers: req.headers, body });
    const u = new URL(req.url!, "http://x");
    const cookie = req.headers.cookie ?? "";
    switch (u.pathname) {
      // a consent/session bootstrap: the cookie set on the redirect is required on the next hop
      case "/bootstrap":
        return void res.writeHead(302, { location: "/needs-step", "set-cookie": "step=1; Path=/" }).end();
      case "/needs-step":
        return /(^|; )step=1/.test(cookie)
          ? json(res, { items: [{ id: 1 }] })
          : json(res, { error: "session not initialised" }, 400);
      // rotates a cookie on every answer; the next call must present the latest value
      case "/rotate": {
        const want = `tok=${state.rotate}`;
        const had = state.rotate === 0 || cookie.includes(want);
        state.rotate++;
        const set = `tok=${state.rotate}; Path=/`;
        return had
          ? json(res, { items: [{ n: state.rotate }] }, 200, { "set-cookie": set })
          : json(res, { error: "stale token" }, 401, { "set-cookie": set });
      }
      case "/away":
        return void res.writeHead(Number(u.searchParams.get("s") ?? 302), { location: `${otherBase}/landing` }).end();
      // A read the page asks for twice: first signed, which the server sends on to a check that
      // keeps the method (307), and then, once that answered, for the data.
      case "/signed-page":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end(
            `<!doctype html><title>signed</title><script>const r="/read${u.search}";fetch(r,{method:"POST",body:"initial"}).then(r=>r.json())` +
              '.then(()=>fetch(r,{method:"POST",body:"final"}))</script>',
          );
      // ?far: the check is on another origin
      case "/read":
        return body === "initial"
          ? void res.writeHead(307, { location: u.searchParams.has("far") ? `${otherBase}/answer` : "/answer" }).end()
          : json(res, { items: [{ name: "alice" }] });
      case "/answer":
        return json(res, { checked: req.method === "POST" && body === "initial" });
      case "/loop":
        return void res.writeHead(302, { location: "/loop" }).end();
      case "/to-login":
        return void res.writeHead(302, { location: "/accounts/login/?next=/api" }).end();
      case "/accounts/login/":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end("<!doctype html><title>Welcome</title><div id=app></div>");
      case "/enc": {
        const raw = Buffer.from(JSON.stringify({ items: [{ name: "café ☕" }] }));
        const e = u.searchParams.get("e")!;
        const buf =
          e === "gzip"
            ? gzipSync(raw)
            : e === "br"
              ? brotliCompressSync(raw)
              : e === "deflate"
                ? deflateSync(raw)
                : zstdCompressSync(raw);
        return void res.writeHead(200, { "content-type": "application/json", "content-encoding": e }).end(buf);
      }
      case "/latin1":
        // "café" in ISO-8859-1
        return void res
          .writeHead(200, { "content-type": "application/json; charset=iso-8859-1" })
          .end(Buffer.from('{"items":[{"name":"caf\xe9"}]}', "latin1"));
      case "/sjis":
        // "日本" in Shift_JIS
        return void res
          .writeHead(200, { "content-type": "text/html; charset=shift_jis" })
          .end(
            Buffer.concat([
              Buffer.from("<html><body><ul><li class=i>"),
              Buffer.from([0x93, 0xfa, 0x96, 0x7b]),
              Buffer.from("</li></ul></body></html>"),
            ]),
          );
      case "/bom":
        return void res
          .writeHead(200, { "content-type": "application/json" })
          .end(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"items":[1]}')]));
      case "/huge": {
        const items = Array.from({ length: 50_000 }, (_, i) => ({ id: i, title: `item ${i}`, blurb: "x".repeat(60) }));
        return json(res, { items });
      }
      case "/fat-item":
        return json(res, {
          items: [
            { id: 1, text: "y".repeat(40_000) },
            { id: 2, text: "short" },
          ],
        });
      case "/stall":
        res.writeHead(200, { "content-type": "application/json" });
        res.write('{"items":[');
        return; // never ends
      case "/never":
        return; // never answers
      case "/reset":
        return void req.socket.destroy();
      case "/empty":
        return void res.writeHead(204).end();
      // "no results" answered as 204; the example query has results
      case "/maybe":
        return u.searchParams.get("q") === "alice"
          ? json(res, { items: [{ q: "alice" }] })
          : void res.writeHead(204).end();
      case "/r429":
        return json(res, { error: "Too Many Requests" }, 429, { "retry-after": u.searchParams.get("ra") ?? "120" });
      case "/gql":
        return json(res, JSON.parse(u.searchParams.get("body")!));
      // Post/Redirect/Get: the POST ran, then the landing page is forbidden to scripts
      case "/api/follow":
        if (req.method === "POST") return void res.writeHead(303, { location: "/done" }).end();
        return json(res, { error: "method" }, 405);
      case "/done":
        return void res.writeHead(403, { "content-type": "text/plain" }).end("Forbidden");
      case "/api/settings":
        // the write succeeded; the page it lands on has a change-password form
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end('<!doctype html><h1>Settings saved</h1><form action="/pw"><input type="password" name="new"></form>');
      case "/api/user": {
        const name = u.searchParams.get("name");
        return name === "alice" ? json(res, { user: { name } }) : json(res, { error: "Not Found" }, 404);
      }
      case "/api/items":
        return json(res, { items: [{ page: u.searchParams.get("page") }] });
      // signed-in data: answers the one session the server honours, else its login page as 200 HTML
      case "/api/me":
        return cookie.includes(`sid=${state.sid}`)
          ? json(res, { items: [{ me: state.sid }] })
          : void res
              .writeHead(200, { "content-type": "text/html" })
              .end(
                '<!doctype html><title>Log in</title><form action="/login"><input name="user"><input type="password" name="pw"></form>',
              );
      // a write that runs, then bounces the POST to a login check that refuses it
      case "/api/save":
        return u.searchParams.has("login")
          ? void res
              .writeHead(403, { "content-type": "text/html" })
              .end(
                '<!doctype html><title>Log in</title><form action="/login"><input name="user"><input type="password" name="pw"></form>',
              )
          : void res.writeHead(307, { location: "/api/save?login=1" }).end();
      case "/save-page":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end('<!doctype html><title>save</title><script>fetch("/api/save",{method:"POST",body:"x=1"})</script>');
      // a page whose script asks for the signed-in data
      case "/me-page":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end('<!doctype html><title>me</title><script>fetch("/api/me")</script>');
      // a wall that answers a non-browser client the way a framework answers a stale CSRF token (or with ?status=)
      case "/api/picky":
        return /Chrome\//.test(req.headers["user-agent"] ?? "")
          ? json(res, { items: [{ picky: "ok" }] })
          : json(res, { message: "CSRF token mismatch." }, Number(u.searchParams.get("status")) || 419);
      // double-submit CSRF: the header must repeat the ct cookie
      case "/api/csrf": {
        const ct = /(?:^|; )ct=([^;]+)/.exec(cookie)?.[1];
        return ct && req.headers["x-csrf"] === ct
          ? json(res, { items: [{ ct }] })
          : json(res, { error: "CSRF token mismatch" }, 403);
      }
      // an API behind a header only the page's own script knows (a guest token)
      case "/api/token":
        return req.headers["x-token"] === "guest-token-1"
          ? json(res, { items: [{ token: "ok" }] })
          : json(res, { error: "Bad guest token" }, 401);
      case "/tokened":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end(
            '<!doctype html><title>tokened</title><script>fetch("/api/token",{headers:{"x-token":"guest-token-1"}})</script>',
          );
      // a page whose script asks the API for its own ?page=
      case "/paged":
        return void res
          .writeHead(200, { "content-type": "text/html" })
          .end(
            '<!doctype html><title>paged</title><script>fetch("/api/items?page="+encodeURIComponent(new URLSearchParams(location.search).get("page")))</script>',
          );
      case "/":
        return void res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>home</title>");
      default:
        return json(res, { items: [{ path: u.pathname }] });
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    base,
    other: otherBase,
    hits,
    otherHits,
    state,
    close() {
      for (const s of [server, other]) {
        s.closeAllConnections();
        s.close();
      }
    },
  };
}
