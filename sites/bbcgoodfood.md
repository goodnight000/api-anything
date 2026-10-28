Search signed-out Good Food recipes with `search(q)`, then pass a recipe URL's final path segment to `getRecipe(slug)`.

Search covers the first page, normally up to 30 recipes. It follows the site's relevance search, which can return loosely related recipes for nonsense queries. An empty result is not established by these checks. Ratings are the site's displayed text. Detail timings use ISO 8601 durations; servings can be a number or text. Nutrition is supplied by the publisher. Some fields can be absent on individual recipes.

## Maintainer notes

Verified signed out on 2026-10-26 UTC. No everyday browser import, login, site write, or challenge interaction. Sources are the frontend's public document responses, learned with the repository CLI. No endpoint was inferred or exchanges fabricated.

`search` uses the homepage's GET `/search` form with query field `q`. Sources and exact browser requests were `https://www.bbcgoodfood.com/search?q=chicken` and `https://www.bbcgoodfood.com/search?q=salmon`. Actual capture IDs are `cmvp295rf` and `cmvp2989t`. Both captured pages returned 30 distinct recipe cards. The HTML recipe reads recipe articles inside `.search-results`.

`getRecipe` reads the Recipe JSON-LD in the document's `data-testid="page-schema"` script. Sources and exact browser requests were `https://www.bbcgoodfood.com/recipes/chicken-chorizo-jambalaya` and `https://www.bbcgoodfood.com/recipes/crunchy-garlic-chicken`. Actual capture IDs are `cmvp2b4a3` and `cmvp2b7fu`. Both captures differ in title, ingredients, and recipe identity.

Unseen tier-1 replays were `search q=beef` and `getRecipe slug=beef-bourguignon`. All 30 beef result title/URL pairs matched a separate public document read; every title contained beef. The detail replay matched the public Recipe schema identity, all 14 ingredients, all 10 steps, total duration, and servings. `verify bbcgoodfood` passed six tier-1 cases: both stored examples plus search salmon/beef and detail crunchy-garlic-chicken/beef-bourguignon checks. No failures or inconclusive cases.

Evidence root: `bench/explore/state/discovery/recipes-r2/`. Capture files are in `bbcgoodfood-home/captures/`. Exact command, result, and resource logs use the `bbc-add-search-retry1`, `bbc-add-detail`, `bbc-search-beef`, `bbc-detail-beef-retry1`, and `bbc-verify` prefixes. `bbc-meaning.json` records exact semantic assertions against retained public source documents. Local admission failures and exploratory nonsense-query results remain in the same root. No empty expectation was recorded because three nonsense queries returned site results.

Scope excludes pagination, filters, account features, and recipes requiring a subscription. Recipes and availability can change.

Export used `export bbcgoodfood --keep-examples --out sites/bbcgoodfood.json`, with zero warnings. A new `bbcgoodfood-fresh-home` initially contained only the exported spec. Both operations replayed with the same unseen beef inputs at tier 1, with no session file, cookies, stored values, browser profile, or credential refs. `bbc-fresh-search.json`, `bbc-fresh-detail-retry1.json`, and `bbc-fresh-evidence.json` preserve the evidence. Direct `vetShared` on the export and complete notes returned zero errors and zero warnings, recorded in `bbc-vet.json`.
