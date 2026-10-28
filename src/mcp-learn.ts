/**
 * MCP `learn_site`: learn an operation a site lacks, prove it and share it (learnsite.ts). Registered
 * from createServer in mcp.ts; `mcp --no-learn` hides it.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type LearnSiteInput, type LearnSiteResult, learnSite } from "./learnsite.js";
import { asTable, mcpNext, mcpNextCall } from "./mcp.js";
import { badAddress } from "./vet.js";

/**
 * `enabled`: off with `mcp --no-learn`; set before createServer runs. `publicOnly`: a trigger must be
 * an https page on a public host, since page text can steer an agent into loading any address in the
 * user's browser; tests that learn from the localhost fixture turn it off. The CLI's `learn` takes any
 * address: the user typed it.
 */
export const learnTool = { enabled: true, publicOnly: true };

const ARGS = z.record(z.string(), z.unknown());

const DESCRIPTION =
  "Learn an operation for a website nobody has shared yet, in one call: use it after find_sites found no site or no operation for what the user asked. " +
  "Give the https page URL on a public host that shows the answer, with {param} placeholders (trigger: https://site.com/search?q={q}), the user's own values (args), and two other real values of the same kind that you pick (args2, args3: other searches, other ids, other places the site has). " +
  "When the catalog already has an operation for the same page on that domain (one search words do not find while it is unconfirmed), it calls that with args instead and answers with `reused`: no browser, nothing learned. " +
  "Otherwise it loads the page in a browser with args and with args2, picks the data request and the fields, and checks the result with args3 and with a replay that sends no cookies. " +
  "The answer to the user's request is in `data`; `signature` is the new operation, callable from then on with call_operation. " +
  "`chosen` is the request and recipe it used, and `alternatives` the other candidates: if data is not what the user wanted, call learn_site again with the same args, `captures` from the result (no browser), and pickRequest and/or a recipe (extract and pick for JSON, html or embedded for a page). " +
  "Sharing with the catalog is automatic for a public read when the user turned sharing on; if they never answered whether to share, it asks them once (or `next` tells you to ask). An operation that needed a login is shared only with the user's yes. Only reads: a write is learned with the CLI. " +
  "On failure follow `next` once (nextCall is the same step as data).";

export function registerLearn(server: McpServer, o: { allowWrites: boolean }): void {
  void o;
  if (!learnTool.enabled) return;
  server.registerTool(
    "learn_site",
    {
      description: DESCRIPTION,
      inputSchema: {
        trigger: z.string().describe("the page URL with {param} placeholders, e.g. https://site.com/search?q={q}"),
        args: ARGS.describe("the user's own values, by param name: their answer comes back in data"),
        args2: ARGS.describe("another real value of the same kind, chosen by you: it becomes the shared example"),
        args3: ARGS.describe("a third real value, different from both: the check that the operation works"),
        site: z.string().optional().describe("site name; default: the trigger's host"),
        op: z.string().optional().describe("a camelCase operation name, e.g. searchBooks; default: from the URL path"),
        intent: z
          .string()
          .optional()
          .describe("what the operation is for, in general words (it is shared): 'search books by title'"),
        pickRequest: z.number().int().optional().describe("a request id from chosen or alternatives"),
        extract: z.string().optional().describe("a path into a JSON answer: data.items, sections[*].items"),
        pick: z.array(z.string()).optional().describe("fields kept per item; name=path renames"),
        html: z
          .object({ items: z.string(), fields: z.record(z.string(), z.string()) })
          .optional()
          .describe('a list in the page: {"items":"<css>","fields":{"name":"<css>[@attr]"}}'),
        embedded: z.string().optional().describe("a regex for JSON inside the page; group 1 marks where it starts"),
        captures: z
          .tuple([z.string(), z.string()])
          .optional()
          .describe("an earlier result's captures: learn again from them, with no browser"),
        write: z.boolean().optional().describe("not supported: writes are learned with the CLI"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (input: LearnSiteInput) => {
      let r: LearnSiteResult;
      // a write is refused by learnSite whatever its trigger
      const bad = learnTool.publicOnly && !input.write ? badAddress(input.trigger ?? "") : undefined;
      if (bad)
        r = {
          ok: false,
          class: "refused",
          error: `trigger ${input.trigger} ${bad}: learn_site loads only https pages on a public host`,
          next: "give the https URL of the site's public page; a page on this machine or the local network is learned with the CLI, by the user: api-anything learn <url> ...",
          nextCall: { action: "fix_args" },
        };
      else
        try {
          const caps = server.server.getClientCapabilities();
          r = await learnSite(input, {
            consent: caps?.elicitation
              ? async (message) => {
                  const a = await server.server.elicitInput({
                    message,
                    requestedSchema: {
                      type: "object",
                      properties: { share: { type: "boolean", title: "Share it", default: false } },
                      required: ["share"],
                    },
                  });
                  // a dismissed prompt is no answer: the agent asks instead
                  return a.action === "cancel" ? undefined : a.action === "accept" && a.content?.share === true;
                }
              : undefined,
          });
        } catch (e) {
          r = { ok: false, error: (e as Error).message.split("\n")[0]!, next: "report this error to the user" };
        }
      const nextCall =
        r.nextCall?.action === "relearn"
          ? {
              ...r.nextCall,
              tool: "learn_site",
              args: { ...input, ...(r.captures?.length === 2 ? { captures: r.captures } : {}) },
            }
          : r.nextCall && mcpNextCall(r.nextCall);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              ...r,
              ...(r.data !== undefined ? { data: asTable(r.data) } : {}),
              ...(r.next ? { next: mcpNext(r.next) } : {}),
              ...(nextCall ? { nextCall } : {}),
            }),
          },
        ],
        isError: !r.ok,
      };
    },
  );
}
