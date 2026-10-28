# Ticket discovery round 1

Result: **ISSUES**. Ticketmaster passed and contributes one reusable public read. SeatGeek and StubHub were blocked on their first requests. They were attempted in that order on 2026-10-26 UTC. No account actions, seat holds, purchases, queue access, presale access, browser-cookie imports, login, access-control workarounds, or nested workers occurred.

The only registry additions are `sites/ticketmaster.json` and `sites/ticketmaster.md`. Other site files, shared discovery state, runbook, catalog, source and dependencies were left untouched. No commits, push, PR, publication, or integrated checks were performed. The parent owns integration.

## Ticketmaster: PASS

Operation: `searchEvents(q: string)`. Input is the keyword entered into the public Artist, Event or Venue search box. The operation returns the first relevance-sorted page, currently up to 20 event records. It does not cover pagination, filters, exhaustive venue discovery, or a separate event-detail endpoint.

Returned fields and meaning:

- `id`, `title`, `url`: event identity, displayed event name, and event link. A link may point to a partner website; this operation does not follow it.
- `startDate`, `timeZone`: UTC event timestamp and the venue's IANA time zone. Convert the timestamp using that zone to get the displayed local event date.
- `venueName`, `city`, `state`, `country`: venue name and location; state and country are short codes.
- `cancelled`, `postponed`, `rescheduled`, `tba`: event status flags, not live ticket availability. `tba` describes an announced date/time limitation.

The source homepage, https://www.ticketmaster.com/ , returned HTTP 200 at 10:08:29.719745Z and exposed a GET form with action `/search` and input `q`. Public artist links supplied the Metallica, Hamilton and Eagles choices. HTTP research of https://www.ticketmaster.com/search?q=Metallica returned 200 at 10:08:44.909159Z and established the embedded response recipe before browser capture.

Actual browser frontend GET document captures:

- `cmvp3ht588e9857`, https://www.ticketmaster.com/search?q=Metallica , document request ID 1, HTTP 200. There were 55 captured exchanges and 54 aborted resources.
- `cmvp3ic7qf98d3e`, https://www.ticketmaster.com/search?q=Hamilton , document request ID 1, HTTP 200. There were 60 captured exchanges and 59 aborted resources.

The repository's experimental `capture-document.mjs` allowed only the requested GET document and aborted other requests. Both captures completed and their owned mutex was released after the command exited. This proves document capture, not a fully hydrated GUI. The operation reads the fulfilled `searchEvents` JSON payload embedded in the document's Next.js Redux state. It stores no developer key, session ref or Cookie header. The public frontend required no developer credential. Ticketmaster's separate developer API was not used.

The two-example source CLI add completed with zero warnings and `minTier: 1`. An earlier CLI invocation incorrectly encoded the match as one comma-delimited host value and skipped the two-run diff. It was replaced using a structured match object and the same real captures; only the corrected, warning-free result was accepted.

Unseen input `q=Eagles` returned 20 events at tier 1 without healing. Independent grounding was a separate cookie-free HTTP GET of https://www.ticketmaster.com/search?q=Eagles at 10:11:45.388202Z, HTTP 200. The comparison parsed the whole document's `__NEXT_DATA__` independently of the operation's embedded regex and separately inspected its 20 rendered event cards through `parseShown`, which removes hidden/template/script content. All 20 IDs and all 13 returned fields matched by ID. Every card also matched its returned event title, city, venue name, and the local date derived from `startDate` plus `timeZone`. Relevance order differed between requests, so the comparison matched identities rather than promising fixed ranking.

Example identity: `17006484FED11E2C`, Eagles Live at Sphere, Sphere in Las Vegas, NV, US, `2026-11-14T04:30:00Z`, `America/Los_Angeles`, displayed local date `11/13/26`. Partner suite-reservation event metadata was also present in the public results; no reservation or partner request was made.

The initially empty browser home had no imported session or login. The learner's guest-cookie heuristic initially recorded `learnedLoggedIn: true`; this metadata was corrected to false, followed by a final verification and export. The actual `verifySite('ticketmaster', {maxTier: 1, timeoutMs: 15000})` runner passed the Metallica example and Hamilton/Eagles result checks, three passes, zero failed/inconclusive cases, all tier 1. The source CLI exported the final spec with public examples retained and zero export warnings.

A different initially empty home, `ticketmaster-fresh-searchEvents/`, received only the exported spec before its call. It issued exactly one tier-1 Eagles request. A fetch hook asserted no outbound Cookie header; all event IDs and field values matched the earlier unseen replay, allowing order changes. Response guest cookies created a session file afterwards; no prior cookies or browser profile were copied. Direct `vetShared(parseSite(export), finalNotes)` returned `errors: []`, `warnings: []` before acceptance and again after the final prose correction.

Raw evidence base is ignored `bench/explore/state/discovery/tickets-r1/`. Important receipts and reproducers:

- `ticketmaster/home/captures/<captureId>.json`, `ticketmaster-capture1.stdout.json`, `ticketmaster-capture2.stdout`.
- `ticketmaster-add-fixed.stdout`, `ticketmaster-unseen.stdout`.
- `ticketmaster-search-eagles.{json,html}`, `compare-ticketmaster-visible.mjs`, `ticketmaster-unseen-comparison.json`.
- `finalize-ticketmaster.mjs`, `ticketmaster-finalize-final.stdout`, `ticketmaster-verify.json`.
- `ticketmaster-export-final.stdout`, `ticketmaster-export.json`.
- `accept-ticketmaster.mjs`, `ticketmaster-accept.stdout`, `ticketmaster-fresh-reuse.json`.
- `audit.mjs`, `ticketmaster-vet-final.json`.

No empty-result, invalid-input, pagination, alternative locale, date-filter, ticket inventory, price, or separate venue-detail behavior was qualified. Capture repair behavior was not exercised.

## SeatGeek: BLOCKED

First and only request: https://seatgeek.com/ at 10:13:52.517309Z, HTTP 403, 780 bytes. Offline repository `botWall` classification returned `DataDome challenge page (HTTP 403)`. Response SHA-256: `cf80c28204d587e5487c900b86103ebd9afd579f30867c2c31fb46681830c898`.

Stopped immediately. No browser capture, alternative host/route, frontend search, API request, login or challenge interaction followed. The frontend's public operation inputs and developer API credential requirements remain unverified; no developer credential was requested or used. No spec, notes or fabricated captures were produced. Receipts: `seatgeek-root.{json,html,stdout,resources.jsonl}` and `classified.json` under the evidence base.

## StubHub: BLOCKED

First and only request: https://www.stubhub.com/ at 10:13:58.353798Z, HTTP 403, 773 bytes. Offline repository `botWall` classification returned `DataDome challenge page (HTTP 403)`. Response SHA-256: `61e0659c6115fa4042b7f46e256465be44b803168bea18f53420d4f173926a07`.

Stopped immediately. No browser capture, alternative host/route, frontend search, API request, login or challenge interaction followed. Developer API credential requirements remain unverified because this batch did not inspect the separate developer service. No developer credential was requested or used. No spec, notes or fabricated captures were produced. Receipts: `stubhub-root.{json,html,stdout,resources.jsonl}` and `classified.json`.

Neither blocked site has two frontend examples, an unseen replay, identity comparison, verification, export, fresh reuse, or shared vet result. Do not treat them as qualified coverage or automatically retry them in the next batch.

## Resources and cleanup

All website, browser, learning, replay, verification, export and direct vet commands ran under `resource_gate.py`. Browser/initial HTTP work used defaults, CPU admit 65%, memory admit 88%, CPU stop 85%, memory stop 90%. Bounded browser-free tier-1 work used the allowed memory admit 89%, stop 90%, with unchanged CPU thresholds.

The first command was denied three times before the third allowed 30-second resample admitted it. The first learning command was denied once, waited 30 seconds, then admitted. There were no site requests during those waits. These were four admission denials, with no owned process started on denial. There were no watchdog stops. The global browser mutex was busy once, so no competing browser was launched.

Across 34 retained resource samples, peak CPU was **45.47%** and peak policy memory was **89.73%**, the latter on a denied admission. Raw occupied RAM separately peaked at **99.69%**; this batch does not claim raw occupied RAM stayed below 95%. The runbook's policy metric excludes file-backed cache. Host sampling cannot guarantee unsampled peaks or constrain unrelated applications. Exact samples and source log names are in `resources-summary.json`.

Final owned-process census at 10:14:34.797496Z found no process using this batch's absolute home paths. The browser mutex and this batch's ownership token were absent. All owned commands exited; no unrelated process was stopped. Initially empty homes for SeatGeek and StubHub remain empty. Ignored captures, guest-session data and raw receipts remain for parent inspection. Cleanup receipt: `cleanup.json`.
