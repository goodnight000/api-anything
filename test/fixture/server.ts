/**
 * Offline stand-in for a real GUI-only site. Each route mimics one real-world pattern
 * api-anything must handle: persisted GraphQL ids in a hashed bundle (X), layered form/JSON
 * encoding with an XSSI prefix (Google), UI-triggered writes, per-request signatures,
 * login walls served as 200 HTML or by redirect, a login box on a public page, rate limits, and
 * server-rendered HTML lists.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface FixtureCall {
  method: string;
  /** path plus query string */
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface Fixture {
  url: string;
  /** new UserByName/CreatePost queryIds and a new bundle hash; old ids 404 with an empty body */
  rotate(): void;
  setRequireSignature(on: boolean): void;
  /** every /api/* hit, in order */
  calls: FixtureCall[];
  /** current queryIds and bundle hash, for assertions */
  state: { userQueryId: string; createQueryId: string; build: string };
  /** invalidate one /private session token (server-side logout) */
  revoke(token: string): void;
  /** mint a fresh valid session token, as /login would (stands in for a re-login in the browser) */
  mintSession(): string;
  close(): Promise<void>;
}

const APP_VERSION = "2026.09.27-a1b2c3";
/** A public web-app bearer, the same for every visitor (X's pattern); the API refuses requests without it. */
export const PUBLIC_BEARER = "Bearer AAAAAAAAAAAAAAAAAAAAAFixturePublicBearer0000";
const id22 = () => randomBytes(16).toString("base64url"); // 22 url-safe chars

// The page JS. One bundle for every page, dispatching on location.pathname, like a real SPA entry.
const appJs = (s: Fixture["state"]) => `(()=>{
const registry=[{queryId:"${s.userQueryId}",operationName:"UserByName",operationType:"query"},{queryId:"${s.createQueryId}",operationName:"CreatePost",operationType:"mutation"}];
const qid=op=>registry.find(r=>r.operationName===op).queryId;
const ct0=()=>(document.cookie.match(/(?:^|; )ct0=([^;]*)/)||[])[1]||"";
const H=()=>({"x-csrf-token":ct0(),"x-app-version":"${APP_VERSION}",authorization:"${PUBLIC_BEARER}"});
const out=v=>{document.getElementById("app").textContent=JSON.stringify(v)};
const p=location.pathname;
let m;
if((m=p.match(/^\\/u\\/([^/]+)$/))){
  const variables=encodeURIComponent(JSON.stringify({name:decodeURIComponent(m[1]),withExtras:true}));
  fetch("/api/graphql/"+qid("UserByName")+"/UserByName?variables="+variables,{headers:H()}).then(r=>r.json()).then(out);
}else if(p==="/search"){
  const q=new URLSearchParams(location.search).get("q")||"";
  const x=new XMLHttpRequest();
  x.open("POST","/api/rpc?rpcids=search");
  x.setRequestHeader("content-type","application/x-www-form-urlencoded;charset=UTF-8");
  x.onload=()=>out(JSON.parse(JSON.parse(x.responseText.slice(5))[0][2]));
  x.send("f.req="+encodeURIComponent(JSON.stringify([[["search",JSON.stringify([q,10]),null,"generic"]]])));
}else if(p==="/compose"){
  document.getElementById("post").addEventListener("click",()=>{
    const text=document.getElementById("text").value;
    fetch("/api/graphql/"+qid("CreatePost")+"/CreatePost",{method:"POST",headers:{...H(),"content-type":"application/json"},body:JSON.stringify({variables:{text},queryId:qid("CreatePost")})}).then(r=>r.json()).then(out,()=>{});
  });
}else if(p==="/feed"){
  const sig=Date.now()+"."+Math.random().toString(36).slice(2);
  fetch("/api/signed/feed",{headers:{...H(),"x-sig":sig}}).then(r=>r.json()).then(out);
}else if(p==="/scoped"){
  // a per-page-load id: differs between two loads, yet any value replays (Google's f.sid or ei).
  // Not named like a credential: a random value under a credential's name is a session: ref instead.
  const ei=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  fetch("/api/scoped?q="+encodeURIComponent(new URLSearchParams(location.search).get("q")||"")+"&ei="+ei).then(r=>r.json()).then(out);
}else if((m=p.match(/^\\/follow\\/([^/]+)$/))){
  document.getElementById("follow").addEventListener("click",()=>fetch("/api/follow?user="+m[1]).then(r=>r.json()).then(out,()=>{}));
}else if(p==="/walled"){
  fetch("/api/walled").then(r=>r.json()).then(out);
}else if(p.startsWith("/spa/")){
  // a client-routed SPA: its own links and history changes are routed without a page load
  const route=()=>{
    const name=decodeURIComponent(location.pathname.slice(5));
    document.getElementById("app").innerHTML=${JSON.stringify("<nav>")}+["alice","bob"].map(n=>'<a data-link href="/spa/'+n+'">'+n+'</a>').join(" ")+"</nav>";
    fetch("/api/spa/user?name="+encodeURIComponent(name)).then(r=>r.json()).then(v=>{document.title=v.name});
  };
  document.addEventListener("click",e=>{const a=e.target.closest("a[data-link]");if(!a)return;e.preventDefault();history.pushState({},"",a.href);route();});
  addEventListener("popstate",route);
  route();
}
})();`;

const page = (build: string, body = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title></head><body>${body}<div id="app"></div><script src="/static/app.${build}.js"></script></body></html>`;

const LOGIN_FORM =
  '<form action="/login" method="get"><input name="user"><input type="password" name="password"><button>Sign in</button></form>';
const LOGIN_PAGE = `<!doctype html><html><head><title>Log in</title></head><body>${LOGIN_FORM}</body></html>`;

const LIST_USERS = ["alice", "bob", "carol"];

const user = (name: string, extras: boolean) => ({
  data: {
    user: {
      name,
      followers: name.length * 100,
      ...(extras ? { bio: `I am ${name}` } : {}),
      // snowflake-sized ids stay strings, as real sites send them
      posts: [
        { id: "1850000000000000001", text: `hello from ${name}` },
        { id: "1850000000000000002", text: `${name} again` },
      ],
    },
  },
});

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.setEncoding("utf8");
    req.on("data", (c) => (s += c));
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

export async function startFixture(): Promise<Fixture> {
  const state = { userQueryId: id22(), createQueryId: id22(), build: randomBytes(4).toString("hex") };
  const calls: FixtureCall[] = [];
  const seenSigs = new Set<string>();
  const revoked = new Set<string>();
  const mint = () => randomBytes(12).toString("hex");
  let requireSignature = false;
  let limitedHits = 0;

  const send = (
    res: ServerResponse,
    status: number,
    type: string,
    body: string,
    headers: Record<string, string | string[]> = {},
  ) => {
    res.writeHead(status, { "content-type": type, ...headers });
    res.end(body);
  };
  const json = (res: ServerResponse, status: number, v: unknown) =>
    send(res, status, "application/json; charset=utf-8", JSON.stringify(v));

  const server = createServer(async (req, res) => {
    const u = new URL(req.url ?? "/", "http://fixture");
    const p = u.pathname;
    const body = await readBody(req);
    const jar = cookies(req);
    if (p.startsWith("/api/"))
      calls.push({ method: req.method ?? "GET", path: u.pathname + u.search, headers: req.headers, body });

    // HTML pages hand out the CSRF cookie that page JS echoes in x-csrf-token (X's ct0 pattern).
    const html = (status: number, markup: string) =>
      send(
        res,
        status,
        "text/html; charset=utf-8",
        markup,
        jar.ct0 ? {} : { "set-cookie": `ct0=${randomBytes(16).toString("hex")}; Path=/; SameSite=Lax` },
      );
    const csrfOk = () => !!jar.ct0 && req.headers["x-csrf-token"] === jar.ct0;

    let m: RegExpMatchArray | null;
    if (p === "/") return html(200, page(state.build, LIST_USERS.map((n) => `<a href="/u/${n}">${n}</a>`).join(" ")));
    if (/^\/u\/[^/]+$/.test(p)) return html(200, page(state.build));
    if (p === "/search") return html(200, page(state.build));
    if (p === "/compose")
      return html(200, page(state.build, '<textarea id="text"></textarea><button id="post">Post</button>'));
    if (p === "/feed" || p === "/scoped" || p === "/walled" || p.startsWith("/spa/"))
      return html(200, page(state.build));
    if (/^\/follow\/[^/]+$/.test(p)) return html(200, page(state.build, '<button id="follow">Follow</button>'));
    if (p === "/sw") {
      // registers a service worker that proxies every fetch, then posts once it controls the page
      return html(
        200,
        `<!doctype html><html><body><script>(async()=>{try{navigator.serviceWorker.register("/sw.js").catch(()=>{});await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(r,500))])}catch{}fetch("/api/sw-write",{method:"POST",body:"do-it"})})()</script></body></html>`,
      );
    }
    if (p === "/sw.js") {
      return send(
        res,
        200,
        "text/javascript",
        "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));",
      );
    }
    if (p === "/list")
      return html(
        200,
        `<!doctype html><html><body><ul class="users">${LIST_USERS.map(
          (n) =>
            `<li class="user"><a class="name" href="/u/${n}">${n}</a> <span class="followers">${n.length * 100}</span></li>`,
        ).join("")}</ul></body></html>`,
      );
    if (p === `/static/app.${state.build}.js`) return send(res, 200, "application/javascript", appJs(state));

    if (p === "/login") {
      return send(res, 302, "text/plain", "", {
        location: "/private",
        "set-cookie": `session=${mint()}; Path=/; HttpOnly; SameSite=Lax`,
      });
    }
    // Login wall returned as 200 HTML where JSON is expected, as Instagram does. A revoked session
    // (present but no longer valid) is a login wall too, which is how self-heal by re-import is tested.
    if (p === "/private")
      return jar.session && !revoked.has(jar.session)
        ? json(res, 200, { data: { secret: "only for you" } })
        : html(200, LOGIN_PAGE);
    // The other login wall: a redirect to the sign-in page.
    if (p === "/account") return send(res, 302, "text/plain", "", { location: "/signin?next=%2Faccount" });
    if (p === "/signin") return html(200, LOGIN_PAGE);
    // A single-page app on a static host: a deep link answers 404 with the app's shell (the host's
    // 404.html fallback), and the shell loads the data all the same.
    if (p.startsWith("/app/"))
      return html(
        404,
        `<!doctype html><html><body><div id="app"></div><script>fetch("/api/scoped?q="+location.pathname.slice(5))</script></body></html>`,
      );
    // A forum as a guest sees it: a quick-login box in every page's header, the public content under
    // it. The member list is in the markup (/community redirects to it); a member's page fetches
    // their posts as JSON; a member's card keeps the profile in the page's state JSON.
    if (p === "/community") return send(res, 302, "text/plain", "", { location: "/forum" });
    if (p.startsWith("/card/"))
      return html(
        200,
        `<!doctype html><html><body>${LOGIN_FORM}<script>window.state = ${JSON.stringify({ member: { name: p.slice(6) } })}</script></body></html>`,
      );
    if (p === "/forum")
      return html(
        200,
        `<!doctype html><html><body>${LOGIN_FORM}<ul>${LIST_USERS.map((n) => `<li>${n}</li>`).join("")}</ul></body></html>`,
      );
    if (p.startsWith("/forum/"))
      return html(
        200,
        `<!doctype html><html><body>${LOGIN_FORM}<script>fetch("/api/scoped?q="+location.pathname.slice(7))</script></body></html>`,
      );

    m = p.match(/^\/api\/graphql\/([^/]+)\/(UserByName|CreatePost)$/);
    if (m) {
      const [, qid, op] = m;
      if (qid !== (op === "UserByName" ? state.userQueryId : state.createQueryId))
        return send(res, 404, "text/plain", "");
      if (!csrfOk()) return json(res, 403, { errors: [{ message: "csrf token mismatch" }] });
      if (req.headers.authorization !== PUBLIC_BEARER)
        return json(res, 400, { errors: [{ message: "Bad Authentication data", code: 215 }] });
      if (op === "UserByName" && req.method === "GET") {
        let v: { name?: unknown; withExtras?: unknown };
        try {
          v = JSON.parse(u.searchParams.get("variables") ?? "");
        } catch {
          return json(res, 400, { errors: [{ message: "variables must be JSON" }] });
        }
        if (typeof v.name !== "string")
          return json(res, 400, { errors: [{ message: "Variable $name must be defined" }] });
        // a handle that doesn't exist: 200 with empty data, as X answers
        if (v.name.startsWith("nobody")) return json(res, 200, { data: {} });
        return json(res, 200, user(v.name, v.withExtras === true));
      }
      if (op === "CreatePost" && req.method === "POST") {
        const text = (JSON.parse(body || "{}") as { variables?: { text?: string } }).variables?.text;
        return json(res, 200, { data: { create_post: { id: `19${Date.now()}`, text } } });
      }
      return json(res, 405, { errors: [{ message: "method not allowed" }] });
    }

    if (p === "/api/rpc" && req.method === "POST") {
      try {
        const outer = JSON.parse(new URLSearchParams(body).get("f.req") ?? "");
        const [q] = JSON.parse(outer[0][0][1]) as [string, number];
        const results = [1, 2, 3].map((i) => [
          `${q} result ${i}`,
          `https://example.test/${encodeURIComponent(q)}/${i}`,
        ]);
        return send(
          res,
          200,
          "application/json; charset=utf-8",
          `)]}'\n${JSON.stringify([["wrb.fr", "search", JSON.stringify([results])]])}`,
        );
      } catch {
        return send(res, 400, "text/plain", "bad f.req");
      }
    }

    if (p === "/api/signed/feed") {
      const sig = req.headers["x-sig"];
      if (requireSignature) {
        if (typeof sig !== "string" || seenSigs.has(sig))
          return json(res, 403, { errors: [{ message: "invalid signature" }] });
        seenSigs.add(sig);
      }
      return json(res, 200, {
        data: {
          feed: [
            { id: "f1", text: "first" },
            { id: "f2", text: "second" },
          ],
        },
      });
    }

    // A bot wall that only lets real browsers through; Chrome's brotli support stands in for its TLS fingerprint.
    if (p === "/api/walled") {
      if (!/\bbr\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
        return send(
          res,
          403,
          "text/html",
          "<html><head><title>Just a moment...</title></head><body>cf-chl-bypass</body></html>",
        );
      }
      return json(res, 200, { data: { items: ["behind the wall"] } });
    }
    if (p === "/api/scoped")
      return json(res, 200, {
        data: { results: [`${u.searchParams.get("q")} one`, `${u.searchParams.get("q")} two`] },
      });
    if (p === "/api/follow" || p === "/api/sw-write") return json(res, 200, { ok: true });
    if (p === "/api/spa/user") return json(res, 200, { name: u.searchParams.get("name") });

    if (p === "/api/limited") {
      limitedHits++;
      return limitedHits > 2
        ? json(res, 429, { message: "Rate limit exceeded. Please wait." })
        : json(res, 200, { data: { n: limitedHits } });
    }

    send(res, 404, "text/plain", "not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    state,
    rotate() {
      state.userQueryId = id22();
      state.createQueryId = id22();
      state.build = randomBytes(4).toString("hex");
    },
    setRequireSignature(on) {
      requireSignature = on;
    },
    revoke(token) {
      revoked.add(token);
    },
    mintSession: mint,
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
