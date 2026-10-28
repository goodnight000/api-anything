/**
 * learn_site end to end against the offline fixture, in a temp API_ANYTHING_HOME: the automatic pick,
 * the user's data, the published examples, the holdout check, the clean replay, sharing's evidence,
 * the consent asked through MCP elicitation, and writes refused.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { browserAvailable, closeBrowser } from "../src/browser.js";
import { loadCapture } from "../src/heal.js";
import { saveSettings } from "../src/identity.js";
import { hooks, type LearnSiteResult, learnSite } from "../src/learnsite.js";
import { createServer } from "../src/mcp.js";
import { learnTool } from "../src/mcp-learn.js";
import { HOLDOUT_PURPOSE, type shareOps } from "../src/share.js";
import { loadSite } from "../src/store.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-learnsite-"));
process.env.API_ANYTHING_HOME = HOME;
const fast = { minIntervalMs: 0 };
const ROOT = fileURLToPath(new URL("..", import.meta.url));

type ShareCall = { site: string; ops: string[]; o: NonNullable<Parameters<typeof shareOps>[2]> };
/** A stand-in for the registry client's shareOps: records each call, answers what `answer` says. */
function stubShare(answer: (c: ShareCall) => Awaited<ReturnType<typeof shareOps>>[number]): ShareCall[] {
  const calls: ShareCall[] = [];
  hooks.share = async (site, ops, o = { evidence: {} }) => {
    const c = { site, ops, o };
    calls.push(c);
    return [answer(c)];
  };
  return calls;
}

const opOf = (site: string, op: string) => loadSite(site)!.site.operations.find((o) => o.name === op)!;

test("learn_site refuses a write before anything runs", async () => {
  const r = await learnSite({
    trigger: "http://127.0.0.1:1/compose",
    args: { text: "hello" },
    args2: { text: "there" },
    args3: { text: "again" },
    write: true,
  });
  assert.deepEqual([r.ok, r.class], [false, "refused"]);
  assert.match(r.next ?? "", /add .*--write/);
});

test("learn_site wants args3 to be neither example", async () => {
  const r = await learnSite({
    trigger: "http://127.0.0.1:1/scoped?q={q}",
    args: { q: "alice" },
    args2: { q: "bobby" },
    args3: { q: "bobby" },
  });
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /args3 must differ/);
});

describe("learn_site", { skip: !browserAvailable() && "no Chromium browser installed" }, () => {
  let fx: Fixture;
  let scoped: LearnSiteResult;
  let shares: ShareCall[];
  before(async () => {
    // the fixture is on localhost, which MCP learn_site refuses to load anywhere else
    learnTool.publicOnly = false;
    // the user answered setup's question: only an op's own consent is asked here
    saveSettings({ share: true, askedAt: "2026-10-25T00:00:00.000Z" });
    fx = await startFixture();
    shares = stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: true, status: "candidate", hash: "h1" }));
    scoped = await learnSite(
      {
        site: "fx",
        op: "searchScoped",
        trigger: `${fx.url}/scoped?q={q}`,
        args: { q: "alice" },
        args2: { q: "bobby" },
        args3: { q: "carol" },
        intent: "search the scoped results",
      },
      fast,
    );
  });
  after(async () => {
    learnTool.publicOnly = true;
    await closeBrowser();
    await fx.close();
    rmSync(HOME, { recursive: true, force: true });
  });

  test("picks the request and the recipe from run 1's outline, and answers the user's own request", () => {
    assert.equal(scoped.ok, true, JSON.stringify(scoped));
    assert.equal(scoped.chosen?.auto, true);
    assert.match(scoped.chosen!.url, /\/api\/scoped\?q=alice/);
    assert.deepEqual(scoped.chosen!.recipe, { extract: "data.results" });
    assert.deepEqual(scoped.data, ["alice one", "alice two"]);
    assert.equal(scoped.signature, "searchScoped(q)");
    assert.ok(Array.isArray(scoped.alternatives));
  });

  test("stores args2 as the example, never the user's args, and the holdout as a check", () => {
    const op = opOf("fx", "searchScoped");
    assert.deepEqual(
      op.params.map((p) => [p.name, p.example]),
      [["q", "bobby"]],
    );
    assert.deepEqual(op.checks, [{ args: { q: "carol" }, expect: "result", purpose: HOLDOUT_PURPOSE }]);
    assert.equal(op.description, "search the scoped results");
    assert.match(op.request.url, /q=bobby/);
    assert.ok(!JSON.stringify(op).includes("alice"), "the spec does not say what the user asked");
    assert.deepEqual(scoped.proof?.holdout, { args: { q: "carol" }, ok: true, class: "ok", tier: 1 });
  });

  test("a public endpoint replays clean, and shareOps gets the evidence", () => {
    assert.equal(scoped.proof?.cleanReplay, "ok");
    assert.equal(shares.length, 1);
    assert.deepEqual([shares[0]!.site, shares[0]!.ops], ["fx", ["searchScoped"]]);
    assert.deepEqual(shares[0]!.o.evidence, {
      clientVersion: shares[0]!.o.evidence.clientVersion,
      learnedLoggedIn: false,
      cleanReplay: "ok",
      holdout: { args: { q: "carol" }, ok: true, tier: 1 },
      tier: 1,
    });
    assert.match(String(shares[0]!.o.evidence.clientVersion), /^\d+\.\d+\.\d+/);
    assert.equal(shares[0]!.o.consent, undefined);
    assert.deepEqual(scoped.shared, { site: "fx", op: "searchScoped", shared: true, status: "candidate", hash: "h1" });
  });

  test("an endpoint that needs the page's cookie fails the clean replay", async () => {
    const calls = stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: false, reason: "not public" }));
    const r = await learnSite(
      {
        site: "fx",
        op: "getUser",
        trigger: `${fx.url}/u/{name}`,
        args: { name: "alice" },
        args2: { name: "bobby" },
        args3: { name: "carol" },
        extract: "data.user",
        pick: ["name", "followers"],
      },
      fast,
    );
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.chosen?.auto, false);
    assert.deepEqual(r.data, { name: "alice", followers: 500 });
    assert.equal(r.proof?.cleanReplay, "failed");
    assert.equal(calls[0]!.o.evidence.cleanReplay, "failed");
  });

  test("the request URLs shown carry the run's live cookie as its ref, never its value", async () => {
    stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: false, reason: "not public" }));
    const r = await learnSite(
      {
        site: "fx",
        op: "findBoxed",
        trigger: `${fx.url}/signin-box?q={q}`,
        args: { q: "alice" },
        args2: { q: "bobby" },
        args3: { q: "carol" },
      },
      fast,
    );
    const urls = [r.chosen, ...(r.alternatives ?? [])].map((c) => c?.url ?? "");
    assert.match(r.chosen?.url ?? "", /\/api\/scoped\?q=alice&access_token=\[cookie:ct0\]$/, JSON.stringify(r));
    assert.ok(
      urls.every((u) => !/access_token=[0-9a-f]{32}/.test(u)),
      urls.join("\n"),
    );
  });

  test("a server-rendered list is picked as an html recipe; with no site or op, the host's site and the path name them", async () => {
    stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: true }));
    const r = await learnSite(
      { trigger: `${fx.url}/shelf?q={q}`, args: { q: "dune" }, args2: { q: "emma" }, args3: { q: "ulysses" } },
      fast,
    );
    assert.equal(r.ok, true, JSON.stringify(r));
    // the known site on that host, as login <url> resolves one
    assert.deepEqual([r.site, r.op], ["fx", "shelf"]);
    assert.equal(r.chosen?.type, "text/html");
    assert.equal(r.chosen?.recipe.html?.items, "li.result");
    assert.equal((r.data as { title: string }[]).length, 3);
    assert.match(JSON.stringify(r.data), /dune volume 1/);
    assert.equal(r.proof?.cleanReplay, "ok");
  });

  test("a page whose data comes from a POST that is no GraphQL query is refused before the op is saved or sent", async () => {
    const calls = stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: true }));
    const input = {
      site: "fx",
      op: "rpcSearch",
      trigger: `${fx.url}/search?q={q}`,
      args: { q: "alice" },
      args2: { q: "bobby" },
      args3: { q: "carol" },
    };
    const saved = () => loadSite("fx")?.site.operations.some((o) => o.name === "rpcSearch");
    // automatic: the only request with the data is the POST, so nothing is learned
    const auto = await learnSite(input, fast);
    assert.equal(auto.ok, false, JSON.stringify(auto));
    assert.equal(saved(), false);
    // picked: refused as no read
    const rpc = loadCapture(auto.captures![0]!).exchanges.find((e) => e.request.url.includes("/api/rpc"))!;
    const r = await learnSite(
      { ...input, captures: auto.captures as [string, string], pickRequest: rpc.id, extract: "0" },
      fast,
    );
    assert.deepEqual([r.ok, r.class], [false, "refused"], JSON.stringify(r));
    assert.match(r.error ?? "", /a POST that is not a GraphQL query may change something/);
    assert.equal(saved(), false);
    assert.equal(calls.length, 0, "nothing shared");
    assert.equal(r.proof, undefined, "no holdout call and no clean replay");
  });

  test("a login op is shared on a yes through MCP elicitation, and not on a no", async () => {
    for (const answer of [true, false]) {
      const calls = stubShare((c) =>
        c.o.consent
          ? { site: c.site, op: c.ops[0]!, shared: true, status: "review" }
          : { site: c.site, op: c.ops[0]!, shared: false, needsConsent: true, reason: "learned signed in" },
      );
      const client = new Client({ name: "probe", version: "0" }, { capabilities: { elicitation: {} } });
      const asked: string[] = [];
      client.setRequestHandler(ElicitRequestSchema, async (req) => {
        asked.push(req.params.message);
        return { action: "accept", content: { share: answer } };
      });
      const [a, b] = InMemoryTransport.createLinkedPair();
      await createServer().connect(a);
      await client.connect(b);
      try {
        const r = await client.callTool({
          name: "learn_site",
          arguments: {
            site: "fx",
            op: "searchScoped",
            trigger: `${fx.url}/scoped?q={q}`,
            args: { q: "alice" },
            args2: { q: "bobby" },
            args3: { q: "carol" },
            captures: scoped.captures,
          },
        });
        const out = JSON.parse((r.content as { text: string }[])[0]!.text);
        assert.equal(out.ok, true, JSON.stringify(out));
        assert.equal(asked.length, 1);
        assert.match(asked[0]!, /Share it/);
        assert.equal(calls.length, answer ? 2 : 1);
        assert.equal(out.shared.shared, answer);
        if (answer) assert.equal(calls[1]!.o.consent, true);
      } finally {
        await client.close();
      }
    }
  });

  test("without elicitation, the agent is told to ask the user and how to publish", async () => {
    stubShare((c) => ({ site: c.site, op: c.ops[0]!, shared: false, needsConsent: true, reason: "learned signed in" }));
    const client = new Client({ name: "probe", version: "0" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer().connect(a);
    await client.connect(b);
    try {
      const r = await client.callTool({
        name: "learn_site",
        arguments: {
          site: "fx",
          op: "searchScoped",
          trigger: `${fx.url}/scoped?q={q}`,
          args: { q: "alice" },
          args2: { q: "bobby" },
          args3: { q: "carol" },
          captures: scoped.captures,
        },
      });
      const out = JSON.parse((r.content as { text: string }[])[0]!.text);
      assert.equal(out.ok, true, JSON.stringify(out));
      assert.match(out.next, /ask the user.*api-anything publish fx searchScoped --yes/);
    } finally {
      await client.close();
    }
  });

  test("CLI learn relearns from an earlier run's captures, with no browser", async () => {
    const r = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
      execFile(
        process.execPath,
        [
          "--import",
          "tsx",
          join(ROOT, "src", "cli.ts"),
          "learn",
          `${fx.url}/scoped?q={q}`,
          "--args",
          "q=alice",
          "--args2",
          "q=bobby",
          "--args3",
          "q=dave",
          "--site",
          "fx",
          "--op",
          "searchCli",
          "--from",
          scoped.captures![0]!,
          "--from2",
          scoped.captures![1]!,
        ],
        { cwd: ROOT, env: { ...process.env, API_ANYTHING_HOME: HOME } },
        (err, stdout, stderr) => resolve({ code: err ? Number(err.code ?? 1) : 0, stdout, stderr }),
      ),
    );
    assert.equal(r.code, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual([out.ok, out.signature, out.data], [true, "searchCli(q)", ["alice one", "alice two"]]);
    assert.equal(out.proof.holdout.ok, true);
  });
});
