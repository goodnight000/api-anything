No account or API key was needed for the verified calls. `searchSuggestions` expands words into public search suggestions. Results can also include public user labels, so inspect `type`; a `query` may be absent on those rows. Ranking and result count are controlled by Pinterest. Pin details and pagination are not included.

## Maintainer notes

Verified signed out on 2026-10-26 UTC with an isolated api-anything profile and no imported browser session. Pinterest's captured `_auth` was `0`, and the document context reported `is_authenticated: false`. The learner's guest-cookie login heuristic initially marked the operation logged in; that metadata was corrected to match the captured state.

Real frontend captures: `cmvp0kx36`, request 79, for `q=ceramics`; `cmvp0macc`, request 73, for `q=watercolor`. Source pages were `https://www.pinterest.com/search/pins/?q=ceramics` and the same page with `q=watercolor`. The frontend request is GET `https://www.pinterest.com/resource/AdvancedTypeaheadResource/get/`, carrying the query in decoded `data.options.term` and the source-page URL.

An unseen `q=origami` replay succeeded at tier 1 in 706 ms. Its suggestions concerned paper folding, replacing the pottery suggestions in the ceramics capture and painting suggestions in the watercolor capture. `verify pinterest` passed the example and the origami check, both at tier 1, with no failures or inconclusive cases. No site write was triggered deliberately.

The two-run diff found changing tracing headers and a timestamp. Replaying the first template with the second query succeeded, so the learner retained tier 1. Those are captured constants, not a reimplemented signature. No cookie or session slots are required. A separate fresh-home replay of the exported spec also returned origami suggestions at tier 1 in 356 ms, with no imported or captured cookies.

This operation fills the no-registration public search-suggestion workflow used by the frontend. It is not a discovery of an official API. Official API parity and licensing were not audited. Public pin search also appeared in the capture, but its anonymous result objects had opaque IDs and images without enough text for a strong meaning check, so it was not exported.
