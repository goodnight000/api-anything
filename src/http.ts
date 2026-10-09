/** Tier 1: fill the stored template and send it with Node fetch. */
import * as zlib from "node:zlib";
import { asText, fillSlotTemplate, setAt, templateRefs, walk } from "./codec.js";
import { matches } from "./learn.js";
import { cookieHeaderFor, cookieValue, parseSetCookie, type Session } from "./session.js";
import type { Match, Operation, Param, Request } from "./spec.js";
import type { StoredCookie } from "./types.js";

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

/** Whether a decimal or exponent literal's exact value is past the largest safe integer (2^53 - 1) in size. */
function pastSafeInteger(v: string): boolean {
  const [, int = "", frac = "", exp = "0"] = /^-?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(v) ?? [];
  const digits = (int + frac).replace(/^0+/, "");
  const shift = Number(exp) - frac.length;
  // The limit has 16 digits: a value with more is past it, one with fewer is under it, and only 16 needs comparing.
  const places = digits.length + shift;
  if (!digits || places !== 16) return !!digits && places > 16;
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return shift >= 0 ? BigInt(digits) * 10n ** BigInt(shift) > max : BigInt(digits) > max * 10n ** BigInt(-shift);
}

/**
 * Coerce an arg to the param's declared type. A numeric string past the largest safe integer is
 * never rounded: plain digits become a bigint, and any other form is refused.
 */
function coerce(p: Param, v: unknown): unknown {
  const bad = () => new Error(`param "${p.name}" must be ${p.type}, got ${JSON.stringify(v)}`);
  switch (p.type) {
    case "number":
      if (typeof v === "number" || typeof v === "bigint") return v;
      if (typeof v === "string" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) {
        if (!pastSafeInteger(v)) return Number(v);
        if (/^-?\d+$/.test(v)) return BigInt(v);
        // ponytail: also refuses 1e21, which a double holds; parse the exponent into a bigint if that form is needed
        throw new Error(
          `param "${p.name}" would lose precision: ${JSON.stringify(v)} is past 2^53 and would be sent as ${Number(v)}; write the integer as plain digits`,
        );
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

/** A slot a cookie or session value fills, whole or as a hole in its template. */
export const holdsRef = (s: Operation["slots"][number]) =>
  !!s.ref || (s.template !== undefined && templateRefs(s.template).length > 0);

/** The args a call runs with at every tier: a param the caller left out takes its default. */
export function withDefaults(op: Operation, args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = args[p.name] ?? p.default;
    if (v !== undefined) out[p.name] = v;
  }
  return out;
}

/** The fully materialized request: params, cookie/session refs, and the jar's Cookie header. */
export function buildRequest(op: Operation, args: Record<string, unknown>, session: Session): Request {
  const given = withDefaults(op, args);
  const vals: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = given[p.name];
    if (v === undefined) {
      if (p.required) throw new Error(`missing required param "${p.name}"`);
      continue;
    }
    vals[p.name] = coerce(p, v);
    if (p.pattern !== undefined && !new RegExp(`^(?:${p.pattern})$`).test(asText(vals[p.name]))) {
      throw new Error(
        `param "${p.name}" must be ${p.hint ?? `a value matching /${p.pattern}/`}, got ${JSON.stringify(v)}`,
      );
    }
  }

  let req: Request = { ...op.request, method: op.request.method.toUpperCase(), headers: { ...op.request.headers } };
  let leafTypes: Map<string, string> | undefined;
  const stringLeaf = (at: string[]) => {
    leafTypes ??= new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]));
    return leafTypes.get(JSON.stringify(at)) === "string";
  };
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
      const refs = Object.fromEntries(
        templateRefs(slot.template).map((r) => [r, resolveRef(r, session, op.request.url) ?? ""]),
      );
      v = fillSlotTemplate(slot.template, { ...refs, ...vals, [name]: v }, escape);
    } else if (
      typeof v !== "string" &&
      typeof v !== "object" &&
      slot.at.at(-1)!.startsWith("json:") &&
      stringLeaf(slot.at)
    ) {
      // the same number can sit in a JSON string ("id":"12345") and a JSON number (ids:[12345]); each leaf keeps its type
      v = asText(v);
    }
    req = setAt(req, slot.at, v);
  }

  // Header values must be bytes: a value that is not ASCII goes percent-encoded, as a browser sends a URL.
  for (const [k, h] of Object.entries(req.headers))
    if (/[^\x00-\x7f]/.test(h)) req.headers[k] = h.replace(/[^\x00-\x7f]+/g, encodeURIComponent);
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

export const REDIRECT = new Set([301, 302, 303, 307, 308]);
// What describes a body, and goes with it when a redirect makes the request a GET: the Fetch
// standard's request-body header names, and the length.
const BODY_HEADERS = new Set([
  "content-encoding",
  "content-language",
  "content-length",
  "content-location",
  "content-type",
]);

/** How many redirects one request is taken through: what a browser's own fetch allows. */
export const MAX_REDIRECTS = 20;

/**
 * A redirect the policy does not take: nothing was sent to its target. `kind`: it was one too many
 * ("limit"), or it would have sent a write a second time ("again").
 */
export class RedirectRefused extends Error {
  constructor(
    message: string,
    readonly kind?: "limit" | "again",
  ) {
    super(message);
  }
}

/** What tells an op's own request: its `match`, or with none its template's method and address. */
export const ownMatch = (op: Operation): Match =>
  Object.keys(op.match).length
    ? op.match
    : { method: op.request.method, host: new URL(op.request.url).hostname, path: new URL(op.request.url).pathname };

/**
 * The redirect policy of tiers 1 and 2: the request a redirect asks for next, or a refusal.
 * 303 after anything but a GET or HEAD, and 301/302 after a POST, make a bodiless GET. A write is
 * sent once, so no redirect is taken that would send it again: one that keeps its method and body
 * (307, 308; 301/302 after a PUT), or one that leads back to the op's own request. On an origin
 * change the credential headers go (authorization, cookie, every header a ref fills), since neither
 * undici nor a page's fetch() would keep a CSRF header from the other origin. A hop that would
 * still carry a session's value there is not taken: a body it re-sends when any ref slot lives in
 * the body (decided from the slots: a value can sit under any number of encoding layers, so
 * searching the bytes misses it), or a Location that repeats the value of any ref slot, wherever
 * the request carried it. `taken`: the redirects before this one; one past the limit is refused
 * too, saying that it is the limit.
 */
export function nextHop(
  op: Operation,
  session: Session,
  from: Request,
  status: number,
  location: string,
  taken = 0,
): Request {
  const next = new URL(location, from.url);
  if (taken >= MAX_REDIRECTS)
    throw new RedirectRefused(`stopped after ${MAX_REDIRECTS} redirects, the last one to ${next.origin}`, "limit");
  const refused = (why: string) =>
    new RedirectRefused(`not following the HTTP ${status} redirect to ${next.origin}: ${why}`);
  if (!/^https?:$/.test(next.protocol)) throw refused("it is not an http(s) address");
  // The Fetch standard's two cases; a GET stays what it was, headers and all.
  const toGet =
    (status === 303 && from.method !== "GET" && from.method !== "HEAD") ||
    ((status === 301 || status === 302) && from.method === "POST");
  const method = toGet ? "GET" : from.method;
  const carriesOn = !toGet && from.method !== "GET" && from.method !== "HEAD";
  if (!op.readOnly && (carriesOn || matches(ownMatch(op), { url: next.href, method, headers: {} })))
    throw new RedirectRefused(
      `not following the HTTP ${status} redirect to ${next.origin}: it would send this write again`,
      "again",
    );
  const cross = next.origin !== new URL(from.url).origin;
  // The slots that hold a cookie:/session: value, by the layer their path starts in ("header:x-csrf", "form[1]:tok").
  const held = op.slots.filter(holdsRef).map((s) => ({
    s,
    refs: [...(s.ref ? [s.ref] : []), ...templateRefs(s.template ?? "")],
    layer: /^[a-z]+/.exec(s.at[0]!)?.[0],
  }));
  const secret = new Set(["authorization", "cookie"]);
  for (const h of held) if (h.layer === "header") secret.add(h.s.at[0]!.slice(7).toLowerCase());
  const drop = (name: string) => (toGet && BODY_HEADERS.has(name)) || (cross && secret.has(name));
  const headers = Object.fromEntries(Object.entries(from.headers).filter(([k]) => !drop(k.toLowerCase())));
  const body = toGet ? undefined : from.body;
  if (cross) {
    const inBody = body !== undefined && held.some((h) => h.layer === "body" || h.layer === "form");
    // every slot's, a header's too: the header is dropped, and the site may still have copied what it held
    const carried = held.flatMap(({ s, refs }) =>
      refs.flatMap((r) => {
        const v = resolveRef(r, session, op.request.url);
        return v && v.length >= 4 ? [s.ref === r ? transform(v, s.transform) : v] : [];
      }),
    );
    // ponytail: a search, not a proof. The address is percent- and form-decoded (a `+` is a space
    // only before its level is decoded, or a literal %2B would become one) until nothing changes,
    // every reading kept, so nested return addresses open; the value is looked for as it is, as a
    // JSON string's contents, and in base64. What still passes: a copy that is encrypted, hashed,
    // split, hex or \u-escaped, base64 at an offset or of an escaped form. Refuse every
    // cross-origin hop of an op with ref slots if one is ever met.
    const unpct = (u: string) =>
      u.replace(/(%[0-9a-f]{2})+/gi, (m) => {
        try {
          return decodeURIComponent(m);
        } catch {
          return m;
        }
      });
    const readings = new Set([next.href]);
    // a Set is walked through what is added to it: each reading is decoded in turn, to a bound
    for (const u of readings) {
      if (readings.size > 64) break;
      readings.add(unpct(u)).add(unpct(u.replaceAll("+", " ")));
    }
    const forms = (v: string) => {
      const json = JSON.stringify(v).slice(1, -1);
      return [
        v,
        json,
        json.replaceAll("/", "\\/"),
        Buffer.from(v).toString("base64").replace(/=+$/, ""),
        Buffer.from(v).toString("base64url"),
      ];
    };
    if (inBody || carried.some((v) => forms(v).some((f) => [...readings].some((u) => u.includes(f)))))
      throw refused("the request would carry this session's values to another origin");
  }
  return { url: next.href, method, headers, body };
}

/** Send the filled template. Redirects are followed by hand, each hop decided by `nextHop`. */
export async function send(
  op: Operation,
  args: Record<string, unknown>,
  session: Session,
  opts: SendOptions,
): Promise<Sent> {
  const req = buildRequest(op, args, session);
  await pace(opts.site, opts.minIntervalMs ?? 1000);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const signal = AbortSignal.timeout(timeoutMs);
  let hop: Request = { ...req, body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body };
  const t0 = performance.now();
  // Cookies set along the way (a consent or session bootstrap hop) ride on the next hop, as in a browser.
  let jar = session.cookies;
  const setCookies: StoredCookie[] = [];
  let redirected: boolean | undefined;
  try {
    for (let hops = 0; ; hops++) {
      const { url, ...init } = hop;
      const res = await (opts.fetchImpl ?? fetch)(url, { ...init, redirect: "manual", signal });
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const c = parseSetCookie(line, url);
        if (!c) continue;
        setCookies.push(c);
        jar = [
          ...jar.filter(
            (x) => !(x.name === c.name && x.domain.toLowerCase() === c.domain.toLowerCase() && x.path === c.path),
          ),
          c,
        ];
      }
      const location = res.headers.get("location");
      redirected ??= REDIRECT.has(res.status) && !!location;
      if (REDIRECT.has(res.status) && location) {
        await res.body?.cancel();
        hop = nextHop(op, session, hop, res.status, location, hops);
        // the jar's cookies for the new address, whichever origin it is
        const { cookie: _sent, ...headers } = hop.headers;
        const cookie = cookieHeaderFor(jar, hop.url);
        hop.headers = cookie ? { ...headers, cookie } : headers;
        continue;
      }
      const raw = unzstd(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-encoding"));
      const text = decodeBody(raw, res.headers.get("content-type") ?? "");
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
    if (cause && (e as Error).message === "fetch failed")
      throw new Error(
        `fetch failed: ${cause.code ?? cause.message}${cause.code && cause.message ? ` (${cause.message})` : ""}`,
      );
    throw e;
  }
}

/**
 * Node 22's fetch hands back a zstd body still compressed (24 and later decode it). Decode it here
 * when that happened; zlib has zstd from 22.15, before that the body stays as it came.
 */
function unzstd(buf: Uint8Array, encoding: string | null): Uint8Array {
  const compressed = buf[0] === 0x28 && buf[1] === 0xb5 && buf[2] === 0x2f && buf[3] === 0xfd;
  if (!compressed || !/\bzstd\b/i.test(encoding ?? "")) return buf;
  return zlib.zstdDecompressSync?.(buf) ?? buf;
}

/** Decode with the declared charset (header, else an HTML <meta>), else UTF-8. A BOM is dropped. */
export function decodeBody(buf: Uint8Array, contentType: string): string {
  let charset = /charset=["']?([\w.:-]+)/i.exec(contentType)?.[1];
  if (!charset && /html/i.test(contentType))
    charset = /<meta[^>]+charset=["']?([\w.:-]+)/i.exec(new TextDecoder("latin1").decode(buf.subarray(0, 2048)))?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(buf);
  } catch {
    return new TextDecoder().decode(buf);
  }
}
