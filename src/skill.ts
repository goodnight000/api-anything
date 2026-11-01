/**
 * The agent skill, `skills/api-anything`: a folder copied whole to where an agent reads skills. Each copy
 * carries a stamp (the version and a hash of the files written), so a later version can tell a copy left
 * as it was installed, which it may replace, from one the user edited, which it keeps. The MCP server
 * runs through `npx -y api-anything` and so is always the latest release while a copy is not:
 * `refreshSkills` brings untouched copies up to date whenever the CLI or the server starts.
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { home } from "./session.js";

const NAME = "api-anything";
const SOURCE = fileURLToPath(new URL("../skills/api-anything/", import.meta.url));
const STAMP = ".api-anything.json";
const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;

/** Where agents read user skills: Claude Code its own folder; Codex, Cursor, Gemini CLI and VS Code ~/.agents/skills. */
export const skillDirs = {
  claude: () => join(homedir(), ".claude", "skills", NAME),
  agents: () => join(homedir(), ".agents", "skills", NAME),
};

const recordFile = () => join(home(), "skills.json");

export type SkillStatus = "installed" | "updated" | "unchanged" | "kept" | "would install" | "would update";

export interface SkillResult {
  skill: SkillStatus;
  skillDir: string;
  /** where the copy it replaced went, when that copy was not one api-anything left untouched */
  skillBackup?: string;
  /** why a copy was kept */
  skillNote?: string;
}

interface Stamp {
  version: string;
  hash: string;
}

/**
 * Every entry under `dir` by its path relative to it, with / separators; the stamp is left out. Anything
 * that is not a plain file or folder (a link the user added) counts by its target, so the hash sees it
 * as an edit and a refresh never deletes it.
 */
function filesOf(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const rel = relative(dir, p).split(sep).join("/");
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        if (!(d === dir && e.name === STAMP)) files.set(rel, readFileSync(p, "utf8"));
      } else files.set(rel, `\0${e.isSymbolicLink() ? `link ${readlinkSync(p)}` : "special"}`);
    }
  };
  walk(dir);
  return files;
}

const hashOf = (files: Map<string, string>) =>
  createHash("sha256")
    .update(JSON.stringify([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))))
    .digest("hex");

/** The skill this package ships, and its hash. */
export function packageSkill(): { files: Map<string, string>; hash: string } {
  const files = filesOf(SOURCE);
  return { files, hash: hashOf(files) };
}

function readStamp(dir: string): Stamp | undefined {
  try {
    const s = JSON.parse(readFileSync(join(dir, STAMP), "utf8")) as Partial<Stamp>;
    return typeof s.version === "string" && typeof s.hash === "string"
      ? { version: s.version, hash: s.hash }
      : undefined;
  } catch {
    return undefined;
  }
}

/** Positive when version `a` is newer than `b` (numeric parts, then a release over its prereleases). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => {
    const [core = "", pre] = v.split("-", 2);
    return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
  };
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return d;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === undefined) return 1;
  if (y.pre === undefined) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** One folder per copy under ~/.api-anything, not beside the copy: an agent that walks its skills folder would load a backup as a second skill. */
function backup(dir: string): string {
  const to = join(home(), "skill-backups", relative(homedir(), dir).replace(/[^\w.-]+/g, "_"));
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(dir, to, { recursive: true });
  return to;
}

function write(dir: string, files: Map<string, string>, hash: string): void {
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, text] of files) {
    const f = join(dir, ...rel.split("/"));
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, text);
  }
  writeFileSync(join(dir, STAMP), `${JSON.stringify({ version: VERSION, hash } satisfies Stamp)}\n`);
}

/**
 * Puts this package's skill at `dir`. `setup` (the user ran it) installs a missing copy and replaces an
 * edited one after backing it up. `refresh` (nothing asked) touches only a copy that is there and is
 * either one api-anything installed and nobody edited, now an older version, or one from before stamps;
 * it never installs. Neither replaces a copy from a newer version, nor a link (a checkout someone points
 * at). Undefined: refresh found nothing to do it for.
 */
export function installSkill(dir: string, o: { mode: "setup" | "refresh"; dryRun?: boolean }): SkillResult | undefined {
  const want = packageSkill();
  let stat: ReturnType<typeof lstatSync> | undefined;
  try {
    stat = lstatSync(dir);
  } catch {
    stat = undefined;
  }
  if (stat?.isSymbolicLink()) return { skill: "kept", skillDir: dir, skillNote: "a link to another folder" };
  const had = stat?.isDirectory() && existsSync(join(dir, "SKILL.md")) ? filesOf(dir) : undefined;
  if (!had) {
    if (o.mode === "refresh") return undefined;
    if (o.dryRun) return { skill: "would install", skillDir: dir };
    write(dir, want.files, want.hash);
    return { skill: "installed", skillDir: dir };
  }
  const stamp = readStamp(dir);
  const current = hashOf(had);
  if (current === want.hash) {
    if (!o.dryRun && stamp?.hash !== want.hash)
      writeFileSync(join(dir, STAMP), `${JSON.stringify({ version: VERSION, hash: want.hash } satisfies Stamp)}\n`);
    return o.mode === "refresh" ? undefined : { skill: "unchanged", skillDir: dir };
  }
  if (stamp && compareVersions(stamp.version, VERSION) > 0)
    return { skill: "kept", skillDir: dir, skillNote: `installed by api-anything ${stamp.version}, newer than this` };
  // undefined: a copy from before stamps, so nothing says whether it was edited
  const edited = stamp ? current !== stamp.hash : undefined;
  if (o.mode === "refresh") {
    if (edited) return { skill: "kept", skillDir: dir, skillNote: "edited since api-anything installed it" };
    // the same version with other files is a checkout's copy beside a release's: neither replaces the other
    if (stamp && compareVersions(VERSION, stamp.version) <= 0) return undefined;
  }
  if (o.dryRun) return { skill: "would update", skillDir: dir };
  const saved = edited === false ? undefined : backup(dir);
  write(dir, want.files, want.hash);
  return { skill: "updated", skillDir: dir, ...(saved ? { skillBackup: saved } : {}) };
}

function recorded(): string[] {
  try {
    const r = JSON.parse(readFileSync(recordFile(), "utf8")) as { dirs?: unknown };
    return Array.isArray(r.dirs) ? r.dirs.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers the copies setup made, for `refreshSkills`. */
export function recordSkillDirs(dirs: string[]): void {
  const all = [...new Set([...recorded(), ...dirs])];
  mkdirSync(home(), { recursive: true });
  writeFileSync(recordFile(), `${JSON.stringify({ dirs: all }, null, 2)}\n`);
}

/**
 * Refreshes the copies this install's setup recorded. An install with its own API_ANYTHING_HOME (a test,
 * a second profile) touches only its own; the default one also takes the usual folders, where a setup
 * from before the record put its copies.
 */
export function refreshSkills(): SkillResult[] {
  const dirs = new Set(recorded());
  if (!process.env.API_ANYTHING_HOME) for (const d of Object.values(skillDirs)) dirs.add(d());
  const done: SkillResult[] = [];
  for (const d of dirs) {
    try {
      const r = installSkill(d, { mode: "refresh" });
      if (r) done.push(r);
    } catch {
      // a copy that can't be read or written stays as it is; the call goes on
    }
  }
  return done;
}
