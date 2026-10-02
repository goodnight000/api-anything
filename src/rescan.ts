/** Rescan: the browserless heal. Pure: the caller supplies how a URL is fetched. */
import { asText, fillTemplate, getAt, setAt, walk } from "./codec.js";
import { hashLike, type Args } from "./learn.js";
import type { Operation, Trigger, Volatile } from "./spec.js";
import type { TriggerStep } from "./types.js";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Fill `{param}` in a trigger. URL parts are percent-encoded; step values are typed as given. */
export function fillTrigger(t: Trigger, args: Args): Trigger {
  const enc = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, encodeURIComponent(asText(v))]));
  const step = (s: TriggerStep): TriggerStep => ({
    ...s,
    ...(s.selector !== undefined ? { selector: fillTemplate(s.selector, args) } : {}),
    ...(s.value !== undefined ? { value: fillTemplate(s.value, s.action === "goto" ? enc : args) } : {}),
  });
  return {
    url: fillTemplate(t.url, enc),
    ...(t.softFrom ? { softFrom: fillTemplate(t.softFrom, enc) } : {}),
    ...(t.steps ? { steps: t.steps.map(step) } : {}),
  };
}

const CHARSET: Record<Volatile["shape"]["charset"], [string, string]> = {
  // [token chars, chars that must not touch the token]
  digits: ["0-9", "0-9A-Za-z_"],
  hex: ["0-9a-fA-F", "0-9A-Za-z_"],
  base64url: ["A-Za-z0-9_-", "A-Za-z0-9_-"],
  base64: ["A-Za-z0-9+/=", "A-Za-z0-9+/="],
};
const NEAR = 300;

/**
 * Whether text between a token and its anchor (read left to right) keeps them in one group: no
 * bracket closes the group the scan started in, and no `;` ends a statement at that level. Meta's
 * `}),null);__d(` and X's `}},13:e=>{` end the previous module; a `"use strict";` nested inside the
 * anchor's own module does not.
 * ponytail: brackets inside string literals count too; a bundle string holding `}` could mislead it.
 */
function sameGroup(between: string): boolean {
  let depth = 0;
  for (const c of between) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (--depth < 0) return false;
    } else if (c === ";" && depth === 0) return false;
  }
  return true;
}

/**
 * The token of the recorded shape next to the anchor. The anchor must stand as its own name
 * ("Followers" is not inside "FollowersYouKnow"), and an occurrence in code beats one in prose
 * (a log message "B failed", whitespace next to it). A token in the anchor's own group beats a
 * nearer one across a module boundary; a tie between two tokens is no answer.
 * `strict` (writes, whose validation is a real send): only a token that is the one candidate.
 */
function nearestToken(texts: string[], v: Volatile, strict = false): string | undefined {
  const [chars, bound] = CHARSET[v.shape.charset];
  const re = new RegExp(`(?<![${bound}])[${chars}]{${v.shape.length}}(?![${bound}])`, "g");
  const anchor = new RegExp(`(?<![A-Za-z0-9$])${escapeRe(v.anchor)}(?![A-Za-z0-9$])`, "g");
  const found: { token: string; d: number; same: boolean; prose: boolean }[] = [];
  for (const text of texts) {
    for (const a of text.matchAll(anchor)) {
      const i = a.index;
      const from = Math.max(0, i - NEAR);
      const anchorEnd = i + v.anchor.length;
      const prose = /\s/.test(text[i - 1] ?? "") || /\s/.test(text[anchorEnd] ?? "");
      for (const m of text.slice(from, anchorEnd + NEAR).matchAll(re)) {
        const token = m[0];
        if (v.shape.charset !== "digits" && !hashLike(token)) continue;
        const start = from + m.index;
        const end = start + token.length;
        if (end > i && start < anchorEnd) continue; // overlaps the anchor itself
        const between = end <= i ? text.slice(end, i) : text.slice(anchorEnd, start);
        found.push({ token, d: between.length, same: sameGroup(between), prose });
      }
    }
  }
  const code = found.some((f) => !f.prose) ? found.filter((f) => !f.prose) : found;
  const pool = code.some((f) => f.same) ? code.filter((f) => f.same) : strict ? [] : code;
  if (strict) {
    const distinct = new Set(pool.map((f) => f.token));
    return distinct.size === 1 ? [...distinct][0] : undefined;
  }
  const best = Math.min(...pool.map((f) => f.d));
  const tied = new Set(pool.filter((f) => f.d === best).map((f) => f.token));
  return tied.size === 1 ? [...tied][0] : undefined;
}

/** Fetches one URL as text; `url` is where it ended up after redirects. Empty text when it failed. */
export type FetchText = (url: string, headers: Record<string, string>) => Promise<{ text: string; url: string }>;

/**
 * Browserless heal: fetch the trigger document and the scripts it references, and swap in the
 * token of each volatile's shape nearest its anchor. Undefined when nothing new was found.
 * Every fetch goes through `fetchText`, so the caller owns transport, credentials and redirects.
 */
export async function rescanOperation(op: Operation, args: Args, fetchText: FetchText): Promise<{ operation: Operation; diff: string } | undefined> {
  if (!op.volatile.length) return undefined;
  const url = fillTrigger(op.trigger, args).url;
  const ua = op.request.headers["user-agent"];
  const headers: Record<string, string> = ua ? { "user-agent": ua } : {};
  const { text: doc, url: docUrl } = await fetchText(url, headers);
  if (!doc) return undefined;
  // relative to the document's final URL: a redirect (a locale prefix) moves where "../static" points
  const refs = [
    ...doc.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ...doc.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.m?js(?:\?[^"']*)?)["']/gi),
  ].map((m) => new URL(m[1]!, docUrl).href);
  // ponytail: only scripts the document references directly; ids in lazily loaded chunks need recapture.
  const scripts = await Promise.all([...new Set(refs)].slice(0, 40).map(async (s) => (await fetchText(s, headers)).text));
  const texts = [doc, ...scripts];

  const types = new Map(walk(op.request).map((l) => [JSON.stringify(l.at), l.type]));
  let request = op.request;
  const changes: string[] = [];
  for (const v of op.volatile) {
    const old = asText(getAt(op.request, v.at));
    const token = nearestToken(texts, v, !op.readOnly);
    if (!token || token === old) continue;
    const numeric = types.get(JSON.stringify(v.at)) === "number";
    request = setAt(request, v.at, numeric ? BigInt(token) : token);
    changes.push(`${v.at.join(" > ")}: ${old} -> ${token}`);
  }
  return changes.length ? { operation: { ...op, request }, diff: changes.join("; ") } : undefined;
}
