// Offline engine latency, with assertions before timing and after each batch. No accounts or live sites.
// node --import tsx bench/engine.mjs [--repo /path/to/baseline] [--samples 7]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    repo: { type: "string", default: "." },
    samples: { type: "string", default: "7" },
    revision: { type: "string" },
    only: { type: "string" },
  },
});
const repo = resolve(values.repo);
const sourceHash = createHash("sha256");
for (const file of readdirSync(join(repo, "src"))
  .filter((name) => name.endsWith(".ts"))
  .sort())
  sourceHash.update(file).update(readFileSync(join(repo, "src", file)));
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 3);
const state = mkdtempSync(join(tmpdir(), "aa-engine-"));
process.env.API_ANYTHING_HOME = state;
const load = (name) => import(pathToFileURL(join(repo, `src/${name}.ts`)).href);
const [
  { judge },
  { parseSite },
  { pick, capOutput },
  { outlineJson },
  { buildRequest },
  { call },
  { saveSite },
  { startFixture },
] = await Promise.all([
  load("classify"),
  load("spec"),
  load("extract"),
  load("outline"),
  load("http"),
  load("execute"),
  load("store"),
  import(pathToFileURL(join(repo, "test/fixture/server.ts")).href),
]);
const rows = Array.from({ length: 1000 }, (_, i) => ({
  id: String(i),
  user: { name: `user-${i}` },
  url: `/u/${i}`,
  text: "x".repeat(160),
}));
const body = JSON.stringify({ data: { rows } });
const html = `<html><body><ul>${rows
  .slice(0, 200)
  .map((r) => `<li><a href="${r.url}">${r.user.name}</a></li>`)
  .join("")}</ul></body></html>`;
const site = parseSite({
  name: "perf",
  baseUrl: "http://localhost",
  operations: [
    {
      name: "rows",
      readOnly: true,
      trigger: { url: "http://localhost" },
      request: { method: "GET", url: "http://localhost/api?name=alice&constant=%2f%2F", headers: {} },
      params: [{ name: "name", example: "alice" }],
      slots: [{ param: "name", at: ["query:name"] }],
      response: { extract: "data.rows", pick: ["id", "name=user.name", "userId=url~/u/(.*)"] },
    },
  ],
});
const op = site.operations[0];
const htmlOp = { ...op, response: { format: "html", html: { items: "ul li", fields: { name: "a", url: "a@href" } } } };
const observed = { status: 200, headers: { "content-type": "application/json" }, body };
const rpcOp = { ...op, response: { ...op.response, extract: "[0][2].data.rows" } };
const rpcObserved = { ...observed, body: JSON.stringify([["wrb.fr", "rows", body, null, null, null]]) };
const wide = Object.fromEntries(Array.from({ length: 30000 }, (_, i) => [`key${i}`, { value: `entry${i}` }]));
const summary = [];
async function measure(name, iterations, run, check) {
  if (values.only && values.only !== name) return;
  check(await run());
  for (let i = 0; i < Math.min(iterations, 5); i++) await run();
  const times = [];
  for (let sample = 0; sample < samples; sample++) {
    const start = performance.now();
    let result;
    for (let i = 0; i < iterations; i++) result = await run();
    times.push((performance.now() - start) / iterations);
    check(result);
  }
  times.sort((a, b) => a - b);
  summary.push({
    name,
    iterations,
    samples,
    medianMs: times[Math.floor(times.length / 2)],
    p95BatchMeanMs: times[Math.ceil(times.length * 0.95) - 1],
  });
}
let server;
let bulk;
let retainedFullAnswer;
const homes = [];
try {
  await measure(
    "judge-json-1000",
    15,
    () => judge(op, observed),
    (r) => {
      assert.equal(r.class, "ok");
      assert.equal(r.data.length, 1000);
      assert.deepEqual(r.data[999], { id: "999", name: "user-999", userId: "999" });
    },
  );
  await measure(
    "judge-rpc-1000",
    15,
    () => judge(rpcOp, rpcObserved),
    (r) => {
      assert.equal(r.class, "ok");
      assert.equal(r.data.length, 1000);
      assert.equal(r.data[999].name, "user-999");
    },
  );
  await measure(
    "judge-html-200",
    15,
    () => judge(htmlOp, { ...observed, headers: { "content-type": "text/html" }, body: html }),
    (r) => {
      assert.equal(r.class, "ok");
      assert.equal(r.data.length, 200);
    },
  );
  await measure(
    "pick-1000",
    30,
    () => pick(rows, op.response.pick),
    (r) => assert.equal(r[999].name, "user-999"),
  );
  await measure(
    "cap-1000",
    30,
    () => capOutput(rows, 8000),
    (r) => assert.ok(JSON.stringify(r.data).length <= 8000),
  );
  await measure(
    "outline-wide-30000",
    2,
    () => outlineJson(wide, ["absent"]),
    (r) => assert.ok(r),
  );
  await measure(
    "build-request",
    500,
    () => buildRequest(op, { name: "bob" }, { cookies: [], values: {} }),
    (r) => assert.equal(r.url, "http://localhost/api?name=bob&constant=%2f%2F"),
  );
  server = await startFixture();
  saveSite({
    ...site,
    baseUrl: server.url,
    operations: [
      {
        ...op,
        request: { method: "GET", url: `${server.url}/api/spa/user?name=alice`, headers: {} },
        response: { format: "json" },
      },
    ],
  });
  // a home with the spec and nothing else, before any call: what each first call starts from
  const seed = mkdtempSync(join(tmpdir(), "aa-engine-seed-"));
  homes.push(seed);
  cpSync(state, seed, { recursive: true });
  const checkCall = (r) => {
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.tier, 1);
    assert.equal(r.data.name, "bob");
  };
  await measure(
    "call-localhost",
    30,
    () => call("perf", "rows", { name: "bob" }, { maxTier: 1, minIntervalMs: 0 }),
    checkCall,
  );
  bulk = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  await new Promise((accept) => bulk.listen(0, "127.0.0.1", accept));
  const bulkUrl = `http://127.0.0.1:${bulk.address().port}`;
  saveSite({
    ...site,
    name: "bulk",
    baseUrl: bulkUrl,
    operations: [{ ...op, request: { ...op.request, url: `${bulkUrl}/?name=alice` } }],
  });
  await measure(
    "call-localhost-1000",
    15,
    () => call("bulk", "rows", { name: "bob" }, { maxTier: 1, minIntervalMs: 0 }),
    (r) => {
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.tier, 1);
      assert.ok(r.data.length > 0 && r.data.length < 1000);
      assert.equal(r.data[0].name, "user-0");
      assert.ok(r.truncated);
      assert.ok(JSON.stringify(r.data).length <= 20000);
    },
  );
  if (!values.only || values.only === "call-localhost-1000") {
    // a cut answer is kept for get_result; a key store that fails keeps none, and no assertion above sees it
    const r = await call("bulk", "rows", { name: "bob" }, { maxTier: 1, minIntervalMs: 0 });
    retainedFullAnswer = typeof r.resultId === "string";
  }
  await measure(
    "cli-cold-localhost",
    1,
    async () => {
      // Async child keeps the fixture's HTTP server responsive.
      const { execFile } = await import("node:child_process");
      return new Promise((accept, reject) =>
        execFile(
          process.execPath,
          [join(repo, "dist/cli.js"), "call", "perf", "rows", "name=bob", "--max-tier", "1"],
          { env: { ...process.env, API_ANYTHING_HOME: state } },
          (error, stdout) => (error ? reject(error) : accept(JSON.parse(stdout))),
        ),
      );
    },
    checkCall,
  );
  // The workload above runs every process on one home, so each waits out the site's pacing slot that the
  // one before it took (about a second). A first call has no slot to wait for: each gets a home of its own,
  // copied before the clock starts from the seed, which no call has used.
  if (!values.only || values.only === "cli-cold-first-call")
    for (let i = 0; i < samples + 6; i++) {
      const fresh = mkdtempSync(join(tmpdir(), "aa-engine-first-"));
      cpSync(seed, fresh, { recursive: true });
      homes.push(fresh);
    }
  let nextHome = 1;
  await measure(
    "cli-cold-first-call",
    1,
    async () => {
      const { execFile } = await import("node:child_process");
      const fresh = homes[nextHome++];
      return new Promise((accept, reject) =>
        execFile(
          process.execPath,
          [join(repo, "dist/cli.js"), "call", "perf", "rows", "name=bob", "--max-tier", "1"],
          { env: { ...process.env, API_ANYTHING_HOME: fresh } },
          (error, stdout) => (error ? reject(error) : accept(JSON.parse(stdout))),
        ),
      );
    },
    checkCall,
  );
  assert.ok(summary.length, "no workload matched --only");
  console.log(
    JSON.stringify(
      {
        repo,
        revision: values.revision ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(),
        node: process.version,
        sourceSha256: sourceHash.digest("hex"),
        bodyBytes: Buffer.byteLength(body),
        ...(retainedFullAnswer !== undefined ? { retainedFullAnswer } : {}),
        results: summary,
      },
      null,
      2,
    ),
  );
} finally {
  await server?.close();
  if (bulk) await new Promise((accept, reject) => bulk.close((error) => (error ? reject(error) : accept())));
  rmSync(state, { recursive: true, force: true });
  for (const h of homes) rmSync(h, { recursive: true, force: true });
}
