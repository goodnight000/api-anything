/** Bundled site specs: their recipes against trimmed copies of the live responses, their param rules, and their notes. */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { judge } from "../src/classify.js";
import { asText, fillTemplate, getAt } from "../src/codec.js";
import { call } from "../src/execute.js";
import { returnedFields } from "../src/extract.js";
import { buildRequest, holdsRef, preparedValues } from "../src/http.js";
import { personalIn } from "../src/publish.js";
import { providerKeys, scanSecrets } from "../src/secrets.js";
import { type Operation, parseSite, type Site } from "../src/spec.js";
import { listSites, siteNotes } from "../src/store.js";
import type { StoredCookie } from "../src/types.js";

const raw = (site: string) => JSON.parse(readFileSync(new URL(`../sites/${site}.json`, import.meta.url), "utf8"));
const op = (site: string, name: string): Operation => parseSite(raw(site)).operations.find((o) => o.name === name)!;
// the parsed spec's params: the schema keeps pattern and hint
const rawParams = (site: string, name: string) => op(site, name).params;
// a clean home, so call() runs the bundled spec
const HOME = mkdtempSync(join(tmpdir(), "aa-sites-"));
mkdirSync(join(HOME, "sites"));
after(() => rmSync(HOME, { recursive: true, force: true }));
const callBundled = (site: string, name: string, args: Record<string, unknown>, fetchImpl: typeof fetch) => {
  process.env.API_ANYTHING_HOME = HOME;
  return call(site, name, args, { fetchImpl, maxTier: 1, minIntervalMs: 0 });
};
const noSession = { cookies: [] as StoredCookie[], values: {} as Record<string, string> };
const ok = (o: Operation, body: string, contentType = "application/json") => {
  const j = judge(o, { status: 200, headers: { "content-type": contentType }, body });
  assert.equal(j.class, "ok", j.reason);
  return j.data as Record<string, unknown>[];
};
// A spec's param pattern is a whole-value JS regex.
const accepts = (p: { pattern?: string }, v: string) => new RegExp(p.pattern!).test(v);

// ---------------------------------------------------------------- recorded answers

/**
 * A bundled op's answer, trimmed to what its recipe reads: test/fixture/sites/<site>.json. It proves
 * the recipe still parses that body, not that the site still answers that way.
 */
interface Fixture {
  op: string;
  args: Record<string, string | number | boolean>;
  status: number;
  contentType: string;
  /** where it came from: recorded live, or built from a real answer */
  note: string;
  /** text, or a JSON answer as JSON */
  body: unknown;
}
const FIXTURES = new URL("./fixture/sites/", import.meta.url);
const fixtures = (site: string): Fixture[] => JSON.parse(readFileSync(new URL(`${site}.json`, FIXTURES), "utf8"));
const bodyOf = (f: Fixture) => (typeof f.body === "string" ? f.body : JSON.stringify(f.body));
const fixture = (site: string, name: string) => bodyOf(fixtures(site).find((f) => f.op === name)!);
// a body this size is a page, not a trimmed answer
const FIXTURE_BYTES = 8 * 1024;

/**
 * Why a fixture may not be kept: someone else's account in it. Only an op that runs signed out, with
 * no credential going into its request; and none of what publish refuses or shows the publisher (a
 * token's shape, an email, a UUID, an IP address).
 */
function fixtureProblems(site: Site, f: Fixture): string[] {
  const o = site.operations.find((x) => x.name === f.op);
  if (!o) return [`${f.op} is no operation of ${site.name}`];
  const out: string[] = [];
  if (o.learnedLoggedIn) out.push(`${f.op} was learned signed in: its answers are an account's`);
  if (o.slots.some(holdsRef)) out.push(`${f.op} sends a cookie or session value: its answers can be an account's`);
  const size = Buffer.byteLength(bodyOf(f));
  if (size > FIXTURE_BYTES) out.push(`${f.op}'s body is ${size} bytes; trim it to at most ${FIXTURE_BYTES}`);
  out.push(...scanSecrets(f, noSession).warnings, ...personalIn(f, `${site.name}/${f.op}`));
  for (const k of providerKeys(JSON.stringify(f))) out.push(`${f.op} holds ${k.what} (${k.sample})`);
  return out;
}

test("recorded answers: each fixture's args reach their slots, and its recipe finds every field in the trimmed body", () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 4, files.join(", "));
  let n = 0;
  for (const file of files) {
    const site = parseSite(raw(file.slice(0, -5)));
    for (const f of fixtures(site.name)) {
      const at = `${site.name}/${f.op}`;
      assert.deepEqual(fixtureProblems(site, f), [], at);
      const o = site.operations.find((x) => x.name === f.op)!;
      const req = o.request ? buildRequest(o, f.args, noSession) : undefined;
      if (req) {
        for (const [k, v] of Object.entries(f.args)) {
          // its own slot, or a hole in another slot's template (Google Flights spells the query in one)
          const slots = o.slots.filter((s) => s.param === k || s.template?.includes(`{${k}}`));
          assert.ok(slots.length, `${at}: ${k} has no slot`);
          for (const s of slots) {
            const leaf = asText(getAt(req, s.at));
            assert.ok(
              leaf.includes(asText(v)) || leaf.includes(encodeURIComponent(asText(v))),
              `${at}: ${k} not in ${leaf}`,
            );
          }
        }
      } else {
        // a local op's args fill its command: fill it and find every one
        const cmd = fillTemplate(o.local!.command, preparedValues(o, f.args));
        for (const [k, v] of Object.entries(f.args))
          assert.ok(cmd.includes(asText(v)), `${at}: ${k} not in its command`);
      }
      const j = judge(o, {
        status: f.status,
        headers: { "content-type": f.contentType },
        body: bodyOf(f),
        ...(req ? { url: req.url } : {}),
      });
      assert.equal(j.class, "ok", `${at}: ${j.reason}`);
      const items = (Array.isArray(j.data) ? j.data : [j.data]) as Record<string, unknown>[];
      assert.ok(items.length > 0 && items[0] !== undefined, `${at}: no data`);
      for (const field of returnedFields(o.response) ?? [])
        assert.ok(
          items.some((i) => i?.[field] !== undefined && i[field] !== ""),
          `${at}: no item has ${field}`,
        );
      n++;
    }
  }
  assert.ok(n >= 8, String(n));
});

test("recorded answers: a fixture for a signed-in op, or holding a token or someone's address, is refused", () => {
  const gr = parseSite(raw("goodreads"));
  const li = parseSite(raw("linkedin"));
  const f = (op: string, body: unknown): Fixture => ({
    op,
    args: {},
    status: 200,
    contentType: "text/html",
    note: "",
    body,
  });
  const said = (site: Site, x: Fixture) => fixtureProblems(site, x).join("\n");
  assert.match(said(li, f("getMe", "{}")), /learned signed in/);
  assert.match(said(gr, f("getReviews", "{}")), /sends a cookie or session value/);
  assert.match(said(gr, f("getBook", "x".repeat(FIXTURE_BYTES + 1))), /trim it/);
  assert.match(said(gr, f("getBook", `<p>${["jane", "example.com"].join("@")}</p>`)), /email address/);
  assert.match(said(gr, f("getBook", "<p>203.0.113.9</p>")), /IP address/);
  // a JWT's shape, made here so no scanner of this repository reads one in it
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "c2lnbmF0dXJlLXZhbHVlLWhlcmU"].join(".");
  assert.match(said(gr, f("getBook", { token: jwt })), /looks like a JWT/);
  // an AWS access key id's shape, made here for the same reason
  assert.match(said(gr, f("getBook", `<p>${["AKIA", "Q3EXAMPLE7FAKE00"].join("")}</p>`)), /holds an AWS access key/);
});

// ---------------------------------------------------------------- google-flights

test("google-flights search/top read the results the page embeds, so a metro code like NYC returns flights", () => {
  const body = fixture("google-flights", "search");
  const other = ok(op("google-flights", "search"), body, "text/html; charset=utf-8");
  assert.deepEqual(
    other.map((f) => [f.price, f.to]),
    [
      [149, "EWR"],
      [204, "LGA"],
    ],
  );
  assert.deepEqual(other[0], {
    airline: ["Frontier"],
    price: 149,
    from: "SFO",
    to: "EWR",
    departureTime: [22, 14],
    arrivalDate: [2026, 10, 22],
    arrivalTime: [10, 33],
    durationMinutes: 559,
    via: ["ATL"],
  });
  assert.equal("via" in other[1], false, "a nonstop flight has no via");
  assert.deepEqual(
    ok(op("google-flights", "top"), body, "text/html; charset=utf-8").map((f) => f.price),
    [219],
  );
});

test("google-flights search sends the places as free text in q=, which Google resolves (NYC, a city name)", () => {
  for (const name of ["search", "top"]) {
    const u = new URL(
      buildRequest(
        op("google-flights", name),
        { origin: "SFO", destination: "New York", date: "2026-10-21" },
        noSession,
      ).url,
    );
    assert.equal(u.pathname, "/travel/flights");
    assert.equal(u.searchParams.get("q"), "Flights from SFO to New York on 2026-10-21 one way");
    assert.equal(u.searchParams.get("curr"), "USD");
  }
});

test("google-flights priceCalendar: one call gives the cheapest fare per date in the range", () => {
  const o = op("google-flights", "priceCalendar");
  const req = buildRequest(o, { origin: "BOS", destination: "MIA", start: "2026-11-01", end: "2026-11-30" }, noSession);
  const inner = JSON.parse(JSON.parse(new URLSearchParams(req.body!).get("f.req")!)[1]);
  assert.deepEqual(inner[1][13][0][0], [[["BOS", 0]]]);
  assert.deepEqual(inner[1][13][0][1], [[["MIA", 0]]]);
  assert.deepEqual(inner[2], ["2026-11-01", "2026-11-30"]);
  assert.equal(inner[1][13][0][6], "2026-11-01");
  // learning matched "SFO" inside the random x-goog-batchexecute-bgr blob; that header is a session value only
  assert.ok(!o.slots.some((s) => s.param && s.at[0] === "header:x-goog-batchexecute-bgr"));
  const payload = [
    [null, [[1]], 0, "x", "y"],
    [
      ["2026-11-01", null, [[null, 185], "t1"], 1],
      ["2026-11-02", null, [[null, 120], "t2"], 1],
      ["2026-11-03", null, null, 1],
    ],
  ];
  const body = `)]}'\n\n123\n${JSON.stringify([["wrb.fr", null, JSON.stringify(payload)]])}\n`;
  assert.deepEqual(ok(o, body), [
    { date: "2026-11-01", price: 185 },
    { date: "2026-11-02", price: 120 },
    { date: "2026-11-03" },
  ]);
});

test("google-flights params carry a pattern and a hint; the calendar refuses metro codes it can't search", () => {
  for (const name of ["search", "top", "priceCalendar"]) {
    for (const p of rawParams("google-flights", name)) {
      assert.ok(p.pattern && p.hint, `${name}.${p.name} needs pattern and hint`);
      assert.doesNotThrow(() => new RegExp(p.pattern!));
    }
  }
  const [origin, , date] = rawParams("google-flights", "search");
  for (const v of ["SFO", "NYC", "New York", "São Paulo"]) assert.ok(accepts(origin!, v), v);
  assert.ok(!accepts(origin!, "2026-10-21"));
  assert.ok(accepts(date!, "2027-04-15"));
  for (const v of ["Oct 21", "2027-4-15", "04/15/2027"]) assert.ok(!accepts(date!, v), v);
  const [calOrigin, , start] = rawParams("google-flights", "priceCalendar");
  for (const v of ["JFK", "LGA", "EWR", "LHR"]) assert.ok(accepts(calOrigin!, v), v);
  for (const v of ["NYC", "LON", "TYO", "jfk", "New York", "JFKX"]) assert.ok(!accepts(calOrigin!, v), v);
  assert.match(calOrigin!.hint!, /JFK, LGA or EWR/);
  assert.ok(!accepts(start!, "next month"));
});

test("google-flights search with a malformed date is input with the param's hint, and nothing is sent", async () => {
  let sent = 0;
  const r = await callBundled(
    "google-flights",
    "search",
    { origin: "SFO", destination: "NYC", date: "tomorrowish-bad" },
    (async () => {
      sent++;
      return new Response("");
    }) as typeof fetch,
  );
  assert.equal(r.class, "input", JSON.stringify(r));
  assert.match(
    r.reason ?? "",
    /param "date" must be a departure date as YYYY-MM-DD, e\.g\. 2027-04-15, got "tomorrowish-bad"/,
  );
  assert.equal(sent, 0);
  const kw = await callBundled("linkedin", "searchCompanies", { keywords: "rust, zurich" }, (async () => {
    sent++;
    return new Response("");
  }) as typeof fetch);
  assert.equal(kw.class, "input", JSON.stringify(kw));
  assert.equal(sent, 0);
});

test("google-flights search for a past date (Google's Explore page, with a Sign-in link to ServiceLogin) is input, not auth", async () => {
  const explore =
    `<html><head><title>Explore</title></head><body><a href="https://accounts.google.com/ServiceLogin?hl=en-US&continue=https://www.google.com/travel/explore">Sign in</a>` +
    `<script nonce="x">AF_initDataCallback({key: 'ds:0', hash: '1', data:[[null,null,0,"x"]], sideChannel: {}});</script></body></html>`;
  const results = fixture("google-flights", "search");
  const dates: string[] = [];
  const r = await callBundled(
    "google-flights",
    "search",
    { origin: "SFO", destination: "NYC", date: "2020-01-01" },
    (async (u: string | URL | Request) => {
      const q = new URL(String(u)).searchParams.get("q") ?? "";
      dates.push(q.slice(-18, -8));
      return new Response(q.includes("2020-01-01") ? explore : results, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }) as typeof fetch,
  );
  assert.equal(r.class, "input", JSON.stringify(r));
  assert.deepEqual(dates, ["2020-01-01", "2020-01-01", "2027-04-15"]);
});

test("google-flights top: a fallback page for good args (Google sometimes serves one) is answered by a second try, not blamed on the args", async () => {
  const home = `<html><head><title>Find Cheap Flights Worldwide</title></head><body><script nonce="x">AF_initDataCallback({key: 'ds:1', hash: '1', data:[[null,null,0,"x"]], sideChannel: {}});</script></body></html>`;
  const results = fixture("google-flights", "search");
  let n = 0;
  const r = await callBundled(
    "google-flights",
    "top",
    { origin: "SFO", destination: "NYC", date: "2027-05-02" },
    (async () =>
      new Response(n++ === 0 ? home : results, {
        headers: { "content-type": "text/html; charset=utf-8" },
      })) as typeof fetch,
  );
  assert.equal(r.class, "ok", JSON.stringify(r));
  assert.match(r.reason ?? "", /a second try did/);
  assert.equal(n, 2, "no example request, no heal");
});

// ---------------------------------------------------------------- youtube

test("youtube search with the ad layout (VISITOR_INFO1_LIVE set) still returns every video and no {} items", () => {
  // the fixture: an ad, shelves and a continuation among the videos
  const got = ok(op("youtube", "search"), fixture("youtube", "search"), "text/html");
  assert.deepEqual(
    got.map((v) => v.id),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(got[0], { id: "a", title: "ta", channel: "c", views: "1 view" });
});

test("youtube captions: the local command carries the args, and its WebVTT comes back as text", () => {
  const o = op("youtube", "captions");
  const cmd = fillTemplate(o.local!.command, preparedValues(o, { id: "jNQXAC9IVRw" }));
  assert.ok(o.local!.command.includes("yt-dlp"), "captions is a local op");
  assert.ok(cmd.includes("'{id}'") === false && cmd.includes("'jNQXAC9IVRw'"), "the id fills the command");
  assert.ok(cmd.includes("'en'"), "the default language is en");
  // the response comes back as its whole body: a VTT text, not a JSON read
  const j = judge(o, { status: 200, headers: { "content-type": "text/plain" }, body: fixture("youtube", "captions") });
  assert.equal(j.class, "ok", j.reason);
  assert.match(j.data as string, /^WEBVTT\nKind: captions\nLanguage: en/);
  // the id accepts a bare id, a watch URL and a youtu.be link, and rejects the rest
  for (const v of [
    "jNQXAC9IVRw",
    "https://youtu.be/jNQXAC9IVRw",
    "https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PL",
  ])
    assert.ok(accepts(o.params.find((p) => p.name === "id")!, v), v);
  for (const v of ["jNQXAC9IVRwx", "https://example.com/watch?v=jNQXAC9IVRw", "x y"])
    assert.ok(!accepts(o.params.find((p) => p.name === "id")!, v), v);
  assert.ok(!accepts(o.params.find((p) => p.name === "lang")!, "en,de"), "one language per call");
});

// ---------------------------------------------------------------- linkedin

const entity = (title: string, url: string) => ({
  itemUnion: {
    entityResult: {
      title: { text: title },
      primarySubtitle: { text: "sub" },
      secondarySubtitle: { text: "sec" },
      navigationUrl: url,
    },
  },
});
const clusters = (...elements: unknown[]) => JSON.stringify({ elements, paging: { count: 10, start: 0 } });

test("linkedin searchPeople/searchCompanies collect results from whichever cluster holds them", () => {
  const upsell = { items: [{ itemUnion: { fifComponentCard: {} } }] };
  const feedback = { items: [{ itemUnion: { feedbackCard: { entityUrn: "x" } } }] };
  const people = ok(
    op("linkedin", "searchPeople"),
    clusters(
      upsell,
      { items: [entity("Reid Hoffman", "https://www.linkedin.com/in/reidhoffman?miniProfileUrn=x")] },
      feedback,
    ),
  );
  assert.deepEqual(
    people.map((p) => [p.name, p.url, p.publicId]),
    [["Reid Hoffman", "https://www.linkedin.com/in/reidhoffman?miniProfileUrn=x", "reidhoffman"]],
  );
  // no upsell card (a Premium account): the people are cluster 0 and still found
  assert.equal(ok(op("linkedin", "searchPeople"), clusters({ items: [entity("A", "u")] }, feedback)).length, 1);
  const companies = ok(
    op("linkedin", "searchCompanies"),
    clusters(
      { items: [{ itemUnion: { simpleTextV2: {} } }] },
      { items: [entity("Anthropic", "https://www.linkedin.com/company/anthropicresearch/")] },
    ),
  );
  assert.deepEqual(companies[0], {
    name: "Anthropic",
    subtitle: "sub",
    followers: "sec",
    url: "https://www.linkedin.com/company/anthropicresearch/",
    universalName: "anthropicresearch",
  });
  // no matches: LinkedIn answers no clusters at all
  assert.deepEqual(ok(op("linkedin", "searchCompanies"), clusters()), []);
  // results that moved out of entityResult are drift, not an empty "no results"
  const moved = judge(op("linkedin", "searchCompanies"), {
    status: 200,
    headers: {},
    body: clusters(feedback, { items: [{ itemUnion: { newResult: {} } }] }),
  });
  assert.notEqual(moved.class, "ok");
});

test("linkedin search keywords are percent-encoded once inside the Rest.li query (a double-encoded space finds no company)", () => {
  for (const name of ["searchPeople", "searchCompanies"]) {
    const url = buildRequest(op("linkedin", name), { keywords: "boston dynamics" }, noSession).url;
    assert.match(url, /query=\(keywords:boston%20dynamics,flagshipSearchIntent:SEARCH_SRP,/);
    const [kw] = rawParams("linkedin", name);
    assert.ok(accepts(kw!, "conan o'brien") && accepts(kw!, "Noah Hüsser"));
    for (const v of ["rust engineer, zurich", "a:b", "x (y)"])
      assert.ok(!accepts(kw!, v), `${v} would break the Rest.li query`);
  }
});

// ---------------------------------------------------------------- reddit

test("reddit search encodes the query in q= and hot puts the subreddit in the path segment", () => {
  const s = new URL(buildRequest(op("reddit", "search"), { query: "what is rust" }, noSession).url);
  assert.equal(s.pathname, "/search.json");
  assert.equal(s.searchParams.get("q"), "what is rust");
  const u = new URL(buildRequest(op("reddit", "hot"), { sub: "programming" }, noSession).url);
  assert.equal(u.pathname, "/r/programming/hot.json");
});

test("reddit recipes read the .json listing the site answers", () => {
  const got = ok(op("reddit", "search"), fixture("reddit", "search"));
  assert.deepEqual(
    got.map((p) => p.subreddit),
    ["r/linux", "r/linux"],
  );
  assert.deepEqual(got[0], {
    title: "Linux 6.15 is stable",
    url: "https://lwn.net/Articles/100001/",
    subreddit: "r/linux",
    author: "kernelwatcher",
    score: 1234,
    comments: 56,
    permalink: "/r/linux/comments/9k2q1f/linux_615_is_stable/",
    selftext: "",
    created_utc: 1761890000,
  });
  assert.equal(
    typeof got[1]!.selftext === "string" && (got[1]!.selftext as string).length > 0,
    true,
    "the self post carries its text",
  );
  const hot = ok(op("reddit", "hot"), fixture("reddit", "hot"));
  assert.deepEqual(
    hot.map((p) => [p.score, p.comments]),
    [
      [2400, 311],
      [640, 95],
    ],
  );
  assert.equal("subreddit" in hot[0]!, false, "the hot feed names no subreddit: it is in the path");
});

// ---------------------------------------------------------------- github

test("github ops put owner and repo in the api path; state defaults to open", () => {
  for (const [name, path] of [
    ["repo", "/repos/torvalds/linux"],
    ["readme", "/repos/torvalds/linux/readme"],
  ] as const) {
    const u = new URL(buildRequest(op("github", name), { owner: "torvalds", repo: "linux" }, noSession).url);
    assert.equal(u.origin, "https://api.github.com");
    assert.equal(u.pathname, path);
  }
  const issues = new URL(buildRequest(op("github", "issues"), { owner: "o", repo: "r" }, noSession).url);
  assert.equal(issues.pathname, "/repos/o/r/issues");
  assert.equal(issues.searchParams.get("state"), "open");
  const pulls = new URL(buildRequest(op("github", "pulls"), { owner: "o", repo: "r", state: "all" }, noSession).url);
  assert.equal(pulls.pathname, "/repos/o/r/pulls");
  assert.equal(pulls.searchParams.get("state"), "all");
});

test("github recipes read the api.github.com answers", () => {
  const repo = judge(op("github", "repo"), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: fixture("github", "repo"),
  });
  assert.equal(repo.class, "ok", repo.reason);
  const repoData = repo.data as Record<string, unknown>;
  assert.equal(repoData.full_name, "torvalds/linux");
  assert.equal(repoData.license_name, "MIT License");
  const readme = judge(op("github", "readme"), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: fixture("github", "readme"),
  });
  assert.equal(readme.class, "ok", readme.reason);
  assert.equal(
    Buffer.from((readme.data as Record<string, unknown>).content as string, "base64")
      .toString("utf8")
      .trim(),
    "# Linux kernel source tree",
  );
  const issues = ok(op("github", "issues"), fixture("github", "issues"));
  assert.deepEqual(
    issues.map((i) => [i.number, i.state, i.author]),
    [
      [1001, "open", "kernelpatcher"],
      [1002, "open", "storagecrew"],
    ],
  );
  const pulls = ok(op("github", "pulls"), fixture("github", "pulls"));
  assert.deepEqual(
    pulls.map((p) => p.merged_at),
    [null, null],
  );
});

// ---------------------------------------------------------------- notes

test("bundled notes: what every ops and list_operations call sends for a site stays short", () => {
  process.env.API_ANYTHING_HOME = HOME;
  for (const site of listSites()) {
    const sent = siteNotes(site) ?? "";
    assert.ok(
      sent.length <= 2000,
      `${site}.md sends ${sent.length} characters to every caller: move what only a maintainer needs under "## Maintainer notes"`,
    );
  }
});
