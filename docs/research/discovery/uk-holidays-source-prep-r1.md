# UK holidays source preparation, round 1

UTC date: 2026-10-26. Remote observation window: 20:03:31–20:05:07 UTC; individual request timestamps were not returned. Research only, zero counted operations or registry additions.

Read the current discovery README, ledger, DESIGN, CONTRIBUTING and repository api-anything skill. Before website queries, searched all ledger sections for TUI/Jet2 names, domain and punctuation variants. Only this assignment/claim and the coordinator's 20:02:33 audit matched; no earlier stop for either was found. The supplied 20:02:12 launch snapshot was not resampled and authorized no local workload. Only `mcp__codex_apps__search_service_web_run` accessed websites. No local network, runtime, browser, capture, account, assistant, form, booking or API-endpoint operation ran. Only this report was written.

## Official overlap and access screen

Primary-domain searches covered API/developer, MCP, assistant/agent and partner access. Search results are indexed leads until opened; this screen establishes no API-absence claim.

- [Jet2holidays agency agreement](https://www.jet2holidays.com/-/media/pdfs/agency%20agreement_april_2025.pdf): opened and read remotely as a five-page PDF, without a local download. Definitions 1.1(c/e/o) and clause 4.27 document a travel-agent commercial agreement and a licensed API for browsing and booking travel arrangements. This is partner distribution access, not demonstrated anonymous consumer destination/hotel metadata access. Authentication mechanism, approval process, metadata schema, MCP availability and runtime service remain unknown. Indexed Manage My Booking login results were not opened; their booking-reference/login fields do not establish a consumer-document access wall.
- [TUI B2B distribution announcement](https://www.tuigroup.com/en/newsroom/news/tui-driving-further-growth-in-tours-and-activities-with-new-commercial-team-focused-on-strategic-b2b-partners): opened HTML; the dated 2023 announcement documents APIs and white-label distribution for B2B experiences, tours and transfers. Anonymous UK hotel-amenity field coverage and current access conditions are unproved.
- [TUI/Mindtrip announcement](https://preview.tuigroup.com/en/newsroom/news/tui-cooperation-with-mindtrip-ai-travel-inspiration-becomes-a-bookable-reality): opened HTML. The November 2025 announcement describes consumer trip planning and a TUI booking integration then available in Belgium, Germany, Ireland and the Netherlands. It does not establish current UK anonymous metadata API/MCP access. No assistant was invoked and no alternate country site was visited.
- [TUI BLUE collection page](https://www.tui.co.uk/holidays/tui-blue?vlid=T%7CL5%7CB1%7CAV%7CNA%7CNA%7CNO%7CBND%7CNO%7CBAU%7C257): opened through the TUI homepage's “TUI BLUE” link. It advertises a BLUE app with hotel information and activity schedules included with stays. App account/access requirements and external agent access were not tested. This is documented consumer-app overlap, not proof of anonymous machine access.

Generic trip planning, booking and B2B distribution are therefore poor frontend priorities. A narrow public document-metadata lead remains, with official anonymous read equivalence unresolved. “API” search results concerning Advance Passenger Information were discarded as unrelated; no passenger information page or portal was opened.

## TUI source chain and incomplete hotel pair

Opened [TUI homepage](https://www.tui.co.uk/), then its TUI BLUE collection link above. That source links the following exact hotel pages, both actually opened:

| Candidate | Exact detail URL | Grounded metadata and limits |
|---|---|---|
| A | https://www.tui.co.uk/destinations/europe/cyprus/larnaca-region/nissi-beach/hotels/tui-blue-atlantica-aeneas-resort.html | Remote page title identifies TUI BLUE Atlantica Aeneas Resort in Nissi Beach. Collection link 34 names the hotel; collection prose places it in Cyprus and advertises multifunctional pickleball/touch-tennis courts and a children's sensory room. Detail body exposed only 150 lines of shared footer/navigation. No standalone amenity extraction established. |
| B | https://www.tui.co.uk/destinations/europe/spain/tenerife/los-gigantes/hotels/tui-blue-los-gigantes.html | Remote page title identifies TUI BLUE Los Gigantes in Los Gigantes. Collection link 36 advertises multifunctional courts with an extra-charge marker. Country/island appear in the URL route, not a retrieved detail-body label. Detail body also exposed only the shared 150-line footer/navigation. |
| Reserved C | Exact raw href unconfirmed; not synthesized or fetched | Collection link 35, visible label “TUI BLUE Lagoon Princess”. This is an actual source anchor, not an exact held-out URL yet. |

The A/B document titles and parent-page property claims are grounded, but this is not a usable two-detail-body amenity pair. Plausible future fields are hotel title, resort label, advertised amenity text, charge qualifier, source URL and claim-source URL. Keep parent claims separate from detail-body evidence. No accessibility certification, electrical attributes, or full property attribute set was established.

Two subsequent attempts to follow the collection's Bodrum Holidays link 101 and Corfu Holidays link 103 returned the same remote-tool error. Both were issued together before their outcomes were available. No TUI request followed those outcomes.

## Jet2 source chain and destination pair

Opened [Jet2holidays homepage](https://www.jet2holidays.com/). Homepage link 105 also opened [New hotels to Jet2holidays](https://www.jet2holidays.com/new-hotels-to-jet2holidays); its readable text linked destination collections rather than an immediately usable hotel pair. No search/date form or “Search now” link was used.

Homepage links 48 and 58 directly grounded the differing destination documents below. Both returned readable remote HTML text with editorial sections and CMS-style labels. These are source documents, not rendered GUI evidence.

| Candidate | Exact detail URL | Visible labels and useful meaning |
|---|---|---|
| A | https://www.jet2holidays.com/destinations/portugal/algarve | “About the Algarve”; popular resort links include Albufeira, Vilamoura and Lagos. “Language” is Portuguese and “Currency” is Euro. Editorial headings cover beaches, activities and dining. Portugal is explicit in the opening description. |
| B | https://www.jet2holidays.com/destinations/portugal/madeira | “About Madeira”; popular resort links include Funchal, Canico and Calheta. Language is Portuguese and currency Euro. Editorial sections distinguish pools/sea and outdoor activities. Portugal grouping is explicit in homepage navigation; a country field on this detail body was not established. |
| Reserved C | Exact raw href unconfirmed; not synthesized or fetched | Homepage link 62, visible label “Tenerife”. Actual distinct destination anchor; its raw href is hidden by the reader output. No Tenerife detail request was made. |

Plausible fields: destination title, explicitly sourced country/grouping, resort labels, language, currency, editorial activity/category labels and source URL. Destination activities are not hotel amenities. CMS “Hotel ID” numbers were visible but not resolved or interpreted as endpoint inputs. AEM authoring/delivery links were visible and left unopened; no alternate host was used. Price-like editorial fields, review material and contact/address data were excluded. No availability, price, freshness, accessibility, electrical or independently certified quality claim follows.

## Stops and evidence limits

- New conservative stop: `tui.co.uk` and subdomains, all routes/transports, no automatic retry. Observed between 20:04:43 and 20:05:07 UTC. Source URL was the TUI BLUE collection above; attempted anchors were Bodrum Holidays 101 and Corfu Holidays 103. Both outcomes were headed `Internal Error ()` and said exactly `Unable to resolve click call due to invalid arguments`. The tool supplied no destination URL, response body, origin HTTP status or headers. This is a repeated remote-tool argument/reference failure, not proof of an origin outage, auth wall, bot challenge, rate limit or robots restriction. Parked conservatively under the assignment's repeated-error rule.
- Jet2holidays: no observed access-control or repeated retrieval-error stop. Generic sign-in navigation and dormant form/error labels in public source are not observed authentication refusals. Anonymous cookie-free behavior is still unknown because the remote tool exposes no session/header receipt.
- All prior ledger stops remain binding and were not queried, including HomeDepot aliases, LeroyMerlin/ADEO, Bunnings documentation, Screwfix/Rakuten boundaries and Makro.co.za human verification. Takealot remains parked with zero useful extracts and no retry. This batch supplied no new evidence about them.

## Missing qualification and next eligible action

All runtime gates are missing: real frontend capture, rendered signed-out comparison, request/argument learning, bounded extraction recipe, paired identity/meaning checks, offline candidate vet preflight, unseen C tier-1 replay, verification checks, fresh empty-home reuse with initial no Cookie/Authorization receipt, exact-version export/secret scan, final JSON/notes vet and integrated registry test. No endpoint/query template was inferred and no exchanges were fabricated.

TUI: park; no automatic revisit or transport substitution. Jet2: the next bounded source-preparation step is to establish the reserved C's raw primary-source href without fetching its detail and refine official anonymous metadata coverage/access. Any later local qualification is a separate admitted phase under the then-current runbook thresholds; this report authorizes no local workload. Preserve the two destination identities and compare editorial semantics, not a status code or nonempty extraction.
