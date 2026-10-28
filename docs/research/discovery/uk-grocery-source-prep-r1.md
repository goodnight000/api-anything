# UK grocery source preparation r1

UTC date: 2026-10-26. Batch: `uk-grocery-source-prep-r1`. Remote research window: 18:52:36–18:56:54 UTC; report prepared immediately afterward, within the eight-minute bound from the parent's 18:52:07 launch.

Only Sainsbury's, Waitrose and Morrisons were candidates. Read the current discovery README/state, DESIGN, CONTRIBUTING and repository api-anything skill. State had no stop for these retailers; its Deutsche Bahn and SNCF documentation-host stops were not visited. Parent retains state ownership. Website access used only `mcp__codex_apps__search_service_web_run`. No local traffic, browser, capture, runtime home, resource sampling, learned operation, registry file or publication. The launch snapshot was not local-workload admission.

## Evidence and official overlap screen

All product observations below are remote-tool extracted HTML text. They are neither a real frontend capture nor an independently retained HTTP response. The tool supplied crawl labels that sometimes changed between opens, not origin freshness guarantees. It supplied no origin response headers/status for the readable pages. Ordinary sign-in navigation alongside product data was not treated as an authentication wall. No sign-in, shopping, loyalty, delivery-location or account action was performed.

Official API/MCP/agent-app searches preceded consumer detail work. Queries included retailer-domain searches for API, developer, MCP and ChatGPT, followed by targeted official/developer grocery catalogue searches. No retailer-supported anonymous catalogue API or official agent connector covering the desired read was established. This is a bounded negative search result, not proof none exists. No inference about anonymous access was drawn from supplier/partner infrastructure.

| Retailer | Primary overlap/access evidence | Decision |
| --- | --- | --- |
| Sainsbury's | [Sainsbury's-branded API Hub](https://jsainsburys.portal.swaggerhub.com/) was indexed with an SSO/email access notice and internal business/product categories. Portal ownership was not independently traced from a retailer link. See the conservative documentation-host stop below. | An indexed internal portal does not establish a supported anonymous grocery read. Consumer metadata remains a lead. |
| Waitrose | Opened [Apigee's 2015 announcement](https://www.globenewswire.com/en/news-release/2015/06/23/746697/35581/en/Waitrose-Deploys-Apigee-s-API-Management-Software-to-Help-Build-Deeper-Relationships-With-Customers.html), a primary vendor release. It describes APIs for employees' product-information access and planned consumer mobile experiences. | Historical infrastructure evidence; no public developer subscription, anonymous catalogue contract, MCP or OAuth integration was documented there. Current external access remains unknown. |
| Morrisons | Opened [Ocado Group's Morrisons partnership page](https://www.ocadogroup.com/about-us/osp-partners/morrisons). It describes software, logistics and fulfilment supporting Morrisons' online shop. | Commercial platform partnership, not an anonymous consumer API grant or a documented external catalogue integration. |

Search also indexed Parse, Pepesto, Upscrape and independent UK supermarket MCP projects. These are third-party claims, not retailer-supported access. Their endpoints, sessions and runtime claims were not used, opened as APIs, or tested. They do not justify calling an internal merchant/retail API anonymously.

## Sainsbury's

Source chain: search-discovered product pages were opened first. A subsequent indexed [milk category](https://www.sainsburys.co.uk/groceries/browse/chilled-food/milk/c%3A1019059) was opened and resolved to `https://www.sainsburys.co.uk/groceries/browse/chilled-food/milk/c:1019059`. Its visible product links were then clicked for A and B. The category showed the distinct C label, which was left unclicked.

| Candidate | Exact URL | Opened source evidence |
| --- | --- | --- |
| A | https://www.sainsburys.co.uk/groceries/product/sainsburys-british-whole-milk-568ml-1-pint | Category link labelled Sainsbury's British Whole Milk 568ml, 1 pint, opened successfully. Earlier apex-host detail text showed 85p and £1.50/ltr. |
| B | https://www.sainsburys.co.uk/groceries/product/sainsburys-british-semi-skimmed-milk-2-27l-4-pint | Category link labelled Sainsbury's British Semi Skimmed Milk 2.27L, 4 pint, opened successfully. Detail showed £1.65 and 73p/ltr. |
| Reserved C | https://sainsburys.co.uk/groceries/product/sainsburys-british-whole-milk-1-13l-2-pint | Exact route indexed; corresponding 1.13L, 2 pint product link visible in the opened category. Detail never opened or clicked. Exact category href equality with this indexed apex-host route was not independently exposed by the tool. |

An additional opened [filtered whole milk detail](https://sainsburys.co.uk/groceries/product/sainsburys-2l-british-fresher-for-longer-filtered-whole-milk) showed a Nectar-labelled £1.95 alongside £2.20, separate unit prices and an offer end date. This supports keeping regular and membership-qualified prices separate. It does not prove which price a shopper can obtain. No loyalty data was requested.

Plausible fields: source URL, title, stated pack size, displayed regular item-price text, unit-price text, separately labelled public promotion text, observation time. A `GBP` normalization would rely on UK context and the pound symbol, not a captured machine currency field. No current local/store stock, checkout price or price freshness is proved. The page's information-use notice limits reproduction; sharing permissions were not resolved.

Tool outcomes: consumer detail opens returned readable product text; category returned a source list and a reported URL normalization. Clicking Offers from the first detail returned a one-line page at `https://sainsburys.co.uk/gol-ui/offers`; clicking its British label returned a short marketing page at `https://www.sainsburys.co.uk/gol-ui/features/best-of-british`. Neither was a useful product-list source or an observed control. No retries of those sparse pages.

## Waitrose

Opened [Long Life Milk category](https://www.waitrose.com/ecom/shop/browse/groceries/fresh_and_chilled/milk_butter_and_eggs/milk/long_life_milk?tsrc=vdna), then clicked its distinct semi-skimmed and skimmed product links, sequentially. Product identities differ even though both prices were equal.

| Candidate | Exact URL | Opened source evidence |
| --- | --- | --- |
| A | https://www.waitrose.com/ecom/products/essential-long-life-semi-skimmed-milk/035307-17781-17782 | Essential Long Life Semi-Skimmed Milk, 1litre. Detail showed £1.30, £1.30/litre and a separate previous-price label of £1.40. |
| B | https://www.waitrose.com/ecom/products/essential-long-life-skimmed-milk/035309-17785-17786 | Essential Long Life Skimmed Milk, 1litre. Detail showed £1.30 and £1.30/litre; description identifies skimmed rather than semi-skimmed milk. |
| Reserved C | https://www.waitrose.com/ecom/products/essential-unsweetened-soya-drink/035050-17659-17660 | Exact clean URL indexed; corresponding Essential Unsweetened Soya Drink, 1litre link visible in the opened category. Detail never opened or clicked. Exact href equality was not independently exposed by the tool. |

Plausible fields: title, stated pack size, item-price text, unit-price text, separate previous-price/promotion text, source URL and observation time. Do not treat previous price as a second current offer. GBP is a contextual normalization, not a captured currency property. No store was selected, so regional pricing, stock, delivery coverage and checkout price remain unknown. Product descriptions warn about changing information and restrict reproduction to personal use absent consent/acknowledgement. No customer or manufacturer contact details were retained.

Tool outcomes: category and A/B returned readable HTML text without reported access control. A search also indexed a whole-milk URL containing `gStoreCode=179`; it was not opened, selected as C, or interpreted as proof of query/store semantics. No store-scoped request was constructed.

## Morrisons

Opened [Fresh Milk category](https://groceries.morrisons.com/categories/fresh-foods/milk-eggs-butter/fresh-milk/177264), then clicked its own-brand semi-skimmed and Cravendale semi-skimmed links, sequentially. The page asks for a delivery location, which was left unset.

| Candidate | Exact URL | Opened source evidence |
| --- | --- | --- |
| A | https://groceries.morrisons.com/products/morrisons-british-semi-skimmed-milk-4-pint/113240422 | Morrisons British Semi Skimmed Milk 4 Pint. Detail showed 2.272L, £1.65 and 72.6p/litre. |
| B | https://groceries.morrisons.com/products/cravendale-filtered-fresh-semi-skimmed-milk-fresher-for-longer-2l/103084876 | Cravendale Filtered Fresh Semi Skimmed Milk Fresher for Longer 2L. Detail showed 2L, £2.65 and £1.33/litre, with a separate multibuy promotion. |
| Reserved C | https://groceries.morrisons.com/products/morrisons-british-whole-milk-4-pint/113239405?list=recipe-shop-for-ingredients%3A+other&position=3 | Exact URL indexed; corresponding whole-milk product link visible in the opened category. Detail never opened or clicked. Opaque indexed query retained without interpretation; equality to the category href is unproved. |

Plausible fields: title, pack-size text, item-price text, unit-price text, separately labelled promotion, source URL and observation time. These are displayed catalogue values without a selected delivery location. They prove neither store stock nor national/current checkout pricing. GBP is contextual. A multibuy total must not replace the individual-pack price, and no membership eligibility is inferred. Manufacturer addresses and review-author details are outside the candidate output.

Tool outcomes: category and A/B returned readable HTML text without reported control. Primary partner-page text supports the commercial-platform distinction above. No internal API path or parameter semantics were inferred or requested.

## Stops, timing and missing qualification

The initial remote search/open screen occurred between the 18:52:36 and 18:53:04 UTC clock readings. The Sainsbury's-branded portal's indexed notice explicitly required SSO and automatic product-access requests. Raw indexed fragment: "To access API Hub via SSO click Log in". The portal open was attempted in the combined tool call, but that response's display was truncated and no readable open outcome/status was retained for this report. Conservatively stop `jsainsburys.portal.swaggerhub.com` at the documentation authentication boundary. No login/product request or subsequent portal visit. This is indexed authentication-requirement evidence, not an observed HTTP401 and not a stop for the separate public grocery host.

Consumer source opens ran after that screen and before the 18:56:54 UTC reading. No auth, rate, bot, robots or repeated-error stop was observed for the three consumer domains. No transport fallback occurred. Do not relabel readable remote source text as origin HTTP200, signed-out browser proof or replay success.

All qualification gates are missing: local workload admission; real frontend/exact-document captures; independent captured-body control assessment; proven extraction against captured bytes; two-example learning and meaningful parameter variation; unseen C tier-1 replay; exact-version checks/verify; fresh empty-home reuse with initial Cookie/Authorization absence; export/credential scan; offline and final `vetShared`; integrated registry test. No operations counted and no runnable proof.

Next bounded eligible action: parent may prioritize Morrisons' differing pack sizes, then Waitrose's differing product identities. After the runbook's replacement eligibility and fresh workload admission, capture only A/B using the authorized workflow and stop on the first control. Independently resolve each reserved C's source-link target without fetching its detail before claiming it is a fully grounded held-out URL; the index corroboration here is explicitly weaker. Then, only if learning/vetting succeeds, use C for unseen tier-1 qualification. Keep the API Hub host stopped. No further work was authorized or performed by this report.
