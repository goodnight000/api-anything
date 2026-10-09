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

describe("inspect", () => {
  // A capture as `capture` saves one: the fixture's list page, a user's JSON, and a user with no posts.
  before(async () => {
    const answer = (id: number, resourceType: string, contentType: string, body: string) => ({
      id,
      resourceType,
      request: { method: "GET", url: `${fx.url}/`, headers: {} },
      response: { status: 200, headers: {}, contentType, body },
    });
    const user = (name: string, posts: string[]) =>
      JSON.stringify({ data: { user: { name, followers: 500, posts: posts.map((text) => ({ text })) } } });
    mkdirSync(join(HOME, "captures"), { recursive: true });
    writeFileSync(
      join(HOME, "captures", "csaved.json"),
      JSON.stringify({
        id: "csaved",
        at: new Date().toISOString(),
        url: `${fx.url}/`,
        finalUrl: `${fx.url}/`,
        cookies: [],
        exchanges: [
          answer(1, "document", "text/html; charset=utf-8", await (await fetch(`${fx.url}/list`)).text()),
          answer(2, "fetch", "application/json", user("alice", ["hello from alice"])),
          answer(3, "fetch", "application/json", user("dora", [])),
        ],
      }),
    );
  });
  const inspect = async (request: number, ...flags: string[]) => {
    const r = await cli("inspect", "csaved", String(request), ...flags);
    return { ...r, out: JSON.parse(r.stdout) };
  };

  test("it takes add's recipe flags: --extract (or --path) and --pick, after --html too", async () => {
    assert.deepEqual((await inspect(2, "--extract", "data.user", "--pick", "name")).out.data, { name: "alice" });
    assert.equal((await inspect(2, "--path", "data.user.posts[0].text")).out.data, "hello from alice");
    const recipe = '{"items":"li.user","fields":{"name":"a.name","followers":"span.followers"}}';
    assert.deepEqual((await inspect(1, "--html", recipe, "--pick", "name")).out.data, [
      { name: "alice" },
      { name: "bob" },
      { name: "carol" },
    ]);
  });

  test("a path or selector that finds nothing fails and says so; an empty list at a path is a result", async () => {
    const next = /^next: api-anything inspect csaved \d --outline/m;
    const path = await inspect(2, "--path", "data.wrong");
    assert.equal(path.code, 1);
    assert.deepEqual(path.out, { ok: false, error: 'nothing at "data.wrong" in request 2\'s response' });
    assert.match(path.stderr, next);

    const selector = await inspect(1, "--html", '{"items":"li.nope","fields":{"name":"a"}}');
    assert.equal(selector.code, 1);
    assert.match(selector.out.error, /^the --html items selector "li\.nope" matched nothing in request 1/);
    assert.match(selector.stderr, next);

    const regex = await inspect(1, "--embedded", "window\\.state = (\\{)");
    assert.equal(regex.code, 1);
    assert.match(regex.out.error, /^the --embedded regex found no JSON in request 1/);

    // the page is not JSON: a path into it finds nothing, rather than printing the page
    assert.equal((await inspect(1, "--extract", "data.user")).code, 1);

    const empty = await inspect(3, "--extract", "data.user.posts");
    assert.equal(empty.code, 0, empty.stdout);
    assert.deepEqual(empty.out.data, []);
  });
});

const noChrome = !chromeAvailable() && "Google Chrome not installed";

describe("add from a saved capture", { skip: noChrome }, () => {
  // Captures of /u/alice and /u/bob, each with the id of the request for the user's data.
  const saved: Record<string, { capture: string; request: string }> = {};
  before(async () => {
    for (const name of ["alice", "bob"]) {
      const out = JSON.parse((await cli("capture", `${fx.url}/u/${name}`, "--example", `name=${name}`)).stdout);
      saved[name] = { capture: out.capture, request: String(out.candidates[0].id) };
    }
  });
  /** add fixture <op> from the capture of that user's page; `flags` are split on spaces. */
  const add = async (op: string, from: string, flags: string) => {
    const { capture, request } = saved[from]!;
    const r = await cli("add", "fixture", op, "--from", capture, "--pick-request", request, ...flags.split(" "));
    return { ...r, out: JSON.parse(r.stdout) };
  };

  test("--example2 with --from and no --from2 is refused, and the way it says to go works", async () => {
    const r = await add("twice", "alice", "--example name=alice --example2 name=bob");
    assert.equal(r.code, 1, r.stdout);
    assert.deepEqual(r.out, { ok: false, error: "--example2 with --from needs --from2: a capture holds one run" });
    assert.match(r.stderr, /^next: capture the page again .*api-anything capture .* --example name=bob.* --from2 /m);
    assert.equal((await cli("ops", "fixture")).code, 1, "nothing was saved");

    const both = await add("twice", "alice", `--example name=alice --from2 ${saved.bob!.capture} --example2 name=bob`);
    assert.equal(both.code, 0, both.stdout);
    assert.deepEqual(both.out.warnings, [], "the two captures were diffed: no 'learned from one example'");
  });

  test("repairing a recipe from a capture keeps the op's params: its stored examples stand in", async () => {
    const wrong = await add("getUser", "alice", "--example name=alice --extract data.wrong");
    assert.deepEqual(wrong.out.params, ["name:string"]);
    assert.match(wrong.out.warnings.join("\n"), /Fix --extract.* and re-run add --from/);

    // that advice, followed to the letter: no --example this time
    const fixed = await add("getUser", "alice", "--extract data.user --pick name");
    assert.equal(fixed.code, 0, fixed.stdout);
    assert.deepEqual(fixed.out.params, ["name:string"]);
    assert.match(
      fixed.out.warnings.join("\n"),
      /no example was given, so getUser's stored one \(name=alice\) stands in/,
    );
    const carol = JSON.parse((await cli("call", "fixture", "getUser", "name=carol")).stdout);
    assert.deepEqual(carol.data, { name: "carol" }, JSON.stringify(carol));

    // an --example still wins, and is the stored one from then on
    const bob = await add("getUser", "bob", "--example name=bob --extract data.user --pick name");
    assert.deepEqual(bob.out.preview, { first: { name: "bob" } });
    assert.doesNotMatch(bob.out.warnings.join("\n"), /stored/);
    // a capture made with other values than the stored ones: the failure says which were tried
    const other = await add("getUser", "alice", "--extract data.user");
    assert.equal(other.code, 1, other.stdout);
    assert.match(
      other.out.error,
      /no example was given, so getUser's stored one \(name=bob\) stands in: pass --example/,
    );
  });
});

describe("capture's next hint", { skip: noChrome }, () => {
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
