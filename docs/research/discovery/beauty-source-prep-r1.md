# Beauty source preparation r1

Status: ISSUES. Useful public source pages are grounded for Sephora and Ulta, with variant and price ambiguities to resolve during later capture. No reusable operation is proved or saved.

Research date: 2026-10-26 UTC. Scope was remote public US catalog/product preparation only, in that site order. All website research used `tools.mcp__codex_apps__search_service_web_run`. No local browser, capture, network command, API replay, login, cookie import, site write, nested agent, dependency/source edit, commit or publication occurred. Only this report was written. No raw evidence files were saved.

## Starting evidence and evidence labels

Read `AGENTS.md`, `bench/discovery/README.md`, the discovery index, `beauty-retail-r1.md`, and `bench/discovery/state.json`. The prior beauty report records four resource denials and zero website requests. Current state claims this batch for these two sites and leaves shared-state ownership with the parent. Local browser admission remains deferred; no resource-heavy local work was started or host-wide resource guarantee inferred.

“Remote primary document” below means the remote tool returned a page through `open` or a source link through `click`, including content type and source attribution. The tool also supplies crawl dates, sometimes older than today. This does not establish a new origin fetch, local signed-out behavior, HTTP status, raw HTML structure, frontend traffic or successful execution. “Search-indexed lead” means search output only. “Inference” is a proposed interpretation requiring validation. No endpoint, query route, bundle URL or product ID was invented.

## Sephora

Useful questions include which products a brand lists, which sizes belong to a product, and what ingredients and advertised price belong to a particular item. The following exact URLs were returned on 2026-10-26.

- [Niacinamide product](https://www.sephora.com/product/the-ordinary-deciem-niacinamide-10-zinc-1-P427417?icid2=products+grid:p427417&skuId=2031391), remote primary document, crawled last week. Product identity `P427417`, item `2031391`, selected size 1 oz/30 mL and advertised `$6.00` appeared together. The page also labels 2 oz/60 mL as another size, but its item ID and selected price were not established. Separate highlighted-ingredient and full-ingredient sections include niacinamide and zinc PCA. The footer exposes United States-English context alongside Canadian alternatives.
- [Natural Moisturizing Factors product](https://www.sephora.com/product/the-ordinary-deciem-natural-moisturizing-factors-ha-P427414?skuId=2210581), remote primary document, crawled today. Followed the first product's linked recommendation. Product `P427414`, item `2210581`, selected 3.3 oz/100 mL and `$12.50` appeared together. A 1 oz/30 mL mini is another size. The ingredient section contains a full list distinct from ingredient highlights.
- [The Ordinary brand catalog](https://www.sephora.com/brand/the-ordinary?icid2=product_link_brand), remote primary document, crawled last week. Followed the product's brand link. It exposes product links, size counts, price ranges, sorting, filters and a show-more control. It claims 66 results and a 1–60 interval, while the returned text exposes only five principal product cards. This cannot prove complete catalog extraction. Its glycolic-acid toner link is a grounded later third-product choice.
- [Face-serum catalog](https://www.sephora.com/brand/the-ordinary/face-serum), search-indexed lead only, crawled two weeks ago. A second catalog input, pending frontend admission.

Inference: retain product-family identity separately from selected item/SKU. A catalog price range is not a selected item's price. Dollar signs plus US context suggest USD, but explicit currency metadata was not inspected. Require that proof before exporting an advertised USD operation. Ingredients are retailer descriptions tied to the selected document, not a verified physical batch formula or medical advice.

Grounded continuation: capture the two linked product pages as different learning examples, then follow the brand catalog's glycolic-acid product link for an unseen semantic comparison. Separately test brand versus face-serum catalogs, comparing actual product URLs and the exposed subset. Search inputs are visible, but no submitted search URL/request was observed; discover it through the real UI later. Size changes also require actual frontend observation; do not generate another `skuId`.

## Ulta

Useful questions include product discovery within a brand and how size selection changes item identity and advertised price. Exact sources returned on 2026-10-26 follow.

- [Niacinamide default product](https://www.ulta.com/p/niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111), remote primary document, crawled yesterday. Family `pimprod2007111`, item `2551167`, selected 1.0 oz and `$6.00` appear together. The page separately labels a subscription offer at `$5.70`; this must not become an unconditional product price. It contains key ingredients and a full ingredient section.
- [Niacinamide 4.0 oz](https://www.ulta.com/p/niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111?sku=2614594), remote primary document, crawled today. Followed the default page's actual 4.0 oz link. It returns item `2614594`, selected 4.0 oz and `$19.60`, with the same family identity and an ingredient list. A search-indexed result for this exact URL instead described 1.0 oz and item `2551167`. The linked document supports a preparation hypothesis, not a settled live mapping; capture must resolve the discrepancy.
- [Glycolic-acid toner](https://www.ulta.com/p/glycolic-acid-7-exfoliating-brightening-daily-toner-pimprod2007097?sku=2551155), remote primary document, crawled today. Followed a product link from the first page. Family `pimprod2007097`, item `2551155`, 8.0 oz and `$13.50` occur together. A separate subscription amount is `$12.82`. A smaller size is linked. Full ingredients are separate from key ingredients.
- [The Ordinary brand catalog](https://www.ulta.com/brand/ordinary), remote primary document, crawled today. Followed the product's brand link. It has category, concern, preference, price and sorting controls. The returned document also names a default store, Plattsburgh Consumer Square. No store was selected or changed by this worker. Treat store-dependent filters, counts and availability as contaminated context until a later fresh session establishes behavior.

Inference: family path identity and selected `sku`/item identity need separate fields. Do not equate an index title with the selected variant, take the first dollar amount, or extract carousel prices as the current product offer. Explicit USD currency metadata remains unverified. Stock, pickup and delivery promises are excluded even when incidental page text displays them.

Grounded continuation: use default niacinamide and the toner as distinct learning examples, with the linked 4.0 oz niacinamide variant held out from learning for replay comparison. Check family ID, returned item, selected size, main offer and ingredient section together. Catalog preparation is lower priority because of the implicit store context. No search/filter request or pagination contract has been established.

## Official API screen, controls and missing proof

Two bounded searches per domain combined product research with `Sephora public developer API product catalog` or `developer public API product catalog` restricted by site in the query. They found no readily usable official public catalog API documentation. This is a limited negative search, not proof of absence. No third-party reverse-engineering package was used as behavior evidence. Frontend preparation remains useful for retailer-specific assortment, variant identity, ingredient presentation and advertised offers if an official equivalent is unavailable. Prefer an official equivalent if later found.

No response exposed an auth gate, challenge, 403 or 429. Ordinary sign-in promotions were present alongside readable product content; none was followed. No control workaround or alternate access route was attempted. No source-linked JavaScript bundle was inspected, and no backend request is known.

Still missing for both domains: admitted genuine frontend capture, two differing captured examples, learned request/extraction contracts without credentials, unseen semantic replay, `verify`, fresh cookie-free reuse, export and `vetShared`. Price freshness, explicit currency, size selection, complete catalog coverage and local signed-out behavior remain unproved. Parent owns admission, catalog/state changes and all local validation. No `sites/` files were created.
