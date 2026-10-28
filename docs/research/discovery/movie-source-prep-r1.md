# Movie source preparation round 1

2026-10-26 UTC. **ISSUES for research preparation.** JustWatch has grounded country-specific availability pages and useful offer distinctions. Fandango has grounded city, cinema and movie pages, but remote documents did not resolve showtimes. Both remain capture candidates, not reusable operations.

## Scope and evidence

Remote research used only `mcp__codex_apps__search_service_web_run`. Local work was inexpensive file reading and this report write. No local browser, local network command, API replay, login, cookie import, site write, nested agent, spec, shared-state edit, dependency change or publication occurred. No raw evidence was saved. CPU/memory was not measured in this preparation pass; no claim about machine-wide peaks is made.

Read `AGENTS.md`, `bench/discovery/README.md`, the design's capture/learning rules, contributing guidance, the repository API Anything skill, `movie-availability-r1.md`, and relevant sections of `bench/discovery/state.json`. The prior batch sent zero website requests. Current state assigns these two sites to this preparation batch and records their prior resource deferral. The parent still owns state and local admission.

Evidence labels below distinguish **remote primary** pages opened through the remote tool, **indexed lead** search results, **inference**, and **unverified** behavior. Remote open output sometimes reports a cached crawl date. It is not a raw origin receipt, browser capture, session audit or proof of current frontend requests. All listed sources were consulted on 2026-10-26 UTC.

## JustWatch

Useful questions are where a named film is available in a chosen country, which provider carries it, and whether an offer requires a subscription, rental, purchase or ads. Country comparison is more useful than another generic metadata lookup.

Remote primary sources:

- [US Dune: Part Two](https://www.justwatch.com/us/movie/dune-part-two-2023), discovered in search, identifies the film as 2024 and displays United States, subscription/rent/buy/cinema/disc categories, format and price labels, provider names in its availability summary, and a provider-check timestamp. The slug's year is not the release year. Its US subscription summary includes HBO Max services. A separate promotion offers similar films, which must not become an availability result for this film.
- [UK Dune: Part Two](https://www.justwatch.com/uk/movie/dune-part-two), discovered independently in search, identifies the same film and displays United Kingdom, pound-denominated prices, and Netflix subscription availability. The indexed result instead described Amazon availability and older timestamps. Use the opened page as preparation evidence, not the indexed provider list as current truth. Do not derive the UK path by replacing `/us/`; the slugs differ.
- [US Memento](https://www.justwatch.com/us/movie/memento), followed from the US Dune page's chart link, identifies the 2000 film. Its offer list distinguishes free, free with ads, subscriptions and trials, alongside rent/buy and physical media. This is a useful second title because its monetization coverage differs. Provider playback was not opened, so account, library or territorial eligibility remains unknown.

Official API suitability is partly resolved. [Content partner documentation](https://apis.justwatch.com/docs/content_partner/) describes title identity, offers, provider catalogues, country/locale and currency. Offer dimensions include price/currency, monetization, presentation format, provider identity and a provider link. [API documentation](https://apis.justwatch.com/docs/api/) says partners receive a required token after concluding a contract. This is an official integration, but not demonstrated as a readily usable anonymous API. No API request or token acquisition was attempted. Public frontend capture remains useful for country/provider/price questions without partner onboarding. If the parent already has licensed API access, prefer it.

Semantics to preserve during later capture:

- Viewing country differs from production country and language. The same title has distinct country pages and offers. Official locale names need not equal frontend path segments.
- Subscription price is a recurring plan charge, not a per-film rental. A trial is not unconditional free viewing. Separate ads, free, bundle, physical disc and cinema from digital rental/purchase. UI-to-wire enum mapping remains unverified.
- Preserve provider and channel identity, format, currency and billing period. Do not map a channel to its parent provider or merge promoted and ordinary cards without evidence.
- The provider-check timestamp is freshness information, not a caller-selected availability date. Its timezone is not established. Future/historical availability queries and exact release-date precision are unverified. Do not promise an `asOf` parameter.

Grounded continuation: start from the sourced US Dune and Memento pages for differing title examples. Compare US and UK Dune as a separate country test. Choose an additional title through an actual frontend link for the unseen local replay. Capture the document first if it contains the answer; inspect only requests the real frontend emits if it does not. Search input/query encoding, provider filter encoding, stable identity fields, response selectors and pagination are still unverified. No endpoint template or frontend bundle was established.

## Fandango

Useful questions are which public cinemas serve a named city, which films a cinema lists for a chosen date, and which public screening formats/times a movie has. Exclude personal location, favorites, notification signup, seats, holds, purchases and streaming playback.

Remote primary sources:

- [San Francisco city page](https://www.fandango.com/san-francisco_california_movietimes), discovered in search, exposes city/state/ZIP search and theater-chain choices. The opened document has a blank location heading and loading calendar, not resolved nearby cinemas. This is incomplete rendering, not proof of zero screenings. Its indexed lead displayed an October 22 through November 9 calendar, so those dates must not be treated as today's availability.
- [AMC Metreon 16](https://www.fandango.com/amc-metreon-16-aanem/theater-page), discovered in search, establishes the named public cinema and San Francisco address. Its calendar and format filters remained loading. Its nearby-theaters link led to [this city URL](https://www.fandango.com/san%2Bfrancisco_ca_movietimes), also opened. Preserve that sourced encoding until a real frontend capture establishes input handling; do not invent a city URL encoder or cinema ID.
- [Klara and The Sun movie page](https://www.fandango.com/klara-and-the-sun-2026-246291/movie-overview), followed from the first city page's featured-film link, establishes a movie identity and release-date metadata. Its showtime calendar and format filters also remained loading. A release date does not establish a particular cinema's screening date or ticket availability.

Inference: local frontend capture may be needed to populate date/location-dependent data. Remote text extraction alone cannot establish whether missing data reflects JavaScript rendering, region defaults or another cause. No showtime transport, response schema, timezone, currency, pricing or live inventory semantics were observed.

A bounded official-domain API search returned old streaming-forum discussions and affiliate material, not current public cinema-showtime API documentation. These are indexed leads only and do not prove absence of an official API. No readily usable official cinema API was established. Browser-only preparation remains useful because the actual public calendar/format controls are grounded, but API suitability remains an open question.

Grounded continuation: begin at AMC Metreon, select two displayed public calendar dates without opening a showtime's ticket flow, then use another displayed date as the unseen argument. Learn a second cinema only through actual public frontend links. Verify cinema identity, selected date and screening list together. Determine local-time/DST and after-midnight service-date behavior from captured evidence before documenting them. Treat loading, empty results and unavailable dates as different outcomes. Do not append a guessed date query string or probe a guessed API.

## Controls and missing proof

No auth wall, challenge, HTTP 403 or HTTP 429 was reported for these researched public pages. Passive sign-in links, watchlist copy and purchase promotions appeared; none was followed. Contract/token requirements in API documentation are documented access requirements, not an attempted API authentication failure. No alternate host was used to evade a control. Remote results do not prove future local admission or signed-out local access.

Both sites still require real frontend capture, two differing captured examples, an unseen semantic replay, verification, export, fresh-home reuse and `vetShared` plus the parent's focused registry validation. No operation has passed any of these gates. Stop immediately if later work encounters auth, a challenge, 403 or 429; the parent controls whether and when resource-admitted local work starts.
