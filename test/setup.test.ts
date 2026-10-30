/**
 * setup against a temp HOME: each agent's config, backups, idempotence, --dry-run, the non-TTY flags,
 * other entries never touched, and the agents' own CLIs (fakes on PATH) preferred when they exist.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadSettings } from "../src/identity.js";
import { detect, guiServer, paths, SERVER, setup } from "../src/setup.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILL = readFileSync(join(ROOT, "skills", "api-anything", "SKILL.md"), "utf8");
const saved = {
  HOME: process.env.HOME,
  PATH: process.env.PATH,
  AA: process.env.API_ANYTHING_HOME,
  HERMES_HOME: process.env.HERMES_HOME,
};
let home: string;
let bin: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "aa-setup-"));
  bin = join(home, "bin");
  mkdirSync(bin);
  process.env.HOME = home;
  process.env.PATH = bin;
  process.env.API_ANYTHING_HOME = join(home, ".api-anything");
  delete process.env.CODEX_HOME;
  delete process.env.HERMES_HOME;
  delete process.env.APPDATA;
  delete process.env.XDG_CONFIG_HOME;
});
afterEach(() => {
  process.env.HOME = saved.HOME;
  process.env.PATH = saved.PATH;
  process.env.API_ANYTHING_HOME = saved.AA;
  process.env.HERMES_HOME = saved.HERMES_HOME;
  rmSync(home, { recursive: true, force: true });
});

const write = (file: string, text: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const read = (file: string) => readFileSync(file, "utf8");
const json = (file: string) => JSON.parse(read(file));

/** Every agent's config with someone else's entries in it. */
function seed() {
  write(paths.claudeJson(), JSON.stringify({ numStartups: 3, mcpServers: { other: { command: "other-mcp" } } }));
  write(paths.cursorJson(), JSON.stringify({ mcpServers: { cursorThing: { command: "x", args: ["y"] } } }, null, 2));
  write(paths.desktopJson(), JSON.stringify({ mcpServers: { fs: { command: "fs-mcp" } }, theme: "dark" }));
  write(paths.codexToml(), 'model = "o3"\n\n[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "context7"]\n');
  write(
    paths.hermesYaml(),
    'model: "other"\nmcp_servers:\n  filesystem:\n    command: npx\n    args: ["-y", "fs", "/home"]\n',
  );
  return {
    claude: read(paths.claudeJson()),
    cursor: read(paths.cursorJson()),
    desktop: read(paths.desktopJson()),
    codex: read(paths.codexToml()),
    hermes: read(paths.hermesYaml()),
  };
}

const ALL = ["claude-code", "codex", "cursor", "claude-desktop", "hermes"] as const;

/** An executable named `name` in the test's PATH. */
function fakeExe(name: string) {
  writeFileSync(join(bin, name), "#!/bin/sh\n");
  chmodSync(join(bin, name), 0o755);
}

test("GUI apps get npx by absolute path (from PATH, else beside the running node) with node on PATH; shell agents keep bare npx", async () => {
  fakeExe("npx"); // without node beside it, node's own directory goes on PATH
  assert.deepEqual(guiServer(), {
    command: join(bin, "npx"),
    args: SERVER.args,
    env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` },
  });
  rmSync(join(bin, "npx"));
  const beside = join(dirname(process.execPath), "npx");
  if (existsSync(beside)) assert.equal(guiServer().command, beside);
  write(paths.cursorJson(), "{}");
  write(paths.claudeJson(), "{}");
  await setup({ agents: ["cursor", "claude-code"], share: false });
  assert.deepEqual(json(paths.cursorJson()).mcpServers["api-anything"], guiServer());
  assert.deepEqual(json(paths.claudeJson()).mcpServers["api-anything"], SERVER);
  // an entry already there, the bare one an earlier setup wrote included, is kept
  write(paths.desktopJson(), JSON.stringify({ mcpServers: { "api-anything": SERVER } }));
  const r = await setup({ agents: ["claude-desktop"], share: false });
  assert.equal(r.agents[0]!.mcp, "kept");
  assert.deepEqual(json(paths.desktopJson()).mcpServers["api-anything"], SERVER);
});

test("setup adds the server to each agent's config, keeps every other entry, and backs each file up", async () => {
  const before = seed();
  fakeExe("npx");
  fakeExe("node");
  const r = await setup({ agents: [...ALL], share: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(
    r.agents.map((a) => [a.agent, a.mcp, a.via]),
    ALL.map((a) => [a, "added", "file"]),
  );

  const claude = json(paths.claudeJson());
  assert.equal(claude.numStartups, 3);
  assert.deepEqual(claude.mcpServers, { other: { command: "other-mcp" }, "api-anything": SERVER });
  // GUI apps start with a minimal PATH: the npx on PATH, by its absolute path, with node's directory
  const gui = { command: join(bin, "npx"), args: SERVER.args, env: { PATH: `${bin}:/usr/bin:/bin` } };
  assert.deepEqual(json(paths.cursorJson()).mcpServers.cursorThing, { command: "x", args: ["y"] });
  assert.deepEqual(json(paths.cursorJson()).mcpServers["api-anything"], gui);
  assert.equal(json(paths.desktopJson()).theme, "dark");
  assert.deepEqual(json(paths.desktopJson()).mcpServers["api-anything"], gui);
  const toml = read(paths.codexToml());
  assert.ok(toml.startsWith(before.codex), "the old config.toml is kept as it was");
  assert.match(toml, /\[mcp_servers\.api-anything\]\ncommand = "npx"\nargs = \["-y", "api-anything", "mcp"\]\n$/);
  const yaml = read(paths.hermesYaml());
  assert.ok(yaml.startsWith(before.hermes), "the old config.yaml is kept as it was");
  assert.ok(
    yaml.endsWith(
      `  api-anything:\n    enabled: true\n    command: "${join(bin, "npx")}"\n    args: ${JSON.stringify(SERVER.args)}\n    env:\n      PATH: "${bin}:/usr/bin:/bin"\n`,
    ),
    yaml,
  );

  assert.equal(read(`${paths.claudeJson()}.bak-api-anything`), before.claude);
  assert.equal(read(`${paths.cursorJson()}.bak-api-anything`), before.cursor);
  assert.equal(read(`${paths.desktopJson()}.bak-api-anything`), before.desktop);
  assert.equal(read(`${paths.codexToml()}.bak-api-anything`), before.codex);
  assert.equal(read(`${paths.hermesYaml()}.bak-api-anything`), before.hermes);

  assert.equal(read(paths.claudeSkill()), SKILL);
  assert.equal(read(paths.codexSkill()), SKILL);
  assert.equal(read(paths.hermesSkill()), SKILL);
  assert.deepEqual(
    r.agents.map((a) => a.skill),
    ["installed", "installed", undefined, undefined, "installed"],
  );
  assert.equal(loadSettings().share, true);
  assert.ok(existsSync(join(home, ".api-anything", "key.json")));
  assert.equal("created" in r.key && r.key.created, true);
});

test("setup run again changes nothing", async () => {
  seed();
  await setup({ agents: [...ALL], share: true });
  const files = [
    paths.claudeJson(),
    paths.cursorJson(),
    paths.desktopJson(),
    paths.codexToml(),
    paths.hermesYaml(),
    paths.claudeSkill(),
    paths.hermesSkill(),
  ];
  const after1 = files.map(read);
  const askedAt = loadSettings().askedAt;
  const r = await setup({ agents: [...ALL] });
  assert.deepEqual(
    r.agents.map((a) => a.mcp),
    ["unchanged", "unchanged", "unchanged", "unchanged", "unchanged"],
  );
  assert.deepEqual(
    r.agents.map((a) => a.skill),
    ["unchanged", "unchanged", undefined, undefined, "unchanged"],
  );
  assert.deepEqual(files.map(read), after1);
  assert.equal("created" in r.key && r.key.created, false);
  assert.deepEqual([r.share, loadSettings().askedAt], [true, askedAt], "the earlier answer stands");
});

test("an api-anything entry that is already there, set up another way, is left as it is", async () => {
  const mine = { command: "api-anything", args: ["mcp", "--allow-writes"] };
  write(paths.cursorJson(), JSON.stringify({ mcpServers: { "api-anything": mine } }));
  write(paths.codexToml(), '[mcp_servers."api-anything"]\ncommand = "api-anything"\nargs = ["mcp"]\n');
  write(
    paths.hermesYaml(),
    'mcp_servers:\n  api-anything:\n    enabled: true\n    command: "api-anything"\n    args: ["mcp", "--allow-writes"]\n',
  );
  const before = [read(paths.cursorJson()), read(paths.codexToml()), read(paths.hermesYaml())];
  const r = await setup({ agents: ["cursor", "codex", "hermes"], share: false });
  assert.deepEqual(
    r.agents.map((a) => [a.agent, a.mcp]),
    [
      ["cursor", "kept"],
      ["codex", "kept"],
      ["hermes", "kept"],
    ],
  );
  assert.deepEqual(r.agents[0]!.entry, mine);
  assert.deepEqual([read(paths.cursorJson()), read(paths.codexToml()), read(paths.hermesYaml())], before);
  assert.equal(existsSync(`${paths.cursorJson()}.bak-api-anything`), false);
  assert.equal(existsSync(`${paths.hermesYaml()}.bak-api-anything`), false);
});

test("an old copy of the skill is backed up, then replaced", async () => {
  write(paths.claudeSkill(), "old skill");
  write(paths.claudeJson(), JSON.stringify({ mcpServers: { "api-anything": SERVER } }));
  const r = await setup({ agents: ["claude-code"], share: false });
  assert.equal(r.agents[0]!.skill, "updated");
  assert.equal(read(paths.claudeSkill()), SKILL);
  assert.equal(read(`${paths.claudeSkill()}.bak-api-anything`), "old skill");
});

test("--dry-run says what would change and changes nothing", async () => {
  const before = seed();
  const r = await setup({ agents: [...ALL], dryRun: true, share: true });
  assert.equal(r.dryRun, true);
  assert.deepEqual(
    r.agents.map((a) => [a.mcp, a.skill]),
    [
      ["would add", "would install"],
      ["would add", "would install"],
      ["would add", undefined],
      ["would add", undefined],
      ["would add", "would install"],
    ],
  );
  assert.deepEqual(
    [
      read(paths.claudeJson()),
      read(paths.cursorJson()),
      read(paths.desktopJson()),
      read(paths.codexToml()),
      read(paths.hermesYaml()),
    ],
    [before.claude, before.cursor, before.desktop, before.codex, before.hermes],
  );
  for (const f of [
    paths.claudeSkill(),
    paths.codexSkill(),
    paths.hermesSkill(),
    `${paths.claudeJson()}.bak-api-anything`,
    `${paths.hermesYaml()}.bak-api-anything`,
  ])
    assert.equal(existsSync(f), false, f);
  assert.equal(existsSync(join(home, ".api-anything")), false, "no key, no settings");
  assert.deepEqual(r.key, { file: join(home, ".api-anything", "key.json"), wouldCreate: true });
});

/** A fake agent CLI: logs its argv, and adds the entry where the real one would. */
function fakeCli(name: "claude" | "codex") {
  const add =
    name === "claude"
      ? `const f=path.join(process.env.HOME,".claude.json");const c=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,"utf8")):{};c.mcpServers={...c.mcpServers,"api-anything":{type:"stdio",command:"npx",args:["-y","api-anything","mcp"],env:{}}};fs.writeFileSync(f,JSON.stringify(c));`
      : `const f=path.join(process.env.HOME,".codex","config.toml");fs.mkdirSync(path.dirname(f),{recursive:true});fs.appendFileSync(f,'[mcp_servers.api-anything]\\ncommand = "npx"\\nargs = ["-y", "api-anything", "mcp"]\\n');`;
  const file = join(bin, name);
  writeFileSync(
    file,
    `#!${process.execPath}\nconst fs=require("fs"),path=require("path");fs.appendFileSync(path.join(process.env.HOME,"cli.log"),JSON.stringify(process.argv.slice(1).map((a,i)=>i?a:path.basename(a)))+"\\n");${add}\n`,
  );
  chmodSync(file, 0o755);
}
const cliLog = () =>
  existsSync(join(home, "cli.log"))
    ? read(join(home, "cli.log"))
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l))
    : [];

test("the agents' own CLIs add the server when they are installed, and are not run again once it is there", async () => {
  fakeCli("claude");
  fakeCli("codex");
  write(paths.claudeJson(), JSON.stringify({ other: true }));
  assert.deepEqual(detect(), ["claude-code", "codex"]);
  const r = await setup({ share: false });
  assert.deepEqual(
    r.agents.map((a) => [a.agent, a.mcp, a.via]),
    [
      ["claude-code", "added", "cli"],
      ["codex", "added", "cli"],
    ],
  );
  assert.deepEqual(cliLog(), [
    ["claude", "mcp", "add", "--scope", "user", "api-anything", "--", "npx", "-y", "api-anything", "mcp"],
    ["codex", "mcp", "add", "api-anything", "--", "npx", "-y", "api-anything", "mcp"],
  ]);
  assert.equal(read(`${paths.claudeJson()}.bak-api-anything`), JSON.stringify({ other: true }));
  const again = await setup({ share: false });
  assert.deepEqual(
    again.agents.map((a) => a.mcp),
    ["unchanged", "unchanged"],
  );
  assert.equal(cliLog().length, 2);
});

test("detect finds an agent by its config directory", () => {
  mkdirSync(dirname(paths.cursorJson()), { recursive: true });
  assert.deepEqual(detect(), ["cursor"]);
  mkdirSync(paths.hermesHome(), { recursive: true });
  assert.deepEqual(detect(), ["cursor", "hermes"]);
});

function cli(...args: string[]): Promise<{ code: number; out: Record<string, unknown>; stderr: string }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args],
      { cwd: ROOT, env: { ...process.env, PATH: `${bin}:${dirname(process.execPath)}` } },
      (err, stdout, stderr) =>
        resolve({ code: err ? Number(err.code ?? 1) : 0, out: JSON.parse(stdout.trim().split("\n").at(-1)!), stderr }),
    ),
  );
}

test("CLI setup: --dry-run, --yes, --no-share, and no answer without a TTY", async () => {
  write(paths.cursorJson(), "{}");
  const dry = await cli("setup", "--dry-run", "--agents", "cursor");
  assert.equal(dry.code, 0, dry.stderr);
  assert.equal((dry.out.agents as { mcp: string }[])[0]!.mcp, "would add");
  assert.match(dry.stderr, /dry run: nothing was changed/);
  assert.equal(read(paths.cursorJson()), "{}");

  const none = await cli("setup", "--agents", "cursor");
  assert.equal(none.out.shareAsked, false);
  assert.match(none.stderr, /Sharing: not asked yet/);
  assert.equal(loadSettings().askedAt, undefined, "nothing is shared until asked");

  const yes = await cli("setup", "--yes", "--agents", "cursor");
  assert.deepEqual([yes.out.share, loadSettings().share], [true, true]);
  assert.match(yes.stderr, /Cursor: already connected/);
  const no = await cli("setup", "--no-share", "--agents", "cursor");
  assert.deepEqual([no.out.share, loadSettings().share], [false, false]);

  // --share-only records the answer and touches no agent
  write(paths.cursorJson(), "{}");
  const only = await cli("setup", "--yes", "--share-only");
  assert.deepEqual([only.code, only.out.share, loadSettings().share], [0, true, true]);
  assert.equal(read(paths.cursorJson()), "{}");
  assert.match(only.stderr, /Sharing: on\. Turn it off with api-anything setup --no-share --share-only/);
  const off = await cli("setup", "--no-share", "--share-only");
  assert.deepEqual([off.out.share, loadSettings().share], [false, false]);
  const unanswered = await cli("setup", "--share-only");
  assert.equal(unanswered.code, 1);
  assert.match(String(unanswered.out.error), /pass --yes or --no-share/);

  const both = await cli("setup", "--yes", "--no-share");
  assert.equal(both.code, 1);
  const bad = await cli("setup", "--agents", "vim");
  assert.match(String(bad.out.error), /unknown agent vim/);
});
