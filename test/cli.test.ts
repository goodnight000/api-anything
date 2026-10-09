/**
 * The CLI as an agent meets it, against the offline fixture site: which flags and names a command
 * takes, and what it says when the page, the recipe or the examples are not ones it can work with.
 */
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromeAvailable } from "../src/browser.js";
import { type Fixture, PUBLIC_BEARER, startFixture } from "./fixture/server.js";

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

/* A capture file as `capture` saves one, made without a browser: what is done with a saved capture needs none. */

const CSRF = "seeded-csrf-token-0123456789";
const JAR = [{ name: "ct0", value: CSRF, domain: "127.0.0.1", path: "/", expires: -1, httpOnly: false, secure: false }];

function seed(id: string, capture: { url: string; exchanges: unknown[]; [k: string]: unknown }): void {
  mkdirSync(join(HOME, "captures"), { recursive: true });
  const file = { id, at: new Date().toISOString(), finalUrl: capture.url, cookies: JAR, ...capture };
  writeFileSync(join(HOME, "captures", `${id}.json`), JSON.stringify(file));
}

/** One request as the fixture's pages send it, and the fixture's answer to it. */
async function answered(id: number, resourceType: string, path: string) {
  const headers: Record<string, string> =
    resourceType === "document"
      ? {}
      : { "x-csrf-token": CSRF, authorization: PUBLIC_BEARER, cookie: `ct0=${CSRF}`, referer: `${fx.url}/` };
  const res = await fetch(`${fx.url}${path}`, { headers });
  return {
    id,
    resourceType,
    request: { method: "GET", url: `${fx.url}${path}`, headers },
    response: {
      status: res.status,
      headers: {},
      contentType: res.headers.get("content-type") ?? "",
      body: await res.text(),
    },
  };
}

/** The argv a shell hands the `api-anything ...` command a hint spells out. */
function shellArgv(hint: string): string[] {
  const command = /api-anything (\S.*); then /.exec(hint)?.[1];
  assert.ok(command, `no command in: ${hint}`);
  const print = "console.log(JSON.stringify(process.argv.slice(1)))";
  return JSON.parse(execFileSync("sh", ["-c", `"$0" -e '${print}' -- ${command}`, process.execPath]).toString());
}

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

describe("add from a saved capture", () => {
  // Captures of /u/alice and /u/bob: request 1 is the page, 2 the user's JSON.
  before(async () => {
    for (const name of ["alice", "bob"]) {
      const variables = encodeURIComponent(JSON.stringify({ name, withExtras: true }));
      seed(`c${name}`, {
        url: `${fx.url}/u/${name}`,
        exchanges: [
          await answered(1, "document", `/u/${name}`),
          await answered(2, "fetch", `/api/graphql/${fx.state.userQueryId}/UserByName?variables=${variables}`),
        ],
      });
    }
  });
  /** add fixture <op> from the capture of that user's page; `flags` are split on spaces. */
  const add = async (op: string, from: string, flags: string) => {
    const r = await cli("add", "fixture", op, "--from", `c${from}`, "--pick-request", "2", ...flags.split(" "));
    return { ...r, out: JSON.parse(r.stdout) };
  };

  test("--example2 with --from and no --from2 is refused, and the way it says to go works", async () => {
    const r = await add("twice", "alice", "--example name=alice --example2 name=bob");
    assert.equal(r.code, 1, r.stdout);
    assert.match(r.out.error, /--example2 .*--from2/);
    assert.deepEqual(shellArgv(r.stderr), ["capture", `${fx.url}/u/bob`, "--example", "name=bob"]);
    assert.match(r.stderr, /--from2/);
    assert.equal((await cli("ops", "fixture")).code, 1, "nothing was saved");

    const both = await add("twice", "alice", "--example name=alice --from2 cbob --example2 name=bob");
    assert.equal(both.code, 0, both.stdout);
    assert.deepEqual(both.out.warnings, [], "the two captures were diffed: no 'learned from one example'");
  });

  test("the capture that refusal asks for repeats how the first was made: --write, steps, quoting", async () => {
    const refused = async (capture: string, ...flags: string[]) => {
      const r = await cli("add", "demo", "send", "--from", capture, ...flags);
      assert.equal(r.code, 1, r.stdout);
      return r.stderr;
    };
    // a write captured with --write: type the text, click Post
    const steps = (text: string) => [
      { action: "fill", selector: "#text", value: text },
      { action: "click", selector: "#post" },
    ];
    seed("cwrite", { url: `${fx.url}/compose`, write: true, steps: steps("hello alice"), exchanges: [] });
    assert.deepEqual(
      shellArgv(await refused("cwrite", "--write", "--example", "text=hello alice", "--example2", "text=hello bob")),
      [
        "capture",
        `${fx.url}/compose`,
        "--steps",
        JSON.stringify(steps("hello bob")),
        "--write",
        "--example",
        "text=hello bob",
      ],
    );

    // the value in the URL, a soft navigation, and a quote for the shell to trip on
    seed("csoft", { url: `${fx.url}/spa/alice?tab=posts`, softFrom: `${fx.url}/spa/home`, exchanges: [] });
    assert.deepEqual(shellArgv(await refused("csoft", "--example", "name=alice", "--example2", "name=bob o'neil")), [
      "capture",
      `${fx.url}/spa/bob%20o'neil?tab=posts`,
      "--soft-from",
      `${fx.url}/spa/home`,
      "--example",
      "name=bob o'neil",
    ]);

    // the first example is nowhere in the capture's url or steps: no command, rather than a wrong one
    seed("cfeed", { url: `${fx.url}/feed`, write: true, exchanges: [] });
    const words = await refused("cfeed", "--example", "name=alice", "--example2", "name=bob");
    assert.doesNotMatch(words, /api-anything capture/);
    assert.match(words, /--write/);
    assert.match(words, /--from2/);
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

const noChrome = !chromeAvailable() && "Google Chrome not installed";

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
