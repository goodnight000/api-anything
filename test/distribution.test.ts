import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

// The manifests directories read (docs/DISTRIBUTION.md) name this package's version, so a release
// that bumps package.json and forgets one of them would list or pin the previous version.
const read = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const pkg = read("package.json");
const repo = (pkg.repository.url as string).replace(/^git\+/, "").replace(/\.git$/, "");
const owner = repo.match(/^https:\/\/github\.com\/([^/]+)\//)![1]!;

test("server.json names the npm package and version this checkout publishes", () => {
  const server = read("server.json");
  assert.equal(server.name, pkg.mcpName, "server.json name must equal package.json mcpName");
  // GitHub sign-in to the MCP Registry grants only the io.github.<owner>/ namespace
  assert.ok(server.name.startsWith(`io.github.${owner}/`), server.name);
  assert.equal(server.version, pkg.version);
  assert.ok(server.description.length <= 100, "the MCP Registry refuses a description over 100 characters");
  assert.equal(server.repository.url, repo);
  assert.equal(server.packages.length, 1);
  const [npm] = server.packages;
  assert.equal(npm.registryType, "npm");
  assert.equal(npm.identifier, pkg.name);
  assert.equal(npm.version, pkg.version);
  assert.deepEqual(npm.transport, { type: "stdio" });
  assert.deepEqual(npm.packageArguments, [{ type: "positional", value: "mcp" }]);
});

test("the Claude Code plugin serves this package's MCP server and its skill", () => {
  const plugin = read(".claude-plugin/plugin.json");
  const market = read(".claude-plugin/marketplace.json");
  assert.equal(plugin.version, pkg.version, "a plugin's version pins installs until it changes");
  assert.deepEqual(plugin.mcpServers, { [pkg.name]: { command: "npx", args: ["-y", pkg.name, "mcp"] } });
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, plugin.name, "the install id and the skill prefix must agree");
  assert.equal(market.plugins[0].source, "./");
  // a plugin loads skills/<name>/SKILL.md from its root, which is the repository root here
  const skill = new URL("../skills/api-anything/SKILL.md", import.meta.url);
  assert.ok(existsSync(skill));
  assert.match(readFileSync(skill, "utf8"), /^---\nname: api-anything\n/);
});

test("glama.json names the repository's owner as a maintainer", () => {
  assert.ok(read("glama.json").maintainers.includes(owner));
});
