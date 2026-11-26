/**
 * The upload funnel, client side: the clean replay `shareOps` runs when nothing on record proved one
 * (an op made with `add`, shared by `publish --yes`), and what the uploader is told of an upload the
 * registry holds for review. The stand-in registry judges each upload with the registry's own review
 * rules; each op's site answers through an injected fetch, so nothing leaves this machine.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { reviewReasons } from "../registry/src/upload.js";
import { recordCases } from "../src/checks.js";
import { resolver } from "../src/http.js";
import { saveSettings } from "../src/identity.js";
import type { VersionUpload } from "../src/registry-api.js";
import { REVIEW_CATEGORIES, reviewCategory } from "../src/review.js";
import { saveSession } from "../src/session.js";
import { shareOps } from "../src/share.js";
import { OperationSchema, parseSite, type Site } from "../src/spec.js";
import { status } from "../src/status.js";
import { coolDown, cooling, loadSite, saveSite } from "../src/store.js";
import { type FakeRegistry, hashOf, startRegistry } from "./fixture/registry.js";

let fake: FakeRegistry;
const realLookup = resolver.lookup;
before(async () => {
  fake = await startRegistry();
  process.env.API_ANYTHING_REGISTRY = fake.url;
  resolver.lookup = async () => [{ address: "93.184.215.14" }];
});
after(() => {
  resolver.lookup = realLookup;
  return fake.close();
});

/** POST /v1/versions as the registry answers it: its own review rules, on a site it holds nothing of. */
const judged = (u: VersionUpload) => {
  const op = OperationSchema.parse(u.operation);
  const reasons = reviewReasons(u.site, op, u.evidence);
  return {
    status: 201,
    body: {
      hash: hashOf(u.site.name, op),
      status: reasons.length ? ("review" as const) : ("candidate" as const),
      duplicate: false,
      ...(reasons.length ? { reasons } : {}),
    },
  };
};

beforeEach(() => {
  process.env.API_ANYTHING_HOME = mkdtempSync(join(tmpdir(), "aa-funnel-"));
  delete process.env.API_ANYTHING_LOCAL_ONLY;
  fake.onUpload = judged;
  fake.received.length = 0;
  fake.down = false;
});

const shareOn = (share = true) =>
  saveSettings({
    share,
    askedAt: "2026-10-25T00:00:00.000Z",
    verify: false,
    verifyAskedAt: "2026-10-25T00:00:00.000Z",
  });

/** A read as `add` saves it: its param's example, no checks, nothing learn_site proved. */
const site = (op: Record<string, unknown> = {}, over: Record<string, unknown> = {}): Site =>
  parseSite({
    name: "demo",
    baseUrl: "https://www.example.com",
    operations: [
      {
        name: "search",
        request: { method: "GET", url: "https://www.example.com/api/search?q=kittens", headers: {} },
        slots: [{ param: "q", at: ["query:q"] }],
        params: [{ name: "q", example: "puppies" }],
        trigger: { url: "https://www.example.com/search?q={q}" },
        match: { host: "www.example.com", path: "/api/search" },
        response: { extract: "hits" },
        readOnly: true,
        ...op,
      },
    ],
    ...over,
  });

const json = (v: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", ...headers } });

/** The site: what it answers, and every request it was sent with the cookie header it carried. */
function web(answer: (url: string) => Response = () => json({ hits: [{ title: "a puppy" }] })) {
  const asked: { url: string; cookie: string | null }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    asked.push({ url: String(input), cookie: new Headers(init?.headers).get("cookie") });
    return answer(String(input));
  }) as typeof fetch;
  return { asked, fetchImpl };
}

const uploads = () => fake.uploads();

test("an op made with add goes up with the clean replay it never had, and lands as a candidate", async () => {
  shareOn();
  saveSite(site());
  // a visitor's cookie in the jar: the replay sends none of it
  saveSession("demo", {
    cookies: [
      {
        name: "_ga",
        value: "GA1.2.3",
        domain: "www.example.com",
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: true,
      },
    ],
    values: {},
  });
  const { asked, fetchImpl } = web();
  // what `publish --yes` sends: the user's yes, and no evidence of its own
  const [out] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.deepEqual([out!.shared, out!.status, out!.cleanReplay], [true, "candidate", "ok"], JSON.stringify(out));
  assert.equal(out!.next, undefined);
  assert.deepEqual(asked, [{ url: "https://www.example.com/api/search?q=puppies", cookie: null }]);
  assert.equal(uploads()[0]!.evidence.cleanReplay, "ok");

  // an automatic share runs it too, and the ok makes the op public, so it goes without a yes
  fake.received.length = 0;
  saveSite(site({ description: "searches the catalog" }));
  const auto = web();
  const [mine] = await shareOps("demo", ["search"], { evidence: {}, fetchImpl: auto.fetchImpl, minIntervalMs: 0 });
  assert.deepEqual([mine!.shared, mine!.status], [true, "candidate"], JSON.stringify(mine));
  assert.equal(auto.asked.length, 1);
});

test("what a learn_site proved of this version is sent without a second request; an older proof is not", async () => {
  shareOn();
  saveSite(site());
  const op = loadSite("demo")!.site.operations[0]!;
  recordCases("demo", op, [], { learnedLoggedIn: false, cleanReplay: "ok" });
  const { asked, fetchImpl } = web();
  const [out] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(out!.status, "candidate", JSON.stringify(out));
  assert.equal(out!.cleanReplay, undefined, "no replay ran here");
  assert.deepEqual(asked, []);
  assert.equal(uploads()[0]!.evidence.cleanReplay, "ok");

  // the op changed since: that proof is of another version
  saveSite(site({ description: "changed after learn_site" }));
  await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(asked.length, 1);
});

test("a clean replay that fails still goes up; the registry holds it, and the uploader is told why and what next", async () => {
  shareOn();
  saveSite(site());
  const { asked, fetchImpl } = web(() => json({ error: "sign in first" }, 401));
  const [out] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(asked.length, 1);
  assert.equal(uploads()[0]!.evidence.cleanReplay, "failed");
  assert.deepEqual([out!.shared, out!.status, out!.cleanReplay], [true, "review", "failed"], JSON.stringify(out));
  assert.match(out!.cleanReason!, /^auth/);
  assert.match(out!.reason!, /held for review: served only to this install until a maintainer approves it/);
  assert.match(out!.reason!, /no cookies did not answer with data/);
  assert.deepEqual(
    out!.held!.map((h) => h.category),
    ["clean-replay-failed"],
  );
  assert.match(out!.next!, /wait for a maintainer/);
  assert.deepEqual(loadSite("demo")!.site.operations[0]!.version, {
    hash: out!.hash,
    status: "review",
    review: ["clean-replay-failed"],
  });
  // and status says so, from the local files alone
  const s = status("demo");
  const p = s.problems.find((x) => x.problem === "review");
  assert.equal(p?.op, "search", JSON.stringify(s.problems));
  assert.match(p!.detail, /served only to this install/);
  assert.match(p!.next, /wait for a maintainer/);
});

test("an op that cannot be replayed clean stays skipped, sends nothing, and the next step is the real one", async () => {
  shareOn();
  const { asked, fetchImpl } = web();
  // the browser for every call: plain HTTP says nothing of whether it is public
  saveSite(site({ minTier: 3 }));
  const [browser] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.deepEqual([browser!.status, browser!.cleanReplay], ["review", "skipped"], JSON.stringify(browser));
  assert.match(browser!.cleanReason!, /browser/);
  assert.match(browser!.next!, /nothing to do but wait for a maintainer/);

  // no example for a required param: nothing to replay it with
  saveSite(site({ params: [{ name: "q" }] }));
  const [bare] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.deepEqual([bare!.status, bare!.cleanReplay], ["review", "skipped"], JSON.stringify(bare));
  assert.match(bare!.cleanReason!, /no example for q/);
  assert.match(bare!.next!, /api-anything add demo search .*--example q=/);
  assert.match(bare!.next!, /api-anything publish demo search --yes/);
  assert.deepEqual(asked, []);
  assert.deepEqual(
    uploads().map((u) => u.evidence.cleanReplay),
    ["skipped", "skipped"],
  );
});

test("sharing off, never asked, or local-only: the replay sends nothing, and neither does an op that waits for a yes", async () => {
  saveSite(site());
  const { asked, fetchImpl } = web();
  const never = await shareOps("demo", ["search"], { evidence: {}, fetchImpl, minIntervalMs: 0 });
  assert.match(never[0]!.reason!, /never asked/);
  shareOn(false);
  const off = await shareOps("demo", ["search"], { evidence: {}, fetchImpl, minIntervalMs: 0 });
  assert.match(off[0]!.reason!, /sharing is off/);
  process.env.API_ANYTHING_LOCAL_ONLY = "1";
  try {
    const local = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
    assert.match(local[0]!.reason!, /local-only/);
  } finally {
    delete process.env.API_ANYTHING_LOCAL_ONLY;
  }
  // an op holding what may be the user's own waits for their yes: no request is spent on it first
  shareOn();
  saveSite(site({ description: "ask me@mail.example.com" }));
  const held = await shareOps("demo", ["search"], { evidence: {}, fetchImpl, minIntervalMs: 0 });
  assert.equal(held[0]!.needsConsent, true);
  assert.deepEqual(asked, []);
  assert.equal(uploads().length, 0);
});

test("a site cooling down, over its budget, or answering rate gets no replay now, and the op waits instead of going up skipped", async () => {
  shareOn();
  saveSite(site());
  const { asked, fetchImpl } = web();
  coolDown("demo", { class: "rate", reason: "429 Too Many Requests" }, 60_000);
  const [cool] = await shareOps("demo", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(cool!.shared, false);
  assert.match(cool!.reason!, /clean replay was not sent: demo is cooling down/);
  assert.match(cool!.next!, /api-anything publish demo search --yes .*after/);
  assert.deepEqual(asked, []);

  // the site's own budget: one request an hour, spent by the first replay
  saveSite(site({}, { name: "paced", pace: { perHour: 1 } }));
  const [first] = await shareOps("paced", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(first!.cleanReplay, "ok", JSON.stringify(first));
  saveSite(site({ description: "again" }, { name: "paced", pace: { perHour: 1 } }));
  const [spent] = await shareOps("paced", ["search"], { evidence: {}, consent: true, fetchImpl, minIntervalMs: 0 });
  assert.equal(spent!.shared, false);
  assert.match(spent!.reason!, /clean replay was not sent: .*budget is 1 requests an hour/);
  assert.equal(asked.length, 1);

  // the site says stop: no upload, and the site cools down as after any call
  saveSite(site({}, { name: "busy" }));
  const busy = web(() => json({ error: "slow down" }, 429, { "retry-after": "120" }));
  const [rate] = await shareOps("busy", ["search"], {
    evidence: {},
    consent: true,
    fetchImpl: busy.fetchImpl,
    minIntervalMs: 0,
  });
  assert.equal(rate!.shared, false);
  assert.match(rate!.reason!, /clean replay answered rate/);
  assert.ok(cooling("busy"), "the site cools down");
  assert.equal(uploads().length, 1, "only the paced site's first replay went up");
});

test("every reason the registry gives has a category, and an unknown one is other", () => {
  const samples = [
    "its clean replay was skipped, not ok",
    "its clean replay was failed, not ok",
    "learned while signed in",
    "learned signed in; 3 installs on distinct networks hold this exact op",
    "a write",
    "a read sent as POST, not a GraphQL query",
    "sends the caller's own cookie:sid",
    "fills query:id from a lookup sent with the caller's cookies",
    "a new op on a site with a login: inbox",
    "a new op on an established site: follow",
    "no live version of search to compare its match with",
    'its match ["GET","a.example.com","/x",""] differs from the live version\'s ["GET","a.example.com","/y",""]',
    "its trigger differs from the live version's, under the same request",
    "lists public values: x-api-key",
    "sends to or opens cdn.example.net, off its site example.com",
    "$.operations[0].request.headers.x holds what looks like a JWT",
  ];
  const got = samples.map(reviewCategory);
  assert.ok(!got.includes("other"), JSON.stringify(got));
  for (const c of got) assert.ok((REVIEW_CATEGORIES as readonly string[]).includes(c));
  assert.equal(reviewCategory("something new the registry says"), "other");
});

/* ------------------------------------------------------------ publish */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
function cli(...args: string[]): Promise<{ code: number; out: Record<string, unknown> }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      ["--import", "tsx", join(ROOT, "src", "cli.ts"), ...args],
      { cwd: ROOT, env: { ...process.env } },
      (err, stdout) => resolve({ code: err ? Number(err.code ?? 1) : 0, out: JSON.parse(stdout) }),
    ),
  );
}

test("publish's preview sends nothing and says the clean replay will run; --yes says what the registry held and why", async () => {
  shareOn();
  saveSite(
    site(
      {},
      {
        operations: [
          site().operations[0]!,
          { ...site().operations[0]!, name: "proved" },
          { ...site().operations[0]!, name: "browser", minTier: 3 },
        ],
      },
    ),
  );
  const ops = loadSite("demo")!.site.operations;
  recordCases("demo", ops[1]!, [], { learnedLoggedIn: false, cleanReplay: "failed" });
  const preview = await cli("publish", "demo");
  assert.equal(preview.code, 0, JSON.stringify(preview.out));
  assert.deepEqual(preview.out.cleanReplay, {
    search: "will run on publish",
    proved: "failed (on record)",
    browser: preview.out.cleanReplay && (preview.out.cleanReplay as Record<string, string>).browser,
  });
  assert.match((preview.out.cleanReplay as Record<string, string>).browser!, /^skipped: .*browser/);
  assert.equal(uploads().length, 0, "a preview sends nothing");

  // the op proved failed goes up with that, and is held: the CLI says why and what next
  const sent = await cli("publish", "demo", "proved", "--yes");
  assert.equal(sent.code, 0, JSON.stringify(sent.out));
  const [one] = sent.out.shared as { status: string; reason: string; next: string }[];
  assert.equal(one!.status, "review");
  assert.match(one!.reason, /held for review: served only to this install/);
  assert.match(one!.next, /wait for a maintainer/);
  assert.match(String(sent.out.next), /held for review/);
});
