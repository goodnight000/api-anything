/** Turn a response body into the compact value an agent sees: parse, extract, pick, cap. */
import { parse as parseHtml } from "node-html-parser";
import { jsonValueEnd, parseJson } from "./codec.js";
import type { ResponseSpec } from "./spec.js";

export const XSSI = ")]}'";
// Anti-JSON-hijacking prefixes: Google's, Meta's /ajax/* and older Google/Facebook APIs.
const PREFIXES = [XSSI, "for (;;);", "while(1);"];

/** The XSSI prefix a body starts with, if any. */
export const xssiOf = (body: string) => PREFIXES.find((p) => body.trimStart().startsWith(p));

/**
 * Strip the XSSI prefix and parse JSON losslessly. Google `rt=c` length-prefixed chunks, and
 * Meta-style bodies that repeat the prefix before each JSON value, become an array.
 */
export function parseBody(body: string, xssiPrefix?: string): unknown {
  let text = body.trimStart();
  const prefix = xssiPrefix ?? xssiOf(text) ?? "";
  if (prefix && text.startsWith(prefix)) text = text.slice(prefix.length);
  text = text.trim();
  if (/^\d+[ \t]*\r?\n/.test(text)) return parseChunks(text);
  const parts = prefix ? text.split(prefix) : [text];
  return parts.length > 1 ? parts.map((p) => parseJson(p.trim())) : parseJson(text);
}

function parseChunks(text: string): unknown[] {
  const out: unknown[] = [];
  const head = /\s*\d+[ \t]*\r?\n\s*/y;
  let i = 0;
  while (i < text.length) {
    head.lastIndex = i;
    const m = head.exec(text);
    if (!m) break;
    i += m[0].length;
    // Chunk lengths count bytes or UTF-16 units depending on the server; scanning the JSON is exact.
    const end = jsonValueEnd(text, i);
    out.push(parseJson(text.slice(i, end)));
    i = end;
  }
  return out;
}

/** A string holding JSON (Google's batchexecute nests payloads this way), parsed; else undefined. */
export function innerJson(s: string): unknown {
  if (!/^\s*[[{]/.test(s)) return undefined;
  try {
    return parseJson(s);
  } catch {
    return undefined;
  }
}

/**
 * Resolve "a.b[0].c", "[1][0][2]", `a["x.y"]`, stepping into JSON-encoded strings. Undefined if any step is missing.
 * `[*]` maps the rest of the path over an array and flattens one level, skipping items where it is
 * missing (`sections[*].items`: every section's items, whichever section holds them).
 */
export function getPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  const steps = [...path.matchAll(/\[(\d+)\]|\[(\*)\]|\["((?:[^"\\]|\\.)*)"\]|[^.[\]]+/g)];
  const walk = (cur: unknown, i: number): unknown => {
    for (; i < steps.length; i++) {
      const m = steps[i]!;
      if (typeof cur === "string") cur = innerJson(cur);
      if (cur == null || typeof cur !== "object") return undefined;
      if (m[2]) {
        if (!Array.isArray(cur)) return undefined;
        const found = cur.map((x) => walk(x, i + 1)).filter((v) => v !== undefined);
        // items present but none has the rest of the path: the path moved, not "no results"
        return cur.length && !found.length ? undefined : found.flat();
      }
      const key = m[1] ?? (m[3] !== undefined ? (JSON.parse(`"${m[3]}"`) as string) : m[0]);
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  };
  return walk(obj, 0);
}

/**
 * Keep only the given paths, per item for arrays. `name=path` renames the output key, and
 * `name=path~regex` keeps the part of a string that the regex's group 1 (or whole match) finds
 * (`publicId=navigationUrl~/in/([^/?]+)`); a non-string or no match drops the field.
 */
export function pick(value: unknown, paths: string[]): unknown {
  const named = paths.map((p) => {
    const [, name, rest] = /^([\w$-]+)=(.+)$/.exec(p) ?? [p, undefined, p];
    const cut = rest.indexOf("~");
    const path = cut < 0 ? rest : rest.slice(0, cut);
    return { name: name ?? path, path, re: cut < 0 ? undefined : new RegExp(rest.slice(cut + 1)) };
  });
  const one = (item: unknown) => {
    if (!item || typeof item !== "object") return item;
    const out: Record<string, unknown> = {};
    for (const { name, path, re } of named) {
      let v = getPath(item, path);
      if (re) {
        const m = typeof v === "string" ? re.exec(v) : null;
        v = m ? (m[1] ?? m[0]) : undefined;
      }
      if (v !== undefined) out[name] = v;
    }
    return out;
  };
  if (!Array.isArray(value)) return one(value);
  // an item with none of the fields (a shelf, an ad, a logo entity) is not a result: drop it, not {}
  return value.map(one).filter((x) => !(x && typeof x === "object" && !Object.keys(x).length));
}

/** `fields` values are "<css>" (text) or "<css>@attr"; an empty css means the item itself. */
export function extractHtml(body: string, recipe: { items: string; fields: Record<string, string> }): Record<string, string | undefined>[] {
  return parseHtml(body)
    .querySelectorAll(recipe.items)
    .map((el) => {
      const out: Record<string, string | undefined> = {};
      for (const [name, sel] of Object.entries(recipe.fields)) {
        const m = /^(.*?)@([\w:-]+)$/.exec(sel);
        const css = (m ? m[1]! : sel).trim();
        const target = css ? el.querySelector(css) : el;
        out[name] = !target ? undefined : m ? target.getAttribute(m[2]!) : target.text.replace(/\s+/g, " ").trim();
      }
      return out;
    });
}

/** JSON embedded in a document; the regex's group 1 marks where the JSON value starts. */
export function extractEmbedded(body: string, regex: string): unknown {
  const m = new RegExp(regex, "d").exec(body);
  if (!m || m[1] === undefined) return undefined;
  const start = m.indices![1]![0];
  try {
    return parseJson(body.slice(start, jsonValueEnd(body, start)));
  } catch {
    try {
      return parseJson(m[1]);
    } catch {
      return undefined;
    }
  }
}

/** Body -> extracted value per the op's response spec. Undefined when the extract path is missing. */
export function extract(res: ResponseSpec, body: string): unknown {
  let data: unknown;
  if (res.format === "html") data = res.html ? extractHtml(body, res.html) : body;
  else if (res.format === "embedded") data = res.embedded ? extractEmbedded(body, res.embedded.regex) : undefined;
  else data = parseBody(body, res.xssiPrefix);
  if (res.extract && data !== undefined) data = getPath(data, res.extract);
  if (res.pick?.length && data !== undefined) data = pick(data, res.pick);
  return data;
}

const size = (v: unknown) => (JSON.stringify(v) ?? "null").length;
// A member at most this big is kept whole or dropped, never shortened: a number or a short string can't be.
const ATOM = 200;

/**
 * v in at most `budget` JSON chars: strings cut, arrays cut at an item boundary (never below one
 * item while one fits), objects keep their members in order with the biggest ones shortened to a
 * common cap, then drop trailing members. undefined when not even an empty container fits.
 */
function cut(v: unknown, budget: number, total = size(v)): unknown {
  if (total <= budget) return v;
  if (typeof v === "string") {
    let s = v.slice(0, Math.max(0, budget - 2));
    while (s && size(s) > budget) s = s.slice(0, s.length - Math.max(1, size(s) - budget));
    return size(s) <= budget ? s : undefined;
  }
  if (budget < 2) return undefined;
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    let used = 2;
    for (const item of v) {
      const n = size(item);
      if (used + n + (out.length ? 1 : 0) > budget) {
        if (!out.length) {
          const one = cut(item, budget - 2, n);
          if (one !== undefined) out.push(one);
        }
        break;
      }
      out.push(item);
      used += n + (out.length > 1 ? 1 : 0);
    }
    return out;
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    // one pass for every member's size: "key":value
    const cost = entries.map(([k, x]) => ({ key: size(k) + 1, value: size(x) }));
    // Water-fill: the largest cap (>= ATOM) at which every member fits, members above it shortened.
    const room = budget - 2 - Math.max(0, entries.length - 1);
    const sorted = cost.map((c) => c.key + c.value).sort((a, b) => a - b);
    let cap = Infinity;
    let below = 0;
    for (let i = 0; i < sorted.length; i++) {
      const left = sorted.length - i;
      if (below + sorted[i]! * left > room) {
        cap = Math.max(Math.min(ATOM, budget - 2), Math.floor((room - below) / left));
        break;
      }
      below += sorted[i]!;
    }
    const out: Record<string, unknown> = {};
    let used = 2;
    for (let i = 0; i < entries.length; i++) {
      const [k, x] = entries[i]!;
      const c = cost[i]!;
      const value = c.key + c.value <= cap ? x : cut(x, cap - c.key, c.value);
      if (value === undefined) continue;
      const n = c.key + (value === x ? c.value : size(value)) + (used > 2 ? 1 : 0);
      // ponytail: once the members stop fitting the rest are dropped; the note counts them
      if (used + n > budget) break;
      out[k] = value;
      used += n;
    }
    return out;
  }
  return undefined;
}

/**
 * Hard cap on what goes back to the agent: the result is never over maxChars. Arrays are cut at an
 * item boundary, and an item too big on its own is cut rather than dropped, so the output never
 * reads as "no results". Strings are cut as strings; objects stay objects (their biggest members
 * shortened, then trailing members dropped), never cut JSON text. The note says what was cut.
 */
export function capOutput(value: unknown, maxChars = 20_000): { data: unknown; truncated?: string } {
  const total = size(value);
  if (total <= maxChars) return { data: value };
  const data = cut(value, maxChars, total) ?? null;
  const hint = "narrow with pick or extract";
  if (Array.isArray(value)) {
    const n = (data as unknown[]).length;
    const whole = n > 0 && (data as unknown[])[n - 1] === value[n - 1];
    return { data, truncated: `showing ${n} of ${value.length} items${n && !whole ? " (the last one cut to fit)" : ""} (cap ${maxChars} chars); ${hint}` };
  }
  if (value && typeof value === "object" && data && typeof data === "object") {
    const all = Object.keys(value);
    const kept = Object.keys(data);
    const shortened = kept.filter((k) => (data as Record<string, unknown>)[k] !== (value as Record<string, unknown>)[k]).length;
    return {
      data,
      truncated: `cut to ${size(data)} of ${total} chars (cap ${maxChars}): showing ${kept.length} of ${all.length} keys${shortened ? `, ${shortened} of them shortened` : ""}; ${hint}`,
    };
  }
  return { data, truncated: `cut to ${size(data)} of ${total} chars (cap ${maxChars}); ${hint}` };
}

// numeric ids, short upper-case codes (SFO, US), and ids with digits (item-85809106, u_123)
const ID_KEY = /^(\d+|[A-Z0-9]{2,5}|[\w:.-]*\d[\w:.-]*)$/;

/** Key paths -> types (first array item only; an id-keyed map as "*"), for drift detection. */
export function inferShape(value: unknown, maxPaths = 200): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  const visit = (v: unknown, path: string, depth: number) => {
    if (n >= maxPaths) return;
    const type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    if (path) {
      out[path] = type;
      n++;
    }
    if (depth >= 6) return;
    if (Array.isArray(v)) {
      if (v.length) visit(v[0], `${path}[]`, depth + 1);
    } else if (type === "object") {
      const entries = Object.entries(v as Record<string, unknown>);
      // An id-keyed map (airports: {SFO: {...}}) has different keys for other args: its keys are "*".
      if (entries.length && entries.every(([k, c]) => ID_KEY.test(k) && c !== null && typeof c === "object")) {
        visit(entries[0]![1], path ? `${path}.*` : "*", depth + 1);
      } else {
        for (const [k, c] of entries) visit(c, path ? `${path}.${k}` : k, depth + 1);
      }
    }
  };
  visit(value, "", 0);
  return out;
}
