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

/** JSON text: an object or an array, whose leaves are judged one by one and whose siblings are not copies. */
export const jsonContainer = (v: string) => /^\s*[[{]/.test(v);

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

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/i;
/** A literal IP address (a client's remoteHost the page reported): the user's, not the site's. */
const ipAddress = (v: string) =>
  (IPV4.test(v) && !/^(127\.|0\.)|\.0$/.test(v)) ||
  (IPV6.test(v) && (v.includes("::") || v.split(":").length >= 5) && v !== "::1");
/**
 * An IP address anywhere in a leaf: the whole value, "ip:port", an x-forwarded-for list, "ip=.."
 * text. A version string is not one: "Chrome/120.0.0.0" follows a letter or "/", and ends in .0;
 * "1.3.6.68.gbe30f56" runs on into a word.
 */
export function ipIn(v: string): string | undefined {
  for (const m of v.matchAll(/[0-9A-Fa-f:.]+/g)) {
    const before = v[m.index - 1] ?? "";
    let t = m[0].replace(/^[.:]+|[.:]+$/g, "");
    if (t.includes(".")) t = t.replace(/:\d{1,5}$/, ""); // ip:port
    const after = v[m.index + m[0].length] ?? "";
    // a version: v1.2.3.4, Chrome/1.2.3.4, 1.3.6.68.gbe30f56 (a build hash after it)
    if (t.includes(".") && (/[\w/]/.test(before) || /\w/.test(after))) continue;
    if (ipAddress(t)) return t;
  }
  return undefined;
}

/** The addresses an operation sends to or opens. */
export const opUrls = (op: { request: { url: string }; trigger: { url: string; softFrom?: string } }) => [
  op.request.url,
  op.trigger.url,
  op.trigger.softFrom,
];

/** The origins of `urls` (`https://www.x.test`), the http(s) ones whose host is no template. */
export function originsOf(urls: readonly (string | undefined)[]): Set<string> {
  const origins = new Set<string>();
  for (const u of urls) {
    try {
      if (u && /^https?:/i.test(u)) origins.add(new URL(u).origin);
    } catch {
      /* a template the host is filled into: no origin to spell */
    }
  }
  return origins;
}

/**
 * The session without the values that are one of the origins of `urls` (`https://www.x.test/`, the
 * last page an analytics cookie kept), raw, unquoted or URL-decoded. A spec spells the host it
 * sends to and opens, so such a value carries nothing the spec does not hold already, wherever a
 * copy of it is: it is no credential to look for, and nothing to make a ref of.
 */
export function besideOrigins<S extends Pick<Session, "cookies" | "values">>(
  session: S,
  urls: readonly (string | undefined)[],
): S {
  const origins = originsOf(urls);
  const own = (v: string) =>
    [v, v.replace(/^"|"$/g, ""), pctDecode(v, false)].some((f) => origins.has(f.replace(/\/$/, "")));
  return {
    ...session,
    cookies: session.cookies.filter((c) => !own(c.value)),
    values: Object.fromEntries(Object.entries(session.values).filter(([, v]) => !own(v))),
  };
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

/**
 * The session a save-time scan looks for. Learning records which of a site's session values are
 * settings (a theme, a locale: a ref keeps one fresh, it does not make it secret), and a recorded
 * setting is left out of the scan only when all four hold: it is no JSON container (one carries
 * credentials whose own refs were dropped, and a refresh can put a new one in); its own text is no
 * credential; no protected text holds it, in any encoding the scan reads (a setting also sent as a
 * bearer is a copy of that bearer); and it holds no protected value. Protected is every cookie and
 * every session value that is not itself a candidate: a credential classification of the same bytes
 * wins, and no later learn undoes one. A setting that loses its exemption is protected in turn, and
 * the last two tests are asked again against it until nothing more is protected: the scan reads a few
 * decoding layers, so a chain of settings would otherwise carry a credential further than any one of
 * them can. A name no learn classified, an older file's included, is scanned like a credential. This runs twice over:
 * once where a learn classifies what it stored, over everything it saw live, since a credential it did not store is
 * gone by the time a save-time scan asks, and a setting it did not store is entered there as a link in that chain
 * (`sessionRefs`); and at every session write, which records what it keeps
 * (`recordProtection`), so a rotation cannot take a protection apart.
 */
export function credentialsOf(session: Session): Session {
  const kinds = session.kinds ?? {};
  const entries = Object.entries(session.values);
  if (!entries.some(([k]) => kinds[k] === "setting")) return session;
  const shaped = (v: string) => highEntropy(v) || scanSecrets(v, { cookies: [], values: {} }).warnings.length > 0;
  // What may be left out at all: a recorded setting that is no container and no credential itself.
  const candidate = (k: string, v: string) => kinds[k] === "setting" && !jsonContainer(v) && !shaped(v);
  // Everything a credential classification protects, grown to a fixpoint. A candidate is never
  // scanned against itself: only what is already protected is on either side of the two tests.
  const kept = new Set(entries.filter(([k, v]) => !candidate(k, v)).map(([k]) => k));
  for (let grew = true; grew; ) {
    grew = false;
    const values = Object.fromEntries(entries.filter(([k]) => kept.has(k)));
    const protect: Session = { cookies: session.cookies, values };
    const texts = [...session.cookies.map((c) => c.value), ...Object.values(values)];
    const open = entries.filter(([k]) => !kept.has(k));
    // Both tests as one scan each: a scan's cost is its setup (a live list, each text's decodings), so
    // asking per value costs as many scans as there are values. The index each side reports names the
    // value: the label in what a protected text holds, the path in what a value holds.
    const hit = new Set<number>();
    const live = Object.fromEntries(open.map(([, v], i) => [String(i), v]));
    for (const s of scanSecrets(texts, { cookies: [], values: live }).secrets) hit.add(Number(s.split(" ").pop()));
    for (const s of scanSecrets(
      open.map(([, v]) => v),
      protect,
    ).secrets)
      hit.add(Number(/^\$\[(\d+)\]/.exec(s)![1]));
    for (const i of hit) {
      kept.add(open[i]![0]);
      grew = true;
    }
  }
  return { ...session, values: Object.fromEntries(entries.filter(([k]) => kept.has(k))) };
}
