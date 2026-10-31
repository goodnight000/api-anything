UNIQLO Denmark English public product metadata. No account is required.

`getProduct` takes both components from an existing product link. For
`https://www.uniqlo.com/dk/en/products/E489013-000/00`, use
`routeProductId=E489013-000` and `routeSuffix=00`. Keep the suffix as two digits,
including leading zeroes. Arbitrary identifier and suffix combinations are untested.

`routeProductId` and `routeSuffix` identify the route. The source names the latter
`priceGroup`; it does not establish a price amount or a selected color or size.
`displayedProductIds` preserves the source's full list of displayed item IDs. These
can differ from the route ID and can include several IDs for the same item.
`gender` is the source's category label. Composition and care are source text.

The operation reads the product document's embedded metadata. It does not return
prices, selectable variants, stock, delivery estimates, search results or catalog
coverage. Product-link query parameters such as `colorDisplayCode` are not inputs.
Only the Denmark English storefront was checked.

A category-navigation probe on 2026-10-28 received an Akamai challenge. Further
UNIQLO reads were stopped. The product cases below retain their 2026-10-26 evidence;
they were not freshly reverified after that stop.

## Maintainer notes

Qualified signed out on 2026-10-26 UTC. No private browser import or login occurred.
This batch reused genuine frontend document captures from the terminal
`home-apparel-qualified-r1` batch. `capture-document.mjs` allowed only the exact
requested GET document and aborted other requests. Inline scripts could execute;
this is document capture evidence, not a fully hydrated GUI or tested variant UI.

Source pages and captured GET request URLs:

- `https://www.uniqlo.com/dk/en/products/E489013-000/00`, capture
  `cmvp5inuvb11ebe`, document 1, HTTP 200, 46 exchanges with 45 aborted.
- `https://www.uniqlo.com/dk/en/products/E422992-000/02`, capture
  `cmvp5j75n11a298`, document 1, HTTP 200, 47 exchanges with 46 aborted.

Learning used those two differing examples. Slots are `path:3` and `path:4`;
the matcher is GET `www.uniqlo.com`, `/dk/en/products/*/*`. The embedded recipe
anchors `pdpEntity` and wildcards its varying map key. Offline reinspection found
one matching product object in each captured document.

The independently downloaded held-out source was
`https://www.uniqlo.com/dk/en/products/E465185-000/00?colorDisplayCode=39`.
Its canonical link is `https://www.uniqlo.com/dk/en/products/E465185-000/00`.
Before replay, visible main-heading and paragraph text established the AIRism
Cotton Oversized Crew Neck T-Shirt identity, all five displayed IDs
`489927,493232,482295,475355,465185`, composition and care. The document title
established Unisex. The tier-1 replay of the canonical route matched every returned
field, with gender compared without title capitalization. No color behavior was
inferred from the source query.

`verifySite` with `maxTier: 1` passed all three product routes, without healing.
The verification record matched the current local operation hash
`d006477e75cc29c6` before export. Export kept public examples and reported zero
secrets and warnings. Export substitutes parameter placeholders into the stored
request, so the exported request differs from the local captured template.
An initially empty isolated home loaded that export and replayed the held-out
product at tier 1 with identical data, no Cookie or Authorization header and no
browser profile. Direct `vetShared` over the saved spec and these notes returned
zero errors and warnings. The coordinator owns integrated repository checks.

Receipts are under ignored `bench/explore/state/discovery/uniqlo-finalize-r2/`:
`audit.json`, `unseen-comparison.json`, `verify.json`, `current-hash.json`,
`export.json`, `fresh-initial.json`, `fresh.json` and `vet-saved.json`.
Capture files and held-out source remain under the preceding batch's evidence
directory. See `docs/research/discovery/uniqlo-finalize-r2.md` for resource limits
and cleanup. No publication was performed.

Discovery continuation on 2026-10-28 UTC stopped on the first grounded category
document, `https://www.uniqlo.com/dk/en/men/tops`. Its literal link came from
the retained product capture `cmvp5inuvb11ebe`, whose raw file hash was checked
against the previous report before inspecting navigation. The exact-GET browser
capture returned HTTP 200 with an Akamai behavioral challenge and no category
content. The helper reported `ok: true`; its status and existing bot-wall check
did not identify this challenge. A separate core document judgment returned
`drift` for missing title data and immediately persisted a stop before any further
send. Raw inspection established the challenge. No alternate route or transport,
second capture, unseen replay, fresh-home call or live verification followed.

No discovery operation was added. `getProduct` and its three public cases are
unchanged. This run adds no current live reuse proof for them. The brand stop
applies across UNIQLO consumer routes and transports. See
`docs/research/discovery/uniqlo-discovery-qualified-r1.md` for exact receipts,
hashes and the missing gates. Integrated checks remain with the coordinator.
