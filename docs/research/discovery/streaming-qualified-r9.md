# Streaming qualification r9

2026-10-26 UTC. **PASS for two worker-qualified public metadata operations**, pending the parent's receipt audit and focused registry gate. Saved `sites/netflix.json`, `sites/netflix.md`, `sites/disneyplus.json` and `sites/disneyplus.md`. Neither site is an integrated catalog addition yet.

Worked on shared dirty branch `t3/reverse-engineer-high-leverage-apis`, source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Read AGENTS.md, DESIGN.md, CONTRIBUTING.md, the repository API Anything skill, discovery runbook, current coordinator state, `streaming-source-prep-r1.md` and r8. The current state assigned only these two sites to this worker. Earlier remote source preparation supplied the exact title links and reserved held-out examples; all evidence below is fresh local r9 evidence. No nested delegation, source/dependency edits, shared state/runbook/catalog changes, git mutation or publication.

Evidence root is ignored `bench/explore/state/discovery/streaming-qualified-r9/`. Its `home`, `fresh-netflix` and `fresh-disneyplus` were absolute isolated API_ANYTHING_HOME paths. No everyday browser import, account login or private session was used.

## Operations and meaning

| Operation | Learning inputs A / B | Held-out C | Result and current exported operation hash |
| --- | --- | --- | --- |
| Netflix `getTitle(titleId)` | `81018682`, The Sea Beast / `80057281`, Stranger Things | `80178603`, My Father's Dragon | title, synopsis, genres, advertised cast, top-billed starring; optional creators. `b3bf49deb52197ac` |
| Disney+ `getTitle(entityId)` | `422f6dcc-226f-44e7-98d4-22de69b31cf3`, The Mandalorian / `04c97b72-504b-47f2-9c6f-fe13d9aea82f`, Frozen | `a21ee2fc-421e-4839-bfcc-0bf2ba815875`, Moana 2 | title, synopsis, genres, creditRole, creditedPeople and advertised cast. `782ddd10f8becf44` |

Netflix's numeric ID is taken from a public title URL. Genres, cast and starring retain the publisher's comma-separated text; creators is absent for the tested films and is The Duffer Brothers for the series. Neither cast nor starring is an exhaustive credit listing. Disney+'s entity ID is the observed public route identifier, not an established partner-feed ID. Its role label is Creator for The Mandalorian and Director for the films, including Moana 2. Names remain associated with that role. No arbitrary search or catalog enumeration was qualified.

Both operations describe signed-out documents in the observed US English context. No playback, accounts, subscription actions, entitlement or regional availability claims follow. No year, season count, trailer duration, movie runtime, audio/subtitle list or plan price is returned. Those page concepts were excluded from this narrow operation rather than conflated.

### Exact public sources and query context

- Netflix A: https://www.netflix.com/title/81018682?pubDate=20250721
- Netflix B: https://www.netflix.com/title/80057281?fromWatch=true
- Netflix C: https://www.netflix.com/title/80178603
- Disney+ A: https://www.disneyplus.com/browse/entity-422f6dcc-226f-44e7-98d4-22de69b31cf3?v=var1
- Disney+ B: https://www.disneyplus.com/browse/entity-04c97b72-504b-47f2-9c6f-fe13d9aea82f?msockid=11734011c9b8602d33cb56c8c8f961c2
- Disney+ C: https://www.disneyplus.com/browse/entity-a21ee2fc-421e-4839-bfcc-0bf2ba815875

C links were reserved by source preparation, My Father's Dragon from a named Netflix recommendation and Moana 2 from a Disney+ footer promotion. No new ID or redirect route was invented. Current local A recommendations differed from the remote preparation snapshot; no recommendation stability is claimed. All local requested documents returned 200 without redirect, auth, challenge, rate limit or error.

Exact source queries were preserved in captures. Learning keeps A's `pubDate=20250721` or `v=var1` as fixed request/trigger context. Each learner warned that B lacks A's query position. No query position was silently rewritten or made a user parameter. The fixed A context was tested successfully for all three IDs per site. C's independent source had no query and matched all returned fields from the fixed-query replay. This establishes the tested metadata equality only; no general date-filter, tracking or variant-selection semantics, safe query removal, or equality of full pages is claimed.

## Frontend capture and offline preparation

The initial cookie-free scout GETs of exact A URLs established readable server-rendered metadata using current `parseShown`. Then the unchanged exact-document helper captured each exact A/B URL under the global atomic browser mutex. The worker acquired `browser.lock` with `mkdir`, wrote its unique owner token, and released only its own token after the gated child exited. All other requests were aborted. Inline scripts may run; these captures do not establish a fully hydrated GUI, computed stylesheet visibility or working interactive controls. No HTTP response was synthesized into a capture, and no Shopee monitor was reused.

| Source | Capture/request ID | Status | Exchanges / aborted |
| --- | --- | ---: | ---: |
| Netflix A | `cmvpfuhl116d1bb:1` | 200 | 43 / 42 |
| Netflix B | `cmvpfvhbp4381e7:1` | 200 | 62 / 61 |
| Disney+ A | `cmvpfwnd8b1dfee:1` | 200 | 42 / 41 |
| Disney+ B | `cmvpfy3bq58e4bb:1` | 200 | 52 / 51 |

Inspected actual captured bodies and title identity before learning. Recipes run through current core extraction, including its removal of hidden streaming markup. The returned fields were present after `parseShown`; no hidden-only field or extractor relaxation was needed. Netflix uses its metadata markers and the observed details grouping. Disney+ follows the Genre label, with its credit role preserved separately.

Offline `addOperation` used both genuine captures and a fetch implementation that refuses network. No tier escalation or live learning probe occurred. Netflix `netflix-preflight.out` passed exported-candidate-plus-draft-notes vet with zero errors/warnings and no export secrets/warnings. Disney+'s initial `disney-preflight.out` exposed an offline recipe defect: a film inserts runtime before genres, so positional genre selection lost Frozen's genres. The script exited 2, before any held-out request. Repaired the candidate selector to follow Genre and reran offline learning. `disney-preflight-fixed.out` proved both film and series fields, zero errors/warnings, no export secrets/warnings. The earlier Disney operation hash `3cfcf1771c519a84` is superseded; all live qualification used `782ddd10f8becf44`.

## Independent held-out comparison, verification and reuse

Each C was independently fetched from its reserved exact public source URL with no Cookie or Authorization, manual redirects and a 15-second timeout. The source inspector read actual bodies immediately, classified access controls and grounded fields from visible title/description and labelled credit/genre groups. It did not derive expected values from the operation's returned data. `netflix-ground.json` and `disneyplus-ground.json` retain source hashes and expected fields; ignored `.body` files retain the documents.

- Netflix `netflix-heldout.json`: one tier-1 request, no healing. All five available fields matched the independent source exactly. Identity was My Father's Dragon; synopsis described Nevergreen and Wild Island, genres included Movies Based on Books, starring began with Jacob Tremblay, and the longer cast retained its separate meaning. Creators was absent, as for source C.
- Disney+ `disneyplus-heldout.json`: one tier-1 request, no healing. All six fields matched exactly. Identity was Moana 2; synopsis described the sequel voyage three years later. Director was retained as the role, with David G. Derrick, Jr., Jason Hand and Dana Ledoux Miller in creditedPeople, and the separate six-person advertised cast list. No role was mislabelled Creator.

| Receipt | Netflix | Disney+ |
| --- | --- | --- |
| Offline candidate export + draft notes vet | `netflix-preflight.out`, zero issues | `disney-preflight-fixed.out`, zero issues |
| Independent held-out source / comparison | `netflix-ground.json` / `netflix-heldout.json`, 5/5 | `disneyplus-ground.json` / `disneyplus-heldout.json`, 6/6 |
| Exact exported-version `verifySite(maxTier:1)` | `netflix-verify.json`, 3/3 pass | `disneyplus-verify.json`, 3/3 pass |
| Public-example export | `netflix.export.json`, exact candidate equality, no secrets/warnings | `disneyplus.export.json`, exact candidate equality, no secrets/warnings |
| Empty-home first call + verification | `netflix-fresh.json`, first C matches; 3/3 pass | `disneyplus-fresh.json`, first C matches; 3/3 pass |
| Exact saved JSON + notes final vet | `netflix-final.json`, zero errors/warnings | `disneyplus-final.json`, zero errors/warnings |

All verification cases were example A, B and C, expecting useful results, at tier 1 without healing. Verification records match the current exported operation hashes listed above. No failing/inconclusive case was dropped. Independent semantic equality is stronger than these nonempty-result verification cases, but remains limited to the tested inputs.

Each fresh home was absent or empty before installing only the exact exported spec. Its first network request was C and sent `cookieSent:false`, `authorizationSent:false`; it returned 200 and issued guest cookies. The later three-case verification used only those site-issued cookies, recording `cookieSent:true`, `authorizationSent:false`, and `guestCookieIssued:true`. No cookie values are in these receipts or tracked files. No pre-fetch guest-cookie assertion failure occurred. Every later request was inspected for actual auth/challenge/rate before returning to core; a persisted stop latch would prevent further network use after a restriction. No restriction occurred.

## Resource policy and commands

Every network/browser/expensive command used `python3 bench/discovery/resource_gate.py --admit 90 --hard 95 -- <command>`. Unchanged helper CPU defaults remained admission below 65%, sampled stop at 85%. Policy memory means occupied RAM excluding file-backed cache, including anonymous inactive and compressed memory. Raw occupied memory is separate. The old 88% memory admission was not used. Parent snapshots 87.27% and 86.78% established replacement eligibility; none replaced fresh per-command admission here.

Underlying commands and scripts are retained in the evidence root:

- `scout.mjs <exact-A-url> <receipt-stem>` from the unchanged r4 source inspector, once per service.
- `capture-owned.py <exact-A-or-B-url> <receipt-stem>` acquires/releases the owned mutex and invokes the gated unchanged `bench/discovery/capture-document.mjs`. It uses the isolated absolute home and the helper's 15-second trigger bound. The helper's first observed total duration was 10,410 ms; subsequent captures were 2,442, 2,091 and 2,887 ms.
- Gated Node offline commands `inspect-capture.mjs`, `stage-netflix.mjs` and `stage-disney.mjs` inspect and learn from retained captures only.
- Gated `node --import tsx .../qualify.mjs <netflix|disneyplus> <ground|heldout|verify|fresh|final>` performs each stage separately. `fresh` uses its site's own empty absolute home. Final is offline and writes only assigned site files after checking all current receipts.

There were 21 gated commands and 48 resource samples from `2026-10-26T15:54:55.033277+00:00` through `2026-10-26T16:05:48.637916+00:00`. Twenty commands admitted; one did not launch. Maximum CPU among samples accompanying admitted commands was 49.69%, policy memory 90.02%, and raw occupied memory 99.76%. The 90.02% policy-memory sample was during Disney+ A capture, below the 95% hard cutoff. Across all samples including the admission denial, policy memory peaked at 90.30%. These are sampled host measurements, not per-process peaks, an unsampled-transient bound or a global cap guarantee. Raw occupied memory was above 95%; it was not the policy-memory metric.

Disney+'s first final offline vet/save attempt exited 75 before launching, at `2026-10-26T16:04:41.981078+00:00`, CPU 35.43%, policy memory 90.30%, raw occupancy 99.69%. Preserved `disneyplus-final.resources` and empty `.out`. Explicitly waited 30 seconds with no site/browser requests; the sole resample at `16:05:48.637916+00:00` admitted at CPU 24.83%, policy memory 86.48%, raw occupancy 99.64%. `disneyplus-final-retry1.out/.resources` records successful zero-issue final vet/save. No additional resamples or replacement batch were launched. The only other nonzero workload was the deliberate offline Disney recipe check, exit 2, described above.

All `.resources` and `.out` receipts are retained. `inventory.json` records the rerunnable resource census, exact file hashes, capture hashes and unchanged helper hashes. Small local file reads, report/hash generation and process inspection were inexpensive and issued no site requests.

## Full provenance

Full SHA-256 values are kept here for audit; caller notes contain no provenance hashes.

| Artifact | SHA-256 |
| --- | --- |
| `sites/netflix.json` | `6357da0ddc047141ceb14c14a8393debfe2b2a478cad0b441db2fefe79de7af9` |
| `sites/netflix.md` | `fbc584860e3d411760b5b21b1c5632799533a7a4155f4445a8cce7132924feea` |
| `sites/disneyplus.json` | `fe646c8c2745d5dea79bd24c7a5f2639c0086524ee7beaa9b9c43461c4c09003` |
| `sites/disneyplus.md` | `4fc151c10da763a37fe94ce69cd1cbc15fef2d03452506f4a62b6ddc5d6cf1f8` |
| `bench/discovery/resource_gate.py` | `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08` |
| `bench/discovery/capture-document.mjs` | `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663` |
| `bench/explore/state/discovery/streaming-coordinator-r4/scout.mjs` | `4f93ed80fcde35e1af1018ef7c324a31536ade84bab50d786bf8b0a649b813a9` |
| `docs/research/discovery/streaming-source-prep-r1.md` | `090e14cdb1e958443090c8c41c33dfbe76acd19a413ee54aff348fca2c285389` |
| Capture `cmvpfuhl116d1bb.json` | `fbbafb94c63a29b791181b57a056f6571d195b7caa1c7eff00500d57990a1b76` |
| Captured document `cmvpfuhl116d1bb:1` body | `76f75f6d3fe4452e47e4ca07b6fd7de86bf03f67daabb910f2e5406c782e64d2` |
| Capture `cmvpfvhbp4381e7.json` | `685051f637bc83b1b624e615d9f61301d915c6634e0b7f62cef3f590946eb080` |
| Captured document `cmvpfvhbp4381e7:1` body | `26c91342fc09ccdbb28ff83c721476cd66b56ae914154fc48d694e09779f355d` |
| Capture `cmvpfwnd8b1dfee.json` | `a9870595ca2853d215c725c8de6a91c936433e670b58119dca700a0b1f024041` |
| Captured document `cmvpfwnd8b1dfee:1` body | `8b5a5f801e1139f4a120619f49c34af832060bd4e00026abbecd2347c1702da9` |
| Capture `cmvpfy3bq58e4bb.json` | `b8ddad24b1331c093abd0d6d6e65cb49f290ee0450601078d23987cbb37855e2` |
| Captured document `cmvpfy3bq58e4bb:1` body | `4a0406a690cef45260307b49698e17957dfc63f6393a2a58a84711f661317749` |
| Independent held-out netflix source body | `f35e865882a8c3daeaf84bb3dad954e6e988a7907ea67aef858da16d8f301df7` |
| Independent held-out disneyplus source body | `419a778c72d66cbe7c14498f08fe6a76069c3cb51d8da81d5020c42dad289e5a` |

## Cleanup and parent handoff

`cleanup.json` at 16:06:41 UTC found no owned gate, Node or Chrome workload and no global browser mutex. The exact-document helper closed each owned browser; the worker released its own lock after its child exited. Isolated evidence homes and profiles are retained, ignored, for audit. No unrelated process or file was cleaned up. The source/dependency diff remained empty. Only the four assigned site files, this report and ignored evidence were written by this worker; frozen first-four specs were untouched.

Both files are ready for the parent's receipt audit and one focused registry gate. The worker did not edit shared catalog/state or run integrated checks. No commit, push, pull request, publication, site write, login, CAPTCHA handling or access-control bypass occurred. Current saved-file hashes equal the successful final-vet receipts and exact public-example exports. Batch completed within its 20-minute bound and covered only the two assigned sites.
