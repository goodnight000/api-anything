# Google Play developer catalog qualification r1

Outcome: **ISSUES**, limited to process-receipt coverage. Functional qualification passed for the distinct public read `listDeveloperApps(developerId)`. The saved site has three reads and twelve cases. Both original whole operation objects and their eight cases are unchanged. The parent must decide whether the receipt limitation permits integration; this worker does not claim parent acceptance or counting.

Worker `google-play-developer-qualified-r1-20261028`, 2026-10-28 UTC. Work completed before the absolute 09:33:42.790249 UTC deadline. No nested workers, resource checks, CPU/memory snapshots, resource_gate.py, watchdog admission or resample waits were used. Source, dependencies, existing helpers, shared state/runbook, other sites, PR65 and publication were unchanged. No commit, push, PR or publication occurred.

Evidence paths below are relative to `bench/explore/state/discovery/google-play-developer-qualified-r1-20261028/`. `evidence-manifest.json` indexes all retained owned evidence files, including raw capture envelopes, separately decoded bodies, profiles/cookies, executable probes, baselines, final operations and files. Each entry records absolute path, bytes and SHA-256. Raw documents, captures and executable probes remain ignored. The manifest excludes itself to avoid a recursive hash.

## Grounding and preserved operations

Read AGENTS.md, bench/discovery/README.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, the integrated Google Play JSON/notes, parent and prior worker reports, and the relevant actual core capture/learning/extraction/check schemas. `state-reviewed.json` retains the full initial state, including all stops, aliases, claims and tasks. It contained 136 host-stop entries, 134 aliases and only this active worker. The exclusive claim matched the assigned worker and deadline. Every source request, tier-1 send and capture launch rechecked the current shared stop/alias/claim state through `guard.mjs`; `admissions.jsonl` retains those full ledgers and their state hashes. The historical provider cooldown had expired.

Maps stops on shared Google hosts concern Maps and explicitly do not establish another Google product's access state. No Maps, Google Search or ungrounded search route was read. Parent-grounded literal developer links were audited against their retained source hashes before any catalog request. `grounding-audit.json`, `parent-grounding.json` and copied `grounding-A-detail.html`, `grounding-B-detail.html`, `grounding-D-detail.html` retain this provenance. D catalog content remained unopened until candidate preflight passed.

The supported route is exactly `/store/apps/dev?id=`, distinct from `/store/apps/developer`. All three developer IDs are exact 19-digit strings, never parsed as Number. The parameter pattern bounds syntax to `[0-9]{19}`; it is not a closed enum and does not imply that every matching ID exists. No name-ID or arbitrary-route support is claimed.

Baseline JSON SHA-256 was `c08618acf9881dac90db7c3360ce333cd22f19371d6bdf9ed7a17af0de9e51e6`; baseline notes were `39ebc759b389a3356d9fb2d2105cd8665539cf45dfe9aaf79d20e56bd9e1ec9f`. `baseline-spec.json`, `baseline-notes.md` and separate baseline/final operation files retain the comparison. `saved-equality.json` asserts equality of both complete original operations, including all checks. Current hashes remain getApp `446fd8b87f3f3ddd` and listCategoryApps `5e2875b8d0528344`.

The previous worker's Education prose count was wrong. Parent artifacts establish 93 occurrences and 370 present fields; 46 was Video Players and 52 was Productivity. Those historical files were not rewritten or their used homes rerun. This worker used only new owned homes. `artifact-counts.json` records this run's actual verification response counts separately from historical prose.

## Genuine A/B captures and offline candidate

Used the unchanged `bench/discovery/capture-document.mjs`, exact GET-document restriction, isolated `capture-home`, 15-second trigger timeout and atomic global browser mutex. All other page requests were aborted; inline scripts could execute. This establishes the initial SSR document, not a fully hydrated GUI. Each captured document was classified, and the card recipe was judged before the next website send.

- A `https://play.google.com/store/apps/dev?id=6364851808230428105`: genuine capture `cmvrwgflu675aaf`, request 1, HTTP 200, unchanged final URL, 47 exchanges with 46 aborted. The recipe returned 2 card occurrences and 8 present fields. Total helper elapsed time was 17,758 ms including browser lifecycle; its trigger timeout remained 15 seconds.
- B `https://play.google.com/store/apps/dev?id=6720847872553662727`: genuine capture `cmvrwgvlxaa0e45`, request 1, HTTP 200, unchanged final URL, 20 exchanges with 19 aborted. The recipe returned 10 cards and 40 present fields. Helper elapsed time was 2,650 ms.

`developer-a-capture-receipt.json` and `developer-b-capture-receipt.json` index each real capture envelope and its SHA-256 separately from the decoded `developer-*-capture.html` body hash. No direct-HTTP response was converted into a browser exchange. The card anchors expose package identity/link, visible name and optional spoken rounded rating label. An unrelated featured hero link is not counted as a card.

`learn.mjs` invoked actual `addOperation` with paired genuine captures, differing exact-string developer IDs, explicit request 1 and the card recipe. Its fetch implementation forbade network access. Learning produced zero warnings, minTier 1, one `query:id` slot, no volatile values, credential refs or Cookie header. Stable match is GET, play.google.com, /store/apps/dev. `param-effect.json` retains every A/B identity and both set differences. VLC and Microsoft results are disjoint, proving differing app identities rather than only differing ordering or success status.

`candidate.json` retains public examples and all twelve cases. `candidate-notes.md` records the complete proposed notes. `preflight-vet.json` at 09:17:16.400 UTC reports zero errors and warnings before unseen, cold or verification work. Export secrets and warnings were empty. Caller notes contain 1,603 UTF-16 units before exact `## Maintainer notes`.

## Unseen D and detail handoff

D `https://play.google.com/store/apps/dev?id=6957685454452609502` was independently grounded from the retained Duolingo detail's literal catalog link. Its first catalog source read occurred after offline candidate preflight. `developer-d-source.html`, metadata and actual operation-specific core judgment retain a separate cookie-free HTTP 200 frontend document. This was an independent expected-data source, not capture evidence.

`independent.py` parses the source with Python's standard HTMLParser, independent of the core's node-html-parser and extraction code. It decodes every selected package ID, resolves every listing link, collects name and optional spoken rating label, and retains every occurrence in order. `developer-d-expected.json`, `cold-unseen-result.json` and `unseen-independent-comparison.json` agree on all **3 rows and 12 present fields**, identities and order: com.duolingo, com.duolingo.literacy, com.duolingo.detmobile. Expected and returned serialized-data SHA-256 both equal `d2b0137007593833974d8b521d535a7e49040cdbc0ee9468af33770108fc43cf`.

The first returned package, com.duolingo, fed unchanged getApp. A separate cookie-free detail source was parsed independently from canonical link and JSON-LD. `detail-expected.json`, `chain-detail-result.json` and `chain-comparison.json` agree on package ID, canonical listing URL, app name, displayed developer and category-link code. Discovery and detail names/identity also agree. This handoff establishes those five claimed fields; it does not independently requalify every detail field. Complete getApp case verification is separately retained.

## Cold home, verification and final files

`cold-initial-home.json` records a newly created empty absolute home with `entries: []`. Before its first call, only the exact candidate export was installed under sites/google-play.json. `cold-input-equality.json` and `cold-request-1-boundary.json` prove byte equality and actual first-send absence of Cookie and Authorization. D was that operation's first call, one tier-1 request, with no healing.

The first response issued guest cookie NID into this isolated home. Later chain/verification sends could reuse only that site's issued guest cookie. `cold-guest-cookie-provenance.json`, `chain-guest-cookie-provenance.json`, `verify-guest-cookie-provenance.json` and request boundaries record names/provenance without values. The second browser capture also used only the guest cookie from its own isolated first visit. No private browser state, account login, cookie import or Authorization was used. Initial credential-free reuse is a separate claim from later guest-cookie reuse.

`all-read-verify.json` records all twelve passing cases under maxTier 1 and 15-second per-request bounds: the existing VLC/To Do/ScratchJr/input getApp cases; existing Video Players/Productivity/Education/input category cases; and new VLC/Microsoft/Duolingo/input developer cases. Nine cases sent a request and returned tier 1; three local invalid/path cases sent nothing. Each actual response was judged with its own operation before return to the core or any next send. No retry, heal or fallback occurred. `current-opHash-gate.json` contains zero errors and passing current records for all three operations. New listDeveloperApps hash is `fa89e4201a4f918b`.

Candidate, cold input, final public-example export and saved JSON are byte-identical. Draft and saved notes are byte-identical. `final-vet.json`, `saved-file-vet.json` and `saved-equality.json` retain zero-error, zero-warning final JSON-plus-notes checks and equality assertions. Final artifacts:

- sites/google-play.json: 9,888 bytes, SHA-256 `53a5881327bd6e82f919d9f4b0a1c3813fdf342c1e8fca8596ed848edd05be85`.
- sites/google-play.md: 7,903 bytes, SHA-256 `8958919069221395e9bd2f9058ccd0443d24bfed18e92d0b07e84a3303cc8307`.

The parent owns focused registry, lint, type checks, independent audit and integrated counting. They were not run or claimed here.

## Stops, receipt limitation and cleanup

Fifteen selected public document requests occurred: two browser captures, two independent source GETs, one cold D call, one chained detail call and nine all-read verification requests. All observed origin responses were HTTP 200 with core class ok. No real Play access stop occurred and no STOP.json was created. `guard.mjs` persists a brand-wide STOP before throwing on any actual non-ok core judgment and refuses subsequent commands before fetch/spawn. No transport or route workaround was used.

`processes.jsonl` records both capture wrapper/helper PID pairs and their Chrome descendants while alive, with commands, isolated home and UTC time, then helper exits. Capture locks record PID/token ownership and were removed only after owned helper exits and token comparison. `terminal-sessions.jsonl` records every continuing terminal ID returned: 60316, 57912, 91868 and 97313, all completed with exit 0. Qualification processes recorded their own live PIDs and completion. Commands completing within their initial terminal call returned no continuing session ID.

Receipt issue: the short offline learning command and the two direct-source commands did not record their own self-PIDs while alive. Their commands and result artifacts are retained, but these missing live PID receipts cannot be recovered honestly and were not fabricated. This is an execution-receipt gap, not an origin refusal or failed semantic check. The report therefore says ISSUES despite passing functional gates. Browser/helper ownership receipts are complete.

`cleanup.json` confirms the recorded owned processes and Chrome descendants had exited, the browser mutex was absent, and no unrelated process was stopped. `frozen-preservation.json` asserts unchanged hashes for all eight frozen Pinterest/RottenTomatoes/Rightmove/Steam JSON and notes files, the approved publication manifest and unchanged document helper. Only the two authorized site files, this report and the owned ignored evidence root were written.

This qualification covers the initial numeric developer catalogs for three grounded public identities and the English card layout. It establishes displayed association, not legal ownership, a complete developer inventory, global rank, a fixed region/device population, compatibility, install eligibility, price or purchase rights. Search remains ungrounded. No install, purchase, review, private account or state-changing site action occurred.
