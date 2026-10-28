# Retained travel qualification r1

Result: **PASS for both worker-qualified operations. Parent receipt audit and focused integrated registry gate remain pending.** Two local spec/notes pairs saved, zero publication. Source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, branch `t3/reverse-engineer-high-leverage-apis`. UTC 2026-10-26, prerequisite review began approximately20:30, substantive commands20:32:05–20:35:31, final bookkeeping completed20:37. Within the whole-batch20-minute limit, Jet2 then Megabus, no delegation or nesting.

Read AGENTS.md, DESIGN, CONTRIBUTING, repository api-anything skill, discovery README, current assignment/stop/official-access state, and the four requested retained/source reports. Shared dirty work was preserved. Only the assigned four site files, this report and ignored `bench/explore/state/discovery/travel-retained-qualified-r1/` were written. Parent owns state/runbook/catalog and integrated checks.

## Official access screen and retained evidence

Official screens were reviewed first and reused without duplicate network screens. [Jet2 source preparation](uk-holidays-source-prep-r1.md) opened https://www.jet2holidays.com/-/media/pdfs/agency%20agreement_april_2025.pdf, documenting a licensed commercial travel-agent browsing/booking API. Anonymous destination-metadata equivalence, schema/runtime and external MCP/agent access remain unproved. [Megabus source preparation](travel-broad-source-prep-r4.md) and [the subsequent source/capture report](resource-recovery-r1.md) opened/refreshed https://us.megabus.com/press-releases/megabus-distribusion. That October2023 announcement documents B2B distribution and GTFS/Google overlap; it does not establish anonymous route-guide metadata access or a current external consumer API/MCP contract. No API-absence claim, signup, partner endpoint or download.

Retained genuine A/B captures and offline-learning receipts were reused, not regenerated. Current-core `extract` audited actual retained document bodies after full capture/source hash checks. No new browser was launched. Original exact-document captures used the unchanged15-second exact-GET helper with other requests aborted and owned global mutexes. No hydrated GUI claim. Megabus's retained finalUrl was `chrome-error://chromewebdata/` after aborted navigation, while document1 had an actual200 response; only genuine response capture is claimed. Historical resource exits/peaks remain those of the original reports, including Megabus's capture watchdog episodes, not relabeled as new successful workloads.

The new audit/export homes are absolute isolated `jet2holidays-home` and `megabus-home` beneath this batch's ignored root. No retained session or browser profile was copied. The initially empty reuse homes are separate `jet2holidays-fresh` and `megabus-fresh` directories. No everyday cookie import/login.

## Jet2holidays

Saved `sites/jet2holidays.json` and `.md`. Exact operation `getDestination(group, destination)`, GET `https://www.jet2holidays.com/destinations/{group}/{destination}`, minTier1, readOnly, learnedLoggedIn=false. Simple patterns `[a-z0-9-]{3,80}`. Group means a route grouping, not country. Returns destination-section title, popular-resort label/list, language/currency, editorial activity categories and canonical sourceURL. Lists are selected advertised content, not complete inventories. Optional fields may be absent. No hotel amenities/certification, prices, availability or reviews.

Retained genuine document1 evidence:

- A `cmvpp0cj380be3a:1`, `{group:"portugal",destination:"algarve"}`, https://www.jet2holidays.com/destinations/portugal/algarve.200, Cookie=false, Authorization=false. `About the Algarve`,16 popular resorts including Albufeira and Lagos, Portuguese, Euro,6 activity categories.
- B `cmvpp0wswdffa6e:1`, `{group:"portugal",destination:"madeira"}`, https://www.jet2holidays.com/destinations/portugal/madeira.200, Cookie=true from its original isolated guest home, Authorization=false. `About Madeira`,9 resorts including Funchal/Canico/Calheta, Portuguese, Euro,5 categories.
- Both current-core outputs differ meaningfully and reproduce the prior learning evidence. Captures retain original provenance and were not mutated. Export source hash matched the supplied expected hash. Offline preflight was zero issues.

The prior homepage's actual raw href grounded C as https://www.jet2holidays.com/destinations/canary-islands/tenerife. After preflight, a new cookie-free source GET returned200. Independent shown destination/resort section text, language/currency sections, category headings and canonical link grounded a manually selected expected record before the first tier1 call. No hidden raw markup was treated as visible; `parseShown` remained unchanged. The source collector also records candidate extraction for audit, but expected values were separately validated against source section text in `jet2-expect.mjs`/`jet2holidays.grounding.json`, not copied from a heldout replay.

C inputs `{group:"canary-islands",destination:"tenerife"}` exercise a new group as well as a new destination. Heldout tier1 output exactly equals the independently grounded full record: `About Tenerife`; `Popular Tenerife holiday resorts`;12 resort labels from Playa de las Americas through Los Gigantes; Spanish; `Euro (€)`; Beaches, Sights, Activities, Eating and drinking (beaches), Shopping (beaches), Nightlife; exact Tenerife canonical URL. `jet2holidays.heldout.json` persists expected, actual, comparison=equal, status/body hash and request booleans. No mismatch.

`verifySite(maxTier:1)` passed example Algarve and check Madeira, both tier1. Record timestamp20:33:35.019Z, exact exported current opHash `b1783317fd5eea23`. Earlier local learned hash `a633e9da548f91d1` is not this exported identity. Initially empty-home first call Tenerife passed tier1 and matched all expected fields, first request Cookie=false/Authorization=false. The site issued guest cookies; only this new home's own site-issued state was used subsequently in qualification. Verification requests had Cookie=true/Authorization=false. No local pre-fetch assertion or site failure occurred.

## Megabus US

Saved `sites/megabus.json` and `.md`. Exact operation `getRouteGuide(routeSlug)`, GET `https://us.megabus.com/route-guides/{routeSlug}`, minTier1, readOnly, learnedLoggedIn=false. Simple pattern `[a-z0-9-]{3,100}`. Renamed the new candidate's `sourceURL` output to `canonicalURL` before preflight, heldout, verify or fresh reuse; retained evidence was unchanged. canonicalURL can differ from requested route. stopCount is a string. Missing optional fields remain absent. Returns selected public route identity and advertised journey metadata, with no boarding text, contact/profile/address extraction, dated schedule, fare, booking, availability or time guarantee.

Retained genuine document1 evidence:

- A `cmvppac790c091a:1`, `{routeSlug:"philadelphia-to-new-york"}`, https://us.megabus.com/route-guides/philadelphia-to-new-york.200, Cookie=false/Authorization=false. Philadelphia to New York, PP04,stopCount`2`, `1 hours 50 minutes (fastest time)`, `Up to 33 services per day`. Canonical link adds `-bus`.
- B `cmvppdbka110c20:1`, `{routeSlug:"washington-to-new-york"}`, https://us.megabus.com/route-guides/washington-to-new-york.200, Cookie=false/Authorization=false. Washington to New York, PP0E,stopCount`4`, `4 hours 20 minutes (fastest time)`, `Up to 33 services per day`. Canonical link adds `-bus`.
- Current-core re-extraction reproduces both retained meanings. No forcing older remotely observed34/day. New candidate export scan and notes preflight: secrets=[], warnings=[], vet errors=[], warnings=[].

The prior directory's actual raw href grounded C as https://us.megabus.com/route-guides/boston-to-new-york-bus. After preflight, independent cookie-free source GET returned200. Shown h1, route-code/stop-count phrase and journey-label text independently grounded the manually selected expected record in `megabus-expect.mjs`/`megabus.grounding.json`. The canonical source href was relative and was resolved against the official origin.

Heldout `{routeSlug:"boston-to-new-york-bus"}` first tier1 call exactly matched: `Bus from Boston to New York`, canonical Boston URL, origin Boston, destination New York, PP01,stopCount`4`, `4 hours 20 minutes (fastest time)`, `Up to 39 services per day`. `megabus.heldout.json` persists independent expectation, actual output and equal comparison. No mismatch.

`verifySite(maxTier:1)` passed example Philadelphia and check Washington, both tier1. Record timestamp20:34:50.917Z, current exact-export opHash `80b3e5ae789f6d6f`. Old retained local hash4352a17658cea96a is unqualified for this renamed/exported version. Initially empty-home first call Boston passed tier1 with full expected equality, Cookie=false/Authorization=false. Every new Megabus request was cookie-free; no Set-Cookie was issued.

## Exact versions and final gates

All dependent gates ran sequentially, with every result inspected before issuing the next command. Each site's `*.audit.json` records preflight and raw-capture audit; `*.source.json`/`*.grounding.json` record independent meaning; `*.heldout.json`, `*.verify.json`, `*.fresh.json`, `*.final.json` record the runtime/export gates. Exact qualification candidate bytes were never changed after preflight. Final `exportSite(keepExamples:true)` was byte-identical to those candidates and reported no secrets or warnings. `saved-vet.json` separately reopened the exact saved site JSON+notes, matched candidate bytes/current verification hashes, and returned zero errors and warnings for each.

| Site | Final JSON SHA256 | Final notes SHA256 | Current verified opHash |
| --- | --- | --- | --- |
| Jet2holidays | `e01437dc9fe4630271a7bf89d047007a9cc08496406d6a7cfcc6309a510fa2ff` | `e000ea2e9d3c7be8ce21ed296aec3c6ac11e781ba575623af88ad1b1431494e6` | `b1783317fd5eea23` |
| Megabus | `8929f1b34cda9476b5477953954ec7b93343e0d2a4161328d8a0f878fd90dac6` | `16767b82f08af770929116b003a3d0697949911d96d3b7d77c9a4096882d9f1e` | `80b3e5ae789f6d6f` |

No new auth/challenge/403/429/rate response, repeated error, mismatch or domain stop. Actual bodies were inspected immediately, not inferred from helper ok/status alone. Request/response auditing persists booleans,status, body SHA and parsed output in finally; call mismatches/errors would persist failure detail before returning nonzero. No failed request/body receipt is fabricated. Ordinary raw public bodies remain ignored for parent re-extraction, never in the tracked site/research files.

## Provenance receipts

Full new manifest `bench/explore/state/discovery/travel-retained-qualified-r1/provenance.json`, SHA256 `bbdf70d78da81a8e47c2c49eaddb204188402332d91700624ecbe7eb181bb072`, records scripts, prerequisite/helper bytes, retained source/capture files, exact saved files, resources, outputs, raw bodies and isolated-home JSON. `summary.json` records every new workload exit and sample. These are bookkeeping snapshots, not retrospective claims about earlier script versions.

| Evidence | SHA256 |
| --- | --- |
| Jet2 A capture container | `c225ac31a3109ce66e8564adc088c238f66c0013d9cabb7512f870566a92d6c8` |
| Jet2 B capture container | `15588bf68f4cafaf327c1a2c2d889270773fdcf27643aba39e2cd212c52c0620` |
| Jet2 A document | `9381aaebbd30cb1b87a19783eb823fe2c9473317a741ededd07e7682823c48f1` |
| Jet2 B document | `4a621748d6c18b06b600db9940d02c96e67809ed240155be49ca70bf1c1b66b4` |
| Jet2 C independent source | `c3c06e6e438051b0586f6554c62470acc77c7ccf59701fbb30ea89e076610e20` |
| Jet2 C heldout tier1 body | `ea8e44a1f684c8ec2043ad8a3a3c9fe712c711c72c4d307a5dc7c955943dd01d` |
| Jet2 C fresh first-call body | `8e1b5e866ed2ada1d1372c7bcc2b1b4e06edcdaf70ad687a99eecd260a5f60d6` |
| Megabus A capture container | `d310f5ef6fb5d54754226a9d6f2aa6d8e83ffef89d6d1647d101cd2f45bdbe11` |
| Megabus B capture container | `736a77d5e13e4b27c22bb20b26c2462eb5a3a06a0e60cda4a4c104d328608a98` |
| Megabus A document and new verify body | `5a2a00c17c7371e0f506e7cc7145042f6bc7b9dbf40a150afebc01d852acc998` |
| Megabus B document and new verify body | `73fce7c3203105702e48859b3be64bd4b8ace382372bb51d3bacc396c7d193b7` |
| Megabus C source,heldout,fresh bodies | `9981a4c52009f9cdef7435328b0e47408e57683a65da4fff8c093a6b6e694fba` |
| Unchanged resource gate | `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08` |
| Unchanged exact-document helper | `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663` |

## Resources, limits and cleanup

Fifteen substantive commands all freshly admitted and exited0. General raw audit/export/vet/source/independent offline analysis used explicit88/90; only bounded browser-free heldout/verify/fresh used89/90. CPU defaults65admit/85stop unchanged. Zero denials, zero resamples across the whole two-site batch. Ten new site requests, no browser workload. Original coordinator recovery samples authorized replacement only; none substituted for command admission. No nested gate, self-respawn or threshold change.

Observed new-batch sampled peaks: CPU21.07%, non-cache policy memory88.22%, raw occupied99.68% separately. Peak policy memory occurred during the89-admission Megabus verification, with the hard90 threshold unchanged. These finite local samples do not prove an unsampled, continuous or global cap; raw occupied memory was not the admission metric. Historical85/90 or90/95 and old capture peaks remain historical.

All owned command sessions exited. Process inspection found no owned Node/browser child; browser mutex was absent. No browser lock was acquired or removed by this continuation. Retained evidence and unrelated dirty/untracked files were preserved. No src/dependency/helper/runbook/state/catalog edits, integrated tests, commits/pushes/PR/publication, import/login, site writes, CAPTCHA/control bypass, proxy tricks, contacts/profiles/residential-address extraction or other-site changes.

Parent action: audit raw bodies/independent expectations, exact export hashes and current verification records, then run the focused integrated registry gate under fresh admission. Count neither operation as integrated until that audit/check succeeds. No monitoring, new publication or automatic continuation requested.
