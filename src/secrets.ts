/** Scan a spec for live credentials. Pure: the caller supplies the session to compare against. */
import type { Session } from "./cookies.js";

const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/;
const HEX_BLOB = /\b[0-9a-fA-F]{32,}\b/;
// "/" left out: every long URL path would match
const BASE64_BLOB = /[A-Za-z0-9+_-]{40,}={0,2}/;
const BEARER = /^Bearer\s+\S{20,}/i;
// identifiers like __relay_internal__pv__appviewerisloggedinprovider are long too; tokens mix case and digits
const RANDOM = (s: string) => /\d/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s);

/** Decode every %XX run on its own, so one stray "%" doesn't hide the rest. */
function pctDecode(s: string, plus: boolean): string {
  return (plus ? s.replace(/\+/g, " ") : s).replace(/(?:%[0-9a-fA-F]{2})+/g, (m) => {
    try {
      return decodeURIComponent(m);
    } catch {
      return m;
    }
  });
}

const ESC: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
const jsonUnescape = (s: string) => s.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g, (_, c: string) => (c.length > 1 ? String.fromCharCode(parseInt(c.slice(1), 16)) : (ESC[c] ?? c)));

/** Base64 (or base64url) runs that decode to text. */
function base64Texts(s: string): string[] {
  return [...s.matchAll(/[A-Za-z0-9+/_-]{16,}={0,2}/g)]
    .map((m) => Buffer.from(m[0], "base64").toString("utf8"))
    .filter((t) => t && !/[\uFFFD\x00-\x08\x0e-\x1f]/.test(t));
}

/**
 * Every text a spec string may hide a value in: percent-decoded (+ as a space or not),
 * JSON-unescaped (`\/`, `\u002b`) and base64 runs decoded, in any order, up to 3 layers deep.
 */
function decodings(v: string): Set<string> {
  const out = new Set([v]);
  let frontier = [v];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const d of [pctDecode(f, false), pctDecode(f, true), jsonUnescape(f), ...base64Texts(f)]) {
        if (!out.has(d)) (out.add(d), next.push(d));
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * `secrets`: exact hits of live jar/session values (6+ chars, raw, unquoted or URL-decoded) under
 * any encoding the spec may carry them in: no false positives, so callers fail closed. `warnings`:
 * regex heuristics, which do misfire. `allowed`: JSON paths a human marked public (an op's
 * `public` headers); skipped.
 */
export function scanSecrets(value: unknown, session: Session, allowed: Set<string> = new Set()): { secrets: string[]; warnings: string[] } {
  const live: [string, string][] = [];
  const add = (label: string, v: string) => {
    for (const f of new Set([v, v.replace(/^"|"$/g, ""), pctDecode(v, false)])) if (f.length >= 6) live.push([label, f]);
  };
  for (const c of session.cookies) add(`cookie ${c.name}`, c.value);
  for (const [k, v] of Object.entries(session.values)) add(`session value ${k}`, v);
  const secrets: string[] = [];
  const warnings: string[] = [];
  const visit = (v: unknown, path: string) => {
    if (allowed.has(path)) return;
    if (typeof v === "string") {
      const forms = live.length ? [...decodings(v)] : [];
      for (const [label, s] of live) if (forms.some((f) => f.includes(s))) secrets.push(`${path} holds the live ${label}`);
      const text = pctDecode(v, false); // percent-encoded bodies hide the blob's shape
      const hit = ([["a JWT", JWT], ["a bearer token", BEARER], ["a long hex blob", HEX_BLOB], ["a long base64 blob", BASE64_BLOB]] as const)
        .map(([why, re]) => [why, [...text.matchAll(new RegExp(re, "g"))].map((m) => m[0]).find((m) => why !== "a long base64 blob" || RANDOM(m))] as const)
        .find(([, m]) => m);
      if (hit) warnings.push(`${path} looks like ${hit[0]} (${hit[1]!.slice(0, 24)}...); check it is public`);
    } else if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`);
  };
  visit(value, "$");
  return { secrets: [...new Set(secrets)], warnings: [...new Set(warnings)] };
}
