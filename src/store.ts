/** Site specs (user dir wins over bundled), heal log, stale marks, and remembered tiers. */
import { appendFileSync, chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setAt } from "./codec.js";
import { ensureDir, home, loadSession, readJson, safeName, writePrivate, type Session } from "./session.js";
import { parseSite, type Site } from "./spec.js";

export const BUNDLED_DIR = fileURLToPath(new URL("../sites", import.meta.url));
export const userSitesDir = () => join(home(), "sites");

export interface Resolved {
  site: Site;
  source: "user" | "bundled";
  path: string;
}

export function loadSite(name: string, bundledDir = BUNDLED_DIR): Resolved | undefined {
  const file = `${safeName(name)}.json`;
  for (const [dir, source] of [[userSitesDir(), "user"], [bundledDir, "bundled"]] as const) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    try {
      return { site: parseSite(JSON.parse(readFileSync(path, "utf8"))), source, path };
    } catch (e) {
      throw new Error(`${path}: ${(e as Error).message}`);
    }
  }
  return undefined;
}

export function listSites(bundledDir = BUNDLED_DIR): string[] {
  const names = new Set<string>();
  for (const dir of [userSitesDir(), bundledDir]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".json")) names.add(f.slice(0, -5));
  }
  return [...names].sort();
}

/** Writes the user copy; a healed bundled spec becomes a user spec this way. */
export function saveSite(site: Site): string {
  const path = join(userSitesDir(), `${safeName(site.name)}.json`);
  writePrivate(path, `${JSON.stringify(parseSite(site), null, 2)}\n`);
  return path;
}

/* ------------------------------------------------------------------ state */

interface State {
  stale: Record<string, { until: number; reason: string }>;
  tier: Record<string, 1 | 2 | 3>;
  healedAt: Record<string, number>;
}

const stateFile = () => join(home(), "state.json");
const key = (site: string, op: string) => `${site}/${op}`;

function loadState(): State {
  const s = readJson<Partial<State>>(stateFile(), {});
  return { stale: s.stale ?? {}, tier: s.tier ?? {}, healedAt: s.healedAt ?? {} };
}

function updateState(fn: (s: State) => void): void {
  const s = loadState();
  fn(s);
  writePrivate(stateFile(), JSON.stringify(s, null, 1));
}

export interface HealEntry {
  site: string;
  op: string;
  strategy: "rescan" | "recapture";
  /** short human summary of what changed */
  diff: string;
}

/** Append to heals.jsonl and remember when the op was last healed (for the heal-loop guard). */
export function appendHeal(entry: HealEntry, now = Date.now()): void {
  ensureDir(home());
  const file = join(home(), "heals.jsonl");
  appendFileSync(file, `${JSON.stringify({ at: new Date(now).toISOString(), ...entry })}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  updateState((s) => void (s.healedAt[key(entry.site, entry.op)] = now));
}

export function lastHealAt(site: string, op: string): number | undefined {
  return loadState().healedAt[key(site, op)];
}

export function markStale(site: string, op: string, reason: string, ttlMs = 30 * 60_000, now = Date.now()): void {
  updateState((s) => void (s.stale[key(site, op)] = { until: now + ttlMs, reason }));
}

export function clearStale(site: string, op: string): void {
  updateState((s) => void delete s.stale[key(site, op)]);
}

/** Current stale mark for an op, if it has not expired. */
export function staleMark(site: string, op: string, now = Date.now()): { until: number; reason: string } | undefined {
  const m = loadState().stale[key(site, op)];
  return m && m.until > now ? m : undefined;
}

export function staleList(now = Date.now()): { site: string; op: string; until: number; reason: string }[] {
  return Object.entries(loadState().stale)
    .filter(([, m]) => m.until > now)
    .map(([k, m]) => {
      const i = k.indexOf("/");
      return { site: k.slice(0, i), op: k.slice(i + 1), ...m };
    });
}

export function rememberTier(site: string, op: string, tier: 1 | 2 | 3): void {
  updateState((s) => void (s.tier[key(site, op)] = tier));
}

export function rememberedTier(site: string, op: string): 1 | 2 | 3 | undefined {
  return loadState().tier[key(site, op)];
}

/* ----------------------------------------------------------------- export */

const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/;
const HEX_BLOB = /\b[0-9a-fA-F]{32,}\b/;
// "/" left out: every long URL path would match
const BASE64_BLOB = /[A-Za-z0-9+_-]{40,}={0,2}/;
const BEARER = /^Bearer\s+\S{20,}/i;

/**
 * `secrets`: exact hits of live jar/session values (6+ chars, raw, unquoted or URL-decoded): no
 * false positives, so callers fail closed. `warnings`: regex heuristics, which do misfire.
 */
export function scanSecrets(value: unknown, session: Session): { secrets: string[]; warnings: string[] } {
  const live: [string, string][] = [];
  const add = (label: string, v: string) => {
    let decoded = v;
    try {
      decoded = decodeURIComponent(v);
    } catch {
      /* raw only */
    }
    for (const f of new Set([v, v.replace(/^"|"$/g, ""), decoded])) if (f.length >= 6) live.push([label, f]);
  };
  for (const c of session.cookies) add(`cookie ${c.name}`, c.value);
  for (const [k, v] of Object.entries(session.values)) add(`session value ${k}`, v);
  const secrets: string[] = [];
  const warnings: string[] = [];
  const visit = (v: unknown, path: string) => {
    if (typeof v === "string") {
      for (const [label, s] of live) if (v.includes(s)) secrets.push(`${path} holds the live ${label}`);
      const why = JWT.test(v) ? "a JWT" : BEARER.test(v) ? "a bearer token" : HEX_BLOB.test(v) ? "a long hex blob" : BASE64_BLOB.test(v) ? "a long base64 blob" : "";
      if (why) warnings.push(`${path} looks like ${why}; check it is public`);
    } else if (Array.isArray(v)) v.forEach((x, i) => visit(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visit(x, `${path}.${k}`);
  };
  visit(value, "$");
  return { secrets: [...new Set(secrets)], warnings: [...new Set(warnings)] };
}

/**
 * A shareable copy: examples stripped from params and from the stored request (string param
 * slots become `{name}`), then scanned against this machine's live session.
 */
export function exportSite(name: string): { spec: Site; secrets: string[]; warnings: string[] } {
  const r = loadSite(name);
  if (!r) throw new Error(`no site "${name}"`);
  const spec = structuredClone(r.site);
  for (const op of spec.operations) {
    for (const slot of op.slots) {
      const p = slot.param !== undefined ? op.params.find((x) => x.name === slot.param) : undefined;
      if (!p || (p.type !== "string" && slot.template === undefined)) continue;
      try {
        op.request = setAt(op.request, slot.at, slot.template ?? `{${p.name}}`);
      } catch {
        /* position gone; leave it */
      }
    }
    for (const p of op.params) delete p.example;
  }
  return { spec, ...scanSecrets(spec, loadSession(name)) };
}
