`search(q)` reads the first signed-out organic web results page. Use a normal public search query.

`url` is Bing's result click URL, which may redirect through `bing.com/ck/a`; it is not guaranteed to be the destination's canonical URL. `snippet` is absent when Bing omits the ordinary text snippet. Ranking and wording vary by time and location.

Only ordinary organic result cards are included. Ads, answer panels, images, news, pagination, locale controls, and signed-in features are not covered. Stop on a challenge, sign-in requirement, or rate limit.

## Maintainer notes

Verified 2026-10-26 UTC, signed out, using a new API_ANYTHING_HOME and no imported cookies or login. Operation: `search(q)`.

Source pages and captured GET requests:
- `https://www.bing.com/search?q=python%20programming`, capture `cmvp2e5d0`, document request 1, HTTP 200.
- `https://www.bing.com/search?q=rust%20programming`, capture `cmvp2evqu`, document request 1, HTTP 200.
- `https://www.bing.com/search?q=javascript%20programming`, capture `cmvp2fwnb`, document request 1, HTTP 200.

Learned from the first two genuine frontend captures. The document matcher is GET www.bing.com /search; q fills the query parameter. Recipe: #b_results li.b_algo; h2 a supplies title and click URL, .b_caption p supplies the ordinary snippet. No credential references or rotating request IDs are needed.

An unseen `q=javascript programming` tier-1 replay returned 10 organic cards. All 10 destination identities and titles matched the third frontend document after decoding Bing's click URLs locally for comparison only. Nine displayed snippets matched in meaning; two differed only in whitespace. One MDN card omitted a snippet in both results. The exported operation returns the original click URL without decoding it or following it.

Browser-free verify with maxTier 1 passed the Python example plus public Rust and JavaScript result checks, 3/3. These recorded checks assert result presence; frontend comparison supplied the stronger identity and meaning evidence. No empty-result behavior was established. An initially nonexistent fresh home loaded the exported bundled spec and returned 10 JavaScript cards at tier 1, with no input cookies, stored session, or browser profile.

Export used --keep-examples and reported zero warnings. Direct vetShared on the exported spec and these notes returned no errors or warnings. Local evidence: bench/explore/state/discovery/web-search-r1/bing-*. Raw captures and responses remain ignored. No destination links were requested, and no site write or publication was performed.
