# IKEA depth continuation, parent round 3

2026-10-27 UTC. Resource-deferred after real candidate preflight and a genuine held-out document capture. **Zero new reusable operations counted.** The registry still contains only the existing `getProduct`; its JSON and notes are byte-identical to baseline.

## Admission and ownership

The parent continued the existing IKEA-only admission reservation. No saved active task IDs or delegated workers were present. The first two recovery resamples had already run before this continuation; their stale state counter was corrected. Exactly three batch resamples were used, without resetting after a success.

All receipts below are in ignored `bench/explore/state/discovery/coordinator-ikea-depth-r3/`. The initial denied recovery receipt is `../coordinator-ikea-r3-scheduled-recovery-20261027-r2.resources`.

| Stage | UTC | CPU | Non-cache memory | Exit |
| --- | --- | ---: | ---: | ---: |
| Initial recovery | 02:52:29 | 34.67% | 88.64% | 75 |
| Recovery resample 1 | 02:54:19 | 19.19% | 89.05% | 75 |
| Recovery resample 2 | 02:55:53.974 | 39.03% | 88.03% | 75 |
| Recovery resample 3 | 02:58:58.091 | 30.15% | 87.41% | 0 |
| Second compliant observation | 02:59:30.795 | 29.71% | 87.24% | 0 |
| Fresh preflight admission | 02:59:32.541 | 42.73% | 87.56% | 0 |
| Held-out capture admission | 02:59:47.661 | 22.52% | 85.83% | 0 |
| C replay/cold-home admission | 03:00:41.680 | 21.50% | 91.23% | 75 |

The two compliant recovery observations were 32.704 seconds apart. The subsequent commands had fresh admission. General offline preflight used 88/90; the understood exact-document capture and bounded tier-1 check used 89/90. CPU remained 65/85. Raw occupied memory at the final denial was 99.67%; this is separate from policy memory. No watchdog termination occurred. The final denial exhausted the batch, and no further workload or resource resample followed.

## Candidate preflight passed

The unchanged existing metadata/export/vet command ran on the retained round-2 home. It preserved `getProduct`, added bounded category metadata and checks to the private draft, exported public examples, scanned credentials, and vetted the candidate notes. Export secrets, export warnings, vet errors and vet warnings were all empty.

Candidate operation hashes from `opHash` on the exact parsed export:

- Existing `getProduct`: `f9166b77c2ef7ea2`, equal to the baseline parsed operation.
- New private draft `listCategoryProducts`: `d6f378bdabbc4764`.

The candidate JSON and draft notes are only in ignored `candidate/`. These hashes identify a preflight candidate, not a verified final registry addition. The recipe returns literal `productNumber`, `name`, `description` and `url` from initial category cards. Product identifiers can start with `s`; no numeric normalization is authorized. Prices, stock, filtering, pagination and full-catalog coverage remain outside this operation.

## Genuine held-out C capture

After preflight, the unchanged exact-GET document helper captured the reserved source-linked C URL:

`https://www.ikea.com/us/en/cat/wall-shelves-10398/`

Capture `cmvq3kw4nbf3eb8`, document exchange 1, returned HTTP 200. It contains 230 exchanges, 229 aborted, with an 8,897 ms helper elapsed time. Source, request and final URL agree. The actual captured document request has Cookie present and Authorization absent. This retained isolated browser profile had already visited B; no private browser import or sign-in occurred. Cookie values are not included here. No hydrated GUI proof follows from this helper. The atomic global browser mutex was acquired for this owned command and released after it exited.

Capture SHA-256: `8d0852448c779fa68e20f6d34bffc434cc2afc07bb4cec6050856eb8eed16866`.

Body SHA-256: `690ab67e0a35e7ccb88a6673360f4df3fb91f9eb0999b2b7fc77e60f3de0075c`.

A bounded raw read shows a Wall shelves page with a LACK card and visible heading link. It is not a complete independent all-field comparison. That comparison and tier-1 C replay remain unrun.

## Replay denied; remaining gates

The prepared combined C meaning comparison and first-call cold reuse command was denied by its resource gate before Node startup. No API request occurred, no cold home was created and no result/proof file exists. The earlier A/B browser header observations and this later cookie-bearing C capture are not cold-home API-call proofs.

The denied command data originally referenced unavailable `cheerio`. A follow-up command receipt replaces that planned import with the already installed `node-html-parser` and uses visible heading links to independently cross-check the recipe's card/image-link fields. This corrected command remains unexecuted in `c-cold-next.command.json`; no source, helper or dependency was changed. Its comparison must still be observed, not assumed.

Required next steps, with renewed paired general-88 recovery and fresh per-command admission:

1. Independently compare every C field and identity against the stored-template tier-1 result, reusing this C capture.
2. Prove the new operation's first actual call from an initially empty home loaded with the exact candidate/final export; record header absence and later guest cookies separately.
3. Reverify every read in the exact modified final export, including all existing `getProduct` examples and checks.
4. Complete final public-example export, notes, credential scan and zero-issue vet, then the parent integrated registry/lint/type gates.

No shared checks ran because no registry modification was ready. The parent reservation is released and all owned commands have exited. No browser mutex remains. Existing brand/host stops are preserved; no new IKEA access stop was observed. All eight frozen publication files match the approved manifest, and no publication, commit, push or PR action occurred. The existing depth scheduler remains enabled every ten minutes.

Exact argv, exits, resource samples, mutex release and candidate results are retained beside `summary.json`. Raw captures remain only in ignored state.
