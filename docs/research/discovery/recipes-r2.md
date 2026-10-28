# Recipe discovery round 2

2026-10-26 UTC. Completed within the 20-minute, three-site budget. Order: BBC Good Food, Serious Eats, Food Network. Allrecipes was excluded and not revisited. No nested delegation, commits, pushes, publication, PRs, login, everyday-browser imports, site writes, challenge solving, or access-control bypass.

## Outcome

| Site | Status | Saved operations | Evidence limit |
|---|---|---|---|
| BBC Good Food | PASS | `search(q)`, `getRecipe(slug)` in `sites/bbcgoodfood.json`, with `sites/bbcgoodfood.md` | Six CLI verification cases pass at tier 1; both exported operations also pass cookie-free fresh-home tier-1 replay. No valid empty expectation established. |
| Serious Eats | BLOCKED | None | First signed-out homepage GET returned HTTP 403. Domain stopped immediately, with no browser capture or endpoint exploration. |
| Food Network | BLOCKED | None | First signed-out homepage GET returned HTTP 403. Domain stopped immediately, with no browser capture or endpoint exploration. |

No saved operation has failed or inconclusive verification. Coordinator-owned registry, type, and lint checks were not duplicated. The shared state, runbook, catalog, source, dependencies, and frozen site files were left untouched.

## BBC Good Food

Sources are public frontend documents. The homepage contains a GET search form with action `/search` and input `q`; the search document contains recipe cards; recipe pages contain a Recipe JSON-LD script identified by `data-testid="page-schema"`. The CLI learned requests from real browser exchanges. No HTTP response was converted into a fabricated capture, and no endpoint template was inferred.

| Operation | Two real examples and capture IDs | Unseen tier-1 replay | Exact meaning check |
|---|---|---|---|
| `search(q)` | `q=chicken`, `cmvp295rf`; `q=salmon`, `cmvp2989t` | `q=beef` | Both examples produced distinct sets of 30 recipes. Every unseen title/URL pair matched the independently read public beef search document, and all 30 titles contained beef. |
| `getRecipe(slug)` | `slug=chicken-chorizo-jambalaya`, `cmvp2b4a3`; `slug=crunchy-garlic-chicken`, `cmvp2b7fu` | `slug=beef-bourguignon` | Exact Recipe schema URL and title, all 14 ingredients, all 10 instruction steps, total duration, and servings matched the independently read public recipe document. |

Exact public source and captured request URLs:

- `https://www.bbcgoodfood.com/`
- `https://www.bbcgoodfood.com/search?q=chicken`
- `https://www.bbcgoodfood.com/search?q=salmon`
- `https://www.bbcgoodfood.com/search?q=beef`
- `https://www.bbcgoodfood.com/recipes/chicken-chorizo-jambalaya`
- `https://www.bbcgoodfood.com/recipes/crunchy-garlic-chicken`
- `https://www.bbcgoodfood.com/recipes/beef-bourguignon`

`add` reported minimum tier 1 and zero warnings for both operations, with `learnedLoggedIn: false`. The export contains only the query/path parameter slots, no credential refs. Public examples were retained with `export bbcgoodfood --keep-examples --out sites/bbcgoodfood.json`, which reported zero warnings.

CLI `verify bbcgoodfood` passed all six cases, all at tier 1:

- Search example `q=chicken`, plus result checks `q=salmon` and `q=beef`.
- Detail example `slug=chicken-chorizo-jambalaya`, plus result checks `slug=crunchy-garlic-chicken` and `slug=beef-bourguignon`.

The new fresh home initially contained only the exported spec. Cookie-free `search q=beef --max-tier 1` and `getRecipe slug=beef-bourguignon --max-tier 1` both passed, and both data values exactly matched the earlier verified replays. After both calls, the fresh home had no session files or browser profile. Direct `vetShared` on the exported schema and complete notes returned `errors: []`, `warnings: []`.

Limitations: first-page search only, normally up to 30 recipes. Pagination, filters, account features, and subscription-only recipes were not learned. Search follows the site's broad relevance behavior. Exploratory `q=zzqxvnofood2026`, `q=zzqxvnoplants`, and `q=zqxjkvb` returned four, 22, and six recipes respectively. The first query's public page explicitly reported four results. These are preserved exploratory results, not empty checks, and no empty assertion was invented. Timings and nutrition are publisher values; fields can vary or be absent on other recipes.

## Blocked domains

`https://www.seriouseats.com/` returned HTTP 403 at `2026-10-26T09:39:35.152309+00:00`, 9,887 bytes, HTML title `Internal Server Error`. Only that initial homepage request was sent. No browser capture or operation exists.

`https://www.foodnetwork.com/` returned HTTP 403 at `2026-10-26T09:40:16.525219+00:00`, 373 bytes. Only that initial homepage request was sent. No browser capture or operation exists.

These sites remain incomplete and should remain blocked in the coordinator's queue, rather than being retried on the next tick.

## Evidence receipts

All raw source documents, captures, exact commands, output, resource samples, failures, and assertions remain under ignored `bench/explore/state/discovery/recipes-r2/`. No raw response or guest-state dump was added to tracked notes.

| Evidence | Relative path under that root |
|---|---|
| Browser captures | `bbcgoodfood-home/captures/{cmvp295rf,cmvp2989t,cmvp2b4a3,cmvp2b7fu}.json` |
| Search learn | `bbc-add-search-retry1.command.json`, `.json`, `.resources.jsonl`, `.exit` |
| Detail learn | `bbc-add-detail.command.json`, `.json`, `.resources.jsonl`, `.exit` |
| Unseen search replay | `bbc-search-beef.command.json`, `.json`, `.resources.jsonl` |
| Unseen detail replay | `bbc-detail-beef-retry1.command.json`, `.json`, `.resources.jsonl` |
| Independent public documents | `bbc-search-beef-source.html`, `.meta.json`; `bbc-detail-beef-source.html`, `.meta.json` |
| Semantic assertions | `audit.mjs`, `bbc-meaning.json` |
| Registered result checks | `bbc-checks.jsonl` |
| CLI verification | `bbc-verify.command.json`, `.json`, `.resources.jsonl`; `bbcgoodfood-home/checks/bbcgoodfood.json` |
| Export | `bbc-export.command.json`, `.json`; `sites/bbcgoodfood.json` in the repository |
| Fresh cookie-free evidence | `bbc-fresh-search.json`, `bbc-fresh-detail-retry1.json`, `bbc-fresh-evidence.json`, `bbcgoodfood-fresh-home/` |
| Direct vetShared | `bbc-vet.json` |
| Blocked requests | `serious-home.meta.json`, `.html`, `.log`, `.resources.jsonl`; `food-home.meta.json`, `.html`, `.log`, `.resources.jsonl` |
| Resource and cleanup summary | `resources-summary.json`, `cleanup.json` |

Separate fresh site homes are `bbcgoodfood-home/`, `seriouseats-home/`, and `foodnetwork-home/`. The blocked-site homes remain empty. The cookie-free replay uses an additional `bbcgoodfood-fresh-home/`.

## Resources and cleanup

All network research and operational CLI commands used `python3 bench/discovery/resource_gate.py` with the default CPU admission 65%, memory admission 88%, CPU stop 85%, memory stop 90%. Four commands were denied admission with exit 75. Each was retried only once after at least 30 seconds, and each retry succeeded. No admitted command was watchdog-terminated. During denial waiting, only local preparation and inspection continued; already-issued independent commands completed.

Across 58 retained samples, CPU peaked at 88.61% on a denied admission, and gate-defined memory peaked at 88.32% during tier-1 verification. Both stayed below 95% at sampled times. Raw occupied RAM peaked at 99.76%; the runbook's memory metric excludes file-backed cache while retaining anonymous inactive memory and compressed memory. This is not a claim that raw occupied RAM or every unsampled transient stayed below 95%.

Browser commands used the atomic shared `browser.lock`; another worker held it during two detail-add attempts, so neither command ran. Only this worker's own token lock was released, after its command exited. Final inspection at `2026-10-26T09:40:54.021225+00:00` found no shared browser lock and no owned Chrome process using either BBC profile. No unrelated process was stopped. All original captures and failed/deferred logs remain preserved, including an initial local helper import-name error that sent no request.
