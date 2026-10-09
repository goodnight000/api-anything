/** Site specs (user dir wins over bundled), heal log, stale marks, and remembered tiers. */
import { appendFileSync, chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setAt, walk } from "./codec.js";
import { ipIn, isCredential, leafName, scanSecrets } from "./secrets.js";
import { ensureDir, home, loadSession, readJson, safeName, withLock, writePrivate } from "./session.js";
import { parseSite, type Site } from "./spec.js";

export const BUNDLED_DIR = fileURLToPath(new URL("../sites", import.meta.url));
export const userSitesDir = () => join(home(), "sites");

export interface Resolved {
  site: Site;
  source: "user" | "bundled";
  path: string;
}

export function loadSite(name: string, bundledDir = BUNDLED_DIR): Resolved | undefined {
  name = safeName(name);
  const file = `${name}.json`;
  for (const [dir, source] of [
    [userSitesDir(), "user"],
    [bundledDir, "bundled"],
  ] as const) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    try {
      // The file name is the site's address; saving under a different inner name would overwrite another site.
      return { site: { ...parseSite(JSON.parse(readFileSync(path, "utf8"))), name }, source, path };
    } catch (e) {
      throw new Error(`${path}: ${(e as Error).message}`);
    }
  }
  return undefined;
}

/**
 * A site's notes for whoever calls it (caveats, arg formats, login advice): `<site>.md` beside its spec, the
 * user's copy first. Every caller pays for them in tokens, so a `## Maintainer notes` heading ends them:
 * from there on the file is for people working on the spec.
 */
export function siteNotes(name: string, bundledDir = BUNDLED_DIR): string | undefined {
  for (const dir of [userSitesDir(), bundledDir]) {
    const path = join(dir, `${safeName(name)}.md`);
    if (!existsSync(path)) continue;
    const [forCallers] = readFileSync(path, "utf8").split(/^## Maintainer notes\s*$/im);
    return forCallers!.trim();
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

/**
 * Read-modify-write one site's user spec under its lock, so concurrent adds and heals (other
 * processes, or other calls in this one) never drop each other's operations. fn gets the current
 * spec (user copy, else bundled), undefined for a new site.
 */
export function updateSite(name: string, fn: (site: Site | undefined) => Site): string {
  return withLock(join(userSitesDir(), `${safeName(name)}.json`), () => saveSite(fn(loadSite(name)?.site)));
}

/* ------------------------------------------------------------------ state */

export interface StaleMark {
  until: number;
  reason: string;
  /** false when the site's own frontend did not answer either, so a tier-3 read is pointless */
  tier3?: boolean;
}

interface State {
  stale: Record<string, StaleMark>;
  tier: Record<string, 1 | 2 | 3>;
  healedAt: Record<string, number>;
}

const stateFile = () => join(home(), "state.json");
const key = (site: string, op: string) => `${site}/${op}`;

function loadState(): State {
  let s: Partial<State>;
  try {
    s = readJson<Partial<State>>(stateFile(), {}) ?? {};
  } catch {
    // tier memory and stale marks are hints: a corrupt file is started over, never a failed call
    s = {};
  }
  return { stale: s.stale ?? {}, tier: s.tier ?? {}, healedAt: s.healedAt ?? {} };
}

function updateState(fn: (s: State) => void): void {
  try {
    withLock(stateFile(), () => {
      const s = loadState();
      fn(s);
      writePrivate(stateFile(), JSON.stringify(s, null, 1));
    });
  } catch {
    // ponytail: a read-only home loses tier memory and stale marks (hints), never the call's answer
  }
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
  updateState((s) => {
    s.healedAt[key(entry.site, entry.op)] = now;
  });
}

export function lastHealAt(site: string, op: string): number | undefined {
  return loadState().healedAt[key(site, op)];
}

export function markStale(
  site: string,
  op: string,
  reason: string,
  ttlMs = 30 * 60_000,
  now = Date.now(),
  extra: { tier3?: boolean } = {},
): void {
  updateState((s) => {
    s.stale[key(site, op)] = { until: now + ttlMs, reason, ...extra };
  });
}

export function clearStale(site: string, op: string): void {
  updateState((s) => void delete s.stale[key(site, op)]);
}

/** Current stale mark for an op, if it has not expired. */
export function staleMark(site: string, op: string, now = Date.now()): StaleMark | undefined {
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

/** The tier an op escalated to; undefined forgets it (the op's own minTier applies again). */
export function rememberTier(site: string, op: string, tier: 1 | 2 | 3 | undefined): void {
  updateState((s) => {
    if (tier === undefined) delete s.tier[key(site, op)];
    else s.tier[key(site, op)] = tier;
  });
}

export function rememberedTier(site: string, op: string): 1 | 2 | 3 | undefined {
  return loadState().tier[key(site, op)];
}

/* ----------------------------------------------------------------- export */

/**
 * A shareable copy: example values stripped from the stored request (param slots become `{name}`,
 * or null in a typed JSON leaf) and from params (unless `keepExamples`: a human confirmed they
 * are public), response shapes dropped (their keys can be user data), then scanned against this
 * machine's live session.
 */
export function exportSite(
  name: string,
  o: { keepExamples?: boolean } = {},
): { spec: Site; secrets: string[]; warnings: string[] } {
  const r = loadSite(name);
  if (!r) throw new Error(`no site "${name}"`);
  const spec = structuredClone(r.site);
  const allowed = new Set<string>();
  const named: [string, string][] = [];
  const ips: string[] = [];
  spec.operations.forEach((op, i) => {
    for (const slot of op.slots) {
      const p = slot.param !== undefined ? op.params.find((x) => x.name === slot.param) : undefined;
      if (!p) continue;
      const typed = p.type !== "string" && slot.template === undefined && slot.at.at(-1)!.startsWith("json:");
      try {
        op.request = setAt(op.request, slot.at, typed ? null : (slot.template ?? `{${p.name}}`));
      } catch {
        /* position gone; leave it */
      }
    }
    if (!o.keepExamples) for (const p of op.params) delete p.example;
    delete op.response.shape;
    const pub = new Set((op.public ?? []).map((h) => h.toLowerCase()));
    for (const h of pub) allowed.add(`$.operations[${i}].request.headers.${h}`);
    // Learning makes these refs; a literal one is a hand-written or older spec's credential.
    for (const leaf of walk(op.request)) {
      if (leaf.type !== "string" || leaf.container) continue;
      const root = leaf.at[0]!;
      const path = `$.operations[${i}].request.${root.startsWith("header:") ? `headers.${root.slice(7)}` : /^(path|query)/.test(root) ? "url" : "body"}`;
      const where = `$.operations[${i}].request ${leaf.at.join(" > ")}`;
      const n = leafName(leaf.at);
      if (!pub.has(n.toLowerCase()) && isCredential(n, leaf.value))
        named.push([
          path,
          `${where} holds a literal credential (${n}); make it a session: ref, or list ${n} in the op's public names if the site ships it to everyone`,
        ]);
      const ip = ipIn(leaf.value);
      if (ip)
        ips.push(
          `${where} holds the IP address ${ip} (likely yours, as the page reported it); blank it if the site does not need it`,
        );
    }
  });
  const scan = scanSecrets(spec, loadSession(name), allowed);
  // one finding per place: the exact live hit already names it
  const more = named.filter(([p]) => !scan.secrets.some((s) => s.startsWith(`${p} `))).map(([, why]) => why);
  return { spec, secrets: [...scan.secrets, ...more], warnings: [...scan.warnings, ...ips] };
}
