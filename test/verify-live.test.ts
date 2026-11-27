import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildHealth,
  type Health,
  ISSUE_TITLE,
  issueBody,
  parseHealth,
  persistentFailures,
  planIssue,
  runSite,
  type SiteRun,
  siteEntries,
  summary,
} from "./verify-live.js";

const SCRIPT = fileURLToPath(new URL("./verify-live.ts", import.meta.url));
const AT = "2026-11-26T06:00:00.000Z";

const caseRow = (op: string, c: string, outcome: string, extra: Record<string, unknown> = {}) => ({
  site: "shop",
  op,
  case: c,
  expect: "result",
  outcome,
  got: outcome === "pass" ? "result" : "input",
  ms: 120,
  tier: 1,
  ok: outcome === "pass",
  ...extra,
});

const run = (over: Partial<SiteRun> = {}): SiteRun => ({
  site: "shop",
  ops: ["search", "item", "deals", "gone", "locked"],
  values: ["blue-widget-0042", "tea kettle"],
  at: AT,
  output: {
    ok: false,
    counts: { pass: 3, fail: 1, inconclusive: 1, skipped: 1, preflight: 0 },
    results: [
      caseRow("search", "example", "pass", { tier: 2 }),
      caseRow("search", "check 1", "pass", { args: { q: "tea kettle" }, purpose: "a second query" }),
      caseRow("item", "example", "fail", {
        got: "input",
        reason: "no item blue-widget-0042 at https://shop.test/p/blue-widget-0042",
        ms: 80,
      }),
      caseRow("item", "check 1", "inconclusive", { got: "rate", reason: "rate limited" }),
      caseRow("deals", "example", "pass"),
      caseRow("deals", "next page", "inconclusive", { got: "no next page", reason: "page 1 is empty", ms: 5 }),
      { site: "shop", op: "locked", skipped: "needs login: locked was learned signed in", ok: false },
    ],
  },
  ...over,
});

const byOp = (entries: ReturnType<typeof siteEntries>) => Object.fromEntries(entries.map((e) => [e.op, e]));

test("each op gets one entry, decided by its worst case: fail, then inconclusive, then pass", () => {
  const e = byOp(siteEntries(run()));
  assert.deepEqual(Object.keys(e), ["search", "item", "deals", "gone", "locked"]);
  assert.deepEqual(e.search, {
    site: "shop",
    op: "search",
    result: "pass",
    case: "example",
    class: "result",
    tier: 2,
    ms: 120,
    at: AT,
  });
  assert.equal(e.item!.result, "fail");
  assert.equal(e.item!.case, "example");
  assert.equal(e.item!.class, "input");
  assert.equal(e.item!.ms, 80);
  assert.equal(e.deals!.result, "inconclusive");
  assert.equal(e.deals!.case, "next page");
  assert.equal(e.deals!.reason, "no next page to go on to");
  assert.equal(e.locked!.result, "skipped");
  assert.match(e.locked!.reason!, /needs login/);
  assert.equal(e.gone!.result, "inconclusive", "an op verify said nothing about tested nothing");
  assert.match(e.gone!.reason!, /reported nothing/);
});

test("an entry carries no args, purposes or answers, and its reason names no arg value", () => {
  const entries = siteEntries(run());
  const text = JSON.stringify(entries);
  assert.doesNotMatch(text, /tea kettle|blue-widget-0042|a second query|"args"|"purpose"|"next"/);
  assert.equal(
    byOp(entries).item!.reason,
    "answered input: the site refused the args, or has nothing for them, where it expects data",
  );
});

test("no text a site sent reaches the record: a reason is a fixed phrase chosen by verify's own values", () => {
  // each reason verify gives quotes something the site sent: a body, a redirect's path, a server's cursor
  const said: [string, string, string][] = [
    ["redirected to /login/review-marker", "auth", "answered auth: the site asked for a sign-in"],
    [
      "cursor=srv-cursor-7f3a answered page 1's items again: the server does not read cursor where the request puts it",
      "page 1 again",
      "the next page answered page 1's items again",
    ],
    ["HTTP 503: The service is offline for maintenance.", "error", "answered error"],
    [
      "HTTP 403 with no login or challenge markers: <body class=theme-beta>",
      "blocked",
      "answered blocked: a bot challenge or a block",
    ],
    ["GraphQL: Viewer quota exceeded for this account", "rate", "answered rate: the site limited the requests"],
    [
      "response is not JSON: Service temporarily down",
      "drift",
      "answered drift: the answer is not the shape the op learned",
    ],
    ["something new: with words", "a class this record never heard of", "answered in a way this record does not name"],
  ];
  const e = siteEntries(
    run({
      ops: said.map((_, i) => `op${i}`),
      output: {
        ok: false,
        results: said.map(([reason, got], i) =>
          caseRow(`op${i}`, i === 1 ? "next page" : "example", "inconclusive", { got, reason }),
        ),
      },
    }),
  );
  assert.deepEqual(
    e.map((x) => x.reason),
    said.map(([, , kept]) => kept),
  );
  const text = JSON.stringify(e);
  for (const word of [
    "review-marker",
    "/login",
    "srv-cursor",
    "maintenance",
    "theme-beta",
    "quota",
    "temporarily",
    "with words",
  ])
    assert.ok(!text.includes(word), word);
  // a failure says what was expected, from the case's own expect
  const failed = siteEntries(
    run({
      ops: ["a"],
      output: { ok: false, results: [caseRow("a", "example", "fail", { got: "empty", reason: "x" })] },
    }),
  );
  assert.equal(failed[0]!.reason, "answered with no results, where it expects data");
});

test("the summary and the issue say once where the site's own words are", () => {
  const md = summary(health());
  assert.equal(md.split("api-anything verify <site>").length - 1, 1);
  const now = health();
  const body = issueBody(now, persistentFailures(now, only("shop", "item", "fail"))!);
  assert.equal(body.split("api-anything verify <site>").length - 1, 1);
});

test("a site verify could not load fails every op; a run that did not finish tests nothing", () => {
  const broken = siteEntries(
    run({ ops: ["a", "b"], output: { ok: false, results: [{ site: "shop", ok: false, error: 'no site "shop"' }] } }),
  );
  assert.deepEqual(
    broken.map((e) => [e.op, e.result, e.class, e.reason]),
    [
      ["a", "fail", "error", "verify could not run the site"],
      ["b", "fail", "error", "verify could not run the site"],
    ],
  );
  const stopped = siteEntries(run({ ops: ["a"], output: undefined, problem: "verify did not finish in 20 min" }));
  assert.deepEqual(
    stopped.map((e) => [e.result, e.reason]),
    [["inconclusive", "verify did not finish in 20 min"]],
  );
});

test("a write gets skipped: verify never sends one", () => {
  const e = siteEntries(
    run({
      ops: ["post"],
      output: { ok: true, results: [{ site: "shop", op: "post", preflight: { ok: true, builds: true }, ok: true }] },
    }),
  );
  assert.deepEqual(
    e.map((x) => [x.result, x.reason]),
    [["skipped", "a write: verify never sends one"]],
  );
});

const health = (runs: SiteRun[] = [run()]): Health =>
  buildHealth(runs, {
    version: "0.5.0",
    commit: "abc1234def",
    run: "https://github.com/o/r/actions/runs/1",
    startedAt: "2026-11-26T05:00:00.000Z",
    finishedAt: AT,
  });

test("the record's header has the version, commit, duration and totals", () => {
  const h = health([run(), run({ site: "news", ops: ["top"], output: { ok: true, results: [], counts: undefined } })]);
  assert.equal(h.version, "0.5.0");
  assert.equal(h.commit, "abc1234def");
  assert.equal(h.ms, 3_600_000);
  assert.equal(h.sites, 2);
  assert.deepEqual(h.totals, { ops: 6, pass: 1, fail: 1, inconclusive: 3, skipped: 1 });
  assert.deepEqual(h.cases, { pass: 3, fail: 1, inconclusive: 1, skipped: 1 });
  assert.equal(h.entries.length, 6);
  assert.deepEqual(parseHealth(JSON.stringify(h)), h, "the record reads back as itself");
});

test("the summary gives totals, then each failing and inconclusive op with its reason", () => {
  const md = summary(health());
  assert.match(md, /^## Live verification/);
  assert.match(md, /api-anything 0\.5\.0 at `abc1234`/);
  assert.match(md, /\| pass \| 1 \|/);
  assert.match(md, /\| fail \| 1 \|/);
  const failing = md.slice(md.indexOf("### Failing"), md.indexOf("### Inconclusive"));
  assert.match(failing, /`shop\.item` \| example \| input \| 1 \| answered input/);
  const inconclusive = md.slice(md.indexOf("### Inconclusive"));
  assert.match(inconclusive, /`shop\.deals`/);
  assert.match(inconclusive, /`shop\.gone`/);
  assert.doesNotMatch(md, /shop\.search|shop\.locked/, "passing and skipped ops are counted, not listed");
});

test("a reason verify wrote never reaches the summary, a pipe in it neither", () => {
  const md = summary(
    health([
      run({ ops: ["a"], output: { ok: false, results: [caseRow("a", "example", "fail", { reason: "a | b\\c" })] } }),
    ]),
  );
  assert.doesNotMatch(md, /a \| b|a \\\| b/);
});

test("a run with nothing failing or inconclusive says so", () => {
  const md = summary(
    health([run({ ops: ["search"], output: { ok: true, results: [caseRow("search", "example", "pass")] } })]),
  );
  assert.match(md, /Every operation passed or was skipped\./);
  assert.doesNotMatch(md, /### /);
});

test("a previous record that is missing or not a record is no state", () => {
  assert.equal(parseHealth(undefined), undefined);
  assert.equal(parseHealth("{not json"), undefined);
  assert.equal(parseHealth(JSON.stringify({ version: "0.5.0" })), undefined);
  assert.equal(parseHealth(JSON.stringify({ entries: [{ site: "a", op: "b", result: "maybe" }] })), undefined);
  assert.equal(parseHealth("[]"), undefined);
});

const only = (site: string, op: string, result: string): Health =>
  ({ ...health(), entries: [{ site, op, result, at: AT }] }) as Health;

test("an op is listed only when it failed in this run and the one before", () => {
  const now = health();
  assert.equal(persistentFailures(now, undefined), undefined, "no previous record: no decision");
  assert.deepEqual(
    persistentFailures(now, only("shop", "item", "fail"))!.map((e) => `${e.site}.${e.op}`),
    ["shop.item"],
  );
  assert.deepEqual(persistentFailures(now, only("shop", "item", "inconclusive")), [], "one bad run is noise");
  assert.deepEqual(persistentFailures(now, only("shop", "deals", "fail")), [], "inconclusive now is not a failure");
  assert.deepEqual(persistentFailures(now, only("other", "item", "fail")), [], "another site's op of the same name");
});

test("the issue body lists each op failing twice, with the latest run", () => {
  const now = health();
  const body = issueBody(now, persistentFailures(now, only("shop", "item", "fail"))!);
  assert.match(body, /1 bundled operation failed in two consecutive/);
  assert.match(body, /\| `shop\.item` \| example \| input \(tier 1\) \| answered input: .* \|/);
  assert.match(body, /\[the run\]\(https:\/\/github\.com\/o\/r\/actions\/runs\/1\)/);
  assert.match(body, /1 pass, 1 fail, 2 inconclusive, 1 skipped/);
  assert.match(issueBody(now, []), /No bundled operation failed in two consecutive runs/);
});

test("the issue body stays under GitHub's limit however many ops fail", () => {
  const many = Array.from({ length: 400 }, (_, i) => ({
    site: `site${i}`,
    op: "op",
    result: "fail" as const,
    class: "drift",
    reason: "y".repeat(200),
    at: AT,
  }));
  const body = issueBody(health(), many);
  assert.ok(body.length < 65_536, `${body.length} chars`);
  assert.match(body, /and 300 more: the run's health\.json lists them/);
});

test("the issue is created, edited, reopened or closed by what is failing", () => {
  const mine = { number: 7, title: ISSUE_TITLE, state: "CLOSED" };
  const other = { number: 3, title: "Live verification: something else", state: "OPEN" };
  const entry = { site: "a", op: "b", result: "fail" as const, at: AT };
  assert.deepEqual(planIssue(undefined, [mine]), { action: "none", title: ISSUE_TITLE });
  assert.deepEqual(planIssue([entry], [other]), { action: "create", title: ISSUE_TITLE });
  assert.deepEqual(planIssue([entry], [other, mine]), { action: "reopen", number: 7, title: ISSUE_TITLE });
  assert.deepEqual(planIssue([entry], [{ ...mine, state: "OPEN" }]), {
    action: "update",
    number: 7,
    title: ISSUE_TITLE,
  });
  assert.deepEqual(planIssue([], [{ ...mine, state: "open" }]), { action: "close", number: 7, title: ISSUE_TITLE });
  assert.deepEqual(planIssue([], [mine]), { action: "none", title: ISSUE_TITLE });
  assert.deepEqual(planIssue([], [other]), { action: "none", title: ISSUE_TITLE });
  assert.deepEqual(
    planIssue(
      [entry],
      [
        { ...mine, number: 9, state: "OPEN" },
        { ...mine, number: 4 },
      ],
    ),
    { action: "reopen", number: 4, title: ISSUE_TITLE },
    "the oldest one is the tracking issue",
  );
});

test("track reads both records, writes the body and prints the plan", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-live-"));
  try {
    const now = health();
    writeFileSync(join(dir, "current.json"), JSON.stringify(now));
    writeFileSync(join(dir, "previous.json"), JSON.stringify(only("shop", "item", "fail")));
    writeFileSync(join(dir, "issues.json"), JSON.stringify([{ number: 5, title: ISSUE_TITLE, state: "OPEN" }]));
    const args = (prev: string) => [
      "--import",
      "tsx",
      SCRIPT,
      "track",
      "--current",
      join(dir, "current.json"),
      "--previous",
      join(dir, prev),
      "--issues",
      join(dir, "issues.json"),
      "--body",
      join(dir, "body.md"),
    ];
    const plan = JSON.parse(execFileSync(process.execPath, args("previous.json"), { encoding: "utf8" }));
    assert.deepEqual(plan, { action: "update", number: 5, title: ISSUE_TITLE, failing: ["shop.item"] });
    assert.match(readFileSync(join(dir, "body.md"), "utf8"), /`shop\.item`/);
    const none = JSON.parse(execFileSync(process.execPath, args("missing.json"), { encoding: "utf8" }));
    assert.deepEqual(none, { action: "none", title: ISSUE_TITLE }, "no previous record: the issue stays as it is");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run refuses a home that is not empty, before any site is called", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-live-"));
  try {
    writeFileSync(join(dir, "pace.json"), "{}");
    const r = spawnSync(process.execPath, ["--import", "tsx", SCRIPT, "run", "--home", dir, "--out", join(dir, "o")], {
      encoding: "utf8",
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /is not empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const fake = (dir: string, js: string) => {
  const f = join(dir, "fake.mjs");
  writeFileSync(f, js);
  return f;
};

test("a site's verify answers with its JSON, whatever its exit code", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-live-"));
  try {
    const cli = fake(
      dir,
      `process.stdout.write("noise\\n" + JSON.stringify({ ok: false, results: [{ site: process.argv[3], op: "x", outcome: "fail" }] }) + "\\n"); process.exitCode = 1;`,
    );
    const r = await runSite("shop", { command: [process.execPath, cli], env: process.env, timeoutMs: 10_000 });
    assert.equal(r.problem, undefined);
    assert.equal(r.output!.results![0]!.site, "shop");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a verify that crashed or hangs is a problem, not an outcome", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-live-"));
  try {
    const crash = fake(
      dir,
      `process.stdout.write(JSON.stringify({ ok: false, error: "the lock is busy" }) + "\\n"); process.exit(1);`,
    );
    const r = await runSite("shop", { command: [process.execPath, crash], env: process.env, timeoutMs: 10_000 });
    assert.equal(r.output, undefined);
    assert.equal(r.problem, "verify stopped with an error", "its error can quote the site");
    const hang = fake(dir, "setInterval(() => {}, 1000);");
    const started = Date.now();
    const h = await runSite("shop", { command: [process.execPath, hang], env: process.env, timeoutMs: 500 });
    assert.match(h.problem!, /did not finish in 0\.5 s/);
    assert.ok(Date.now() - started < 8000, "the hung verify is killed");
    const garbage = fake(dir, `process.stderr.write("TypeError: boom\\n"); process.exit(3);`);
    const g = await runSite("shop", { command: [process.execPath, garbage], env: process.env, timeoutMs: 10_000 });
    assert.equal(g.problem, "verify exited 3 with no answer", "its stderr can quote the site");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
