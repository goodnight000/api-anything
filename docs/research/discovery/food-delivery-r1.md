# Food delivery discovery round 1

Current result: **ISSUES**. Instacart `listStores(region, city)` is saved and integrated.
DoorDash and Uber Eats stopped after unseen direct replays returned access controls.
The parent repaired the city-format regex, reran all three tier-1 cases, repeated empty-home
reuse, and passed direct shared vetting plus the integrated registry gate at 10:26 UTC.
See the parent integration section below. Earlier deferred candidate stages are retained
as attempt history; they no longer describe the current registry state.

All work was signed out on 2026-10-26 UTC. No personal address, ZIP code, geolocation permission, account import/login, cart, order, payment, or site write was used. No alternate route or host was tried after observing a domain's blocker. No nested workers, src/dependency edits, commits, pushes, PRs, publication, shared-state edits or changes to other workers' files were made. The parent owns integrated checks and catalog updates.

## Method and source provenance

The repository AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, discovery README and capture helper were read first. Existing registry files and discovery reports contained no prior assigned-site work. The source checkout and current dirty branch were retained.

Every frontend receipt below came from the experimental capture-document.mjs helper under resource_gate.py and the atomic global browser mutex. It requested the exact GET document and aborted other requests; inline scripts could run. These are actual browser document captures, not synthesized HTTP exchanges or proof of a fully hydrated GUI. The mutex owner token was checked before releasing it after each owned command exited. One occupied-mutex attempt for DoorDash SF made no request and left that lock untouched.

The initially isolated absolute API_ANYTHING_HOME was `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/food-delivery-r1/home`. Raw captures, local learned specs, browser profile, logs and all receipts remain under ignored `bench/explore/state/discovery/food-delivery-r1/`.

## DoorDash: BLOCKED, not exported

The root exposed actual `/food-delivery/` city links. Those links supplied New York, Los Angeles and San Francisco; no route or store ID was invented.

- Root: https://www.doordash.com/, capture `cmvp3edcua141e5`, document 1 HTTP 200.
- Example 1: https://www.doordash.com/food-delivery/new-york-city-ny-restaurants/, capture `cmvp3g85e4c2593`, document 1 HTTP 200.
- Example 2: https://www.doordash.com/food-delivery/los-angeles-ca-restaurants/, capture `cmvp3gnn897887b`, document 1 HTTP 200.
- Unseen source: https://www.doordash.com/food-delivery/san-francisco-ca-restaurants/, capture `cmvp3ikidc6b73e`, document 1 HTTP 200.

Provisional `listRestaurants(city)` took the complete city route segment, for example `city=new-york-city-ny-restaurants`. It learned without warnings at minTier 1. The response source was the document's carousel JSON-LD, extracting restaurant names, storefront URLs, cuisine, public business city/region and rating summaries. It was a published city carousel, not address-specific delivery availability. New York's preview contained 50 restaurants.

The unseen `city=san-francisco-ca-restaurants` call with maxTier 1 returned `ok:false`, `class:blocked`: tier 1 HTTP 403 with no login/challenge markers. No escalation or alternative route followed. The result's `tier:2` describes the next tier needed, which was capped; no tier-2 browser fetch ran. Its reason is in `unseen.json`, and `qualify.stdout.jsonl` records the failed stage.

Sequencing limitation: the SF browser source capture was dispatched before the failed-call receipt was inspected, although the failure had already completed. It returned 200. No further DoorDash request was made after observing the 403. This capture is not evidence that the failed HTTP operation is reusable. There is no successful unseen-data comparison, verifySite run, fresh-home reuse, export or direct vet qualification for DoorDash.

## Uber Eats: BLOCKED, not exported

The root's View all cities link led to `/location`, which exposed all selected city routes. The address search was not used.

- Root: https://www.ubereats.com/, capture `cmvp3izredaab75`. The helper summary chose document 1 HTTP 307 and exited 2. The intact capture also holds document 2 HTTP 200 at the same exact root URL. That document was inspected offline to find the public directory link; no replacement capture or fabricated exchange was used.
- Directory: https://www.ubereats.com/location, capture `cmvp3k3h3b2f604`, document 1 HTTP 200.
- Example 1: https://www.ubereats.com/city/new-york-city, capture `cmvp3keny5bd879`, document 1 HTTP 200.
- Example 2: https://www.ubereats.com/city/los-angeles-ca, capture `cmvp3kx9e640388`, document 1 HTTP 200.
- Unseen source: https://www.ubereats.com/city/san-francisco-ca, capture `cmvp3lkndca9571`, document 1 HTTP 200, captured before the replay.

Provisional `listRestaurants(city)` took a public city slug such as `new-york-city`. The HTML recipe read `a[data-test=store-link]` cards, returning visible merchant name, URL, cuisine and business address. New York's preview contained 20 cards. Learning returned no warnings at minTier 1.

The unseen `city=san-francisco-ca` replay with maxTier 1 returned `ok:false`, `class:blocked`, reason `Cloudflare challenge (cf-mitigated)`. The domain stopped immediately on inspecting it. Again, the reported next `tier:2` was capped and was not executed. See `uber-unseen.json` and `uber-qualify.stdout.jsonl`. No successful unseen-data comparison, verifySite, fresh reuse, export or direct vet qualification was performed for Uber Eats.

## Instacart: live proofs PASS, direct vet BLOCKED by resources

The root's Shop by location link led to `/grocery-delivery`. The directory supplied the three city URLs below; its public cards were readable without entering a ZIP code. Shopping and address-specific availability were not attempted.

- Root: https://www.instacart.com/, capture `cmvp3mc7f336dad`, document 1 HTTP 200.
- Directory: https://www.instacart.com/grocery-delivery, capture `cmvp3my8v1e99bc`, document 1 HTTP 200.
- Example 1: https://www.instacart.com/grocery-delivery/ca/near-me-in-san-francisco-ca, capture `cmvp3ngcqd60eb2`, document 1 HTTP 200.
- Example 2: https://www.instacart.com/grocery-delivery/ct/near-me-in-west-cornwall-ct, capture `cmvp3ody3d8ace6`, document 1 HTTP 200.
- Unseen source: https://www.instacart.com/grocery-delivery/ny/near-me-in-long-island-city-ny, capture `cmvp3p71b9b2017`, document 1 HTTP 200.

Candidate `listStores(region, city)` uses lowercase two-letter `region` and a complete `city` slug that includes that region suffix. Example arguments are `region=ca city=san-francisco-ca`, `region=ct city=west-cornwall-ct`; unseen arguments are `region=ny city=long-island-city-ny`. They must refer to the same public directory location.

Trigger/request: `GET https://www.instacart.com/grocery-delivery/{region}/near-me-in-{city}`. The learned slots were `region` at path segment 1 and `city` inside `near-me-in-{city}` at segment 2. The HTML recipe selects the public retailer grid's anchors. It returns `name`, the advertised retailer chain; `url`, that chain's storefront link; and `fulfillment`, the visible Delivery/Pickup label. These do not identify a branch, establish address coverage, confirm current availability, or provide inventory/prices. Only the initially published cards are read; Show all is not clicked.

Learning returned no warnings and minTier 1. The unseen Long Island City replay returned `ok:true`, tier 1, 12 records. Independently, Python's standard HTMLParser read the browser document's card image alt labels, visible paragraphs and anchor URLs. It matched all 12 names, URLs and fulfillment labels to the replay, also checking names against the first visible paragraph. This tests identity and meaning, not merely status or nonemptiness. See `insta-unseen.json`, `compare.py`, `insta-comparison.json`.

`verifySite('instacart', {maxTier:1})` passed all three cases: San Francisco example, West Cornwall check and Long Island City check. See `insta-verify.json` and `insta-qualify.stdout.jsonl`. Export with `--keep-examples` succeeded with zero export warnings; these are harmless public city examples. See `insta-export.stdout.json`.

A distinct initially empty absolute home, `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/food-delivery-r1/fresh-listStores-home`, resolved that exported bundled spec. Before the call it had no session, the template had no Cookie header, and there were no credential refs. The Long Island City tier-1 replay succeeded with all 12 records matching the earlier values. See `fresh-before.json`, `fresh-result.json`, `fresh-summary.json` and `fresh.mjs`.

Direct vetShared never ran: resource admissions at 10:17:49.758, 10:18:45.939, 10:19:36.244 and 10:20:33.564 UTC denied it at policy memory 89.71%, 89.42%, 89.10% and 89.05%. Each resample followed a 30-second wait with no site requests. There is no vet result and no zero-issues claim. The temporarily exported `sites/instacart.json` and notes were relocated to ignored `candidate-instacart.json` and `candidate-instacart.md`; no unqualified JSON remains in the registry. The parent can run direct vetShared on those two candidate files before deciding whether to integrate them, then run its shared checks. The retained `vet.mjs` now reads the ignored candidate paths, ready for the parent to run under its resource gate.

## Resources, receipts and cleanup

There are 67 retained resource samples. Maximum sampled CPU was **59.71%**, policy memory **89.79%**, and separately reported raw occupied RAM **99.71%**. Policy memory excludes file-backed cache; raw occupied RAM exceeded 95%, so this batch does not claim all memory measures stayed below the user's ceiling. Watchdog policy was CPU admit65/stop85 and memory admit88/stop90, with the permitted admit89/stop90 for bounded browser-free tier-1 qualification and offline validation. No watchdog termination occurred. Samples do not bound unrelated activity or unsampled spikes.

The first DoorDash root attempt and first NYC attempt each deferred at the default resource gate, then passed after a 30-second wait. Final vet validation exhausted its three resamples and stayed deferred. Apart from these six denials, all admitted commands completed. Raw resource lines, UTC timestamps, response hashes and document statuses are in `resources-summary.json`, `capture-summary.json`, and the per-command `.resources.jsonl`/stdout files. Fourteen real frontend capture files are retained.

All owned browser and command processes exited. A process check found no Chrome process using this batch's isolated profile. Owned mutexes were released after command exit; the occupied mutex was neither removed nor modified. No cleanup touched another worker's resources. Unqualified learned specs and private captures remain only in ignored evidence. The sole final tracked-path candidate from this batch is this report. No integrated checks were run by this worker.


## Parent integration at10:26UTC

The parent admitted direct vetShared, which rejected the nested quantifier in the city
parameter format. It simplified only that format to `[a-z][a-z-]{1,199}`; request, slots,
trigger and extraction stayed byte-for-byte equivalent. The parent then reran verifySite
on the changed current version:3passes,all tier1. A new empty-home replay sent one request
with no Cookie header or healing, and all12records matched the earlier unseen input.
Export scanning and direct vet returned zero warnings/errors. CLI export saved
sites/instacart.json and final notes were copied to sites/instacart.md. The integrated
all-bundled registry gate passed. The candidate is now qualified and included in the catalog;
the earlier deferred/unqualified stages above are retained as attempt history.

Parent receipts: parent-verify.json, parent-candidate.json, parent-vet.json,
parent-finalize.json, parent-fresh.json, parent-cli-export.json and associated resource logs.

## Parent receipt audit at 10:46 UTC

The optional offline audit now passed. The repository's `opHash` matches the current saved
verification record, all three recorded cases passed at tier 1, the schema-parsed registry
spec equals the current export, and direct `vetShared` returned zero errors or warnings.
No website request was needed. Receipts are ignored `audit-instacart-export.json`,
`audit-instacart-export.out` and `audit-instacart-export.resources.jsonl` in the parent discovery
evidence directory. Its admission sample was CPU 37.21%, policy memory 88.97%, raw occupied
RAM 99.68%. This closes the optional audit deferral without changing the qualified operation.
