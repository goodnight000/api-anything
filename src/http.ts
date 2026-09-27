/** Tier 1: fill the stored template and send it with Node fetch. */
import { fillTemplate, setAt } from "./codec.js";
import { cookieHeaderFor, cookieValue, type Session } from "./session.js";
import type { Operation, Param, Request } from "./spec.js";

export interface Sent {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** final URL after redirects */
  url: string;
  ms: number;
}

export interface SendOptions {
  /** pacing key; normally the site name */
  site: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** minimum gap between requests to one site (default 1 s) */
  minIntervalMs?: number;
}

/** Coerce an arg to the param's declared type. Integers past 2^53 become bigint, never a rounded number. */
function coerce(p: Param, v: unknown): unknown {
  const bad = () => new Error(`param "${p.name}" must be ${p.type}, got ${JSON.stringify(v)}`);
  switch (p.type) {
    case "number":
      if (typeof v === "number" || typeof v === "bigint") return v;
      if (typeof v === "string" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) {
        if (/^-?\d+$/.test(v) && !Number.isSafeInteger(Number(v))) return BigInt(v);
        return Number(v);
      }
      throw bad();
    case "boolean":
      if (typeof v === "boolean") return v;
      if (v === "true" || v === "false") return v === "true";
      throw bad();
    case "object":
    case "array":
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        throw bad();
      }
    default:
      return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

function resolveRef(ref: string, session: Session, url: string): string | undefined {
  const i = ref.indexOf(":");
  const name = ref.slice(i + 1);
  return ref.startsWith("cookie:") ? cookieValue(session.cookies, name, url) : session.values[name];
}

function transform(v: string, t: "strip-quotes" | "url-decode" | undefined): string {
  if (t === "strip-quotes") return v.replace(/^"|"$/g, "");
  if (t === "url-decode") {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return v;
}

/** The fully materialized request: params, cookie/session refs, and the jar's Cookie header. */
export function buildRequest(op: Operation, args: Record<string, unknown>, session: Session): Request {
  const vals: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = args[p.name] ?? p.default;
    if (v === undefined) {
      if (p.required) throw new Error(`missing required param "${p.name}"`);
      continue;
    }
    vals[p.name] = coerce(p, v);
  }

  let req: Request = { ...op.request, method: op.request.method.toUpperCase(), headers: { ...op.request.headers } };
  delete req.headers.cookie;
  for (const slot of op.slots) {
    const name = slot.param ?? slot.ref!;
    let v: unknown = slot.param !== undefined ? vals[slot.param] : resolveRef(slot.ref!, session, op.request.url);
    if (v === undefined) {
      // A missing session value: drop the header rather than send it blank.
      const only = slot.at.length === 1 ? slot.at[0]! : "";
      if (slot.ref && only.startsWith("header:")) delete req.headers[only.slice(7).toLowerCase()];
      continue;
    }
    if (slot.ref) v = transform(v as string, slot.transform);
    if (slot.template !== undefined) v = fillTemplate(slot.template, { ...vals, [name]: v });
    req = setAt(req, slot.at, v);
  }

  const cookie = cookieHeaderFor(session.cookies, req.url);
  if (cookie) req.headers.cookie = cookie;
  return req;
}

const lastSend = new Map<string, number>();

/** Reserve the next send slot for a site, then wait for it; concurrent callers queue up. */
async function pace(site: string, minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, (lastSend.get(site) ?? 0) + minIntervalMs);
  lastSend.set(site, at);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

const REDIRECT = new Set([301, 302, 303, 307, 308]);

/**
 * Send the filled template. Redirects are followed by hand (at most 5): on an origin change the
 * credential headers (every ref'd header, authorization, cookie) are dropped, since undici only
 * strips authorization and cookie and would hand a CSRF header to the other origin.
 */
export async function send(op: Operation, args: Record<string, unknown>, session: Session, opts: SendOptions): Promise<Sent> {
  const req = buildRequest(op, args, session);
  await pace(opts.site, opts.minIntervalMs ?? 1000);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const signal = AbortSignal.timeout(timeoutMs);
  const secret = new Set(["authorization", "cookie", ...op.slots.flatMap((s) => (s.ref && s.at.length === 1 && s.at[0]!.startsWith("header:") ? [s.at[0]!.slice(7).toLowerCase()] : []))]);
  let { url, method, headers } = req;
  let body = method === "GET" || method === "HEAD" ? undefined : req.body;
  const t0 = performance.now();
  try {
    for (let hops = 0; ; hops++) {
      const res = await (opts.fetchImpl ?? fetch)(url, { method, headers, body, redirect: "manual", signal });
      const location = res.headers.get("location");
      if (REDIRECT.has(res.status) && location && hops < 5) {
        await res.body?.cancel();
        const next = new URL(location, url);
        const cross = next.origin !== new URL(url).origin;
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "cookie" && !(cross && secret.has(k.toLowerCase()))));
        const cookie = cookieHeaderFor(session.cookies, next.href);
        if (cookie) headers.cookie = cookie;
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
          headers = Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type"));
        }
        url = next.href;
        continue;
      }
      const text = await res.text();
      return { status: res.status, headers: Object.fromEntries(res.headers), body: text, url: res.url || url, ms: Math.round(performance.now() - t0) };
    }
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new Error(`${op.name}: no response within ${timeoutMs} ms`);
    throw e;
  }
}
