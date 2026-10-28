# IKEA selected-store details qualified, round 2

2026-10-27 UTC. **Added `getStoreDetails(store)`; three IKEA reads now saved, pending parent integration.**
The existing `getProduct` and `listCategoryProducts` parsed operation objects remain exactly equal
to the assigned two-operation baseline. Only `sites/ikea.json`, `sites/ikea.md`, this assigned report
and ignored round-2 evidence were written. No delegation or shared-state edit occurred.
Work began with required reads at about 04:40:55 UTC; registry files were installed at 04:48:09 UTC.

## Contract and source meaning

The new read returns one record containing `name`, `url`, `address`, `storeHours`,
`clickCollectHours`, `smallandHours`, `restaurantHours`, `bistroHours`, `closed` and
`specialStoreHours`. These form one visit-planning operation, not separate field wrappers.
It uses a source-linked final Store URL segment, bounded by `[a-z0-9-]{3,80}`. No artificial
state, ZIP, directory filter or pickup-facility ID was added. An argument-free directory read
was not needed. Only Store pages with this observed layout were qualified; other location types
and future department reordering are not independently proven.

Department hours remain text, including Houston's curbside-only hours notice and Orlando's
"Hours may vary, see store for details." for Småland. Closures and special hours retain 2026
dates and event wording. The core HTML extractor collapses whitespace but adjacent inline date/time
nodes can touch, e.g. `12/24/202610:00 AM - 5:00 PM Christmas Eve`; notes disclose that behavior.
No timezone, open-now, inventory, delivery eligibility, booking, pickup action, menus or events
are inferred. Public membership navigation did not establish an auth requirement. No known-empty
IKEA search request or unrelated website was visited.

Read README and state first, then repository instructions, design, contribution guide, the
repository api-anything skill, current IKEA files, depth map, parent category round 4 and the full
retained round-1 report. The old one-operation source map was historical context only.
The full current host-stop scopes were read; no IKEA stop existed. All other brand/alias/route/
transport stops remained binding. No auth, rate, challenge or repeated-origin-error stop occurred.

## Provenance and retained-evidence audit

Under fresh general 88/90 admission, all 243 entries of the original manifest matched their
recorded hashes, including the original report, sources and Houston capture. Round 1 was preserved
without edits. Only baseline spec, needed public source artifacts and the byte-identical A capture
were copied into the new isolate. No old profile, session or cookie jar was copied.
The first new network work was the genuine Orlando frontend capture, under fresh 89/90 admission.
No directory/Houston source or Houston capture was repeated.

The retained directory document supplies literal A/B/C hrefs and labels all three entries Store.
Its body SHA-256 is `2c2628677e39fc6071d6f9c45a112de9a540434807473bbf9cb54a5c17c387ab`.
A/B source bytes are genuine HTTP source reads from round 1, not fabricated browser exchanges.

| Role | Source and exact GET request URL | Genuine capture |
| --- | --- | --- |
| A | https://www.ikea.com/us/en/stores/houston/ | `cmvq6ytsrf073a1:1`, retained |
| B | https://www.ikea.com/us/en/stores/orlando/ | `cmvq7891o502b2a:1`, new |
| C | https://www.ikea.com/us/en/stores/emeryville/ | `cmvq7dfqj75d321:1`, new after preflight |

A source body SHA-256: `c90350d1ac0fd2b80087e41586a45d336b406d7893c4b266e1c276d04bb5e784`.

A capture-file SHA-256: `79fc1509ab22b4ade52928d6008659aa1748dc6ccc249a322c83bc119eb83790`.

A captured body SHA-256: `2167f2661a44e02cbc7450380df3135d9ffcd5012dcc6e1a922ed09498d49046`.

B source body SHA-256: `23fb0d092ca23f50c8bf7244ff1595b2dd932026f8d0cb40773654ca8dc80e7c`.

B capture-file SHA-256: `d622816baedd3a9dd4d2b680ec73644747ae3084c1944c38d878ac9a76bdbcce`.

B captured body SHA-256: `b421944c5583681c4675d532dcffabc3c211876f792583404cad74fc1fecab11`.

C source body SHA-256: `508c4111950ebb05c65b80839a074e39a4887be66fb4bc0030e93bf345db2a7e`.

C capture-file SHA-256: `250a8413a6eea2e2ca3c07ac5252fedbf1d55e2aa62e1d2fe595f5a8db60f6f5`.

C captured body SHA-256: `ccd3554f44258ba62df22546bc91cdb79badb1a7f1dce209278f3030e4e19707`.

All captured documents returned HTTP 200. A recorded 271 exchanges / 270 aborted; B 266 / 265;
C 276 / 275. The unchanged `capture-document.mjs` allowed only the exact GET document and used its
unchanged 15-second trigger timeout. Unique tokens protected the atomic global browser mutex;
each owned lock was released only after its command exited. This is frontend document evidence,
not a fully hydrated GUI test. Dynamic document hashes differ between source/capture/replay;
all claimed fields were compared by meaning rather than requiring whole-body identity.

A/B captures sent neither Cookie nor Authorization. C's browser capture had Cookie present,
Authorization absent, using only that new isolated browser's site-issued guest state. This is
separate from the cookie-free API cold-call proof below.

## Paired learning and candidate preflight

Paired CLI `add` used the genuine A/B captures, explicit document request 1, examples
`store=houston` / `store=orlando`, and the source-grounded HTML recipe. It returned no warnings,
readOnly true and minTier 1. A/B identity, canonical URL, complete visible address and every
hours/exception field agreed between source and capture. Department headings were independently
matched by label to verify the recipe's positional layout. JSON-LD corroborated name, street,
locality and postal code; the visible address supplied state. Regular JSON-LD hours alone were
not presented as full visit hours. A/B data differ meaningfully, not just in response bytes.

Final parameter bounds, descriptions, example and checks plus final draft notes were fixed before
preflight. At 04:45:19 UTC, the exact public-example export and notes had zero credential findings,
zero export warnings and zero vetShared errors/warnings. Neither original operation changed.
Only then was reserved C opened; no easier C was substituted. No final spec or note metadata
changed after that preflight.

## Full reserved-C comparison and first actual API call

The first C source request was a cookie-free, Authorization-free GET at 04:45:44 UTC after preflight.
It returned HTTP 200. Independent heading-selected visible sections and FurnitureStore JSON-LD
established IKEA Emeryville and its address. Before the call, all fields extracted from C's genuine
frontend capture equaled the independently grounded source. The first actual call of the new
operation then used an initially empty separate `cold/` home with only the exact final export
loaded. The loaded parsed spec equals that final export exactly.

The shell wrapper initially injects round-2 `home/`; `runtime.mjs` explicitly switches
API_ANYTHING_HOME to the separate absolute `cold/` path before importing runtime modules.
`cold-initial.json`, `c-comparison.json` and `final-proof.json` record the actual runtime home.
The first network request sent Cookie=false and Authorization=false, returned 200 at tier 1,
and did not heal. Its body hash is
`72947933e748ef1d22fd19bc31ab2bcef03c6d3b0c59e45c254bc16eabe89578`.

Every row below matched source, genuine frontend capture and stored-template tier-1 data exactly:

| Claimed field | C value |
| --- | --- |
| name | IKEA Emeryville |
| url | https://www.ikea.com/us/en/stores/emeryville/ |
| address | IKEA Emeryville 4400 Shellmound Street Emeryville, CA 94608 |
| storeHours | Monday - Sunday 10:00 AM - 9:00 PM |
| clickCollectHours | Monday - Sunday 10:00 AM - 9:00 PM |
| smallandHours | Monday - Friday 12:00 PM - 4:00 PM; Saturday - Sunday 10:00 AM - 7:00 PM |
| restaurantHours | Monday - Sunday 10:00 AM - 8:30 PM |
| bistroHours | Monday - Sunday 10:00 AM - 9:00 PM |
| closed | 11/26/2026 Thanksgiving; 12/25/2026 Christmas Day |
| specialStoreHours | `12/24/202610:00 AM - 5:00 PM Christmas Eve`; `12/31/202610:00 AM - 6:00 PM New Year's Eve` |

The API response issued guest cookies named `ikexp_id`, `ikea_geo`, `__cf_bm`; no values are
reported. Later verification reused only those site-issued cookies in this same cold home.
No private cookie/profile/session import or login occurred. Presence of those later guest cookies
was not mislabeled as authentication.

## All-read exact-version verification and final export

`verifySite` ran with maxTier 1 and a real-fetch wrapper recording actual header presence, status,
body hashes and cookie names only. All 10 cases passed. Seven actual GETs returned 200 with guest
Cookie present and Authorization absent. Three invalid-slash cases were rejected locally without
a request. No healing, tier escalation, imported-session recovery or browser run occurred.
A/B stored-template verification bodies were also compared against all source/captured fields.

| Operation | Case | Expected | Result |
| --- | --- | --- | --- |
| getProduct | example | result | pass; tier 1 |
| getProduct | check 1 `{"slug":"lindakra-sleeper-sofa-vissle-light-gray-green-60629272"}` | result | pass; tier 1 |
| getProduct | check 2 `{"slug":"foerlig-led-floor-wall-lamp-white-adjustable-color-80601291"}` | result | pass; tier 1 |
| getProduct | check 3 `{"slug":"invalid/path"}` | input | pass; local input |
| listCategoryProducts | example | result | pass; tier 1 |
| listCategoryProducts | check 1 `{"category":"cube-storage-55012"}` | result | pass; tier 1 |
| listCategoryProducts | check 2 `{"category":"invalid/path"}` | input | pass; local input |
| getStoreDetails | example | result | pass; tier 1 |
| getStoreDetails | check 1 `{"store":"orlando"}` | result | pass; tier 1 |
| getStoreDetails | check 2 `{"store":"invalid/path"}` | input | pass; local input |

Both the raw-learning home's public-example export and the cold home's export equal the final
spec. Raw learning legitimately preserves captured request URLs and learnedAt; it was not forced
to equal the stripped export. The cold loaded spec equals final exactly. Both homes returned zero
export findings/warnings; exact serialized final JSON plus notes were separately scanned against
each home's live session with no findings/warnings. Final vetShared returned zero errors/warnings.
The saved JSON and notes are byte-identical to the preflighted and verified candidate files.

| Operation | Final opHash | Canonical complete parsed-object SHA-256 |
| --- | --- | --- |
| getProduct | `f9166b77c2ef7ea2` | `d56555cabfac50c60966e2fed5a62717bf0ce5a0d7d13b05e2baa678848201b3` |
| listCategoryProducts | `d6f378bdabbc4764` | `81b58eedf9f6cfe5779b6c3919f5d587f5f0a4b324a6abe98cd186758390d6d1` |
| getStoreDetails | `ccda2ca39a48d537` | `a8e3bba9e3f4cad59f0aea232a4d2618bdad7847adb82181756fbc0731dfd415` |

Final JSON SHA-256: `b3b78d6795f9e5975db15c3ce8b1ffb7b1bada992b63da5100699f30b0caa66c`.

Final notes SHA-256: `43d4cdc3e2b2ac9fb4edfbbbfdc81954d513cd1c4e3160d41386af6a9861b4ad`.

The two old complete parsed objects equal baseline, including all checks and parameter metadata.
Baseline whole-file hashes were `a552871002816f7d90b4c2eb2781ecfd913a837aa3a862170fd5f06e5ff4ca74`
and `808c02c1d9597565776b8c4d23eb03c2879dad188efc5927fe4500f59bc18428`.

## Resources, true failures and cleanup

This newly authorized continuation used its own batch, not a reset of round 1's exhausted batch.
The private recipe check was denied at 88.20% memory; its resample began more than 35 seconds
later. The final receipt-inventory command and both later resamples were denied before launch;
each resample waited at least 30 seconds. All three batch resamples are now exhausted. No website/browser requests occurred during either wait.
The exact resample count and command times are in summary.json and the table below.
Success did not reset the resample counter. CPU admission/stop remained 65/85. Expensive/source/
offline commands used 88/90; only understood exact-document captures and bounded browser-free
runtime qualification used 89/90. No watchdog termination occurred. All stdout/stderr and true
exit codes, including 75, were retained. Raw occupied RAM is recorded separately from policy
memory. Approximate two-second samples do not prove a global cap or exclude transient spikes.

| Command | UTC admission | CPU | Policy memory | True exit |
| --- | --- | ---: | ---: | ---: |
| capture-b | 2026-10-27T04:41:53.508345+00:00 | 17.22% | 85.23% | 0 |
| audit-ab | 2026-10-27T04:42:19.562191+00:00 | 37.02% | 86.07% | 0 |
| recipe-ab | 2026-10-27T04:43:20.334728+00:00 | 34.5% | 87.76% | 1 |
| recipe-ab-fixed | 2026-10-27T04:43:33.320866+00:00 | 28.21% | 88.2% | 75 |
| recipe-ab-s1 | 2026-10-27T04:44:10.838280+00:00 | 31.4% | 87.13% | 1 |
| recipe-ab-region-fixed | 2026-10-27T04:44:25.520180+00:00 | 28.42% | 87.36% | 1 |
| recipe-ab-final | 2026-10-27T04:44:41.095133+00:00 | 27.08% | 86.88% | 0 |
| paired-cli-learn | 2026-10-27T04:44:53.360628+00:00 | 31.02% | 87.07% | 0 |
| candidate-preflight | 2026-10-27T04:45:19.365253+00:00 | 35.13% | 87.65% | 0 |
| source-c | 2026-10-27T04:45:44.854112+00:00 | 29.07% | 87.0% | 0 |
| capture-c | 2026-10-27T04:46:03.422841+00:00 | 26.19% | 86.65% | 0 |
| cold-exact-c | 2026-10-27T04:46:50.050214+00:00 | 15.0% | 85.85% | 0 |
| all-read-verify | 2026-10-27T04:47:08.476134+00:00 | 33.07% | 86.33% | 0 |
| final-exports-scan-vet | 2026-10-27T04:47:36.171428+00:00 | 16.26% | 86.09% | 0 |
| final-save-audit | 2026-10-27T04:48:08.916042+00:00 | 39.54% | 85.63% | 0 |
| receipt-audit | 2026-10-27T04:50:09.189122+00:00 | 53.88% | 88.81% | 75 |
| receipt-audit-s2 | 2026-10-27T04:50:48.191968+00:00 | 31.67% | 89.04% | 75 |
| receipt-audit-s3 | 2026-10-27T04:51:43.977565+00:00 | 32.85% | 89.11% | 75 |

Three early offline assertion failures are preserved: a trailing whitespace assumption, an assumed
JSON-LD addressRegion that the source does not provide, and a city/state formatting expectation.
Only private comparison code was corrected; no source/helper workaround or fabricated exchange
was used. These are local proof-script failures, not repeated website errors. The initial
final-proof receipt also used an incomplete canonical object-hash calculation; the corrected
complete recursive canonical hashes above and exact deep equality were reproved in final-save-audit.
Runtime opHash values and candidate bytes never changed.

Receipts are under ignored `bench/explore/state/discovery/ikea-stores-qualified-r2/`.
`manifest.json` indexes exact command receipts, key proofs and already-established hashes; it
does not claim a final comprehensive rehash. That optional inventory audit was denied before launch
and deferred after all three batch resamples were exhausted. The original 243-file manifest audit
and completed exact-version final proof remain valid. `summary.json` records all exact argv, UTC
start/end, admission and samples, true exits and actual runtime-home distinction. Key receipts:
`retained-manifest-audit.json`, `provenance-ab.json`, `ab-meaning.json`, `learn.argv.json`,
`preflight-proof.json`, `c-independent.json`, `c-comparison.json`, `cold-requests.json`,
`all-read-verify.json`, `verify-requests.json`, `final-records.json`, `final-proof.json`,
`installed.json` and `cleanup.json`. Raw guest-cookie/profile/capture evidence stays private and
ignored; no live values appear in this report or saved registry files.

Cleanup found no owned browser process and no global mutex. All recorded commands exited;
only owned mutexes were removed after child exit. The retained original report remains unchanged.
No other site/report, shared state/depth coverage, source, dependency, runbook or helper was edited.
No commit, push, PR, publication, website write, bypass, proxy, CAPTCHA action, private import or
unrelated process/lock stop occurred.

Per-site API qualification gates are complete. The optional final comprehensive artifact rehash
is resource-deferred and was not run. Parent-owned integrated registry, lint and type gates
and operation counting remain outstanding; this report does not claim those passed. Parent should
audit the exact installed hashes and receipts before integration.
