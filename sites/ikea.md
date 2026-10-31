`listStores()` reads the fixed public US English directory, in document order. It takes no
arguments. Only entries explicitly labelled "Store" are returned. Small stores, plan-and-order
points and pickup facilities are excluded. Names and links are literal source text; `store` is
the link's final segment for `getStoreDetails`. No state/metro, address or hours is inferred.
This is a directory snapshot, not a complete network inventory or distance ranking.

`getStoreDetails(store)` reads a linked Store page. Hours preserve department scope, variable-hours
notices and dated holiday exceptions. The address includes the store name. `clickCollectHours`
means public hours, not pickup eligibility. Småland may vary. Adjacent inline dates/times can touch
after whitespace collapse. Keep dates and literal text; no timezone or open-now calculation.
Selected layouts were checked; future department reordering can invalidate extraction.

`listCategoryProducts(category)` returns the partial initial category page. Copy the complete
`/us/en/cat/` final segment. Pagination, filters, category prices and stock are unqualified.
Product numbers are opaque strings, including `s` prefixes. Product links feed `getProduct`.

`getProduct(slug)` needs the complete final `/us/en/p/` segment including article number.
Price is national online USD without ZIP/store selection, and can differ from member offers or
checkout. Dimensions keep source units; a double quote means inches. Dimensions may be absent.

All reads are public, signed out, US English, without an API key. Search, other countries,
local inventory, availability, delivery, purchase, pickup actions, bookings and menus are outside
this spec. Invalid slash arguments are refused locally, without testing origin not-found behavior.

## Maintainer notes

Directory qualification is recorded in [the directory report](../docs/research/discovery/ikea-directory-qualified-r1.md).
Source and exact GET request URL: https://www.ikea.com/us/en/stores/ . On 2026-10-28 UTC,
two fresh genuine frontend document captures A/B used this same fixed request. There is no
varying parameter and no distinct third directory input. Actual addOperation selects the exact
GET document explicitly, with empty examples and no unproven parameter or warnings.

The exact public-example candidate and these complete notes passed offline vetShared before
reserved D was exposed. D is a later fresh whole-directory frontend snapshot, independently parsed
by semantic paragraph labels and literal links, compared row-by-row with a tier-1 result.
This tests fixed-input reuse over snapshots, not parameter variation. Atlanta is a separately
reserved unopened literal Store link for a directory-to-unchanged-getStoreDetails handoff.
All its fields must match independently labelled department/holiday sections, including absences.

The unchanged exact-document helper allows only the requested GET document, aborts other requests
and keeps its 15-second trigger bound. Captures prove document delivery, not hydrated GUI or
computed stylesheet visibility. Source labels, rather than slug geography or generic pickup links,
define inclusion. State/metro fields are deliberately omitted. No addresses or hours come from
the directory. No exhaustiveness, ranking, pagination or store inventory claim is made.

The first new API call uses an initially empty separate home containing exactly the candidate
export, with actual Cookie/Authorization absence recorded before fetch. Later cookies may be only
IKEA-issued guest cookies in that home. Native getSetCookie lines, including duplicate issuance,
are retained privately before serialization; reports disclose names and provenance without values.
All ten original stored cases and the no-argument directory example require maxTier-1 verification,
operation-specific core judgment, synchronous independent comparisons and current parsed opHash
records. Invalid/path cases must send nothing. No retry, healing, fallback or import is permitted.

All three original whole parsed operation objects and ten cases remain exact. Historical evidence:
[depth map](../docs/research/discovery/ikea-depth-map-r1.md),
[category parent](../docs/research/discovery/ikea-parent-depth-r4.md),
[store qualification](../docs/research/discovery/ikea-stores-qualified-r2.md),
[store parent](../docs/research/discovery/ikea-stores-parent-r1.md), and
[parked search](../docs/research/discovery/ikea-search-parent-r2.md).
Those reports retain previous capture provenance and limits. Search is not reopened.
Current artifact hashes and exact export/cold/final equality are in the directory report.
Parent-owned registry, lint, type and operation-count acceptance are separate gates.
