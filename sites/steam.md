No account or API key is needed. Searches the public Steam storefront and returns its first
page, up to 50 products. Products can include games, demos, soundtracks, packages and bundles.
The `itemKey` prefix identifies the kind, for example `App_504230` for Celeste. Store URLs can
include Steam's own tracking query parameters.

Prices and release dates retain the store's displayed text. Currency, availability, language,
ranking and content filters depend on Steam's signed-out regional defaults. A price may be
absent for a product not currently sold. No region override, pagination, account library,
reviews, product-detail or purchase operations are included.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using a new isolated browser profile, with no everyday
browser-cookie import. The learner's guest-session heuristic initially marked the operation
logged in; metadata was corrected because no login had occurred, then checked with a separate
fresh-home replay. No credentials or session slots are required.

Real browser captures `cmvp125w6` and `cmvp127ku` came from the source CLI's two-example add
at `https://store.steampowered.com/search/?term=portal` and the same page with `term=stardew`.
The operation reads the public search document itself. The request matcher uses GET, the
store host and `/search/`; no rotating identifier is pinned. Learning had no warnings and
retained tier 1.

The unseen `term=celeste` replay returned Celeste, `App_504230`, with its matching store URL
at tier 1 in 342 ms. Its identity differs from the Portal example. The first negative check
found that Steam omits `#search_resultsRows` entirely when no products match. A separate
public request confirmed HTTP 200 and "0 results match your search" with no result links.
The recipe was adjusted to the parent `#search_result_container`, observed in both layouts.
Offline extraction preserved 50 Portal rows and correctly recognized the empty layout.

Final verification passed three cases at tier 1: Portal returned results in 495 ms, Celeste
returned results in 739 ms, and nonsense `term=zzqxwyvpr` returned an empty list in 930 ms.
The negative expectation was preserved while the selector was repaired. No core code changed.
Export retained public examples and completed the secret scan without warnings.

The exported spec replayed unseen `term=hades` from a separate fresh home with no captured
or imported cookies. It returned Hades, `App_1145360`, at tier 1 in 1875 ms. Final shared
vetting of the spec and these notes returned zero errors and zero warnings.

The [discovery report](../docs/research/discovery/broad-search.md) records the run. Raw browser
exchanges and response documents remain local and are not part of the shared spec.
