# Fandango discovery qualification r1

2026-10-28T08:51:04.994861+00:00. **ISSUES: one new operation passes the worker's API qualification gates; execution logging has a limitation.** `searchMovies(q)` is saved alongside unchanged `getMovie`, for two total reads and six passing saved cases. Parent-owned integrated registry, lint and type checks remain pending before the parent counts the addition. No publishing or Git mutation occurred.

Exclusive claim: `fandango-discovery-qualified-r1-20261028`. Work began at 2026-10-28T08:38:43.876097Z and completed within its twenty-minute bound. Writable outputs were limited to the assigned Fandango JSON, notes, this report and ignored evidence root. No nested delegation, CPU/memory check, recovery wait, source/dependency/existing-helper edit, state/runbook/old-receipt edit, private profile import or website write occurred.

## Scope and preservation

The starting JSON SHA-256 was `27ed3969815519573df14853d60102c7d9b9a4f75a28fb742072b439b90ebc4b`. Starting notes were `c4324fc65e101779e334ecc1bef77ac7aabf7480a973406570ace3ccec14a0b2`. `preservation.json` proves identical serialized original getMovie operation objects, including its full request, slot, response recipe, public example and two checks. Its three public cases remain Klara and The Sun, Wildwood and Clayface. No existing operation was wrapped under another name.

`preflight.json` audits the current focus, exclusive claim and recursive Fandango matches in host stops, aliases, parked sites and qualification issues. No matching stop existed before requests. UNIQLO, JustWatch and other brands were untouched. All eight frozen publication files and the approved manifest match their starting hashes in `manifest.json`.

## Actual source contract

The retained 2026-10-26 captures were audited offline before their links were used. Capture bodies exactly equal the retained HTML documents; URLs, statuses, capture timestamps and full SHA-256 hashes are in `retained-provenance.json`. These historical documents are navigation evidence, not fresh health evidence. They contain a public `/movies-in-theaters` link and a search form with action `/search`, default GET method, text input `q`, and hidden `mode=all`.

A fresh exact-document capture of Movies in Theaters confirmed that form and supplied actual movie links. Wicker was grounded there as `/wicker-2026-246507/movie-overview` before any Wicker search or detail output was inspected. The actual catalog also links `/movies-coming-soon`. That unrequested route remains a source lead, not an additional API. No third catalog route, title path, numeric suffix or query name was guessed. Search uses the observed form contract with a fixed `mode=all`, selecting only movie-section rows. Cities, theaters, videos and purchase controls are excluded.

`searchMovies(q)` returns movie titles, absolute overview URLs and the exact full `moviePath` segment for getMovie. It preserves frontend row order. The all-mode page is a preview of at most four movie matches, not an exhaustive catalog or a claim about ranking. Wildwood advertises six matches but supplies four on this page. Public matches can include double features or special screenings; a title match proves no screening time or ticket availability. No pagination, filters, empty search behavior or alternative search mode was qualified.

The two examples use q=Wildwood and q=Clayface. Each returns four rows, but every returned identity differs between the examples. Wildwood begins with Wildwood (2026), then its Fan First Screening, Wildwood, NJ (1994) and Wildwood Presents. Clayface begins with Clayface (2026), then three differently titled double features. `input-effect.json` records the complete ordered identities and links. The initial offline comparison mistakenly assumed Clayface would have one row; inspecting actual source established four. That assertion error made no request and changed no operation or core judgment.

## Genuine capture and learning

All three browser runs used unchanged `bench/discovery/capture-document.mjs` directly, an absolute isolated API_ANYTHING_HOME, the owned atomic global mutex, exact requested GET document only, and the existing 15-second runTrigger timeout. Other requests were aborted. Inline scripts could run and set guest cookies. This is frontend document capture, not a fully hydrated GUI. The catalog run's 17.061-second total includes browser launch and shutdown around the configured bounded trigger.

- catalog: `cmvrv7mjj1df90a` at 2026-10-28T08:41:13.183Z, `https://www.fandango.com/movies-in-theaters`, HTTP 200, request 1, 52 other requests aborted. Cookie sent: false; Authorization: false.
- searchA: `cmvrv8kjp69308c` at 2026-10-28T08:41:57.253Z, `https://www.fandango.com/search?q=Wildwood&mode=all`, HTTP 200, request 1, 61 other requests aborted. Cookie sent: true; Authorization: false.
- searchB: `cmvrv8x2hbf86f1` at 2026-10-28T08:42:13.481Z, `https://www.fandango.com/search?q=Clayface&mode=all`, HTTP 200, request 1, 61 other requests aborted. Cookie sent: true; Authorization: false.

`learn.json` records paired genuine A/B learning through addOperation with zero warnings, no unproven mark and minTier 1. Its empty captures list means the saved captures were supplied via from/from2, not that captures were absent. No HTTP response was fabricated into a browser exchange. Learning's fetch implementation refused any unexpected live learning probe.

The operation is a GET /search with a q query slot, fixed public mode=all, no volatile anchors, credential refs or public-constant waivers. The HTML recipe selects `#search-results-movies li.search__panel` and its title anchor. A picked URL regex extracts the full movie path including its numeric suffix. Its matcher is GET, www.fandango.com, /search.

## Exact-version gates

At 2026-10-28T08:44:39.375Z, the candidate metadata, three public search cases, draft notes and public export passed vetShared with ZERO errors and ZERO warnings, before unseen replay, cold reuse or verification. Export's secret and warning arrays were empty. Public examples were retained and response samples stripped.

At 2026-10-28T08:45:03.603Z, the unseen q=Wicker call returned four movie rows at tier 1, with no healing or truncation and no Cookie or Authorization. A separate cookie-free frontend-document GET at 2026-10-28T08:45:16.127Z supplies `independentSearch-1.html`. `compare-search.py` uses Python's HTMLParser rather than the core CSS extractor or learned pick regex. All three fields on all four rows, every movie identity and the complete order match exactly. The rows are Wicker (2026), The Wicker Man: The Final Cut, The Wicker Tree and The Wicker Man (1974). `unseen-comparison.json` retains the full comparison.

`handoff-grounding.json` takes Wicker's moviePath directly from that result. getMovie receives `wicker-2026-246507` unchanged. It returns Wicker (2026), runtime 105 minutes, R, release date 2026-10-23, Comedy,Drama and the matching canonical URL at tier 1. `independentDetail-1.html` is a separate cookie-free frontend GET. `compare-detail.py` reads labeled HTML and canonical link without the Movie JSON-LD recipe. All six fields match, including 1 hr 45 min and the advertised RELEASE DATE Friday, Oct 23, 2026. No cinema screening or inventory meaning is inferred.

At 2026-10-28T08:46:48.180Z, the new search operation's first call from its own initially EMPTY home containing only the exact final export passed at tier 1. `cold-initial.json` establishes emptiness, and `cold-1-request.json` proves the first send had neither Cookie nor Authorization. Its complete result equals the independently parsed unseen result. The five ordinary guest cookie names issued to the isolated home are akamai_location, userCountry, akamai_set_zip, userlocation and akamai_generated_location. Their values remain ignored. No private session was copied.

At 2026-10-28T08:46:58.232Z, verifySite reverified ALL reads on the modified final export: getMovie Klara example, Wildwood check and Clayface check; searchMovies Wildwood example, Clayface check and Wicker check. All SIX passed at tier 1, with six actual HTTP 200 sends. These later sends used only site-issued guest cookies from that cold home, and no Authorization. `verification-credential-summary.json` records that distinction. `verify-hashes.json` and the persistent home checks record match current operation hashes.

The final export after verify is byte-identical to the preflight, unseen and cold-home export. `final-export.json` records this and the unchanged original operation. Final exact saved JSON+notes vet at 2026-10-28T08:49:34.648Z returned ZERO errors and ZERO warnings. Caller notes are 1273 UTF-16 units before the exact `## Maintainer notes` heading. Integrated shared checks remain the parent's responsibility; none are claimed here.

## Hash manifest and stops

Final sites/fandango.json SHA-256: `9a4f3d049a6fad32deae511e59df73044fa799c7d384af5788b4c698e67b0203`.
Final sites/fandango.md SHA-256: `98c9dde17eca1f6628a58e0dd27abd875a818887727a79e7ea06da70f33622c8`.
Current opHash(getMovie): `712bb9c3adae9244`. Current opHash(searchMovies): `7ebe400b2f1e849c`. These are current-library hashes, not substituted historical receipt hashes.

All paths below are relative to ignored `bench/explore/state/discovery/fandango-discovery-qualified-r1-20261028/`. `manifest.json` contains exact source/capture and final-file hashes, plus frozen-file and approved-manifest preservation. `retained-provenance.json` separately records historical sources and their hashes. Raw documents, captures, guest jars and response bodies are only in the ignored root.

Every live qualification response went through a real core judgment before a subsequent send. Any non-ok judgment persists STOP.json across commands; fetch checks it before sending. Capture guard persists the same latch on any non-ok document judgment. Local-only guard controls proved HTTP 200 missing-data drift, HTTP 200 auth, challenge, rate and server-error judgments each persist a stop and prevent a next mock send. `guard-controls.json` is local control evidence, not frontend evidence. No real non-ok judgment or auth/rate/challenge/repeated origin error occurred, so no real consumer STOP was created. There were three browser document sends and eleven direct GET sends, fourteen real document requests total; no transport fallback, retry, heal or bypass ran.

## Ownership, cleanup and remaining issue

`exec-ledger.jsonl` records each owned long-running runner/helper launch with UTC timestamp, PID, command, home and exit. `tool-sessions.jsonl` records asynchronous exec sessions. Each capture acquired the global directory mutex and released only its own owner token after its helper and guard exited. The helper closed its own browser. All recorded helper PIDs exited; the final audit found no isolated browser profile process and no global mutex. No signal was sent or unrelated program stopped. Isolated evidence homes are retained.

The logging limitation is explicit: initial short read-only shell commands were not individually stamped with shell PIDs, and Chrome descendant PIDs were not sampled while the browser was alive. Owned runner/helper PIDs and asynchronous sessions were recorded, and no browser remained at cleanup, but this does not fulfill a literal every-process PID receipt requirement. This is why the worker reports ISSUES despite the operation gates passing. No receipt was fabricated to fill the gap.

No further website requests are needed for this candidate. Qualified additions: one; total saved reads: two; passing cases: six. Missing integration gates: parent-owned registry/lint/type audit before counting. Remaining workflow gaps: exhaustive movie search, now-playing/upcoming catalog APIs, pagination and empty results. The observed upcoming link alone is not counted.
