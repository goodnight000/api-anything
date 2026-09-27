/** Bundled site specs: their recipes against trimmed copies of the live responses, and their param rules. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSite, type Operation } from "../src/spec.ts";
import { judge } from "../src/classify.ts";
import { buildRequest } from "../src/http.ts";
import type { StoredCookie } from "../src/types.ts";

const raw = (site: string) => JSON.parse(readFileSync(new URL(`../sites/${site}.json`, import.meta.url), "utf8"));
const op = (site: string, name: string): Operation => parseSite(raw(site)).operations.find((o) => o.name === name)!;
const rawParams = (site: string, name: string): { name: string; pattern?: string; hint?: string }[] =>
  raw(site).operations.find((o: { name: string }) => o.name === name).params;
const noSession = { cookies: [] as StoredCookie[], values: {} as Record<string, string> };
const ok = (o: Operation, body: string, contentType = "application/json") => {
  const j = judge(o, { status: 200, headers: { "content-type": contentType }, body });
  assert.equal(j.class, "ok", j.reason);
  return j.data as Record<string, unknown>[];
};
// A spec's param pattern is a whole-value JS regex.
const accepts = (p: { pattern?: string }, v: string) => new RegExp(p.pattern!).test(v);

// ---------------------------------------------------------------- google-flights

// one real "other flights" item (SFO->EWR via ATL), legs and booking token trimmed
const flight = (price: number, to: string) => [
  ["F9", ["Frontier"], [], "SFO", [2026, 10, 21], [22, 14], to, [2026, 10, 22], [10, 33], 559, 1, null, 0,
    [[129, "ATL", "ATL", null, "Hartsfield-Jackson Atlanta International Airport", "Atlanta"]]],
  [[null, price], "tok"],
];
const flightsPage = (top: unknown[], other: unknown[]) =>
  `<html><script nonce="x">AF_initDataCallback({key: 'ds:0', hash: '1', data:[[null,null,0,"x"]], sideChannel: {}});</script>` +
  `<script nonce="x">AF_initDataCallback({key: 'ds:1', hash: '9', data:${JSON.stringify([
    [null, [[1, 2, 3]]],
    [[[[["SFO", 0], "San Francisco International Airport"]], [[["/m/02_286", 4], "New York"]]]],
    [top],
    [other],
  ])}, sideChannel: {}});</script></html>`;

test("google-flights search/top read the results the page embeds, so a metro code like NYC returns flights", () => {
  const body = flightsPage([flight(219, "EWR")], [flight(149, "EWR"), flight(204, "LGA")]);
  const other = ok(op("google-flights", "search"), body, "text/html; charset=utf-8");
  assert.deepEqual(other.map((f) => [f.price, f.to]), [[149, "EWR"], [204, "LGA"]]);
  assert.deepEqual(other[0], {
    airline: ["Frontier"], price: 149, from: "SFO", to: "EWR", departureDate: [2026, 10, 21], departureTime: [22, 14],
    arrivalDate: [2026, 10, 22], arrivalTime: [10, 33], durationMinutes: 559,
    stops: [[129, "ATL", "ATL", null, "Hartsfield-Jackson Atlanta International Airport", "Atlanta"]],
  });
  assert.deepEqual(ok(op("google-flights", "top"), body, "text/html; charset=utf-8").map((f) => f.price), [219]);
});

test("google-flights search sends the places as free text in q=, which Google resolves (NYC, a city name)", () => {
  for (const name of ["search", "top"]) {
    const u = new URL(buildRequest(op("google-flights", name), { origin: "SFO", destination: "New York", date: "2026-10-21" }, noSession).url);
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
  const payload = [[null, [[1]], 0, "x", "y"], [["2026-11-01", null, [[null, 185], "t1"], 1], ["2026-11-02", null, [[null, 120], "t2"], 1], ["2026-11-03", null, null, 1]]];
  const body = `)]}'\n\n123\n${JSON.stringify([["wrb.fr", null, JSON.stringify(payload)]])}\n`;
  assert.deepEqual(ok(o, body), [{ date: "2026-11-01", price: 185 }, { date: "2026-11-02", price: 120 }, { date: "2026-11-03" }]);
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

// ---------------------------------------------------------------- youtube

const video = (id: string) => ({ videoRenderer: { videoId: id, title: { runs: [{ text: `t${id}` }] }, ownerText: { runs: [{ text: "c" }] }, viewCountText: { simpleText: "1 view" } } });
test("youtube search with the ad layout (VISITOR_INFO1_LIVE set) still returns every video and no {} items", () => {
  const data = {
    contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [
      { itemSectionRenderer: { contents: [{ searchPyvRenderer: { ads: [] } }, { shelfRenderer: {} }, video("a"), video("b")] } },
      { adSlotRenderer: { slotId: "1" } },
      { itemSectionRenderer: { contents: [video("c"), { reelShelfRenderer: {} }, video("d")] } },
      { continuationItemRenderer: {} },
    ] } } } },
  };
  const got = ok(op("youtube", "search"), `<script>var ytInitialData = ${JSON.stringify(data)};</script>`, "text/html");
  assert.deepEqual(got.map((v) => v.id), ["a", "b", "c", "d"]);
  assert.deepEqual(got[0], { id: "a", title: "ta", channel: "c", views: "1 view" });
});

// ---------------------------------------------------------------- linkedin

const entity = (title: string, url: string) => ({ itemUnion: { entityResult: { title: { text: title }, primarySubtitle: { text: "sub" }, secondarySubtitle: { text: "sec" }, navigationUrl: url } } });
const clusters = (...elements: unknown[]) => JSON.stringify({ elements, paging: { count: 10, start: 0 } });

test("linkedin searchPeople/searchCompanies collect results from whichever cluster holds them", () => {
  const upsell = { items: [{ itemUnion: { fifComponentCard: {} } }] };
  const feedback = { items: [{ itemUnion: { feedbackCard: { entityUrn: "x" } } }] };
  const people = ok(op("linkedin", "searchPeople"), clusters(upsell, { items: [entity("Reid Hoffman", "https://www.linkedin.com/in/reidhoffman?miniProfileUrn=x")] }, feedback));
  assert.deepEqual(people.map((p) => [p.name, p.url]), [["Reid Hoffman", "https://www.linkedin.com/in/reidhoffman?miniProfileUrn=x"]]);
  // no upsell card (a Premium account): the people are cluster 0 and still found
  assert.equal(ok(op("linkedin", "searchPeople"), clusters({ items: [entity("A", "u")] }, feedback)).length, 1);
  const companies = ok(op("linkedin", "searchCompanies"), clusters({ items: [{ itemUnion: { simpleTextV2: {} } }] }, { items: [entity("Anthropic", "https://www.linkedin.com/company/anthropicresearch/")] }));
  assert.deepEqual(companies[0], { name: "Anthropic", subtitle: "sub", followers: "sec", url: "https://www.linkedin.com/company/anthropicresearch/" });
  // no matches: LinkedIn answers no clusters at all
  assert.deepEqual(ok(op("linkedin", "searchCompanies"), clusters()), []);
  // results that moved out of entityResult are drift, not an empty "no results"
  const moved = judge(op("linkedin", "searchCompanies"), { status: 200, headers: {}, body: clusters(feedback, { items: [{ itemUnion: { newResult: {} } }] }) });
  assert.notEqual(moved.class, "ok");
});

test("linkedin search keywords are percent-encoded once inside the Rest.li query (a double-encoded space finds no company)", () => {
  for (const name of ["searchPeople", "searchCompanies"]) {
    const url = buildRequest(op("linkedin", name), { keywords: "boston dynamics" }, noSession).url;
    assert.match(url, /query=\(keywords:boston%20dynamics,flagshipSearchIntent:SEARCH_SRP,/);
    const [kw] = rawParams("linkedin", name);
    assert.ok(accepts(kw!, "conan o'brien") && accepts(kw!, "Noah Hüsser"));
    for (const v of ["rust engineer, zurich", "a:b", "x (y)"]) assert.ok(!accepts(kw!, v), `${v} would break the Rest.li query`);
  }
});
