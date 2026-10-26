/**
 * Native dialogs (alert, confirm, prompt, beforeunload) in browser runs, the record a write keeps of
 * the confirms it was learned through, and the line that says why a run's wait ended.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { browserAvailable, closeBrowser, runTrigger, waitReport } from "../src/browser.js";
import { acceptedConfirms, confirmDigest, confirmTemplate, recordedConfirms } from "../src/confirm.js";
import { call } from "../src/execute.js";
import { addOperation, capturePage, profileDir, writeGuard } from "../src/heal.js";
import { parseSite, type Site } from "../src/spec.js";
import { updateSite } from "../src/store.js";
import type { CaptureResult } from "../src/types.js";
import { vetShared } from "../src/vet.js";
import { type Fixture, startFixture } from "./fixture/server.js";

const HOME = mkdtempSync(join(tmpdir(), "api-anything-dialogs-"));
process.env.API_ANYTHING_HOME = HOME;
after(() => rmSync(HOME, { recursive: true, force: true }));

const ORIGIN = "https://shop.example.com";

test("a confirm's template abstracts the args it names, as whole words in any case, longest first", () => {
  assert.deepEqual(confirmTemplate("Delete  post 48213?\nThis can't be undone.", { id: "48213" }), [
    "Delete post ",
    ["id"],
    "? This can't be undone.",
  ]);
  // a value inside a longer number or word is not that value; the longer of two overlapping values wins
  assert.deepEqual(confirmTemplate("Move 123 and 12 to Alice Smith, not Alice?", { n: "12", who: "alice smith" }), [
    "Move 123 and ",
    ["n"],
    " to ",
    ["who"],
    ", not Alice?",
  ]);
  // punctuation at a value's edge needs no word boundary there
  assert.deepEqual(confirmTemplate("Send “#general”?", { ch: "#general" }), ["Send “", ["ch"], "”?"]);
  assert.deepEqual(confirmTemplate("Are you sure?", { id: "48213", empty: "" }), ["Are you sure?"]);
});

test("a confirm's digest matches the same question about another value, and nothing else", () => {
  const at = { origin: ORIGIN, step: 1 };
  const learned = confirmDigest({ ...at, message: "Delete post 48213? This can't be undone." }, { id: "48213" });
  assert.match(learned, /^[0-9a-f]{64}$/);
  assert.equal(confirmDigest({ ...at, message: "Delete post 7? This can't be undone." }, { id: "7" }), learned);
  for (const [why, other] of [
    ["another question", confirmDigest({ ...at, message: "Empty the trash? This can't be undone." }, { id: "7" })],
    [
      "the value is not this call's",
      confirmDigest({ ...at, message: "Delete post 48213? This can't be undone." }, { id: "7" }),
    ],
    ["another step", confirmDigest({ ...at, step: 2, message: "Delete post 7? This can't be undone." }, { id: "7" })],
    [
      "another origin",
      confirmDigest(
        { ...at, origin: "https://evil.example", message: "Delete post 7? This can't be undone." },
        { id: "7" },
      ),
    ],
  ])
    assert.notEqual(other, learned, why);

  // each record is accepted once a run, at its own step
  const accept = recordedConfirms([{ step: 1, digest: learned }], { id: "9" });
  const ask = { ...at, message: "Delete post 9? This can't be undone." };
  assert.equal(accept({ ...ask, step: 0 }), false);
  assert.equal(accept(ask), true);
  assert.equal(accept(ask), false, "a second ask of a question recorded once");

  // only what the run accepted is recorded
  const run: CaptureResult = {
    exchanges: [],
    cookies: [],
    finalUrl: `${ORIGIN}/`,
    dialogs: [
      { type: "alert", message: "Hi", origin: ORIGIN, step: -1, accepted: false },
      { type: "confirm", message: "Delete post 48213? This can't be undone.", origin: ORIGIN, step: 1, accepted: true },
      { type: "confirm", message: "Subscribe to our newsletter?", origin: ORIGIN, step: 1, accepted: false },
    ],
  };
  assert.deepEqual(acceptedConfirms(run, { id: "48213" }), [{ step: 1, digest: learned }]);
});

test("why a wait ended: the page's address without its query, the status, open requests and the dialogs, no page text", () => {
  const report = waitReport({
    exchanges: [],
    cookies: [],
    finalUrl: `${ORIGIN}/orders/7?token=s3cr3t-value#top`,
    dialogs: [
      { type: "beforeunload", message: "", origin: ORIGIN, step: 0, accepted: true },
      { type: "confirm", message: "Cancel order 7 for Jane Doe?", origin: ORIGIN, step: 1, accepted: false },
    ],
    wait: { ended: "quiet", open: 2, status: 200 },
  });
  assert.equal(
    report,
    `the page went quiet on ${ORIGIN}/orders/7 (HTTP 200); 2 requests still open; dialogs: beforeunload accepted at steps[0], confirm dismissed at steps[1]`,
  );
  // a capture saved before runs said why
  assert.equal(waitReport({ exchanges: [], cookies: [], finalUrl: "about:blank" }), "on about:blank");
});

describe("the shared rules on recorded confirms", () => {
  const site = (op: Record<string, unknown>): Site =>
    parseSite({
      name: "shop",
      baseUrl: ORIGIN,
      operations: [
        {
          name: "deletePost",
          request: { method: "POST", url: `${ORIGIN}/api/delete?id=48213`, headers: {} },
          slots: [{ param: "id", at: ["query:id"] }],
          params: [{ name: "id" }],
          trigger: { url: `${ORIGIN}/delete/{id}`, steps: [{ action: "click", selector: "#delete" }] },
          match: { host: "shop.example.com", path: "/api/delete" },
          readOnly: false,
          ...op,
        },
      ],
    });
  const trigger = (confirms: unknown[]) => ({
    url: `${ORIGIN}/delete/{id}`,
    steps: [{ action: "click", selector: "#delete" }],
    confirms,
  });
  const digest = "a".repeat(64);

  test("a write's few confirms at its own steps pass; a read's, too many, or one at a step it lacks do not", () => {
    assert.deepEqual(vetShared(site({ trigger: trigger([{ step: 0, digest }]) })).errors, []);
    const refused: [string, Site, RegExp][] = [
      [
        "a read",
        site({
          readOnly: true,
          request: { method: "GET", url: `${ORIGIN}/api/x`, headers: {} },
          trigger: trigger([{ step: 0, digest }]),
        }),
        /a read accepts no confirm/,
      ],
      [
        "nine",
        site({ trigger: trigger(Array.from({ length: 9 }, () => ({ step: 0, digest }))) }),
        /9 recorded confirm dialogs; at most 8/,
      ],
      [
        "a step past the last",
        site({ trigger: trigger([{ step: 1, digest }]) }),
        /steps\[1\], a step the trigger does not have/,
      ],
    ];
    for (const [why, s, re] of refused) assert.match(vetShared(s).errors.join("\n"), re, why);
  });

  test("a digest that is not one, which could carry page text, is no spec", () => {
    for (const bad of ["Delete post 48213?", "A".repeat(64), "a".repeat(63)])
      assert.throws(() => site({ trigger: trigger([{ step: 0, digest: bad }]) }), /digest must be 64 lowercase hex/);
  });
});

describe("dialogs in browser runs", { skip: !browserAvailable() && "no Chromium browser installed" }, () => {
  let fx: Fixture;
  before(async () => (fx = await startFixture()));
  after(async () => {
    await closeBrowser();
    await fx.close();
  });
  const hits = (path: string) => fx.calls.filter((c) => c.path.startsWith(path));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  test("an alert or a prompt on load is dismissed and the page goes on to load its data", async () => {
    for (const [q, type] of [
      ["", "alert"],
      ["?ask=1", "prompt"],
    ] as const) {
      // the page's script stops at the dialog until it is answered: the fetch after it says it was
      const r = await runTrigger({ url: `${fx.url}/greet${q}`, profileDir: profileDir() });
      assert.ok(
        r.exchanges.some((e) => e.request.url.endsWith("/api/scoped?q=greeted") && e.response?.status === 200),
        type,
      );
      assert.deepEqual(
        r.dialogs?.map((d) => [d.type, d.accepted, d.step]),
        [[type, false, -1]],
      );
    }
  });

  test("a read run never confirms: the delete behind the confirm is not sent", async () => {
    const before = hits("/api/delete").length;
    const r = await runTrigger({
      url: `${fx.url}/delete/48213`,
      steps: [{ action: "click", selector: "#delete" }],
      profileDir: profileDir(),
    });
    await sleep(300);
    assert.equal(hits("/api/delete").length, before, "a read run confirmed a delete");
    assert.deepEqual(
      r.dialogs?.map((d) => [d.type, d.accepted, d.step, d.message]),
      [["confirm", false, 0, "Delete post 48213? This can't be undone."]],
    );
    assert.match(waitReport(r), /dialogs: confirm dismissed at steps\[0\]$/);
  });

  test("leaving a page that asks about unsaved changes is accepted: a goto step goes through", async () => {
    // told no, the browser stays, and the goto aborts: the run would go on the page it was on
    const r = await runTrigger({
      url: `${fx.url}/unsaved`,
      steps: [
        { action: "click", selector: "#edit" },
        { action: "goto", value: `${fx.url}/u/alice` },
      ],
      profileDir: profileDir(),
    });
    assert.equal(r.finalUrl, `${fx.url}/u/alice`);
    assert.ok(r.exchanges.some((e) => e.request.url.includes("/UserByName?")));
    assert.deepEqual(
      r.dialogs?.map((d) => [d.type, d.accepted, d.step]),
      [["beforeunload", true, 1]],
    );
  });

  test("a guarded run ends on such a page as on any other: its pages are emptied, and the draft it saves on leaving is stopped", async () => {
    const before = hits("/api/autosave").length;
    const r = await runTrigger({
      url: `${fx.url}/unsaved`,
      steps: [{ action: "click", selector: "#edit" }],
      profileDir: profileDir(),
      intercept: writeGuard(undefined, { url: `${fx.url}/unsaved` }),
    });
    await sleep(300);
    assert.equal(hits("/api/autosave").length, before, "the page's pagehide beacon left");
    assert.deepEqual(
      r.exchanges.filter((e) => e.request.url.endsWith("/api/autosave")).map((e) => e.aborted),
      [true],
    );
  });

  test("a write behind confirm() is learned with the confirm accepted and the write stopped, then a tier-3 call confirms only that question", async () => {
    const deletes = () => hits("/api/delete").map((c) => c.path);
    const r = await addOperation({
      site: "dlg",
      op: "deletePost",
      trigger: { url: `${fx.url}/delete/{id}`, steps: [{ action: "click", selector: "#delete" }] },
      examples: [{ id: "48213" }, { id: "51977" }],
      write: true,
    });
    assert.deepEqual(deletes(), [], "learning sent the delete");
    // told no, the page sent nothing and the learner took the page's own GET for the write
    assert.equal(r.operation.request.method, "POST", JSON.stringify(r.operation.request));
    assert.match(r.operation.request.url, /\/api\/delete\?id=48213$/);
    assert.deepEqual(
      r.warnings.filter((w) => /confirm/.test(w)),
      [],
      "both runs asked the same question",
    );
    assert.equal(r.operation.trigger.confirms?.length, 1);
    assert.equal(r.operation.trigger.confirms?.[0]?.step, 0);
    // the spec keeps a digest, no page text
    assert.doesNotMatch(readFileSync(r.path, "utf8"), /Delete post|undone/);

    // the request is signed per page in real life: only the page can send it
    updateSite("dlg", (s) => ({
      ...s!,
      operations: s!.operations.map((o) => ({ ...o, minTier: 3 as const })),
    }));
    const res = await call("dlg", "deletePost", { id: "60606" }, { minIntervalMs: 0, allowWrites: true });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.tier, 3);
    assert.deepEqual(deletes(), ["/api/delete?id=60606"]);

    // the site rewords its question: not the one recorded, so it is told no, and the call says so
    updateSite("dlg", (s) => ({
      ...s!,
      operations: s!.operations.map((o) => ({
        ...o,
        trigger: { ...o.trigger, url: `${fx.url}/delete/{id}?wording=new` },
      })),
    }));
    const reworded = await call("dlg", "deletePost", { id: "70707" }, { minIntervalMs: 0, allowWrites: true });
    assert.equal(reworded.ok, false);
    assert.equal(reworded.tier, 3);
    assert.match(
      reworded.reason ?? "",
      /fired no request matching .*\(the page went quiet on http:\/\/127\.0\.0\.1:\d+\/delete\/70707 \(HTTP 200\); 0 requests still open; dialogs: confirm dismissed at steps\[0\]\): the page asked to confirm at steps\[0\] and was told no, since it is not one this write's learning recorded; nothing is confirmed on the user's behalf/,
    );
    assert.doesNotMatch(reworded.reason ?? "", /Really remove/, "page text in the reason");

    // a spec learned before confirms were recorded asks the old question, and is told no all the same
    updateSite("dlg", (s) => ({
      ...s!,
      operations: s!.operations.map((o) => ({
        ...o,
        trigger: { url: `${fx.url}/delete/{id}`, steps: o.trigger.steps },
      })),
    }));
    const unrecorded = await call("dlg", "deletePost", { id: "80808" }, { minIntervalMs: 0, allowWrites: true });
    assert.match(unrecorded.reason ?? "", /told no, since this write's learning recorded none/);
    await sleep(300);
    assert.deepEqual(deletes(), ["/api/delete?id=60606"], "a confirm nobody recorded was accepted");
  });

  test("capture --write accepts the confirm with the write stopped, and add --from records it", async () => {
    const cap = await capturePage({
      url: `${fx.url}/delete/48213`,
      steps: [{ action: "click", selector: "#delete" }],
      write: true,
    });
    await sleep(300);
    assert.deepEqual(
      hits("/api/delete")
        .map((c) => c.path)
        .filter((p) => p.endsWith("48213")),
      [],
    );
    const r = await addOperation({
      site: "dlg",
      op: "deleteFrom",
      examples: [{ id: "48213" }],
      write: true,
      from: { capture: cap },
    });
    assert.equal(r.operation.request.method, "POST");
    const asked = { message: "Delete post 1? This can't be undone.", origin: fx.url, step: 0 };
    assert.deepEqual(r.operation.trigger.confirms, [{ step: 0, digest: confirmDigest(asked, { id: "1" }) }]);
  });

  test("a read add on a page whose request waits on a confirm says the confirm was told no", async () => {
    await assert.rejects(
      addOperation({
        site: "dlg",
        op: "notARead",
        trigger: { url: `${fx.url}/delete/{id}`, steps: [{ action: "click", selector: "#delete" }] },
        examples: [{ id: "48213" }],
        match: { path: "/api/delete" },
      }),
      /asked to confirm at steps\[0\] and a read never confirms: if what it asks about is a write, add it with --write/,
    );
  });
});
