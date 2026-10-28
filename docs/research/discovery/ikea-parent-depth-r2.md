# IKEA depth continuation, parent round 2

2026-10-27 UTC, 02:23–02:39. **Resource-deferred before candidate preflight. Zero registry additions.** The existing IKEA JSON and notes remain byte-identical to the depth baseline. This batch completed real extraction on retained A, a genuine B document capture, and paired learning of a private `listCategoryProducts(category)` draft. It did not qualify or export that operation for reuse.

## Ownership and admission

The parent read the current depth-first runbook and state. Runbook SHA-256 remained `4a52052d2f19d03efda45af808b2db4349e8bf4845e7ba55db046d893a96eeaa`. No active worker or IKEA stop was recorded; provider cooldown had expired. A parent-only coordinator claim named this report and the isolated evidence directory. No delegated worker was launched.

Two recovery observations passed general admission, more than 30 seconds apart:

| UTC | CPU | Non-cache memory | Raw occupied memory |
| --- | ---: | ---: | ---: |
| 02:23:09.270 | 54.69% | 86.83% | 99.59% |
| 02:24:03.676 | 55.72% | 86.65% | 99.62% |

These supported a new local batch, with fresh admission still required per command. The unchanged resource gate SHA-256 was `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08`. CPU admission/stop stayed 65/85 and memory stop stayed 90. Offline inspection, learning and preflight used 88% admission; only the understood exact-document helper used 89%.

## Actual frontend sources

Both captures contain genuine browser document exchanges. Their source and request URLs are identical. The helper aborts other requests and does not prove a hydrated GUI.

| Role | Source/request URL | Capture and exchange | Result |
| --- | --- | --- | --- |
| Retained A | `https://www.ikea.com/us/en/cat/bookcases-10382/` | `cmvpz09zef5dbd6:1` | HTTP 200; retained capture copied byte-for-byte |
| New B | `https://www.ikea.com/us/en/cat/cube-storage-55012/` | `cmvq2gnn036f5ea:1` | HTTP 200; 215 exchanges, 214 aborted |

A capture SHA-256: `e73c5a13743602c9c6a356d82201938967dafe605c402930f7b0c0864f4b7279`.
A body SHA-256: `8d42f7827dd03f857cab9439c80f78f2ef755f2bc199f05023e22c39ccd14ef7`.
B capture SHA-256: `962c75d33d17612877792aff55082aca7dabaa0d04e50fb383b4db221938a537`.
B body SHA-256: `fdfa7972f5abf31568a6439a32b476403a3c1bf3e1fad6c6204e0cdfee4899c9`.

Actual captured A/B requests have Cookie and Authorization headers absent. These browser-request observations are not empty-home API-call proofs. Only the public A capture file and baseline site JSON were copied into the new home; no browser profile, cookie jar or session was imported.

B used the unchanged `bench/discovery/capture-document.mjs`, SHA-256 `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`, with its 15-second trigger timeout and atomic global browser mutex. Its total helper elapsed time was 18,872 ms including startup and cleanup. The owned mutex was released after the command exited.

## Extraction and paired learning

The existing CLI inspected A with the revised recipe. It returned 24 distinct product rows, including 12 literal `s`-prefixed product numbers. Every proposed field was populated, and each primary product href ended with its corresponding literal identifier. The prepared eight-digit-only audit helper was not used or changed.

The proposed fields are `productNumber`, `name`, `description` and `url`. They preserve the retailer's text and identifiers. The recipe selects `.plp-product-list div[data-testid="plp-product-card"]`, reads the two card attributes, description text and primary image-link href. No price, stock, filtering, pagination or complete-catalog contract is proposed.

A is BILLY-led, with first identifiers `20522046`, `50522040` and `90522043`. A bounded raw B inspection found 24 product-card opening tags and KALLAX-led identifiers `20631663`, `20631639` and `70631632`. The separate B CLI inspection was denied before startup; no standalone all-field B extraction audit is claimed.

The final allowed resample instead ran the existing CLI's paired learning:

- Operation: private draft `listCategoryProducts(category)`.
- Examples: `category=bookcases-10382`, `category=cube-storage-55012`.
- Captures: A and B above, document request 1 explicitly selected.
- Trigger: `https://www.ikea.com/us/en/cat/{category}/`.
- Match: GET, `www.ikea.com`, `/us/en/cat/*/`.
- Outcome: `ok: true`, `readOnly: true`, `minTier: 1`, no warnings or unproven mark; A preview count 24.

The learned draft is stored only under the isolated home in ignored state. It is not a shared spec or a tier-1 replay proof. Final parameter metadata, checks, caller notes and exported request placeholders remain pending. No final operation hash or current verification record is claimed.

## Workload receipts and retry budget

All files below are under `bench/explore/state/discovery/coordinator-ikea-depth-r2/`. Each command has an `.execution.json` retaining exact argv, timestamps, exit, output and resource paths.

| Command | Admission CPU | Non-cache memory | Exit | Actual work |
| --- | ---: | ---: | ---: | --- |
| `inspect-a` | 51.48% | 90.39% | 75 | Denied before CLI startup |
| `inspect-a-s1` | 83.87% | 89.50% | 75 | Resample 1; denied |
| `inspect-a-s2` | 50.39% | 87.59% | 0 | Resample 2; actual A extraction |
| `capture-b` | 43.30% | 79.15% | 0 | Actual exact-GET B capture at 89/90 |
| `inspect-b` | 30.76% | 88.93% | 75 | Denied before CLI startup |
| `learn-category-s3` | 31.01% | 85.16% | 0 | Resample 3; actual paired learning |
| `preflight` | 69.71% | 88.26% | 75 | Denied before metadata/export/vet code ran |

Exactly three batch-wide resamples were used. Denial-to-resample gaps exceeded 30 seconds. Success did not reset the counter. The final admission denial exhausted the batch; no further workload followed.

Sampled peaks across admitted and denied commands were CPU 83.87%, non-cache memory 90.39%, and raw occupied memory 99.87%. The admitted B capture peaked at CPU 73.84% and non-cache memory 87.37%. No watchdog termination occurred. Raw occupied memory is separate, and samples do not establish a global cap or exclude transient spikes.

## Remaining qualification and preservation

The preflight command is retained as data in `preflight.execution.json`; it did not execute. Therefore no candidate metadata, public-example export, credential scan or `vetShared` result is claimed from that attempt.

Required next steps remain:

1. Prepare/export the candidate with metadata and notes, then obtain zero-error/zero-warning offline preflight.
2. Independently capture the reserved C, `https://www.ikea.com/us/en/cat/wall-shelves-10398/`, and compare every claimed field with its stored-template tier-1 answer. Its literal href is confirmed in A; C remains unopened.
3. Verify all reads in the exact final export, including retained `getProduct`.
4. Prove the new operation's first actual request from an initially empty home loaded with that exact export, recording Cookie/Authorization absence and any later guest-cookie distinction.
5. Complete final export/notes vet and integrated registry/lint/type checks before copying or counting an addition.

The working home's retained `getProduct` object equals the baseline. Registry JSON and notes remain byte-identical, with SHA-256 values `5371188542347ec395e727f937a53ad1642161bbc332241a573ea72e63441cde` and `1ae01d948165621c543d1be06e91de434ed2395de5b27322fd9bf40893d4294a` respectively. No shared checks ran because no registry change was ready.

All owned local commands exited. A narrow final process census found no owned Node/Chrome runtime for this isolated home. The owned capture mutex release is recorded; no unrelated lock or program was touched. No new IKEA auth/rate/challenge stop was observed. Source, dependencies, shared helpers, frozen publication files, other reports, commits, PRs and publication were unchanged. Retain these captures and the learned private draft for a newly admitted continuation; do not restart this exhausted batch.
