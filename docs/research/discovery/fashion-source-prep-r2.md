# Fashion source preparation r2

2026-10-26 UTC. **ISSUES** for research preparation. ASOS has grounded catalog and product examples. Zalando has grounded products, but its official agent-commerce work should be screened before browser qualification. No reusable operation is proved.

## Scope and evidence

Read `AGENTS.md`, `bench/discovery/README.md`, the discovery index, prior beauty and retail preparation/qualification reports, and `bench/discovery/state.json`. State assigns this worker ASOS and Zalando. H&M, Zara and other stopped retailers remain stopped. The parent's 12:30:35 UTC light-admission snapshot was CPU 26.41%, policy memory 89.24%; no local browser admission or continuous resource guarantee follows from it.

All website research used remote `tools.mcp__codex_apps__search_service_web_run`. Only this report was written. No local browser/network command, capture, API replay, account action, cookie import, nested agent, shared-state/source/dependency edit, commit or publication occurred. No optional raw evidence was saved.

Every URL below was returned on 2026-10-26. **Opened primary document** means remote `open`, `click` or `find` returned the publisher's page. Remote output can be cached; this is not a raw origin receipt, HTTP-status record, local signed-out session or frontend capture. **Indexed lead** means search output only. **Inference** and unverified behavior are stated explicitly. No endpoint or identifier was guessed.

## Supported-access screen

For ASOS, bounded searches found no readily usable retailer-published anonymous consumer API or official agent connector. This is a limited negative screen, not proof of absence.

- [Celigo connection documentation](https://docs.celigo.com/hc/en-us/articles/26321932904859-Set-up-a-connection-to-Asos), opened provider-primary document, explicitly obtains its credential from a RapidAPI account. Its ASOS label does not establish an ASOS-operated API or current frontend behavior. No login or credential retrieval was attempted.
- [Paid On Results ASOS program](https://www.paidonresults.com/merchants/asos.html), opened network-primary document, advertises a product feed and merchant approval, with manually reviewed affiliate applications. The page contains old-looking program copy; present enrollment, feed schema, coverage and permitted reuse remain unverified. This is an approval-dependent lead, not anonymous catalog access. Prefer it if an authorized affiliate relationship later covers the required discovery.

For Zalando, [official integration options](https://partner.zalando.com/university/article/integration-options), opened retailer-primary document, describe sending a merchant's product, price and stock information into Zalando. Direct integration requires prior approval through an assessment and an internal technical team; an integrator involves contractual negotiation. These routes do not establish anonymous access to the consumer assortment.

Zalando's [12 March 2026 results announcement](https://corporate.zalando.com/en/investor-relations/zalando-full-year-2025-results), opened retailer-primary document, identifies it as a Google Universal Commerce Protocol launch partner and describes discovery/purchase through assistants such as Gemini. Google's [19 March UCP update](https://blog.google/products-and-platforms/products/shopping/ucp-updates/), opened protocol-provider-primary document, describes optional catalog capabilities for variants, inventory and pricing; adopters choose capabilities. Neither page supplies a Zalando-specific public catalog URL, anonymous client entitlement, supported UK coverage or usable integration instructions. Do not turn the announcement into an endpoint guess.

Recommendation: screen documented Zalando UCP catalog availability first when qualification resumes. Prefer supported access if it answers the same questions. Public frontend work remains useful conditionally for exact retailer article identity, displayed colour and localized advertised offer associations if supported access lacks those fields or coverage. Third-party scraper/MCP directory and unofficial feed-package results were indexed leads only and were not used as behavior evidence.

## ASOS

Useful questions: which initial products appear in a category, which brand and displayed product code belong to a linked item, and which advertised amount belongs to that document.

The [ASOS root](https://www.asos.com/) linked to [women's tops](https://www.asos.com/women/tops/cat/?cid=4169) and [women's dresses](https://www.asos.com/women/dresses/cat/?cid=8799). All three were opened primary documents. The catalog documents reported 72 viewed products out of 21,922 and 20,077 respectively, with sort/filter controls and a load-more link. These are initial subsets, not complete catalogs. `cid` values are sourced category inputs; search submission, filters and pagination requests are unverified.

Three actual tops-card links supplied these opened product documents:

- Learning A: [ASOS DESIGN polka-dot mesh top](https://www.asos.com/asos-design/asos-design-floaty-mesh-flutter-sleeve-top-with-tie-back-detail-in-brown-and-white-polka-dot/prd/209904485). Route ID `209904485`; displayed product code `153532603`; brand ASOS DESIGN. The heading's brown/white colour wording and a main amount of `£24.00` were returned together. The amount appears twice in the remote text without distinct offer labels.
- Learning B: [ASOS DESIGN denim shirt](https://www.asos.com/asos-design/asos-design-denim-oversized-traditional-shirt-in-mid-blue/prd/210736526). Route ID `210736526`; displayed product code `156530552`; ASOS DESIGN; heading specifies mid blue; main amount `£34.00`, again duplicated.
- Hold out from later learning: [COLLUSION brown cap-sleeve T-shirt](https://www.asos.com/collusion/collusion-fitted-cap-sleeve-tshirt-in-brown/prd/211527698). Route ID `211527698`; displayed product code `159688280`; brand Collusion; main amount `£8.99`, duplicated. This provides a different brand for semantic comparison.

Inference: route ID and displayed product code need distinct fields. Neither is established as a family identifier or selected size SKU. Model-wearing size is model information, not a shopper selection. Colour in a heading is document wording until a selected-colour association is observed. Catalog “more colours” labels do not identify another variant. UK imagery and pound signs do not independently prove an explicit GBP contract. Omit selected SKU/size and currency until supported by capture; duplicated equal amounts do not establish current-versus-previous pricing or a promotion.

The remote documents include a browser-compatibility banner while returning readable catalogs/products. No challenge, auth wall, 403, 429 or robots restriction was exposed. Ordinary account links were not followed; no browser/transport adjustment was attempted.

## Zalando UK

Two indexed product leads were opened as primary documents:

- Learning A: [black Samba](https://www.zalando.co.uk/adidas-originals-samba-og-unisex-trainers-core-black-ad115o1o3-q11.html). Brand adidas Originals; article `AD115O1O3-Q11`; selected colour label core black; main advertised `£81.00`, reference `£89.99`, and a 10% reduction label. Size remained unchosen.
- Learning B: [white/cardboard Samba](https://www.zalando.co.uk/adidas-originals-samba-unisex-trainers-whitecardboard-ad115o1pp-a12.html). Article `AD115O1PP-A12`; selected colour white/cardboard. Search showed `£94.00` with 10% off, initial open `£84.00` with 20% off, and a later remote view `£104.99` without that reduction. This discrepancy is unresolved; none is a settled current price. A later view explicitly requested size selection.
- Hold out from later learning: [carbon Handball Spezial](https://www.zalando.co.uk/adidas-originals-handball-spezial-unisex-trainers-carboncarbongum-ad115p09y-q11.html), followed from the black Samba's recommendation link and opened. Article `AD115P09Y-Q11`; selected colour carbon/carbon/gum; main `£76.00`, reference `£94.99`, 20% reduction label; size unchosen.

These documents associate article labels and colour, but do not establish a size-specific SKU or broader product-family key. Preserve full sourced routes and returned article labels. Do not infer identifier grammar. Recommendation cards separately contain “From” prices and reductions qualified by “up to”; those are not the current product's selected offer. No explicit currency metadata was inspected. Locale is the observed UK route, not a guarantee of universal currency. Stock, delivery dates, seller fulfillment, store context and checkout totals are excluded. No access control was exposed in these remote results.

## Continuation and missing proof

After supported-route screening and fresh parent-owned resource admission, use each site's learning pair for genuine public frontend capture and reserve its linked third product for unseen semantic replay. Compare route/article/product-code identity, brand, colour association and offer labels. Start with metadata if selected-variant or currency proof remains absent. Keep category reads limited to the captured initial subset.

Both sites still require two captured examples, a credential-free learned request/extraction contract, unseen tier-1 semantic comparison, `verify`, fresh empty-home cookie-free reuse, export and `vetShared`. Remote research proves none of these. No `sites/` file was created. Parent owns catalog/state/runbook updates and all local validation. Stop either domain immediately if later evidence exposes an access control; no alternate host or transport workaround is authorized.
