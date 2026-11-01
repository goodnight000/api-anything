/**
 * The agent skill: its folder stays loadable and points only at files it ships, the plugin manifest
 * matches the package, and a copy setup installed is brought up to date by a newer version unless the
 * user edited it.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { SERVER } from "../src/setup.js";
import {
  compareVersions,
  installSkill,
  packageSkill,
  recordSkillDirs,
  refreshSkills,
  skillDirs,
} from "../src/skill.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILL_DIR = join(ROOT, "skills", "api-anything");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };

const saved = { HOME: process.env.HOME, AA: process.env.API_ANYTHING_HOME };
let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "aa-skill-"));
  process.env.HOME = home;
  process.env.API_ANYTHING_HOME = join(home, ".api-anything");
});
afterEach(() => {
  process.env.HOME = saved.HOME;
  if (saved.AA === undefined) delete process.env.API_ANYTHING_HOME;
  else process.env.API_ANYTHING_HOME = saved.AA;
  rmSync(home, { recursive: true, force: true });
});

const write = (file: string, text: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const read = (file: string) => readFileSync(file, "utf8");
const markdown = () =>
  [...packageSkill().files].filter(([rel]) => rel.endsWith(".md")).map(([rel, text]) => ({ rel, text }));

test("the skill's frontmatter names its folder, and SKILL.md stays a short core", () => {
  const text = read(join(SKILL_DIR, "SKILL.md"));
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
  assert.match(front, /^name: api-anything$/m);
  const description = /^description: (.+)$/m.exec(front)?.[1] ?? "";
  assert.ok(description.length > 100 && description.length <= 1024, `description: ${description.length} chars`);
  // loaded whole whenever it triggers; tool descriptions, next and --help carry the detail
  const words = text.split(/\s+/).length;
  assert.ok(words < 800, `SKILL.md has ${words} words`);
});

test("every link in the skill resolves to a file it ships, and every reference is linked from SKILL.md", () => {
  const files = packageSkill().files;
  for (const { rel, text } of markdown())
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = m[1]!;
      if (/^[a-z]+:/.test(target)) continue;
      const resolved = join(dirname(rel), target).split("\\").join("/");
      assert.ok(files.has(resolved), `${rel} links to ${target}, which the skill does not ship`);
    }
  const core = files.get("SKILL.md")!;
  for (const ref of readdirSync(join(SKILL_DIR, "references")))
    assert.ok(core.includes(`](references/${ref})`), `SKILL.md never points at references/${ref}`);
});

test("the plugin manifest carries the package's version and the server setup connects", () => {
  const plugin = JSON.parse(read(join(ROOT, ".claude-plugin", "plugin.json")));
  assert.equal(plugin.version, PKG.version, "bump .claude-plugin/plugin.json with package.json");
  assert.deepEqual(plugin.mcpServers["api-anything"], SERVER);
});

test("compareVersions orders numeric parts, and a release after its prereleases", () => {
  assert.ok(compareVersions("0.3.10", "0.3.9") > 0);
  assert.ok(compareVersions("0.3.2", "0.4.0") < 0);
  assert.equal(compareVersions("1.0.0", "1.0"), 0);
  assert.ok(compareVersions("1.0.0", "1.0.0-rc.1") > 0);
  assert.ok(compareVersions("1.0.0-rc.1", "1.0.0-rc.2") < 0);
});

/** A copy at `dir` as some version of api-anything left it: these files, and a stamp of them. */
function copyFrom(dir: string, version: string, files: Record<string, string>, stampedAs = files) {
  for (const [rel, text] of Object.entries(files)) write(join(dir, rel), text);
  const sorted = Object.entries(stampedAs).sort(([x], [y]) => (x < y ? -1 : 1));
  const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
  write(join(dir, ".api-anything.json"), JSON.stringify({ version, hash }));
}
const isPackage = (dir: string) => {
  for (const [rel, text] of packageSkill().files) assert.equal(read(join(dir, rel)), text, rel);
};

test("refresh: a copy an older version installed and nobody edited is replaced, with no backup", () => {
  const dir = skillDirs.claude();
  copyFrom(dir, "0.0.1", { "SKILL.md": "old", "gone.md": "a file the package no longer ships" });
  recordSkillDirs([dir]);
  const [r] = refreshSkills();
  assert.deepEqual(r, { skill: "updated", skillDir: dir });
  isPackage(dir);
  assert.equal(existsSync(join(dir, "gone.md")), false);
  assert.equal(JSON.parse(read(join(dir, ".api-anything.json"))).version, PKG.version);
  assert.deepEqual(refreshSkills(), [], "a second run has nothing to do");
});

test("refresh keeps a copy the user edited, one from a newer version, and a link", () => {
  const edited = skillDirs.claude();
  copyFrom(edited, "0.0.1", { "SKILL.md": "mine now" }, { "SKILL.md": "as installed" });
  const newer = skillDirs.agents();
  copyFrom(newer, "99.0.0", { "SKILL.md": "from the future" });
  const linked = join(home, "elsewhere", "api-anything");
  write(join(home, "checkout", "SKILL.md"), "a checkout");
  mkdirSync(dirname(linked), { recursive: true });
  symlinkSync(join(home, "checkout"), linked);
  recordSkillDirs([edited, newer, linked]);
  assert.deepEqual(
    refreshSkills().map((r) => [r.skillDir, r.skill, r.skillNote]),
    [
      [edited, "kept", "edited since api-anything installed it"],
      [newer, "kept", "installed by api-anything 99.0.0, newer than this"],
      [linked, "kept", "a link to another folder"],
    ],
  );
  assert.equal(read(join(edited, "SKILL.md")), "mine now");
  assert.equal(read(join(newer, "SKILL.md")), "from the future");
  assert.equal(read(join(home, "checkout", "SKILL.md")), "a checkout");
});

test("refresh keeps a copy the user added a link to, and setup backs the link up before replacing it", () => {
  const dir = skillDirs.claude();
  copyFrom(dir, "0.0.1", { "SKILL.md": "old" });
  write(join(home, "notes.md"), "the user's own notes");
  symlinkSync(join(home, "notes.md"), join(dir, "custom.md"));
  mkdirSync(join(dir, "references"), { recursive: true });
  symlinkSync(join(home, "elsewhere"), join(dir, "references", "more"));
  recordSkillDirs([dir]);
  assert.deepEqual(
    refreshSkills().map((r) => [r.skill, r.skillNote]),
    [["kept", "edited since api-anything installed it"]],
  );
  assert.equal(read(join(dir, "custom.md")), "the user's own notes");
  const r = installSkill(dir, { mode: "setup" });
  assert.equal(r?.skill, "updated");
  assert.ok(r?.skillBackup, "a copy with a link the user added is backed up");
  assert.equal(read(join(r.skillBackup, "custom.md")), "the user's own notes");
  isPackage(dir);
});

test("refresh leaves a same-version copy with other files: a checkout's and a release's never trade places", () => {
  const dir = skillDirs.claude();
  copyFrom(dir, PKG.version, { "SKILL.md": "a checkout's edit" });
  recordSkillDirs([dir]);
  assert.deepEqual(refreshSkills(), []);
  assert.equal(read(join(dir, "SKILL.md")), "a checkout's edit");
});

test("refresh touches only this install's copies, and never installs one", () => {
  const dir = skillDirs.claude();
  // a copy from before stamps, in the usual place, under another install's API_ANYTHING_HOME
  write(join(dir, "SKILL.md"), "from an older setup");
  assert.deepEqual(refreshSkills(), []);
  assert.equal(read(join(dir, "SKILL.md")), "from an older setup");
  assert.equal(existsSync(skillDirs.agents()), false);

  recordSkillDirs([dir, skillDirs.agents()]);
  const [r, ...rest] = refreshSkills();
  assert.deepEqual(rest, [], "the recorded copy that is gone stays gone");
  assert.equal(r!.skill, "updated");
  // nothing said whether it was edited: kept under ~/.api-anything
  assert.equal(read(join(r!.skillBackup!, "SKILL.md")), "from an older setup");
  isPackage(dir);
});

test("the default install also refreshes the usual folders, where a setup from before the record put its copies", () => {
  delete process.env.API_ANYTHING_HOME;
  write(join(skillDirs.agents(), "SKILL.md"), "from an older setup");
  const [r] = refreshSkills();
  assert.equal(r!.skill, "updated");
  assert.ok(r!.skillBackup?.startsWith(join(home, ".api-anything")), String(r!.skillBackup));
  isPackage(skillDirs.agents());
});

test("setup mode: installs a missing copy, and a dry run writes nothing", () => {
  const dir = skillDirs.agents();
  assert.deepEqual(installSkill(dir, { mode: "setup", dryRun: true }), { skill: "would install", skillDir: dir });
  assert.equal(existsSync(dir), false);
  assert.deepEqual(installSkill(dir, { mode: "setup" }), { skill: "installed", skillDir: dir });
  isPackage(dir);
  assert.deepEqual(installSkill(dir, { mode: "setup" }), { skill: "unchanged", skillDir: dir });
});

test("any CLI command brings a recorded copy up to date first, and says so on stderr", async () => {
  const dir = skillDirs.claude();
  copyFrom(dir, "0.0.1", { "SKILL.md": "old" });
  recordSkillDirs([dir]);
  const stderr = await new Promise<string>((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src", "cli.ts"), "sites"],
      { cwd: ROOT, env: { ...process.env } },
      (_err, _stdout, err) => resolve(err),
    ),
  );
  assert.match(stderr, new RegExp(`updated the skill at ${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  isPackage(dir);
});
