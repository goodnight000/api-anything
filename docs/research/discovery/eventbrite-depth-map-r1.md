# Eventbrite depth map, round 1

Source-only preparation, 2026-10-27 UTC. This report adds no runnable operation and makes no qualification claim. The useful next work is keyword/location discovery with the site's actual date and category controls, followed by its observed continuation. Remote inspection stopped on a rate diagnostic, so destination results and request contracts remain unproved.

## Scope and preserved baseline

Read `bench/discovery/README.md` and `state.json` before site work. The runbook SHA-256 matched the assigned value, `4a52052d2f19d03efda45af808b2db4349e8bf4845e7ba55db046d893a96eeaa`. State contained no Eventbrite host stop or alias stop. This assignment was the sole active Eventbrite depth map. Read the design, contribution instructions, local api-anything skill, existing site files, prior report and relevant retained receipts. The research skill's delegation instruction was superseded by the explicit no-nesting brief.

Existing coverage comes from `sites/eventbrite.json`, `sites/eventbrite.md` and [the prior receipt](events-activities-r1.md). `listFeaturedEvents(city)` extracts the first curated four-card shelf. `getEvent(slug)` extracts an individual event's public details, including organizer name and advertised offers. Neither supplies keyword search, date filtering, full listings or continuation. These are historical saved results, not freshly reverified here.

Files preserved byte for byte:

- `sites/eventbrite.json`: SHA-256 `8ccd5d9f945bd738402a5bc199563ea319ce10b973e5d1972ee81039835cd9d1`.
- `sites/eventbrite.md`: SHA-256 `a21b53f013a9103f835710247d7d4996f9044bac66648c73af2049afd0e6a75a`.

## Remote tool and stop receipt

Available remote capability: `mcp__codex_apps__search_service_web_run`, with indexed search and text opens. No browser or local network command was used. Three index queries returned official Eventbrite help/developer material. Indexed material is identified separately below; it is not a fresh frontend response.

1. One text open of https://www.eventbrite.com/d/ca--san-francisco/events/ returned exactly `Failed to fetch https://www.eventbrite.com/d/ca--san-francisco/events/: (405) Method Not Allowed`. This isolated diagnostic establishes neither origin access control nor a repeated-error condition. That route was not retried.
2. A distinct official documentation open, https://www.eventbrite.com/platform/docs/by-category, returned exactly `Failed to fetch https://www.eventbrite.com/platform/docs/by-category: (429) Too Many Requests`. All Eventbrite remote work stopped immediately. No further search, open, route, alias, transport or retry followed.

New stop for parent review: the observed host is `www.eventbrite.com`, with the rate diagnostic on `/platform/docs/by-category`. Conservatively hold Eventbrite brand work across consumer/developer routes, aliases, subdomains, country sites and transports. This is a worker-imposed stop scope, not evidence that every such host refused access. Origin HTTP status, response headers, Retry-After, duration and whether the diagnostic came from Eventbrite or the remote retrieval service are unknown. State was not edited. Do not schedule a retry from this map.

## Established official interface screen

Official indexed documentation is more specific than the developer landing-page marketing:

- https://www.eventbrite.com/platform/new/api explicitly labels public event search deprecated and says access shut down December 12, 2019. Its old search parameters are historical documentation, not candidates for request construction.
- https://www.eventbrite.com/platform/docs/by-category and https://www.eventbrite.com/platform/docs/by-date carry the same shutdown notice in indexed results. The former's direct open produced the rate stop above; its indexed text must not be mistaken for a successful direct open.
- https://www.eventbrite.com/help/en-us/articles/849962/generate-an-api-key/ says developers need an Eventbrite account to create an API key. No account, signup, API key, OAuth flow or API request was attempted.
- https://www.eventbrite.com/platform/ still advertises public-event discovery and an API key. That marketing does not override the explicit search shutdown notice or prove anonymous, presently usable discovery access.
- https://www.eventbrite.com/help/en-us/articles/783059/ documents discovery in the mobile app, including location search, relevance/date sorting and date/category/price/online-or-in-person filters. This establishes official app capabilities only. It does not establish equivalent web controls, wire names, complete enum sets or anonymous API access.

No established credential-free, documented public search interface was established. Organizer API coverage and permissions were not established before the stop. The supported API should be reconsidered from current official evidence before later duplication, without reviving deprecated routes or requesting credentials in this phase.

## Retained primary evidence

All following observations are from local reads of public documents retained by the earlier signed-out run, not fresh remote visits. No event detail was reopened. Reading the saved first event document supplied the distinct organizer and taxonomy navigation below.

| Source | Retained evidence | What it supports |
| --- | --- | --- |
| https://www.eventbrite.com/ | `bench/explore/state/discovery/events-activities-r1/eventbrite-root.html`; root receipt timestamp `2026-10-26T09:43:54.243Z` | Search/location inputs, date tabs, literal city and music/date navigation |
| https://www.eventbrite.com/d/ca--san-francisco/events/ | capture `cmvp2lkv0ec53fb`, `2026-10-26T09:44:42.972Z` | Broader city/online links, sections, public card fields and promoted label |
| https://www.eventbrite.com/d/ny--new-york/events/ | capture `cmvp2mi11f58f4d`, `2026-10-26T09:45:25.957Z` | Different city, broader city link and different section results |
| https://www.eventbrite.com/d/ca--los-angeles/events/ | capture `cmvp2mx5cd464e3`, `2026-10-26T09:45:45.552Z` | Actual weekend link, weekend shelf and reserved broader-list link |
| https://www.eventbrite.com/e/san-frans-largest-tech-startup-business-entrepreneur-networking-soiree-tickets-1976644210042?aff=ebdssbneighborhoodbrowse | `eventbrite-detail1.html` | Actual organizer href and separate networking/category hrefs |

Capture files remain under `bench/explore/state/discovery/events-activities-r1/eventbrite-home/captures/`. Their SHA-256 values, respectively for SF, NY and LA, are `2f969da5f65bee0e79f65f2f01a400b754acff20c178c9bd7b9955be3eed6e46`, `5ffbac84925cb2210971708b62d70686e6453426be4a5413484d2ad440506222` and `91f6299ada53fad7b76495b20d2c47e9f952c4bfb3d37dde4d00114aa1db8c6e`. Only public response bodies were inspected; cookie/storage values were not inspected or copied into this report.

## Priority 1: keyword and chosen-location discovery

Usefulness: find an event matching an intent, such as networking or a workshop, without browsing a four-card editorial shelf. This is distinct from both stored operations. Treat location/date/category controls as capabilities of coherent event discovery, not separate field-only operations.

Observed web controls in the retained homepage and SF document:

- `input#search-autocomplete-input`, type `search`, name `search-autocomplete-input`, placeholder `Search events`.
- `input#location-autocomplete`, type `text`, role `combobox`, with a location listbox reference. The SF document gives placeholder `Choose a location`.
- SF `input#browse-location-selector`, value `San Francisco`, role `combobox`.
- The retained search form has no explicit action or method. Visible control names do not establish query keys, frontend request payloads or a usable submit URL.

A/B grounding is partial. A is San Francisco, whose source document shows a networking event in its featured shelf and `Sourdough Starter Workshop` in its separate editorial section. B is New York, whose document instead shows `Terence Tao: Six Math Essentials` and an editorial food/history tour. These prove differing location content and useful keyword targets, but neither keyword was submitted. There is no grounded A/B keyword-result pair. Suggested future inputs `networking` and `sourdough` are candidate test text only, not observed successful searches.

Reserved C: novel free text `urban sketching botanical gardens`, unsubmitted. No URL or endpoint is inferred for it.

Likely implementation: interactive search/location selection, inferred from autocomplete comboboxes and the lack of a form action. The saved city documents already contain HTML results, so a navigated result document might be usable through SSR. That inference needs a real submit/navigation capture; no autocomplete result, selected location identity or search request was observed.

Missing gates: actual web search submission, differing A/B results with identity and relevance checks, field and location mapping, optional-filter semantics, independent C, all runtime and sharing gates listed below.

## Priority 2: broader listings with supported facets and continuation

Usefulness: browse beyond the featured shelf and narrow by actual UI-supported date/category/location choices. The following are literal frontend hrefs, not constructed templates.

| Evidence role | Source observation | Literal destination | Result evidence and limit |
| --- | --- | --- | --- |
| A, broader city | SF `Popular in San Francisco` and `Explore more events` | https://www.eventbrite.com/d/ca--san-francisco/all-events/ | The source popular section includes a Halloween pub crawl and a startup grand finale. Destination unopened; those are source-shelf examples, not destination results. |
| B, broader city | NY `Popular in New York` and `Explore more events` | https://www.eventbrite.com/d/ny--new-york/all-events/ | Source section instead includes a Law Roach conversation and a marathon event. Destination unopened. |
| C, broader city | LA `Popular in Los Angeles` and `Explore more events` | https://www.eventbrite.com/d/ca--los-angeles/all-events/ | Reserved link; destination unopened. Reading its source page does not consume a destination-result holdout. |
| Online branch | SF/NY/LA `Online Events` and `Explore more events` | https://www.eventbrite.com/d/online/all-events/ | Online shelves contain different recommendations between locales. Destination unopened; not an inventory or location guarantee. |
| A, date/category navigation | Homepage music link | https://www.eventbrite.com/d/local/music--events--this-week/ | Link observed only; no destination results. `local` location resolution is unknown. |
| B, date navigation | LA `This Weekend` and `Explore more events` | https://www.eventbrite.com/d/ca--los-angeles/events--this-weekend/ | Source weekend shelf includes `Slaughterhäus: The LA Cut`; destination unopened. |
| Additional date link | SF/NY/LA footer `Events in Dallas Today` | https://www.eventbrite.com/d/tx--dallas/events--today/ | Link observed only, without Dallas results. |
| Reserved taxonomy C | Saved event detail `San Francisco Business networking` | https://www.eventbrite.com/d/ca--san-francisco/business--networking | Actual href; destination unopened. Do not add a slash or infer a taxonomy enum. |

The saved event also links https://www.eventbrite.com/d/ca--san-francisco/networking . It is a separate observed link, not proof that keyword search and category filtering are equivalent.

Homepage date tabs have observed accessible controls for `Today` and `This weekend`; no action was taken. Their internal DOM identifiers are not request parameters. Date navigation A/B above is grounded at the link level, with only B's source shelf showing a matching date-labeled group. It is not a completed two-result filter proof.

Observed card data includes title, event href, displayed time, venue/location text, advertised price text and sometimes follower text. SF also visibly labels a card `Promoted` and exposes `Promoted event actions`. A public follower label on an event card does not establish a separate organizer profile field or exact organizer identity. Some cards say to check the event for price. None of these fields proves available tickets.

The retained city results are SSR-capable within the old exact-document evidence. The broader destinations, filter changes and continuation are unobserved. No literal next-page link, cursor, page size, total count or last-page behavior was established. A carousel scroll control is not pagination evidence. Keep any future first-page extraction explicitly bounded; do not invent `page`, cursor or filter keys.

The old broader JSON-LD experiment is a negative control, not an easy extension: `eventbrite-list-la-comparison.json` records unequal identities despite matching list lengths. The prior report attributes four differing recommendations to client locale. Desktop/mobile card duplication is also visible in the saved markup. Extracting all cards would require section boundaries, deduplication and a new meaning check.

## Conditional lead: public organizer profile and event list

Usefulness would be following a public organizer's upcoming events across cities, a different question from one event's organizer name. The saved event detail links exactly https://www.eventbrite.com/o/9879419208 with the label `New York Entrepreneurs, Startup & Business Coalition`.

Reserve that actual href as C, unopened. There is no A/B organizer-profile pair, profile event-list response, pagination, follower-count proof, upcoming/past split or source-supported output schema. Do not promote this lead until those are grounded. SSR versus interactive is unknown for the organizer destination. No follow/contact button was activated, and no email or contact harvesting was performed.

## Semantics and qualification gaps

- City and `local` navigation do not establish nearest-event ordering, radius units, geocoding or distance filtering. SF's popular section even contains nonlocal/online recommendations. Never describe it as a strict geographic result set.
- Today/weekend/week navigation does not establish inclusive boundaries, week start, user's timezone, event timezone, DST or custom date-range semantics. The existing event's offset-bearing detail dates do not prove search-filter timezone behavior.
- Promoted placement, editorial shelves and online recommendations must be distinguished from filter-matching organic results. Advertised prices, free-entry wording, schema.org offers and availability labels are not live inventory, an RSVP, a checkout quote or a ticket guarantee.
- Historic content can expire. A retained title proves what the saved source showed, not present availability or a fresh result.

All proposed workflows still need authorized frontend capture after the stop is resolved by the coordinator, two differing public examples, evidence-backed parameter mapping and extraction, unseen C with independent identity/meaning comparison, exact-version verification, initially empty-home reuse with cookie/authorization provenance, final export plus caller notes, offline vet and the integrated registry gate. No such workload ran here. Existing historical passes do not qualify the new flows.

## Cleanup and handoff

Only this assigned report was written. No shared state, site spec, caller notes, helper, dependency, source, commit, PR or publication changed. All local commands were lightweight file reads or the report write and exited. No persistent local process, server, browser, isolated home, lock or capture was created. Existing evidence and unrelated work were preserved. The Eventbrite conservative rate stop above needs parent review before any further Eventbrite work.
