/** Classify every response, never by status code alone. See DESIGN.md "Failure classifier". */
import { extract, extractHtml, getPath, inferShape, parseBody } from "./extract.js";
import type { Operation } from "./spec.js";

export type Class = "ok" | "drift" | "auth" | "rate" | "blocked" | "input" | "error";
export interface Classified {
  class: Class;
  reason: string;
  /**
   * drift only: the response came back fine but without the data (extract path, selector or
   * embedded JSON missing). Bad args ("no such user") look the same, so the caller checks the
   * example args before healing.
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

const CHALLENGES: [string, RegExp][] = [
  ["Cloudflare", /<title>Just a moment\.\.\.<\/title>|cf-chl-|challenges\.cloudflare\.com|_cf_chl_opt|Attention Required! \| Cloudflare/i],
  ["Akamai", /bm-verify|\/_sec\/cp_challenge|errors\.edgesuite\.net/i],
  ["DataDome", /captcha-delivery\.com|datadome/i],
  ["PerimeterX", /px-captcha|_pxAppId|perimeterx|Press & Hold/i],
  ["reCAPTCHA", /google\.com\/recaptcha|g-recaptcha|hcaptcha\.com|Prove your humanity/i],
];

const LOGIN =
  /"require_login"\s*:\s*true|login_required|not logged in|(log|sign) ?in to continue|please (log|sign) ?in|authentication required|bad authentication|could not authenticate|bad guest token|invalid session|session (has )?expired|type=["']password["']|accounts\.google\.com\/ServiceLogin/i;
const LOGIN_URL = /\/(login|signin|sign_in|sign-in|accounts\/login|i\/flow\/login|onboarding)(\/|$|\?)/i;
const RATE = /rate.?limit|too many requests|please wait a few minutes|slow down/i;
const DRIFT =
  /PersistedQueryNotFound|persisted query not found|must be defined|cannot be null|query not found|unknown (field|argument|operation)|cannot query field/i;

const ok = (reason = "ok"): Classified => ({ class: "ok", reason });
const is = (c: Class, reason: string): Classified => ({ class: c, reason });
const missing = (reason: string): Classified => ({ class: "drift", reason, missing: true });
const CSRF = /csrf|xsrf/i;
// Instagram sends "require_login": false on its rate-limit answers, so the key alone means nothing.
const REQUIRE_LOGIN = /"require_login"\s*:\s*true|login_required/i;
const snippet = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);

function challenge(body: string): string | undefined {
  const head = body.slice(0, 200_000);
  return CHALLENGES.find(([, re]) => re.test(head))?.[0];
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
    const last = s.at[s.at.length - 1]!;
    names.add(last.slice(last.lastIndexOf(last.startsWith("json:") ? "/" : ":") + 1));
  }
  return [...names].some((n) => n && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(body));
}

export function classify(op: Operation, r: Observed): Classified {
  const body = r.body ?? "";
  const ct = (r.headers["content-type"] ?? "").toLowerCase();
  const isHtml = ct.includes("html") || /^\s*<(!doctype|html)/i.test(body);
  const wantsJson = op.response.format === "json";

  if (r.headers["cf-mitigated"] === "challenge") return is("blocked", "Cloudflare challenge (cf-mitigated)");
  // A real HTML page may mention recaptcha in a login form; challenge pages are small or non-2xx.
  if (r.status >= 400 || (isHtml && (wantsJson || body.length < 64_000))) {
    const vendor = challenge(body);
    if (vendor) return is("blocked", `${vendor} challenge page (HTTP ${r.status})`);
  }

  if (r.status === 429) return is("rate", "HTTP 429");
  if (r.status >= 400 && REQUIRE_LOGIN.test(body)) return is("auth", `HTTP ${r.status}: ${snippet(body)}`);
  if (r.status >= 400 && RATE.test(body)) return is("rate", `HTTP ${r.status}: ${snippet(body)}`);
  if (r.status === 401) return is("auth", `HTTP 401: ${snippet(body)}`);
  if (r.status === 403) {
    return LOGIN.test(body) || CSRF.test(body)
      ? is("auth", `HTTP 403 with login markers: ${snippet(body)}`)
      : is("blocked", `HTTP 403 without login markers (likely a bot wall): ${snippet(body)}`);
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
    if (!op.slots.some((s) => s.param && s.at[0]!.startsWith("path:"))) return is("drift", `HTTP ${r.status} on a templated API path`);
    return op.volatile.some((v) => v.at[0]!.startsWith("path:")) ? missing(`HTTP ${r.status}`) : is("input", `HTTP ${r.status}: not found`);
  }
  if (r.status === 400) {
    if (DRIFT.test(body)) return is("drift", `HTTP 400 schema error: ${snippet(body)}`);
    if (LOGIN.test(body)) return is("auth", `HTTP 400 with login markers: ${snippet(body)}`);
    if (mentionsParam(op, body)) return is("input", `HTTP 400: ${snippet(body)}`);
    return is("error", `HTTP 400: ${snippet(body)}`);
  }
  if (r.status < 200 || r.status >= 300) return is("error", `HTTP ${r.status}: ${snippet(body)}`);

  if (op.response.format === "html") {
    if (!op.response.html) return ok();
    if (extractHtml(body, op.response.html).length) return ok();
    return LOGIN.test(body) ? is("auth", "login page instead of content") : missing(`selector "${op.response.html.items}" matched nothing`);
  }
  if (op.response.format === "embedded") {
    if (extract(op.response, body) !== undefined) return ok();
    return LOGIN.test(body) ? is("auth", "login page instead of content") : missing("embedded data not found");
  }

  let data: unknown;
  try {
    data = parseBody(body, op.response.xssiPrefix);
  } catch {
    if (isHtml && LOGIN.test(body)) return is("auth", "HTML login page where JSON was expected");
    // A 2xx to a write means the server took it; many answer 204, "OK" or an HTML page.
    if (!op.readOnly) return ok(`HTTP ${r.status}, ${body.trim() ? "non-JSON body" : "empty body"}`);
    return is("drift", isHtml ? "HTML where JSON was expected" : `response is not JSON: ${snippet(body)}`);
  }
  const d = data as { errors?: unknown; data?: unknown } | null;
  if (d && typeof d === "object" && Array.isArray(d.errors) && d.errors.length && d.data == null) {
    const msg = d.errors.map((e) => (e as { message?: unknown })?.message ?? JSON.stringify(e)).join("; ");
    if (DRIFT.test(msg)) return is("drift", `GraphQL: ${snippet(msg)}`);
    if (LOGIN.test(msg)) return is("auth", `GraphQL: ${snippet(msg)}`);
    if (RATE.test(msg)) return is("rate", `GraphQL: ${snippet(msg)}`);
    return is("error", `GraphQL errors with null data: ${snippet(msg)}`);
  }
  let gone: string | undefined;
  if (op.response.extract && getPath(data, op.response.extract) === undefined) gone = `extract path "${op.response.extract}" missing`;
  else if (op.response.shape && Object.keys(op.response.shape).length >= 4 && shapeKept(op.response.shape, data) < 0.5) {
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
