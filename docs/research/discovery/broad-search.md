# Broad search and market/storefront discovery

2026-10-26 UTC. Parent-coordinator research, signed out, no imported everyday browser sessions.
Raw documents and captures remain under ignored `bench/explore/state/discovery/broad-search/`.

| Candidate | Initial public document | Observed result |
| --- | --- | --- |
| Google Search | `https://www.google.com/search?q=coffee+grinder` | HTTP-only source returned a script shell, not search rows. Actual frontend capture `cmvp10uic` subsequently reported a reCAPTCHA challenge with HTTP 429. Stopped; no operation learned. |
| Google Trends | `https://trends.google.com/trends/explore?geo=US&q=coffee` | HTTP 429, Error 429. Stopped after one request. No browser capture or API endpoint claim. |
| Yahoo Finance | `https://finance.yahoo.com/quote/AAPL/` | HTTP 200, real Apple Inc. quote document with matching headline. Frontend API capture and browserless replay remain pending. |
| Steam | `https://store.steampowered.com/search/?term=portal` | Verified and saved as `sites/steam.json` and caller notes. Real frontend captures, unseen replay, three passing verification cases and fresh cookie-free reuse. |

Initial HTTP receipts are dated 08:58:55 to 08:58:56 UTC in `summary.json`. Google Search's
browser capture completed around 09:00 UTC; `google-capture-coffee.log` holds the classifier
receipt. No attempts followed either Google site's rate or challenge response. No CAPTCHA was
solved and no alternate host or proxy was used. Ordinary HTTP availability alone is not treated
as proof of an extractable or reusable operation.

## Steam completion

The source CLI's two-example add captured actual public search documents `cmvp125w6` and
`cmvp127ku`. Their first rows were Portal, `App_400`, and Stardew Valley, `App_413150`;
each document supplied 50 products. A narrow document matcher ended the browser runs when
the search document answered. No rotating ID or signature was invented.

Unseen `term=celeste` returned Celeste, `App_504230`, at tier 1 in 342 ms. The first negative
verification correctly exposed a recipe issue: Steam removes the inner rows container on its
zero-results page. A separate signed-out HTTP 200 confirmed "0 results match your search".
The shared parent `#search_result_container` is present on both layouts, with no anchors in
the empty layout. Changing only the response selector preserved all 50 offline Portal rows
and recognized the empty layout, without weakening the negative expectation or changing core code.

Final `verifySite('steam', {maxTier: 1})` passed all three cases: Portal result, Celeste result,
and nonsense `zzqxwyvpr` empty. Export with public examples reported zero warnings. A separate
fresh home replayed unseen `term=hades` at tier 1 in 1875 ms, returning Hades, `App_1145360`,
without captured or imported cookies. Final spec and notes passed `vetShared` with zero errors
and zero warnings. The focused all-bundled-spec registry test passed after saving Steam.

Steam's guest session cookie caused the learner's login heuristic to mark the candidate logged
in. This was corrected to false based on the new isolated profile and confirmed by fresh-home
reuse. The shared spec has no credential or session slots. Prices and release dates are display
strings subject to the store's regional and language defaults. Only the first page is covered.

Receipts under the ignored broad-search directory include `steam-add.log`,
`steam-unseen-celeste.log`, `steam-verify.log` for the initial failure,
`steam-empty.html`, `steam-verify-final.log`, and `steam-fresh-hades.log`.
