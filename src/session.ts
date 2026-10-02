/** Per-site cookie jar and session values under ~/.api-anything (0700 dirs, 0600 files). */
import { chmodSync, closeSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { expired, type Session } from "./cookies.js";
import type { StoredCookie } from "./types.js";

export * from "./cookies.js";

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
  if (!s || typeof s !== "object" || (s.cookies !== undefined && !Array.isArray(s.cookies))) throw new Error(`${file} is not a session file; delete it and log in again`);
  return { cookies: s.cookies ?? [], values: s.values ?? {}, source: s.source, updatedAt: s.updatedAt };
}

export function saveSession(site: string, s: Session): void {
  writePrivate(sessionFile(site), JSON.stringify({ ...s, updatedAt: new Date().toISOString() }, null, 1));
}


/** Merge a browser run's cookies and session values into the stored session and save it. */
export function mergeCapture(site: string, cookies: StoredCookie[], values: Record<string, string> = {}, now = Date.now()): Session {
  return withLock(sessionFile(site), () => {
    const s = loadSession(site);
    const key = (c: StoredCookie) => `${c.name}\0${c.domain.toLowerCase()}\0${c.path}`;
    const jar = new Map(s.cookies.map((c) => [key(c), c]));
    for (const c of cookies) jar.set(key(c), c);
    const merged = { cookies: [...jar.values()].filter((c) => !expired(c, now)), values: { ...s.values, ...values }, source: s.source };
    saveSession(site, merged);
    return merged;
  });
}
