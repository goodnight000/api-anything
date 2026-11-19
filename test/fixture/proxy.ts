/**
 * A local outbound proxy: CONNECT tunnels (what undici and Chrome use for https, and undici for http
 * too) and absolute-form requests (what Chrome sends an http proxy for a plain-http page). It records
 * every target it was asked for, and with `auth` answers 407 to a request without those credentials.
 */
import { createServer, request as httpRequest } from "node:http";
import { type AddressInfo, connect, type Socket } from "node:net";

export interface ProxySeen {
  method: string;
  /** host:port of a CONNECT, the absolute URL of a forwarded request */
  target: string;
  authorized: boolean;
}

export interface FixtureProxy {
  /** http://127.0.0.1:<port>, no credentials */
  url: string;
  port: number;
  seen: ProxySeen[];
  close(): Promise<void>;
}

export async function startProxy(auth?: { user: string; pass: string }): Promise<FixtureProxy> {
  const seen: ProxySeen[] = [];
  const expected = auth && `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString("base64")}`;
  const ok = (header: string | undefined) => !expected || header === expected;
  const sockets = new Set<Socket>();

  const server = createServer((req, res) => {
    const authorized = ok(req.headers["proxy-authorization"]);
    seen.push({ method: req.method ?? "", target: req.url ?? "", authorized });
    if (!authorized) {
      res.writeHead(407, { "proxy-authenticate": 'Basic realm="fixture"' });
      res.end();
      return;
    }
    const { "proxy-authorization": _, "proxy-connection": __, ...headers } = req.headers;
    const out = httpRequest(req.url!, { method: req.method, headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.on("error", () => res.destroy());
      up.pipe(res);
    });
    out.on("error", () => res.destroy());
    // a client that goes away mid-request (Chrome closing) resets its socket: not this test's failure
    req.on("error", () => out.destroy());
    res.on("error", () => out.destroy());
    req.pipe(out);
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  server.on("connect", (req, client, head) => {
    // A CONNECT's socket is no longer the HTTP server's, which stops handling its errors: a client
    // that resets it after a 407 (or mid-tunnel) would otherwise end the test process.
    client.on("error", () => {});
    const authorized = ok(req.headers["proxy-authorization"]);
    seen.push({ method: "CONNECT", target: req.url ?? "", authorized });
    if (!authorized) {
      client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="fixture"\r\n\r\n');
      return;
    }
    const [host, port] = (req.url ?? "").split(/:(?=\d+$)/);
    const up = connect(Number(port), host!.replace(/^\[|\]$/g, ""), () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) up.write(head);
      up.pipe(client);
      client.pipe(up);
    });
    sockets.add(up);
    up.on("close", () => sockets.delete(up));
    up.on("error", () => client.destroy());
    client.on("error", () => up.destroy());
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    seen,
    close: () =>
      new Promise((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}
