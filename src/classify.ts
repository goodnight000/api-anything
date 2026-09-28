/** Classify every response, never by status code alone. See DESIGN.md "Failure classifier". */
import { parse as parseHtml } from "node-html-parser";
import { extract, extractHtml, getPath, inferShape, parseBody } from "./extract.js";
import type { Operation } from "./spec.js";

export type Class = "ok" | "drift" | "auth" | "rate" | "blocked" | "input" | "error";
export interface Classified {
  class: Class;
  reason: string;
  /**
   * drift: the response came back fine but without the data (extract path, selector or embedded
   * JSON missing). blocked: a bare 403 with no wall or login markers, which is also how a site
   * refuses one entity ("This profile can't be accessed"). Bad args look the same either way, so
   * the caller checks the example args before healing or climbing tiers.
   */
  missing?: boolean;
}
export interface Observed {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** final URL after redirects, when known */
  url?: string;
}

// [vendor, interstitial, integration]. The interstitial pattern is the challenge page's own
// structure. The integration pattern is a script a vendor also puts on ordinary pages (AWS WAF's
// challenge.js SDK, DataDome's tags.js, Imperva's resource script): it only counts on an answer
// whose status is a challenge's own.
const CHALLENGES: [string, RegExp | undefined, RegExp?][] = [
  ["Cloudflare", /<title>Just a moment\.\.\.<\/title>|cf-chl-|_cf_chl_opt|Attention Required! \| Cloudflare/i, /challenges\.cloudflare\.com/i],
  ["Akamai", /bm-verify|\/_sec\/cp_challenge|errors\.edgesuite\.net/i],
  ["DataDome", /captcha-delivery\.com/i, /datadome/i],
  ["PerimeterX", /px-captcha|Press & Hold/i, /_pxAppId|perimeterx/i],
  ["AWS WAF", /awsWafCookieDomainList|gokuProps|<title>Human Verification<\/title>/i, /AwsWafIntegration|\.awswaf\.com|\/__challenge_[\w-]+\/[^"']*challenge\.js/i],
  ["Amazon", /automated access to Amazon data|\/errors\/validateCaptcha/i],
  ["Imperva", /Incapsula incident/i, /_Incapsula_Resource/i],
  ["Kasada", undefined, /\/[0-9a-f]{8}-[0-9a-f-]{27}\/[0-9a-f]{8}-[0-9a-f-]{27}\/ips\.js/i],
  // a proof-of-work page that solves itself and resubmits (Reddit)
  ["JS challenge", /name=["']?js_challenge|[?&]js_challenge=1/i],
  ["reCAPTCHA", /google\.com\/recaptcha|g-recaptcha|hcaptcha\.com|Prove your humanity/i],
];
// What bot walls answer with: 202 (AWS WAF's JS challenge), 403, 405 (AWS WAF's CAPTCHA), 429, 503.
const CHALLENGE_STATUS = new Set([202, 403, 405, 429, 503]);
// An interstitial's title gives it away even when the page is too big for the body scan.
const CHALLENGE_TITLE = /<title[^>]*>[^<]*(prove your humanity|human verification|just a moment|attention required|are you a (human|robot)|verify you are (a )?human|robot check)/i;

// What a server says when the session is missing, as opposed to a page that shows a password field.
const LOGIN_SAID =
  /"require_login"\s*:\s*true|login_required|not logged in|(log|sign) ?in to continue|please (log|sign) ?in|authentication required|bad authentication|could not authenticate|bad guest token|invalid session|session (has )?expired/i;
const LOGIN = new RegExp(`${LOGIN_SAID.source}|type=["']password["']|accounts\\.google\\.com\\/ServiceLogin`, "i");
/** A sign-in form: a password field next to a username field, a current-password hint, or a form posting to a login path. */
const signInForm = (body: string) =>
  /type=["']?password/i.test(body) &&
  /<input[^>]*name=["']?(user(name)?|e-?mail|login|session_key)\b|autocomplete=["']?(current-password|username)|<form[^>]*action=["']?[^"'>\s]*(log_?in|sign_?in|sign-in|session)/i.test(body);
const LOGIN_URL = /\/(login|signin|sign_in|sign-in|accounts\/login|i\/flow\/login|onboarding|ServiceLogin)(\/|$|\?)/i;
/**
 * A document that is a login page. Only what the page says or shows counts: every logged-out page
 * can link a sign-in page (Google's Sign-in button goes to ServiceLogin), and a login redirect is
 * judged by the final URL.
 */
const loginPage = (body: string) => LOGIN_SAID.test(body) || signInForm(body);
const RATE = /rate.?limit|too many requests|please wait a few minutes|slow down/i;
const DRIFT =
  /PersistedQueryNotFound|persisted query not found|must be defined|cannot be null|query not found|unknown (field|argument|operation)|cannot query field/i;

const ok = (reason = "ok"): Classified => ({ class: "ok", reason });
const is = (c: Class, reason: string): Classified => ({ class: c, reason });
const missing = (reason: string): Classified => ({ class: "drift", reason, missing: true });
// A CSRF *failure*, not a page that merely carries a token (every server-rendered form has a
// csrf-token meta or a csrfmiddlewaretoken field). The gap stays inside one message: no quote or tag.
const CSRF_FAILED =
  /(csrf|xsrf)[^"<>\n]{0,40}?(missing|invalid|mismatch|incorrect|expired|fail|not (set|found|valid|match))|(invalid|missing|bad|expired|can'?t verify|could not verify|requires? an? (valid|matching))[^"<>\n]{0,30}?(csrf|xsrf|authenticity)|InvalidAuthenticityToken/i;
// Instagram sends "require_login": false on its rate-limit answers, so the key alone means nothing.
const REQUIRE_LOGIN = /"require_login"\s*:\s*true|login_required/i;
const snippet = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);

function challenge(body: string, status: number): string | undefined {
  const head = body.slice(0, 200_000);
  return CHALLENGES.find(([, page, sdk]) => !!page?.test(head) || (CHALLENGE_STATUS.has(status) && !!sdk?.test(head)))?.[0];
}

/**
 * The bot wall this response is, if any ("Cloudflare challenge page (HTTP 403)"). A real HTML page
 * may mention recaptcha in a login form; challenge pages are small, non-2xx, or where data was expected.
 * `hasData`: the op's recipe finds its data on this page. A title alone ("Robot check-in: how our
 * warehouse robots work") is then an ordinary page; a vendor's interstitial markers still count.
 */
export function botWall(r: Observed, wantsJson = false, hasData?: () => boolean): string | undefined {
  const body = r.body ?? "";
  const ct = (r.headers["content-type"] ?? "").toLowerCase();
  const isHtml = ct.includes("html") || /^\s*<(!doctype|html)/i.test(body);
  if (r.headers["cf-mitigated"] === "challenge") return "Cloudflare challenge (cf-mitigated)";
  // Kasada's headers ride on its sites' ordinary answers too; only its challenge status is a wall.
  if (CHALLENGE_STATUS.has(r.status) && Object.keys(r.headers).some((k) => k.toLowerCase().startsWith("x-kpsdk"))) return `Kasada challenge (HTTP ${r.status})`;
  if (r.status >= 400 || (isHtml && (wantsJson || body.length < 64_000))) {
    const vendor = challenge(body, r.status);
    if (vendor) return `${vendor} challenge page (HTTP ${r.status})`;
  }
  if (isHtml && CHALLENGE_TITLE.test(body.slice(0, 20_000)) && !hasData?.()) return `challenge page (HTTP ${r.status})`;
  return undefined;
}

/** The html/embedded recipe finds data here (a non-empty list, or a value). Never throws. */
function recipeFinds(op: Operation, body: string): boolean {
  try {
    if (op.response.format === "html") return !!op.response.html && extractHtml(body, op.response.html).length > 0;
    if (op.response.format === "embedded") {
      const d = extract(op.response, body);
      return d !== undefined && !(Array.isArray(d) && !d.length);
    }
  } catch {
    /* a bad recipe finds nothing */
  }
  return false;
}

/**
 * An items selector's container: the part before its last compound ("ul.results li.r" -> "ul.results",
 * "#search > div.item" -> "#search"). Undefined for a single compound or a selector list.
 */
function containerOf(selector: string): { container: string; item: string } | undefined {
  selector = selector.trim();
  let depth = 0;
  let quote = "";
  let cut = -1;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i]!;
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (depth === 0 && c === ",") return undefined;
    else if (depth === 0 && /[\s>+~]/.test(c)) cut = i;
  }
  const container = selector.slice(0, cut).replace(/[\s>+~]+$/, "").trim();
  const item = selector.slice(cut + 1).trim();
  return cut > 0 && container && item ? { container, item } : undefined;
}

/**
 * A results page with no results: the items' container is on the page and holds nothing of the
 * items' tag (any element, when the selector names no tag). Items there under another class
 * are a renamed selector (drift), not zero results.
 */
function emptyResults(body: string, items: string): boolean {
  const parts = containerOf(items);
  if (!parts) return false;
  try {
    const box = parseHtml(body).querySelector(parts.container);
    if (!box) return false;
    const tag = /^[a-z][a-z0-9-]*/i.exec(parts.item)?.[0];
    return !box.querySelector(tag ?? "*");
  } catch {
    return false;
  }
}

/** " (retry after 120 s)" from a Retry-After header in seconds or as an HTTP date. */
function retryAfter(headers: Record<string, string>): string {
  const v = headers["retry-after"]?.trim();
  if (!v) return "";
  if (/^\d+$/.test(v)) return ` (the server says retry after ${v} s)`;
  const t = Date.parse(v);
  return Number.isNaN(t) ? "" : ` (the server says retry after ${new Date(t).toISOString()})`;
}

/** A GraphQL errors array's verdict; `input` for a not-found entity. */
function graphqlErrors(errors: unknown[], extra = ""): Classified {
  const msg = errors.map((e) => (e as { message?: unknown })?.message ?? JSON.stringify(e)).join("; ");
  const types = errors.map((e) => String((e as { type?: unknown; extensions?: { code?: unknown } })?.type ?? (e as { extensions?: { code?: unknown } })?.extensions?.code ?? "")).join(" ");
  if (DRIFT.test(msg)) return is("drift", `GraphQL: ${snippet(msg)}`);
  if (LOGIN.test(msg)) return is("auth", `GraphQL: ${snippet(msg)}`);
  if (RATE.test(msg)) return is("rate", `GraphQL: ${snippet(msg)}`);
  if (/NOT_FOUND/i.test(types) || /not found|could not resolve|does not exist|no such/i.test(msg)) return is("input", `GraphQL: ${snippet(msg)}`);
  return is("error", `GraphQL errors${extra}: ${snippet(msg)}`);
}

/** Learned shape and value, scoped to the extract path when it resolves: other subtrees may come and go. */
function shapeScope(op: Operation, data: unknown): { expected: Record<string, string>; value: unknown } {
  const shape = op.response.shape ?? {};
  const ex = op.response.extract;
  if (!ex) return { expected: shape, value: data };
  const prefix = ex.replace(/\[(\d+|\*)\]/g, "[]").replace(/\["((?:[^"\\]|\\.)*)"\]/g, (_m, k: string) => `.${JSON.parse(`"${k}"`) as string}`).replace(/^\./, "");
  const expected: Record<string, string> = {};
  // a trailing [*] returns the items themselves, as a list: compare them as "[]..." like any list
  const items = ex.endsWith("[*]");
  for (const [k, t] of Object.entries(shape)) {
    if (items && (k === prefix || k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}[]`))) expected[`[]${k.slice(prefix.length)}`] = t;
    else if (k.startsWith(`${prefix}.`)) expected[k.slice(prefix.length + 1)] = t;
    else if (k.startsWith(`${prefix}[]`)) expected[k.slice(prefix.length)] = t;
  }
  return { expected, value: getPath(data, ex) };
}

/** Share of the learned shape still present with the same type; null matches anything. */
function shapeKept(expected: Record<string, string>, data: unknown): number {
  const now = inferShape(data, 2000);
  const paths = Object.keys(expected);
  const kept = paths.filter((p) => now[p] !== undefined && (now[p] === expected[p] || now[p] === "null" || expected[p] === "null"));
  return kept.length / paths.length;
}

function mentionsParam(op: Operation, body: string): boolean {
  const names = new Set(op.params.map((p) => p.name));
  for (const s of op.slots) {
    if (!s.param) continue;
    // the nearest named step: json:/legs/0/origin/airports/0 names "airports", not "0"
    const tokens = s.at.flatMap((st) => (st.startsWith("json:") ? st.slice(5).split("/") : [st.slice(st.indexOf(":") + 1)]));
    const name = tokens.reverse().find((t) => t && !/^\d+$/.test(t));
    if (name) names.add(name);
  }
  return [...names].some((n) => n && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body));
}

export function classify(op: Operation, r: Observed): Classified {
  const body = r.body ?? "";
  const ct = (r.headers["content-type"] ?? "").toLowerCase();
  const isHtml = ct.includes("html") || /^\s*<(!doctype|html)/i.test(body);
  const wantsJson = op.response.format === "json";

  const wall = botWall(r, wantsJson, () => recipeFinds(op, body));
  if (wall) return is("blocked", wall);

  const wait = retryAfter(r.headers);
  if (r.status === 429) return is("rate", `HTTP 429${wait}`);
  if (r.status >= 400 && REQUIRE_LOGIN.test(body)) return is("auth", `HTTP ${r.status}: ${snippet(body)}`);
  if (r.status >= 400 && RATE.test(body)) return is("rate", `HTTP ${r.status}${wait}: ${snippet(body)}`);
  // Laravel answers a stale CSRF token with 419, Rails with 422 InvalidAuthenticityToken.
  if (r.status === 419 || ((r.status === 400 || r.status === 422) && CSRF_FAILED.test(body))) {
    return is("auth", `HTTP ${r.status}: CSRF check failed: ${snippet(body)}`);
  }
  if (r.status === 401) return is("auth", `HTTP 401: ${snippet(body)}`);
  if (r.status === 403) {
    return LOGIN.test(body) || CSRF_FAILED.test(body)
      ? is("auth", `HTTP 403 with login markers: ${snippet(body)}`)
      : { ...is("blocked", `HTTP 403 with no login or challenge markers: ${snippet(body)}`), missing: true };
  }
  if (r.url) {
    try {
      const u = new URL(r.url);
      if (LOGIN_URL.test(u.pathname) && !LOGIN_URL.test(new URL(op.request.url).pathname)) {
        return is("auth", `redirected to ${u.pathname}`);
      }
    } catch {
      /* not a URL; ignore */
    }
  }
  if (r.status === 404 || r.status === 410) {
    // With the param in the path, 404 usually means that entity doesn't exist. With a rotating id
    // in the path too (Next.js /_next/data/<buildId>/...), it may be a deploy: let the caller check.
    // A read's 404 is ambiguous either way (/api/user?name=nosuch): the example args tell.
    if (!op.slots.some((s) => s.param && s.at[0]!.startsWith("path:"))) {
      return op.readOnly ? missing(`HTTP ${r.status} on a templated API path`) : is("drift", `HTTP ${r.status} on a templated API path`);
    }
    return op.volatile.some((v) => v.at[0]!.startsWith("path:")) ? missing(`HTTP ${r.status}`) : is("input", `HTTP ${r.status}: not found`);
  }
  if (r.status === 400) {
    if (DRIFT.test(body)) return is("drift", `HTTP 400 schema error: ${snippet(body)}`);
    // a 400 form page (a signup's "username taken") shows a password field; only the wording counts
    if (LOGIN_SAID.test(body)) return is("auth", `HTTP 400 with login markers: ${snippet(body)}`);
    if (mentionsParam(op, body)) return is("input", `HTTP 400: ${snippet(body)}`);
    return is("error", `HTTP 400: ${snippet(body)}`);
  }
  if (r.status < 200 || r.status >= 300) return is("error", `HTTP ${r.status}: ${snippet(body)}`);

  let data: unknown;
  try {
    data = parseBody(body, op.response.xssiPrefix);
  } catch {
    if (!op.readOnly) {
      if (isHtml && !/html/i.test(op.response.contentType ?? "") && signInForm(body)) return is("auth", "a sign-in form where the write's answer was expected");
      return ok(`HTTP ${r.status}, ${body.trim() ? "non-JSON body" : "empty body"}`);
    }
    if (wantsJson) {
      if (isHtml && LOGIN.test(body)) return is("auth", "HTML login page where JSON was expected");
      if (!body.trim()) return missing(`HTTP ${r.status} with an empty body`);
      return is("drift", isHtml ? "HTML where JSON was expected" : `response is not JSON: ${snippet(body)}`);
    }
  }
  const d = data as { errors?: unknown; data?: unknown; ok?: unknown; success?: unknown } | null;
  if (!op.readOnly && d && (d.ok === false || d.success === false)) return is("error", "the service rejected the write (ok/success is false)");
  const errors = d && typeof d === "object" && Array.isArray(d.errors) && d.errors.length ? d.errors : undefined;
  if (errors && d!.data == null) return graphqlErrors(errors, " with null data");
  // Partial data: errors next to a null target (a rate limit, a not-found user) are the answer, not a successful null.
  if (errors && op.response.extract && getPath(data, op.response.extract) == null) return graphqlErrors(errors, ` and a null "${op.response.extract}"`);
  if (!op.readOnly) return ok();

  if (op.response.format === "html") {
    if (!op.response.html) return ok();
    if (extractHtml(body, op.response.html).length) return ok();
    if (loginPage(body)) return is("auth", "login page instead of content");
    if (emptyResults(body, op.response.html.items)) return ok("no results");
    return missing(`selector "${op.response.html.items}" matched nothing`);
  }
  if (op.response.format === "embedded") {
    if (extract(op.response, body) !== undefined) return ok();
    return loginPage(body) ? is("auth", "login page instead of content") : missing("embedded data not found");
  }

  // An empty list where the results go is a search with no results, not missing data.
  const target = op.response.extract ? getPath(data, op.response.extract) : data;
  if (Array.isArray(target) && !target.length) return ok("no results");
  let gone: string | undefined;
  const scope = op.response.shape ? shapeScope(op, data) : undefined;
  if (op.response.extract && getPath(data, op.response.extract) === undefined) gone = `extract path "${op.response.extract}" missing`;
  else if (scope && Object.keys(scope.expected).length >= 4 && shapeKept(scope.expected, scope.value) < 0.5) {
    gone = "response shape changed (under half of the learned key paths remain)";
  }
  if (!gone) return ok();
  // Instagram answers "login_required" and "please wait" as 200 JSON; only trust the wording when the data is gone.
  if (REQUIRE_LOGIN.test(body)) return is("auth", `${gone}: ${snippet(body)}`);
  if (RATE.test(body)) return is("rate", `${gone}: ${snippet(body)}`);
  if (LOGIN.test(body)) return is("auth", `${gone}: ${snippet(body)}`);
  return missing(gone);
}

export interface Judged extends Classified {
  /** extracted and picked; only when ok */
  data?: unknown;
}

/** classify, then extract when ok. Never throws: a bad selector or regex in the spec is an error. */
export function judge(op: Operation, r: Observed): Judged {
  let c: Classified;
  try {
    c = classify(op, r);
  } catch (e) {
    return is("error", `the op's response recipe failed: ${(e as Error).message}`);
  }
  if (c.class !== "ok") return c;
  try {
    return { ...c, data: extract(op.response, r.body) };
  } catch (e) {
    // a write's non-JSON answer: hand back its text
    if (!op.readOnly) return { ...c, data: r.body.trim() ? r.body.slice(0, 1000) : null };
    return is("drift", `extract failed: ${(e as Error).message}`);
  }
}
