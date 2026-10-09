/** Per-site cookie jar and session values under ~/.api-anything (0700 dirs, 0600 files). */
import {
  chmodSync,
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getDomain } from "tldts";
import type { StoredCookie } from "./types.js";

export interface Session {
  cookies: StoredCookie[];
  /** values of session: refs (auth/anti-bot headers), refreshed by every capture */
  values: Record<string, string>;
  /** where the cookies came from: "<browser>:<profile>" (import), "window", or "file"; drives self-heal re-import */
  source?: string;
  updatedAt?: string;
}

export const home = () => process.env.API_ANYTHING_HOME || join(homedir(), ".api-anything");

/**
 * Site names become file names; refuse anything that could leave the directory. Lower-cased, so
 * "EDGE" and "edge" are one site on every file system (and share one state).
 */
export function safeName(name: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes("..")) throw new Error(`invalid site name "${name}"`);
  return name.toLowerCase();
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}

/** Atomic write with 0600 (writeFile's mode is ignored for an existing file, hence the chmod). */
export function writePrivate(file: string, text: string): void {
  ensureDir(dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

export function readJson<T>(file: string, fallback: T): T {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`${file} is corrupt (${(e as Error).message}); fix or delete it`);
  }
}

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Run fn holding an exclusive lock file next to `file`, so a read-modify-write in one process
 * never drops another process's update. A lock older than 10 s is a crashed holder's and is taken over.
 */
export function withLock<T>(file: string, fn: () => T): T {
  ensureDir(dirname(file));
  const lock = `${file}.lock`;
  const deadline = Date.now() + 10_000;
  let held = false;
  while (!held) {
    try {
      closeSync(openSync(lock, "wx", 0o600));
      held = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 10_000) rmSync(lock, { force: true });
      } catch {
        /* released meanwhile */
      }
      // ponytail: after 10 s of contention go ahead unlocked rather than hang a call
      if (Date.now() > deadline) break;
      pause(2);
    }
  }
  try {
    return fn();
  } finally {
    if (held) rmSync(lock, { force: true });
  }
}

const CAPTURE_TTL_MS = 24 * 60 * 60_000;
const CAPTURES_KEPT = 20;

/**
 * Captures hold every response body and the run's cookie values, and one page can be tens of MB:
 * keep the newest 20, none older than 24 h. Runs after each new capture.
 */
export function pruneCaptures(now = Date.now()): void {
  const dir = join(home(), "captures");
  let files: { file: string; at: number }[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: join(dir, f), at: statSync(join(dir, f)).mtimeMs }));
  } catch {
    return; // no captures yet
  }
  files.sort((a, b) => b.at - a.at);
  files.forEach((f, i) => {
    if (i >= CAPTURES_KEPT || now - f.at > CAPTURE_TTL_MS) rmSync(f.file, { force: true });
  });
}

export const sessionFile = (site: string) => join(home(), "sessions", `${safeName(site)}.json`);

export function loadSession(site: string): Session {
  const file = sessionFile(site);
  const s = readJson<Partial<Session>>(file, {});
  if (!s || typeof s !== "object" || (s.cookies !== undefined && !Array.isArray(s.cookies)))
    throw new Error(`${file} is not a session file; delete it and log in again`);
  return { cookies: s.cookies ?? [], values: s.values ?? {}, source: s.source, updatedAt: s.updatedAt };
}

export function saveSession(site: string, s: Session): void {
  writePrivate(sessionFile(site), JSON.stringify({ ...s, updatedAt: new Date().toISOString() }, null, 1));
}

const expired = (c: StoredCookie, now: number) => c.expires > 0 && c.expires * 1000 <= now;

/** Merge a browser run's cookies and session values into the stored session and save it. */
/** The jar after a capture's cookies are merged in: the capture's win, and expired ones are dropped. */
export function mergeCookies(jar: StoredCookie[], cookies: StoredCookie[], now = Date.now()): StoredCookie[] {
  const key = (c: StoredCookie) => `${c.name}\0${c.domain.toLowerCase()}\0${c.path}`;
  const merged = new Map(jar.map((c) => [key(c), c]));
  for (const c of cookies) merged.set(key(c), c);
  return [...merged.values()].filter((c) => !expired(c, now));
}

export function mergeCapture(
  site: string,
  cookies: StoredCookie[],
  values: Record<string, string> = {},
  now = Date.now(),
): Session {
  return withLock(sessionFile(site), () => {
    const s = loadSession(site);
    const merged = {
      cookies: mergeCookies(s.cookies, cookies, now),
      values: { ...s.values, ...values },
      source: s.source,
    };
    saveSession(site, merged);
    return merged;
  });
}

function domainMatch(host: string, domain: string): boolean {
  const d = domain.toLowerCase();
  // Playwright marks domain cookies with a leading dot; without it the cookie is host-only.
  if (d.startsWith(".")) return host === d.slice(1) || host.endsWith(d);
  return host === d;
}

function pathMatch(reqPath: string, cookiePath: string): boolean {
  if (reqPath === cookiePath) return true;
  return reqPath.startsWith(cookiePath) && (cookiePath.endsWith("/") || reqPath[cookiePath.length] === "/");
}

/** RFC 6265 domain/path/secure/expiry matching, longest path first. */
export function cookiesFor(cookies: StoredCookie[], url: string, now = Date.now()): StoredCookie[] {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const secureOk = u.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
  return cookies
    .filter((c) => domainMatch(host, c.domain) && pathMatch(u.pathname || "/", c.path || "/"))
    .filter((c) => (!c.secure || secureOk) && !expired(c, now))
    .sort((a, b) => (b.path || "/").length - (a.path || "/").length);
}

export function cookieHeaderFor(cookies: StoredCookie[], url: string, now = Date.now()): string {
  return cookiesFor(cookies, url, now)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/**
 * The registrable domain ("site") of a host, by the Public Suffix List including its private
 * section (github.io, run.app, amazonaws.com hosts), so a cookie ref, a Set-Cookie Domain or a
 * browser import never reaches another site. An IP, localhost or a bare suffix is its own site.
 */
export const siteOf = (host: string): string => {
  const h = host.toLowerCase();
  return getDomain(h, { allowPrivateDomains: true }) ?? h;
};

/**
 * Value for a cookie: ref. Prefers a cookie that would be sent to url; else one from the same site
 * (page JS on www.site.com echoes its cookies to api.site.com), never another site's, and a Secure
 * cookie only over https.
 */
export function cookieValue(cookies: StoredCookie[], name: string, url?: string, now = Date.now()): string | undefined {
  const live = cookies.filter((c) => c.name === name && !expired(c, now));
  if (!url) return live[0]?.value;
  const scoped = cookiesFor(cookies, url, now).find((c) => c.name === name);
  if (scoped) return scoped.value;
  const u = new URL(url);
  const site = siteOf(u.hostname.toLowerCase());
  const secureOk = u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return live.find((c) => siteOf(c.domain.replace(/^\./, "").toLowerCase()) === site && (!c.secure || secureOk))?.value;
}

/** One Set-Cookie line, scoped per RFC 6265 to the URL that set it; undefined if it may not be set there. */
export function parseSetCookie(line: string, url: string, now = Date.now()): StoredCookie | undefined {
  const [pair = "", ...attrs] = line.split(";");
  const eq = pair.indexOf("=");
  if (eq < 1) return undefined;
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const dir = u.pathname.slice(0, u.pathname.lastIndexOf("/"));
  const c: StoredCookie = {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
    domain: host,
    path: dir.startsWith("/") ? dir : "/",
    expires: -1,
    httpOnly: false,
    secure: false,
  };
  let maxAge: number | undefined;
  for (const attr of attrs) {
    const i = attr.indexOf("=");
    const k = (i < 0 ? attr : attr.slice(0, i)).trim().toLowerCase();
    const v = i < 0 ? "" : attr.slice(i + 1).trim();
    if (k === "domain" && v) {
      const d = v.replace(/^\./, "").toLowerCase();
      // never a cookie for another site, or for a public suffix
      const site = siteOf(host);
      if ((host !== d && !host.endsWith(`.${d}`)) || (d !== site && !d.endsWith(`.${site}`))) return undefined;
      // a host that is itself a suffix (s3.amazonaws.com, localhost) gets a host-only cookie, as in a browser
      if (getDomain(d, { allowPrivateDomains: true })) c.domain = `.${d}`;
    } else if (k === "path" && v.startsWith("/")) c.path = v;
    else if (k === "max-age" && /^-?\d+$/.test(v)) maxAge = Number(v);
    else if (k === "expires" && !Number.isNaN(Date.parse(v))) c.expires = Date.parse(v) / 1000;
    else if (k === "secure") c.secure = true;
    else if (k === "httponly") c.httpOnly = true;
    else if (k === "samesite" && /^(strict|lax|none)$/i.test(v))
      c.sameSite = (v[0]!.toUpperCase() + v.slice(1).toLowerCase()) as StoredCookie["sameSite"];
  }
  // max-age wins over expires; 0 or less deletes (an expired cookie drops out of the jar)
  if (maxAge !== undefined) c.expires = maxAge <= 0 ? 1 : now / 1000 + maxAge;
  return c;
}

/** Parse a raw Cookie header ("a=1; b=\"x\"") into a name -> value map. */
export function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name) out[name] = part.slice(eq + 1).trim();
  }
  return out;
}

// ponytail: name heuristic for "logged in"; a site's spec can pin exact names via loginCookies.
export const AUTH_COOKIE =
  /^(auth_token|sessionid|session_id|li_at|sid|ssid|__secure-\dpsid|user_session|reddit_session|remember_\w+|\w*_session|\w*_sess)$/i;

export function loggedIn(cookies: StoredCookie[], loginCookies?: string[], now = Date.now()): boolean {
  const live = cookies.filter((c) => !expired(c, now) && c.value);
  if (loginCookies?.length) return loginCookies.every((n) => live.some((c) => c.name === n));
  return live.some(
    (c) => (AUTH_COOKIE.test(c.name) && c.value.length >= 8) || (c.name === "logged_in" && c.value === "yes"),
  );
}
