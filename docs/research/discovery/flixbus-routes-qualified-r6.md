# FlixBus route FAQ qualification and parent integration, r6

2026-10-27 UTC. PASS, one distinct public read added: getRouteGuide(route). Existing listStops and all three of its saved cases remain unchanged. FlixBus now has two operations and six saved cases. Parent focused registry, lint and type checks passed before counting. Historical run coverage becomes45sites/59operations/166savedcases; other sites were not freshly reverified in this round.

## Workflow and scope

Callers pass a full linked /bus-routes/ slug including its bus- prefix. The operation reads FAQPage.mainEntity and returns ordered question and answerHtml fields. Answers preserve publisher HTML and links. Render them safely as website content. This is a distinct route-guide read, not another projection of the existing city stop graph.

Published FAQ claims may include minimum fares, travel times, distances, first/last departures and service guidance. They are not date-specific quotes, live inventory, a verified timetable, measured distance or ticketing guarantees. FAQ and overview cards can disagree. The operation returns the FAQ wording. No date-specific shopping, account, booking, ticketing or website write occurred. Missing/non-US route and empty-guide behavior were not qualified.

## Genuine frontend and learning evidence

Retained New York city hrefs supplied A New York to Boston, B Boston to New York and C New York to Washington. R3 actual exact-GET document captures A cmvqyw13r451592 and B cmvqywwgade4aa5 both returned200, held zero cookies and had no Cookie or Authorization request header. They retained75/76exchanges with74/75other requests aborted. R3 local CLI add used both captures, contrasting route arguments and document request1, with a preload rejecting every fetch during learning. Learning returned minTier1 and zero warnings.

No A/B capture was repeated in this recovery. Parent rechecked all51key artifacts in the immutable r3index. The r3index intentionally excludes Chromium runtime profile contents; this historical limit remains disclosed. R6 retained artifacts have their own complete owned regular-file inventory.

## Exact preflight, cold first call and unseen meaning

The public-example candidate and draft notes passed export scans and vetShared with zero errors/warnings before any C request. Twenty localhost groups proved the exact-final per-operation core guards stop the next request after auth, rate, blocked, server error, missing-data drift and redirects. Real data plus Sentry-like rate-limit wording remained a negative control. Twenty-four localhost transport events had no Cookie/Authorization. These tests exercised owned fixtures only.

The final export was copied byte-for-byte into an initially empty isolated home. Its first getRouteGuide call used route=bus-new-york-ny-washington-dc at tier1, returned15rows and was not healed. Initial directory entries were[], initial cookies0, and the sole actual HTTP request had neither Cookie nor Authorization at fetch or undici transport. The exact spec bytes stayed unchanged through all later checks.

A separate C frontend document capture cmvr000wc393f4b then returned200 at https://www.flixbus.com/bus-routes/bus-new-york-ny-washington-dc. It retained75exchanges with74other requests aborted. The core judged it ok. Every one of the15runtime questions matched a unique HTML details/summary question. Every answer matched the separate HTML accordion's decoded text and every resolved anchor target. This compares30claimed fields independently of the JSON-LD extraction source. Whitespace and harmless HTML wrappers were normalized; no recipe or metadata was tuned from C.

All browser captures used unchanged capture-document.mjs with its15second bound, isolated home/profile and the global atomic mutex. Inline scripts may execute. This is document-only evidence, not fully hydrated GUI observation.

## Verification, exports and integrated checks

Every read in the exact final export passed its example and checks in each of two isolated homes: listStops for new-york-ny, boston-ma and philadelphia-pa; getRouteGuide for bus-new-york-ny-boston-ma, bus-boston-ma-new-york-ny and bus-new-york-ny-washington-dc. Twelve case executions and the separate cold first call all passed at tier1 without healing. Both final records carry the exact operation hashes. All13operation requests returned200/core ok with Cookie/Authorization absent; both homes had zero guest cookies after verification. No later guest-cookie reuse was needed.

Public-example export was repeated and remained deeply equal to the frozen candidate. Final vetShared over exact installed JSON and final notes, plus export scans, returned zero issues. Parent focused registry test passed1test; npm run lint checked85files with no fixes; npm run check passed. All eight frozen publication files and approved manifest remained hash-identical. Tracked src/test/dependency files were unchanged. No commit, push, PR or publication was performed.

Exact spec SHA-256: `f354eb2b4edd6e6e50ffbc4aa0acb7e9a668455e4f2bfb29020f8c5f8c699c2a`.
Exact notes SHA-256: `a673810672cd41d32d742b0ff4aecbaf463e12016177dea10f1ee363a0132a50`.
Operation hashes: listStops `ed70437685ad7522`, getRouteGuide `dab8ca164ebc3378`.
Approved publication manifest SHA-256: `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`.

## Resources, cleanup and remaining gaps

R6 recovery used unchanged88/90 snapshots. Initial CPU12.71%/memory88.62% and first resample CPU9.35%/memory88.30% were denied. Samples at18:03:46.335544UTC CPU12.49%/memory87.36% and18:04:31.908591UTC CPU21.37%/memory87.44% passed45.573047seconds apart. Fresh per-command admission followed. Recovery resample counts were carried into qualification; none were reset after success. No qualification command was denied, and no fourth resample was taken. Earlier worker deviations remain preserved in their reports, not retroactively relabeled compliant.

Every substantive offline/source/integrated command used88/90; bounded tier1 calls/verification and understood exact-document C capture used89/90. CPU admission/stop remained65/85 with about2second samples. Qualification resource receipts show peak policy memory86.72% and CPU33.03%. These are sampled host metrics, not a global cap or proof against transient/unrelated workload spikes. All owned commands exited; no owned Chromium or mutex remained and no unrelated process was stopped.

Remaining useful gaps are route discovery/search or route-specific stop relationships only if a distinct public workflow is observed. Live fares, date-specific schedules and booking inventory remain outside this qualification. The original stop-directory limitations still apply. Source-only maps are not counted as APIs.

Raw evidence stays under ignored coordinator-flixbus-routes-qualified-r6. preflight.json, operation-controls.json, cold.json, comparison.json, verify-prepared.json, verify-reused.json, final-vet.json, audit-result.json and the checks/resource logs are the principal receipts. artifact-hashes.json indexes retained owned regular files and the final public report/spec/notes; the manifest excludes itself. In-flight inventory log files are appended after the audit command exits. The final manifest digest is recorded in state and the handoff, avoiding a report/manifest hash cycle.
