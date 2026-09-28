// Let a Claude Code agent turn a site into operations with the api-anything skill, and measure it.
// The agent gets the skill as instructions and a shell that may only run `api-anything` and `jq`.
// Usage: node bench/explore/run-explore.mjs --name goodreads --prompt bench/explore/goodreads-intent.md [--site goodreads]
// Writes bench/explore/results/<name>/{summary.json,report.md[,<site>.json]}; raw events and state stay in bench/explore/state/.
import { spawn } from "node:child_process";
import { appendFileSync, chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { MODEL, toolCalls } from "../run-agents.mjs";

const repo = resolve(import.meta.dirname, "../..");
const { values: v } = parseArgs({ options: { name: { type: "string" }, prompt: { type: "string" }, site: { type: "string" }, budget: { type: "string", default: "5" } } });
if (!v.name || !v.prompt) throw new Error("usage: --name <run> --prompt <file> [--site <name>]");

const state = join(repo, "bench/explore/state", v.name), out = join(repo, "bench/explore/results", v.name);
rmSync(state, { recursive: true, force: true });
mkdirSync(join(state, "bin"), { recursive: true });
mkdirSync(join(state, "work"), { recursive: true });
mkdirSync(out, { recursive: true });
// `api-anything` on the agent's PATH is this checkout's build
writeFileSync(join(state, "bin/api-anything"), `#!/bin/sh\nexec "${process.execPath}" "${join(repo, "dist/cli.js")}" "$@"\n`);
chmodSync(join(state, "bin/api-anything"), 0o755);

const prompt = readFileSync(resolve(v.prompt), "utf8");
const skill = readFileSync(join(repo, "skills/api-anything/SKILL.md"), "utf8");
const env = { ...process.env, API_ANYTHING_HOME: join(state, "home"), PATH: `${join(state, "bin")}:${process.env.PATH}` };
const args = [
  "-p", prompt, "--model", MODEL, "--output-format", "stream-json", "--verbose",
  "--setting-sources", "project", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
  "--tools", "Bash", "--allowedTools", "Bash(api-anything:*)", "Bash(jq:*)", "--permission-mode", "dontAsk",
  "--append-system-prompt", `You have the api-anything skill. Its instructions:\n\n${skill}`,
  "--max-budget-usd", v.budget, "--no-session-persistence",
];

const log = join(state, "events.jsonl"), events = [];
const start = Date.now();
const code = await new Promise((done) => {
  const child = spawn("claude", args, { cwd: join(state, "work"), env, stdio: ["ignore", "pipe", "inherit"] });
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    for (let i; (i = buf.indexOf("\n")) >= 0; ) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const ev = { t: Date.now() - start, ...JSON.parse(line) };
      events.push(ev);
      appendFileSync(log, JSON.stringify(ev) + "\n");
    }
  });
  child.on("close", done);
});

const result = events.find((e) => e.type === "result") ?? {};
// paths on this machine are replaced so the committed log doesn't carry them
const local = (s) => s.replaceAll(state, "<state>").replaceAll(repo, "<repo>").replaceAll(process.env.HOME ?? "~", "~");
const commands = toolCalls(events).map((c) => ({ t: c.t, ms: c.done - c.t, command: local(String(c.input?.command ?? "").slice(0, 400)), resultChars: c.resultChars, isError: c.isError }));
const count = (re) => commands.filter((c) => re.test(c.command)).length;
const summary = {
  name: v.name, model: MODEL, at: new Date(start).toISOString(), exit: code,
  wallMs: Date.now() - start, costUsd: result.total_cost_usd, turns: result.num_turns,
  usage: result.modelUsage?.[MODEL],
  commands: commands.length, captures: count(/api-anything capture/), inspects: count(/api-anything inspect/), adds: count(/api-anything add/), calls: count(/api-anything call/),
  commandLog: commands,
};
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
writeFileSync(join(out, "report.md"), `${local(result.result ?? "(no final message)")}\n`);
if (v.site) {
  // the shareable spec: export strips samples and refuses one holding a live credential
  const exp = spawn("api-anything", ["export", v.site, "--keep-examples", "--out", join(out, `${v.site}.json`)], { env, stdio: "inherit" });
  await new Promise((r) => exp.on("close", r));
}
console.log(JSON.stringify({ ...summary, commandLog: undefined }));
