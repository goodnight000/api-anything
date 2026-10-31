/**
 * A list's paging, found in a capture. The next page is a second request to the same endpoint that
 * differs from the first in one place, and the first one's answer holds the value sent there: a
 * cursor, whole or as a query param of a next-page URL. With no cursor in the answer, a value that
 * counts up by one is a page number.
 */
import { asText, getAt, type Leaf, setAt, walk } from "./codec.js";
import { innerJson, parseBody } from "./extract.js";
import type { Args } from "./learn.js";
import { step } from "./outline.js";
import type { Operation, Paging } from "./spec.js";
import type { Exchange } from "./types.js";

export interface PagingHint {
  /** the request that loads a page, and the one that loads the page after it (an op learns from this one) */
  previous: number;
  request: number;
  /** where the page's value goes in the request, as codec steps */
  at: string[];
  /** what `request` sent there: an op learned from it takes this as the paging param's example */
  value: string;
  paging: Paging;
}

// A short or all-digit value is found by chance in most answers (a count, a rating), and a value in a
// list's items is often another item's id (a related item, not the next page): either is a cursor only
// under a key that says so.
const PAGE_KEY = /next|cursor|after|token|continu/i;
const NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const PAGED = new Set(["document", "xhr", "fetch"]);

/** The places a request sends values. Headers are left out: a trace id differs on every request. */
function placesOf(e: Exchange): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  for (const l of walk(e.request)) if (!l.at[0]!.startsWith("header:")) out.set(l.at.join(" > "), l);
  return out;
}

const endpoint = (e: Exchange) => {
  try {
    const u = new URL(e.request.url);
    return `${e.request.method.toUpperCase()} ${u.origin} ${u.pathname.split("/").length}`;
  } catch {
    return undefined;
  }
};

/** Paths (getPath syntax) to the values in `root` that `hit` accepts, stepping into JSON strings. */
function pathsWhere(root: unknown, hit: (v: string | number, path: string) => boolean, max = 20): string[] {
  const out: string[] = [];
  const visit = (v: unknown, path: string, depth: number) => {
    if (out.length >= max || depth > 12) return;
    if (typeof v === "string") {
      const inner = innerJson(v);
      if (inner && typeof inner === "object") return visit(inner, path, depth);
    }
    if (typeof v === "string" || typeof v === "number") {
      if (path && hit(v, path)) out.push(path);
      return;
    }
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) for (const [i, c] of v.slice(0, 100).entries()) visit(c, `${path}[${i}]`, depth + 1);
    else for (const [k, c] of Object.entries(v)) visit(c, step(path, k), depth + 1);
  };
  visit(root, "", 0);
  return out;
}

const lastKey = (path: string) =>
  /(?:^|\.)([^.[\]]+)$|\["((?:[^"\\]|\\.)*)"\]$|\[\d+\]$/.exec(path)?.slice(1).find(Boolean) ?? "";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The path into the list's own items holds the same cursor per item (GraphQL's edges[i].cursor): the one outside them wins.
const rank = (p: string) => [(p.match(/\[\d+\]/g) ?? []).length, p.length];
const best = (paths: string[]) =>
  [...paths].sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0]! - y[0]! || x[1]! - y[1]!;
  })[0];

/** The param name a place suggests: its query or form key, or its JSON key. */
function nameAt(steps: string[]): string | undefined {
  for (const s of [...steps].reverse()) {
    if (s === "b64") continue;
    const m = /^(?:query|form)(?:\[\d+\])?:(.+)$/.exec(s);
    if (m) return m[1];
    if (s.startsWith("json:")) {
      const token = s.slice(5).split("/").at(-1)!;
      return /^\d+$/.test(token) ? undefined : token.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    return undefined;
  }
  return undefined;
}

/** Where `first`'s answer gives `value`: a path to it, or `path~regex` into a next-page URL that carries it as `key`. */
function nextAt(first: Exchange, value: string, steps: string[]): string | undefined {
  let root: unknown;
  try {
    root = parseBody(first.response?.body ?? "");
  } catch {
    return undefined;
  }
  if (!root || typeof root !== "object") return undefined;
  const weak = value.length < 4 || /^\d+$/.test(value);
  const named = (p: string) => (!weak && !/\[\d+\]/.test(p)) || PAGE_KEY.test(lastKey(p));
  const exact = best(pathsWhere(root, (v, p) => String(v) === value && named(p)));
  if (exact) return exact;
  // a next-page URL (`"?page=2&q=x"`): the cursor is its query param, read out by a regex
  const key = steps.length === 1 ? /^(?:query|form)(?:\[\d+\])?:(.+)$/.exec(steps[0]!)?.[1] : undefined;
  if (!key) return undefined;
  const pair = new RegExp(
    `[?&]${escapeRe(key)}=(?:${escapeRe(value)}|${escapeRe(encodeURIComponent(value))})(?:[&#]|$)`,
  );
  const url = best(pathsWhere(root, (v, p) => typeof v === "string" && pair.test(v) && named(p)));
  return url && `${url}~[?&]${escapeRe(key)}=([^&#]*)`;
}

/** What `request` tells about paging after `first`, if they are two pages of one list. */
function pairOf(first: Exchange, request: Exchange): PagingHint | undefined {
  const a = placesOf(first);
  const b = placesOf(request);
  // page 2 may add a cursor page 1 lacked, never drop one of its values
  if ([...a.keys()].some((k) => !b.has(k))) return undefined;
  const diff = [...b.keys()].filter((k) => a.get(k)?.value !== b.get(k)!.value);
  // one place: the deepest, and the containers it sits in (a JSON body around a variable) change with it
  const deepest = diff.find((k) => diff.every((o) => o === k || k.startsWith(`${o} > `)));
  if (!deepest) return undefined;
  // the deepest first: a cursor that is base64 of JSON is walked into, and its whole text is the value
  const chain = [...diff].sort((x, y) => y.length - x.length);
  for (const at of chain) {
    const value = b.get(at)!.value;
    if (!value || value === "null") continue;
    const steps = b.get(at)!.at;
    const next = nextAt(first, value, steps);
    const name = nameAt(steps);
    if (next)
      return {
        previous: first.id,
        request: request.id,
        at: steps,
        value,
        paging: { param: name && NAME.test(name) ? name : "cursor", next },
      };
    // numbered: page n, then n + 1 (page 1 may leave the number out)
    const was = a.get(at)?.value;
    if (
      at === deepest &&
      /^\d+$/.test(value) &&
      (was === undefined ? value === "2" : /^\d+$/.test(was) && Number(value) === Number(was) + 1)
    )
      return {
        previous: first.id,
        request: request.id,
        at: steps,
        value,
        paging: { param: name && NAME.test(name) ? name : "page" },
      };
  }
  return undefined;
}

/**
 * Every list in the capture that pages, once each: for a request, the latest earlier request it is
 * the next page of. Three pages of one list give the same hint twice; the first is kept.
 */
export function pagingHints(exchanges: Exchange[]): PagingHint[] {
  const pages = exchanges.filter(
    (e) => PAGED.has(e.resourceType) && !e.aborted && e.response && e.response.status < 300 && endpoint(e),
  );
  const out: PagingHint[] = [];
  const seen = new Set<string>();
  for (const [i, request] of pages.entries()) {
    for (let j = i - 1; j >= 0; j--) {
      const first = pages[j]!;
      if (endpoint(first) !== endpoint(request)) continue;
      const h = pairOf(first, request);
      if (!h) continue;
      const key = `${endpoint(request)} ${h.at.join(" > ")} ${h.paging.param} ${h.paging.next ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(h);
      }
      break;
    }
  }
  return out;
}

/** The `--paging` flag's value for a hint. */
export const pagingFlag = (p: Paging) => (p.next ? `${p.param}=${p.next}` : p.param);

type Run = { exchanges: Exchange[] };

/**
 * Learning locates a param by its example value, and a value under 3 characters (page "2") is not
 * located unless run 2 holds another one: two runs of the same list both send page 2. When paging found
 * the place (`pagingHints`), each run's request gets a stand-in there instead, in a copy of the run, and
 * the op learned from it gets the run's own value back with `restore`. Only for a cursor (`next`): the
 * paging param is then optional and its example dropped, so no stand-in is left in the op.
 */
export function standIn<C extends Run>(
  paging: Paging | undefined,
  examples: [Args] | [Args, Args],
  from: { capture: C; id?: number } | undefined,
  from2: C | undefined,
):
  | {
      examples: [Args] | [Args, Args];
      from: { capture: C; id?: number };
      from2?: C;
      restore: (op: Operation) => Operation;
    }
  | undefined {
  const param = paging?.param;
  const [ex1, ex2] = examples;
  if (!paging?.next || !param || !from || from.id === undefined || ex1[param] === undefined) return undefined;
  const short = asText(ex1[param]);
  if (short.length >= 3) return undefined;
  const h1 = pagingHints(from.capture.exchanges).find((h) => h.request === from.id && h.value === short);
  const h2 =
    from2 && ex2?.[param] !== undefined
      ? pagingHints(from2.exchanges).find((h) => h.value === asText(ex2[param]) && h.at.join() === h1?.at.join())
      : undefined;
  if (!h1 || (from2 && ex2 && !h2)) return undefined;
  const put = <R extends Run>(run: R, h: PagingHint, token: string): R => ({
    ...run,
    exchanges: run.exchanges.map((e) => (e.id === h.request ? { ...e, request: setAt(e.request, h.at, token) } : e)),
  });
  const token = (n: number) => `pagingstandin${n}`;
  // as it was, a JSON number staying a number
  const was = getAt(from.capture.exchanges.find((e) => e.id === h1.request)!.request, h1.at);
  return {
    examples: ex2
      ? [
          { ...ex1, [param]: token(1) },
          { ...ex2, [param]: h2 ? token(2) : ex2[param] },
        ]
      : [{ ...ex1, [param]: token(1) }],
    from: { ...from, capture: put(from.capture, h1, token(1)) },
    ...(from2 && h2 ? { from2: put(from2, h2, token(2)) } : {}),
    restore: (op) => ({
      ...op,
      request: op.slots
        .filter((s) => s.param === param && s.template === undefined && getAt(op.request, s.at) === token(1))
        .reduce((req, s) => setAt(req, s.at, was), op.request),
    }),
  };
}
