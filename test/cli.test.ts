/**
 * The CLI as an agent meets it, against the offline fixture site: which flags and names a command
 * takes, and what it says when the page, the recipe or the examples are not ones it can work with.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromeAvailable } from "../src/browser.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-cli-"));
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "src", "cli.ts");

function cli(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  // async on purpose: the fixture server lives in this process and must keep answering
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", CLI, ...args],
      { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
      (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
    ),
  );
}

let fx: Fixture;
before(async () => (fx = await startFixture()));
after(async () => {
  await fx.close();
  rmSync(HOME, { recursive: true, force: true });
});

describe("flags and command names", () => {
  before(() => {
    // a read that needs no session: GET /api/spa/user?name=<name>
    mkdirSync(join(HOME, "sites"), { recursive: true });
    writeFileSync(
      join(HOME, "sites", "plain.json"),
      JSON.stringify({
        name: "plain",
        baseUrl: fx.url,
        operations: [
          {
            name: "getUser",
            readOnly: true,
            trigger: { url: `${fx.url}/spa/{name}` },
            match: { method: "GET", path: "/api/spa/user" },
            request: { method: "GET", url: `${fx.url}/api/spa/user?name=alice`, headers: {} },
            slots: [{ param: "name", at: ["query:name"] }],
            params: [{ name: "name", example: "alice" }],
          },
        ],
      }),
    );
  });

  test("a flag the command does not take is refused, naming the command and its --help", async () => {
    const r = await cli("call", "plain", "getUser", "name=carol", "--pick", "name", "--limit", "1");
    assert.equal(r.code, 1, r.stdout);
    assert.deepEqual(JSON.parse(r.stdout), { ok: false, error: "call does not take --pick, --limit" });
    assert.match(r.stderr, /^next: api-anything call --help/m);

    // --steps belongs to capture and add: elsewhere it is not even parsed
    const steps = await cli("call", "plain", "getUser", "name=carol", "--steps", "not json");
    assert.equal(JSON.parse(steps.stdout).error, "call does not take --steps");

    const own = await cli("call", "plain", "getUser", "name=carol", "--max-tier", "1");
    assert.deepEqual(JSON.parse(own.stdout).data, { name: "carol" }, own.stdout);
    assert.equal((await cli("call", "--limit", "1", "--help")).code, 0, "--help still answers");
  });

  test("a name every object inherits is an unknown command like any other", async () => {
    const usage = (await cli("--help")).stdout;
    for (const name of ["toString", "constructor"]) {
      const r = await cli(name);
      assert.deepEqual(
        r,
        { code: 1, stdout: usage, stderr: `next: unknown command "${name}"; see the list above\n` },
        name,
      );
      assert.equal((await cli(name, "--help")).stdout, usage, `${name} --help`);
    }
  });

  test("a step --steps cannot run is one short line: the action, and the actions there are", async () => {
    const step = (action: string) => JSON.stringify([{ action, selector: "#file", value: "file.pdf" }]);
    const upload = await cli("capture", `${fx.url}/list`, "--steps", step("upload"));
    assert.equal(upload.code, 1);
    assert.deepEqual(JSON.parse(upload.stdout), {
      ok: false,
      error:
        '--steps: unknown action "upload" (file uploads are not supported); the actions are click, fill, press, wait, goto',
    });
    assert.match(upload.stderr, /^next: api-anything capture --help/m);

    const hover = await cli("add", "plain", "x", "--trigger", `${fx.url}/list`, "--steps", step("hover"));
    assert.equal(
      JSON.parse(hover.stdout).error,
      '--steps: unknown action "hover"; the actions are click, fill, press, wait, goto',
    );

    // any other malformed step: what is wrong and where, not the validator's JSON report
    const typed = await cli("capture", `${fx.url}/list`, "--steps", '[{"action":"click","selector":5}]');
    assert.equal(
      JSON.parse(typed.stdout).error,
      "--steps: Invalid input: expected string, received number at [0].selector",
    );
  });
});

describe("capture's next hint", { skip: !chromeAvailable() && "Google Chrome not installed" }, () => {
  const next = async (path: string, ...flags: string[]) =>
    JSON.parse((await cli("capture", `${fx.url}${path}`, ...flags)).stdout).next as string;

  test("a sign-in page or an HTTP error is not offered as something to learn from", async () => {
    const signIn = /^the page is a sign-in page.* ask the user to run api-anything login <site>, then capture again$/;
    assert.match(await next("/private"), signIn, "the wall served in place, as 200 HTML");
    assert.match(await next("/account"), signIn, "the wall served by redirect");
    assert.match(await next("/no/such/page"), /^the page answered HTTP 404.* check the URL/);
  });

  test("a login box above public content does not make the page a sign-in page", async () => {
    assert.match(await next("/forum", "--example", "name=alice"), /^the best candidate is the HTML page/);
    assert.match(await next("/forum/alice", "--example", "name=alice"), /^api-anything add <site> <op> --from/);
  });
});
