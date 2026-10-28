# Priceline and Megabus source preparation

UTC date: 2026-10-26. Remote research window: approximately 19:25-19:27 UTC. Batch `travel-broad-source-prep-r4`; eight-minute maximum, two assigned sites, no delegation.

Source-only result: two opened, source-linked detail examples per site. No candidate spec, registry addition or counted operation. Megabus is the stronger metadata lead. Priceline already provides an on-site travel agent, while its partner documentation remained unreadable through the permitted tool. Neither site's anonymous programmatic access was qualified.

## Scope and evidence

Read the discovery README and current state, DESIGN, CONTRIBUTING and repository skill. Parent retains state/shared-file ownership. The supplied launch-only snapshot was 19:23:53 UTC, CPU 44.39%, policy memory 89.23%, admission 90%, no child. It was not resampled or treated as local workload authorization.

All website access used `mcp__codex_apps__search_service_web_run`, through search, open and click. The outcomes below are remote-tool text extraction of public sources, sometimes explicitly crawler-cached. They are neither rendered frontend observations nor browser exchanges. Origin HTTP status/headers, signed-out cookie behavior and freshness were not exposed. No local network/browser/runtime, forms, bookings, account imports, or website writes were used. Individual reviewers, contacts and street addresses are excluded from this report.

## Official overlap screened first

### Megabus

Opened [official distribution announcement](https://us.megabus.com/press-releases/megabus-distribusion), then [route directory](https://us.megabus.com/route-guides), during approximately 19:25:09-19:25:38 UTC. Both returned readable text/html source text without a reported access control. The announcement, dated October 5, 2023, describes a Distribusion integration for travel retailers, including search, fulfilment and settlement, and a GTFS integration for Google distribution. This is B2B overlap, not documentation of a keyless consumer API or a publicly downloadable current feed. Partner approval, credentials, present coverage, public station/route metadata equivalence and runtime are unknown. Bounded official-domain API/MCP/ChatGPT searches did not establish a public agent connector; absence is not proved. No listed external distribution partner was traversed.

### Priceline

Opened [consumer homepage](https://www.priceline.com/), then its footer link 377, "Priceline Partner Solutions", to [official partner site](https://pricelinepartnersolutions.com/), approximately 19:25:09-19:25:59 UTC. The partner site returned a one-line JavaScript shell: `You need to enable JavaScript to run this app.` This is an extraction limitation, not an observed HTTP auth/bot/rate response. No alternate browser or transport was attempted.

Opened [Penny Voice announcement](https://press.priceline.com/pennyvoice/) and [Ramp partnership announcement](https://press.priceline.com/ramp/) by 19:25:59 UTC. Penny is an official consumer-facing conversational hotel/destination assistant inside Priceline web/iOS. The later opened hotel source also explicitly offers Penny questions about rooms, amenities and policies. This establishes on-site agent overlap, not an externally callable MCP/API or proven anonymous access. Ramp describes partner integration for existing corporate customers, not anonymous consumer access. Public API credentials, onboarding/approval requirements, schema and current external-agent availability remain unverified.

Search indexed official developer pages at `https://pricelinepartnersolutions.com/developers/`, `https://pricelinepartnersolutions.com/developers/documentation/`, `https://pricelinepartnersolutions.com/developers/documentation/air` and guide paths under `/developers/pps-api/`. Their snippets showed the same JavaScript requirement. These pages were not opened; their paths establish no endpoint semantics. Unofficial integration articles and a third-party copy of a partner form were not used as authority.

## Source-linked detail leads

### Megabus A/B and reserved C

Source chain: opened route directory, heading "Bus Route Guides", New York section. Link 2, "Philadelphia to New York bus", was clicked for A. Link 3, "Washington DC to New York bus", was clicked for B. Both returned readable text/html. A was also reopened to read its body. All occurred approximately 19:25:09-19:25:59 UTC.

- A: https://us.megabus.com/route-guides/philadelphia-to-new-york . Visible route heading identifies Philadelphia to New York; route code PP04; 2 stops; advertised fastest duration 1 hour 50 minutes; departures up to 34 services/day.
- B: https://us.megabus.com/route-guides/washington-to-new-york . Visible heading identifies Washington to New York; route code PP0E; 4 stops; advertised fastest duration 4 hours 20 minutes; departures up to 33 services/day.
- Reserved C: https://us.megabus.com/route-guides/boston-to-new-york-bus . The opened directory exposes link 6, "Boston to New York bus". Search independently returned this exact URL. Its detail was never opened or clicked. Limitation: the tool displays an internal link handle rather than the directory's raw href; exact href equality still needs confirmation without fetching C. This is a reserved source-linked label plus indexed URL corroboration, not a fully verified held-out target.

Plausible future output fields: route title, origin/destination city labels, route code, stop count, advertised fastest duration and maximum advertised departures. These are route-guide claims, not a date-specific timetable, actual trip duration, guaranteed operating frequency or live service availability. The sources contain caveats that boarding locations/gates vary, and A contains inconsistent boarding descriptions, so precise boarding instructions should not be promoted as authoritative. Date-linked price tiles were present but no price semantics/freshness contract was established; omit prices. No booking/date links or tracking service was followed.

### Priceline A/B and incomplete C reservation

Source chain: opened homepage's Las Vegas hotel section; clicked link 59 for A and link 60 for B, approximately 19:25:59-19:26:25 UTC. Both returned readable text/html despite ordinary sign-in navigation links. No login form or control prevented their metadata.

- A: https://www.priceline.com/hotel-deals/en-us/P3000015284/H49389/silver-sevens-hotel-and-casino-a-wyndham-garden.ssp . Heading "Silver Sevens Hotel and Casino, a Wyndham Garden"; 3-star label; top amenities include casino, pool, restaurant, free internet and free parking.
- B: https://www.priceline.com/hotel-deals/en-us/P3000015284/H46431/excalibur.ssp . Heading "Excalibur"; 3.5-star label; top amenities include casino, pool, restaurant, fitness center and pets allowed.
- C is incomplete. The opened homepage has an unopened "Thunderbird Boutique Hotel" link 61; opened B also has an unopened "Luxor" link 49. Bounded searches for their exact detail URLs returned homepage results or no results. The tool did not expose raw hrefs without following them. No URL/ID was guessed and neither detail was fetched. Resolve one actual href before reserving a qualified third input.

Plausible fields are hotel name, source URL, displayed star label and named amenities. URL segments identify the opened documents only; no internal endpoint, parameter grammar or query semantics were inferred. Aggregate review labels were visible but individual reviewer material is outside scope. Price labels said nightly and fees included, while default dates and title/body amounts differed across sources. No price, currency, availability or freshness claim is qualified. On-site Penny overlaps these hotel questions; an unsupported external-agent gap remains unproved.

## Stops and remaining gates

New domain stops: none observed. No remote auth, rate, bot, robots restriction or repeated retrieval error was reported for the requested pages. JavaScript-only partner content and empty search results are recorded as research limitations, not fabricated HTTP failures. Existing state domain/host stops remain in force; none was deliberately requested or followed, including ChatGPT app listings and stopped travel competitors. Incidental labels in search results/footers were not traversed.

Every qualification gate is missing: fresh resource admission for authorized local work, genuine frontend A/B captures, credential-safe learning, extraction validation, candidate export and offline preflight, confirmed reserved-C href, unseen tier-1 replay and independent meaning comparison, current-version checks/verify, empty-home reuse with first-request Cookie/Authorization evidence, exact final export/hash audit, final JSON/notes vet and integrated registry gate. Remote source extraction cannot satisfy any of them.

Next bounded eligible action: parent can prioritize Megabus route metadata for a separately authorized qualification batch after admission, first confirming the Boston link's actual href without fetching its detail. Preserve C unseen, capture A/B genuinely, and test only advertised metadata with its qualifiers. Park Priceline below unsupported leads until official partner access/coverage and an external-agent metadata gap are established; any continuation must first resolve an actual unopened third href. No local continuation is authorized by this report.
