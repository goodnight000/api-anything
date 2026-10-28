# Home and apparel source preparation r1

Status: ISSUES for research preparation. Public product pages are grounded for Lowe's and UNIQLO, but price and variant contracts remain unproved. Lowe's is lower priority because an official partner catalog integration exists. No reusable operation is established.

Research date: 2026-10-26 UTC. Only the remote `tools.mcp__codex_apps__search_service_web_run` tool accessed websites. No local browser, capture, network command, API replay, login, cookie import, site write, nested agent, source/dependency/shared-state edit, commit or publication occurred. Only this report was written; no raw evidence was saved.

Read `AGENTS.md`, `bench/discovery/README.md`, the discovery index, `next-candidates.md`, `apparel-r1.md`, `beauty-source-prep-r1.md`, and the relevant entries in `bench/discovery/state.json`. Current state assigns these two sites to this batch. Home Depot remains stopped after its previously recorded 403; it was not researched. Browser admission remains deferred and belongs to the parent. This worker made only inexpensive local reads and one report write, without claiming a host-wide resource guarantee.

## Evidence meaning

All URLs below were returned on the research date. A remote primary document means `open` or `click` returned source-attributed page text. The remote service may use cached content, with crawl dates recorded below. This does not prove a fresh origin fetch, HTTP status, raw HTML structure, local signed-out behavior or frontend traffic. Search-indexed leads have not been independently retrieved as substantive documents. Inferences and proposed continuation are explicitly identified. No endpoint or product ID was guessed, and no third-party reverse-engineering package was used.

## Official API and connector screen

Lowe's official [Product Discovery documentation](https://developer.lowes.com/portal/solutions/product-discovery/) is a search-indexed primary-source lead, crawled two weeks ago. It describes daily catalog feeds combined with a Product Detail API. Opening that exact page returned only `Loading...`, so the substantive claims remain search-index evidence.

The official [Product Catalog documentation](https://developer.lowes.com/portal/business-components/Product%20Catalog/), search-indexed last month, describes authenticated partner feeds and product/search APIs. The [developer contact page](https://developer.lowes.com/portal/contact/), search-indexed last week, requires organization registration, app setup and API credentials. Readily usable anonymous access is therefore not established. The catalog text also mixes an API described as coming soon with API examples, so readiness is uncertain. No API or authentication flow was attempted. Deprioritize Lowe's in favor of checking authorized official access first. A future browser-only metadata read could still help public users without partner access, but it must add useful signed-out behavior and exclude contract pricing.

Bounded official-domain searches for UNIQLO developer/product APIs, MCP and agent connectors found no suitable official documentation. This is a limited negative search, not proof of absence. Frontend preparation remains useful for regional assortment, material descriptions and color/size presentation. Prefer an official equivalent if one is later found.

## Lowe's public pages

The [homepage](https://www.lowes.com/), remote primary document crawled today, supplied both product links below. Its notice says online and local-store pricing may differ. Ordinary sign-in promotions appeared alongside readable public content; no sign-in was followed.

- [CRAFTSMAN drill](https://www.lowes.com/pd/CRAFTSMAN-20-volt-Max-1-2-in-Keyless-Cordless-Drill-1-Batteries-Included-and-Charger-Included/5018700285), remote primary document crawled today. URL identity `5018700285`, item `6812913`, model `CMCD702D1`, and main `$59.00` occur together. Specifications distinguish battery voltage, battery count and charger inclusion. Separate bundle prices also appear. Useful question: which drill kit includes a battery and charger, and what are its stated dimensions and power characteristics?
- [Kobalt pink mini cabinet](https://www.lowes.com/pd/Kobalt-11-34-in-W-x-12-03-in-H-x-6-5-in-D-Pink-Steel-Tool-Box/5018702597), remote primary document crawled today. URL identity `5018702597`, item `8856759`, model `56602` and manufacturer finish Pink occur together. Dimensions are 11.34 inches wide, 12.03 high and 6.5 deep. The main offer area asks for location to obtain pricing, while a later comparison table displays `$31.98`. Treat the main price as unproved; do not substitute comparison or recommendation prices. Useful question: which small cabinet fits a measured space, and what material, finish and shelf count does it have?

Inference: retain URL product identity, retailer item number and manufacturer model separately. A finish is not proved to be a selectable variant merely because related products have other colors. Dollar signs suggest USD in this US storefront, but explicit frontend currency metadata was not inspected. Official feed documentation's USD field does not prove the frontend offer currency.

Grounded continuation, lower priority: use these two exact product pages for metadata learning only after admission. The drill page links related CRAFTSMAN kits that can supply a held-out third product through actual UI navigation. A main-price operation needs fresh proof of anonymous context, offer ownership and currency, including a missing-price outcome. Free-text search, catalog routes and color-selection requests remain unverified routes; none was constructed.

## UNIQLO Denmark public pages

The [requested root](https://www.uniqlo.com/) redirected remotely to [Denmark English](https://www.uniqlo.com/dk/en/), crawled today. This preparation is Denmark/DKK-specific, with no claim about US prices or global routing.

- [Men's tops catalog](https://www.uniqlo.com/dk/en/men/tops), remote primary document crawled yesterday. It exposes product links, size-range labels and DKK prices. The returned document says 137 results; search-index text said 180. Neither proves current complete coverage. A reduced card distinguishes current, crossed-out and 30-day-low amounts. The root-linked [women's tops catalog](https://www.uniqlo.com/dk/en/women/tops) returned a no-results message, insufficient evidence that the live category is empty.
- [DRY-EX T-Shirt](https://www.uniqlo.com/dk/en/products/E489013-000/00), search-discovered exact frontend URL, then remote primary document crawled two days ago. It returns product ID `489013`, color `67 BLUE`, displayed size M and size labels XS through 3XL. It describes fabric composition and care. The visible `129 DKK` is explicitly a 30-day historical low, not a proved current offer.
- [Crew Neck T-Shirt](https://www.uniqlo.com/dk/en/products/E422992-000/02), search-discovered, then remote primary document crawled last week. URL identity `E422992-000/02` differs from displayed product ID `461556`; the description also lists `455360` and explains that the same item may have different IDs. Color is `30 NATURAL`, displayed size S, material 100% cotton. `149 DKK` is labeled a 30-day low.
- [AIRism oversized T-shirt](https://www.uniqlo.com/dk/en/products/E465185-000/00?colorDisplayCode=39), followed from the men's catalog, remote primary document crawled two weeks ago. The actual query parameter accompanies `39 DARK BROWN`; this does not prove arbitrary parameter behavior. Displayed product ID `493232` differs from the route identity, with multiple IDs listed. The category advertises 199 DKK, while the detail text exposes no clear current price.
- [Men's sweats catalog](https://www.uniqlo.com/dk/en/men/tops/sweatshirts-and-hoodies), followed from men's tops, remote primary document crawled today. It says zero results while separate editorial shelves still contain products and DKK prices. These shelves must not be counted as catalog results.

Grounded continuation: capture DRY-EX and Crew Neck as two different detail examples; reserve the linked AIRism page as a held-out semantic comparison. Compare route identity, displayed IDs, selected color/size and material together. Then observe a real color/size change through the frontend before learning variant arguments. Do not infer route suffix meaning or use image swatches as stock evidence. For catalog work, compare men's tops with its linked sweats category, distinguishing result cards from editorial shelves. Pagination, free-text search and filter requests remain unverified.

## Controls and missing proof

No response exposed an authentication gate, bot challenge, HTTP 403 or rate-limit response. Partner documentation describing credential requirements is not evidence that a public product request was gated. No workaround or transport switch followed a control. Store selectors and account promotions were not used. Account/member pricing, addresses, store selection, inventory/delivery guarantees, carts, checkout and user reviews are excluded from proposed operations. No source-linked bundle was inspected.

Both domains still require admitted real frontend capture, two differing captured examples, credential-free learning, unseen semantic replay, `verify`, fresh cookie-free reuse, export and `vetShared`. Price freshness, variant behavior and local signed-out context remain missing proof. The parent owns admission, catalog/state updates and all local validation. No `sites/` file or spec was created.

## Coordinator priority assessment

The partner documentation does not establish readily usable agent access. Lowe's remains
eligible for ordinary public metadata qualification after the current source-ready queue.
The report's suggested deprioritization is a worker judgment, not a finding that the user's
easy-API exclusion applies. Rome2Rio's documented no-sign-in agent connector is stronger
evidence of that exclusion. No Lowe's credentials or partner integration were attempted.
