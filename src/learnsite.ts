/**
 * One call that learns a read a site lacks, proves it and shares it (docs/REGISTRY.md, "Learning an
 * operation that does not exist"). It is `add` with the user's args as example 1 and the agent's second
 * value as example 2, the request and recipe taken from run 1's outline unless the agent chose them;
 * then a holdout call through call(), a replay with no cookies, and shareOps.
 */
import { readFileSync } from "node:fs";
import { browserAvailable, ProfileInUse } from "./browser.js";
import { type Proof, recordCases } from "./checks.js";
import { botWall, judge } from "./classify.js";
import { cleanCall } from "./clean.js";
import { asText } from "./codec.js";
import { siteOf, slugOf } from "./domain.js";
import { call, type NextCall } from "./execute.js";
import { capOutput, extract } from "./extract.js";
import {
  type AddInput,
  addOperation,
  type CaptureFile,
  capturePage,
  fillTrigger,
  loadCapture,
  loginWall,
  NotARead,
  PROFILE_HINT,
} from "./heal.js";
import { buildRequest } from "./http.js";
import { answerShare, loadSettings, QUESTION } from "./identity.js";
import { type Args, capturePages, pageUrls, rankCandidates } from "./learn.js";
import { resolveLoginTarget } from "./login.js";
import { outline } from "./outline.js";
import { pull, registryRequest, sharedName } from "./registry.js";
import type { Evidence, ServedSite } from "./registry-api.js";
import { summarize } from "./search.js";
import { safeName } from "./session.js";
import { HOLDOUT_PURPOSE, type ShareOutcome, shareOps } from "./share.js";
import { CheckSchema, type Operation } from "./spec.js";
import { loadSite, updateSite } from "./store.js";
import type { Exchange } from "./types.js";
import { badAddress, LIMITS, notARead } from "./vet.js";

const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;

export type Recipe = Pick<NonNullable<AddInput["response"]>, "extract" | "pick" | "html" | "embedded">;

export interface LearnSiteInput {
  /** a site name; default: named from the trigger's host, as `login <url>` names one */
  site?: string;
  /** the operation's name; default: from the trigger's path */
  op?: string;
  /** the page URL with `{param}` placeholders */
  trigger: string;
  /** the user's own request: run 1, and the data returned */
  args: Args;
  /** another real value of the same kind: run 2, and the op's stored (published) example */
  args2: Args;
  /** a third: the holdout call, recorded as the op's check */
  args3: Args;
  /** what the op is for; becomes its description unless it holds one of the user's values */
  intent?: string;
  /** a request id from run 1 (`chosen` and `alternatives` list them) */
  pickRequest?: number;
  extract?: string;
  pick?: string[];
  html?: Recipe["html"];
  embedded?: string;
  /** an earlier result's `captures` (run 1, run 2): learn again with other choices and no browser */
  captures?: [string, string];
  /** refused: a write is learned with the CLI's `add --write`, which intercepts it */
  write?: boolean;
}

export interface LearnSiteOptions {
  /** asks the user whether to share an op that needs their yes; undefined: they could not be asked */
  consent?: (message: string) => Promise<boolean | undefined>;
  minIntervalMs?: number;
}

interface Choice {
  request: number;
  method: string;
  url: string;
  type?: string;
  carries?: string[];
  recipe?: Recipe;
  /** field -> sample, for a `pick` */
  fields?: Record<string, string>;
}

export interface LearnSiteResult {
  ok: boolean;
  class?: "refused";
  site?: string;
  op?: string;
  /** `name(params) -> fields` */
  signature?: string;
  /** the answer to the user's own request (run 1) */
  data?: unknown;
  truncated?: string;
  chosen?: Choice & { recipe: Recipe; auto: boolean };
  alternatives?: Choice[];
  proof?: {
    holdout: { args: Args; ok: boolean; class: string; tier?: 1 | 2 | 3; reason?: string };
    cleanReplay: Evidence["cleanReplay"];
    cleanReason?: string;
  };
  shared?: ShareOutcome;
  /** an op someone shared for the same page answered: nothing was learned or uploaded */
  reused?: { site: string; op: string; status?: string };
  warnings?: string[];
  captures?: string[];
  saved?: string;
  error?: string;
  next?: string;
  nextCall?: NextCall;
}

/** What `next` says while setup's question was never answered. */
const ASK = `sharing was never set up on this install: ask the user once, in these words: "${QUESTION}" On yes, run api-anything setup --yes --share-only; on no, api-anything setup --no-share --share-only. Either answer is kept, and never asked again`;

/**
 * The registry's site for the trigger's domain (`name`), when one of its reads is behind the same page:
 * pulled as an agent pulls (reads only, the shared rules, a candidate called with no cookies) and called
 * with the user's args. Undefined when there is none, or its call does not answer with data: then it is
 * learned. A user's own copy under that name is called as it is, never pulled over.
 */
async function reuse(
  input: LearnSiteInput,
  name: string | undefined,
  askOnce: () => Promise<void>,
  o: LearnSiteOptions,
): Promise<LearnSiteResult | undefined> {
  if (!name) return undefined;
  let local: ReturnType<typeof loadSite>;
  try {
    local = loadSite(name);
  } catch {
    return undefined;
  }
  const match = (ops: Operation[]) =>
    ops.flatMap((op) => {
      const args = op.readOnly ? sameTrigger(op, input.trigger, input.args) : undefined;
      return args ? [{ op, args }] : [];
    })[0];
  if (!local || local.source === "registry")
    try {
      // only a site with an op for this page is pulled; what is called is the pulled copy, vetted
      const served = await registryRequest<ServedSite>(`/v1/sites/${name}`, {
        cap: LIMITS.file + LIMITS.notes + 64 * 1024,
        timeoutMs: 5000,
      });
      if (!match(served.operations.map((x) => x.operation))) return undefined;
      await pull(name, { by: "agent" });
      local = loadSite(name);
    } catch {
      return undefined;
    }
  const found = local && match(local.site.operations);
  if (!found) return undefined;
  // its report is what promotes it: the question is asked before the call, if it never was
  await askOnce();
  const op = found.op.name;
  const r = await call(name, op, found.args, { minIntervalMs: o.minIntervalMs });
  if (!r.ok || empty(r.data)) return undefined;
  const answer = capOutput(r.data);
  const status = found.op.version?.status;
  return {
    ok: true,
    site: name,
    op,
    signature: summarize(found.op).op,
    data: answer.data,
    ...(answer.truncated ? { truncated: answer.truncated } : {}),
    reused: { site: name, op, ...(status ? { status } : {}) },
    ...(loadSettings().askedAt ? {} : { next: ASK }),
  };
}

/** Replaced by tests: the real shareOps belongs to the registry client. */
export const hooks = { share: shareOps };

const clip = (u: string) => (u.length > 160 ? `${u.slice(0, 157)}...` : u);
const empty = (d: unknown) =>
  d === undefined || d === null || (Array.isArray(d) && !d.length) || (typeof d === "object" && !Object.keys(d).length);

/** The recipe run 1's outline suggests for one request, if it can read the example values out of it. */
function suggest(e: Exchange, carries: string[], values: string[]): Pick<Choice, "recipe" | "fields"> | undefined {
  const r = e.response;
  const o = r?.body ? outline(r.contentType, r.body, values) : undefined;
  if (!o) return undefined;
  // a JSON answer is learnable only from a request that carries the args
  if (o.json)
    return carries.length && o.json.at
      ? { recipe: o.json.extract ? { extract: o.json.extract } : {}, fields: o.json.fields }
      : undefined;
  if (o.list) return { recipe: { html: { items: o.list.items, fields: o.list.fields } }, fields: o.list.sample };
  const block = o.embedded?.find((b) => b.at) ?? o.embedded?.find((b) => b.regex.startsWith("application/ld"));
  if (block)
    return {
      recipe: { embedded: { regex: block.regex }, ...(block.extract ? { extract: block.extract } : {}) },
      fields: block.fields,
    };
  return undefined;
}

/** The recipe reads something out of this answer. */
function resolves(r: Recipe, body: string | undefined): boolean {
  if (!body) return false;
  try {
    const d = extract({ format: r.html ? "html" : r.embedded ? "embedded" : "json", ...r }, body);
    return !empty(d);
  } catch {
    return false;
  }
}

/** A name from the trigger's last word of path (`/search?q=` -> search), else get<FirstParam>. */
function opName(trigger: string, args: Args): string {
  const word = new URL(trigger).pathname
    .split("/")
    .filter((s) => /^[A-Za-z][\w-]{2,}$/.test(s))
    .at(-1);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (word)
    return word
      .split(/[-_]+/)
      .map((w, i) => (i ? cap(w) : w.toLowerCase()))
      .join("");
  return `get${cap((Object.keys(args)[0] ?? "page").replace(/[^\w]/g, ""))}`;
}

/**
 * The op as if run 1 had been made with `args`: the request template holds the captured values where
 * the params go (a call overwrites them), and those values are the user's own request.
 */
function asExample(op: Operation, args: Args): Operation {
  const params = { ...op, slots: op.slots.filter((s) => s.param !== undefined) };
  return {
    ...op,
    request: buildRequest(params, args, { cookies: [], values: {} }),
    params: op.params.map((p) => ({ ...p, example: args[p.name] ?? p.example })),
  };
}

/** The user's values (3+ characters) still in the op, in any common encoding: shared, they say what the user asked. */
function revealed(op: Operation, args: Args): string[] {
  const { learnedAt: _, ...rest } = op;
  const text = JSON.stringify(rest).toLowerCase();
  return Object.entries(args)
    .filter(([, v]) => {
      const s = asText(v).toLowerCase();
      const forms = [s, encodeURIComponent(s).toLowerCase(), encodeURIComponent(s).replace(/%20/g, "+").toLowerCase()];
      return s.length >= 3 && forms.some((f) => text.includes(f));
    })
    .map(([k]) => k);
}

/**
 * The site a trigger learns into by default: a site this machine has on that host (its session is
 * there), else the name the registry already serves the domain under (a seed's: goodreads.com is
 * goodreads), else a new one named as the registry names it (`slugOf`: crates.io is crates-io).
 */
async function defaultSiteName(trigger: string, registryName: () => Promise<string | undefined>): Promise<string> {
  const found = resolveLoginTarget(trigger).site;
  if (loadSite(found)) return found;
  const host = new URL(trigger).hostname;
  const domain = siteOf(host);
  const shared = await registryName();
  const taken = shared && loadSite(shared)?.site;
  return safeName(shared && !(taken && siteOf(new URL(taken.baseUrl).hostname) !== domain) ? shared : slugOf(host));
}

const HOLE = /^\{(\w+)\}$/;

/** A page URL as its parts in order: host (no www.), each path segment, each query key; placeholders kept. */
function parts(url: string): [string, string][] | undefined {
  const dec = (v: string) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  try {
    const u = new URL(url);
    return [
      ["host", u.hostname.toLowerCase().replace(/^www\./, "")],
      ...u.pathname
        .split("/")
        .filter(Boolean)
        .map((v, i): [string, string] => [`path ${i}`, dec(v)]),
      ...[...u.searchParams]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]): [string, string] => [`query ${k}`, v]),
    ];
  } catch {
    return undefined;
  }
}

/**
 * `args` by `op`'s param names when its trigger is the same page as `trigger`: placeholders at the same
 * places, whatever their names, and every other part the same. Undefined when it is another page, or
 * the args leave a required param unset or name one the op lacks.
 */
export function sameTrigger(op: Operation, trigger: string, args: Args): Args | undefined {
  const a = parts(op.trigger.url);
  const b = parts(trigger);
  if (!a || !b || a.length !== b.length) return undefined;
  const names: Record<string, string> = {};
  for (const [i, [k, v]] of a.entries()) {
    const [k2, v2] = b[i]!;
    const [p, q] = [HOLE.exec(v), HOLE.exec(v2)];
    if (k !== k2 || !p !== !q) return undefined;
    if (p && q) names[q[1]!] = p[1]!;
    else if (v !== v2) return undefined;
  }
  const out: Args = {};
  for (const [k, v] of Object.entries(args)) {
    const to = names[k] ?? k;
    if (!op.params.some((x) => x.name === to)) return undefined;
    out[to] = v;
  }
  return op.params.some((x) => x.required && out[x.name] === undefined && x.default === undefined) ? undefined : out;
}

/** A captured request as an op with no slots yet, for `notARead`. */
const asRequest = (e: Exchange) => ({
  request: { method: e.request.method, url: e.request.url, headers: e.request.headers, body: e.request.body },
  slots: [],
  params: [],
});

function checkArgs(input: LearnSiteInput): string | undefined {
  const keys = (a: Args) => Object.keys(a).sort().join(",");
  if (!Object.keys(input.args ?? {}).length)
    return "args is empty: give the value(s) the user asked for, by param name";
  for (const [label, a] of [
    ["args2", input.args2],
    ["args3", input.args3],
  ] as const) {
    if (!a || keys(a) !== keys(input.args)) return `${label} must set the same params as args (${keys(input.args)})`;
  }
  const same = (a: Args, b: Args) => Object.keys(a).every((k) => asText(a[k]) === asText(b[k]));
  if (same(input.args3, input.args) || same(input.args3, input.args2))
    return "args3 must differ from args and args2: it is the holdout, used as neither example";
  return undefined;
}

export async function learnSite(input: LearnSiteInput, o: LearnSiteOptions = {}): Promise<LearnSiteResult> {
  if (input.write)
    return {
      ok: false,
      class: "refused",
      error: "learn_site learns reads only: a write would be sent while it is learned",
      next: "a write is learned with the CLI, which intercepts it: api-anything add <site> <op> --trigger <url> --example k=v --write, run by the user or in your shell",
      nextCall: { action: "report" },
    };
  if (!/^https?:\/\//i.test(input.trigger ?? ""))
    return {
      ok: false,
      error: "trigger must be a full http(s) page URL",
      next: "pass the page URL with {param} placeholders",
    };
  const bad = checkArgs(input);
  if (bad) return { ok: false, error: bad, next: "fix the args and call again", nextCall: { action: "fix_args" } };

  // a page on this machine or the network is never shared: the registry is not asked about it
  let named: Promise<string | undefined> | undefined;
  const registryName = () =>
    (named ??= badAddress(input.trigger)
      ? Promise.resolve(undefined)
      : sharedName(siteOf(new URL(input.trigger).hostname)));
  // setup's question, asked at most once per call and once ever
  let prompted = false;
  const askOnce = async () => {
    if (prompted || loadSettings().askedAt) return;
    prompted = true;
    const yes = await o.consent?.(QUESTION).catch(() => undefined);
    if (yes !== undefined) answerShare(yes);
  };

  // An op someone shared for the same page answers with no browser and nothing learned, and its call's
  // report confirms it. A relearn (captures, a pick or a recipe) wants this run's own choices.
  const relearn =
    input.captures ||
    input.pickRequest !== undefined ||
    input.extract ||
    input.pick?.length ||
    input.html ||
    input.embedded;
  const reused = relearn ? undefined : await reuse(input, await registryName(), askOnce, o);
  if (reused) return reused;

  let site: string;
  try {
    site = input.site ? safeName(input.site) : await defaultSiteName(input.trigger, registryName);
  } catch (e) {
    return { ok: false, error: (e as Error).message, next: "pass site: a short name (letters, digits, . _ -)" };
  }
  const existing = loadSite(site)?.site;
  let op = input.op ?? opName(input.trigger, input.args);
  if (!input.op)
    for (let n = 2; existing?.operations.some((x) => x.name === op && x.trigger.url !== input.trigger); n++)
      op = `${opName(input.trigger, input.args)}${n}`;
  const fail = (error: string, next: string, extra: Partial<LearnSiteResult> = {}): LearnSiteResult => ({
    ok: false,
    site,
    op,
    error,
    next,
    ...extra,
  });

  // the two runs: run 1 is the user's request, run 2 the second example
  let c1: CaptureFile;
  let c2: CaptureFile;
  try {
    if (input.captures) {
      c1 = loadCapture(input.captures[0]);
      c2 = loadCapture(input.captures[1]);
    } else {
      if (!browserAvailable())
        return fail(
          "learning needs a Chromium browser (Google Chrome, Brave, Edge or Chromium), and none is installed",
          "ask the user to install one, or to set API_ANYTHING_BROWSER to any Chromium executable",
          { nextCall: { action: "install_browser" } },
        );
      const url1 = fillTrigger({ url: input.trigger }, input.args).url;
      c1 = await capturePage({ url: url1 });
      const wall = loginWall(c1, url1);
      if (wall)
        return fail(
          `the page landed on a sign-in page (${wall}): the site needs an account`,
          `ask the user to run api-anything login ${site}; then learn again`,
          { nextCall: { action: "login", site }, captures: [c1.id] },
        );
      c2 = await capturePage({ url: fillTrigger({ url: input.trigger }, input.args2).url });
    }
  } catch (e) {
    if (e instanceof ProfileInUse) return fail(e.message, PROFILE_HINT, { nextCall: { action: "retry" } });
    return fail((e as Error).message.split("\n")[0]!, "check the trigger URL, then learn again");
  }
  const captures = [c1.id, c2.id];

  // the request and the recipe: the agent's, else the outline's
  const values = Object.values(input.args).map(asText);
  const ranked = rankCandidates(c1.exchanges, input.args, { pages: pageUrls(c1.exchanges, capturePages(c1)) });
  const exchange = (id: number) => c1.exchanges.find((e) => e.id === id);
  const refusal = (id: number) => notARead(asRequest(exchange(id)!));
  const options: Choice[] = ranked.slice(0, 6).map((c) => ({
    request: c.id,
    method: c.method,
    url: clip(c.url),
    ...(c.contentType ? { type: c.contentType.split(";")[0] } : {}),
    ...(c.hits.length ? { carries: c.hits } : {}),
    ...suggest(exchange(c.id)!, c.hits, values),
  }));
  const given: Recipe = {
    ...(input.extract ? { extract: input.extract } : {}),
    ...(input.pick?.length ? { pick: input.pick } : {}),
    ...(input.html ? { html: input.html } : {}),
    ...(input.embedded ? { embedded: { regex: input.embedded } } : {}),
  };
  const told = Object.keys(given).length > 0;
  let chosen: Choice | undefined;
  if (input.pickRequest !== undefined) {
    const e = exchange(input.pickRequest);
    if (!e)
      return fail(`no request ${input.pickRequest} in run 1 (capture ${c1.id})`, "pick one of alternatives[].request", {
        alternatives: options,
        captures,
        nextCall: { action: "relearn", site, op },
      });
    chosen = options.find((x) => x.request === e.id) ?? {
      request: e.id,
      method: e.request.method,
      url: clip(e.request.url),
      ...suggest(e, [], values),
    };
  } else {
    // a request that is no read is picked only when nothing else would do, and then refused below
    const reads = [...options.filter((x) => !refusal(x.request)), ...options.filter((x) => refusal(x.request))];
    chosen = told
      ? (reads.find((x) => resolves(given, exchange(x.request)?.response?.body)) ?? reads[0])
      : reads.find((x) => x.recipe);
  }
  const page = c1.exchanges.filter((e) => e.resourceType === "document" && e.response).at(-1)?.response;
  const wall = page && botWall({ status: page.status, headers: page.headers, body: page.body ?? "" });
  if (!chosen && wall)
    return fail(
      `the site served a bot challenge (${wall})`,
      `ask the user to run api-anything login ${site} --window and clear it; then learn again`,
      { captures, nextCall: { action: "login", site, mode: "window" } },
    );
  if (!chosen && page && page.status >= 400)
    return fail(
      `the page answered HTTP ${page.status}`,
      page.status === 429 ? "the site is rate limiting: wait a few minutes, then learn again" : "check the trigger URL",
      { captures, nextCall: page.status === 429 ? { action: "retry" } : { action: "fix_args" } },
    );
  if (!chosen)
    return fail(
      "no request in run 1 carries the example values in an answer that could be read: the data may need a click, a login, or other example values",
      "look at alternatives, then learn again with captures (no browser), pickRequest and a recipe (extract and pick, html, or embedded)",
      { alternatives: options, captures, nextCall: { action: "relearn", site, op } },
    );
  const recipe = told ? given : (chosen.recipe ?? {});
  const alternatives = options.filter((x) => x.request !== chosen.request).slice(0, 5);
  const shown = { ...chosen, recipe, auto: input.pickRequest === undefined && !told };
  // Before anything is sent: a write saved as a read would be sent by the holdout call and the clean
  // replay, and by every call after. The rules about params are asked again once it is learned.
  const notRead = (why: string) =>
    fail(
      `${why}. learn_site learns reads only, and sent nothing`,
      "pick a request from alternatives that reads; a write is learned with the CLI, which intercepts it: api-anything add <site> <op> --trigger <url> --example k=v --write, run by the user",
      { class: "refused", chosen: shown, alternatives, captures, nextCall: { action: "relearn", site, op } },
    );
  const early = refusal(chosen.request);
  if (early)
    return notRead(`request ${chosen.request} (${chosen.method} ${chosen.url.split("?")[0]}) is not a read: ${early}`);

  // add, with the same functions, credential checks and refusals
  const warnings: string[] = [];
  const mentions =
    input.intent && values.some((v) => v.length >= 3 && input.intent!.toLowerCase().includes(v.toLowerCase()));
  if (mentions)
    warnings.push("intent holds one of the user's values, so it is not the op's description (that is shared)");
  let added: Awaited<ReturnType<typeof addOperation>>;
  try {
    added = await addOperation({
      site,
      op,
      trigger: { url: input.trigger },
      examples: [input.args, input.args2],
      ...(input.intent && !mentions ? { description: input.intent } : {}),
      response: recipe,
      from: { capture: c1, id: chosen.request },
      from2: c2,
      readsOnly: true,
    });
  } catch (e) {
    const m = (e as Error).message.split("\n")[0]!;
    if (e instanceof NotARead) return notRead(m);
    const login = /api-anything login/.test(m);
    return fail(
      m,
      login
        ? `ask the user to run api-anything login ${site}; then learn again`
        : "learn again with captures (no browser) and another pickRequest from alternatives, or a recipe",
      {
        chosen: shown,
        alternatives,
        captures,
        nextCall: login ? { action: "login", site } : { action: "relearn", site, op },
      },
    );
  }
  warnings.push(...added.warnings);

  // the user's answer, from run 1
  const res = exchange(chosen.request)!.response!;
  const j = judge(added.operation, {
    status: res.status,
    headers: res.headers,
    body: res.body ?? "",
    url: exchange(chosen.request)!.request.url,
  });
  if (j.class !== "ok" || empty(j.data))
    return fail(
      `the op was saved, but on run 1's answer it reads ${j.class === "ok" ? "no data" : `${j.class}: ${j.reason}`}`,
      "learn again with captures (no browser) and another pickRequest from alternatives, or a recipe",
      { chosen: shown, alternatives, captures, warnings, nextCall: { action: "relearn", site, op } },
    );
  const answer = capOutput(j.data);

  // the shared example is args2, never the user's own request
  const saved = updateSite(site, (cur) => ({
    ...cur!,
    operations: cur!.operations.map((x) => {
      if (x.name !== op) return x;
      try {
        return asExample(x, input.args2);
      } catch {
        return x; // the user's values stay, and `revealed` keeps it from being shared
      }
    }),
  }));

  const holdout = await call(site, op, input.args3, { minIntervalMs: o.minIntervalMs });
  const held = holdout.ok && !empty(holdout.data);
  const check = CheckSchema.safeParse({
    args: input.args3,
    expect: "result",
    purpose: HOLDOUT_PURPOSE,
  });
  if (held && check.success)
    updateSite(site, (cur) => ({
      ...cur!,
      operations: cur!.operations.map((x) => {
        if (x.name !== op) return x;
        const key = JSON.stringify(Object.entries(check.data.args).sort());
        const rest = (x.checks ?? []).filter((c) => JSON.stringify(Object.entries(c.args).sort()) !== key);
        return { ...x, checks: [...rest, check.data] };
      }),
    }));
  else if (held)
    warnings.push("args3 has a value that is not text, a number or a boolean, so it is not kept as a check");

  const now = loadSite(site)!.site.operations.find((x) => x.name === op)!;
  // a minTier 3 op needs the page for every call: plain HTTP says nothing about whether it is public
  const clean =
    now.minTier > 1 ? undefined : await cleanCall(now, input.args2, { site, minIntervalMs: o.minIntervalMs });
  const cleanReplay: Evidence["cleanReplay"] = !clean
    ? "skipped"
    : clean.class === "ok" || clean.class === "blocked"
      ? clean.class
      : "failed";

  const proof: NonNullable<LearnSiteResult["proof"]> = {
    holdout: {
      args: input.args3,
      ok: held,
      class: holdout.ok && !held ? "empty" : holdout.class,
      ...(holdout.tier ? { tier: holdout.tier } : {}),
      ...(!held && holdout.reason ? { reason: holdout.reason } : {}),
    },
    cleanReplay,
    ...(clean && clean.class !== "ok" ? { cleanReason: clean.reason } : {}),
  };
  const proven: Proof = {
    learnedLoggedIn: now.learnedLoggedIn,
    cleanReplay,
    holdout: { args: input.args3, ok: true, ...(holdout.tier ? { tier: holdout.tier } : {}) },
    ...(holdout.tier ? { tier: holdout.tier } : {}),
  };
  // The holdout was the check's case: with no other check, publish needs no verify first, and sends
  // what this run proved when the user shares it later.
  if (held && check.success && now.checks?.length === 1)
    recordCases(
      site,
      now,
      [
        {
          op,
          case: "check 1",
          expect: "result",
          outcome: "pass",
          got: "result",
          args: check.data.args,
          purpose: HOLDOUT_PURPOSE,
          ...(holdout.tier ? { tier: holdout.tier } : {}),
          ...(holdout.healed ? { healed: true } : {}),
          ms: holdout.ms,
        },
      ],
      proven,
    );

  let shared: ShareOutcome;
  let next: string | undefined;
  const reveals = revealed(now, input.args);
  if (!held) {
    shared = { site, op, shared: false, reason: "the holdout call did not answer with data" };
    next = `it answered the user's request, but not args3: if args3 has results on the site, the op may be wrong; learn again with captures ${captures.join(" ")} and another pickRequest or recipe`;
  } else if (reveals.length) {
    shared = {
      site,
      op,
      shared: false,
      reason: `the learned request keeps the user's ${reveals.join(", ")} literally, so sharing it would say what they asked`,
    };
  } else {
    const evidence: Partial<Evidence> = { clientVersion: VERSION, ...proven };
    // the user has their answer whatever sharing does
    const share = async (consent?: true): Promise<ShareOutcome> => {
      try {
        const [one] = await hooks.share(site, [op], { evidence, ...(consent ? { consent } : {}) });
        return one ?? { site, op, shared: false, reason: "sharing answered nothing" };
      } catch (e) {
        return { site, op, shared: false, reason: (e as Error).message.split("\n")[0] };
      }
    };
    // the first time something could be shared, setup's question is asked if it never was
    await askOnce();
    shared = await share();
    const publish = `api-anything publish ${site} ${op} --yes`;
    if (shared.needsConsent) {
      const found = shared.personal?.length ? shared.personal : undefined;
      const yes = await o
        .consent?.(
          `${site} ${op} ${shared.reason ? `(${shared.reason}) ` : ""}works. Share it with the api-anything catalog? Anyone can then fetch the request's shape and the example values ${JSON.stringify(input.args2)} and ${JSON.stringify(input.args3)}; your cookies and session values are never sent.${found ? ` Check first, it may hold something of yours: ${found.join("; ")}.` : ""}`,
        )
        .catch(() => undefined);
      if (yes) shared = await share(true);
      else if (yes === undefined)
        next = `ask the user whether to share ${op} with the catalog (${shared.reason ?? "it needs their yes"})${found ? `, showing them what may be theirs: ${found.join("; ")}` : ""}; only on their yes, run: ${publish}`;
    }
    if (!shared.shared && !loadSettings().askedAt) {
      next = next
        ? `${next}. ${ASK}`
        : shared.reason?.startsWith("refused")
          ? ASK
          : `${ASK}. On yes, also share ${op}: ${publish}`;
    }
  }

  return {
    ok: true,
    site,
    op,
    signature: summarize(now).op,
    data: answer.data,
    ...(answer.truncated ? { truncated: answer.truncated } : {}),
    chosen: shown,
    alternatives,
    proof,
    shared,
    warnings,
    captures,
    saved,
    ...(next ? { next } : {}),
  };
}
