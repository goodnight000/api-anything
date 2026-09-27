/** Per-site cookie jar and session values under ~/.site2api (0700 dirs, 0600 files). */
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { StoredCookie } from "./types.js";

export interface Session {
  cookies: StoredCookie[];
  /** values of session: refs (auth/anti-bot headers), refreshed by every capture */
  values: Record<string, string>;
  updatedAt?: string;
}

export const home = () => process.env.SITE2API_HOME || join(homedir(), ".site2api");

/** Site names become file names; refuse anything that could leave the directory. */
export function safeName(name: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name) || name.includes("..")) throw new Error(`invalid site name "${name}"`);
  return name;
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
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

const sessionFile = (site: string) => join(home(), "sessions", `${safeName(site)}.json`);

export function loadSession(site: string): Session {
  const s = readJson<Partial<Session>>(sessionFile(site), {});
  return { cookies: s.cookies ?? [], values: s.values ?? {}, updatedAt: s.updatedAt };
}

export function saveSession(site: string, s: Session): void {
  writePrivate(sessionFile(site), JSON.stringify({ ...s, updatedAt: new Date().toISOString() }, null, 1));
}

const expired = (c: StoredCookie, now: number) => c.expires > 0 && c.expires * 1000 <= now;

/** Merge a browser run's cookies and session values into the stored session and save it. */
export function mergeCapture(site: string, cookies: StoredCookie[], values: Record<string, string> = {}, now = Date.now()): Session {
  const s = loadSession(site);
  const key = (c: StoredCookie) => `${c.name}\0${c.domain.toLowerCase()}\0${c.path}`;
  const jar = new Map(s.cookies.map((c) => [key(c), c]));
  for (const c of cookies) jar.set(key(c), c);
  const merged = { cookies: [...jar.values()].filter((c) => !expired(c, now)), values: { ...s.values, ...values } };
  saveSession(site, merged);
  return merged;
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

/** Value for a cookie: ref, preferring a cookie that would be sent to url. */
export function cookieValue(cookies: StoredCookie[], name: string, url?: string, now = Date.now()): string | undefined {
  const scoped = url ? cookiesFor(cookies, url, now).find((c) => c.name === name) : undefined;
  return (scoped ?? cookies.find((c) => c.name === name && !expired(c, now)))?.value;
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
const AUTH_COOKIE =
  /^(auth_token|sessionid|session_id|li_at|sid|ssid|__secure-\dpsid|user_session|reddit_session|remember_\w+|\w*_session|\w*_sess)$/i;

export function loggedIn(cookies: StoredCookie[], loginCookies?: string[], now = Date.now()): boolean {
  const live = cookies.filter((c) => !expired(c, now) && c.value);
  if (loginCookies?.length) return loginCookies.every((n) => live.some((c) => c.name === n));
  return live.some((c) => (AUTH_COOKIE.test(c.name) && c.value.length >= 8) || (c.name === "logged_in" && c.value === "yes"));
}
