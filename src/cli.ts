#!/usr/bin/env node
/** site2api CLI. Compact JSON on stdout; every failure also prints one `next:` line on stderr. */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { chromeAvailable, closeBrowser, login } from "./browser.js";
import { call, heal, type Tier } from "./execute.js";
import { addOperation, capturePage, loadCapture, profileDir } from "./heal.js";
import { buildRequest } from "./http.js";
import { capOutput, extract } from "./extract.js";
import { rankCandidates } from "./learn.js";
import { serveStdio, VERSION } from "./mcp.js";
import { loadSession, loggedIn, saveSession } from "./session.js";
import { MatchSchema, TriggerStepSchema, type Operation } from "./spec.js";
import { exportSite, listSites, loadSite } from "./store.js";

const HELP: Record<string, string> = {
  login: `site2api login <site|url>
  Opens a visible Chrome window on site2api's own profile. Sign in, then close the window or press Enter.`,
  capture: `site2api capture <url> [--steps <json>] [--soft-from <url>] [--example k=v]... [--write] [--limit n]
  Loads the page in Chrome and lists the requests it made, noise filtered and ranked (requests carrying
  the --example values first). Saves everything as a capture id for: add --from <id> --pick-request <n>,
  and for: inspect <id> <n>.
  --steps      JSON array of {action: click|fill|press|wait|goto, selector?, value?, ms?}
  --soft-from  load this page first, then navigate in-app to <url> (SPAs only fire their data XHRs that way)
  --write      abort every non-GET request, and every xhr/fetch sent during --steps, before it leaves the browser`,
  inspect: `site2api inspect <captureId> [<requestId>] [--path <p>] [--html <json>] [--embedded <regex>]
  No browser. Without a request id, lists every request in the capture. With one, shows its request and
  response: JSON at --path, or items from an --html / --embedded recipe (try selectors before add).`,
  add: `site2api add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [options]
  Runs the trigger twice in Chrome (with --example, then --example2 or --example again), picks the request
  carrying the example values, and saves the learned operation to ~/.site2api/sites/<site>.json.
  --trigger       page URL with {param} placeholders, e.g. https://site.com/u/{name}
  --steps <json>  UI steps after load; {param} is filled in selector/value
  --soft-from     neutral page to load first, then navigate in-page to the trigger
  --match k=v     pin the request: method=, host=, path= (* = one segment), operationName= (or JSON)
  --from <id> --pick-request <n>   learn from a saved capture instead of running the trigger (no browser);
                  every add saves its own runs as captures, so a wrong --extract is fixed this way
  --from2 <id>    a second capture made with --example2 values, for the two-run diff
  --extract <path>  dot/bracket path into the response
  --pick a,b.c,name=x.y  fields kept per item; name=path renames the key
  --html <json>   {"items":"<css>","fields":{"name":"<css>[@attr]"}} for server-rendered pages
  --embedded <regex>  JSON inside the page: group 1 marks where the JSON value starts; then --extract
  --public <header,...>  headers holding public constants (a web app's bearer): kept literal, allowed by export
  --write         the op changes state: it is learned from intercepted, aborted requests only
  --description <text>
  Output: preview (what a call returns, from the captured response), warnings (read them), captures.`,
  call: `site2api call <site> <op> [k=v ...] [--json <args-object>] [--allow-writes] [--max-tier 1|2|3] [--dry]
  Calls an operation: {ok, class, data, tier, healed?, ms, next?}. --dry prints the request with credentials redacted.`,
  verify: `site2api verify [site]
  Calls every read operation with its stored example args, healing as needed.`,
  sites: `site2api sites
  Lists known sites (user specs in ~/.site2api/sites win over bundled ones).`,
  ops: `site2api ops <site>
  Lists a site's operations and params.`,
  heal: `site2api heal <site> <op> [k=v ...]
  Forces a heal (rescan, then recapture) even when the op is marked stale. Reads only.`,
  export: `site2api export <site> [--out <file>] [--keep-examples] [--force]
  Writes a shareable spec: examples and response shapes stripped, and refused if a live cookie or
  session value is inside. --keep-examples keeps param examples you confirmed are public (so verify works).`,
  mcp: `site2api mcp [--allow-writes]
  Serves list_sites, list_operations and call_operation over stdio MCP.`,
};

const USAGE = `site2api ${VERSION}: turn a website into operations an agent can call.

  site2api login <site|url>
  site2api capture <url> [--steps ...]
  site2api add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [--write]
  site2api call <site> <op> [k=v ...] [--allow-writes]
  site2api inspect <captureId> [<requestId>]
  site2api verify [site] | sites | ops <site> | heal <site> <op> | export <site> | mcp

site2api <command> --help for details. Data lives in ~/.site2api (SITE2API_HOME overrides).`;

const out = (v: unknown) => process.stdout.write(`${JSON.stringify(v)}\n`);

class Fail extends Error {
  constructor(message: string, readonly next: string, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

function kv(list: string[] | undefined): Record<string, string> {
  const args: Record<string, string> = {};
  for (const item of list ?? []) {
    const eq = item.indexOf("=");
    if (eq < 1) throw new Fail(`expected k=v, got "${item}"`, "write args as name=value");
    args[item.slice(0, eq)] = item.slice(eq + 1);
  }
  return args;
}

function json<T>(text: string | undefined, schema: z.ZodType<T>, flag: string): T | undefined {
  if (text === undefined) return undefined;
  try {
    return schema.parse(JSON.parse(text));
  } catch (e) {
    throw new Fail(`--${flag}: ${(e as Error).message.split("\n")[0]}`, `site2api --help shows the --${flag} format`);
  }
}

const needChrome = () => {
  if (!chromeAvailable()) throw new Fail("Google Chrome is not installed", "install Google Chrome, then retry");
};

function requireSite(name: string | undefined) {
  if (!name) throw new Fail("missing <site>", "site2api sites");
  const r = loadSite(name);
  if (!r) throw new Fail(`no site "${name}"`, "site2api sites lists what exists; site2api add creates one");
  return r;
}

const examplesOf = (op: Operation) => Object.fromEntries(op.params.flatMap((p) => (p.example !== undefined ? [[p.name, p.example]] : [])));

async function run(argv: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      example: { type: "string", multiple: true },
      example2: { type: "string", multiple: true },
      trigger: { type: "string" },
      steps: { type: "string" },
      "soft-from": { type: "string" },
      match: { type: "string", multiple: true },
      from: { type: "string" },
      "pick-request": { type: "string" },
      from2: { type: "string" },
      embedded: { type: "string" },
      public: { type: "string" },
      path: { type: "string" },
      "keep-examples": { type: "boolean" },
      extract: { type: "string" },
      pick: { type: "string" },
      html: { type: "string" },
      write: { type: "boolean" },
      description: { type: "string" },
      json: { type: "string" },
      "allow-writes": { type: "boolean" },
      "max-tier": { type: "string" },
      dry: { type: "boolean" },
      limit: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean" },
    },
  });
  const [cmd, ...pos] = positionals;
  if (v.version) return void process.stdout.write(`${VERSION}\n`), 0;
  if (!cmd || !HELP[cmd]) {
    process.stdout.write(`${USAGE}\n`);
    return cmd && !v.help ? (process.stderr.write(`next: unknown command "${cmd}"; see the list above\n`), 1) : 0;
  }
  if (v.help) return void process.stdout.write(`${HELP[cmd]}\n`), 0;
  const steps = json(v.steps, z.array(TriggerStepSchema), "steps");

  switch (cmd) {
    case "login": {
      const target = pos[0];
      if (!target) throw new Fail("missing <site|url>", "site2api login <site|url>");
      const known = /^https?:\/\//.test(target) ? undefined : requireSite(target);
      const url = known ? known.site.baseUrl : target;
      const host = new URL(url).hostname;
      const site = known ? target : (listSites().find((n) => new URL(loadSite(n)!.site.baseUrl).hostname === host) ?? host.replace(/^www\./, ""));
      needChrome();
      process.stderr.write(`Sign in to ${url} in the Chrome window, then close it or press Enter here.\n`);
      const cookies = await login({ url, profileDir: profileDir() });
      saveSession(site, { ...loadSession(site), cookies });
      out({ ok: true, site, cookies: cookies.length, loggedIn: loggedIn(cookies, known?.site.loginCookies) });
      return 0;
    }

    case "capture": {
      const url = pos[0];
      if (!url) throw new Fail("missing <url>", "site2api capture <url>");
      needChrome();
      const c = await capturePage({ url, steps, softFrom: v["soft-from"], write: v.write });
      const limit = Number(v.limit ?? 15);
      const ranked = rankCandidates(c.exchanges, kv(v.example));
      const candidates = ranked.slice(0, limit).map((x) => ({
        id: x.id,
        kind: x.resourceType,
        method: x.method,
        url: x.url.length > 160 ? `${x.url.slice(0, 157)}...` : x.url,
        ...(x.status !== undefined ? { status: x.status } : {}),
        ...(x.contentType ? { type: x.contentType.split(";")[0] } : {}),
        ...(x.operationName ? { operationName: x.operationName } : {}),
        ...(x.hits.length ? { carries: x.hits } : {}),
        size: x.size,
      }));
      const top = ranked[0];
      const html = top && /html/i.test(top.contentType ?? "");
      out({
        capture: c.id,
        finalUrl: c.finalUrl,
        requests: c.exchanges.length,
        candidates,
        next: html
          ? `the best candidate is the HTML page (server-rendered): site2api inspect ${c.id} ${top.id} to read it, then add <site> <op> --from ${c.id} --pick-request ${top.id} --example k=v with --html '<recipe>' or --embedded '<regex>'`
          : `site2api add <site> <op> --from ${c.id} --pick-request <id> --example k=v (site2api inspect ${c.id} <id> shows a response)`,
      });
      return 0;
    }

    case "inspect": {
      const [id, reqId] = pos;
      if (!id) throw new Fail("missing <captureId>", "site2api inspect --help");
      const c = loadCapture(id);
      if (reqId === undefined) {
        out({
          capture: c.id,
          url: c.url,
          requests: c.exchanges.map((e) => ({
            id: e.id,
            kind: e.resourceType,
            method: e.request.method,
            url: e.request.url.slice(0, 160),
            ...(e.response ? { status: e.response.status, type: e.response.contentType.split(";")[0], size: e.response.body?.length ?? 0 } : {}),
            ...(e.aborted ? { aborted: true } : {}),
          })),
        });
        return 0;
      }
      const e = c.exchanges.find((x) => x.id === Number(reqId));
      if (!e) throw new Fail(`no request ${reqId} in capture ${id}`, `site2api inspect ${id}`);
      const html = json(v.html, z.object({ items: z.string(), fields: z.record(z.string(), z.string()) }), "html");
      const body = e.response?.body ?? "";
      const response = { format: html ? "html" : v.embedded ? "embedded" : "json", ...(html ? { html } : {}), ...(v.embedded ? { embedded: { regex: v.embedded } } : {}) } as const;
      let data: unknown;
      try {
        data = html || v.embedded || !/html/i.test(e.response?.contentType ?? "") ? extract({ ...response, extract: v.path }, body) : body;
      } catch {
        data = body; // not JSON: show the text
      }
      out({
        id: e.id,
        request: { method: e.request.method, url: e.request.url, ...(e.request.body ? { body: e.request.body.slice(0, 2000) } : {}) },
        ...(e.response ? { status: e.response.status, type: e.response.contentType } : { aborted: !!e.aborted }),
        ...capOutput(data),
      });
      return 0;
    }

    case "add": {
      const [site, name] = pos;
      if (!site || !name) throw new Fail("missing <site> <op>", "site2api add --help");
      if (!v.trigger && !v.from) throw new Fail("missing --trigger (or --from <captureId>)", "site2api add --help");
      const ex1 = kv(v.example);
      const ex2 = v.example2 ? kv(v.example2) : undefined;
      const matchText = v.match?.length === 1 && v.match[0]!.trim().startsWith("{") ? v.match[0] : v.match ? JSON.stringify(kv(v.match)) : undefined;
      const match = json(matchText, MatchSchema, "match");
      const html = json(v.html, z.object({ items: z.string(), fields: z.record(z.string(), z.string()) }), "html");
      if (!v.from) needChrome();
      if (v.from2 && !ex2) throw new Fail("--from2 needs --example2 (the values that capture was made with)", "site2api add --help");
      const r = await addOperation({
        site,
        op: name,
        trigger: v.trigger ? { url: v.trigger, ...(steps ? { steps } : {}), ...(v["soft-from"] ? { softFrom: v["soft-from"] } : {}) } : undefined,
        examples: ex2 ? [ex1, ex2] : [ex1],
        match,
        write: v.write,
        description: v.description,
        response: {
          ...(v.extract ? { extract: v.extract } : {}),
          ...(v.pick ? { pick: v.pick.split(",").map((s) => s.trim()) } : {}),
          ...(html ? { html } : {}),
          ...(v.embedded ? { embedded: { regex: v.embedded } } : {}),
        },
        public: v.public ? v.public.split(",").map((s) => s.trim().toLowerCase()) : undefined,
        from: v.from ? { capture: loadCapture(v.from), id: v["pick-request"] ? Number(v["pick-request"]) : undefined } : undefined,
        from2: v.from2 ? loadCapture(v.from2) : undefined,
      });
      const op = r.operation;
      out({
        ok: true,
        site,
        op: op.name,
        ...(r.replaced ? { replaced: true } : {}),
        request: `${op.request.method} ${op.request.url.split("?")[0]}`,
        params: op.params.map((p) => `${p.name}:${p.type}`),
        readOnly: op.readOnly,
        minTier: op.minTier,
        match: op.match,
        ...(op.response.extract ? { extract: op.response.extract } : {}),
        ...(r.preview ? { preview: r.preview } : {}),
        warnings: r.warnings,
        ...(r.captures.length ? { captures: r.captures } : {}),
        saved: r.path,
        next: `site2api call ${site} ${op.name} ${op.params.map((p) => `${p.name}=...`).join(" ")}`.trim(),
      });
      return 0;
    }

    case "call": {
      const [site, name, ...rest] = pos;
      if (!site || !name) throw new Fail("missing <site> <op>", "site2api call --help");
      let base: Record<string, unknown> = {};
      if (v.json) {
        base = json(v.json, z.record(z.string(), z.unknown()), "json") ?? {};
      }
      const args = { ...base, ...kv(rest) };
      if (v.dry) {
        const { site: s } = requireSite(site);
        const op = s.operations.find((o) => o.name === name);
        if (!op) throw new Fail(`no operation "${name}" on ${site}`, `site2api ops ${site}`);
        const real = loadSession(site);
        // Placeholders in place of every credential, so --dry output is safe to paste anywhere.
        const redacted = {
          cookies: real.cookies.map((c) => ({ ...c, value: `<${c.name}>` })),
          values: Object.fromEntries(Object.keys(real.values).map((k) => [k, `<${k}>`])),
        };
        out({ ok: true, dry: true, request: buildRequest(op, args, redacted) });
        return 0;
      }
      const maxTier = v["max-tier"] ? (Number(v["max-tier"]) as Tier) : undefined;
      const r = await call(site, name, args, { allowWrites: v["allow-writes"], maxTier });
      out(r);
      if (!r.ok) process.stderr.write(`next: ${r.next}\n`);
      return r.ok ? 0 : 1;
    }

    case "verify": {
      const names = pos[0] ? [requireSite(pos[0]).site.name] : listSites();
      const results = [];
      for (const name of names) {
        let ops: Operation[];
        try {
          ops = requireSite(name).site.operations;
        } catch (e) {
          results.push({ site: name, ok: false, error: (e as Error).message });
          continue;
        }
        for (const op of ops) {
          if (!op.readOnly) continue;
          const args = examplesOf(op);
          const missing = op.params.filter((p) => p.required && args[p.name] === undefined && p.default === undefined).map((p) => p.name);
          if (missing.length) {
            results.push({ site: name, op: op.name, ok: false, skipped: `no example for ${missing.join(", ")}` });
            continue;
          }
          const r = await call(name, op.name, args);
          results.push({ site: name, op: op.name, ok: r.ok, class: r.class, tier: r.tier, ...(r.healed ? { healed: true } : {}), ...(r.ok ? {} : { reason: r.reason, next: r.next }), ms: r.ms });
        }
      }
      const ok = results.every((r) => r.ok);
      out({ ok, results });
      if (!ok) process.stderr.write("next: follow each failing op's own next hint once, then report what still fails\n");
      return ok ? 0 : 1;
    }

    case "sites": {
      out(
        listSites().map((name) => {
          try {
            const r = loadSite(name)!;
            return { name, source: r.source, operations: r.site.operations.length, ...(r.site.description ? { description: r.site.description } : {}) };
          } catch (e) {
            return { name, error: (e as Error).message };
          }
        }),
      );
      return 0;
    }

    case "ops": {
      const { site } = requireSite(pos[0]);
      out({
        site: site.name,
        baseUrl: site.baseUrl,
        operations: site.operations.map((o) => ({
          name: o.name,
          ...(o.description ? { description: o.description } : {}),
          readOnly: o.readOnly,
          params: o.params.map((p) => `${p.name}:${p.type}${p.required ? "" : "?"}${p.example !== undefined ? ` (e.g. ${JSON.stringify(p.example)})` : ""}`),
          ...(o.minTier > 1 ? { minTier: o.minTier } : {}),
          trigger: o.trigger.url,
        })),
      });
      return 0;
    }

    case "heal": {
      const [site, name, ...rest] = pos;
      if (!site || !name) throw new Fail("missing <site> <op>", "site2api heal <site> <op>");
      const op = requireSite(site).site.operations.find((o) => o.name === name);
      const r = await heal(site, name, { ...(op ? examplesOf(op) : {}), ...kv(rest) });
      out(r);
      if (!r.ok) process.stderr.write(`next: ${r.next}\n`);
      return r.ok ? 0 : 1;
    }

    case "export": {
      requireSite(pos[0]);
      const r = exportSite(pos[0]!, { keepExamples: v["keep-examples"] });
      if (r.secrets.length && !v.force) {
        throw new Fail(`refusing to export: ${r.secrets.length} live credential(s) in the spec`, "remove them (re-add the op or edit the spec); --force only if a human confirmed they are public", { secrets: r.secrets });
      }
      for (const w of r.warnings) process.stderr.write(`warning: ${w}\n`);
      const text = `${JSON.stringify(r.spec, null, 2)}\n`;
      if (v.out) {
        writeFileSync(v.out, text);
        out({ ok: true, out: v.out, warnings: r.warnings.length });
      } else process.stdout.write(text);
      return 0;
    }

    case "mcp":
      await serveStdio({ allowWrites: v["allow-writes"] });
      return -1; // keep serving
  }
  return 0;
}

try {
  const code = await run(process.argv.slice(2));
  if (code >= 0) {
    await closeBrowser();
    process.exitCode = code;
  }
} catch (e) {
  await closeBrowser();
  const f = e instanceof Fail ? e : undefined;
  out({ ok: false, error: (e as Error).message, ...(f?.extra ?? {}) });
  process.stderr.write(`next: ${f?.next ?? `site2api ${process.argv[2] ?? ""} --help`.replace(/\s+/g, " ")}\n`);
  process.exitCode = 1;
}
