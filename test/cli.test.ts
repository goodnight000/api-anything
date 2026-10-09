/**
 * The CLI as an agent meets it, against the offline fixture site: which flags and names a command
 * takes, and what it says when the page, the recipe or the examples are not ones it can work with.
 */
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromeAvailable } from "../src/browser.js";
import { addOperation } from "../src/heal.js";
import type { TriggerStep } from "../src/types.js";
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

/** One request as the fixture's pages send it, and the fixture's answer to it. `form`: a POST's body. */
async function answered(id: number, resourceType: string, path: string, o: { cookie?: string; form?: string } = {}) {
  const headers: Record<string, string> =
    resourceType === "document"
      ? {}
      : {
          "x-csrf-token": CSRF,
          authorization: PUBLIC_BEARER,
          cookie: [`ct0=${CSRF}`, ...(o.cookie ? [o.cookie] : [])].join("; "),
          referer: `${fx.url}/`,
          ...(o.form ? { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" } : {}),
        };
  const method = o.form ? "POST" : "GET";
  const res = await fetch(`${fx.url}${path}`, { method, headers, body: o.form });
  return {
    id,
    resourceType,
    request: { method, url: `${fx.url}${path}`, headers, ...(o.form ? { body: o.form } : {}) },
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
    assert.match(JSON.parse(r.stdout).error, /^call .*--pick.*--limit/);
    assert.match(r.stderr, /^next: api-anything call --help/m);

    // --steps belongs to capture and add: elsewhere it is not even parsed
    const steps = await cli("call", "plain", "getUser", "name=carol", "--steps", "not json");
    assert.match(JSON.parse(steps.stdout).error, /^call .*--steps/);

    const own = await cli("call", "plain", "getUser", "name=carol", "--max-tier", "1");
    assert.deepEqual(JSON.parse(own.stdout).data, { name: "carol" }, own.stdout);
    assert.equal((await cli("call", "--limit", "1", "--help")).code, 0, "--help still answers");
  });

  test("a name every object inherits is an unknown command like any other", async () => {
    const usage = (await cli("--help")).stdout;
    for (const name of ["toString", "constructor"]) {
      const r = await cli(name);
      assert.equal(r.code, 1, name);
      assert.equal(r.stdout, usage, name);
      assert.match(r.stderr, new RegExp(`^next: unknown command "${name}"`), name);
      assert.equal((await cli(name, "--help")).stdout, usage, `${name} --help`);
    }
  });

  const step = (action: string) => JSON.stringify([{ action, selector: "#file", value: "file.pdf" }]);

  test("a step --steps cannot run is one short line: the action, and the actions there are", async () => {
    const upload = await cli("capture", `${fx.url}/list`, "--steps", step("upload"));
    assert.equal(upload.code, 1);
    const said = JSON.parse(upload.stdout).error;
    assert.match(said, /^--steps: .*"upload"/);
    assert.match(said, /upload.*not supported/);
    for (const action of ["click", "fill", "press", "wait", "goto"]) assert.match(said, new RegExp(`\\b${action}\\b`));
    assert.doesNotMatch(said, /"code"|\n/, "one line, not the validator's report");

    const hover = JSON.parse(
      (await cli("add", "plain", "x", "--trigger", `${fx.url}/list`, "--steps", step("hover"))).stdout,
    ).error;
    assert.match(hover, /"hover".*\bclick\b/);
    assert.doesNotMatch(hover, /upload/);

    // any other malformed step: what is wrong and where, on one line, not the validator's JSON report
    const typed = await cli("capture", `${fx.url}/list`, "--steps", '[{"action":"click","selector":5}]');
    assert.match(JSON.parse(typed.stdout).error, /^--steps: [^{[\n]* \[0\]\.selector$/);
  });

  test("a command's help names the output fields an agent has to act on", async () => {
    const named = { capture: ["blocked", "pageStatus"], add: ["repaired", "replaced"], inspect: ["note"] };
    for (const [command, fields] of Object.entries(named)) {
      const help = (await cli(command, "--help")).stdout;
      for (const field of fields) assert.match(help, new RegExp(`\\b${field}\\b`), `${command} --help: ${field}`);
    }
  });

  test("a malformed JSON flag points at the help of the command it was given to", async () => {
    seed("cflags", { url: `${fx.url}/list`, exchanges: [await answered(1, "document", "/list")] });
    const bad = {
      capture: [`${fx.url}/list`, "--steps", '[{"action":"click","selector":5}]'],
      add: ["plain", "x", "--trigger", `${fx.url}/list`, "--steps", step("hover")],
      call: ["plain", "getUser", "--json", '{"name":'],
      inspect: ["cflags", "1", "--html", '{"items":1}'],
    };
    for (const [command, args] of Object.entries(bad)) {
      const r = await cli(command, ...args);
      assert.equal(r.code, 1, command);
      assert.match(r.stderr, new RegExp(`^next: api-anything ${command} --help`), command);
    }
    assert.match(
      (await cli("add", "plain", "x", "--from", "c", "--match", "{")).stderr,
      /^next: api-anything add --help/,
    );
  });
});

describe("inspect", () => {
  // 1: the list page; 2: a user's JSON; 3: a user with no posts; 4: the list searched for nobody.
  before(async () => {
    const user = (id: number, name: string, posts: string[]) => ({
      id,
      resourceType: "fetch",
      request: { method: "GET", url: `${fx.url}/`, headers: {} },
      response: {
        status: 200,
        headers: {},
        contentType: "application/json",
        body: JSON.stringify({ data: { user: { name, followers: 500, posts: posts.map((text) => ({ text })) } } }),
      },
    });
    seed("csaved", {
      url: `${fx.url}/list`,
      exchanges: [
        await answered(1, "document", "/list"),
        user(2, "alice", ["hello from alice"]),
        user(3, "dora", []),
        await answered(4, "document", "/list?q=nobody"),
      ],
    });
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
    const next = /^next: api-anything inspect csaved \d/m;
    const path = await inspect(2, "--path", "data.wrong");
    assert.equal(path.code, 1);
    assert.equal(path.out.ok, false);
    assert.match(path.out.error, /data\.wrong/);
    assert.match(path.stderr, next);

    const selector = await inspect(1, "--html", '{"items":"li.nope","fields":{"name":"a"}}');
    assert.equal(selector.code, 1);
    assert.match(selector.out.error, /--html.*li\.nope/);
    assert.match(selector.stderr, next);

    const regex = await inspect(1, "--embedded", "window\\.state = (\\{)");
    assert.equal(regex.code, 1);
    assert.match(regex.out.error, /--embedded/);

    // the page is not JSON: a path into it finds nothing, rather than printing the page
    assert.equal((await inspect(1, "--extract", "data.user")).code, 1);

    const empty = await inspect(3, "--extract", "data.user.posts");
    assert.equal(empty.code, 0, empty.stdout);
    assert.deepEqual(empty.out.data, []);
  });

  test("an --html recipe on a page with no results answers [] when the items' container is there, empty", async () => {
    const zero = await inspect(4, "--html", '{"items":"ul.users li.user","fields":{"name":"a.name"}}');
    assert.equal(zero.code, 0, zero.stdout);
    assert.deepEqual(zero.out.data, []);
    assert.match(zero.out.note, /ul\.users.*empty/);
    // the same page, a selector with no container to find: nothing tells no results from a wrong selector
    assert.equal((await inspect(4, "--html", '{"items":"li.user","fields":{"name":"a.name"}}')).code, 1);
  });
});

describe("add from a saved capture", () => {
  /** The steps that post a text on /compose. */
  const steps = (text: string): TriggerStep[] => [
    { action: "fill", selector: "#text", value: text },
    { action: "click", selector: "#post" },
  ];
  const post = () => `/api/graphql/${fx.state.createQueryId}/CreatePost`;
  const posts = () => fx.calls.filter((c) => c.path === post()).length;

  before(async () => {
    // calice, cbob: /u/<name>. Request 1 is the page, 2 the user's JSON.
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
    // cpost: /compose captured with --write. Request 2 is the POST the guard aborted, so it has no
    // answer; 3 is a search the page also POSTed, which went through and was answered.
    const search = JSON.stringify([[["search", JSON.stringify(["kittens", 10]), null, "generic"]]]);
    seed("cpost", {
      url: `${fx.url}/compose`,
      write: true,
      steps: steps("hello alice"),
      exchanges: [
        await answered(1, "document", "/compose"),
        {
          id: 2,
          resourceType: "fetch",
          request: {
            method: "POST",
            url: `${fx.url}${post()}`,
            headers: { "x-csrf-token": CSRF, authorization: PUBLIC_BEARER, "content-type": "application/json" },
            body: JSON.stringify({ variables: { text: "hello alice" }, queryId: fx.state.createQueryId }),
          },
          aborted: true,
        },
        await answered(3, "xhr", "/api/rpc?rpcids=search", { form: `f.req=${encodeURIComponent(search)}` }),
      ],
    });
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
    assert.doesNotMatch(both.out.warnings.join("\n"), /one example/, "the two captures were diffed");
  });

  test("the capture that refusal asks for repeats how the first was made: --write, steps, quoting", async () => {
    const refused = async (capture: string, ...flags: string[]) => {
      const r = await cli("add", "demo", "send", "--from", capture, ...flags);
      assert.equal(r.code, 1, r.stdout);
      return r.stderr;
    };
    // a write captured with --write: type the text, click Post
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

  const carol = async (op: string) => JSON.parse((await cli("call", "fixture", op, "name=carol")).stdout).data;

  test("a recipe repair (add --from with recipe flags only) replaces the recipe and says so", async () => {
    const wrong = await add("getUser", "alice", "--example name=alice --extract data.wrong");
    assert.deepEqual(wrong.out.params, ["name:string"]);
    assert.match(wrong.out.warnings.join("\n"), /add --from calice/);

    // that advice, followed: no example, and the op's own match finds the request in the capture
    const r = await cli("add", "fixture", "getUser", "--from", "calice", "--extract", "data.user", "--pick", "name");
    const fixed = JSON.parse(r.stdout);
    assert.equal(r.code, 0, r.stdout);
    assert.match(fixed.repaired, /request/, "the output says the request was kept");
    assert.deepEqual(fixed.params, ["name:string"]);
    assert.deepEqual(fixed.preview, { first: { name: "alice" } });
    assert.deepEqual(await carol("getUser"), { name: "carol" });

    // the new recipe is judged on the captured answer, as add judges one
    const still = await add("getUser", "alice", "--extract data.nope");
    assert.equal(still.out.preview, undefined);
    assert.match(still.out.warnings.join("\n"), /data\.nope.*add --from calice/);

    // a flag that shapes the request makes it a re-learn, which needs the example: nothing is saved
    const relearn = await add("getUser", "alice", "--match path=/api/graphql/*/UserByName --extract data.user");
    assert.equal(relearn.code, 1, relearn.stdout);
    assert.match(relearn.out.error, /--example/);
    const ops = JSON.parse((await cli("ops", "fixture")).stdout).operations;
    assert.equal(ops.find((o: { name: string }) => o.name === "getUser").params.length, 1, "nothing was saved");

    // --pick-request names the answer to read; when it is not the op's request, the output says so
    const page = await cli("add", "fixture", "getUser", "--from", "calice", "--pick-request", "1");
    assert.match(JSON.parse(page.stdout).warnings.join("\n"), /request 1 .*match/);
  });

  test("a repair from a capture made with other values binds no param anew", async () => {
    await add("viewed", "alice", "--example name=alice --extract data.user --pick name");
    // bob's page, where the stored example (alice) is the viewer in the same request
    const variables = encodeURIComponent(JSON.stringify({ name: "bob", withExtras: true }));
    seed("cviewer", {
      url: `${fx.url}/u/bob`,
      exchanges: [
        await answered(1, "document", "/u/bob"),
        await answered(
          2,
          "fetch",
          `/api/graphql/${fx.state.userQueryId}/UserByName?variables=${variables}&viewer=alice`,
        ),
      ],
    });
    const repaired = await add("viewed", "viewer", "--extract data.user --pick name,followers");
    assert.deepEqual(repaired.out.preview, { first: { name: "bob", followers: 300 } });
    assert.deepEqual(await carol("viewed"), { name: "carol", followers: 500 }, "name still fills the user asked for");
  });

  test("--description alone changes the description: the recipe is left as it is", async () => {
    await add("described", "alice", "--example name=alice --extract data.user --pick name");
    const r = await cli("add", "fixture", "described", "--from", "calice", "--description", "A user's name");
    const out = JSON.parse(r.stdout);
    assert.equal(r.code, 0, r.stdout);
    assert.match(out.repaired, /description/);
    assert.doesNotMatch(out.repaired, /returns changed/);
    assert.deepEqual(await carol("described"), { name: "carol" }, "extract and pick are still there");
    const ops = JSON.parse((await cli("ops", "fixture")).stdout).operations;
    assert.equal(ops.find((o: { name: string }) => o.name === "described").description, "A user's name");

    // an empty one clears it, and still leaves the recipe alone
    const cleared = await cli("add", "fixture", "described", "--from", "calice", "--description", "");
    assert.match(JSON.parse(cleared.stdout).repaired, /description/, cleared.stdout);
    assert.deepEqual(await carol("described"), { name: "carol" }, "extract and pick are still there");
    const after = JSON.parse((await cli("ops", "fixture")).stdout).operations;
    assert.equal(after.find((o: { name: string }) => o.name === "described").description, undefined);
  });

  test("a repair keeps a param that has no stored example", async () => {
    await add("bare", "alice", "--example name=alice --extract data.wrong");
    // a shared spec is exported without its example values
    const file = join(HOME, "sites", "fixture.json");
    const spec = JSON.parse(readFileSync(file, "utf8"));
    for (const op of spec.operations) for (const p of op.params) delete p.example;
    writeFileSync(file, JSON.stringify(spec));

    const repaired = await add("bare", "alice", "--extract data.user --pick name");
    assert.deepEqual(repaired.out.params, ["name:string"]);
    assert.deepEqual(await carol("bare"), { name: "carol" });
  });

  test("a repair is scanned for credentials as a full add is: the capture's cookies count, unsaved", async () => {
    // /api/mine keys its answer by the session cookie's value, "guest" without one
    const SESSION = "cookie-value-new-session";
    const mine = async (id: string, session?: string) =>
      seed(id, {
        url: `${fx.url}/mine?name=alice`,
        cookies: session ? [...JAR, { ...JAR[0], name: "session", value: session }] : JAR,
        exchanges: [
          await answered(1, "fetch", "/api/mine?name=alice", session ? { cookie: `session=${session}` } : {}),
        ],
      });
    const add = async (op: string, ...flags: string[]) => {
      const r = await cli("add", "fixture", op, ...flags);
      return { ...r, out: JSON.parse(r.stdout) };
    };
    await mine("cguest");
    const learned = await add("mine", "--from", "cguest", "--pick-request", "1", "--example", "name=alice");
    assert.match(learned.out.extract, /^guest/, learned.stdout);

    // the same request captured signed in: the suggested extract now runs through the cookie's value
    await mine("csigned", SESSION);
    const repair = await add("mine", "--from", "csigned");
    assert.equal(repair.code, 1, repair.stdout);
    assert.match(repair.out.error, /credential/);
    for (const kept of ["sites", "sessions"])
      assert.doesNotMatch(readFileSync(join(HOME, kept, "fixture.json"), "utf8"), new RegExp(SESSION), kept);
    // a full add from that capture refuses for the same reason
    const full = await add("mine2", "--from", "csigned", "--pick-request", "1", "--example", "name=alice");
    assert.equal(full.code, 1, full.stdout);
    assert.match(full.out.error, /credential/);

    // a credential the captured request carries in a header the op has no slot for counts too
    const TOKEN = "NewPrivateSession9876543210";
    const guest = await answered(1, "fetch", "/api/mine?name=alice");
    seed("cheader", {
      url: `${fx.url}/mine?name=alice`,
      exchanges: [
        { ...guest, request: { ...guest.request, headers: { ...guest.request.headers, "x-auth-token": TOKEN } } },
      ],
    });
    const header = await add("mine", "--from", "cheader", "--extract", TOKEN);
    assert.equal(header.code, 1, header.stdout);
    assert.match(header.out.error, /credential/);
    // so does a description that names it, though nothing else changes
    const named = await add("mine", "--from", "cheader", "--description", `the session ${TOKEN}`);
    assert.equal(named.code, 1, named.stdout);
    assert.match(named.out.error, /credential/);
    // and a random-looking value under an ordinary header name that the page also keeps in storage
    const OPAQUE = "Zq7RandomOpaque0192837465abc";
    seed("copaque", {
      url: `${fx.url}/mine?name=alice`,
      storage: { opaque: OPAQUE },
      exchanges: [
        { ...guest, request: { ...guest.request, headers: { ...guest.request.headers, "x-opaque": OPAQUE } } },
      ],
    });
    const opaque = await add("mine", "--from", "copaque", "--extract", OPAQUE);
    assert.equal(opaque.code, 1, opaque.stdout);
    assert.match(opaque.out.error, /credential/);
    for (const secret of [TOKEN, OPAQUE])
      assert.doesNotMatch(readFileSync(join(HOME, "sites", "fixture.json"), "utf8"), new RegExp(secret));
  });

  test("a repair is not refused for the caller's own example, however much it looks like a key", async () => {
    // a public object id passed as the param: random-looking, and under a name that reads like a credential's
    const KEY = "PublicObjectAbc12345";
    seed("cobject", {
      url: `${fx.url}/mine?name=${KEY}`,
      exchanges: [await answered(1, "fetch", `/api/mine?name=${KEY}`)],
    });
    const add = async (...flags: string[]) => {
      const r = await cli("add", "fixture", "object", "--from", "cobject", ...flags);
      return { ...r, out: JSON.parse(r.stdout) };
    };
    const learned = await add("--pick-request", "1", "--example", `name=${KEY}`);
    assert.equal(learned.code, 0, learned.stdout);
    const repaired = await add("--extract", "guest", "--pick", "name");
    assert.equal(repaired.code, 0, repaired.stdout);
    assert.match(repaired.out.repaired, /returns changed/);
  });

  test("a request a --write capture aborted is learned as a write or not at all, whatever its name", async () => {
    const add = async (op: string, request: string, example: string) => {
      const r = await cli("add", "demo", op, "--from", "cpost", "--pick-request", request, "--example", example);
      return { ...r, out: JSON.parse(r.stdout) };
    };
    // no op of that name yet, so nothing but the capture says it is a write
    const fresh = await add("post", "2", "text=hello alice");
    assert.equal(fresh.code, 1, fresh.stdout);
    assert.match(fresh.out.error, /intercepted.*--write/);
    assert.equal((await cli("ops", "demo")).code, 1, "nothing was saved");

    // the method alone says nothing: a POST the same capture let through, and answered, is a read
    const search = await add("search", "3", "q=kittens");
    assert.equal(search.code, 0, search.stdout);
    assert.equal(search.out.readOnly, true);
    assert.equal(posts(), 0, "no POST reached the site");

    // as the second capture of a pair it is refused before anything is replayed against it
    const pair = await cli(
      ...["add", "demo", "search2", "--from", "cpost", "--pick-request", "3", "--example", "q=kittens"],
      ...["--from2", "cpost", "--example2", "q=puppies"],
    );
    assert.equal(pair.code, 1, pair.stdout);
    assert.match(JSON.parse(pair.stdout).error, /made with --write.*needs --write/);
    assert.equal(posts(), 0, "no POST reached the site");
  });

  test("a write stays a write: a repair keeps it one, and learning it again without --write is refused", async () => {
    const send = async (...flags: string[]) => {
      const r = await cli("add", "demo", "send", "--from", "cpost", ...flags);
      return { ...r, out: JSON.parse(r.stdout) };
    };
    const learned = await send("--write", "--example", "text=hello alice");
    assert.equal(learned.out.readOnly, false, learned.stdout);

    const repaired = await send("--extract", "data.create_post");
    assert.equal(repaired.out.readOnly, false, "a repair does not relabel the write as a read");
    // the aborted POST has no answer in the capture, so the new recipe was tried on nothing
    assert.match(repaired.out.warnings.join("\n"), /not checked.*no answer/);
    const refused = JSON.parse((await cli("call", "demo", "send", "text=never asked for")).stdout);
    assert.equal(refused.class, "refused", JSON.stringify(refused));

    // with --example it is learned again, and without --write that would save it as a read
    const relearn = await send("--pick-request", "2", "--example", "text=hello alice");
    assert.equal(relearn.code, 1, relearn.stdout);
    assert.match(relearn.out.error, /--write/);
    assert.match((await cli("ops", "demo")).stdout, /"readOnly":false/);
    // nor under a name that differs only in case, which is no existing op's
    const cased = await cli(
      "add",
      "demo",
      "SEND",
      "--from",
      "cpost",
      "--pick-request",
      "2",
      "--example",
      "text=hello alice",
    );
    assert.equal(cased.code, 1, cased.stdout);
    assert.doesNotMatch((await cli("ops", "demo")).stdout, /"SEND"/);
    // by its trigger too: refused before any browser runs it unintercepted
    process.env.API_ANYTHING_HOME = HOME;
    const again = { site: "demo", op: "send", trigger: { url: `${fx.url}/compose`, steps: steps("{text}") } };
    await assert.rejects(addOperation({ ...again, examples: [{ text: "hello alice" }] }), /--write/);
    assert.equal(posts(), 0, "no POST reached the site");
  });
});

const noChrome = !chromeAvailable() && "Google Chrome not installed";

describe("capture's next hint", { skip: noChrome }, () => {
  const capture = async (path: string, ...flags: string[]) =>
    JSON.parse((await cli("capture", `${fx.url}${path}`, ...flags)).stdout);
  const signInPage = /sign-in page.*api-anything login/;
  const learn = /\badd <site> <op> --from c/;
  const alsoForm = /sign-in form.*api-anything login/;

  test("'sign-in page' takes a login path and a sign-in form on it, asked for or redirected to", async () => {
    for (const path of ["/account", "/signin"]) {
      const { next } = await capture(path);
      assert.match(next, signInPage, path);
      assert.doesNotMatch(next, learn, path);
      assert.match(next, /api-anything inspect c\w+ \d+/, "the stop still says how to look at the page");
    }
    // a public page that merely lives under a login-like path is learned from like any other
    const docs = (await capture("/docs/login", "--example", "name=alice")).next;
    assert.match(docs, learn);
    assert.doesNotMatch(docs, /sign-in/);
  });

  test("example values that no candidate returned, on a page with a sign-in form, are a stronger caveat, not a stop", async () => {
    const { next } = await capture("/private", "--example", "name=alice");
    assert.match(next, learn);
    assert.match(next, /none of the example values.*sign-in form.*check the example values.*api-anything login/);
    assert.doesNotMatch(next, signInPage);
  });

  test("login wording with no sign-in form on the page adds nothing to the recommendation", async () => {
    const { next } = await capture("/notice", "--example", "name=zelda");
    assert.match(next, learn);
    assert.doesNotMatch(next, /sign-in/);
  });

  test("a sign-in form with nothing to say the data is missing is said beside the recommendation", async () => {
    const pages = [
      ["/private"], // a login page served in place, but no example to miss
      ["/card/alice"], // public data in the page's state JSON, under a login box
      ["/catalog"], // a public listing that sits inside the search form
      ["/community"], // a redirect, to a public page with a login box
      ["/forum/alice", "--example", "name=alice"], // the example is in a JSON request's answer, not in the page
    ];
    for (const [path, ...flags] of pages) {
      const { next } = await capture(path!, ...flags);
      assert.doesNotMatch(next, signInPage, path);
      assert.match(next, learn, path);
      assert.match(next, alsoForm, path);
    }
  });

  test("an HTTP error is a dead end only when the erroring page is itself the best candidate", async () => {
    const gone = (await capture("/no/such/page")).next;
    assert.match(gone, /404.*URL/);
    assert.doesNotMatch(gone, learn);
    // a static host's 404 fallback serving the app, which fetches the user's JSON
    const out = await capture("/app/alice", "--example", "name=alice");
    assert.equal(out.candidates[0].kind, "fetch");
    assert.match(out.next, learn);
    assert.doesNotMatch(out.next, /check the URL/);
    assert.equal(out.pageStatus, 404, "the document's status is reported on its own");
  });
});
