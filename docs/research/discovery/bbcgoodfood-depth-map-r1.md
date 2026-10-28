# BBC Good Food source-only depth map, round 1

2026-10-27 UTC. Background preparation for the existing saved site while JYSK/IKEA/Nike qualification remains resource-deferred. No new operation was qualified. Only this report was written.

## Decision and access boundary

The useful next group is collection-directory discovery, selected-collection recipe listings, and continuation/filter support within the existing search operation. Search page two is an extension, not a separate operation. Collection listings can supply recipe identities to the existing `getRecipe(slug)`.

Further remote discovery is now stopped. Two already-submitted requests in the same remote-tool batch failed:

- `https://www.bbcgoodfood.com/search?q=salmon`: `Internal Error ()`; `URL https://www.bbcgoodfood.com/search?q=salmon is not accessible via this tool.`
- `https://www.bbcgoodfood.com/feed/atom/`: `Internal Error ()`; `Failed to fetch https://www.bbcgoodfood.com/feed/atom/: (400) OK`.

These are repeated tool retrieval errors across two routes, not repeated failures of one URL. Origin HTTP status, headers, cause, authentication, rate limiting and challenge presence are unknown. The contradictory tool wording `(400) OK` is not an established origin HTTP 400. Neither request was retried. Stop scope for the coordinator: BBC Good Food brand discovery across routes, aliases, subdomains and transports, including `bbcgoodfood.com`, `www.bbcgoodfood.com` and observed `tollbit.bbcgoodfood.com`. Do not switch transport or automatically requeue these leads. This source stop does not establish failure of either saved operation. No shared stop ledger was edited.

Public listings included subscription promotions and some explicitly premium cards. Those destinations were not opened. Incidental account/subscription navigation does not establish that public collection or search data requires authentication.

## Baseline and provenance

Read the runbook and state first. Runbook SHA-256 matched the assignment: `4a52052d2f19d03efda45af808b2db4349e8bf4845e7ba55db046d893a96eeaa`. Inspected all recorded host stops and aliases before remote work. No BBC Good Food stop was recorded then. Hays and Eventbrite stops were preserved; neither brand was requested.

Current files, unchanged:

- `sites/bbcgoodfood.json`, SHA-256 `40d186d73f345b191b3850e616c23123f79cacc3e1d3cecfd111bda8fbcf01ae`.
- `sites/bbcgoodfood.md`, SHA-256 `1d3a43c1c6225b990ea42cc72a5c7f90e9c170e55c3f81bd51e4760802997eed`.

The saved `search(q)` extracts first-page recipe title, URL, rating and rating-count text. `getRecipe(slug)` extracts the public Recipe schema. Prior qualification is recorded in `docs/research/discovery/recipes-r2.md`; this run did not repeat it. The notes explicitly exclude pagination, filters and subscription-only recipes. Prior nonsense queries returned loosely relevant results; no zero-result guarantee follows.

Remote capability was available as `mcp__codex_apps__search_service_web_run`. Used its search and document-open actions only. No browser of any kind, local network command, capture, learning, replay, export or vet was run. Remote sources can be indexed/cached extracts; crawl freshness is not current origin-response proof. No cookie import or account action occurred.

Retained public source documents under `bench/explore/state/discovery/recipes-r2/` were read locally:

| Retained file | SHA-256 | Relevant evidence |
|---|---|---|
| `bbc-home-2.html` | `8eb5abae6fb3740da585f1b227859226c2f15dad36aa71080782681c77c447c8` | Public navigation, category/collection hrefs, search form and linked Atom feed |
| `bbc-search-chicken.html` | `3d61dd50e08c9d94e3653b2d384c6457ba10e71fe788a7615f2bc345cf371d65` | Search form, initial identities, filter/sort metadata, literal next URL and recipe hrefs |
| `bbc-search-beef-source.html` | `903457c0f0599fd6153d4abb08dc5cc083b606ed758ca1cc4bddc1730753ebb4` | Differing search identities, total and literal next URL |

The existing recipe-detail receipts suffice for detail shape. No recipe-detail destination was opened remotely in this run.

## 1. Extend search with observed continuation and refinements

Useful for retrieving recipes beyond the initial results and narrowing a large query. This belongs to `search`, whose saved arguments currently expose only `q`.

The retained public HTML has a GET form with `action="/search"` and text input `name="q"`. The placeholder accepts recipes, guides and other content. A visible `Load next` button has `data-component-variant="search-results-load-more-button"`. The HTML's `__NEXT_DATA__` contains `props.pageProps.searchResults`, including `items`, `totalItems`, `limit`, `nextUrl` and `previousUrl`.

| Example | Public input document | Observed initial identity | Observed continuation metadata |
|---|---|---|---|
| A | `https://www.bbcgoodfood.com/search?q=chicken` | Chicken & chorizo jambalaya, `https://www.bbcgoodfood.com/recipes/chicken-chorizo-jambalaya` | `totalItems=360`, `limit=30`, `previousUrl=null`; literal `nextUrl` is `https://www.bbcgoodfood.com/api/search-frontend/search?search=chicken&page=2` |
| B | `https://www.bbcgoodfood.com/search?q=beef` | Chinese-style braised beef one-pot, `https://www.bbcgoodfood.com/recipes/braised-beef-onepot` | `totalItems=317`, `limit=30`, `previousUrl=null`; literal `nextUrl` is `https://www.bbcgoodfood.com/api/search-frontend/search?search=beef&page=2` |

Both next URLs are exact retained-source strings, not invented templates. Neither was requested. They identify frontend implementation metadata, not a documented supported public API. Page-two identities, response shape, pagination termination, duplicate behavior and query preservation remain unknown. Do not assume that adding `page` to the public search-document URL works.

Reserved C is the novel free-text query `lentil pumpkin barley stew`. It was not submitted to site search. A future continuation test must obtain its continuation from the actual UI/source rather than transplanting A/B parameters.

Observed source filter metadata names include `author`, `calories`, `servings`, `totalTime`, `cuisine`, `diet`, `difficulty`, `mealType` and `ratings`. Examples actually present in chicken metadata include `difficulty` option `easy`, `totalTime` option `lt-1800` with an under-30-minutes label, and `calories` option `lt-250`. Sort metadata pairs labels with `relevant`, `published`, `rating` and `quickest`. These are observed metadata values, not proven query parameters or promises about nutrition, servings, timing or filter composition. No filtered A/B submission was performed. Visible search content tabs include recipes, video, guides, recipe collections, glossary and reviews; their request wiring is unestablished.

Initial search is likely SSR: retained HTML contains cards and embedded metadata. Continuation and refinement are likely interactive: a button and a separate next URL are present. No GUI activation, browser request trace or independent continuation result supports stronger claims. Missing gates include actual request capture for differing continuation/refinement choices, response extraction, identity checks and heldout continuation, in addition to the common gates below. Existing unfiltered A/B examples do not qualify filters.

## 2. Discover collection directories by public category

Useful for finding editorial collections by cooking intent without knowing collection slugs. Distinct from recipe keyword search: the result entities are collections, with category-specific descriptions, rather than individual recipes. One category-directory workflow should cover differing categories instead of creating a wrapper per category.

The retained homepage/navigation links directly to both A and B and supplies a genuine unopened C:

| Input | Literal source URL | Public observations from remote document extract |
|---|---|---|
| A | `https://www.bbcgoodfood.com/recipes/category/dietary-needs-collections` | Dietary-needs heading; 42 collections; displayed range 1–24; linked entries include gluten-free recipes and gluten-free cake recipes; `Load next` text |
| B | `https://www.bbcgoodfood.com/recipes/category/cuisine-collections` | Cuisine heading; 82 collections; displayed range 1–24; linked entries include American recipes and British; `Load next` text |
| Reserved C | `https://www.bbcgoodfood.com/recipes/category/special-occasion-collections` | Actual retained navigation href under occasion recipes/special occasions. Destination left unopened. |

Sources A/B are the literal URLs above. The remote reader reported A redirected to `https://tollbit.bbcgoodfood.com/recipes/category/dietary-needs-collections`; B retained its `www.bbcgoodfood.com` URL. This is evidence of the reader's observed retrieval route, not proof of a browser-wide domain migration. No `goodfood.com` alias or locale equivalence was established or tested.

Observed extractable fields are heading, collection total, displayed range, collection-card title/link and editorial description. A/B category choices produced distinct content. The reader rendered title links but did not expose all destination href strings in its text response; do not derive collection slugs from those labels. Future source inspection/capture must retain those literal destinations before building the next chain step.

Likely SSR initial content, based on readable titles/descriptions without browser interaction. Continuation appears interactive because `Load next` is text without a destination in the extract; no cursor, parameter, page size guarantee or next request was established. Missing gates include full literal href extraction, A/B collection identity comparison, valid category handling, C replay, pagination and the common gates below. Counts are source snapshots, not fixed limits or complete inventory promises.

## 3. List recipes in a selected public collection

Useful for coherent menus such as make-ahead cooking and family dinners. Distinct from keyword relevance search because an editor selects the collection membership. It should return genuine recipe links that feed `getRecipe`, while preserving premium markers and excluding unavailable details from public-detail promises.

Both selected collection URLs occur as actual links in retained public navigation:

| Input | Literal source URL | Observed A/B result identity and range |
|---|---|---|
| A | `https://www.bbcgoodfood.com/recipes/collection/batch-cooking-recipes` | 95 recipes; displayed 1–24; linked cards include Sausage ragu and Pulled chicken & black bean chilli |
| B | `https://www.bbcgoodfood.com/recipes/collection/quick-and-easy-family-recipes` | 105 recipes; displayed 1–24; linked cards include Creamy chicken pasta and Mustard-stuffed chicken |
| Reserved C | `https://www.bbcgoodfood.com/recipes/collection/air-fryer-recipes` | Actual retained navigation href labelled Air fryer ideas/recipes. Destination left unopened. |

Sources are the two A/B public collection URLs above. Both were readable remote document extracts. They contain titles, recipe links, rating/count text, displayed durations, difficulty labels and optional diet labels. Both have `Load next`; no continuation request was captured or opened. Public pages mix ordinary and premium/app-only cards. Premium detail destinations were not followed; a card's presence cannot establish public detail availability.

Concrete chain evidence without opening details:

- Collection A visibly links Pulled chicken & black bean chilli. Retained chicken search independently supplies the exact href `https://www.bbcgoodfood.com/recipes/pulled-chicken-black-bean-chilli`, yielding existing detail argument `slug=pulled-chicken-black-bean-chilli`.
- Collection B visibly links Mustard-stuffed chicken. Retained chicken search independently supplies the exact href `https://www.bbcgoodfood.com/recipes/mustard-stuffed-chicken`, yielding `slug=mustard-stuffed-chicken`.

The remote collection extracts establish linked titles; the literal href strings above come from retained search anchors for those identities. This triangulation is source mapping, not proof that collection extraction or either detail call currently succeeds. A future captured collection must confirm the exact card href itself and then test the chain.

Likely SSR initial cards, supported by readable document extracts and the site's retained SSR recipe-search behavior. Collection-specific raw HTML was not captured here, so exact SSR selectors remain unknown. Continuation likely needs interaction; no guessed page parameter, cursor or endpoint is proposed. No nutrition/serving/filter guarantee follows from labels. Missing gates include literal collection-card href extraction, premium-card treatment, A/B membership meaning checks, unseen C and chain verification, continuation termination and the common gates below.

## Supported-interface screen and deferred alternatives

The retained site's footer links an official Atom feed at `https://www.bbcgoodfood.com/feed/atom/`, labelled as RSS. This is an established published navigation link worth screening before duplicating recent-content discovery. Its one remote open failed as recorded above; schema, content coverage and usability remain unknown. It does not establish collection, search or pagination support. No second feed URL was invented or tried.

Bounded indexed searches for an official recipe API/developer interface and RSS/feed support returned primarily collection and official app pages, including `https://www.bbcgoodfood.com/get-bbc-good-food-app` and `https://www.bbcgoodfood.com/bbc-good-food-app-faq`. No supported, credential-free public recipe API documentation was established. These app pages were not opened or used to sign up. Absence in this bounded screen is not proof no interface exists. The literal search frontend next URLs are implementation evidence, not supported API documentation, and were not called.

Guides are a lower-priority distinct lead: retained navigation links `https://www.bbcgoodfood.com/howto/guide/what-to-cook-for-dinner`, and public search exposes a guides tab. That is insufficient for a grounded two-example guide workflow, so no additional operation is proposed. Collection discovery and extending the saved search offer the clearer next work. The indexed flat collection archive is also unnecessary to duplicate before the grounded category directories are tested.

## Missing qualification gates and cleanup

Every proposed extension remains source-only. After an explicit resolution of the new stop, qualification still needs fresh resource admission, exclusive browser admission where applicable, actual public frontend captures with differing A/B inputs, CLI learning from those exchanges, independent identity/meaning checks, heldout C replay at tier 1, and validation of continuation/filter semantics where claimed. Do not fabricate exchanges from remote tool extracts.

Then run offline candidate `vetShared` preflight, verify all read operations in any changed exact export, export with examples, and prove each newly added operation's first call from an initially empty home containing that exact final export. Record absence of Cookie/Authorization on the first request and distinguish any later guest cookies. Complete final exact-JSON-and-notes vet plus coordinator-owned registry/type/lint gates. Retain provenance, signed-out status, runtime limits and exact hashes. Saved qualification cannot be transferred to a changed export or inferred from this report.

No local service, browser, detached process, session home or lock was created. Only short local file-reading/hash commands and the report write ran. No persistent process requires cleanup; no unrelated process or lock was touched. Current site JSON and notes remain byte-identical. Shared state, helpers, source, dependencies, commits, PRs and publication were untouched.
