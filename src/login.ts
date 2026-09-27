/**
 * login = get a signed-in session for a site. By default it IMPORTS cookies from the user's
 * everyday browser (they are almost always already signed in there); `--window` and `--cookies`
 * are the other two sources. This module wires the pure import (import.ts) to the session store
 * and the persistent Chrome profile, and re-imports on a self-healing auth failure.
 */
import { readFileSync } from "node:fs";
import { addCookiesToProfile, chromeAvailable, clearProfileCookies } from "./browser.js";
import { profileDir } from "./heal.js";
import { cookiesFromFile, importFromBrowsers, parsePin, type ImportPin, type ImportedSession } from "./import.js";
import { loadSession, loggedIn, safeName, saveSession, siteOf } from "./session.js";
import { listSites, loadSite } from "./store.js";
import type { StoredCookie } from "./types.js";

/** Turn a login target (site name or url) into { site, url, loginCookies }. */
export function resolveLoginTarget(target: string): { site: string; url: string; loginCookies?: string[] } {
  if (/^https?:\/\//.test(target)) {
    const host = new URL(target).hostname;
    const site = listSites().find((n) => new URL(loadSite(n)!.site.baseUrl).hostname === host) ?? host.replace(/^www\./, "");
    return { site, url: target, loginCookies: loadSite(site)?.site.loginCookies };
  }
  const known = loadSite(target);
  if (!known) throw new Error(`no site "${target}"`);
  return { site: target, url: known.site.baseUrl, loginCookies: known.site.loginCookies };
}

export interface ImportOptions {
  loginCookies?: string[];
  /** "Chrome/Profile 2" or a session source "chrome:Profile 2" */
  profile?: string;
  /** a cookies.txt / JSON export, for servers/CI with no browser */
  file?: string;
  /** also inject into api-anything's Chrome profile (default true when Chrome is present) */
  pushProfile?: boolean;
}

/**
 * Import a session for `site` and save it. Returns the source (e.g. "chrome:Profile 2", "file"),
 * or undefined when nothing was importable (the caller falls back to the visible window).
 */
export async function importSession(site: string, url: string, o: ImportOptions = {}): Promise<ImportedSession | undefined> {
  let imported: ImportedSession | undefined;
  if (o.file) {
    const cookies = cookiesFromFile(readFileSync(o.file, "utf8"), url).filter((c) => forSite(c, url));
    if (cookies.length) imported = { cookies, source: "file", browser: "file", profile: o.file };
  } else {
    const pin = o.profile ? parsePin(o.profile) : undefined;
    imported = importFromBrowsers({ url, loginCookies: o.loginCookies, pin });
  }
  if (!imported || !imported.cookies.length) return undefined;
  const prev = loadSession(site);
  saveSession(site, { ...prev, cookies: imported.cookies, source: imported.source });
  if (o.pushProfile !== false && chromeAvailable()) {
    try {
      await addCookiesToProfile(imported.cookies, profileDir());
    } catch {
      // an open Chrome, a locked profile: the jar still works for tier 1
    }
  }
  return imported;
}

const forSite = (c: StoredCookie, url: string) => {
  const site = siteOf(new URL(url).hostname.toLowerCase());
  const h = c.domain.replace(/^\./, "").toLowerCase();
  return h === site || h.endsWith("." + site) || siteOf(h) === site;
};

/**
 * Self-heal an imported session: re-import from the same browser profile once. Used when a call
 * classified `auth` and the session came from a browser (source "<browser>:<profile>"). No-op for
 * "window" (independent session) and "file" (no path to re-read) sources.
 */
export async function reimportIfBrowser(site: string, url: string, loginCookies?: string[]): Promise<boolean> {
  const source = loadSession(site).source;
  if (!source || source === "window" || source === "file") return false;
  const pin: ImportPin = parsePin(source);
  try {
    const r = await importSession(site, url, { loginCookies, profile: `${pin.browser}/${pin.profile}` });
    return !!r;
  } catch {
    return false;
  }
}

/** logout: clear the jar and this site's cookies in the profile. */
export async function logout(site: string): Promise<void> {
  safeName(site);
  saveSession(site, { cookies: [], values: {} });
  if (chromeAvailable()) {
    try {
      await clearProfileCookies(site, profileDir());
    } catch {
      /* no profile yet, or Chrome open */
    }
  }
}

/** Cookie NAMES only, for printing — values are never logged. */
export const cookieNames = (cookies: StoredCookie[]): string[] => [...new Set(cookies.map((c) => c.name))].sort();

export { loggedIn };
