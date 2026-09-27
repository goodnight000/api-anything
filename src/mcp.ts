/**
 * stdio MCP server with three fixed meta-tools, so the tool list costs the same at 2 sites or 200.
 * Writes are hidden from list_operations and refused by call_operation unless started with allowWrites.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { closeBrowser } from "./browser.js";
import { call } from "./execute.js";
import { listSites, loadSite } from "./store.js";

export const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

const reply = (v: unknown, isError = false) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }], isError });

export function createServer({ allowWrites = false }: { allowWrites?: boolean } = {}): McpServer {
  const server = new McpServer({ name: "site2api", version: VERSION });

  server.registerTool(
    "list_sites",
    {
      description: "List the websites site2api can call, with how many operations each has.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      reply(
        listSites().map((name) => {
          try {
            const s = loadSite(name)!.site;
            const ops = s.operations.filter((o) => allowWrites || o.readOnly).length;
            return { name, ...(s.description ? { description: s.description } : {}), operations: ops };
          } catch (e) {
            return { name, error: (e as Error).message };
          }
        }),
      ),
  );

  server.registerTool(
    "list_operations",
    {
      description: "List a site's operations with their params. Call this before call_operation.",
      inputSchema: { site: z.string().describe("site name from list_sites") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ site }) => {
      const r = loadSite(site);
      if (!r) return reply({ error: `no site "${site}"`, next: "list_sites" }, true);
      return reply({
        site,
        operations: r.site.operations
          .filter((o) => allowWrites || o.readOnly)
          .map((o) => ({
            name: o.name,
            ...(o.description ? { description: o.description } : {}),
            ...(o.readOnly ? {} : { write: true }),
            params: o.params.map((p) => ({ name: p.name, type: p.type, required: p.required, ...(p.description ? { description: p.description } : {}), ...(p.example !== undefined ? { example: p.example } : {}) })),
          })),
      });
    },
  );

  server.registerTool(
    "call_operation",
    {
      description:
        "Call a site operation. Returns {ok, class, data, tier, healed?, ms, reason?, next?}; `reason` also explains a slow success. On failure follow `next` at most once, then stop and report." +
        (allowWrites ? " Write operations change the user's account: only call them when the user asked for that exact action." : " Writes are disabled on this server."),
      inputSchema: {
        site: z.string(),
        op: z.string().describe("operation name from list_operations"),
        args: z.record(z.string(), z.unknown()).optional().describe("param name -> value"),
      },
      annotations: { readOnlyHint: !allowWrites, destructiveHint: allowWrites, openWorldHint: true },
    },
    async ({ site, op, args }) => {
      const r = await call(site, op, args ?? {}, { allowWrites });
      return reply(r, !r.ok);
    },
  );
  return server;
}

export async function serveStdio(opts: { allowWrites?: boolean } = {}): Promise<void> {
  await createServer(opts).connect(new StdioServerTransport());
  // An open Chrome keeps the process alive after the client goes away.
  process.stdin.once("end", () => void closeBrowser().finally(() => process.exit(0)));
}
