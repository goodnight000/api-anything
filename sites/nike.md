US English catalog, signed out, USD. No store, ZIP, delivery or membership context is selected. Prices can change; tax, shipping, discounts and local inventory are outside scope.

`listProducts(category)` takes the complete segment after `/w/` from a real Nike navigation link. It reads the initial shelf, with no pagination, scrolling or filters. Returned category is the card subtitle, not the input path.

`getProduct(slug, style)` takes both segments after `/t/` from one returned product URL; keep them together. Its canonical product-group URL may omit style. The offer is the first listed variant, not proof of stock, size availability, pickup or delivery. Other locales and page layouts are unverified.

`searchProducts(query)` copies one phrase into both q and vst; their separate meanings are unknown. It reads the initial shelf only. URLs are opaque identities; displayed prices are not final bag prices or stock promises. Relevance, all-word matching and empty-result behavior are unqualified. Empty input is rejected locally; other layouts can fail extraction.

`getSizeGuide(guide)` takes the segment after `/size-fit/` from official US navigation. Only the first embedded size-chart card and its tables are returned; guides without one are unsupported. It does not recommend fit. Output is capped near 20,000 characters.

Chart rows retain original arrays: cell zero labels the row and later indices align across rows. A missing `value` means a blank cell; preserve its position. Cell keys, row `system` and `measurements` identify units. Imperial and metric rows may coexist without using a toggle. CM/JP box-label size differs from measured Foot Length. No conversion or availability is inferred; titles/descriptions can be empty. Truncated output is partial and cannot be used as a complete aligned chart. Unknown-guide and empty-result behavior are unqualified; empty input is rejected locally.

## Maintainer notes

Verified 2026-10-26 UTC with a fresh isolated API_ANYTHING_HOME, signed out, without importing browser cookies. Real browser document captures used the repository's `bench/discovery/capture-document.mjs`: only the requested GET document was allowed, other requests were aborted. This proves the frontend document and its data, not a fully hydrated page. Both operations were learned through the CLI from two real captures, with zero add warnings and minTier 1.

Source/request URLs and captures:

- `https://www.nike.com/` supplied the category navigation links.
- `https://www.nike.com/w/mens-shoes-nik1zy7ok`, capture `cmvp2qnwl3206ec`.
- `https://www.nike.com/w/womens-shoes-5e1x6zy7ok`, capture `cmvp2qvw8ff1539`.
- Unseen `https://www.nike.com/w/kids-shoes-v4dhzy7ok`, capture `cmvp2rko50acb27`.
- The men's catalog supplied all three product URLs below.
- `https://www.nike.com/t/jordan-spizike-low-mens-shoes-E3tPjSZP/FQ1759-200`, capture `cmvp2s99ube452b`.
- `https://www.nike.com/t/air-max-metro-mens-shoes-bWvVBEWx/IW4935-102`, capture `cmvp2zbbz2ac966`.
- Unseen `https://www.nike.com/t/dunk-low-retro-mens-shoes-5FQWGR/IM4414-700`, capture `cmvp2zpzh26a775`.

`listProducts` was learned with category values `mens-shoes-nik1zy7ok` and `womens-shoes-5e1x6zy7ok`. Unseen `kids-shoes-v4dhzy7ok` returned tier 1 with 24/24 frontend identities, subtitles, displayed prices and URLs matching the captured document. Category cards identify `data-country="us"`.

`getProduct` was learned with slug/style pairs `jordan-spizike-low-mens-shoes-E3tPjSZP` / `FQ1759-200` and `air-max-metro-mens-shoes-bWvVBEWx` / `IW4935-102`. Unseen `dunk-low-retro-mens-shoes-5FQWGR` / `IM4414-700` returned tier 1. All extracted fields matched its frontend JSON-LD. JSON-LD adds SE to the Dunk name, while the visible heading and catalog omit SE. The product group ID and selected style match the frontend, and USD 130 matches the catalog card.

The real `verifySite` runner with maxTier 1 passed all six cases: each operation's example and its two public result checks. No empty-result or invalid-product semantics were established. Export retained the public examples. Both exported operations were then replayed at tier 1 from a separate initially empty home for each operation, without browser capture or imported cookies. Direct `vetShared` on the exported spec and these notes returned zero errors and warnings.

Raw captures, command receipts, field comparisons, verification results, fresh-home results and resource samples are local ignored evidence under `bench/explore/state/discovery/apparel-r1/`. The research report is `docs/research/discovery/apparel-r1.md`. No writes or authenticated/account operations were explored.


Search capture and learning 2026-10-27 UTC used a new isolated home and the unchanged exact-GET document helper, with all other requests aborted. These are frontend document captures, not hydrated GUI proof. Public search links supplied both q and vst; searchProducts fills them together and does not promise their independent meanings. CLI add used two real saved captures and an explicit document pick. Its two-place warning is retained in research, since both public query keys intentionally receive the phrase.

- A https://www.nike.com/w?q=basketball%20shoes&vst=basketball%20shoes , capture cmvq3z79qe67616.
- B https://www.nike.com/w?q=socks&vst=socks , capture cmvq41ozod2a065.
- Reserved novel C https://www.nike.com/w?q=reflective%20trail%20running%20vest&vst=reflective%20trail%20running%20vest , capture cmvq42lyn01d46e.

Each search document had a matching query heading and 24 cards. Recipes return displayed card text and product URLs; URL segments are opaque, and card subtitles are not a search taxonomy. No empty response or invalid-site-input response was observed. The exact export, operation hashes, field comparisons, first-request header-presence receipts and all-read verification outcomes are recorded in docs/research/discovery/nike-depth-qualified-r2.md, with raw files under bench/explore/state/discovery/nike-depth-qualified-r2/. Existing operation objects are preserved. No authenticated or write operation was attempted.


Size-guide learning on 2026-10-27 UTC reused genuine frontend GET document captures from https://www.nike.com/size-fit/mens-footwear and https://www.nike.com/size-fit/womens-footwear. The unchanged helper aborted other requests; this is document proof, not hydrated GUI or unit-toggle proof. Source GETs and capture A had no Cookie/Authorization. B sent isolated guest cookies, no Authorization. No private session was imported. Paired CLI learning preserved embedded arrays because HTML list extraction drops blank cells. Exact-version scans, held-out comparisons, cold-home headers, all-read verification, hashes and preservation proofs are in docs/research/discovery/nike-size-guides-qualified-r4.md. Raw evidence stays ignored. Later cold-home requests may carry site-issued guest cookies. No writes or login were attempted.
