`getProduct(productPath, sku)` reads a public US product document. Copy both inputs from the same Ulta product link. `productPath` is the complete segment after `/p/`, without slash or query. For example, use `productPath=niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111 sku=2551167`.

The family ID and SKU identify different things. The returned SKU, size and offer URL describe the item actually represented by the document; check them against the requested item. The checked larger niacinamide variant returned SKU `2614594`, `4.0 oz`, and `19.60 USD`, while the original item returned SKU `2551167`, `1.0 oz`, and `6.00 USD`.

`price` is the main advertised schema.org offer in the returned document, not a subscription amount, checkout total or delivery quote. Prices may change. Stock, pickup, store availability, delivery and reviews are outside this operation. No account or private browser session was used. Other product layouts, countries and currencies are unverified.

## Maintainer notes

2026-10-26 UTC, signed out. Real frontend document captures used experimental `bench/discovery/capture-document.mjs` with only the exact requested GET document allowed; other requests were aborted. Inline scripts could run. This is document evidence, not a fully hydrated GUI or a general proof of interactive size selection.

Original default-page capture `cmvp4y70cb9f6bc` was preserved and copied byte-identically with hash provenance. Its own canonical offer and 4.0 oz variant links grounded the selected learning and held-out requests. New learning captures are `cmvp5frzy06b94b` for niacinamide SKU `2551167` and `cmvp5ehrs313765` for glycolic-acid toner SKU `2551155`, document request ID 1 in each. Both returned HTTP 200. The source preparation report independently identifies the held-out larger niacinamide offer, while a conflicting search-indexed result was excluded as variant evidence.

The recipe reads the standalone Product JSON-LD, keeping productID separately from sku and the main offers object. Learning used two differing product families with no warnings and minTier 1. The unseen query argument `sku=2614594` was absent from learning examples. It returned the independently expected family, SKU, 4.0 oz size and 19.60 USD offer at tier 1 without healing.

Exact source and request URLs, operation arguments, tier-1 `verifySite` records, export, empty-home cookie-free reuse and direct vet receipts are in `docs/research/discovery/beauty-finalize-r3.md`. Raw captures and command evidence remain ignored under `bench/explore/state/discovery/beauty-finalize-r3/`. No private cookie import, login, site write or access-control workaround occurred.
