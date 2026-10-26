/** Site specs (user dir, then pulled, then bundled), heal log, stale marks, remembered tiers, and the write ledger. */
import { createHmac, randomBytes } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  linkSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Leaf, setAt, walk } from "./codec.js";
import {
  besideOrigins,
  credentialsOf,
  ipIn,
  leafName,
  literalCredentials,
  opUrls,
  redact,
  scanSecrets,
} from "./secrets.js";
import { ensureDir, home, loadSession, readJson, safeName, withLock, writePrivate } from "./session.js";
import { parseSite, type Site } from "./spec.js";
import { vetShared } from "./vet.js";

export const BUNDLED_DIR = fileURLToPath(new URL("../sites", import.meta.url));
export const userSitesDir = () => join(home(), "sites");
/** Specs `pull` fetched from the registry: someone else's, so checked again on every load. */
export const registryDir = () => join(home(), "registry");

export interface Resolved {
  site: Site;
  source: "user" | "registry" | "bundled";
  path: string;
}

const specDirs = (bundledDir: string) =>
  [
    [userSitesDir(), "user"],
    [registryDir(), "registry"],
    [bundledDir, "bundled"],
  ] as const;

export function loadSite(name: string, bundledDir = BUNDLED_DIR): Resolved | undefined {
  name = safeName(name);
  const file = `${name}.json`;
  for (const [dir, source] of specDirs(bundledDir)) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    try {
      // The file name is the site's address; saving under a different inner name would overwrite another site.
      const site = { ...parseSite(JSON.parse(readFileSync(path, "utf8"))), name };
      // someone else's spec, pulled or a heal's copy of one, meets the rules of today, not of its pull
      // pull writes the record with every spec, so one without it is no spec pull wrote
      if (source === "registry" && !site.shared) throw new Error("a pulled spec without its record; pull it again");
      if (source === "registry" || site.shared) {
        const { errors } = vetShared(site, notesAt(join(dir, `${name}.md`)));
        if (errors.length) throw new Error(`a pulled spec that fails the shared rules: ${errors.join("; ")}`);
      }
      return { site, source, path };
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
  for (const [dir] of specDirs(bundledDir)) {
    const text = notesAt(join(dir, `${safeName(name)}.md`));
    if (text === undefined) continue;
    const [forCallers] = text.split(/^## Maintainer notes\s*$/im);
    return forCallers!.trim();
  }
  return undefined;
}

const notesAt = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

export function listSites(bundledDir = BUNDLED_DIR): string[] {
  const names = new Set<string>();
  for (const [dir] of specDirs(bundledDir)) {
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

/** `text` without the site's live session values: what is kept on disk is read by agents too. */
function hidden(site: string, text: string): string {
  try {
    return redact(text, loadSession(site));
  } catch {
    return text; // an unreadable session file: no live value to look for
  }
}

/** Append to heals.jsonl and remember when the op was last healed (for the heal-loop guard). */
export function appendHeal(entry: HealEntry, now = Date.now()): void {
  ensureDir(home());
  const file = join(home(), "heals.jsonl");
  const line = { at: new Date(now).toISOString(), ...entry, diff: hidden(entry.site, entry.diff) };
  appendFileSync(file, `${JSON.stringify(line)}\n`, { mode: 0o600 });
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
  const why = hidden(site, reason);
  updateState((s) => {
    s.stale[key(site, op)] = { until: now + ttlMs, reason: why, ...extra };
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

/* ------------------------------------------------------------ write ledger */

/** What a write did, as far as the caller can know; see CallResult.write. */
export type WriteStatus = "not_sent" | "not_applied" | "accepted" | "may_have_applied" | "applied";

/** One write call, kept in writes.json. Never the args or a credential: an HMAC digest of the args. */
export interface WriteRecord {
  id: string;
  site: string;
  op: string;
  /** HMAC-SHA256 of [site, op, args] under this machine's random key */
  digest: string;
  /** HMAC of the caller's idempotency key, when it gave one */
  key?: string;
  at: number;
  /** "sending" until the call settles it; a process that died mid-send leaves it so, and it counts as may_have_applied */
  status: WriteStatus | "sending";
  ok?: boolean;
  class?: string;
}

/**
 * A repeat of a write that may have gone through is refused for this long. Long enough for an agent
 * that re-sends after an unclear answer (seconds to minutes later, often after a login or a heal) and
 * for the user to look at the site; short enough that the same comment or order placed again later
 * on purpose goes through without the override.
 */
export const DUPLICATE_WINDOW_MS = 10 * 60_000;
// An idempotency key is answered from its record this long; older records are dropped.
const KEEP_WRITES_MS = 24 * 60 * 60_000;

const writesFile = () => join(home(), "writes.json");
const unsettled = (r: WriteRecord) =>
  r.status === "accepted" || r.status === "applied" || r.status === "may_have_applied" || r.status === "sending";

/** This machine's HMAC key, made on first use: a digest of short args (a comment, a vote) cannot be guessed back without it. */
function ledgerKey(): Buffer {
  const file = join(home(), "write.key");
  if (!existsSync(file)) {
    ensureDir(home());
    // written whole, then linked into place: a concurrent first use reads one key or the other, never half of one
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, randomBytes(32).toString("hex"), { mode: 0o600 });
    try {
      linkSync(tmp, file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  return Buffer.from(readFileSync(file, "utf8").trim(), "hex");
}

/** The same value whatever the order of its object keys. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;

const hmac = (key: Buffer, value: unknown) =>
  createHmac("sha256", key).update(JSON.stringify(value)).digest("hex").slice(0, 32);

export type WriteGate =
  | { send: true; id: string }
  /** an unsettled write with the same args within the window */
  | { send: false; why: "duplicate"; earlier: WriteRecord }
  /** the idempotency key's write may have gone through: its record answers */
  | { send: false; why: "replay"; earlier: WriteRecord }
  /** the idempotency key was used for other args */
  | { send: false; why: "key_reused"; earlier: WriteRecord };

/**
 * Record a write before it is sent, under the ledger's lock so two processes cannot both pass, or
 * say why it must not be sent. `again` skips both checks (the user saw the site and wants it sent).
 * With an idempotency key the key decides, not the args' digest: the caller says which calls are one.
 * Throws when the record cannot be written (a read-only home).
 */
export function beginWrite(
  site: string,
  op: string,
  args: Record<string, unknown>,
  o: { again?: boolean; idempotencyKey?: string } = {},
  now = Date.now(),
): WriteGate {
  const secret = ledgerKey();
  const digest = hmac(secret, [site, op, canonical(args)]);
  const key = o.idempotencyKey !== undefined ? hmac(secret, ["key", site, op, o.idempotencyKey]) : undefined;
  return withLock(writesFile(), () => {
    let all: WriteRecord[];
    try {
      all = readJson<WriteRecord[]>(writesFile(), []);
      if (!Array.isArray(all)) all = [];
    } catch {
      all = []; // a corrupt ledger is started over, like state.json, rather than refusing every write
    }
    all = all.filter((r) => now - r.at < KEEP_WRITES_MS);
    const mine = all.filter((r) => r.site === site && r.op === op);
    if (!o.again) {
      if (key) {
        const used = mine.findLast((r) => r.key === key);
        if (used && used.digest !== digest) return { send: false, why: "key_reused", earlier: used };
        if (used && unsettled(used)) return { send: false, why: "replay", earlier: used };
      } else {
        const earlier = mine.findLast((r) => r.digest === digest && now - r.at < DUPLICATE_WINDOW_MS && unsettled(r));
        if (earlier) return { send: false, why: "duplicate", earlier };
      }
    }
    const id = randomBytes(8).toString("hex");
    all.push({ id, site, op, digest, ...(key ? { key } : {}), at: now, status: "sending" });
    writePrivate(writesFile(), JSON.stringify(all, null, 1));
    return { send: true, id };
  });
}

/** What the write did, once its call returns. */
export function settleWrite(id: string, status: WriteStatus, outcome: { ok: boolean; class: string }): void {
  try {
    withLock(writesFile(), () => {
      const all = readJson<WriteRecord[]>(writesFile(), []);
      const r = all.find((x) => x.id === id);
      if (!r) return;
      Object.assign(r, { status, ok: outcome.ok, class: outcome.class });
      writePrivate(writesFile(), JSON.stringify(all, null, 1));
    });
  } catch {
    // ponytail: the record stays "sending", which a repeat treats as may_have_applied: the safe side
  }
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
  // where this copy was pulled from, and when an op was learned, are this machine's history
  delete spec.shared;
  for (const op of spec.operations) delete op.learnedAt;
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
    const where = (leaf: Leaf) => `$.operations[${i}].request ${leaf.at.join(" > ")}`;
    for (const leaf of literalCredentials(op.request, pub)) {
      const root = leaf.at[0]!;
      const n = leafName(leaf.at);
      named.push([
        `$.operations[${i}].request.${root.startsWith("header:") ? `headers.${root.slice(7)}` : /^(path|query)/.test(root) ? "url" : "body"}`,
        `${where(leaf)} holds a literal credential (${n}); make it a session: ref, or list ${n} in the op's public names if the site ships it to everyone`,
      ]);
    }
    for (const leaf of walk(op.request)) {
      const ip = leaf.type === "string" && !leaf.container ? ipIn(leaf.value) : undefined;
      if (ip)
        ips.push(
          `${where(leaf)} holds the IP address ${ip} (likely yours, as the page reported it); blank it if the site does not need it`,
        );
    }
  });
  const own = [spec.baseUrl, ...spec.operations.flatMap(opUrls)];
  const scan = scanSecrets(spec, credentialsOf(besideOrigins(loadSession(name), own)), allowed);
  // one finding per place: the exact live hit already names it
  const more = named.filter(([p]) => !scan.secrets.some((s) => s.startsWith(`${p} `))).map(([, why]) => why);
  return { spec, secrets: [...scan.secrets, ...more], warnings: [...scan.warnings, ...ips] };
}
