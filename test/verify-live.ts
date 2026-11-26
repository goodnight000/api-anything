/**
 * `npm run verify:live`: `api-anything verify` over every bundled site from an empty home, logged out
 * and local-only, one site at a time at the tool's own pace, written as a health record
 * (`health.json`: one entry per bundled op, no args and no answers) and a Markdown summary.
 * `track` compares the record with the previous run's for the scheduled workflow
 * (.github/workflows/verify-live.yml): an op is reported once it failed in two consecutive runs.
 * It imports only Node's own modules, so the workflow's issue job runs it with plain `node`.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export const ISSUE_TITLE = "Live verification: failing operations";

export type Result = "pass" | "fail" | "inconclusive" | "skipped";
const RESULTS: Result[] = ["pass", "fail", "inconclusive", "skipped"];

export interface Entry {
  site: string;
  op: string;
  result: Result;
  /** the deciding case: "example", "check <n>" or "next page" */
  case?: string;
  /** what the deciding call answered: result, empty, input, or a failure's class */
  class?: string;
  tier?: number;
  ms?: number;
  reason?: string;
  at: string;
}

export interface Health {
  version: string;
  commit?: string;
  run?: string;
  startedAt: string;
  finishedAt: string;
  ms: number;
  sites: number;
  totals: Record<Result, number> & { ops: number };
  /** verify's own counts of cases, summed over the sites */
  cases: { pass: number; fail: number; inconclusive: number; skipped: number };
  entries: Entry[];
}

/** One row of `api-anything verify`'s `results`. */
interface Row {
  site?: string;
  op?: string;
  case?: string;
  outcome?: string;
  got?: string;
  tier?: number;
  ms?: number;
  reason?: string;
  skipped?: string;
  preflight?: unknown;
  error?: string;
  ok?: boolean;
}

export interface VerifyOutput {
  ok?: boolean;
  counts?: Partial<Record<"pass" | "fail" | "inconclusive" | "skipped" | "preflight", number>>;
  results?: Row[];
  error?: string;
}

/** One site's verify, as this script saw it. */
export interface SiteRun {
  site: string;
  /** every op of the bundled spec, in its order */
  ops: string[];
  /** the spec's example, default and check values: a reason quoting one has it replaced */
  values: string[];
  at: string;
  output?: VerifyOutput;
  /** why there is no output: the verify did not finish, or crashed */
  problem?: string;
}

const REASON_CHARS = 200;

function shortReason(text: string, values: string[]): string {
  let s = text.replace(/\s+/g, " ").trim();
  const forms = values
    .filter((v) => v.length >= 3)
    .flatMap((v) => [v, encodeURIComponent(v)])
    .sort((a, b) => b.length - a.length);
  for (const v of forms) s = s.split(v).join("<arg>");
  return s.length > REASON_CHARS ? `${s.slice(0, REASON_CHARS - 1)}…` : s;
}

/** Each op's entry from its site's verify: the worst of its cases decides (fail, inconclusive, pass). */
export function siteEntries(run: SiteRun): Entry[] {
  const { site, at } = run;
  const reason = (t: string) => shortReason(t, run.values);
  if (!run.output)
    return run.ops.map((op) => ({
      site,
      op,
      result: "inconclusive",
      reason: reason(run.problem ?? "verify gave no answer"),
      at,
    }));
  const rows = run.output.results ?? [];
  const broken = rows.find((r) => r.error !== undefined && r.op === undefined);
  return run.ops.map((op): Entry => {
    if (broken)
      return {
        site,
        op,
        result: "fail",
        class: "error",
        reason: reason(`verify could not run the site: ${broken.error}`),
        at,
      };
    const mine = rows.filter((r) => r.op === op);
    const skipped = mine.find((r) => r.skipped !== undefined);
    if (skipped) return { site, op, result: "skipped", reason: reason(skipped.skipped!), at };
    if (mine.some((r) => r.preflight !== undefined))
      return { site, op, result: "skipped", reason: "a write: verify never sends one", at };
    const cases = mine.filter((r) => r.outcome !== undefined);
    const decider =
      cases.find((r) => r.outcome === "fail") ??
      cases.find((r) => r.outcome === "inconclusive") ??
      cases.find((r) => r.outcome === "pass");
    if (!decider) return { site, op, result: "inconclusive", reason: "verify reported nothing for it", at };
    return {
      site,
      op,
      result: decider.outcome as Result,
      ...(decider.case !== undefined ? { case: decider.case } : {}),
      ...(decider.got !== undefined ? { class: decider.got } : {}),
      ...(decider.tier !== undefined ? { tier: decider.tier } : {}),
      ...(decider.ms !== undefined ? { ms: decider.ms } : {}),
      ...(decider.outcome !== "pass" && decider.reason ? { reason: reason(decider.reason) } : {}),
      at,
    };
  });
}

export function buildHealth(
  runs: SiteRun[],
  meta: { version: string; commit?: string; run?: string; startedAt: string; finishedAt: string },
): Health {
  const entries = runs.flatMap(siteEntries);
  const totals = { ops: entries.length, pass: 0, fail: 0, inconclusive: 0, skipped: 0 };
  for (const e of entries) totals[e.result]++;
  const cases = { pass: 0, fail: 0, inconclusive: 0, skipped: 0 };
  for (const r of runs)
    for (const k of Object.keys(cases) as (keyof typeof cases)[]) cases[k] += r.output?.counts?.[k] ?? 0;
  return {
    version: meta.version,
    ...(meta.commit ? { commit: meta.commit } : {}),
    ...(meta.run ? { run: meta.run } : {}),
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    ms: Date.parse(meta.finishedAt) - Date.parse(meta.startedAt),
    sites: runs.length,
    totals,
    cases,
    entries,
  };
}

const cell = (s: string | undefined) => (s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
const name = (e: Entry) => `\`${e.site}.${e.op}\``;
const minutes = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);
const day = (iso: string) => iso.slice(0, 10);
const counted = (h: Health) =>
  `${h.totals.pass} pass, ${h.totals.fail} fail, ${h.totals.inconclusive} inconclusive, ${h.totals.skipped} skipped`;

function table(entries: Entry[]): string[] {
  return [
    "| operation | case | answered | tier | reason |",
    "|---|---|---|---|---|",
    ...entries.map((e) => `| ${name(e)} | ${cell(e.case)} | ${cell(e.class)} | ${e.tier ?? ""} | ${cell(e.reason)} |`),
  ];
}

/** The record as Markdown, for a job summary: totals, then the failing and inconclusive ops. */
export function summary(h: Health): string {
  const of = (r: Result) => h.entries.filter((e) => e.result === r);
  const lines = [
    `## Live verification, ${day(h.finishedAt)}`,
    "",
    `api-anything ${h.version}${h.commit ? ` at \`${h.commit.slice(0, 7)}\`` : ""}: ${h.totals.ops} bundled operations on ${h.sites} sites, logged out, in ${minutes(h.ms)}. Cases: ${h.cases.pass} passed, ${h.cases.fail} failed, ${h.cases.inconclusive} inconclusive, ${h.cases.skipped} skipped.`,
    "",
    "| result | operations |",
    "|---|---|",
    ...RESULTS.map((r) => `| ${r} | ${h.totals[r]} |`),
  ];
  const fail = of("fail");
  const inconclusive = of("inconclusive");
  if (!fail.length && !inconclusive.length) lines.push("", "Every operation passed or was skipped.");
  if (fail.length) lines.push("", `### Failing (${fail.length})`, "", ...table(fail));
  if (inconclusive.length)
    lines.push(
      "",
      `### Inconclusive (${inconclusive.length})`,
      "",
      "A rate limit, a challenge, a sign-in page or a server error: these tested nothing.",
      "",
      ...table(inconclusive),
    );
  return `${lines.join("\n")}\n`;
}

/** A record read back, or undefined for anything that is not one (missing, malformed): no previous state. */
export function parseHealth(text: string | undefined): Health | undefined {
  if (text === undefined) return undefined;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  const entries = (v as Health | null)?.entries;
  if (!Array.isArray(entries)) return undefined;
  const fine = entries.every(
    (e) =>
      typeof e?.site === "string" && typeof e?.op === "string" && (RESULTS as string[]).includes(e?.result as string),
  );
  return fine ? (v as Health) : undefined;
}

/** The ops that failed in this run and in the previous one; undefined when there is no previous record to say. */
export function persistentFailures(current: Health, previous: Health | undefined): Entry[] | undefined {
  if (!previous) return undefined;
  const key = (e: Entry) => `${e.site}\0${e.op}`;
  const before = new Set(previous.entries.filter((e) => e.result === "fail").map(key));
  return current.entries.filter((e) => e.result === "fail" && before.has(key(e)));
}

const ISSUE_ROWS = 100;

export function issueBody(current: Health, failing: Entry[]): string {
  const latest = `Latest run: ${day(current.finishedAt)}, api-anything ${current.version}${
    current.commit ? ` at ${current.commit.slice(0, 7)}` : ""
  }: ${counted(current)}${current.run ? ` ([the run](${current.run}))` : ""}.`;
  const head =
    "Kept up to date by the scheduled live verification (`.github/workflows/verify-live.yml`); an edit here is overwritten by the next run.";
  if (!failing.length) return `No bundled operation failed in two consecutive runs.\n\n${latest}\n\n${head}\n`;
  const shown = failing.slice(0, ISSUE_ROWS);
  const lines = [
    `${failing.length} bundled operation${failing.length === 1 ? "" : "s"} failed in two consecutive daily runs. One failed run is not listed: a site's hiccup or a rate limit looks the same.`,
    "",
    latest,
    "",
    "| operation | case | answered | reason |",
    "|---|---|---|---|",
    ...shown.map(
      (e) =>
        `| ${name(e)} | ${cell(e.case)} | ${cell(e.class)}${e.tier ? ` (tier ${e.tier})` : ""} | ${cell(e.reason)} |`,
    ),
  ];
  if (failing.length > shown.length)
    lines.push("", `and ${failing.length - shown.length} more: the run's health.json lists them.`);
  lines.push("", head);
  return `${lines.join("\n")}\n`;
}

export interface Issue {
  number: number;
  title: string;
  state: string;
}

export interface Plan {
  action: "create" | "update" | "reopen" | "close" | "none";
  number?: number;
  title: string;
}

/**
 * What to do with the one tracking issue: the oldest issue of exactly this title. No decision
 * (`failing` undefined) leaves it as it is.
 */
export function planIssue(failing: Entry[] | undefined, issues: Issue[]): Plan {
  const title = ISSUE_TITLE;
  const issue = issues.filter((i) => i.title === title).sort((a, b) => a.number - b.number)[0];
  const open = issue?.state.toUpperCase() === "OPEN";
  if (failing === undefined) return { action: "none", title };
  if (failing.length) {
    if (!issue) return { action: "create", title };
    return { action: open ? "update" : "reopen", number: issue.number, title };
  }
  return issue && open ? { action: "close", number: issue.number, title } : { action: "none", title };
}

/** The bundled specs, read from the checkout's `sites/`: each op's name and the values its cases use. */
function bundled(): { site: string; ops: string[]; values: string[] }[] {
  type Spec = {
    name: string;
    operations: { name: string; params?: { example?: unknown; default?: unknown }[]; checks?: { args: object }[] }[];
  };
  return readdirSync(join(ROOT, "sites"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const s = JSON.parse(readFileSync(join(ROOT, "sites", f), "utf8")) as Spec;
      const values = s.operations.flatMap((o) => [
        ...(o.params ?? []).flatMap((p) => [p.example, p.default]),
        ...(o.checks ?? []).flatMap((c) => Object.values(c.args)),
      ]);
      return {
        site: s.name,
        ops: s.operations.map((o) => o.name),
        values: [...new Set(values.filter((v) => v !== undefined && v !== null).map(String))],
      };
    });
}

/** One `api-anything verify <site>` in its own process, killed (with its browser) past `timeoutMs`. */
export function runSite(
  site: string,
  o: { command: string[]; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<{ output?: VerifyOutput; problem?: string }> {
  const [bin, ...args] = o.command;
  return new Promise((resolve) => {
    const child = spawn(bin!, [...args, "verify", site], {
      cwd: ROOT,
      env: o.env,
      stdio: ["ignore", "pipe", "pipe"],
      // its own process group, so a kill reaches the Chrome it started
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-4000);
    });
    let timedOut = false;
    const kill = (signal: NodeJS.Signals) => {
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {}
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill("SIGTERM");
      setTimeout(() => kill("SIGKILL"), 5000).unref();
    }, o.timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return resolve({ problem: `verify did not finish in ${minutesOrSeconds(o.timeoutMs)}` });
      const last = stdout.trim().split("\n").pop() ?? "";
      let parsed: VerifyOutput | undefined;
      try {
        parsed = JSON.parse(last) as VerifyOutput;
      } catch {}
      if (parsed && Array.isArray(parsed.results)) return resolve({ output: parsed });
      if (parsed?.error) return resolve({ problem: `verify stopped: ${parsed.error}` });
      const why = stderr.trim().split("\n").pop() ?? "";
      resolve({ problem: `verify exited ${code} with no answer${why ? `: ${why}` : ""}` });
    });
  });
}

const minutesOrSeconds = (ms: number) =>
  ms < 60_000 ? `${(ms / 1000).toFixed(1).replace(/\.0$/, "")} s` : `${Math.round(ms / 60_000)} min`;

function commit(): string | undefined {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function runUrl(): string | undefined {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: id } = process.env;
  return server && repo && id ? `${server}/${repo}/actions/runs/${id}` : undefined;
}

class Usage extends Error {}

async function cmdRun(v: Record<string, string | boolean | undefined>, names: string[]): Promise<number> {
  const out = typeof v.out === "string" ? v.out : join(process.cwd(), "verify-live");
  const timeoutMs = Number(v["site-timeout"] ?? 20) * 60_000;
  if (!(timeoutMs > 0)) throw new Usage("--site-timeout takes minutes, more than 0");
  const given = typeof v.home === "string" ? v.home : undefined;
  if (given && existsSync(given) && readdirSync(given).length)
    throw new Usage(`--home ${given} is not empty: the run starts from an empty home, logged out`);
  const specs = bundled();
  const unknown = names.filter((n) => !specs.some((s) => s.site === n));
  if (unknown.length) throw new Usage(`not a bundled site: ${unknown.join(", ")}`);
  const chosen = names.length ? specs.filter((s) => names.includes(s.site)) : specs;
  const home = given ?? mkdtempSync(join(tmpdir(), "aa-verify-live-"));
  mkdirSync(home, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    API_ANYTHING_HOME: home,
    // nothing goes to the shared catalog: no reports, no pulls
    API_ANYTHING_LOCAL_ONLY: "1",
    // a throwaway passphrase for a throwaway home: the OS key store is never touched
    API_ANYTHING_KEY: randomBytes(24).toString("hex"),
  };
  // logged out: no pre-approved import of the everyday browser's cookies
  delete env.API_ANYTHING_ALLOW_IMPORT;
  const command = [process.execPath, "--import", "tsx", join(ROOT, "src", "cli.ts")];
  const startedAt = new Date().toISOString();
  const runs: SiteRun[] = [];
  try {
    for (const [i, s] of chosen.entries()) {
      const t = Date.now();
      const r = await runSite(s.site, { command, env, timeoutMs });
      const run: SiteRun = { ...s, at: new Date().toISOString(), ...r };
      runs.push(run);
      const results = siteEntries(run).map((e) => e.result);
      const tally = RESULTS.filter((x) => results.includes(x))
        .map((x) => `${results.filter((y) => y === x).length} ${x}`)
        .join(", ");
      process.stderr.write(`[${i + 1}/${chosen.length}] ${s.site}: ${tally} (${minutesOrSeconds(Date.now() - t)})\n`);
    }
  } finally {
    if (!given) rmSync(home, { recursive: true, force: true });
  }
  const health = buildHealth(runs, {
    version: (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version,
    commit: commit(),
    run: runUrl(),
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "health.json"), `${JSON.stringify(health, null, 1)}\n`);
  writeFileSync(join(out, "summary.md"), summary(health));
  process.stdout.write(`${JSON.stringify({ out, totals: health.totals, cases: health.cases, ms: health.ms })}\n`);
  return v["fail-on-failures"] && health.totals.fail ? 1 : 0;
}

function cmdTrack(v: Record<string, string | boolean | undefined>): number {
  const file = (flag: string) => {
    const f = v[flag];
    if (typeof f !== "string") throw new Usage(`track needs --${flag} <file>`);
    return f;
  };
  const read = (f: string) => (existsSync(f) ? readFileSync(f, "utf8") : undefined);
  const current = parseHealth(read(file("current")));
  if (!current) throw new Usage(`--current ${file("current")} is not a health record`);
  const previous = typeof v.previous === "string" ? parseHealth(read(v.previous)) : undefined;
  const issues = JSON.parse(read(file("issues")) ?? "[]") as Issue[];
  const failing = persistentFailures(current, previous);
  const plan = planIssue(failing, issues);
  if (plan.action !== "none") writeFileSync(file("body"), issueBody(current, failing ?? []));
  process.stdout.write(
    `${JSON.stringify(failing?.length ? { ...plan, failing: failing.map((e) => `${e.site}.${e.op}`) } : plan)}\n`,
  );
  return 0;
}

const USAGE = `usage: verify-live run [site ...] [--out <dir>] [--home <empty dir>] [--site-timeout <minutes>] [--fail-on-failures]
       verify-live track --current <health.json> [--previous <health.json>] --issues <issues.json> --body <file>`;

async function main(argv: string[]): Promise<number> {
  const { values: v, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: "string" },
      home: { type: "string" },
      "site-timeout": { type: "string" },
      "fail-on-failures": { type: "boolean" },
      current: { type: "string" },
      previous: { type: "string" },
      issues: { type: "string" },
      body: { type: "string" },
    },
  });
  const [cmd, ...rest] = positionals;
  if (cmd === "run") return cmdRun(v, rest);
  if (cmd === "track" && !rest.length) return cmdTrack(v);
  throw new Usage(USAGE);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`verify-live: ${(e as Error).message}\n`);
    process.exitCode = e instanceof Usage || (e as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") ? 2 : 1;
  }
}
