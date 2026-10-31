# Netflix and Disney+ source preparation

Date: 2026-10-26 UTC. Verdict: **ISSUES** for research preparation. Both services have grounded public title examples and linked third candidates. Supported anonymous catalog API access and reusable operations remain unproven. Zero captures, learned operations or specs. Do not increase catalog counts.

## Scope and evidence

Read AGENTS.md, the discovery runbook, coordinator state, next-candidate notes and the prior video/marketplace source-preparation report. State assigns only Netflix and Disney+ to this worker. The coordinator owns catalog/state changes and local validation.

All remote research used `tools.mcp__codex_apps__search_service_web_run`. “Fetched primary” below means its remote open/click returned an official page, possibly cached. It does not establish current origin HTTP status, local signed-out behavior, a captured exchange or a working API. “Indexed” means search results only. No third-party reverse-engineering package was used as evidence.

Only this report was written locally. No local browser/network commands, API replays, playback, accounts, cookies, site writes, proxy changes, agents, source/dependency/shared-state changes or publication. No monitor work or monitor reuse. Local activity was inexpensive file inspection and this report write; no expensive workload or resource-threshold exception was used.

## Supported-access screen

**Netflix:** Bounded searches did not establish current official documentation for a readily usable public catalog API. Historical shutdown reporting appeared in search results, but no current first-party retirement notice was fetched. Therefore “no supported API exists” is not a verified finding. The [official second-half 2025 engagement report](https://about.netflix.com/en/news/what-we-watched-the-second-half-of-2025?pubDate=20260124) was **indexed**, with a downloadable report and historical viewing metrics. Prefer that supported publication for historical popularity questions. It does not establish current localized synopsis, cast or title-page discovery access. No spreadsheet or runtime API was requested.

**Disney+:** The [Disney Streaming Media Metadata Feed specification](https://specs.disneystreaming.com/media-metadata-feed/spec.html) was **fetched primary**. Its introduction explicitly targets streaming-service partners. It describes catalog pagination and content metadata, but public documentation alone does not supply anonymous feed access or general developer eligibility. No partner-feed URL was requested. Partner prerequisites described by documentation are not an observed auth wall. This supported route should be preferred by an eligible partner; readily usable access for this task remains unestablished.

The remaining useful question is narrow: given a public title link, what identity, synopsis, genres and credited people does the service advertise? Public linked-title discovery may also help. Full catalog enumeration, arbitrary search, recommendations, regional availability and playback are outside the demonstrated evidence.

## Netflix

All following pages were **fetched primary** on the date above. The first two exact URLs came from indexed official title pages, without invented IDs.

- Example A, film: [The Sea Beast](https://www.netflix.com/title/81018682?pubDate=20250721). Returned title identity, displayed year 2022, PG label, synopsis, credited actors, genres and labeled audio/subtitle lists. This is a useful contrast with an episodic title. Trailer and teaser durations also appear, so a generic duration extractor would mislabel them as film runtime.
- Example B, series: [Stranger Things](https://www.netflix.com/title/80057281?fromWatch=true). Returned title identity, displayed year 2025, five-season label, TV-14 label, creators, cast, genres and episode summaries. Treat the displayed year as the page's year label, not a verified original-series premiere. The episode list was the initially displayed season; neither all-season completeness nor season selection was exercised.
- Reserved third: [My Father's Dragon](https://www.netflix.com/title/80178603), obtained by following the named recommendation link on The Sea Beast. The tool returned an HTML page. Reserve it from learning for later local semantic comparison; remote discovery of this page is not unseen replay proof.

Useful candidate inputs are exact public title URLs or observed title IDs, without interpreting the numeric identifier beyond its association with that title route. Candidate outputs are title, displayed year label, synopsis, rating label, genres, credited cast and optional creators/season count. Audio and subtitles need locale/context qualification before inclusion. “Available to download” is advertising text, not evidence of an account entitlement or available downloadable media.

The recommendation link grounds discovery of one related title. It does not prove stable ranking, personalization semantics, exhaustive recommendations or a search endpoint. No bundle or hidden request endpoint was inspected or inferred.

## Disney+

All following pages were **fetched primary** on the date above. The first two came from indexed official pages. Exact source query strings are retained for provenance; no private browser state supplied them.

- Example A, series: [The Mandalorian](https://www.disneyplus.com/browse/entity-422f6dcc-226f-44e7-98d4-22de69b31cf3?v=var1). Returned identity, synopsis, displayed range 2019–2023, three-season label, TV-14 label, genres, creator and cast. Its category was Series. The year range is not a promise about future seasons or present account availability.
- Example B, film: [Frozen](https://www.disneyplus.com/browse/entity-04c97b72-504b-47f2-9c6f-fe13d9aea82f?msockid=11734011c9b8602d33cb56c8c8f961c2). Returned identity, synopsis, release-year label 2013, duration 1h 46m, PG label, genres, directors and cast. Its category was Movies. The movie/series pair tests genuinely different optional fields.
- Reserved third: [Moana 2](https://www.disneyplus.com/browse/entity-a21ee2fc-421e-4839-bfcc-0bf2ba815875), followed from The Mandalorian's named footer link. Returned film metadata. Reserve it from learning for later local semantic comparison. A footer promotion is not a related-title recommendation.

Candidate inputs are observed public entity links; the UUID-shaped route must not be equated with the partner-feed item/series identifiers without evidence. Candidate outputs are title, category, synopsis, displayed release label, genres, rating label, cast and optional directors/creator, runtime or season count. Ratings and accessibility indicators were image labels; later extraction must preserve their meaning. A series range and a movie year need distinct handling.

The pages advertise subscription plans alongside metadata. Plan prices are not title prices. No plan, login, subscription or playback control was selected. The pages warn that content/platform availability varies by region; no region guarantee follows. No locale/region route was tried to obtain different access.

## Controls, missing proof and continuation

No response exposed an auth wall, bot challenge, 403 or 429. Netflix join forms and Disney+ login/signup links coexisted with readable metadata; they did not demand authentication to read the observed fields. No controls were bypassed. Search results about historical API errors describe past policy, not a restriction encountered in this run. No previously stopped film domain was opened.

Readable remote documents suggest HTML extraction may suffice. This is an **inference**; browser-only dependence and anonymous tier-1 reuse are unverified. The project's browser capture is still required to establish frontend provenance. No document-capture resource exception is earned from this remote extraction alone, and unknown catalog routes are not proven APIs.

After normal local admission, the parent can capture only the two exact public detail examples per service, stop on any restriction, then learn a metadata operation. Reserve the linked third from learning, independently compare its identity and field meanings during semantic replay, and establish locale and optional-field behavior. Real frontend capture, two-example learning, unseen semantic replay, verify, fresh cookie-free reuse, export and shared vet all remain missing. No site is ready for registry inclusion.
