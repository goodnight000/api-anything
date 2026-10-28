`getProduct(slug, productId)` reads a public Waitrose UK product document. Copy both inputs from the same product link, preserving leading zeros and hyphens. Mixing IDs and slugs is unverified. No login or store selection was used.

Prices and pack sizes are the text displayed in the returned document. The main item price may reflect a public promotion. Separate previous-price, multibuy and membership offer details are not returned. Do not infer eligibility or a regular price from the main price alone. No machine currency field is returned. These values do not establish checkout pricing, national pricing, stock, delivery coverage or freshness. Other layouts and regions are unverified; fields absent from the page may be omitted.

## Maintainer notes

2026-10-26 UTC, signed out. A/B exact-document captures cmvpmwkw6c3f2af and cmvpmx7hqc524eb, document request 1, used the unchanged capture-document helper under the global mutex. Only the exact GET document was allowed; other requests were aborted. Inline scripts could run. This is SSR document evidence, not a fully hydrated GUI claim.

Learning uses the semi-skimmed and skimmed 1litre products. The unchanged core parseShown and HTML extractor read visible product metadata; previous-price text is excluded. Detailed qualification, source links, exact arguments and resource evidence are in docs/research/discovery/uk-grocery-qualified-r1.md.

The category linked all three exact product URLs before the held-out soya detail was opened. Its independent category card matched the unseen tier-1 result on title, pack, main price, unit price and canonical URL. The exact exported version passed three tier-1 verification cases in the learning home and three in an initially empty home. The empty-home first call sent neither Cookie nor Authorization. Subsequent verification used only guest cookies issued by the site to that home. No healing, login, imported session, site write or publication occurred.
