#!/usr/bin/env node
/** api-anything CLI. Compact JSON on stdout; every failure also prints one `next:` line on stderr. */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parse as parseHtml } from "node-html-parser";
import { z } from "zod";
import { chromeAvailable, closeBrowser, login, ProfileInUse } from "./browser.js";
import { botWall, emptyResults, judge, type Observed } from "./classify.js";
import { call, heal, type Tier } from "./execute.js";
import { capOutput, extract, getPath, innerJson, pick, returnedFields, splitPick } from "./extract.js";
import {
  addOperation,
  type CaptureFile,
  capturePage,
  captureTrigger,
  fillTrigger,
  loadCapture,
  PROFILE_HINT,
  profileDir,
  unplaced,
} from "./heal.js";
import { buildRequest } from "./http.js";
import { AmbiguousProfile } from "./import.js";
import { type Candidate, capturePages, pageUrls, rankCandidates } from "./learn.js";
import { cookieNames, importSession, logout, resolveLoginTarget } from "./login.js";
import { serveStdio, VERSION } from "./mcp.js";
import { type Outline, outline } from "./outline.js";
import { loadSession, loggedIn, saveSession, sessionFile, withLock } from "./session.js";
import { HtmlRecipeSchema, MatchSchema, type Operation, OperationSchema, TriggerStepSchema } from "./spec.js";
import { exportSite, listSites, loadSite, siteNotes } from "./store.js";
import type { Exchange, TriggerStep } from "./types.js";

/** capture/inspect --outline: the scout's summary of one exchange's response. */
function outlineOf(e: Exchange | undefined, values: string[]): { outline?: Outline } {
  const r = e?.response;
  const o = r?.body ? outline(r.contentType, r.body, values) : undefined;
  return o && Object.keys(o).length ? { outline: o } : {};
}

/** A multi-line error (a zod report) on one line, so JSON output keeps all of it. */
const oneLine = (m: string) =>
  m
    .replace(/(^|\s*\n\s*)(✖\s*)?/g, " ")
    .replace(/\s*→\s*(at\s+)?/g, " at ")
    .trim();

const HELP: Record<string, string> = {
  login: `api-anything login <site|url> [--profile "Chrome/Profile 1"] [--window] [--cookies <file>]
  By default imports the site's cookies from your everyday browser (you are almost always already
  signed in there, so no password and no re-doing 2FA). Prints which profile was used and the cookie
  NAMES only (plus the profile's display name and Google account). The imported session is the SAME
  one as your browser: if the site logs it out, both go.
  <site|url>  a site name (linkedin), a domain (linkedin.com, www.linkedin.com) or a URL
  --profile   the browser profile to import from, e.g. "Chrome/Profile 1". Needed when several
              profiles are signed in to the site (possibly different people's accounts): login
              then lists them with their names and emails instead of guessing. The choice is
              remembered: a later automatic re-import uses the same profile.
  --window    open a visible Chrome window to sign in by hand (an independent session); also the
              automatic fallback when nothing is importable. This is where you solve 2FA/captchas.
  --cookies   import a cookies.txt (Netscape) or JSON export (Cookie-Editor / Playwright), for CI`,
  logout: `api-anything logout <site>
  Clears the stored cookie jar and this site's cookies in api-anything's Chrome profile.`,
  capture: `api-anything capture <url> [--steps <json>] [--soft-from <url>] [--example k=v]... [--write] [--limit n] [--outline]
  Loads the page in Chrome and lists the requests it made, noise filtered and ranked (requests carrying
  the --example values first). Saves everything as a capture id for: add --from <id> --pick-request <n>,
  and for: inspect <id> <n>. Captures hold cookie values; the newest 20 are kept, none past 24 h.
  --steps      JSON array of {action: click|fill|press|wait|goto, selector?, value?, ms?}
  --soft-from  load this page first, then navigate in-app to <url> (SPAs only fire their data XHRs that way)
  --write      abort every non-GET request, and every xhr/fetch sent during --steps, before it leaves the browser
  --outline    for the top 3 candidates, summarize the response instead of making you inspect it: where the
               example values are, a suggested --extract and --pick fields with samples, JSON the page
               embeds (a ready --embedded regex), and a repeated HTML list as a ready --html recipe`,
  inspect: `api-anything inspect <captureId> [<requestId>] [--extract <path>] [--pick a,b] [--html <json>] [--embedded <regex>] [--outline --example k=v]
  No browser. Without a request id, lists every request in the capture. With one, shows its request and
  response through add's recipe flags, so a recipe is tried here first: --extract (also spelled --path),
  --pick, --html, --embedded. A path, selector or regex that finds nothing fails (exit 1). An empty
  list at a path is a result, and so is an --html items selector "<container> <item>" whose container
  is on the page with no item in it (data: [], with a note).
  --outline summarizes the response (as capture --outline does) instead of printing it.`,
  add: `api-anything add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [options]
  Runs the trigger twice in Chrome (with --example, then --example2 or --example again), picks the request
  carrying the example values, and saves the learned operation to ~/.api-anything/sites/<site>.json.
  --trigger       page URL with {param} placeholders, e.g. https://site.com/u/{name}
  --steps <json>  UI steps after load; {param} is filled in selector/value
  --soft-from     neutral page to load first, then navigate in-page to the trigger
  --match k=v     pin the request: method=, host=, path= (* = one segment), operationName= (or JSON)
  --from <id> --pick-request <n>   learn from a saved capture instead of running the trigger (no browser).
                  Every add saves its own runs as captures, so a wrong recipe is repaired this way: for an
                  existing op, --from with recipe flags only (--extract, --pick, --html, --embedded) replaces
                  what it returns and keeps its request, params and trigger. With --example the whole op is
                  learned again
  --from2 <id>    a second capture, made with the --example2 values, for the two-run diff; with --from,
                  --example2 needs it: capture the page again with those values
  --extract <path>  dot/bracket path into the response; [*] collects from every array item (sections[*].items)
  --pick a,b.c,name=x.y  fields kept per item; name=path renames the key, name=path~regex keeps regex group 1
  --html <json>   {"items":"<css>","fields":{"name":"<css>[@attr]"}} for server-rendered pages;
                  "all:<css>[@attr]" returns every match as a list (genres, tags)
  --embedded <regex>  JSON inside the page: group 1 marks where the JSON value starts; then --extract
  --public <header,...>  headers holding public constants (a web app's bearer): kept literal, allowed by export
  --write         the op changes state: it is learned from intercepted, aborted requests only; learning an
                  existing write again needs it again (it is never saved as a read)
  --description <text>
  Output: preview (what a call returns, from the captured response), warnings (read them), captures.`,
  call: `api-anything call <site> <op> [k=v ...] [--json <args-object>] [--allow-writes] [--max-tier 1|2|3] [--dry]
  Calls an operation: {ok, class, data, tier, healed?, ms, next?}. --dry prints the request with credentials redacted.`,
  verify: `api-anything verify [site]
  Calls every read operation with its stored example args, healing as needed.`,
  sites: `api-anything sites
  Lists known sites (user specs in ~/.api-anything/sites win over bundled ones).`,
  ops: `api-anything ops <site>
  Lists a site's operations and params (with each param's format), and the site's notes: caveats,
  arg formats and login advice from <site>.md beside its spec.`,
  heal: `api-anything heal <site> <op> [k=v ...]
  Forces a heal (rescan, then recapture) even when the op is marked stale. Reads only.`,
  export: `api-anything export <site> [--out <file>] [--keep-examples] [--force]
  Writes a shareable spec: examples and response shapes stripped, and refused if a live cookie or
  session value is inside. --keep-examples keeps param examples you confirmed are public (so verify works).`,
  mcp: `api-anything mcp [--allow-writes]
  Serves list_sites, list_operations, call_operation and login over stdio MCP. MCP cannot create
  operations (use capture/add here), and its login only refreshes a session a human imported here.`,
};

const USAGE = `api-anything ${VERSION}: turn a website into operations an agent can call.

  api-anything login <site|url> [--profile ... | --window | --cookies <file>]
  api-anything logout <site>
  api-anything capture <url> [--steps ...]
  api-anything add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [--write]
  api-anything call <site> <op> [k=v ...] [--allow-writes]
  api-anything inspect <captureId> [<requestId>]
  api-anything verify [site] | sites | ops <site> | heal <site> <op> | export <site> | mcp

api-anything <command> --help for details. Data lives in ~/.api-anything (API_ANYTHING_HOME overrides).`;

const out = (v: unknown) => process.stdout.write(`${JSON.stringify(v)}\n`);

class Fail extends Error {
  constructor(
    message: string,
    readonly next: string,
    readonly extra: Record<string, unknown> = {},
  ) {
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
    // a ZodError's own message is its issue list as JSON
    const why = e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message;
    throw new Fail(`--${flag}: ${oneLine(why)}`, `api-anything --help shows the --${flag} format`);
  }
}

/** --steps. An unknown action is named here, with the ones that exist: the schema's report would not say which it was. */
function stepsOf(text: string | undefined): TriggerStep[] | undefined {
  const actions: readonly string[] = TriggerStepSchema.shape.action.options;
  const given = json(text, z.unknown(), "steps");
  const bad = (Array.isArray(given) ? given : [])
    .map((s) => s?.action)
    .find((a) => typeof a === "string" && !actions.includes(a));
  if (bad)
    throw new Fail(
      `--steps: unknown action "${bad}"${/upload/i.test(bad) ? " (file uploads are not supported)" : ""}; the actions are ${actions.join(", ")}`,
      "api-anything capture --help shows the --steps format",
    );
  return json(text, z.array(TriggerStepSchema), "steps");
}

const needChrome = () => {
  if (!chromeAvailable()) throw new Fail("Google Chrome is not installed", "install Google Chrome, then retry");
};

function requireSite(name: string | undefined) {
  if (!name) throw new Fail("missing <site>", "api-anything sites");
  const r = loadSite(name);
  if (!r) throw new Fail(`no site "${name}"`, "api-anything sites lists what exists; api-anything add creates one");
  return r;
}

const examplesOf = (op: Operation) =>
  Object.fromEntries(op.params.flatMap((p) => (p.example !== undefined ? [[p.name, p.example]] : [])));

const OPTIONS = {
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
  window: { type: "boolean" },
  cookies: { type: "string" },
  profile: { type: "string" },
  outline: { type: "boolean" },
} as const;

/** What a command gets: the flags, the positionals after the command name, and the parsed --steps. */
interface Parsed {
  v: ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>["values"];
  pos: string[];
  steps?: TriggerStep[];
}

async function cmdLogin({ v, pos }: Parsed): Promise<number> {
  const target = pos[0];
  if (!target) throw new Fail("missing <site|url>", "api-anything login <site|url>");
  let t: ReturnType<typeof resolveLoginTarget>;
  try {
    t = resolveLoginTarget(target);
  } catch (e) {
    throw new Fail(
      (e as Error).message,
      "api-anything sites lists known sites; or pass a domain (linkedin.com) or a full https:// URL",
    );
  }
  const { site, url, loginCookies } = t;

  // The visible-window flow: --window, or the automatic fallback when nothing is importable.
  const runWindow = async (reason?: string) => {
    needChrome();
    process.stderr.write(
      `${reason ? `${reason} ` : ""}Sign in to ${url} in the Chrome window, then close it or press Enter here.\n`,
    );
    const cookies = await login({ url, profileDir: profileDir() });
    withLock(sessionFile(site), () => saveSession(site, { ...loadSession(site), cookies, source: "window" }));
    out({
      ok: true,
      site,
      source: "window",
      cookies: cookieNames(cookies),
      loggedIn: loggedIn(cookies, loginCookies),
    });
    return 0;
  };

  if (v.window) return runWindow();

  let imported: Awaited<ReturnType<typeof importSession>>;
  try {
    imported = await importSession(site, url, { loginCookies, profile: v.profile, file: v.cookies });
  } catch (e) {
    if (!(e instanceof AmbiguousProfile)) throw e;
    throw new Fail(
      e.message,
      `ask the user which account to use, then: api-anything login ${site} --profile "<Browser/Profile>" (one of candidates[].profile)`,
      { candidates: e.candidates },
    );
  }
  if (!imported) {
    if (v.cookies) throw new Fail(`no cookies for ${site} in ${v.cookies}`, "check the export is for the right site");
    if (v.profile)
      throw new Fail(
        `no importable cookies in profile "${v.profile}"`,
        `run: api-anything login ${site} (scans every profile), or --window`,
      );
    return runWindow("No signed-in session found in your browsers.");
  }
  out({
    ok: true,
    site,
    source: imported.source,
    ...(imported.source !== "file" ? { profile: `${imported.browser}/${imported.profile}` } : {}),
    ...(imported.name ? { profileName: imported.name } : {}),
    ...(imported.email ? { account: imported.email } : {}),
    cookies: cookieNames(imported.cookies),
    loggedIn: loggedIn(imported.cookies, loginCookies),
  });
  return 0;
}

async function cmdLogout({ pos }: Parsed): Promise<number> {
  const site = pos[0];
  if (!site) throw new Fail("missing <site>", "api-anything logout <site>");
  await logout(site);
  out({ ok: true, site, loggedOut: true });
  return 0;
}

function positive(text: string | undefined, flag: string): number | undefined {
  if (text === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(text))
    throw new Fail(`--${flag} must be a positive integer, got "${text}"`, `api-anything --help`);
  return Number(text);
}

/** A page's text outside its forms: a page that is only a sign-in form has none. */
function textOutsideForms(html: string): string {
  const root = parseHtml(html);
  for (const el of root.querySelectorAll("form, head, script, style, noscript, template")) el.remove();
  // the body's: the parser keeps `<!doctype html>` as text at the root
  return (root.querySelector("body") ?? root).text.trim();
}

/**
 * What the page a capture ended on says about learning from it. `stop`: nothing to learn here, it
 * is a sign-in page or an HTTP error. `also`: it shows a sign-in form beside content or data, as a
 * public page may, so that is said next to the recommendation and not instead of it. `status`: its
 * HTTP error, when a request it loaded is recommended all the same.
 */
function pageSays(
  c: CaptureFile,
  url: string,
  ranked: Candidate[],
  values: string[],
): { stop?: string; also?: string; status?: number } {
  const pages = capturePages(c).map((u) => u.split("#")[0]);
  // the main frame's last document: a widget's iframe is a document too
  const page = c.exchanges
    .filter((e) => e.resourceType === "document" && e.response && pages.includes(e.request.url))
    .at(-1);
  if (!page?.response) return {};
  const { status, headers, body = "" } = page.response;
  // what the classifier makes of a page nothing was learned from yet: a read whose recipe finds nothing
  const unlearned = OperationSchema.parse({
    name: "page",
    readOnly: true,
    request: { method: "GET", url },
    trigger: { url },
    response: { format: "embedded" },
  });
  const signIn = (seen: Observed) => judge(unlearned, { ...seen, url: c.finalUrl }).class === "auth";
  // Shown neither markup nor status, the classifier can only go by where the navigation landed: a login path.
  const landed = signIn({ status: 200, headers: {}, body: "" });
  const form = signIn({ status, headers, body });
  const shown = values.some((x) => x.length >= 3 && body.toLowerCase().includes(x.toLowerCase()));
  // The page is the form and nothing else: no other candidate, no example value, no text outside its forms.
  const bare = form && ranked.every((x) => x.id === page.id) && !shown && !textOutsideForms(body);
  // An error is a dead end when the erroring page is itself what would be recommended, not when a
  // data request it loaded is (a static host's 404 fallback serving the app).
  const failed = status >= 400 && (ranked[0]?.id ?? page.id) === page.id;
  if (landed || bare || (form && failed))
    return { stop: "the page is a sign-in page: ask the user to run api-anything login <site>, then capture again" };
  if (failed) return { stop: `the page answered HTTP ${status}: check the URL, then capture again` };
  return {
    ...(form
      ? {
          also: "the page also shows a sign-in form: if the data you want is missing, ask the user to run api-anything login <site> first",
        }
      : {}),
    ...(status >= 400 ? { status } : {}),
  };
}

async function cmdCapture({ v, pos, steps }: Parsed): Promise<number> {
  const url = pos[0];
  if (!url) throw new Fail("missing <url>", "api-anything capture <url>");
  needChrome();
  const limit = positive(v.limit, "limit") ?? 15;
  const examples = kv(v.example);
  const c = await capturePage({ url, steps, softFrom: v["soft-from"], write: v.write, args: examples });
  const ranked = rankCandidates(c.exchanges, examples, { pages: pageUrls(c.exchanges, capturePages(c)) });
  const values = Object.values(examples).map(String);
  const candidates = ranked.slice(0, limit).map((x, i) => ({
    id: x.id,
    kind: x.resourceType,
    method: x.method,
    url: x.url.length > 160 ? `${x.url.slice(0, 157)}...` : x.url,
    ...(x.status !== undefined ? { status: x.status } : {}),
    ...(x.contentType ? { type: x.contentType.split(";")[0] } : {}),
    ...(x.operationName ? { operationName: x.operationName } : {}),
    ...(x.hits.length ? { carries: x.hits } : {}),
    size: x.size,
    ...(v.outline && i < 3
      ? outlineOf(
          c.exchanges.find((e) => e.id === x.id),
          values,
        )
      : {}),
  }));
  const top = ranked[0];
  const html = top && /html/i.test(top.contentType ?? "");
  // a bot wall is not fixed by picking another request or writing a recipe
  const doc = c.exchanges.filter((e) => e.resourceType === "document" && e.response).at(-1);
  const topEx = top && c.exchanges.find((e) => e.id === top.id);
  const wall = [doc, topEx]
    .map(
      (e) =>
        e?.response && botWall({ status: e.response.status, headers: e.response.headers, body: e.response.body ?? "" }),
    )
    .find(Boolean);
  const page: ReturnType<typeof pageSays> = wall ? {} : pageSays(c, url, ranked, values);
  const learn = html
    ? `the best candidate is the HTML page (server-rendered): api-anything inspect ${c.id} ${top.id} to read it, then add <site> <op> --from ${c.id} --pick-request ${top.id} --example k=v with --html '<recipe>' or --embedded '<regex>'`
    : `api-anything add <site> <op> --from ${c.id} --pick-request <id> --example k=v (api-anything inspect ${c.id} <id> shows a response)`;
  out({
    capture: c.id,
    finalUrl: c.finalUrl,
    requests: c.exchanges.length,
    candidates,
    ...(wall ? { blocked: wall } : {}),
    ...(page.status ? { pageStatus: page.status } : {}),
    next: wall
      ? `the site served a bot challenge (${wall}): ask the user to run api-anything login <site> (clear the challenge in the window), then capture again`
      : (page.stop ?? (page.also ? `${learn}; ${page.also}` : learn)),
  });
  return 0;
}

/**
 * JSON inside strings parsed in place (batchexecute's `wrb.fr` payloads, a form's f.req), so the
 * default view shows the data instead of an envelope around one long string.
 */
function unlayer(v: unknown, layers = 0): unknown {
  if (typeof v === "string") {
    const inner = layers < 5 ? innerJson(v) : undefined;
    return inner !== null && typeof inner === "object" ? unlayer(inner, layers + 1) : v;
  }
  if (Array.isArray(v)) return v.map((x) => unlayer(x, layers));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unlayer(x, layers)]));
  return v;
}

function cmdInspect({ v, pos }: Parsed): number {
  const [id, reqId] = pos;
  if (!id) throw new Fail("missing <captureId>", "api-anything inspect --help");
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
        ...(e.response
          ? {
              status: e.response.status,
              type: e.response.contentType.split(";")[0],
              size: e.response.body?.length ?? 0,
            }
          : {}),
        ...(e.aborted ? { aborted: true } : {}),
      })),
    });
    return 0;
  }
  const e = c.exchanges.find((x) => x.id === Number(reqId));
  if (!e) throw new Fail(`no request ${reqId} in capture ${id}`, `api-anything inspect ${id}`);
  if (v.outline) {
    out({
      id: e.id,
      request: { method: e.request.method, url: e.request.url },
      ...outlineOf(e, Object.values(kv(v.example)).map(String)),
    });
    return 0;
  }
  const html = json(v.html, HtmlRecipeSchema, "html");
  const path = v.extract ?? v.path;
  const body = e.response?.body ?? "";
  // A recipe that finds nothing says so: no data field, or [] from a selector, reads as "no results".
  const nothing = (what: string) =>
    new Fail(
      `${what} in request ${e.id}'s response`,
      `api-anything inspect ${id} ${e.id} --outline --example k=v suggests a recipe; with no recipe flag it prints the whole response`,
    );
  let data: unknown = body;
  let note: string | undefined;
  if (html) {
    data = extract({ format: "html", html }, body);
    if (!(data as unknown[]).length) {
      // a results page with no results is an answer, as a call would give it; a selector that is not there is not
      if (!emptyResults(body, html.items)) throw nothing(`the --html items selector "${html.items}" matched nothing`);
      note = `no items: the container of "${html.items}" is on the page and empty, so this is a page with no results`;
    }
  } else if (v.embedded) {
    data = extract({ format: "embedded", embedded: { regex: v.embedded } }, body);
    if (data === undefined) throw nothing("the --embedded regex found no JSON");
  } else if (!/html/i.test(e.response?.contentType ?? "")) {
    try {
      data = extract({ format: "json" }, body);
    } catch {
      // not JSON: show the text
    }
  }
  if (path) {
    data = getPath(data, path);
    // an empty list at the path is a result; a path that is not there is not
    if (data === undefined) throw nothing(`nothing at "${path}"`);
  }
  if (v.pick) data = pick(data, splitPick(v.pick));
  const sent = e.request.body;
  const form =
    sent !== undefined &&
    /x-www-form-urlencoded/i.test(e.request.headers["content-type"] ?? "") &&
    !/^\s*[[{]/.test(sent);
  const shownBody =
    sent === undefined ? undefined : form ? unlayer(Object.fromEntries(new URLSearchParams(sent))) : unlayer(sent);
  out({
    id: e.id,
    request: {
      method: e.request.method,
      url: e.request.url,
      ...(shownBody !== undefined ? { body: capOutput(shownBody, 4000).data } : {}),
    },
    ...(e.response ? { status: e.response.status, type: e.response.contentType } : { aborted: !!e.aborted }),
    ...capOutput(unlayer(data)),
    ...(note ? { note } : {}),
  });
  return 0;
}

/** One shell word, quoted: a space, a quote or JSON in a hint's command pastes as a single argument. */
const sh = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;

/**
 * The command that repeats how capture `c` was made, with the second example's values where the
 * first's sit in its URL and steps. Undefined when they sit in neither: there is nothing to swap.
 */
function captureAgain(
  c: CaptureFile,
  ex1: Record<string, string>,
  ex2: Record<string, string>,
  write: boolean,
): string | undefined {
  const made = captureTrigger(c, ex1);
  if (!Object.keys(ex2).length || Object.keys(ex1).some((k) => !(k in ex2)) || unplaced(made, ex2).length)
    return undefined;
  const t = fillTrigger(made, ex2);
  return [
    `api-anything capture ${sh(t.url)}`,
    ...(t.softFrom ? [`--soft-from ${sh(t.softFrom)}`] : []),
    ...(t.steps ? [`--steps ${sh(JSON.stringify(t.steps))}`] : []),
    ...(write ? ["--write"] : []),
    ...Object.entries(ex2).map(([k, x]) => `--example ${sh(`${k}=${x}`)}`),
  ].join(" ");
}

async function cmdAdd({ v, pos, steps }: Parsed): Promise<number> {
  const [site, name] = pos;
  if (!site || !name) throw new Fail("missing <site> <op>", "api-anything add --help");
  if (!v.trigger && !v.from) throw new Fail("missing --trigger (or --from <captureId>)", "api-anything add --help");
  const ex1 = kv(v.example);
  const ex2 = v.example2 ? kv(v.example2) : undefined;
  const matchText =
    v.match?.length === 1 && v.match[0]!.trim().startsWith("{")
      ? v.match[0]
      : v.match
        ? JSON.stringify(kv(v.match))
        : undefined;
  const match = json(matchText, MatchSchema, "match");
  const html = json(v.html, HtmlRecipeSchema, "html");
  if (!v.from) needChrome();
  if (v.from2 && !ex2)
    throw new Fail("--from2 needs --example2 (the values that capture was made with)", "api-anything add --help");
  if (v.from && ex2 && !v.from2) {
    const c = loadCapture(v.from);
    const write = !!(c.write || v.write);
    const command = captureAgain(c, ex1, ex2, write);
    throw new Fail(
      "--example2 with --from needs --from2: a capture holds one run",
      `${
        command
          ? `capture the page again with the second example's values: ${command}`
          : `the first example's values are not in capture ${c.id}'s url or steps, so the command cannot be written out: capture that page again the way ${c.id} was made (${["its url", c.softFrom && "--soft-from", c.steps && "--steps", write && "--write"].filter(Boolean).join(", ")}), with the second example's values`
      }; then run this add again with --from2 <the new capture's id>`,
    );
  }
  const r = await addOperation({
    site,
    op: name,
    trigger: v.trigger
      ? { url: v.trigger, ...(steps ? { steps } : {}), ...(v["soft-from"] ? { softFrom: v["soft-from"] } : {}) }
      : undefined,
    examples: ex2 ? [ex1, ex2] : [ex1],
    match,
    write: v.write,
    description: v.description,
    response: {
      ...(v.extract ? { extract: v.extract } : {}),
      ...(v.pick ? { pick: splitPick(v.pick) } : {}),
      ...(html ? { html } : {}),
      ...(v.embedded ? { embedded: { regex: v.embedded } } : {}),
    },
    public: v.public ? v.public.split(",").map((s) => s.trim().toLowerCase()) : undefined,
    from: v.from
      ? { capture: loadCapture(v.from), id: v["pick-request"] ? Number(v["pick-request"]) : undefined }
      : undefined,
    from2: v.from2 ? loadCapture(v.from2) : undefined,
  });
  const op = r.operation;
  out({
    ok: true,
    site,
    op: op.name,
    ...(r.repaired
      ? { repaired: "only what it returns changed: the request, params and trigger are as they were" }
      : r.replaced
        ? { replaced: true }
        : {}),
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
    next: `api-anything call ${site} ${op.name} ${op.params.map((p) => `${p.name}=...`).join(" ")}`.trim(),
  });
  return 0;
}

async function cmdCall({ v, pos }: Parsed): Promise<number> {
  const [site, name, ...rest] = pos;
  if (!site || !name) throw new Fail("missing <site> <op>", "api-anything call --help");
  if (v["max-tier"] !== undefined && !/^[123]$/.test(v["max-tier"]))
    throw new Fail(`--max-tier must be 1, 2 or 3, got "${v["max-tier"]}"`, "pass --max-tier 1, 2 or 3");
  let base: Record<string, unknown> = {};
  if (v.json) {
    base = json(v.json, z.record(z.string(), z.unknown()), "json") ?? {};
  }
  const args = { ...base, ...kv(rest) };
  if (v.dry) {
    const { site: s } = requireSite(site);
    const op = s.operations.find((o) => o.name === name);
    if (!op) throw new Fail(`no operation "${name}" on ${site}`, `api-anything ops ${site}`);
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

async function cmdVerify({ pos }: Parsed): Promise<number> {
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
      const missing = op.params
        .filter((p) => p.required && args[p.name] === undefined && p.default === undefined)
        .map((p) => p.name);
      if (missing.length) {
        results.push({ site: name, op: op.name, ok: false, skipped: `no example for ${missing.join(", ")}` });
        continue;
      }
      const r = await call(name, op.name, args);
      results.push({
        site: name,
        op: op.name,
        ok: r.ok,
        class: r.class,
        tier: r.tier,
        ...(r.healed ? { healed: true } : {}),
        ...(r.ok ? {} : { reason: r.reason, next: r.next }),
        ms: r.ms,
      });
    }
  }
  const ok = results.every((r) => r.ok);
  out({ ok, results });
  if (!ok) process.stderr.write("next: follow each failing op's own next hint once, then report what still fails\n");
  return ok ? 0 : 1;
}

function cmdSites(): number {
  out(
    listSites().map((name) => {
      try {
        const r = loadSite(name)!;
        return {
          name,
          source: r.source,
          operations: r.site.operations.length,
          ...(r.site.description ? { description: r.site.description } : {}),
        };
      } catch (e) {
        return { name, error: (e as Error).message };
      }
    }),
  );
  return 0;
}

function cmdOps({ pos }: Parsed): number {
  const { site } = requireSite(pos[0]);
  const notes = siteNotes(site.name);
  const about = (p: Operation["params"][number]) => [
    ...(p.description ? [p.description] : []),
    ...(p.example !== undefined ? [`e.g. ${JSON.stringify(p.example)}`] : []),
    ...(p.hint ? [p.hint] : p.pattern ? [`matches /${p.pattern}/`] : []),
  ];
  out({
    site: site.name,
    baseUrl: site.baseUrl,
    operations: site.operations.map((o) => ({
      name: o.name,
      ...(o.description ? { description: o.description } : {}),
      readOnly: o.readOnly,
      ...(returnedFields(o.response) ? { returns: returnedFields(o.response) } : {}),
      params: o.params.map(
        (p) => `${p.name}:${p.type}${p.required ? "" : "?"}${about(p).length ? ` (${about(p).join("; ")})` : ""}`,
      ),
      ...(o.minTier > 1 ? { minTier: o.minTier } : {}),
      trigger: o.trigger.url,
    })),
    ...(notes ? { notes } : {}),
  });
  return 0;
}

async function cmdHeal({ pos }: Parsed): Promise<number> {
  const [site, name, ...rest] = pos;
  if (!site || !name) throw new Fail("missing <site> <op>", "api-anything heal <site> <op>");
  const op = requireSite(site).site.operations.find((o) => o.name === name);
  const r = await heal(site, name, { ...(op ? examplesOf(op) : {}), ...kv(rest) });
  out(r);
  if (!r.ok) process.stderr.write(`next: ${r.next}\n`);
  return r.ok ? 0 : 1;
}

function cmdExport({ v, pos }: Parsed): number {
  requireSite(pos[0]);
  const r = exportSite(pos[0]!, { keepExamples: v["keep-examples"] });
  if (r.secrets.length && !v.force) {
    throw new Fail(
      `refusing to export: ${r.secrets.length} live credential(s) in the spec`,
      "remove them (re-add the op or edit the spec); --force only if a human confirmed they are public",
      { secrets: r.secrets },
    );
  }
  for (const w of r.warnings) process.stderr.write(`warning: ${w}\n`);
  const text = `${JSON.stringify(r.spec, null, 2)}\n`;
  if (v.out) {
    writeFileSync(v.out, text);
    out({ ok: true, out: v.out, warnings: r.warnings.length });
  } else process.stdout.write(text);
  return 0;
}

async function cmdMcp({ v }: Parsed): Promise<number> {
  await serveStdio({ allowWrites: v["allow-writes"] });
  return -1; // keep serving
}

type Flag = keyof typeof OPTIONS;
/** Each command and the flags it takes: run() refuses any other, so none is silently ignored. */
const COMMANDS: Record<string, { run: (p: Parsed) => number | Promise<number>; flags: Flag[] }> = {
  login: { run: cmdLogin, flags: ["profile", "window", "cookies"] },
  logout: { run: cmdLogout, flags: [] },
  capture: { run: cmdCapture, flags: ["steps", "soft-from", "example", "write", "limit", "outline"] },
  inspect: { run: cmdInspect, flags: ["path", "extract", "pick", "html", "embedded", "outline", "example"] },
  add: {
    run: cmdAdd,
    flags: [
      "trigger",
      "example",
      "example2",
      "steps",
      "soft-from",
      "match",
      "from",
      "pick-request",
      "from2",
      "extract",
      "pick",
      "html",
      "embedded",
      "public",
      "write",
      "description",
    ],
  },
  call: { run: cmdCall, flags: ["json", "allow-writes", "max-tier", "dry"] },
  verify: { run: cmdVerify, flags: [] },
  sites: { run: cmdSites, flags: [] },
  ops: { run: cmdOps, flags: [] },
  heal: { run: cmdHeal, flags: [] },
  export: { run: cmdExport, flags: ["out", "keep-examples", "force"] },
  mcp: { run: cmdMcp, flags: ["allow-writes"] },
};

async function run(argv: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS });
  const [cmd, ...pos] = positionals;
  if (v.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  // an own key only: `toString` is on every object
  const c = cmd && Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : undefined;
  if (!cmd || !c) {
    process.stdout.write(`${USAGE}\n`);
    if (!cmd || v.help) return 0;
    process.stderr.write(`next: unknown command "${cmd}"; see the list above\n`);
    return 1;
  }
  if (v.help) {
    process.stdout.write(`${HELP[cmd]}\n`);
    return 0;
  }
  const extra = Object.keys(v).filter((k) => !c.flags.includes(k as Flag));
  if (extra.length)
    throw new Fail(`${cmd} does not take --${extra.join(", --")}`, `api-anything ${cmd} --help lists its flags`);
  return c.run({ v, pos, steps: stepsOf(v.steps) });
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
  // Playwright errors carry the whole Chrome command line after the first line
  out({ ok: false, error: oneLine((e as Error).message), ...(f?.extra ?? {}) });
  const next =
    f?.next ??
    (e instanceof ProfileInUse ? PROFILE_HINT : `api-anything ${process.argv[2] ?? ""} --help`.replace(/\s+/g, " "));
  process.stderr.write(`next: ${next}\n`);
  process.exitCode = 1;
}
