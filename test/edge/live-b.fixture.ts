/**
 * Local stand-ins for behaviours seen on live sites during the live-b probe:
 * - /s?q=<q>: a server-rendered search page with a stable, content-derived ETag that answers 304
 *   to a matching If-None-Match (GitHub's logged-out pages do exactly this).
 */
import { createServer, type Server } from "node:http";

export interface Fixture {
  url: string;
  /** If-None-Match values the server received, in order */
  conditional: string[];
  close(): Promise<void>;
}

export async function startFixture(): Promise<Fixture> {
  const conditional: string[] = [];
  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://fixture");
    if (u.pathname === "/s") {
      const q = u.searchParams.get("q") ?? "";
      const etag = `W/"v1-${Buffer.from(q).toString("hex")}"`;
      const inm = req.headers["if-none-match"];
      if (typeof inm === "string") conditional.push(inm);
      if (inm === etag) {
        res.writeHead(304, { etag, "cache-control": "no-cache" });
        return res.end();
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", etag, "cache-control": "no-cache" });
      return res.end(
        `<!doctype html><html><body><ul><li class="r"><a href="/x/${q}">result for ${q}</a></li><li class="r"><a href="/y/${q}">more ${q}</a></li></ul></body></html>`,
      );
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    conditional,
    close: () =>
      new Promise((r) => {
        server.close(() => r());
        server.closeAllConnections();
      }),
  };
}
