# McDonald's US qualification r1

Status: **BLOCKED by resource admission.** Two genuine public frontend document captures and a local tier-1 candidate were obtained. The held-out replay command was denied before launch on its initial attempt and all three permitted resamples. No reusable operation is qualified. No `sites/mcdonalds.json` or `sites/mcdonalds.md` was saved.

Work ran on 2026-10-26 UTC, with resource receipts from 14:49:50 through 14:58:15 and cleanup after that, within the twenty-minute batch. The shared dirty branch remained `t3/reverse-engineer-high-leverage-apis`, inspected HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, food-chains-source-prep-r1.md, relevant registry/report evidence, the unchanged document helper and resource gate. No existing McDonald's registry spec or competing McDonald's report was found.

Only this report and ignored task-local evidence were written. No nested agents, source/dependency edits, shared state/runbook/catalog edits, commits, push, PR, publication, private browser import, login, site write, store selection or access-control bypass occurred. Other sites, including the frozen Pinterest, Rotten Tomatoes, Rightmove and Steam files, were untouched. The parent owns integrated checks.

## Source and scope

The preparation report grounded the exact US national product links through the official full menu. Its bounded official-source search found a supported consumer nutrition calculator, but no readily usable documented US API or comprehensive current US download. This batch did not repeat that search or claim that such access does not exist.

The first local cookie-free GET of `https://www.mcdonalds.com/us/en-us/product/big-mac.html`, with manual redirects and a 15-second deadline, was initially resource-denied. After more than 30 seconds, its single retry ran and returned HTTP 200, 277,987 bytes, at `2026-10-26T14:50:42.547Z`. The repository `botWall` reported no challenge. This HTTP source read is not a browser capture.

Local source inspection and the repository's actual `extractHtml` parser established the SSR recipe before the 89% exact-document capture exception was used. `html` is the single item; fields read the product heading, canonical URL, document language, `#page-root` product identifier and `.cmp-product-details-main__description`. Source audit found no password input and found Big Mac identity plus its 580-calorie prose. The detailed nutrition and ingredient/allergen containers were empty. Their headings, generic allergen boilerplate and API URL attributes were not promoted to item values or used for extra endpoint requests.

The candidate's scope is national standard-product metadata and description prose. It does not establish detailed nutrients, complete ingredients, item allergen labels, serving weight, customized nutrition, restaurant stock, availability or current price. Descriptions may contain meal suggestions, promotions and price-related marketing text; these are retained publisher prose, not independently qualified prices or meal calorie values. The source's standard-formulation caveats and January 2022 boilerplate date do not establish a current formulation date.

## Genuine frontend captures

Both captures used the unchanged `bench/discovery/capture-document.mjs`, the 15-second document timeout, resource watchdog and atomic global browser mutex. Each returned the requested GET document at HTTP 200 and aborted the other 49 captured requests. Inline scripts could execute. This proves actual server-rendered document traffic, not a fully hydrated GUI or interactive nutrition controls. Redirects were unsupported and neither page redirected.

| Example | Exact source and captured request URL | Capture ID | Document ID | Result |
| --- | --- | --- | ---: | --- |
| A | `https://www.mcdonalds.com/us/en-us/product/big-mac.html` | `cmvpdlgxc5e67cc` | 1 | Big Mac®, product ID `200463`, 580-calorie prose |
| B | `https://www.mcdonalds.com/us/en-us/product/small-french-fries.html` | `cmvpdoim09b1967` | 1 | Small World Famous Fries®, product ID `200066`, 230-calorie prose |

Both saved documents were audited before subsequent work. The only answered exchange in each was HTTP 200, no password input was found, the helper reported no bot wall, and the target heading and expected calorie sentence were present. The fries prose also says 0 g trans fat per labeled serving; this was not converted to a detailed nutrient result. Small is part of the item identity. No other fries size was requested or qualified.

The isolated absolute `API_ANYTHING_HOME` was:

`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/mcdonalds-qualified-r1/home`

It began empty. The browser profile was task-local, with no everyday-browser import or account login. Captures preserve their actual evidence; no exchanges were fabricated from HTTP responses.

## Local candidate contract

`addOperation` learned `mcdonalds.getProduct(productSlug)` offline from the two genuine captures, using `big-mac` and `small-french-fries`. It reported zero warnings, `minTier: 1`, `learnedLoggedIn: false`, no credential-reference slots and no `unproven` mark. This is an unqualified local candidate, not a saved shared operation.

`productSlug` is the final path segment of a real US product link without `.html`, preserving size prefixes. The local format is `[a-z0-9]+(?:-[a-z0-9]+)*`, not an asserted exhaustive menu enum. Its single learned slot is `path:3`, template `{productSlug}.html`. The generated matcher names GET, host `www.mcdonalds.com` and path `/us/en-us/product/*`. No site-specific source code was added.

| Candidate field | Meaning |
| --- | --- |
| `name` | Product heading, with size and trademark text retained |
| `sourceUrl` | Canonical public product URL |
| `locale` | Document language, `en-US` in both captures |
| `productId` | Source `data-product-id`, distinct from the caller's URL slug |
| `description` | Product description prose, including calorie statements and any promotional/meal context |

No separate structured calories field was added. A local `result` check for Small Fries distinguishes the second example from the stored Big Mac example, but that check has not run. Local parameter descriptions and bounds are in the ignored candidate only.

## Missing qualification

The reserved held-out input remains `productSlug=egg-mcmuffin`, grounded in the preparation report by `https://www.mcdonalds.com/us/en-us/product/egg-mcmuffin.html`. That report observed the sandwich's 310-calorie prose and Canadian bacon context, distinct from its linked meal. No request to this third item was made in this batch and no independent comparison was executed. Those expectations remain prior remote source evidence, not a successful replay.

The `unseen` command would have exported with public examples and replayed the exact export from an initially empty, separate absolute `fresh-getProduct` home. It was denied before Node launched on all four attempts. The fresh home remains empty. The preparation scripts are not successful proof.

| Required gate | Status and receipt |
| --- | --- |
| Two actual differing frontend examples | Complete; `home/captures/cmvpdlgxc5e67cc.json`, `home/captures/cmvpdoim09b1967.json` |
| Local learning | Complete; `learn.json`, `captured-results.json`, `home/sites/mcdonalds.json` |
| Unseen third-input tier-1 replay | Not run; `unseen*.exit` are all `75` |
| Independent unseen identity/meaning comparison | Not run; no comparison result exists |
| `verifySite` with `maxTier: 1` | Not run; no `verify.json` or current checks record exists |
| Export retaining public examples | Not run; no `export.json` or `export-audit.json` exists |
| Initially empty-home cookie-free reuse | Not run; no `fresh-getProduct.json` exists and the fresh home is empty |
| Direct `vetShared`, zero issues | Not run; no `vet.json` exists |
| Registry save / integrated checks | No files saved; parent owns integrated checks |

## Resources and cleanup

The initial unknown-source read used default memory admission 88%, stop 90%, CPU admission 65% and stop 85%. Offline parsing/learning and the understood exact-document helper used the authorized memory admission 89%, stop 90%, retaining the CPU limits. The unchanged helper retained its 15-second timeout. No general browser command used a higher admission threshold.

Admission denials and retries, each separated by at least 30 seconds without site requests or browser commands:

- Initial source read: denied at 14:49:50 with memory 90.17%; its retry at 14:50:41 admitted with 87.08%.
- Big Mac capture: denied at 14:51:38 with 89.35%; its first retry at 14:52:22 admitted with 87.96%.
- Small Fries capture: denied at 14:52:56 with 89.94% and at 14:53:52 with 90.88%; its second retry at 14:54:52 admitted with 88.53%.
- Held-out command: denied at 14:55:51, 14:56:32, 14:57:31 and 14:58:15 with memory 90.49%, 89.96%, 90.41% and 89.56%. All four exited 75 before launching the child. No replacement command loop followed.

Twenty-one retained samples peak at CPU **66.17%**, policy memory **90.88%**, and raw occupied RAM **99.84%**. The policy-memory peak was denied admission, not an admitted command's observed peak. No admitted command was watchdog-terminated. The gate excludes file-backed cache while retaining anonymous inactive and compressed memory. Raw occupied RAM was above 95%; this batch cannot claim the whole host remained below the user's ceiling by that measure. Samples do not bound unrelated activity or unsampled spikes.

Ignored evidence base is `bench/explore/state/discovery/mcdonalds-qualified-r1/`. `source*.resources.jsonl`, `source-audit.*`, `capture-a*`, `capture-b*`, `learn.*` and `unseen*` retain exact output/resource/exit receipts. `run.py` is the task-local command wrapper. `audit.mjs`, `learn.mjs`, `unseen.mjs`, `verify.mjs` and `transport.mjs` are ignored helpers, not changes to repository behavior. `unseen.mjs`, `verify.mjs` and its transport were never executed. The retained source and capture files are ignored; the evidence directory is mode 0700.

Each browser attempt acquired the mutex with atomic mkdir and a random owned token, and released only that token and directory after its child exited. The actual helper closed its browser in `finally`. `resources-cleanup.json` aggregates all samples, confirms the global mutex is absent, confirms no owned Chrome process using this batch profile remains, records the empty fresh home and absent registry files, and lists missing qualification outputs. No unrelated process was stopped.

McDonald's is resource-deferred, not stopped for a site access control. No auth wall, challenge, 429 or repeated site error was observed. Resume only in a newly admitted bounded batch, using the retained actual captures and candidate as leads, then complete the held-out comparison, tier-1 verify, public-example export, exact-export fresh reuse and direct vet before saving a shared spec.
