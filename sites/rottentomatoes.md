No account or API key was needed for the verified calls. `searchMovies` returns the first movie section of the public search page, up to ten fuzzy matches, with no pagination. Results can match cast or other metadata, so a title need not contain the query.

`getMovie` takes the slug after `/m/` in a search result URL. `tomatometer` is the percentage of positive professional critic reviews, not a mean star rating or an audience score. It can be blank or absent when unrated. `dateCreated` is the site's JSON-LD property and is not guaranteed to mean a worldwide release date. Review text, audience ratings, TV pages and streaming availability are not included.

## Maintainer notes

Verified signed out on 2026-10-26 UTC with an isolated api-anything profile and no imported browser session. The worker profile started empty. The learner marked the fresh visitor logged in because guest analytics/session cookies matched its heuristic; that metadata was corrected. A separate fresh home replayed the exported search and detail specs at tier 1 in 327 ms and 263 ms respectively, with no captured or imported Rotten Tomatoes cookies.

Search frontend captures: `cmvp0mnha`, request 1, for `q=Inception`; `cmvp0omzz`, request 1, for `q=The Matrix`. Source pages and captured requests are GET `https://www.rottentomatoes.com/search?search=Inception` and the same page with `search=The%20Matrix`. The recipe reads only movie rows in the server-rendered document, avoiding analytics requests that echo the page URL. The two-run diff had no warnings.

The unseen `q=Interstellar` replay succeeded at tier 1 in 195 ms. The first result was the 2014 film, with canonical URL `/m/interstellar_2014`, matching the public search page. It replaced Inception, the 2010 example. `getMovie` was learned from real frontend captures `cmvp0q2dk` and `cmvp0q4ax` at `https://www.rottentomatoes.com/m/inception` and `/m/interstellar_2014`. Its recipe reads the Movie JSON-LD script in the document, with no API endpoint or rotating query ID.

The unseen `slug=matrix`, taken from the captured Matrix search, replayed at tier 1 in 169 ms. It returned The Matrix, dateCreated 1999-03-31, the Wachowski directors and a critic score matching the captured search row. An earlier alias call using `the_matrix` redirected to `/m/matrix`; the saved check uses the captured canonical slug. `verify rottentomatoes` passed four cases, example plus a different-input result check per operation, all at tier 1, with no failures or inconclusive cases.

These operations fill signed-out movie identity lookup and public critic-score retrieval without app registration or API credentials. They use the public frontend's documents and are not presented as discovery of an official API. Official API product access, licensing and parity were not audited. The checks prove live data and different identities on this date; they do not freeze scores, ranking, or availability.
