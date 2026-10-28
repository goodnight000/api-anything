Use a complete city slug copied from a FlixBus `/bus/` city link, such as `new-york-ny`, `boston-ma` or `philadelphia-pa`. Qualification covered these US pages only.

This is a published stop directory, not a dated departure's boarding-location guarantee. Check the travel ticket for the current boarding instructions. City directories include outlying stops; `locality` can retain the directory's city label even for a stop in another municipality. Use the street address, postal code and coordinates together. Postal codes are strings and can start with zero.

No dates, live departures, ticket availability or fares are returned. Missing cities and empty directories were not qualified.

getRouteGuide accepts a full route slug copied from a FlixBus /bus-routes/ link, including its bus- prefix. It returns the ordered guide questions and answerHtml. Answers can contain HTML links. Render them safely as website content.

FAQ fares, travel times, distances and first/last departures are advertised page claims. They are not date-specific quotes, live availability, verified timetables or booking guarantees. The overview cards and FAQ can report different figures; this operation returns the FAQ wording. No shopping or booking action is performed.

## Maintainer notes

Qualified signed out on 2026-10-26 UTC. `listStops(city)` learns GET `https://www.flixbus.com/bus/{city}` from the page's schema.org BusStop graph. The exact-GET document helper captured real browser responses and aborted other requests. Inline scripts may execute; this was not a fully hydrated GUI run.

Examples: `new-york-ny`, capture `cmvp5hxm1b0ab87`, 13 stops; `boston-ma`, capture `cmvp5jbib665439`, 3 stops. Both captures held zero cookies. The unseen `philadelphia-pa` tier-1 call returned 4 stops. Its separate document capture `cmvp5mvml48c7d3` matched all 4 rows against the frontend's separate map-directory array on names, addresses, locality labels, postal codes and coordinates. Stop headings matched all 4 names; each rendered country label was United States, matching `US`.

Final `verifySite` with `maxTier:1` passed the example and Boston/Philadelphia checks. These checks assert nonempty results; the independent semantic comparison is separate evidence. Export kept only harmless public examples. Reuse of the final export from an initially empty isolated home returned the same 4 Philadelphia rows at tier 1, with zero initial cookies and no Cookie request header. Direct `vetShared` over the final spec and these notes returned zero errors and warnings. The coordinator owns integrated repository checks.

Receipts: `bench/explore/state/discovery/intercity-film-r2/flixbus/` contains `comparison.json`, `verify.json`, `home/checks/flixbus.json`, `exported.json`, `export.json`, `fresh.json` and `vet.json`. Full qualification and resource limits are recorded in `docs/research/discovery/intercity-film-r2.md`. No authentication, booking, write or ticketing workflow was exercised.

## Route FAQ evidence

Qualified signed out on 2026-10-27 UTC. Actual exact-GET frontend document captures cmvqyw13r451592 and cmvqywwgade4aa5 cover New York to Boston and Boston to New York. The unchanged document helper aborted other requests; this is document-only evidence. Both captures contained zero cookies and their requests had no Cookie or Authorization header. Learning used both captures offline, without fetch, and emitted zero warnings. The read extracts FAQPage.mainEntity, preserving answer HTML.

The exact public-example export passed its first getRouteGuide call from an initially empty home at tier 1 for bus-new-york-ny-washington-dc, with Cookie and Authorization absent at fetch and the actual HTTP transport. Its 15 questions and 15 answer fields matched a separate frontend document capture cmvr000wc393f4b against the HTML FAQ accordion, including every answer link target. All six read cases passed in each of two isolated homes, with exact operation hashes preserved and no healing. Both homes retained zero guest cookies after verification. The source-probe guard had nine localhost controls; the exact-final operation guards passed 20 localhost controls. Final export scans and vetShared over this JSON and these notes reported zero issues. These checks qualify published guide content only. Receipts, hashes and limits are recorded in docs/research/discovery/flixbus-routes-qualified-r6.md.
