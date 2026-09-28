/**
 * stdio MCP server with four fixed meta-tools, so the tool list costs the same at 2 sites or 200.
 * Writes are hidden from list_operations and refused by call_operation unless started with allowWrites.
 * It cannot create operations (that is the CLI's capture/add), and its login cannot import cookies
 * a human did not already choose to import: page content may be steering the agent.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { closeBrowser, login } from "./browser.js";
import { call } from "./execute.js";
import { profileDir } from "./heal.js";
import { browserSource, cookieNames, importSession, loggedIn, resolveLoginTarget } from "./login.js";
import { loadSession, saveSession, sessionFile, withLock } from "./session.js";
import { listSites, loadSite, siteNotes } from "./store.js";

export const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

/**
 * A `next` hint in MCP terms: the CLI's `ops`, `sites` and `login` are tools here; commands only the
 * CLI has (heal, add, capture) are for the user to run in a terminal.
 */
export function mcpNext(next: string): string {
  const out = next
    .replace(/rerun with --allow-writes \(MCP: [^)]*\)/, "ask the user to restart this MCP server with --allow-writes")
    .replace(/api-anything ops ([\w.-]+)/g, 'list_operations {"site":"$1"}')
    .replace(/api-anything sites/g, "list_sites")
    .replace(/(?:ask the user to run:? )?api-anything login ([\w.-]+)/g, 'the login tool {"site":"$1"} (mode "window" when the user must sign in or clear a challenge by hand)')
    .replace(/api-anything add creates one/, "a new site is added with the CLI");
  return /\bapi-anything (heal|add|capture|verify|export)\b/.test(out) ? `${out} (api-anything commands are CLI only: ask the user to run them in a terminal)` : out;
}

/**
 * A list of records repeats every key in every item, which an agent pays for in tokens. Over MCP
 * such a list is sent once-per-key as `{columns, rows}`; a missing field is null. Anything else,
 * including a list with one item, is sent as is.
 */
export function asTable(data: unknown): unknown {
  const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (!Array.isArray(data) || data.length < 2 || !data.every(isRecord)) return data;
  const columns = [...new Set(data.flatMap((x) => Object.keys(x)))];
  return { columns, rows: data.map((x) => columns.map((c) => (c in x ? x[c] : null))) };
}

const reply = (v: unknown, isError = false) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }], isError });

/** Every failure comes back as {error, next} JSON, like call_operation's, never as a bare exception text. */
const guarded =
  <A>(fn: (a: A) => Promise<ReturnType<typeof reply>>) =>
  async (a: A) => {
    try {
      return await fn(a);
    } catch (e) {
      const msg = (e as Error).message.split("\n")[0]!;
      return reply({ ok: false, error: msg, next: /invalid site name|no site/.test(msg) ? "list_sites" : "fix or delete the file named in error, then retry once" }, true);
    }
  };

export function createServer({ allowWrites = false }: { allowWrites?: boolean } = {}): McpServer {
  const server = new McpServer({ name: "api-anything", version: VERSION });

  server.registerTool(
    "list_sites",
    {
      description: "List the websites api-anything can call, with how many operations each has.",
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
      description: "List a site's operations with their params, and the site's notes (caveats, arg formats). Call this before call_operation.",
      inputSchema: { site: z.string().describe("site name from list_sites") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(async ({ site }: { site: string }) => {
      const r = loadSite(site);
      if (!r) return reply({ error: `no site "${site}"`, next: "list_sites" }, true);
      const notes = siteNotes(r.site.name);
      return reply({
        site,
        operations: r.site.operations
          .filter((o) => allowWrites || o.readOnly)
          .map((o) => ({
            name: o.name,
            ...(o.description ? { description: o.description } : {}),
            ...(o.readOnly ? {} : { write: true }),
            params: o.params.map((p) => ({
              name: p.name,
              type: p.type,
              required: p.required,
              ...(p.description ? { description: p.description } : {}),
              ...(p.example !== undefined ? { example: p.example } : {}),
              ...(p.hint ? { hint: p.hint } : {}),
              ...(p.pattern ? { pattern: p.pattern } : {}),
            })),
          })),
        ...(notes ? { notes } : {}),
      });
    }),
  );

  server.registerTool(
    "call_operation",
    {
      description:
        "Call a site operation. Returns {ok, class, data, tier, healed?, ms, reason?, next?}; a list of records comes back as data {columns, rows} (one row per item, null for a missing field). `reason` also explains a slow success. On failure follow `next` at most once, then stop and report." +
        (allowWrites ? " Write operations change the user's account: only call them when the user asked for that exact action." : " Writes are disabled on this server."),
      inputSchema: {
        site: z.string(),
        op: z.string().describe("operation name from list_operations"),
        args: z.record(z.string(), z.unknown()).optional().describe("param name -> value"),
      },
      annotations: { readOnlyHint: !allowWrites, destructiveHint: allowWrites, openWorldHint: true },
    },
    guarded(async ({ site, op, args }: { site: string; op: string; args?: Record<string, unknown> }) => {
      const r = await call(site, op, args ?? {}, { allowWrites });
      return reply({ ...r, ...(r.data !== undefined ? { data: asTable(r.data) } : {}), ...(r.next ? { next: mcpNext(r.next) } : {}) }, !r.ok);
    }),
  );

  server.registerTool(
    "login",
    {
      description:
        "Sign in to a site so its operations work; use after a call returns class 'auth'. mode 'import' (default) refreshes the session from the browser profile the user already chose with `api-anything login` (no password); 'window' opens a visible browser for the user to sign in and clear 2FA/captcha by hand.",
      inputSchema: {
        site: z.string().optional().describe("site name from list_sites"),
        url: z.string().optional().describe("a full URL, if the site is not yet known (window mode only)"),
        mode: z.enum(["import", "window"]).optional(),
      },
      annotations: { openWorldHint: true },
    },
    guarded(async ({ site, url, mode }: { site?: string; url?: string; mode?: "import" | "window" }) => {
      const target = site ?? url;
      if (!target) return reply({ error: "give a site or a url" }, true);
      let t: ReturnType<typeof resolveLoginTarget>;
      try {
        t = resolveLoginTarget(target);
      } catch (e) {
        return reply({ error: (e as Error).message, next: "list_sites" }, true);
      }
      if (mode === "window") {
        // a human signs in by hand: they see which site and which account
        const cookies = await login({ url: t.url, profileDir: profileDir(), waitForEnter: false });
        withLock(sessionFile(t.site), () => saveSession(t.site, { ...loadSession(t.site), cookies, source: "window" }));
        return reply({ ok: true, site: t.site, source: "window", cookies: cookieNames(cookies), loggedIn: loggedIn(cookies, t.loginCookies) });
      }
      // An agent may be acting on injected page text: it may only refresh a known site's session from
      // the profile a human already picked, never pull another domain's or another account's cookies.
      const source = loadSite(t.site) ? browserSource(t.site) : undefined;
      if (!source) {
        return reply(
          { ok: false, site: t.site, error: "MCP can only refresh a session the user imported with the CLI", next: `ask the user to run in a terminal: api-anything login ${t.site} (or use mode "window")` },
          true,
        );
      }
      let imported;
      try {
        imported = await importSession(t.site, t.url, { loginCookies: t.loginCookies, profile: source });
      } catch (e) {
        return reply({ ok: false, site: t.site, error: (e as Error).message, next: `ask the user to run: api-anything login ${t.site}` }, true);
      }
      if (!imported) return reply({ ok: false, site: t.site, error: `no signed-in session in ${source}`, next: `ask the user to run: api-anything login ${t.site}` }, true);
      return reply({
        ok: true,
        site: t.site,
        source: imported.source,
        profile: `${imported.browser}/${imported.profile}`,
        ...(imported.name ? { profileName: imported.name } : {}),
        cookies: cookieNames(imported.cookies),
        loggedIn: loggedIn(imported.cookies, t.loginCookies),
      });
    }),
  );
  return server;
}

export async function serveStdio(opts: { allowWrites?: boolean } = {}): Promise<void> {
  await createServer(opts).connect(new StdioServerTransport());
  // An open Chrome keeps the process alive after the client goes away.
  process.stdin.once("end", () => void closeBrowser().finally(() => process.exit(0)));
}
