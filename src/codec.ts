/**
 * Read and write values inside a captured request through its decoded layers.
 *
 * A step path like ["form:f.req", "json:/1", "json:/0/1/0/0"] means: take form field f.req, parse it
 * as JSON, take /1 (a string), parse that as JSON, take /0/1/0/0. setAt re-encodes only the layers
 * on that path and splices the result back, so every other byte (key order, whitespace, RestLi
 * parens, big integers, the site's own percent-encoding) stays identical.
 *
 * Root steps: path:<i> (i-th segment after the leading slash), query:<key>, header:<name>,
 * form:<key> (urlencoded body), body. Below them only json:<RFC 6901 pointer>.
 */
import type { Request } from "./spec.js";

export type Step = string;

export interface Leaf {
  at: Step[];
  /** decoded text; JSON numbers/booleans/null as their source text */
  value: string;
  type: "string" | "number" | "boolean" | "null";
  /** the string was itself JSON and its leaves follow in the walk */
  container?: boolean;
}

/* ------------------------------------------------------------- JSON spans */

const isWs = (c: string | undefined) => c === " " || c === "\t" || c === "\n" || c === "\r";
const skipWs = (s: string, i: number) => {
  while (isWs(s[i])) i++;
  return i;
};
const LITERAL = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

/** Index just past the JSON value that starts at i. */
export function jsonValueEnd(s: string, i: number): number {
  const c = s[i];
  if (c === '"') {
    for (i++; i < s.length; i++) {
      if (s[i] === "\\") i++;
      else if (s[i] === '"') return i + 1;
    }
    throw new SyntaxError("unterminated JSON string");
  }
  if (c === "{" || c === "[") {
    let depth = 0;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') i = jsonValueEnd(s, i) - 1;
      else if (ch === "{" || ch === "[") depth++;
      else if ((ch === "}" || ch === "]") && --depth === 0) return i + 1;
    }
    throw new SyntaxError("unterminated JSON container");
  }
  LITERAL.lastIndex = i;
  const m = LITERAL.exec(s);
  if (!m) throw new SyntaxError(`unexpected JSON at ${i}`);
  return i + m[0].length;
}

/** Visit each member/element of the container at i as (key, valueStart). Return true to stop. */
function eachChild(s: string, i: number, fn: (key: string, start: number) => boolean | void): void {
  const obj = s[i] === "{";
  const close = obj ? "}" : "]";
  i = skipWs(s, i + 1);
  if (s[i] === close) return;
  for (let idx = 0; ; idx++) {
    let key = String(idx);
    if (obj) {
      const keyEnd = jsonValueEnd(s, i);
      key = JSON.parse(s.slice(i, keyEnd)) as string;
      i = skipWs(s, keyEnd);
      if (s[i] !== ":") throw new SyntaxError(`expected ':' at ${i}`);
      i = skipWs(s, i + 1);
    }
    if (fn(key, i) === true) return;
    i = skipWs(s, jsonValueEnd(s, i));
    if (s[i] === ",") i = skipWs(s, i + 1);
    else if (s[i] === close) return;
    else throw new SyntaxError(`expected ',' or '${close}' at ${i}`);
  }
}

const unescapeToken = (t: string) => t.replace(/~1/g, "/").replace(/~0/g, "~");
const escapeToken = (t: string) => t.replace(/~/g, "~0").replace(/\//g, "~1");

/** [start, end) of the value at an RFC 6901 pointer. */
function locate(s: string, pointer: string): [number, number] {
  if (pointer !== "" && !pointer.startsWith("/")) throw new Error(`bad JSON pointer "${pointer}"`);
  let start = skipWs(s, 0);
  for (const token of pointer ? pointer.slice(1).split("/").map(unescapeToken) : []) {
    let found = -1;
    if (s[start] === "{" || s[start] === "[") {
      eachChild(s, start, (key, at) => {
        if (key !== token) return false;
        found = at;
        return true;
      });
    }
    if (found < 0) throw new Error(`JSON pointer "${pointer}" not found`);
    start = found;
  }
  return [start, jsonValueEnd(s, start)];
}

/** JSON.parse that keeps integers beyond 2^53 as their exact digit strings. */
export function parseJson(text: string): unknown {
  return JSON.parse(text, (_key: string, value: unknown, ctx?: { source?: string }) =>
    typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value) && ctx?.source
      ? ctx.source
      : value,
  );
}

/** Encode a value as a JSON leaf, keeping its native type. bigint is written as raw digits. */
function toJson(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number" && !Number.isFinite(v)) throw new TypeError(`cannot encode ${v} as JSON`);
  const out = JSON.stringify(v);
  if (out === undefined) throw new TypeError(`cannot encode ${typeof v} as JSON`);
  return out;
}

/** Text for a non-JSON layer (path, query, header, form, body). */
export function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ------------------------------------------------------ percent-encoding */

function decode(raw: string, plusIsSpace: boolean): string {
  try {
    return decodeURIComponent(plusIsSpace ? raw.replace(/\+/g, " ") : raw);
  } catch {
    return raw;
  }
}

/** Percent-encode like the original raw text did: chars it left literal stay literal, and vice versa. */
function encodeLike(value: string, original: string, plusIsSpace: boolean): string {
  const out = encodeURIComponent(value)
    .replace(/%([0-7][0-9A-F])/g, (m, hex: string) => {
      const ch = String.fromCharCode(parseInt(hex, 16));
      return !"%&=#+ ".includes(ch) && original.includes(ch) ? ch : m;
    })
    .replace(/[!'()*~]/g, (ch) => {
      const pct = `%${ch.charCodeAt(0).toString(16).toUpperCase()}`;
      return original.toUpperCase().includes(pct) ? pct : ch;
    });
  return plusIsSpace && original.includes("+") ? out.replace(/%20/g, "+") : out;
}

/* ------------------------------------------------------------ root layers */

function splitUrl(url: string) {
  const hashAt = url.indexOf("#");
  const hash = hashAt < 0 ? "" : url.slice(hashAt);
  const noHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const qAt = noHash.indexOf("?");
  const base = qAt < 0 ? noHash : noHash.slice(0, qAt);
  const query = qAt < 0 ? undefined : noHash.slice(qAt + 1);
  const schemeEnd = base.indexOf("//");
  const pathAt = base.indexOf("/", schemeEnd < 0 ? 0 : schemeEnd + 2);
  const origin = pathAt < 0 ? base : base.slice(0, pathAt);
  const segments = pathAt < 0 ? [] : base.slice(pathAt + 1).split("/");
  return { origin, segments, query, hash };
}

function joinUrl(u: ReturnType<typeof splitUrl>): string {
  const path = u.segments.length ? `/${u.segments.join("/")}` : "";
  return `${u.origin}${path}${u.query === undefined ? "" : `?${u.query}`}${u.hash}`;
}

interface Pair {
  rawKey: string;
  rawValue: string;
  key: string;
}

function parsePairs(raw: string): Pair[] {
  if (!raw) return [];
  return raw.split("&").map((p) => {
    const eq = p.indexOf("=");
    const rawKey = eq < 0 ? p : p.slice(0, eq);
    return { rawKey, rawValue: eq < 0 ? "" : p.slice(eq + 1), key: decode(rawKey, true) };
  });
}

/** Rewrite one pair (first with that key) in a raw a=b&c=d string; untouched pairs keep their bytes. */
function setPair(raw: string, key: string, value: string): string {
  const parts = raw ? raw.split("&") : [];
  const pairs = parsePairs(raw);
  const idx = pairs.findIndex((p) => p.key === key);
  if (idx < 0) {
    parts.push(`${encodeURIComponent(key)}=${encodeLike(value, raw, true)}`);
  } else {
    const p = pairs[idx]!;
    parts[idx] = `${p.rawKey}=${encodeLike(value, p.rawValue || raw, true)}`;
  }
  return parts.join("&");
}

export function isFormBody(req: Request): boolean {
  const ct = Object.entries(req.headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  return /application\/x-www-form-urlencoded/i.test(ct);
}

function parseStep(step: Step): [string, string] {
  const i = step.indexOf(":");
  return i < 0 ? [step, ""] : [step.slice(0, i), step.slice(i + 1)];
}

/** The text at a root step and how to write it back. */
function rootLayer(req: Request, step: Step): { value: string | undefined; put: (v: string) => Request } {
  const [kind, arg] = parseStep(step);
  switch (kind) {
    case "path": {
      const u = splitUrl(req.url);
      const i = Number(arg);
      const raw = u.segments[i];
      return {
        value: raw === undefined ? undefined : decode(raw, false),
        put: (v) => {
          if (raw === undefined) throw new Error(`no path segment ${i} in ${req.url}`);
          u.segments[i] = encodeLike(v, raw, false);
          return { ...req, url: joinUrl(u) };
        },
      };
    }
    case "query": {
      const u = splitUrl(req.url);
      const p = parsePairs(u.query ?? "").find((x) => x.key === arg);
      return {
        value: p ? decode(p.rawValue, true) : undefined,
        put: (v) => ({ ...req, url: joinUrl({ ...u, query: setPair(u.query ?? "", arg, v) }) }),
      };
    }
    case "header": {
      const name = arg.toLowerCase();
      return {
        value: req.headers[name],
        put: (v) => ({ ...req, headers: { ...req.headers, [name]: v } }),
      };
    }
    case "form": {
      const p = parsePairs(req.body ?? "").find((x) => x.key === arg);
      return {
        value: p ? decode(p.rawValue, true) : undefined,
        put: (v) => ({ ...req, body: setPair(req.body ?? "", arg, v) }),
      };
    }
    case "body":
      return { value: req.body, put: (v) => ({ ...req, body: v }) };
    default:
      throw new Error(`step "${step}" is not a request layer (path, query, header, form, body)`);
  }
}

function jsonPointer(step: Step): string {
  const [kind, arg] = parseStep(step);
  if (kind !== "json") throw new Error(`step "${step}" must be json:<pointer> below the request layer`);
  return arg;
}

/* ----------------------------------------------------------------- public */

export function getAt(req: Request, steps: Step[]): unknown {
  const [first, ...rest] = steps;
  if (first === undefined) throw new Error("empty step path");
  let text = rootLayer(req, first).value;
  if (text === undefined) return undefined;
  for (let i = 0; i < rest.length; i++) {
    const [a, b] = locate(text, jsonPointer(rest[i]!));
    const v = parseJson(text.slice(a, b));
    if (i === rest.length - 1) return v;
    if (typeof v !== "string") throw new Error(`${rest[i]} is not a JSON string, cannot descend`);
    text = v;
  }
  return text;
}

function setNested(text: string, steps: Step[], value: unknown): string {
  const [step, ...rest] = steps;
  const [a, b] = locate(text, jsonPointer(step!));
  let replacement: string;
  if (rest.length) {
    const inner = JSON.parse(text.slice(a, b)) as unknown;
    if (typeof inner !== "string") throw new Error(`${step} is not a JSON string, cannot descend`);
    replacement = JSON.stringify(setNested(inner, rest, value));
  } else {
    replacement = toJson(value);
  }
  return text.slice(0, a) + replacement + text.slice(b);
}

/** Return a copy of req with value written at steps. A whole JSON leaf keeps the value's native type. */
export function setAt(req: Request, steps: Step[], value: unknown): Request {
  const [first, ...rest] = steps;
  if (first === undefined) throw new Error("empty step path");
  const layer = rootLayer(req, first);
  if (!rest.length) return layer.put(asText(value));
  if (layer.value === undefined) throw new Error(`nothing at ${first}`);
  return layer.put(setNested(layer.value, rest, value));
}

/** Replace `{name}` for names present in vars; anything else (e.g. minified GraphQL `{id}`) stays. */
export function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (m, k: string) => (vars[k] === undefined ? m : asText(vars[k])));
}

function walkJsonString(s: string, at: Step[], out: Leaf[]): boolean {
  const start = skipWs(s, 0);
  if (s[start] !== "{" && s[start] !== "[") return false;
  try {
    JSON.parse(s);
  } catch {
    return false;
  }
  const visit = (i: number, ptr: string) => {
    const c = s[i];
    if (c === "{" || c === "[") return eachChild(s, i, (key, child) => void visit(child, `${ptr}/${escapeToken(key)}`));
    const span = s.slice(i, jsonValueEnd(s, i));
    const steps = [...at, `json:${ptr}`];
    if (c === '"') {
      const leaf: Leaf = { at: steps, value: JSON.parse(span) as string, type: "string" };
      out.push(leaf);
      if (walkJsonString(leaf.value, steps, out)) leaf.container = true;
    } else {
      out.push({ at: steps, value: span, type: c === "t" || c === "f" ? "boolean" : c === "n" ? "null" : "number" });
    }
  };
  visit(start, "");
  return true;
}

/** Every decoded leaf of the request with its step path, including JSON inside strings, recursively. */
export function walk(req: Request): Leaf[] {
  const out: Leaf[] = [];
  const add = (at: Step[], value: string) => {
    const leaf: Leaf = { at, value, type: "string" };
    out.push(leaf);
    if (walkJsonString(value, at, out)) leaf.container = true;
  };
  const u = splitUrl(req.url);
  u.segments.forEach((seg, i) => seg && add([`path:${i}`], decode(seg, false)));
  const seen = new Set<string>();
  for (const p of parsePairs(u.query ?? "")) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    add([`query:${p.key}`], decode(p.rawValue, true));
  }
  for (const [name, value] of Object.entries(req.headers)) add([`header:${name.toLowerCase()}`], value);
  if (req.body !== undefined && req.body !== "") {
    if (isFormBody(req)) {
      seen.clear();
      for (const p of parsePairs(req.body)) {
        if (seen.has(p.key)) continue;
        seen.add(p.key);
        add([`form:${p.key}`], decode(p.rawValue, true));
      }
    } else {
      add(["body"], req.body);
    }
  }
  return out;
}
