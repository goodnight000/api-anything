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
});
