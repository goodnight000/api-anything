/** Tier 1: fill the stored template and send it with Node fetch. */
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { Transform } from "node:stream";
import * as zlib from "node:zlib";
import type { SendBudget } from "./budget.js";
import { asText, fillSlotTemplate, setAt, templateRefs, walk } from "./codec.js";
import { matches } from "./learn.js";
import { CleartextRefused, refuseCleartext, siteFetch } from "./proxy.js";
import { cookieHeaderFor, cookieValue, insecureSet, parseSetCookie, type Session } from "./session.js";
import type { Match, Operation, Param, Request } from "./spec.js";
import { reserveSend } from "./store.js";
import { carriesField, isEventStream, STREAM_IDLE_MS, STREAM_MAX_MS, type StreamCut, streamCut } from "./stream.js";
import type { StoredCookie } from "./types.js";
import { badAddress, graphqlDocuments, writesGraphql } from "./vet.js";

/**
 * The most of one tier-1 response body read from the network, and the most a zstd body this module
 * decodes may grow to. A shared spec may point at any public host, so the body is cut off while it
 * streams, before parsing and extraction see it. Decoding and parsing what is kept still allocate
 * more than this. 32 MiB is far above any page or JSON answer the bundled operations read.
 */
export const MAX_BODY_BYTES = 32 * 1024 * 1024;

/** A response body past `MAX_BODY_BYTES`: the site gives the same answer again, so no retry or tier helps. */
export class BodyTooLarge extends Error {}

const CAP = `${MAX_BODY_BYTES / 1024 / 1024} MiB`;

export interface Sent {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** final URL after redirects */
  url: string;
  ms: number;
  /** the first answer was a redirect: the server took the request (a write's POST ran); false when it was not */
  redirected?: boolean;
  /** cookies the answers set (every hop), for the jar */
  setCookies?: StoredCookie[];
  /** the body is the part of an event stream read before a bound: why it stopped (stream.ts) */
  truncated?: string;
}

/** `jar` with each of `set` in place of the cookie of its name, domain and path, as a browser keeps them. */
export function withCookies(jar: StoredCookie[], set: StoredCookie[]): StoredCookie[] {
  let out = jar;
  for (const c of set)
    out = [
      ...out.filter(
        (x) => !(x.name === c.name && x.domain.toLowerCase() === c.domain.toLowerCase() && x.path === c.path),
      ),
      c,
    ];
  return out;
}

export interface SendOptions {
  /** pacing key; normally the site name */
  site: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** gap between requests to one site, ±30% (default 1 s); 0 sends without pacing */
  minIntervalMs?: number;
  /**
   * someone else's spec, or a candidate verified in the background: the request and every redirect hop
   * must be https to a public host (`badAddress`) that resolves to no loopback, private, link-local,
   * CGNAT or unique-local address (`publicAddress`). Tiers 2 and 3 are the browser's, which this does
   * not reach.
   */
  publicOnly?: boolean;
  /** the call's seed for its gen slots (`buildRequest`) */
  gen?: string;
  /** the site's budget, checked and counted at the send (`pace`) */
  budget?: SendBudget;
}

/** How a public-only send resolves a host before connecting; tests replace it, since they stay off the network. */
export const resolver = {
  lookup: (host: string): Promise<{ address: string }[]> => lookup(host, { all: true, verbatim: true }),
};

/** An IPv4 address as 4 numbers, or undefined. */
const octets = (ip: string) => (isIPv4(ip) ? ip.split(".").map(Number) : undefined);

/**
 * An address no public-only request may reach: this host (0/8, 127/8, ::, ::1), the private ranges
 * (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10), CGNAT (100.64/10), unique-local
 * (fc00::/7), multicast and reserved (224/3, ff00::/8); an IPv4-mapped or NAT64 IPv6 address by the
 * IPv4 address inside it.
 */
export function privateAddress(ip: string): boolean {
  const v4 = octets(ip);
  if (v4) {
    const [a, b] = v4 as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b < 128) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b < 32) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (!isIPv6(ip)) return true;
  const h = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const tail = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(h)?.[1];
  if (tail) return privateAddress(tail);
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (hex) {
    const n = (Number.parseInt(hex[1]!, 16) << 16) | Number.parseInt(hex[2]!, 16);
    return privateAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  if (h === "::" || h === "::1") return true;
  const first = Number.parseInt(h.split(":")[0] || "0", 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

/**
 * Why a public-only request may not go to `url`, or undefined when it may: `badAddress`, then every
 * address the host resolves to. ponytail: fetch resolves the host again when it connects, so a DNS
 * answer that changes in between (rebinding) is not caught; pin the address in an undici dispatcher if
 * that is ever needed.
 */
export async function publicAddress(url: string): Promise<string | undefined> {
  const bad = badAddress(url);
  if (bad) return bad;
  const host = new URL(url).hostname;
  let found: { address: string }[];
  try {
    found = await resolver.lookup(host);
  } catch (e) {
    return `has a host that does not resolve (${host}: ${(e as { code?: string }).code ?? (e as Error).message})`;
  }
  if (!found.length) return `has a host that does not resolve (${host})`;
  const inside = found.find((a) => privateAddress(a.address));
  return inside ? `has a host that resolves to the non-public address ${inside.address} (${host})` : undefined;
}

/** A public-only request whose own address is not public: nothing was sent. */
export class AddressRefused extends Error {}

/** Throws `AddressRefused` when `url`, the first address a public-only request of `op` goes to, is not public. */
export async function refusePrivate(op: Operation, url: string): Promise<void> {
  const bad = await publicAddress(url);
  if (bad) throw new AddressRefused(`not sending ${op.name}: ${new URL(url).origin} ${bad}`);
}

/** Throws `RedirectRefused` when the next hop of a public-only request is not public. */
export async function refusePrivateHop(hop: Request, status: number): Promise<void> {
  const bad = await publicAddress(hop.url);
  if (bad)
    throw new RedirectRefused(`not following the HTTP ${status} redirect to ${new URL(hop.url).origin}: it ${bad}`);
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
  if (ref.startsWith("cookie:")) return cookieValue(session.cookies, name, url);
  const bound = session.valueHosts?.[name];
  return bound === undefined || bound === new URL(url).hostname.toLowerCase() ? session.values[name] : undefined;
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

const slotRefs = (op: Pick<Operation, "slots">) =>
  op.slots.flatMap((s) => [...(s.ref ? [s.ref] : []), ...templateRefs(s.template ?? "")]);

/**
 * The cookies `buildRequest` puts into `op`'s request through a `cookie:` ref, each with its value.
 * One can be a host-only cookie of another host of the site (`cookieValue`), which the request's
 * Cookie header never carries. Throws for a request address that is no URL.
 */
export function filledCookies(op: Pick<Operation, "request" | "slots">, session: Session): [string, string][] {
  const names = new Set(
    slotRefs(op)
      .filter((r) => r.startsWith("cookie:"))
      .map((r) => r.slice("cookie:".length)),
  );
  return [...names].flatMap((name): [string, string][] => {
    const value = cookieValue(session.cookies, name, op.request.url);
    return value ? [[name, value]] : [];
  });
}

/** The names of the stored, non-empty session values `buildRequest` puts into `op`'s request. */
export function filledValues(op: Pick<Operation, "request" | "slots">, session: Session): string[] {
  const refs = slotRefs(op);
  const filled = (ref: string) => {
    try {
      return !!resolveRef(ref, session, op.request.url);
    } catch {
      return !!session.values[ref.slice("session:".length)]; // an unparseable URL: count what is stored
    }
  };
  return [...new Set(refs.filter((r) => r.startsWith("session:") && filled(r)).map((r) => r.slice("session:".length)))];
}

/**
 * A gen slot's value: a UUID v4 drawn from `seed` and the slot's place, so every request one call
 * builds carries the same one. With no seed, a fresh one.
 */
function generated(seed: string | undefined, at: string[]): string {
  if (seed === undefined) return randomUUID();
  const b = createHash("sha256")
    .update(JSON.stringify([seed, at]))
    .digest()
    .subarray(0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The args a call runs with at every tier: a param the caller left out takes its default. */
export function withDefaults(op: Operation, args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = args[p.name] ?? p.default;
    if (v !== undefined) out[p.name] = v;
  }
  return out;
}

/** Why the args name a param the op doesn't take, or undefined: a misspelled optional arg would silently fall back to its default. */
export function unknownArgs(op: Operation, args: Record<string, unknown>): string | undefined {
  const unknown = Object.keys(args).filter((k) => !op.params.some((p) => p.name === k));
  if (!unknown.length) return undefined;
  return `unknown arg ${unknown.join(", ")}; ${op.name} takes ${op.params.map((p) => p.name).join(", ") || "no args"}`;
}

/** What a value the param does not allow should be instead (its pattern, enum or bounds), or undefined when it is allowed. */
export function refusal(p: Pick<Param, "pattern" | "hint" | "enum" | "min" | "max">, text: string): string | undefined {
  if (p.pattern !== undefined && !new RegExp(`^(?:${p.pattern})$`).test(text))
    return p.hint ?? `a value matching /${p.pattern}/`;
  if (p.enum && !p.enum.includes(text)) return `one of ${p.enum.map((x) => JSON.stringify(x)).join(", ")}`;
  if (p.min === undefined && p.max === undefined) return undefined;
  const n = text.trim() === "" ? Number.NaN : Number(text);
  if (Number.isNaN(n))
    return p.min !== undefined && p.max !== undefined
      ? `a number from ${p.min} to ${p.max}`
      : `a number ${p.min !== undefined ? `of at least ${p.min}` : `of at most ${p.max}`}`;
  if (p.min !== undefined && n < p.min) return `at least ${p.min}`;
  if (p.max !== undefined && n > p.max) return `at most ${p.max}`;
  return undefined;
}

/** The args as the request carries them: defaults filled, each coerced to its param's type and checked; throws when one cannot go. */
export function requestArgs(op: Operation, args: Record<string, unknown>): Record<string, unknown> {
  const given = withDefaults(op, args);
  const vals: Record<string, unknown> = {};
  for (const p of op.params) {
    const v = given[p.name];
    if (v === undefined) {
      if (p.required) throw new Error(`missing required param "${p.name}"`);
      continue;
    }
    vals[p.name] = coerce(p, v);
    const wrong = refusal(p, asText(vals[p.name]));
    if (wrong) throw new Error(`param "${p.name}" must be ${wrong}, got ${JSON.stringify(v)}`);
  }
  return vals;
}

/**
 * The fully materialized request: params, cookie/session refs, gen slots from `gen` (the call's
 * seed; without one each build makes new values), and the jar's Cookie header.
 */
export function buildRequest(op: Operation, args: Record<string, unknown>, session: Session, gen?: string): Request {
  const vals = requestArgs(op, args);

  let req: Request = { ...op.request, method: op.request.method.toUpperCase(), headers: { ...op.request.headers } };
  let leafTypes: Map<string, string> | undefined;
  const stringLeaf = (at: string[]) => {
    leafTypes ??= new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]));
    return leafTypes.get(JSON.stringify(at)) === "string";
  };
  delete req.headers.cookie;
  for (const slot of op.slots) {
    // a derived leaf keeps the value it holds: `derive` (lookup.ts) set it from this call's lookup
    if (slot.from) continue;
    if (slot.gen) {
      req = setAt(req, slot.at, generated(gen, slot.at));
      continue;
    }
    const name = slot.param ?? slot.ref!;
    let v: unknown = slot.param !== undefined ? vals[slot.param] : resolveRef(slot.ref!, session, op.request.url);
    // No cursor is the first page. An op learned from the request that loads page 2 holds page 2's
    // cursor, which must not go: the slot is emptied (null in a JSON leaf).
    if (v === undefined && op.paging?.next && slot.param === op.paging.param)
      v = slot.template === undefined && slot.at.at(-1)!.startsWith("json:") ? null : "";
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
  // fetch would refuse it quoting the value, which may be a session's: name the header only
  for (const [k, h] of Object.entries(req.headers)) if (/[\r\n\0]/.test(h)) throw new BadHeader(k);
  // The spec's rules see only the stored document: an arg, a default or a slot template must not make a
  // read a mutation, as a looked-up value must not (lookup.ts `derive`).
  if (op.readOnly && graphqlDocuments(req).some((d) => writesGraphql(d) && OPERATION.test(d)))
    throw new ReadWrites(op.name);
  return req;
}

// What GraphQL ignores between tokens: whitespace (a BOM too), commas, and comments. A comment is
// taken whole to its line's end, so a run of `#` has one reading and a long one cannot stall the match.
const IGNORED = "(?:[\\s,]|#[^\\n\\r]*(?=[\\n\\r]|$))*";
/**
 * How the grammar opens a mutation or subscription: the keyword, at most one name, then its
 * variables `(`, a directive `@` or its selection `{`. `writesGraphql` finds the keyword leading a
 * top-level definition whatever stands between it and the `{`, which a search phrase filled into a
 * `query` field can do ("mutation testing tools {2024}"); no GraphQL parser reads that as an
 * operation, so only text of this shape is refused.
 */
const OPERATION = new RegExp(`(?<!\\w)(?:mutation|subscription)${IGNORED}(?:[A-Za-z_]\\w*${IGNORED})?[{(@]`);

/**
 * A read whose filled request is a GraphQL mutation or subscription: a read never sends one, so none
 * was sent. The test is the document's shape (`writesGraphql`, `OPERATION`), which text typed into a search box
 * can have too, so the reason says what was read and what to change; it repeats no arg.
 */
export class ReadWrites extends Error {
  constructor(name: string) {
    super(
      `${name} is a read, and with these args its filled request reads as a GraphQL mutation or subscription (its query text holds an operation that opens with that keyword and a "{"); a read never sends one: nothing was sent. If that was search text and not a document, rephrase it without the braces`,
    );
  }
}

/** A filled header whose value holds a line break or a NUL: no request can carry it, so none was sent. */
export class BadHeader extends Error {
  constructor(name: string) {
    super(`the ${name} header was filled with a value that holds a line break, which no request can carry`);
  }
}

/**
 * Reserve the next send slot for a site, then wait for it; concurrent callers, in any process, queue
 * up. Under a `budget` the reservation checks and counts it in the same locked step, and throws
 * `BudgetSpent` without reserving when the send would go over it.
 */
export async function pace(site: string, minIntervalMs = 1000, budget?: SendBudget): Promise<void> {
  if (minIntervalMs <= 0 && !budget) return;
  const at = reserveSend(site, Math.max(0, minIntervalMs), Date.now(), budget);
  const wait = at - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
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

/**
 * How many redirects one request is taken through, per tier: what each took before redirects were
 * followed by hand. Tier 1 stopped after 5 (more would send a GET write, or carry a value, further
 * than it ever did); a page's fetch, and the rescan's, follow 20.
 */
export const TIER1_REDIRECTS = 5;
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
 * the request carried it. `taken`: the redirects before this one; one past `limit` is refused
 * too, saying that it is the limit.
 */
export function nextHop(
  op: Operation,
  session: Session,
  from: Request,
  status: number,
  location: string,
  taken = 0,
  limit = MAX_REDIRECTS,
): Request {
  const next = new URL(location, from.url);
  if (taken >= limit)
    throw new RedirectRefused(`stopped after ${limit} redirects, the last one to ${next.origin}`, "limit");
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

/**
 * `refuseCleartext` for a redirect's next hop: the request before it was sent (a write's POST ran),
 * so the refusal is the redirect's, as any other hop the policy does not take.
 */
export function refuseCleartextHop(url: string, carries: boolean, status: number): void {
  try {
    refuseCleartext(url, carries);
  } catch (e) {
    if (!(e instanceof CleartextRefused)) throw e;
    throw new RedirectRefused(`not following the HTTP ${status} redirect to ${new URL(url).origin}: ${e.message}`);
  }
}

/** Whether a request of `op` built from `session` holds one of its values: a `cookie:` or `session:` ref that resolves. */
export function carriesSessionRefs(op: Operation, session: Session): boolean {
  const held = session.cookies.length > 0 || Object.keys(session.values ?? {}).length > 0;
  return held && op.slots.some((s) => s.ref || (s.template !== undefined && templateRefs(s.template).length > 0));
}

/** Send the filled template. Redirects are followed by hand, each hop decided by `nextHop`. */
export async function send(
  op: Operation,
  args: Record<string, unknown>,
  session: Session,
  opts: SendOptions,
): Promise<Sent> {
  const req = buildRequest(op, args, session, opts.gen);
  if (opts.publicOnly) await refusePrivate(op, req.url);
  await pace(opts.site, opts.minIntervalMs, opts.budget);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const signal = AbortSignal.timeout(timeoutMs);
  let hop: Request = { ...req, body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body };
  const t0 = performance.now();
  // Cookies set along the way (a consent or session bootstrap hop) ride on the next hop, as in a browser.
  let jar = session.cookies;
  const setCookies: StoredCookie[] = [];
  let redirected: boolean | undefined;
  const refs = carriesSessionRefs(op, session);
  refuseCleartext(hop.url, refs || !!hop.headers.cookie);
  try {
    for (let hops = 0; ; hops++) {
      const { url, ...init } = hop;
      const res = await (opts.fetchImpl ?? siteFetch)(url, { ...init, redirect: "manual", signal });
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const c = parseSetCookie(line, url);
        // a plain-http answer is whatever the network returned: it cannot touch a Secure cookie
        if (!c || insecureSet(jar, c, url)) continue;
        setCookies.push(c);
        jar = withCookies(jar, [c]);
      }
      const location = res.headers.get("location");
      redirected ??= REDIRECT.has(res.status) && !!location;
      if (REDIRECT.has(res.status) && location) {
        await res.body?.cancel();
        hop = nextHop(op, session, hop, res.status, location, hops, TIER1_REDIRECTS);
        if (opts.publicOnly) await refusePrivateHop(hop, res.status);
        // the jar's cookies for the new address, whichever origin it is
        const { cookie: _sent, ...headers } = hop.headers;
        const cookie = cookieHeaderFor(jar, hop.url);
        hop.headers = cookie ? { ...headers, cookie } : headers;
        refuseCleartextHop(hop.url, refs || !!cookie, res.status);
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      // a stream is read to its end or a bound, inside what is left of the request's timeout
      const streamed = isEventStream(type)
        ? await readStream(res, timeoutMs - (performance.now() - t0) - STREAM_MARGIN_MS)
        : undefined;
      const raw = streamed?.raw ?? (await readCappedBody(res));
      const text = decodeBody(streamed ? raw : unzstd(raw, res.headers.get("content-encoding")), type);
      return {
        ...(streamed?.truncated ? { truncated: streamed.truncated } : {}),
        status: res.status,
        headers: Object.fromEntries(res.headers),
        body: text,
        url: res.url || url,
        ms: Math.round(performance.now() - t0),
        // every hop is taken here, so whether one was is known: false lets a login path asked for stand
        redirected: !!redirected,
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
 * The body, refused once it passes `MAX_BODY_BYTES`: a declared length is checked before any of it is
 * read, and a streamed body stops at the cap. This is a byte bound, not a time one: the request's
 * timeout does not limit how much a host can send.
 */
async function readCappedBody(res: Response): Promise<Uint8Array> {
  const over = (bytes: number) =>
    new BodyTooLarge(
      `the response is ${bytes} bytes, over the ${CAP} cap on a response; refused before reading it all`,
    );
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    // unread, the body would hold the connection open until the request's timeout
    await res.body?.cancel().catch(() => {});
    throw over(declared);
  }
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw over(total);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** What a stream's read leaves of the request's timeout: it stops before the abort would throw away what arrived. */
const STREAM_MARGIN_MS = 250;

/**
 * An event stream's body, read until it ends, sends no event for `STREAM_IDLE_MS`, has been read for
 * `STREAM_MAX_MS` (or `budgetMs`, when less is left of the request's time), or passes
 * `MAX_BODY_BYTES`; a bound keeps what arrived before it, and closes the connection. A zstd body that
 * fetch left compressed (`unzstd`) is decoded as it arrives, so the idle bound reads its lines and a
 * cut keeps what was decoded; the bytes bound counts what it decodes to.
 */
async function readStream(res: Response, budgetMs: number): Promise<{ raw: Uint8Array; truncated?: string }> {
  const encoding = res.headers.get("content-encoding");
  if (!res.body) return { raw: unzstd(new Uint8Array(await res.arrayBuffer()), encoding) };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  const start = Date.now();
  const end = start + Math.max(0, Math.min(STREAM_MAX_MS, budgetMs));
  let last = start;
  let total = 0;
  let cut: StreamCut | undefined;
  let pending: ReturnType<typeof reader.read> | undefined;
  // the first bytes say whether fetch decoded it already: held until there are enough to tell
  let head: Buffer | undefined = /\bzstd\b/i.test(encoding ?? "") ? Buffer.alloc(0) : undefined;
  // what is left of a skippable frame the stream opened with (Node's decoder stops at the end of one)
  let skip = 0;
  let skipped = false;
  let zstd: ReturnType<typeof zstdPieces> | undefined;
  const take = async (piece: Uint8Array): Promise<{ bytes: Uint8Array; over?: boolean }> => {
    if (head) {
      head = Buffer.concat([head, piece]);
      for (;;) {
        const n = Math.min(skip, head.byteLength);
        head = head.subarray(n);
        skip -= n;
        if (skip || head.byteLength < 4) return { bytes: new Uint8Array(0) };
        if (!skippableFrame(head)) break;
        if (head.byteLength < 8) return { bytes: new Uint8Array(0) };
        skip = 8 + head.readUInt32LE(4);
        skipped = true;
      }
      piece = head;
      head = undefined;
      if (skipped || zstdFrame(piece)) {
        if (!zstdCodec.stream) throw noZstd();
        zstd = zstdPieces(zstdCodec.stream, MAX_BODY_BYTES);
      }
    }
    return zstd ? zstd.write(piece) : { bytes: piece };
  };
  // a piece that crosses the cap keeps its part before it: the bound cuts there, not at the piece
  const keep = (got: { bytes: Uint8Array; over?: boolean }): boolean => {
    const room = MAX_BODY_BYTES - total;
    const bytes = got.bytes.byteLength > room ? got.bytes.subarray(0, room) : got.bytes;
    total += bytes.byteLength;
    if (bytes.byteLength) {
      chunks.push(bytes);
      if (carriesField(decoder.decode(bytes, { stream: true }))) last = Date.now();
    }
    return !got.over && got.bytes.byteLength <= room;
  };
  try {
    for (;;) {
      const idleAt = last + STREAM_IDLE_MS;
      const wait = Math.min(idleAt, end) - Date.now();
      if (wait <= 0) {
        cut = idleAt < end ? "idle" : "time";
        break;
      }
      pending ??= reader.read();
      let timer: NodeJS.Timeout | undefined;
      const got = await Promise.race([
        pending,
        new Promise<undefined>((r) => {
          timer = setTimeout(() => r(undefined), wait);
        }),
      ]).finally(() => clearTimeout(timer));
      if (!got) continue;
      pending = undefined;
      if (got.done) {
        if (head?.byteLength && skipped) throw new Error("the answer's zstd encoding could not be read: it ends inside a frame");
        // fewer than 4 bytes in all are no zstd frame
        if (head?.byteLength) keep({ bytes: head });
        else if (zstd && !keep(await zstd.end())) cut = "bytes";
        break;
      }
      if (!keep(await take(got.value))) {
        cut = "bytes";
        break;
      }
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    zstd?.close();
    throw e;
  }
  if (cut) {
    await reader.cancel().catch(() => {});
    zstd?.close();
  }
  return { raw: Buffer.concat(chunks), ...(cut ? { truncated: streamCut(cut, Date.now() - start) } : {}) };
}

/** zlib's zstd decoders, where this Node has them (22.15 and later); a test takes them away. */
export const zstdCodec: {
  stream?: () => Transform;
  sync?: (buf: Uint8Array, o: { maxOutputLength: number }) => Uint8Array;
} = { stream: zlib.createZstdDecompress, sync: zlib.zstdDecompressSync };

const zstdFrame = (b: Uint8Array) => b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
/** The standard lets a zstd stream open with skippable frames (magic 0x184D2A50 to 0x184D2A5F, little-endian). */
const skippableFrame = (b: Uint8Array) => (b[0]! & 0xf0) === 0x50 && b[1] === 0x2a && b[2] === 0x4d && b[3] === 0x18;

/** A whole zstd body after the skippable frames it opens with. */
function pastSkippable(buf: Uint8Array): Uint8Array {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  let at = 0;
  while (b.byteLength - at >= 8 && skippableFrame(b.subarray(at))) at += 8 + b.readUInt32LE(at + 4);
  return b.subarray(Math.min(at, b.byteLength));
}

/** Read as it came, the body would be its compressed bytes: a wrong answer that says nothing of why. */
const noZstd = () =>
  new Error(
    `the answer is zstd-encoded and this Node (${process.version}) has no zstd decoder (22.15 and later have one), so its body could not be read`,
  );

/**
 * A zstd decoder fed a stream's pieces as they arrive: each write answers what its piece decoded to,
 * `over` once all of them pass `cap` (the decoder stops there: a few KB of zstd expand to gigabytes).
 */
function zstdPieces(make: () => Transform, cap: number) {
  const d = make();
  let out: Buffer[] = [];
  let size = 0;
  let over = false;
  let failed: Error | undefined;
  d.on("data", (b: Buffer) => {
    if (over) return;
    if (size + b.byteLength > cap) {
      // what decoded up to the cap is kept; the decoder stops there
      out.push(b.subarray(0, cap - size));
      size = cap;
      over = true;
      d.destroy();
    } else {
      size += b.byteLength;
      out.push(b);
    }
  });
  d.on("error", (e) => {
    failed ??= e;
  });
  const settle = (begin: (done: () => void) => void) =>
    new Promise<{ bytes: Uint8Array; over: boolean }>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        // a write's callback usually wins: its listeners must not outlive it, one more per piece
        d.off("close", done);
        d.off("end", done);
        // what a write decoded may still be on its way to "data"
        setImmediate(() => {
          if (failed && !over)
            return reject(new Error(`the answer's zstd encoding could not be read: ${failed.message}`));
          const bytes = Buffer.concat(out);
          out = [];
          resolve({ bytes, over });
        });
      };
      d.once("close", done);
      begin(done);
    });
  return {
    write: (piece: Uint8Array) => settle((done) => d.write(piece, () => done())),
    end: () =>
      settle((done) => {
        d.once("end", done);
        d.end();
      }),
    close: () => d.destroy(),
  };
}

/**
 * Node 22's fetch hands back a zstd body still compressed (24 and later decode it). Decode it here
 * when that happened; zlib has zstd from 22.15, and before that the call fails saying so. The output is
 * bounded too: a few KB of zstd expand to gigabytes.
 */
function unzstd(buf: Uint8Array, encoding: string | null): Uint8Array {
  if (!/\bzstd\b/i.test(encoding ?? "")) return buf;
  const skipped = pastSkippable(buf);
  if (skipped.byteLength < buf.byteLength) {
    if (!skipped.byteLength) return skipped;
    buf = skipped;
  } else if (!zstdFrame(buf)) return buf;
  if (!zstdCodec.sync) throw noZstd();
  try {
    return zstdCodec.sync(buf, { maxOutputLength: MAX_BODY_BYTES });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE")
      throw new BodyTooLarge(
        `the response is ${buf.byteLength} bytes of zstd that decode to over the ${CAP} cap on a response; refused`,
      );
    throw e;
  }
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
