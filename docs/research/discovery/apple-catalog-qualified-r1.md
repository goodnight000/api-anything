# Apple catalog qualification, round 1

Qualified on 2026-10-27 UTC. Finished 2026-10-27T18:26:50.224849+00:00, within the 20-minute bound from the parent launch at 18:13:09.750037 UTC. One distinct operation was added to the saved Apple candidate. The worker does not count it as an integrated API. Parent registry, lint, type checks, state, coverage and counts remain pending.

## Result and caller gap

The preserved `getTechSpecs(product)` requires a known iPhone model-family path. The added `listProductFamilies(family)` discovers named public catalog destinations for `iphone`, `ipad` and `mac`. It returns the published family name and destination URL from product tiles. This is a catalog workflow, separate from technical specifications. Site name, display name, base URL and the complete original operation remain unchanged; only the site description was extended.

Saved files are `sites/apple.json` and `sites/apple.md`. The new operation accepts only the three supported category names. There is no search, pagination, price, stock, date-specific availability, configuration, cart, purchase or account operation. Category membership is publisher content, not an availability guarantee. Mac includes associated display families. Document order and repeated responsive rows are preserved. The held-out Mac answer contained 16 rows representing 8 distinct name/URL pairs. Callers may deduplicate identical pairs. A destination can be an overview or a direct specifications link; do not manufacture a `/specs/` link from an overview URL.

No source-only operation was saved. No new domain, shared source/dependency/helper/runbook/state/catalog edit, delegation, commit, push, PR, publication or submission was performed. Only public reads were sent.

## Frontend grounding and qualification order

All ignored evidence names below are relative to `bench/explore/state/discovery/apple-catalog-qualified-r1/`.

The retained frontend sources were located at `bench/explore/state/discovery/electronics-r1/apple-home.html` and `apple-iphone.html`, not inferred from model names. The homepage links `/iphone/`, `/ipad/` and `/mac/`. The iPhone source has named product tiles and real destination links, including an iPhone 16 link directly to its specs page. These links grounded both training inputs and the held-out category. The previous captures were located exactly at `electronics-r1/apple-home/captures/cmvp3hk4s0a130f.json` and `cmvp3hz3f395ae4.json`. External-source paths and byte hashes are retained in `provenance.json`. No other brand in the earlier electronics report was accessed.

Before new website traffic, `proposed-latch` tested the proposed operation against an owned localhost HTTP fixture using the real core `judge`. Each 401/auth, 429/rate, 403/blocked, 503/error and 200 login-form/auth response allowed one request and prevented the next. Healthy product markup with SentryJS and an ordinary script marker allowed both requests. The exact final operation repeated all six cases successfully in `exact-latch-main-guard`, before its first live call. The final operation hash in that fixture equals the final export's operation hash. Fixture servers exited with their owned Node processes.

The unchanged `bench/discovery/capture-document.mjs` made two genuine browser captures, each with its 15-second timeout and the worker's isolated absolute home/profile. Capture A used `https://www.apple.com/iphone/`, request 1, capture `cmvr0caugf6b9f7`: HTTP 200, 18 other requests aborted. Capture B used `https://www.apple.com/ipad/`, request 1, capture `cmvr0cm03ef4d08`: HTTP 200, 73 other requests aborted. Both captures reside in `learn-home/captures/`. Only the exact requested GET document was allowed. Inline scripts may run; this is server-rendered document evidence, not a hydrated GUI. The worker's atomic global browser mutex was released after each browser command. No private browser state was imported.

The initial iPhone-only tile recipe classified the captured iPad document as `drift`, with missing selector `main .product-tile`. No auth/rate/blocked/error was observed. Inspection of the saved B document found the second, namespaced product-tile layout. The recipe was adjusted using A/B only. CLI `add --from/--from2 --pick-request 1` learned the operation at minimum tier 1 with zero warnings. The final A/B audit returned six iPhone families and four iPad families with no shared names. `relearn.out`, `final-audit.json` and the intact captures retain the evidence. No request/response tracing headers were hand-stripped and no exchange was fabricated.

The public-example candidate and draft notes passed `vetShared` and credential scans with zero issues at 18:19:41 UTC. Only after that preflight was the held-out Mac document opened. The recipe and operation metadata were fixed before C. The subsequent notes-only clarification about responsive repetition and displays was preflighted again at 18:22:19 UTC and followed by exact-candidate replay of every read in both homes.

## Fresh first call, held-out meaning and final replay

`fresh-initial.json` records that `fresh-home/` began with zero entries and no session/jar. The only installed input was the exact final JSON export. Its first operation call, `listProductFamilies(family=iphone)`, returned tier 1. The fetch hook and actual Undici HTTP `sendHeaders` event independently recorded no Cookie and no Authorization. Header values were never logged in these receipts. See `fresh-evidence.json` and `fresh-first-fixed.out`.

Guest cookies issued later by this public session were reused. Both prepared and reused verification sent those isolated guest cookies. Neither proof is represented as cookie-free verification. No imported or everyday browser cookie was used. The initial fresh-home assertion remains a distinct, successful first-call proof for the exact final JSON.

`source-c` independently read `https://www.apple.com/mac/` at 18:20:54 UTC, HTTP 200, and retained `source-c.html`. The source body hash is `cf9ac7f2c786082f8acc792a4ee5ba26a3b3b0deff75123f30494940100e5395`. Core classification of that actual response occurred before the next request. The unseen operation call `family=mac` returned tier 1 at 18:21:29 UTC. `meaning.py` used Python HTMLParser, semantic gallery list items, their h3 headings and first Learn more destinations. It did not invoke the runtime CSS extractor. `meaning.json` proves exact equality of every name and destination URL, order and multiplicity for all 16 rows. No recipe was tuned from C.

`verifySite` ran with a fetch-level core-classification latch using the actual final operation selected for each request. An actual auth/rate/blocked/error latches before any later fetch; the worker also persists a brand stop across operation wrappers. No such live classification occurred. This avoids relying on aggregate verification to stop traffic.

`prepared-evidence.json` and `reused-evidence.json` each record eight passes, zero failures and zero inconclusive cases. Each run sent six public reads. The two invalid-path cases were refused locally and sent nothing. Cases were:

- `getTechSpecs`: example `iphone-18-pro`, checks `iphone-16`, `iphone-duo`, and local `invalid/path`.
- `listProductFamilies`: example `iphone`, checks `ipad`, held-out `mac`, and local `invalid/path`.

The final CLI public-example export is byte-identical to the preflight candidate. `final-audit.json` verifies all original operation fields and all old cases against the parent's baseline object. `saved-vet.out` checks the exact saved JSON and complete notes after copying: `vetShared` has zero errors/warnings, and four credential scans against both isolated sessions have zero secrets/warnings. No metadata or recipe changed after final replay.

## Exact receipts

Original JSON SHA-256: `1614440eb7afa0b57162dc78d2b43761777832bb918cb79ab0a533e3a544ba72`.

Original notes SHA-256: `632819ee828422f09b643f907c5e30af26fe3693dbae7c5fffeceaba57948551`.

Final JSON SHA-256: `2d12939c83a456e987b7a352cc977497f0f7de20101510a42e3bdc5963f6a41c`.

Final notes SHA-256: `3a9c7ee9c8dea866418a1219aef90f7e45bb98b8235ff342b83dca36b29bef62`.

Complete preserved `getTechSpecs` object SHA-256, JSON.stringify serialization: `e731d84649a429561742b21239fdf828fe594d0a7cfe7787d2305c4381550547`.

New `listProductFamilies` object SHA-256, JSON.stringify serialization: `20d7d3a61cf9cc3c9792a2b2aaaddec9fb64d1904d106bd50da023941516a135`.

These are full-operation comparisons, including request headers, slots, matcher, trigger, recipe, parameter metadata, example, read-only/minimum-tier/login flags and all checks. Existing site metadata is preserved except the additive description.

## Resources, failures and deviations

Every live request, browser command, localhost fixture execution, learning/export, credential/vet check and verification used the unchanged resource gate with explicit memory hard stop 90%, CPU admission 65% and CPU stop 85%. Expensive local/source analysis and the unknown iPad layout capture used admission 88%. The already-understood iPhone exact-document capture and bounded tier-1 calls used 89%. Five early gated DESIGN reads have transcribed tool receipts in `early-gate-transcript.json`; the other early reads have retained `.resources` logs. Later commands have `.command.json`, `.out`, `.resources.jsonl` and `.exit.json` receipts.

No admission or watchdog exited 75, no retry/resample was used, and no post-denial wait was needed. Retained native resource logs through cleanup peaked at CPU 38.73% and policy memory 87.29%; the five transcribed early DESIGN samples include policy memory 87.46%. Raw occupied memory reached 99.70%. These samples do not prove a global resource cap or bound unrelated workloads or unsampled transients. No threshold was raised and no unrelated program was stopped.

Procedural deviations are retained honestly. Initial cwd/status/path/memory searches, line counts and runbook/helper bootstrap reads were not resource-wrapped. Small script creation and one import-guard repair also ran outside the gate; their execution checks were gated. Several bundled instruction reads exceeded tool output budgets; bounded rereads followed. Five early gated DESIGN reads did not create per-command artifact files, so their receipts are explicitly transcript-derived, not native log files. Later use of the receipt wrapper avoided that gap.

Three local nonzero outcomes occurred. The tentative B selector returned `drift` and local exit 2. The first draft preflight failed locally because draft assembly selected the old operation rather than the new one and attached wrong checks to a duplicate; no live request followed, and the draft was rebuilt from the untouched baseline. The first fresh helper attempt failed on import with ENOENT before home setup or network traffic; its main guard was repaired and the exact-operation fixture rerun. These were not origin auth/rate/challenge observations. No failed draft was copied into `sites/`.

## Manifest, stop status and cleanup

`bench/explore/state/discovery/apple-catalog-qualified-r1/manifest.json` indexes 413 retained owned regular artifacts, 11142064 bytes, with byte sizes and SHA-256. Every included artifact was rehashed successfully before finalization. Captures, scripts, raw documents, isolated sessions and all browser-profile regular files are included. Nonregular runtime entries are listed separately. The manifest excludes itself and exactly three runtime receipts produced by its own command: `manifest.out`, `manifest.resources.jsonl`, `manifest.exit.json`. Those are retained but not covered by its recursive hash. The manifest command descriptor is included. This report is outside the ignored artifact root.

Manifest SHA-256: `a70ac33d3af5979becc9dc1825558e4a852c3ff0b18d0f63936f79baf9976e6f`.

The relevant state controls contained no Apple stop, and provider cooldown was already expired. No new Apple origin-control stop was observed. `cleanup.json` at 18:24:15 UTC found no owned Node/browser process and no global browser mutex. Owned fixture servers had exited. No unrelated process, browser, server, profile or mutex was stopped/deleted. Ignored evidence is retained. Parent integrated gates and counting are the only outstanding acceptance steps.
