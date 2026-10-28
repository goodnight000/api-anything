# Nike depth qualification r2

2026-10-27 UTC. Qualified one new public read, `searchProducts(query)`, in addition to the two existing operations. Saved only `sites/nike.json`, `sites/nike.md` and this assigned report, plus ignored evidence under `bench/explore/state/discovery/nike-depth-qualified-r2/`. All per-site gates for the stated initial-shelf contract passed. Parent registry, lint, type and counting gates remain pending.

The assignment started at 03:09:52.525855 UTC with a 20-minute maximum. Qualification and cleanup completed by 03:19 UTC. No delegation or nested task was used. The latest runbook and state were read first, followed by repository guidance, DESIGN, CONTRIBUTING, the repository api-anything skill, existing Nike files, both assigned Nike reports and the unslop skill. The initial state audit found no Nike stop or alias stop and an expired provider cooldown. This task was the sole active Nike qualification owner. No other site's work was attempted.

## Qualified behavior

`searchProducts(query)` returns the initial US server-rendered product shelf for a free-text phrase. It fills both `q` and `vst` together, preserving the two-key pattern in actual public popular-search links. Their independent meanings and independent necessity remain unknown. This is distinct from `listProducts(category)`, which fills one category path segment. No category wrapper was added.

The returned fields are the displayed name, product-card subtitle as category, displayed current price text and product URL. Product URLs and their segments are opaque identities. Source cards identify country `us`. No SKU grammar, stock, exact-word predicate, exhaustive relevance, pagination, delivered price, tax, bag discount, shipping or locale generalization is promised. Three checked phrases each supplied 24 cards, not proof of a universal shelf size or complete results. Prices and ordering can change.

The input is a required string bounded by a simple 1-to-120-character class containing English letters, digits, spaces, comma, apostrophe and hyphen. This is a conservative local contract, not a claim that Nike rejects other input. Empty input was verified as local `input` without a request. No actual empty search response was observed; no empty-result check or site-invalid-input semantics were invented.

## Capture and learning evidence

The public source URLs A and B were grounded in literal popular-search links from the prior source map. The retained r1 HTTP response was used only as source preparation. It was never converted into a browser exchange. C kept the exact reserved novel phrase, `reflective trail running vest`, and was first submitted only after candidate export plus draft-notes preflight passed.

| Example | URL | Real frontend document capture | Result |
| --- | --- | --- | --- |
| A | `https://www.nike.com/w?q=basketball%20shoes&vst=basketball%20shoes` | `cmvq3z79qe67616` | HTTP 200, matching heading, 24 cards |
| B | `https://www.nike.com/w?q=socks&vst=socks` | `cmvq41ozod2a065` | HTTP 200, matching heading, 24 cards |
| C | `https://www.nike.com/w?q=reflective%20trail%20running%20vest&vst=reflective%20trail%20running%20vest` | `cmvq42lyn01d46e` | HTTP 200, matching heading, 24 cards |

These used the unchanged `bench/discovery/capture-document.mjs` with its configured 15-second timeout, an isolated home, exact requested GET only and all other requests aborted. A had 48 recorded exchanges with 47 aborted; B and C each had 52 with 51 aborted. This proves genuine frontend documents, not a hydrated GUI or an interactive search-box submission. A's total helper elapsed time was 17.604 seconds, including browser startup and cleanup; the configured navigation timeout is not a 15-second global process cap.

CLI `add nike searchProducts` used A and B via `--from`, `--from2`, differing `--example` and `--example2`, and explicit document `--pick-request 1`. Exact child argv is in `learn-child.command.json`. It produced minTier 1, a 24-card preview and one learning warning: query appears in two places, `query:q` and `query:vst`. That warning describes the intentional coupled public-link contract. It does not prove either key alone. A and B have zero product-URL intersection, establishing a substantive identity change. The candidate has no `unproven` mark.

`preflight.json` records candidate public-example export and draft-notes `vetShared` before C or live reuse/verification. All secrets, export warnings, vet errors and vet warnings were empty. After C's source response established a result shelf, final metadata added its real result check and the local empty-input check. `final-preflight.json` repeated the clean preflight on the exact final export and final notes before the first API call. No operation metadata changed after that point.

## Exact-export tier-1 proof

The final export was loaded into `fresh-search-home`, a newly created and initially empty isolated directory. `fresh-initial.json` records its empty state, absent session file and exact export SHA. The first actual API request was the reserved C at 03:15:57.902 UTC. The fetch wrapper delegated to real fetch without changing response content. It recorded Cookie absent and Authorization absent, HTTP 200 and a response-body digest. The call returned tier 1 with 24 records. No private cookies, browser profile or source capture were merged into this home.

C's independently captured source document was compared in order against that actual first call. All 24 opaque URL identities and every claimed name, subtitle, price and URL matched. The initial comparison command exited 2 because the comparison helper had failed to trim trailing whitespace in three source names, at indices 16, 18 and 23. The names were `Nike Stride `, `Nike Stride ` and `Nike `. Runtime display text correctly trims whitespace. `fresh-proof.json` and the true exit 2 remain retained. The corrected offline comparison collapses display-text whitespace and trims edges; it reuses that saved first actual call and makes zero additional requests. `fresh-field-comparison.json` records the correction, 24/24 complete field matches and pass. Neither spec nor API data was changed to make it pass.

All-read `verifySite('nike', {maxTier: 1})` then used that same fresh home with the exact final export. It passed all 10 cases: six baseline result cases, three search result cases A/B/C, and one local empty-input case. All nine network cases returned HTTP 200 at tier 1. The local input case had no tier and sent no request. `verify-proof.json` contains the actual record and matches all three final runtime opHashes. Healing and browser fallback did not run.

Later verification sent only guest cookies issued by real tier-1 responses to that isolated home. All nine later requests carried those guest cookies; none carried Authorization. `guest-session-audit.json` records counts, names and origin without values. The session has no imported source. The first request's Cookie and Authorization absence remains separate from this later guest-cookie disclosure.

`final-check.json` confirms exact public-example exports from both learning and fresh homes match final JSON bytes, both scans have zero secrets and warnings, final JSON plus final notes have zero `vetShared` errors and warnings, the three source shelves are US, the baseline operation objects are equal, and verification and first-call proofs match the exact final version. The saved site files were copied byte-for-byte from those checked artifacts. No metadata was edited afterward.

## Final hashes and preservation

The original full file hashes were spec `f581553df30e4a83245eaec6e5a8739c79cf364cdc1cb74eaa9343dabcefcba5` and notes `8d270673366debe39af4282cfc4d6c124005f6fc463762a1757f25001a8f48e6`. Both existing parsed operation objects are unchanged, and their six cases passed freshly.

| Final file | Bytes | SHA-256 |
| --- | --- | --- |
| `sites/nike.json` | 9160 | `39ddcdeaa57853f0dd9a86ed4e7994d5ee8ae62a19eb2f185138d2a081f126e3` |
| `sites/nike.md` | 5969 | `2db7f1b4b621756162b3673f4e992e296a51c83a42a80b4c2aa44b679e9562f8` |

Full operation digests below use SHA-256 of sorted compact JSON, the same convention as the baseline manifest. Runtime opHashes are the real `checks.ts` values on schema-parsed final operations.

| Operation | Full operation digest | Runtime opHash |
| --- | --- | --- |
| `listProducts` | `6718057de5719a6b23ca06ae22599cbb0ead4a39c61cac17bb97ce1b2209fcc4` | `45286cf0c36c26ef` |
| `getProduct` | `b7d5bf8210e21b02166ff58fe1656e4ead4d904f74fc5eca53064ded220d4a30` | `1541c1727896f614` |
| `searchProducts` | `b6d098c5bcca97a2516ee68de99868e65d98fbd4e003f4aedabe15bc652878a1` | `158cca443da8dcdc` |

## Resource receipts

Every attempted browser, learning, export/preflight, comparison and live verification workload used the unchanged `resource_gate.py`. CPU admission/stop stayed 65/85. Understood exact-document captures and bounded browser-free tier-1 calls used memory admission/stop 89/90. Offline work used 88/90. These are the non-cache policy-memory values; each raw receipt also records raw occupied memory and file cache. The watchdog samples about every two seconds and cannot enforce a global host cap or exclude transient spikes.

The first B capture was admitted, then stopped at a sampled memory value of exactly 90.0%. It produced no retained capture or response-status evidence; whether it reached the origin before termination is unknown. The next admission was denied, and the second resample succeeded. A later offline final-preflight denial used the third resample, which succeeded. Successes did not reset the batch counter. Waits before all three resamples exceeded 30 seconds. No fourth resample occurred.

| Command label | Admission UTC | CPU % | Policy memory % | True exit |
| --- | --- | --- | --- | --- |
| `capture-search-a` | 03:10:46.563083+00:00 | 42.15 | 88.41 | 0 |
| `capture-search-b` | 03:11:17.110355+00:00 | 37.17 | 88.29 | 75 |
| `capture-search-b-resample1` | 03:12:12.510718+00:00 | 17.15 | 89.07 | 75 |
| `capture-search-b-resample2` | 03:12:55.658502+00:00 | 28.48 | 88.29 | 0 |
| `learn-search` | 03:13:10.399075+00:00 | 48.36 | 86.96 | 0 |
| `preflight` | 03:13:21.949826+00:00 | 59.46 | 87.65 | 0 |
| `capture-search-c` | 03:13:38.657587+00:00 | 37.16 | 88.34 | 0 |
| `final-preflight` | 03:14:45.975716+00:00 | 32.8 | 88.83 | 75 |
| `final-preflight-resample3` | 03:15:39.302046+00:00 | 30.66 | 85.58 | 0 |
| `fresh-search` | 03:15:57.699376+00:00 | 55.66 | 88.08 | 2 |
| `compare-final` | 03:16:44.866367+00:00 | 43.76 | 86.77 | 0 |
| `verify-final` | 03:16:55.264910+00:00 | 39.1 | 87.58 | 0 |
| `final-check` | 03:17:32.567981+00:00 | 48.16 | 86.55 | 0 |

The atomic global browser directory was acquired separately for each capture attempt with this worker's distinct owner token. The runner released only its own token and directory after each direct child/gate exited. The final cleanup found no browser mutex and no process matching this worker's absolute runtime path. No unrelated process was signaled.

## Exact receipt locations

All paths below are relative to `bench/explore/state/discovery/nike-depth-qualified-r2/`.

- `manifest.json` contains SHA-256 and byte lengths of scripts, captures and receipts. `summary.json` contains final file/operation hashes, all full gate argv, resources and true exits.
- `home/captures/cmvq3z79qe67616.json`, `home/captures/cmvq41ozod2a065.json`, and `home/captures/cmvq42lyn01d46e.json` are the genuine A/B/C captures. `source-c-capture.json` is an unchanged local copy of C.
- `learn-child.command.json`, `learn-search.out`, `preflight.json`, `final-preflight.json`, `final.json`, and `final-notes.md` identify learning, candidate and exact final versions.
- `fresh-initial.json`, `fresh-requests.json`, `fresh-proof.json`, `fresh-field-comparison.json` and `compare-final.out` establish empty-home first use, actual sent-header presence, original comparator failure and corrected full-field C proof.
- `verify-proof.json`, `verify-requests.json`, `fresh-search-home/checks/nike.json`, and `guest-session-audit.json` establish all-read results, exact opHashes and later guest-cookie use.
- `final-check.json` records the clean exact JSON/notes vet and both export scans. `cleanup.json` records cleanup. Each gate command has separate `.command.json`, `.out`, `.resources`, and `.exit` files. True 75 and comparator exit 2 are preserved.

## Remaining limits and cleanup

No per-site gate remains missing for the limited public US initial-shelf operation. Parent integrated registry, lint, type gates and counting remain pending and were not run here. Empty-search response semantics, site-invalid input behavior, independent q/vst meaning, multilingual inputs, pagination, complete search coverage, hydration and guaranteed relevance are unknown and excluded from the contract. The actual C response included running vests, tights, shoes and other running gear; no claim that every card satisfies every word is made.

Size guides, directory, filters and stock were not attempted. Existing source-map bra-layout uncertainty and the directory's missing fresh SSR membership remain unresolved. The two original operations and all their parsed metadata were preserved. Other sites, first four frozen sites, shared state, depth coverage, runbook, source, dependencies and shared helpers were not edited. No commit, push, PR, publication, website write, browser-cookie import, proxy, bypass or challenge action occurred.

All owned command children exited, successful capture helpers closed their browser in `finally`, and no owned browser process or mutex remains. Ignored isolated profiles, guest sessions and raw receipts remain local for audit. No new observed auth, rate, challenge or repeated-origin-error stop is proposed. The resource termination is not a consumer-host access verdict. Three resamples were used, so any subsequent batch needs the parent's recovery procedure rather than reusing this batch's allowance.
