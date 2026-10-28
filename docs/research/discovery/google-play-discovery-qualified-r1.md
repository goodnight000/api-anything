# Google Play category discovery qualification r1

Outcome: **PASS** for the worker qualification gates. Added one distinct public read, `listCategoryApps(category)`, feeding preserved `getApp(packageId)`. There are now two operations and eight example/check cases. The coordinator still owns focused registry, lint, type checks and final integration/counting. No commit, push, pull request or publication occurred.

Worker: `google-play-discovery-qualified-r1-20261028`. Work completed on 2026-10-28 UTC before the 09:17:39.592108 UTC deadline. Only `sites/google-play.json`, `sites/google-play.md`, this report and the owned ignored evidence directory were written. No nested agents, CPU/memory checks, resource gate, watchdog or resource-resample waits were used. Existing helpers, source, dependencies, shared state/runbook, other sites and earlier evidence were unchanged.

Evidence paths below are relative to `bench/explore/state/discovery/google-play-discovery-qualified-r1-20261028/` unless otherwise stated. `evidence-manifest.json` records absolute file paths, byte counts and SHA-256 values for the raw documents, capture envelopes, decoded capture bodies, isolated profiles/session files, executable probes, receipts, baseline/final operation objects, saved files and this report. Raw evidence remains ignored. Hashes of capture envelopes and their decoded bodies are recorded separately.

## Source choice and preserved contract

Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the actual capture/type/spec/learning/classification/extraction/check/export schemas and existing Google Play spec, notes and qualification report. Audited full current stop/alias/task/claim state. Only this Google Play qualification worker was active; its exclusive claim matched the brief. The recorded model-provider cooldown had expired. Maps stops on shared Google hosts explicitly concern Maps; neither Maps nor Google Search was read to obtain Play data. `state-reviewed.json` retains the reviewed state; `admissions.jsonl` rechecks current state at each send/spawn, including all host stops, aliases and the claim.

The original `getApp` operation and its complete four-case contract remain serialized-object identical: VLC example, Microsoft To Do, ScratchJr and local `invalid/path` refusal. Equality is asserted in learning, final export and saved-file validation. `baseline-getApp.json` and `final-getApp.json` are byte-identical serializations; `final-equality.json` and `saved-file-vet.json` retain the checks. No second detail wrapper was added.

Retained VLC and To Do capture envelopes were schema-audited before reading their actual HTML. Their literal links grounded `/store/apps/category/VIDEO_PLAYERS` and `/store/apps/category/PRODUCTIVITY`; developer catalog links were also observed but deferred. No actual search form/request was established, so no conventional search endpoint was guessed. An initial exact cookie-free Video Players source GET established the SSR card contract. Its real category cards contain app-detail anchors, visible card names and spoken rounded rating labels.

The distinct unseen category `EDUCATION` was grounded from the literal `/store/apps/category/EDUCATION` link in the retained ScratchJr source before opening any Education category source or replay. `unseen-grounding.json` records that selection; the independently fetched Education source came later, after offline candidate preflight. These retained detail documents are navigation grounding, not fresh health evidence. `navigation-grounding-a-b.json` and `retained-*-navigation.html` retain the exact A/B leads. No closed category enumeration or invented third value was claimed; callers copy a category code from a real link, and the parameter regex only bounds syntax.

## Genuine capture, learning and preflight

Used unchanged `bench/discovery/capture-document.mjs`, exact GET only, with its 15-second trigger timeout and an isolated `capture-home`. Acquired the global browser mutex atomically and recorded owner PID/token. Each captured document was classified before the next request. All other page requests were intercepted and aborted; inline scripts could run. This proves the initial SSR document contract, not a fully hydrated GUI.

- A: `https://play.google.com/store/apps/category/VIDEO_PLAYERS`, capture `cmvrvxbz57d4dd6`, document request 1, HTTP 200, final URL unchanged. 27 exchanges, 26 aborted; recipe returned 46 app-card occurrences.
- B: `https://play.google.com/store/apps/category/PRODUCTIVITY`, capture `cmvrvxw4qf985a7`, document request 1, HTTP 200, final URL unchanged. 40 exchanges, 39 aborted; recipe returned 52 app-card occurrences.

`category-a-capture-receipt.json`, `category-b-capture-receipt.json` and the retained genuine capture envelopes establish those observations. Each receipt has distinct envelope and decoded-body hashes. `category-a-final-recipe-judge.json` and `category-b-final-recipe-judge.json` contain actual core judge output. `param-effect.json` records all A/B identities and each direction's set difference, proving differing category answers rather than only HTTP success.

`learn.mjs` called actual `addOperation` with paired genuine captures, differing category examples and explicit request 1. No live fetch was allowed during learning. Learning returned zero warnings, tier 1, one `path:3` category slot, no volatile values, credential refs or Cookie header. Stable match: GET, `play.google.com`, `/store/apps/category/*`. The recipe selects initial app-card anchors and returns package ID, absolute listing URL, card name and the card's spoken rating label when present.

`candidate.json` is a public-example export, not a fabricated exchange or hand-authored request template. `candidate-notes.md` is the complete draft caller/maintainer text. Offline `preflight-vet.json` at 09:02:59.201 UTC reports **zero errors and zero warnings**, before unseen/fresh/live verification. Export secrets and warnings were both empty. Caller notes are 1,758 UTF-16 units before the exact `## Maintainer notes` heading.

## Unseen independent comparison and detail chaining

The independently grounded D URL was `https://play.google.com/store/apps/category/EDUCATION`. A separate signed-out cookie-free GET returned HTTP 200. `category-d-source.html`, its metadata and health judge retain that actual source. `independent.py` uses Python's standard HTMLParser, independently of core/node-html-parser extraction, to parse every app-card occurrence, decode each package identity, resolve each link, collect its card name and spoken rating label, and preserve order. `category-d-expected.json` contains the complete expected 46 rows.

`cold-unseen-result.json` is the actual tier-1 D call, one request, no healing. `unseen-independent-comparison.json` establishes exact equality for every field of all 46 returned rows, including identity, duplicate occurrences and order. Both full expected and actual serialized data hashes are retained. This establishes the returned initial document's cards, not exhaustive category membership or global ranking.

The first returned Education card was the actual app link for `com.duolingo`, Duolingo: Learn Languages. That package ID fed the unchanged `getApp` operation. A separate cookie-free detail source was independently parsed from its JSON-LD and canonical link. `chain-detail-result.json`, `detail-expected.json` and `chain-comparison.json` agree on package ID, canonical listing URL, name, displayed author/developer and category-link code; discovery and detail names/identities also agree. Other detail fields were not separately requalified by this chain comparison.

A local diagnostic mistake interrupted that comparison: an unquoted URL triggered zsh glob rejection, leaving the expected file absent after the chain GET had already returned core class `ok`. The successful request/result were retained. Quoting the URL and completing the parser/comparison offline resolved it without another website request. `local-diagnostic-errors.json` distinguishes this local failure from an origin access judgment; no site stop was inferred.

## Exact cold input, all reads and final files

`cold-initial-home.json` records the initially empty absolute `cold-home` directory (`entries: []`). The exact candidate bytes were the only spec installed before its first call. `cold-input-equality.json` proves equality. `cold-request-1-boundary.json` records the actual first Education request with **Cookie absent and Authorization absent**, before fetch; it was the only request in that call.

The first response issued guest cookie `NID` for `.google.com`, path `/`. Later calls could reuse only cookies issued into this isolated home. `cold-guest-cookie-provenance.json`, `verify-guest-cookie-provenance.json` and per-request boundary receipts disclose names/provenance without values. The second browser capture likewise carried a guest `NID` from the first isolated visit. No everyday-browser cookies, private session, login or authorization were imported. The credential-free first-request claim is separate from later guest-cookie reuse.

`all-read-verify.json` records actual `verifySite` with maxTier 1 and 15-second per-call timeout:

- `getApp`: VLC example, Microsoft To Do result, ScratchJr result, invalid-path input refusal — all four passed.
- `listCategoryApps`: Video Players example, Productivity result, unseen Education result, invalid-path input refusal — all four passed.

Six network cases used tier 1; two local input refusals sent no request. Every actual response was judged using its own operation before the wrapper returned it or any next send was allowed. No healing, retries or browser fallback occurred. `current-opHash-gate.json` has zero errors and current records for both operations. Hashes are `getApp: 446fd8b87f3f3ddd` and `listCategoryApps: 5e2875b8d0528344`. `final-op-hashes.json` records one example plus three checks for each operation.

`final-export-receipt.json` has zero secrets and warnings. `final-export.json`, the tested `candidate.json`, the cold home's exact spec input and saved `sites/google-play.json` are byte-identical. `final-vet.json` and `saved-file-vet.json` both report **zero errors and zero warnings** for exact final JSON plus notes. The saved files are:

- `sites/google-play.json`: 6,894 bytes, SHA-256 `c08618acf9881dac90db7c3360ce333cd22f19371d6bdf9ed7a17af0de9e51e6`.
- `sites/google-play.md`: 6,090 bytes, SHA-256 `39ebc759b389a3356d9fb2d2105cd8665539cf45dfe9aaf79d20e56bd9e1ec9f`.

Baseline JSON was `4fa81198e438230d509dbbe6bbceb314a59eeb9da0bbe01bcfd6e752a08d16ca`; baseline notes were `4a83929275abd4d53f5dee4bcc9152dd60457bf3cac9ca513e642ac9845ee00d`. The original JSON remains in `baseline-spec.json`, and the original notes remain in `baseline-notes.md`.

## Stops, scope, limits and cleanup

There were thirteen selected public document requests: three independent source GETs, two real browser document captures, one cold unseen call, one chained detail call and six all-read verification requests. All observed origin responses were HTTP 200 and core class `ok`; no auth/rate/challenge or repeated origin error occurred. Consequently no real `STOP.json` was created. `guard.mjs` checks a persistent owned STOP and current shared stops before every direct send or browser spawn. Any real non-ok core response would persist a brand-wide stop before returning, refusing later commands/routes/transports. No alternate route or transport was used after an origin refusal.

Only three category arguments and the English layouts were checked. No language/country was invented or fixed, and future layout/locale may differ. Category pages may contain editorial shelves, duplicates and partial initial inventories. Order is response document order; rounded card ratings establish neither an exact count nor a device population. App availability, compatibility, install eligibility, price, paid rights, pagination and exhaustive/global ranking are unqualified. Search and developer catalogs remain source/extraction leads. No install, purchase, review, private account, or state-changing site action occurred.

`processes.jsonl` records wrapper, helper and owned Chrome descendant PIDs, commands, homes and UTC times while alive, followed by helper exits. The two capture helper commands exited normally and closed their browsers. Mutex owner tokens were checked before removal, after helper exit. `terminal-sessions.jsonl` retains all returned session IDs: 6780, 31649, 22876, 64087 and 37434. Commands that completed within their initial terminal call returned no continuing session ID. The diagnostic chain command's exit 1 is recorded separately from its successful origin response. No PID receipt was reconstructed.

`cleanup.json` confirms no remaining owned processes and no browser mutex. Unrelated processes were preserved. `frozen-preservation.json` proves all eight frozen Pinterest, Rotten Tomatoes, Rightmove and Steam files plus `publication-approved-20261026/approved-manifest.json` retain their baseline hashes. The approved PR65 snapshot was not edited. Coordinator integration checks remain outstanding; this worker does not claim them.
