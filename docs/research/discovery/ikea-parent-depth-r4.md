# IKEA category API qualified, parent round 4

2026-10-27 UTC. **Added `listCategoryProducts(category)` to IKEA US**, alongside unchanged `getProduct(slug)`. The final JSON and caller/maintainer notes are in `sites/ikea.json` and `sites/ikea.md`. This is the first integrated depth addition in this run.

## Coverage and meaning

The new operation reads initial public category cards and returns literal product number, name, description and product URL. It feeds the existing product-detail workflow. Identifiers are opaque strings; some begin with `s`. US English only. Pagination, filters, complete catalog coverage, category prices, stock and store-scoped availability remain gaps.

Paired learning and zero-issue candidate preflight were retained from parent rounds 2 and 3. Genuine frontend document captures are:

| Role | Source and GET request URL | Capture |
| --- | --- | --- |
| A | `https://www.ikea.com/us/en/cat/bookcases-10382/` | `cmvpz09zef5dbd6:1` |
| B | `https://www.ikea.com/us/en/cat/cube-storage-55012/` | `cmvq2gnn036f5ea:1` |
| C | `https://www.ikea.com/us/en/cat/wall-shelves-10398/` | `cmvq3kw4nbf3eb8:1` |

The existing exact-document helper captured real browser GETs and aborted other requests. This is not hydrated GUI proof. Capture/body hashes and provenance are in [round 2](ikea-parent-depth-r2.md) and [round 3](ikea-parent-depth-r3.md). This round reused all captures and launched no browser.

For independently grounded unseen C, the audit read visible heading product links and labels, cross-checked names with card attributes and each URL with its literal product identifier, then compared all four claimed fields on all 24 rows with the stored-template tier-1 result. Every row matched exactly. The answer is LACK-led Wall shelves, distinct from BILLY-led bookcases and KALLAX-led cube storage. No source-field normalization or numeric identifier assumption was introduced.

## Exact-export cold call and all-read verification

The C replay was also the new operation's first call from an initially empty isolated home. Only the exact public-example candidate export was loaded. The actual first GET sent Cookie=false and Authorization=false, returned 200 at tier 1, and did not heal. No browser profile, capture session, cookie jar or login was imported.

Later verification reused only guest cookies issued to that isolated home by IKEA. All five later GETs had Cookie present, Authorization absent and HTTP 200. No cookie values are tracked. The separate retained C browser capture had cookies present and is not used as cold-call evidence.

`verifySite` ran all reads in the exact final export with maxTier 1. All seven cases passed: three existing product results, one existing local invalid-slash refusal, two category results and one category local invalid-slash refusal. Neither operation healed or changed. Verification records match both exact final operation hashes:

| Operation | opHash | Cases |
| --- | --- | ---: |
| `getProduct` | `f9166b77c2ef7ea2` | 4 |
| `listCategoryProducts` | `d6f378bdabbc4764` | 3 |

Final export retained public examples and returned no credential findings or warnings. Final JSON plus caller/maintainer notes passed `vetShared` with zero errors and warnings. The entire existing `getProduct` parsed object equals its baseline.

Final JSON SHA-256: `a552871002816f7d90b4c2eb2781ecfd913a837aa3a862170fd5f06e5ff4ca74`.

Final notes SHA-256: `808c02c1d9597565776b8c4d23eb03c2879dad188efc5927fe4500f59bc18428`.

## Integrated checks and resource receipts

The parent installed only these final IKEA files and ran the focused bundled-registry test, repository lint and type check. All three exited 0. Registry: one selected test passed; lint checked 85 files without fixes; `tsc -p tsconfig.json` passed. These are local integration gates, not publication or deployment.

Receipts are under ignored `bench/explore/state/discovery/coordinator-ikea-depth-r4/`; every command retains argv, UTC times, actual exit, stdout and resource samples.

| Stage | Admission memory | CPU | Exit |
| --- | ---: | ---: | ---: |
| Initial general recovery | 89.08% | 67.28% | 75 |
| Recovery resample 1 | 87.77% | 44.90% | 0 |
| Second compliant observation | 87.73% | 19.43% | 0 |
| C meaning/cold replay | 87.92% | 37.06% | 0 |
| Initial all-read verify | 89.05% | 47.50% | 75 |
| Verify resample 2 | 87.83% | 19.85% | 0 |
| Final export/vet | 86.57% | 38.12% | 0 |
| Focused registry | 86.84% | 37.57% | 0 |
| Lint | 87.09% | 27.16% | 0 |
| Type check | 87.69% | 36.03% | 0 |

Exactly two batch resamples were used. All denial-to-resample waits exceeded 30 seconds; compliant recovery observations were 32.742 seconds apart. Each workload had fresh admission. Bounded tier-1 work used 89/90; expensive offline and integration work used 88/90. CPU admission/stop remained 65/85. No watchdog termination occurred; samples do not prove a global cap or exclude transient spikes. No unrelated program was stopped.

All owned commands exited, no browser/mutex was created this round, and the IKEA parent claim is released. All eight frozen publication files match the approved manifest. Source, dependencies and shared helpers are unchanged. No new site stop, commit, push, PR or publication occurred. The depth schedule remains enabled; next useful IKEA gaps include source-mapped store details and store directory, while Nike and JYSK depth work remains pending.
