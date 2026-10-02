/** Cookie matching and the in-memory session shape. Pure: no file system, so the core entry can use it. */
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

export const expired = (c: StoredCookie, now: number) => c.expires > 0 && c.expires * 1000 <= now;

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
  const c: StoredCookie = { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: host, path: dir.startsWith("/") ? dir : "/", expires: -1, httpOnly: false, secure: false };
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
    else if (k === "samesite" && /^(strict|lax|none)$/i.test(v)) c.sameSite = (v[0]!.toUpperCase() + v.slice(1).toLowerCase()) as StoredCookie["sameSite"];
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
  return live.some((c) => (AUTH_COOKIE.test(c.name) && c.value.length >= 8) || (c.name === "logged_in" && c.value === "yes"));
}
