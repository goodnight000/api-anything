# Allrecipes and additional commerce reconnaissance

2026-10-26 UTC. All traffic was signed out, with a fresh isolated browser profile and no
everyday user cookies imported. No site writes were chosen. No registry spec was produced.

## Allrecipes

The public search document at `https://www.allrecipes.com/search?q=chicken` returned HTTP 200
and real server-rendered recipe cards. Actual frontend capture `cmvp0qvij`, document request 1,
recorded the same public search. A second actual capture, `cmvp0rq4w`, document request 1,
recorded `q=salmon`, also HTTP 200. Both source captures remain under ignored
`bench/explore/state/discovery/coordinator-food/home/captures/`.

The useful repeated list is `.mntl-search-results__list a.mntl-document-card`. Its title is
`.card__title-text`, URL is the card's own `href`, category is `.card__content`'s `data-tag`,
and rating count is `.mntl-recipe-card-meta__rating-count-number`. Offline extraction from
the initial HTTP document found 24 cards. The first was Cream of Chicken Breasts at
`https://www.allrecipes.com/recipe/8858/cream-of-chicken-breasts/`; the last was Slow Cooker
Whole Chicken. This verifies the candidate selector on that document, not unseen-input replay.

Learning with both actual captures was refused by the existing credential protection. Its
error reports that the first path segment holds cookie `lb_ld` and the request URL holds
cookie `_li_dcdm_c`. No credential values or raw responses are included here. The guard was
left intact; captures were not sanitized to bypass it, and no handwritten substitute spec was
created. Unseen-input replay, verify, export and shared vetting were therefore not reached.

Local receipts are `capture-chicken.log`, `capture-salmon.log`, and `add-search.log` under
`bench/explore/state/discovery/coordinator-food/`. This is an engine-refused, captured lead,
not a reusable operation. Recipe detail operations remain uncaptured.

## Other HTTP-only leads

One public request per site was made at approximately 08:49:42 UTC. These are reconnaissance
documents, not discovered API endpoints or browser captures.

| Site | Source | Result |
| --- | --- | --- |
| Best Buy | `https://www.bestbuy.com/site/searchpage.jsp?st=coffee+grinder` | Read timed out after 20 seconds. No response identity established. |
| Home Depot | `https://www.homedepot.com/s/coffee%20grinder` | HTTP 403, Error Page. Stopped. |
| Costco | `https://www.costco.com/` | HTTP 200, Welcome to Costco Wholesale. The bounded reader retained up to 2 MiB. A CAPTCHA string occurs somewhere in the source; this alone does not establish that the visible page was a challenge. Search/detail and replay remain unknown. |

Raw bodies and summaries stay local under the same ignored directory. No retries, login,
challenge solving, proxy changes, site writes, or publication occurred.
