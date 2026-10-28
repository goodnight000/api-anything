# Public read discovery batch, October 2026

This batch adds40 site specifications with52 public read operations and152 saved example/check cases. Of those cases, 8 expect a local invalid-input refusal. Each JSON file has caller and maintainer notes describing its signed-out scope, real frontend evidence, checked arguments and limits. No runtime source or dependency changes are included.

Qualification was performed on October26–27,2026 against the exact saved exports using the then-current checkout. The linked reports distinguish real document captures, tier-1 replay, independent field-meaning checks, empty-home reuse, later guest cookies and failures. Document-only captures do not establish a fully hydrated GUI. These historical checks are not a new live health guarantee on every site. No live website requests were made to prepare this PR.

The four previously published Pinterest, Rotten Tomatoes, Rightmove and Steam specs are already on main and remain unchanged. JYSK is excluded: its later all-read verification failed on all three preserved operations, so it should not be promoted until repaired. [The failed qualification report](jysk-search-qualified-r3.md) retains that evidence without installing its search candidate. Unqualified specialization, product-metadata, comparison and event-policy source maps are not presented as APIs.

## Added interfaces

| Site | Operations | Saved cases | Later discovery limit |
| --- | --- | ---: | --- |
| [aldi](../../../sites/aldi.md) | `applianceDetails` | 2 |  |
| [apple](../../../sites/apple.md) | `getTechSpecs`, `listProductFamilies` | 8 |  |
| [auchan](../../../sites/auchan.md) | `getProductDetails` | 3 |  |
| [bbcgoodfood](../../../sites/bbcgoodfood.md) | `search`, `getRecipe` | 6 | Further source discovery stopped after remote-tool errors |
| [bing](../../../sites/bing.md) | `search` | 3 | Further source discovery stopped at partial hosted-results boundary |
| [chownow](../../../sites/chownow.md) | `getPublicMenu` | 2 |  |
| [costco](../../../sites/costco.md) | `getProduct` | 3 |  |
| [coursera](../../../sites/coursera.md) | `search`, `getCourse` | 6 |  |
| [craigslist](../../../sites/craigslist.md) | `search`, `getListing` | 6 |  |
| [disneyplus](../../../sites/disneyplus.md) | `getTitle` | 3 |  |
| [edx](../../../sites/edx.md) | `listCourses` | 3 |  |
| [eventbrite](../../../sites/eventbrite.md) | `getEvent`, `listFeaturedEvents` | 6 | Further source discovery stopped after remote-tool429 |
| [fandango](../../../sites/fandango.md) | `getMovie` | 3 |  |
| [flashscore](../../../sites/flashscore.md) | `resolveFootballPairMetadata` | 3 |  |
| [flixbus](../../../sites/flixbus.md) | `listStops`, `getRouteGuide` | 6 |  |
| [google-maps](../../../sites/google-maps.md) | `searchPlaces` | 3 | Further source discovery stopped at hosted JavaScript shell |
| [google-play](../../../sites/google-play.md) | `getApp` | 4 |  |
| [gumtree](../../../sites/gumtree.md) | `getListingMetadata` | 3 |  |
| [hays](../../../sites/hays.md) | `getJob` | 2 | Further source discovery stopped after hosted timeout |
| [healthline](../../../sites/healthline.md) | `getNewsMetadata` | 3 |  |
| [ikea](../../../sites/ikea.md) | `getProduct`, `listCategoryProducts`, `getStoreDetails` | 10 |  |
| [instacart](../../../sites/instacart.md) | `listStores` | 3 |  |
| [jet2holidays](../../../sites/jet2holidays.md) | `getDestination` | 2 |  |
| [justwatch](../../../sites/justwatch.md) | `listOffers` | 3 |  |
| [khan-academy](../../../sites/khan-academy.md) | `getCourse`, `listUnits` | 6 |  |
| [mcdonalds](../../../sites/mcdonalds.md) | `getProduct` | 2 |  |
| [meetup](../../../sites/meetup.md) | `eventSchedule` | 2 |  |
| [megabus](../../../sites/megabus.md) | `getRouteGuide` | 2 |  |
| [nasdaq](../../../sites/nasdaq.md) | `getStockInfo` | 3 |  |
| [netflix](../../../sites/netflix.md) | `getTitle` | 3 |  |
| [nike](../../../sites/nike.md) | `listProducts`, `getProduct`, `searchProducts`, `getSizeGuide` | 13 |  |
| [ticketmaster](../../../sites/ticketmaster.md) | `searchEvents` | 3 | Event-policy refinement stopped at hosted shell |
| [tradingview](../../../sites/tradingview.md) | `getInstrument` | 3 |  |
| [trip](../../../sites/trip.md) | `listHotels` | 2 |  |
| [ulta](../../../sites/ulta.md) | `getProduct` | 3 |  |
| [uniqlo](../../../sites/uniqlo.md) | `getProduct` | 3 |  |
| [vinted](../../../sites/vinted.md) | `getItemMetadata` | 2 |  |
| [waitrose](../../../sites/waitrose.md) | `getProduct` | 3 |  |
| [workday](../../../sites/workday.md) | `getJob` | 3 |  |
| [zalando](../../../sites/zalando.md) | `getProduct` | 3 |  |

Later hosted-source boundaries do not by themselves establish a failure of the saved read operation, origin HTTP status, authentication, CAPTCHA or rate limiting. They remain recorded limitations, and were not bypassed or retested for publication. The PR contains historical qualification evidence for those saved exports, not a claim that stopped workflows were freshly verified.

## Review and validation

The PR branch is based on main commit`428930613b13e8a79a9c5a51ae9d0b246de2c33b`. All added site JSON files were copied byte-for-byte from the completed discovery workspace and matched their recorded depth-coverage hashes. CI review corrected the edX/Workday maintainer headings and shortened Nike caller notes; the API JSON is unchanged. Historical notes hashes in qualification reports refer to the original qualification text. Raw response bodies, cookies, profiles, API homes, executable probes, machine runtime state, timer state and the discovery admission helpers remain outside the PR. The selected Markdown reports retain the evidence and its limits.

The initial1573c1d snapshot's exact40-site `vetShared` check passed with zero errors and warnings. A bounded publication-content audit found no provider/private-key patterns or literal Cookie/Authorization headers. The focused registry test was denied before startup by local resource admission, so CI must supply the current-branch registry, lint and type results. Historical passing checks in the reports retain their original date and revision; they are not silently treated as checks of this rebased branch.

CI on1573c1d passed lint, typecheck and the secrets scan. Its Node24 test job passed878 of879 tests; the only failure was the caller-note size limit. The follow-up fixes maintainer headings in edX/Workday and trims Nike caller wording, preserving every API JSON file and the2000-character test threshold. A UTF-16 character audit now places every bundled caller note within the limit. Local targeted runtime checks were denied before startup by resource admission; CI must validate this notes-only follow-up.
