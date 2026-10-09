/**
 * What counts as a credential, and the scan that finds one in a spec. Learning uses these to turn
 * credentials into references and to check none is left; the store uses them before a save or an export.
 */
import type { Step } from "./codec.js";
import type { Session } from "./session.js";

export const SESSION_HEADER =
  /^(authorization|x-[a-z0-9-]*token|x-csrf[a-z0-9-]*|x-xsrf[a-z0-9-]*|x-goog-batchexecute-bgr|x-client-transaction-id|x-fb-lsd|x-ig-www-claim)$/i;
// Per-session credentials sent in forms, queries or JSON bodies: Google's `at`, Meta's fb_dtsg/lsd,
// Rails', ASP.NET's anti-CSRF fields, and OAuth-style access tokens.
export const SESSION_FIELD =
  /^(at|fb_dtsg|lsd|authenticity_token|__RequestVerificationToken|_?csrf(_?token)?|_?xsrf(_?token)?|csrfmiddlewaretoken|(access_?)?token|session_?id)$/i;

export const headerName = (at: Step[]) => (at[0]!.startsWith("header:") ? at[0]!.slice(7) : undefined);
export const lastToken = (at: Step[]) => {
  const s = at[at.length - 1]!;
  return s.startsWith("json:") ? s.slice(s.lastIndexOf("/") + 1) : s.slice(s.indexOf(":") + 1);
};
/** The name a leaf goes by: its header, field, query key or JSON key. */
export const leafName = (at: Step[]) => headerName(at) ?? lastToken(at);

// Words that name a credential in a key or header: api_key, authToken, x-session-id, sid, X-Amz-Signature.
const CREDENTIAL_WORD =
  /^(?:auth(?!or)[a-z0-9]*|[a-z0-9]*(?:token|secret|key|signature|password|passwd|pwd|credential|bearer)s?|sess(?:ion)?[a-z0-9]*|sid)$/;

/** A key or header named like a credential, judged by its words (authToken -> auth, token; "author" is not). */
export function credentialName(name: string): boolean {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((w) => CREDENTIAL_WORD.test(w));
}

export const URLISH = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Random-looking: 16+ chars, no spaces, not a URL, two character classes, 3+ bits of entropy per char. */
export function highEntropy(v: string): boolean {
  if (v.length < 16 || /\s/.test(v) || URLISH.test(v)) return false;
  if ([/[a-z]/, /[A-Z]/, /\d/].filter((r) => r.test(v)).length < 2) return false;
  const n = new Map<string, number>();
  for (const c of v) n.set(c, (n.get(c) ?? 0) + 1);
  let bits = 0;
  for (const k of n.values()) bits -= (k / v.length) * Math.log2(k / v.length);
  return bits >= 3;
}

/** A literal a spec must not hold: a per-session field or header, or a random value under a credential's name. */
export function isCredential(name: string, value: string): boolean {
  return (
    ((SESSION_FIELD.test(name) || SESSION_HEADER.test(name)) && value.length >= 8) ||
    (credentialName(name) && highEntropy(value))
  );
}

/**
 * A token and nothing else, under any name: one unbroken run of 16+ characters of the hex or
 * URL-safe base64 alphabet that is random-looking. Words and numbers joined by - or _ are not one,
 * however long (a slug, page-1-sort-relevance), and any other character breaks the run: `:`, `/`,
 * `.`, `=` and `+` separate the parts of structured text.
 */
export function opaqueToken(text: string): boolean {
  const worded = text.split(/[-_]/).every((part) => /^[A-Za-z]*\d*$/.test(part));
  return /^[A-Za-z0-9_-]{16,}$/.test(text) && highEntropy(text) && !worded;
}

/* ------------------------------------------------------------------- scan */

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
const jsonUnescape = (s: string) =>
  s.replace(/\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g, (_, c: string) =>
    c.length > 1 ? String.fromCharCode(parseInt(c.slice(1), 16)) : (ESC[c] ?? c),
  );

/** Base64 (or base64url) runs that decode to text. */
function base64Texts(s: string): string[] {
  return [...s.matchAll(/[A-Za-z0-9+/_-]{16,}={0,2}/g)]
    .map((m) => Buffer.from(m[0], "base64").toString("utf8"))
    .filter((t) => t && !/[\uFFFD\x00-\x08\x0e-\x1f]/.test(t));
}

/**
 * A test for text that holds `value` base64-encoded, whatever stands before or after it. Decoding
 * the text whole does not find that: text in front shifts every byte, and a short value's run is
 * too short to tell from a word. So the value's own encoding is looked for, at each of the three
 * byte offsets and in the standard and the URL-safe alphabet, without the characters that also
 * carry a neighbouring byte. Those characters carry bits of the value too, so another value can
 * share what is left ("xqbcdef" with "abcdef"): a find only says where to look, and the bytes
 * decoded there, at that offset, must be the value's.
 */
function inBase64(value: string): (text: string) => boolean {
  const bytes = Buffer.from(value, "utf8");
  const places = [0, 1, 2].flatMap((lead) => {
    const whole = Buffer.concat([Buffer.alloc(lead), bytes])
      .toString("base64")
      .replace(/=+$/, "");
    // the first characters hold the bytes in front, and the last one bits of the byte that follows
    const skip = [0, 2, 3][lead]!;
    const core = whole.slice(skip, (lead + bytes.length) % 3 ? -1 : undefined);
    const cores = new Set([core, core.replace(/\+/g, "-").replace(/\//g, "_")]);
    return [...cores].map((c) => ({ core: c, lead, skip, length: whole.length }));
  });
  return (text) =>
    places.some(({ core, lead, skip, length }) => {
      for (let i = text.indexOf(core); i >= 0; i = text.indexOf(core, i + 1)) {
        if (i < skip) continue;
        const there = Buffer.from(text.slice(i - skip, i - skip + length), "base64");
        if (there.subarray(lead, lead + bytes.length).equals(bytes)) return true;
      }
      return false;
    });
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
        if (out.has(d)) continue;
        out.add(d);
        next.push(d);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Whether `text` is one of `values` and nothing more, in a form the scan reads: as it is,
 * percent-encoded, JSON-escaped or base64, the value raw, unquoted or URL-decoded. There is no
 * length floor: it is for text that may hold no known value at all (an object key in a credential
 * container), and it asks for the whole text, since a one-character value is inside most words.
 */
export function isLiveValue(text: string, values: Iterable<string>): boolean {
  const forms = decodings(text);
  const unpadded = new Set([...forms].map((f) => f.replace(/=+$/, "")));
  for (const value of values)
    for (const v of new Set([value, value.replace(/^"|"$/g, ""), pctDecode(value, false)])) {
      const b64 = Buffer.from(v, "utf8").toString("base64").replace(/=+$/, "");
      if (v && (forms.has(v) || unpadded.has(b64) || unpadded.has(b64.replace(/\+/g, "-").replace(/\//g, "_"))))
        return true;
    }
  return false;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/i;
/** A literal IP address (a client's remoteHost the page reported): the user's, not the site's. */
const ipAddress = (v: string) =>
  (IPV4.test(v) && !/^(127\.|0\.)|\.0$/.test(v)) ||
  (IPV6.test(v) && (v.includes("::") || v.split(":").length >= 5) && v !== "::1");
/**
 * An IP address anywhere in a leaf: the whole value, "ip:port", an x-forwarded-for list, "ip=.."
 * text. A version string is not one: "Chrome/120.0.0.0" follows a letter or "/", and ends in .0.
 */
export function ipIn(v: string): string | undefined {
  for (const m of v.matchAll(/[0-9A-Fa-f:.]+/g)) {
    const before = v[m.index - 1] ?? "";
    let t = m[0].replace(/^[.:]+|[.:]+$/g, "");
    if (t.includes(".")) t = t.replace(/:\d{1,5}$/, ""); // ip:port
    if (t.includes(".") && /[\w/]/.test(before)) continue; // a version: v1.2.3.4, Chrome/1.2.3.4
    if (ipAddress(t)) return t;
  }
  return undefined;
}

/**
 * `secrets`: exact hits of live jar/session values (6+ chars, raw, unquoted or URL-decoded). Each
 * is looked for in the text and in what the text decodes to (three layers of percent-encoding,
 * JSON escapes and whole base64 runs), and by its own base64 encoding at any byte offset, confirmed
 * by decoding there. A hit is the value itself, so callers fail closed. `warnings`: regex heuristics, which do misfire.
 * `allowed`: JSON paths a human marked public (an op's `public` headers); skipped.
 */
export function scanSecrets(
  value: unknown,
  session: Session,
  allowed: Set<string> = new Set(),
): { secrets: string[]; warnings: string[] } {
  const live: [string, string, (text: string) => boolean][] = [];
  const add = (label: string, v: string) => {
    for (const f of new Set([v, v.replace(/^"|"$/g, ""), pctDecode(v, false)]))
      if (f.length >= 6) live.push([label, f, inBase64(f)]);
  };
  for (const c of session.cookies) add(`cookie ${c.name}`, c.value);
  for (const [k, v] of Object.entries(session.values)) add(`session value ${k}`, v);
  const secrets: string[] = [];
  const warnings: string[] = [];
  const visit = (v: unknown, path: string) => {
    if (allowed.has(path)) return;
    if (typeof v === "string") {
      const forms = live.length ? [...decodings(v)] : [];
      for (const [label, s, encoded] of live)
        if (forms.some((f) => f.includes(s) || encoded(f))) secrets.push(`${path} holds the live ${label}`);
      const text = pctDecode(v, false); // percent-encoded bodies hide the blob's shape
      const hit = (
        [
          ["a JWT", JWT],
          ["a bearer token", BEARER],
          ["a long hex blob", HEX_BLOB],
          ["a long base64 blob", BASE64_BLOB],
        ] as const
      )
        .map(
          ([why, re]) =>
            [
              why,
              [...text.matchAll(new RegExp(re, "g"))]
                .map((m) => m[0])
                .find((m) => why !== "a long base64 blob" || RANDOM(m)),
            ] as const,
        )
        .find(([, m]) => m);
      if (hit) warnings.push(`${path} looks like ${hit[0]} (${hit[1]!.slice(0, 24)}...); check it is public`);
    } else if (Array.isArray(v)) {
      for (const [i, x] of v.entries()) visit(x, `${path}[${i}]`);
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`);
  };
  visit(value, "$");
  return { secrets: [...new Set(secrets)], warnings: [...new Set(warnings)] };
}
