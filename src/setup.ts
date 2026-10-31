/**
 * `api-anything setup`: connect the MCP server to each agent on this machine (and the skill where the
 * agent takes skills), check for a browser, make the install's key, and ask the one question
 * (docs/REGISTRY.md, "Setup"). Other entries in an agent's config are never changed: a file is backed up
 * before it is edited, and an api-anything entry that is already there is left as it is.
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { browserChoice } from "./browser.js";
import { answerShare, ensureKey, keyFile, loadSettings, QUESTION } from "./identity.js";

export interface Entry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
/** The entry for agents that start from the user's shell (Claude Code, Codex) and so find npx on PATH. */
export const SERVER: Entry = { command: "npx", args: ["-y", "api-anything", "mcp"] };
const NAME = "api-anything";

export const AGENTS = ["claude-code", "codex", "cursor", "claude-desktop"] as const;
export type Agent = (typeof AGENTS)[number];
const LABEL: Record<Agent, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  "claude-desktop": "Claude Desktop",
};

export const paths = {
  claudeJson: () => join(homedir(), ".claude.json"),
  claudeSkill: () => join(homedir(), ".claude", "skills", NAME, "SKILL.md"),
  codexHome: () => process.env.CODEX_HOME || join(homedir(), ".codex"),
  codexToml: () => join(paths.codexHome(), "config.toml"),
  // Codex reads user skills from ~/.agents/skills (docs/QUICKSTART.md)
  codexSkill: () => join(homedir(), ".agents", "skills", NAME, "SKILL.md"),
  cursorJson: () => join(homedir(), ".cursor", "mcp.json"),
  desktopJson: () =>
    process.platform === "darwin"
      ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : process.platform === "win32"
        ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
        : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "Claude", "claude_desktop_config.json"),
};

const SKILL = new URL("../skills/api-anything/SKILL.md", import.meta.url);

/** Whether `cmd` is an executable on PATH. */
export function onPath(cmd: string): string | undefined {
  const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean))
    for (const ext of exts) {
      const f = join(dir, cmd + ext);
      try {
        accessSync(f, constants.X_OK);
        return f;
      } catch {
        /* next */
      }
    }
  return undefined;
}

/**
 * The agents installed here: the command on PATH, or a file the agent writes itself. A bare directory
 * is no sign: one left behind (an uninstall, another tool's skills dir) would get a config the
 * machine never runs.
 */
export function detect(): Agent[] {
  const any = (...files: string[]) => files.some((f) => existsSync(f));
  const seen: Record<Agent, boolean> = {
    "claude-code": !!onPath("claude") || any(paths.claudeJson()),
    codex: !!onPath("codex") || any(paths.codexToml(), join(paths.codexHome(), "auth.json")),
    // Cursor writes argv.json on first launch, Claude Desktop its config.json
    cursor: !!onPath("cursor") || any(paths.cursorJson(), join(dirname(paths.cursorJson()), "argv.json")),
    "claude-desktop": any(paths.desktopJson(), join(dirname(paths.desktopJson()), "config.json")),
  };
  return AGENTS.filter((a) => seen[a]);
}

/** `added`: connected now. `unchanged`: already exactly this. `kept`: another api-anything entry is there, left as it is. */
type Status = "added" | "unchanged" | "kept" | "would add" | "failed";

export interface AgentResult {
  agent: Agent;
  mcp: Status;
  /** how it was (or would be) added: the agent's own CLI, or an edit of its config file */
  via?: "cli" | "file";
  file: string;
  backup?: string;
  /** the existing entry, when it is kept */
  entry?: unknown;
  skill?: "installed" | "updated" | "unchanged" | "would install" | "would update";
  skillFile?: string;
  skillBackup?: string;
  error?: string;
}

/**
 * The entry for a GUI app (Cursor, Claude Desktop). It starts with a minimal PATH, where npx from nvm or
 * Homebrew is not found: so the npx setup would run, by its absolute path, with node's directory on PATH
 * (npx is a node script).
 */
export function guiServer(): Entry {
  const win = process.platform === "win32";
  const npx = onPath("npx") ?? [join(dirname(process.execPath), win ? "npx.cmd" : "npx")].find((f) => existsSync(f));
  if (!npx) return SERVER;
  const nodeDir = existsSync(join(dirname(npx), win ? "node.exe" : "node")) ? dirname(npx) : dirname(process.execPath);
  return {
    command: npx,
    args: SERVER.args,
    env: { PATH: (win ? [nodeDir] : [nodeDir, "/usr/bin", "/bin"]).join(delimiter) },
  };
}

const same = (e: { command?: unknown; args?: unknown } | undefined, want: Entry = SERVER) =>
  !!e && e.command === want.command && JSON.stringify(e.args ?? []) === JSON.stringify(want.args);

/** Copies `file` to `<file>.bak-api-anything` once: a later run keeps the copy made before api-anything's first edit. */
function backup(file: string): string | undefined {
  if (!existsSync(file)) return undefined;
  const to = `${file}.bak-api-anything`;
  if (!existsSync(to)) copyFileSync(file, to);
  return to;
}

function readJsonFile(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return {};
  const v = JSON.parse(text) as unknown;
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`${file} is not a JSON object`);
  return v as Record<string, unknown>;
}

const entryIn = (cfg: Record<string, unknown>) =>
  (cfg.mcpServers as Record<string, { command?: unknown; args?: unknown }> | undefined)?.[NAME];

/** An `mcpServers` entry in a JSON config (Claude Code's ~/.claude.json, Cursor, Claude Desktop). */
function jsonServer(agent: Agent, file: string, dryRun: boolean, entry: Entry = SERVER): AgentResult {
  const cfg = readJsonFile(file);
  const cur = entryIn(cfg);
  if (cur)
    return { agent, mcp: same(cur, entry) ? "unchanged" : "kept", file, ...(same(cur, entry) ? {} : { entry: cur }) };
  if (dryRun) return { agent, mcp: "would add", via: "file", file };
  const saved = backup(file);
  const servers = (cfg.mcpServers as Record<string, unknown> | undefined) ?? {};
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...cfg, mcpServers: { ...servers, [NAME]: entry } }, null, 2)}\n`);
  return { agent, mcp: "added", via: "file", file, ...(saved ? { backup: saved } : {}) };
}

/** Runs an agent's own `mcp add`, after backing up the file it edits. */
function viaCli(agent: Agent, file: string, cmd: string, args: string[], dryRun: boolean): AgentResult {
  if (dryRun) return { agent, mcp: "would add", via: "cli", file };
  const saved = backup(file);
  try {
    execFileSync(cmd, args, { stdio: "pipe", timeout: 30_000 });
    return { agent, mcp: "added", via: "cli", file, ...(saved ? { backup: saved } : {}) };
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    const why = err.stderr?.toString().trim() || err.message;
    return { agent, mcp: "failed", via: "cli", file, error: `${cmd} ${args.join(" ")}: ${why.split("\n")[0]}` };
  }
}

/** The `[mcp_servers.api-anything]` table of Codex's config.toml, if there is one. */
function codexEntry(text: string): { command?: string; args?: string[] } | undefined {
  const head = /^\s*\[mcp_servers\.(?:"api-anything"|api-anything)\]\s*$/m.exec(text);
  if (!head) return undefined;
  const rest = text.slice(head.index + head[0].length);
  const body = rest.slice(0, /^\s*\[/m.exec(rest)?.index ?? rest.length);
  const value = (k: string) => new RegExp(`^\\s*${k}\\s*=\\s*(.+?)\\s*$`, "m").exec(body)?.[1];
  const parse = (v: string | undefined) => {
    try {
      return v === undefined ? undefined : JSON.parse(v);
    } catch {
      return v;
    }
  };
  return { command: parse(value("command")), args: parse(value("args")) };
}

function codexServer(dryRun: boolean): AgentResult {
  const file = paths.codexToml();
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const cur = codexEntry(text);
  if (cur) return { agent: "codex", mcp: same(cur) ? "unchanged" : "kept", file, ...(same(cur) ? {} : { entry: cur }) };
  if (onPath("codex"))
    return viaCli("codex", file, "codex", ["mcp", "add", NAME, "--", SERVER.command, ...SERVER.args], dryRun);
  if (dryRun) return { agent: "codex", mcp: "would add", via: "file", file };
  const saved = backup(file);
  mkdirSync(dirname(file), { recursive: true });
  const table = `[mcp_servers.${NAME}]\ncommand = ${JSON.stringify(SERVER.command)}\nargs = ${JSON.stringify(SERVER.args).replaceAll(",", ", ")}\n`;
  writeFileSync(file, `${text}${text && !text.endsWith("\n") ? "\n" : ""}${text ? "\n" : ""}${table}`);
  return { agent: "codex", mcp: "added", via: "file", file, ...(saved ? { backup: saved } : {}) };
}

function claudeCodeServer(dryRun: boolean): AgentResult {
  const file = paths.claudeJson();
  const cur = entryIn(readJsonFile(file));
  if (!cur && onPath("claude"))
    return viaCli(
      "claude-code",
      file,
      "claude",
      ["mcp", "add", "--scope", "user", NAME, "--", SERVER.command, ...SERVER.args],
      dryRun,
    );
  return jsonServer("claude-code", file, dryRun);
}

/** The package's SKILL.md, copied where the agent reads skills; an older copy is backed up, then replaced. */
function installSkill(file: string, dryRun: boolean): Pick<AgentResult, "skill" | "skillFile" | "skillBackup"> {
  const text = readFileSync(SKILL, "utf8");
  const had = existsSync(file) ? readFileSync(file, "utf8") : undefined;
  if (had === text) return { skill: "unchanged", skillFile: file };
  if (dryRun) return { skill: had === undefined ? "would install" : "would update", skillFile: file };
  const saved = backup(file);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return {
    skill: had === undefined ? "installed" : "updated",
    skillFile: file,
    ...(saved ? { skillBackup: saved } : {}),
  };
}

function connect(agent: Agent, dryRun: boolean): AgentResult {
  try {
    switch (agent) {
      case "claude-code":
        return { ...claudeCodeServer(dryRun), ...installSkill(paths.claudeSkill(), dryRun) };
      case "codex":
        return { ...codexServer(dryRun), ...installSkill(paths.codexSkill(), dryRun) };
      case "cursor":
        return jsonServer("cursor", paths.cursorJson(), dryRun, guiServer());
      case "claude-desktop":
        return jsonServer("claude-desktop", paths.desktopJson(), dryRun, guiServer());
    }
  } catch (e) {
    return { agent, mcp: "failed", file: "", error: (e as Error).message.split("\n")[0] };
  }
}

export interface SetupOptions {
  /** the agents to connect; default: every one found on this machine */
  agents?: Agent[];
  dryRun?: boolean;
  /** the answer given by flag (--yes, --no-share) */
  share?: boolean;
  /** asks the question; given only when a person can answer (a TTY) */
  ask?: (question: string) => Promise<boolean>;
}

export interface SetupResult {
  ok: boolean;
  dryRun?: true;
  agents: AgentResult[];
  browser: { available: boolean; name?: string; note: string };
  key: { file: string; created: boolean; publicKey?: string } | { file: string; wouldCreate: true };
  /** undefined: not asked yet (no TTY and no flag), so nothing is shared */
  share?: boolean;
  shareAsked: boolean;
}

export async function setup(o: SetupOptions = {}): Promise<SetupResult> {
  const dryRun = !!o.dryRun;
  const agents = (o.agents ?? detect()).map((a) => connect(a, dryRun));

  const b = browserChoice();
  const browser = {
    available: !!b,
    ...(b ? { name: b.name } : {}),
    note: "a Chromium browser is needed only to learn sites; calls to shared operations work without one",
  };

  const hadKey = existsSync(keyFile());
  const key: SetupResult["key"] = dryRun
    ? hadKey
      ? { file: keyFile(), created: false }
      : { file: keyFile(), wouldCreate: true }
    : { file: keyFile(), created: !hadKey, publicKey: ensureKey().publicKey };

  const before = loadSettings();
  let share = o.share;
  if (share === undefined && !before.askedAt && o.ask && !dryRun) share = await o.ask(QUESTION);
  if (share !== undefined && !dryRun) answerShare(share);
  const answer = share ?? (before.askedAt ? before.share : undefined);

  return {
    ok: agents.every((a) => a.mcp !== "failed"),
    ...(dryRun ? { dryRun: true as const } : {}),
    agents,
    browser,
    key,
    ...(answer !== undefined ? { share: answer } : {}),
    shareAsked: answer !== undefined,
  };
}

/** A yes/no on the terminal, default yes. */
export async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const a = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase();
    return a === "" || a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

/** What setup did, for a person: one line per agent, then what to ask first. */
const SKILL_DONE = {
  installed: "installed",
  updated: "updated",
  "would install": "would be installed",
  "would update": "would be updated",
} as const;

export function summary(r: SetupResult): string {
  const lines = r.agents.map((a) => {
    const what =
      a.mcp === "added"
        ? "connected"
        : a.mcp === "would add"
          ? "would be connected"
          : a.mcp === "unchanged"
            ? "already connected"
            : a.mcp === "kept"
              ? "has another api-anything entry, left as it is"
              : `not connected: ${a.error}`;
    const skill = a.skill && a.skill !== "unchanged" ? `; skill ${SKILL_DONE[a.skill]}` : "";
    return `  ${LABEL[a.agent]}: ${what}${skill}${a.backup ? ` (backup: ${a.backup})` : ""}`;
  });
  if (!lines.length)
    lines.push("  No agent found. Name one: api-anything setup --agents claude-code,codex,cursor,claude-desktop");
  const share =
    r.share === undefined
      ? r.dryRun
        ? "Sharing: would be asked on a terminal (default yes); --yes or --no-share answers it"
        : "Sharing: not asked yet, so nothing is shared; your agent asks the first time it learns something to share. Answer now with: api-anything setup --yes (or --no-share)"
      : `Sharing: ${r.dryRun ? "would be " : ""}${r.share ? "on. Your agent shares operations it learns from public pages, reports whether calls work, and tests a few new operations a day; never your cookies or logins." : "off."}`;
  return [
    `api-anything setup${r.dryRun ? " (dry run: nothing was changed)" : ""}`,
    ...lines,
    `  Browser: ${r.browser.available ? `${r.browser.name} found` : "none found; install Chrome, Brave, Edge or Chromium to learn new sites"} (needed only to learn sites)`,
    `  ${share}`,
    "",
    r.agents.some((a) => a.mcp === "added" || a.mcp === "would add")
      ? 'Restart your agent, then ask it: "What does Goodreads rate Piranesi?"'
      : 'Ask your agent: "What does Goodreads rate Piranesi?"',
  ].join("\n");
}
