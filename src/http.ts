/** Tier 1: fill the stored template and send it with Node fetch. */
import { asText, fillSlotTemplate, setAt, templateRefs, walk } from "./codec.js";
import { cookieHeaderFor, cookieValue, parseSetCookie, type Session } from "./cookies.js";
import type { StoredCookie } from "./types.js";
import type { Operation, Param, Request } from "./spec.js";

export interface Sent {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** final URL after redirects */
  url: string;
  ms: number;
  /** the first answer was a redirect: the server took the request (a write's POST ran) */
  redirected?: boolean;
  /** cookies the answers set (every hop), for the jar */
  setCookies?: StoredCookie[];
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
    if (p.pattern !== undefined && !new RegExp(`^(?:${p.pattern})$`).test(asText(vals[p.name]))) {
      throw new Error(`param "${p.name}" must be ${p.hint ?? `a value matching /${p.pattern}/`}, got ${JSON.stringify(v)}`);
    }
  }

  let req: Request = { ...op.request, method: op.request.method.toUpperCase(), headers: { ...op.request.headers } };
  let leafTypes: Map<string, string> | undefined;
  const stringLeaf = (at: string[]) => (leafTypes ??= new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]))).get(JSON.stringify(at)) === "string";
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
    if (slot.template !== undefined) {
      // A Referer/Origin is a URL: specs learned before `escape` existed still get the arg percent-encoded.
      const escape = slot.escape ?? (slot.param && /^header:(referer|origin)$/i.test(slot.at[0]!) ? "url" : undefined);
      const refs = Object.fromEntries(templateRefs(slot.template).map((r) => [r, resolveRef(r, session, op.request.url) ?? ""]));
      v = fillSlotTemplate(slot.template, { ...refs, ...vals, [name]: v }, escape);
    } else if (typeof v !== "string" && typeof v !== "object" && slot.at.at(-1)!.startsWith("json:") && stringLeaf(slot.at)) {
      // the same number can sit in a JSON string ("id":"12345") and a JSON number (ids:[12345]); each leaf keeps its type
      v = asText(v);
    }
    req = setAt(req, slot.at, v);
  }

  // Header values must be bytes: a value that is not ASCII goes percent-encoded, as a browser sends a URL.
  for (const [k, h] of Object.entries(req.headers)) if (/[^\x00-\x7f]/.test(h)) req.headers[k] = h.replace(/[^\x00-\x7f]+/g, encodeURIComponent);
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
  const inHeader = (s: Operation["slots"][number]) => s.at.length === 1 && s.at[0]!.startsWith("header:");
  const holdsRef = (s: Operation["slots"][number]) => !!s.ref || (s.template !== undefined && templateRefs(s.template).length > 0);
  const secret = new Set(["authorization", "cookie", ...op.slots.flatMap((s) => (holdsRef(s) && inHeader(s) ? [s.at[0]!.slice(7).toLowerCase()] : []))]);
  // session/cookie values the body or query carry: no other origin may receive them
  const carried = op.slots.flatMap((s) => {
    if (inHeader(s)) return [];
    const refs = s.template !== undefined ? [...new Set([...(s.ref ? [s.ref] : []), ...templateRefs(s.template)])] : s.ref ? [s.ref] : [];
    return refs.flatMap((r) => {
      const v = resolveRef(r, session, op.request.url);
      return v && v.length >= 4 ? [s.ref === r ? transform(v, s.transform) : v] : [];
    });
  });
  const leaks = (target: string, sentBody?: string) =>
    carried.some((v) => [v, encodeURIComponent(v)].some((x) => target.includes(x) || !!sentBody?.includes(x)));
  let { url, method, headers } = req;
  let body = method === "GET" || method === "HEAD" ? undefined : req.body;
  const t0 = performance.now();
  // Cookies set along the way (a consent or session bootstrap hop) ride on the next hop, as in a browser.
  let jar = session.cookies;
  const setCookies: StoredCookie[] = [];
  let redirected: boolean | undefined;
  try {
    for (let hops = 0; ; hops++) {
      const res = await (opts.fetchImpl ?? fetch)(url, { method, headers, body, redirect: "manual", signal });
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const c = parseSetCookie(line, url);
        if (!c) continue;
        setCookies.push(c);
        jar = [...jar.filter((x) => !(x.name === c.name && x.domain.toLowerCase() === c.domain.toLowerCase() && x.path === c.path)), c];
      }
      const location = res.headers.get("location");
      redirected ??= REDIRECT.has(res.status) && !!location;
      if (REDIRECT.has(res.status) && location && hops < 5) {
        await res.body?.cancel();
        const next = new URL(location, url);
        const cross = next.origin !== new URL(url).origin;
        headers = Object.fromEntries(Object.entries(headers).filter(([k]) => k !== "cookie" && !(cross && secret.has(k.toLowerCase()))));
        const cookie = cookieHeaderFor(jar, next.href);
        if (cookie) headers.cookie = cookie;
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
          headers = Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "content-type"));
        }
        // A 307/308 resends the body; a location may copy the query. Neither may carry a credential elsewhere.
        if (cross && leaks(next.href, body)) {
          throw new Error(`not following the HTTP ${res.status} redirect to ${next.origin}: the request would carry this session's values to another origin`);
        }
        url = next.href;
        continue;
      }
      const text = decodeBody(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type") ?? "");
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: text,
        url: res.url || url,
        ms: Math.round(performance.now() - t0),
        ...(redirected ? { redirected } : {}),
        ...(setCookies.length ? { setCookies } : {}),
      };
    }
  } catch (e) {
    if ((e as Error).name === "TimeoutError") throw new Error(`${op.name}: no response within ${timeoutMs} ms`);
    // "fetch failed" alone can't tell a refused connection from DNS or TLS: name the cause
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    if (cause && (e as Error).message === "fetch failed") throw new Error(`fetch failed: ${cause.code ?? cause.message}${cause.code && cause.message ? ` (${cause.message})` : ""}`);
    throw e;
  }
}

/** Decode with the declared charset (header, else an HTML <meta>), else UTF-8. A BOM is dropped. */
export function decodeBody(buf: Uint8Array, contentType: string): string {
  let charset = /charset=["']?([\w.:-]+)/i.exec(contentType)?.[1];
  if (!charset && /html/i.test(contentType)) charset = /<meta[^>]+charset=["']?([\w.:-]+)/i.exec(new TextDecoder("latin1").decode(buf.subarray(0, 2048)))?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(buf);
  } catch {
    return new TextDecoder().decode(buf);
  }
}
