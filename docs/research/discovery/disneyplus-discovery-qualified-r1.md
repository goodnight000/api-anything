# Disney+ discovery qualification r1

2026-10-28 UTC. **PASS for one distinct worker-qualified public read**, pending the parent's receipt audit and shared registry/lint/type/count gates. Added `listFeaturedTitles(pageId)` beside the unchanged `getTitle(entityId)`. No other operation was added. No commit, push, PR or publication.

Sole worker `disneyplus-discovery-qualified-r1-20261028`, no nesting. Evidence root is ignored `bench/explore/state/discovery/disneyplus-discovery-qualified-r1-20261028/`. The coordinator reserved the task at 13:38:38.679879 UTC, with source cutoff 13:46:38.679879 and qualification deadline 13:58:38.679879. The corrected candidate and complete draft passed offline preflight at 13:43:45.420. Final save and exact-file vet passed at 13:48:15.587, inside both applicable bounds. The worker did not edit coordinator state or the runbook.

Read the discovery README first, then AGENTS.md, DESIGN.md, CONTRIBUTING.md, the repository API Anything skill, current Disney+ files and streaming-qualified-r9 evidence. `state-initial.json` preserves complete coordinator state, including stops, aliases, tasks, claim and cooldown. Per-send screens preserve current state hashes and relevant restrictions. Disney+ had no matching stop, the provider cooldown had expired, and this was the sole active claim. No memory lookup, CPU/memory snapshot, resource admission, resource watchdog or recovery/resample wait was used. Existing helper sources and defaults remain unchanged.

## Contract and useful difference

`listFeaturedTitles` reads title labels and source links from the explicitly labelled **Featured** shelf of a signed-out public `browse/page-` brand or collection document. Each row returns `title`, `sourceUrl` and the entity ID carried by that exact source link. Pixar and Disney each returned ten rows with different identities. Independent National Geographic D also returned ten rows. This is collection-to-title navigation that feeds the preserved detail operation, rather than another scalar wrapper or global promotional footer.

The recipe selects the heading's direct sibling content, then its region's labelled entity anchors. Ordinary hidden-markup removal remains enabled. Header/footer links and other shelves are excluded. The title anchor's accessible label agrees with its thumbnail label in independent source parsing. Source order means each response's document order. No stable ranking, complete shelf, catalog completeness, fully hydrated carousel, playback, entitlement or regional availability is claimed. Entries can describe films, series, shorts or music-video title pages. No playback or trailer resource was requested.

`pageId` is server-bound in the actual document request path. It comes from literal public source anchors, not an invented endpoint or UUID. Entity IDs remain public route identifiers, not established partner-feed identifiers. The original fixed `v=var1` context and label-based Genre extraction remain unchanged. `creditRole` retains its actual label, including punctuation, and owns `creditedPeople`; cast can be incomplete.

## Source grounding and held-out reservation

The historical genuine captures `cmvpfwnd8b1dfee:1` and `cmvpfy3bq58e4bb:1` were inspected for actual schema and anchors. Both contain literal Disney, Pixar and National Geographic `browse/page-` links. They supplied navigation grounding only, not fresh health evidence. `reservation.json` reserved A, B and independent D before any new-workflow source/output exposure. D was not inspected until after the corrected candidate-plus-complete-draft-notes preflight passed. No D-based selector change occurred.

Exact source requests, with no extra query parameters:

- A, Pixar: https://www.disneyplus.com/browse/page-9143212f-5696-4ee3-a37a-f2fbcd14749a
- B, Disney: https://www.disneyplus.com/browse/page-4c4b78ed-4a17-43eb-8221-14a3959e4517
- D, National Geographic: https://www.disneyplus.com/browse/page-a577ee5e-2f37-443f-bc13-594a20520492
- Discovered title, Rome Underground: https://www.disneyplus.com/browse/entity-2af7bad3-0419-4ad9-88ab-fd46228b2b86

No supported public API was linked by the inspected navigation. The readily usable linked public brand documents were sufficient; no partner-feed, alternate host, country variant, search endpoint or source-map API was invented or visited.

## Fresh frontend evidence

The unchanged `bench/discovery/capture-document.mjs` ran serially under an atomically acquired global `browser.lock`, with a unique token and wrapper PID. Each run used the isolated `home`, the helper's 15-second trigger timeout and a 60-second outer startup/cleanup bound. Helper stdout/stderr were opened before launch. Wrapper/child PIDs, command, home, start/exit and live descendant command samples are retained in each `*.process.json`; terminal-session IDs are in `terminal-sessions.json`. Only the owned token was released after the helper exited.

- A: `cmvs5y7x78ddf2e:1`, HTTP 200, 73 exchanges, 72 aborted. Helper elapsed 14,020 ms. Answered document body SHA-256 `f020b68e378d301349d0d10f2a46840ac6f72b7461dc78b9df64a85c99d8145a`.
- B: `cmvs5yvp091087e:1`, HTTP 200, 66 exchanges, 65 aborted. Helper elapsed 6,859 ms. Body SHA-256 `2cb1f27ae9a255477a35673e91bed61ab3eaddf08e6f7e758fbd310ce5de1fc2`.
- D: `cmvs60smq11f6c9:1`, HTTP 200, 98 exchanges, 97 aborted. Helper elapsed 4,653 ms. Body SHA-256 `fa02c3f1fcc794c314ba44566622ecefdfb0a715a1b604f9c2b9aaadc140e0c4`.
- Discovered title: `cmvs62e2x3e24ad:1`, HTTP 200, 53 exchanges, 52 aborted. Helper elapsed 3,908 ms. Body SHA-256 `bb8f76381bf47725d6c540e323432c860262c36388ecc130fa7dde4f4bc8fec8`.

Each capture has one answered exact GET document. Aborted resources are not answered XHR. Inline scripts could run; stylesheets and other requests were aborted, so computed visibility and interactive hydration are unknown. No full-page monitor or Shopee monitor was used.

## Learning, qualification and exact version

Paired `addOperation` used the genuine A/B captures offline with a fetch implementation that refuses network. The final ten-row recipe produced zero learning warnings, no `unproven` mark and tier 1. Export with public examples had zero secrets or warnings. The complete draft notes plus exact candidate passed offline `vetShared` with zero errors/warnings before D, cold calls or live verification.

The initial offline selector accidentally included enclosing sections and returned 130/158 rows. Inspection exposed that local recipe fault before held-out exposure. Its candidate, source and preflight are retained under `superseded-broad-*`. The corrected direct-sibling selector returned ten rows per page. Only the corrected candidate was cold/live qualified and saved. No origin refusal or selector relaxation was involved.

`independent.py` uses Python's standard-library HTMLParser, with its own heading/sibling traversal, hidden-element checks, label/image agreement and URL identity parsing. It does not call runtime extraction or derive expected fields from operation output. All ten A/B rows were also compared offline against this independent parser. D's ten rows matched the separate tier-1 response exactly for all three fields, identities and array order, with no sorting, retry or output repair. D's full source and tier-1 body hashes also happened to match; no stability beyond this observation is promised. `heldout-d.ground.json`, `heldout-d.core.json`, `cold-result.json` and `heldout-comparison.json` retain the proofs.

`cold-home` was initially empty. `cold-input.json` records `entriesBeforeInstall: []` and input hashes. Only the exact candidate export was installed before its first call. At the actual first send, `first-send.json` records no Cookie and no Authorization. The first call was held-out D at tier 1, with no healing. Later calls reused only guest cookies issued by actual responses to this home: `ak_bmsc`, `bm_mi` and `bm_sv`. Cookie names, response issuance and send provenance are retained without values in the summary receipts. No everyday-browser import, private cookie or account login was used. The capture profile and cold-home jar were separate.

`verifySite(maxTier:1)` passed all six cases on the exact candidate: original Mandalorian example, original Frozen and Moana 2 checks, plus Pixar example, Disney and National Geographic checks. Current hash-matching records are preserved in `verification.json` and the cold home. No original case was replaced, weakened or removed. Every actual response was persisted with status, headers, Location and body diagnostics before `judge(op, observed)`. Actual core judgment completed before the next verification send. The request wrapper checked the shared sticky STOP before fetch and would save it before returning any actual non-ok core result or request failure. No such result occurred; no STOP file exists. No heal, retry, fallback, alternate route or transport was attempted.

The second D row supplied Rome Underground's entity ID. Its separate frontend title document was independently parsed by labelled groups. The single tier-1 call to the **unchanged** `getTitle` used the stored fixed `?v=var1` template. All six fields matched the independent source: title, synopsis, genres, `Director:` role, Laurent Portes as credited person and Brett Schaenfield as advertised cast. The public source without a query and tier-1 fixed-context body differed in bytes, while all six claimed fields matched. No full-page equality is claimed.

The independent title parser initially assumed a Starring label instead of actual Cast, then removed the role label's trailing colon. Both were local parser/comparison faults. Only that independent parser was corrected from retained source text. The successful single core response was re-compared offline by `compare-saved.mjs`; it was not fetched again. `title.process.json` intentionally retains exit 1 from the punctuation assertion, and `discovered-title-comparison.json` records the successful offline adjudication. No origin verdict, runtime change, new example or replacement response was used to hide either fault.

Final exact hashes and gates:

- Existing `getTitle` operation hash remains `782ddd10f8becf44`; its whole operation object, example and both checks equal the baseline.
- New `listFeaturedTitles` operation hash is `804fc8341a60c89d`; all three verification cases have passing current-hash records.
- Candidate, cold input, installed cold spec, tested public-example export and final `sites/disneyplus.json` are byte-identical, SHA-256 `7e82d67d6adb93a4185adc4702befd3713683392d169efa102bd5bdd4ff731be`.
- Final `sites/disneyplus.md` equals the preflight draft bytes, SHA-256 `20cdfce4cdf3b3076c46fb1bd00070e73a3c685117db35d5190a8118526d634d`.
- Final saved JSON plus notes passed offline `vetShared` with zero errors/warnings. Caller notes are 1,003 UTF-16 code units before the exact `## Maintainer notes` heading.
- Baseline JSON SHA-256 is `fe646c8c2745d5dea79bd24c7a5f2639c0086524ee7beaa9b9c43461c4c09003`; baseline notes SHA-256 is `4fc151c10da763a37fe94ce69cd1cbc15fef2d03452506f4a62b6ddc5d6cf1f8`. Separate baseline copies were made; `parent-baseline.json` was never overwritten.

## Scope, cleanup and handoff

There were four browser document sends and eight tier-1 document sends, all to the literal observed `www.disneyplus.com` sources, all HTTP 200. No auth/rate/challenge/repeated-origin-error stop occurred. No other site, Disney affiliate, private session, website write, account, subscription, playback or access bypass was used. All existing global stops remain applicable. The frozen Pinterest, Rotten Tomatoes, Rightmove and Steam eight files match the parent's initial hashes. No publication manifest or PR65 was changed.

`cleanup.json` found no live recorded owned PID and no global browser mutex after all network/browser commands exited. Each helper closed its browser, and each wrapper released only its own mutex. No unrelated process was stopped. Ignored homes, profiles, jars, raw captures, bodies and probe source remain for audit. The offline stage and small local inspection commands have tool exit receipts but did not record live OS PIDs; no PIDs were reconstructed for them. Browser/network commands retain their live wrapper/child evidence and observed Chrome descendants.

`manifest.json` inventories paths, byte lengths and SHA-256 for the ignored evidence, probes, baseline copies, homes/profiles, current final site files, report and unchanged helpers. It records capture-envelope hashes separately from decoded answered-response bodies. Its own bytes are excluded to avoid a self-hash cycle. `handoff.json` records the manifest hash and functional gate summary.

Saved changes are only `sites/disneyplus.json`, `sites/disneyplus.md`, this report and the assigned ignored evidence root, apart from the explicitly required temporary owned browser mutex. Parent alone owns state integration, registry/lint/type/count gates and any publication decision. Worker-qualified delta is one read, with two total Disney+ reads in the candidate; no integrated-count claim is made.
