`getStoreDetails(store)` reads public visit-planning details for an IKEA US English Store page.
Copy the final segment, such as `houston`, from an actual `/us/en/stores/` Store link in
https://www.ikea.com/us/en/stores/. Pickup facilities and plan-and-order locations are not qualified.
The address includes the store name. Hours retain department scope, retailer day/time wording,
variable-hours notices and dated holiday exceptions. `clickCollectHours` describes public hours
only; it does not perform pickup or establish order eligibility. Småland may have variable hours.
`closed` and `specialStoreHours` retain their actual dates; do not turn them into permanent schedules.
Text comes from the document at request time, with whitespace collapsed; adjacent inline date/time
text may touch. No timezone, open-now status, stock, delivery eligibility or booking is inferred.

`listCategoryProducts(category)` reads initial product cards. Copy the full final category segment,
such as `bookcases-10382`, from an existing `/us/en/cat/` link. This is a partial initial page;
pagination, filters, category prices and stock are not covered. Product numbers are opaque strings,
sometimes starting with `s`; preserve them. A returned product URL supplies the slug for `getProduct`.

`getProduct(slug)` reads public product metadata and national online price. Copy the full last segment
of an existing `/us/en/p/` URL, including its article number. No ZIP or store is selected for product
prices. USD prices may differ from special member offers or checkout. Dimensions retain retailer
text and units; a double quote means inches. Some dimensions can be absent.

No account or API key is needed. All three operations are fixed to US English. Product search,
other countries, local inventory, purchase, pickup actions, event booking and restaurant menus are
outside this spec.

## Maintainer notes

The original `getProduct` and `listCategoryProducts` parsed operation objects are preserved exactly.
Their signed-out qualification and seven-case tier-1 verification are recorded in
[the category parent report](../docs/research/discovery/ikea-parent-depth-r4.md), including original
product capture provenance and the category A/B/C examples. Those historical receipts remain
separate from the current all-read rerun.

Selected-store qualification used genuine frontend GET documents for Houston and Orlando, with
paired CLI learning and meaningful differences in identity, address and hours. Source/request URLs
are https://www.ikea.com/us/en/stores/houston/ and https://www.ikea.com/us/en/stores/orlando/.
Houston's retained capture is `cmvq6ytsrf073a1:1`; Orlando's new capture and exact provenance are in
[the round 2 report](../docs/research/discovery/ikea-stores-qualified-r2.md). The unchanged exact-GET
helper aborts other requests and has a 15-second trigger timeout. This is document evidence, not
hydrated GUI proof. Both captures sent neither Cookie nor Authorization; no private profile or
cookie import occurred. The visible department sections and dated exceptions, rather than regular
JSON-LD hours alone, define this operation's contract.

The exact final candidate with these notes passed a zero-issue export/credential/vetShared preflight
before opening the reserved Emeryville document. The report records all claimed-field source
comparisons for A/B/C, the exact-version first API call from an initially empty isolated home,
actual header-presence receipts, later site-issued guest cookies, all-read maxTier-1 verification,
final operation hashes and final exports/scan/vet. Local invalid-slash checks prove input bounds;
they do not claim live not-found behavior. No healing, login, private session, or publication was used.
Final JSON and notes are accepted only with those exact-version proofs. Integrated registry, lint
and type checks are parent-owned and are reported separately.
