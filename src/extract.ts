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

/** Resolve "a.b[0].c", "[1][0][2]", `a["x.y"]`, stepping into JSON-encoded strings. Undefined if any step is missing. */
export function getPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  let cur = obj;
  for (const m of path.matchAll(/\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|[^.[\]]+/g)) {
    if (typeof cur === "string") cur = innerJson(cur);
    if (cur == null || typeof cur !== "object") return undefined;
    const key = m[1] ?? (m[2] !== undefined ? (JSON.parse(`"${m[2]}"`) as string) : m[0]);
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Keep only the given paths, per item for arrays. `name=path` renames the output key. */
export function pick(value: unknown, paths: string[]): unknown {
  const named = paths.map((p) => {
    const m = /^([\w$-]+)=(.+)$/.exec(p);
    return m ? [m[1]!, m[2]!] : [p, p];
  });
  const one = (item: unknown) => {
    if (!item || typeof item !== "object") return item;
    const out: Record<string, unknown> = {};
    for (const [name, p] of named) {
      const v = getPath(item, p);
      if (v !== undefined) out[name] = v;
    }
    return out;
  };
  return Array.isArray(value) ? value.map(one) : one(value);
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

/** v shrunk to about budget JSON chars: strings cut, arrays cut at an item boundary (never below one item), objects by their biggest members. */
function cut(v: unknown, budget: number): unknown {
  if (size(v) <= budget) return v;
  if (typeof v === "string") {
    let s = v.slice(0, Math.max(0, budget - 2));
    while (s && size(s) > budget) s = s.slice(0, s.length - Math.max(1, size(s) - budget));
    return s;
  }
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    let used = 2;
    for (const item of v) {
      const n = size(item) + 1;
      if (used + n > budget) {
        if (!out.length) out.push(cut(item, budget - 2));
        break;
      }
      out.push(item);
      used += n;
    }
    return out;
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
    for (let guard = 0; guard < 100 && size(out) > budget; guard++) {
      const [k, x] = Object.entries(out).reduce((a, b) => (size(b[1]) > size(a[1]) ? b : a));
      const smaller = cut(x, Math.max(0, size(x) - (size(out) - budget)));
      if (size(smaller) >= size(x)) break;
      out[k] = smaller;
    }
    return out;
  }
  return v;
}

/**
 * Hard cap on what goes back to the agent. Arrays are cut at an item boundary, and an item too big
 * on its own is cut rather than dropped, so the output never reads as "no results". Strings are
 * cut as strings and objects stay objects (their biggest members shortened), never cut JSON text.
 */
export function capOutput(value: unknown, maxChars = 20_000): { data: unknown; truncated?: string } {
  const total = size(value);
  if (total <= maxChars) return { data: value };
  const data = cut(value, maxChars);
  if (Array.isArray(value)) {
    const n = (data as unknown[]).length;
    const whole = n && size((data as unknown[])[n - 1]) === size(value[n - 1]);
    return {
      data,
      truncated: `showing ${n} of ${value.length} items${whole ? "" : " (the last one cut to fit)"} (cap ${maxChars} chars); narrow with pick or extract`,
    };
  }
  return { data, truncated: `cut to ${maxChars} of ${total} chars (long strings and arrays shortened); narrow with pick or extract` };
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
