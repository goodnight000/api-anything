# Coursera curriculum qualification r2

2026-10-28 UTC, started 07:12; final receipts contain completion time. Worker qualification PASS. One distinct operation added, for three total Coursera reads and nine saved cases. Counting remains conditional on the parent's integrated registry, lint and type gates. No commit, push, PR or publication was performed.

## Result and limits

`getSpecializationCourses(slug)` reads a public specialization's constituent courses in displayed curriculum order. Each record contains the course title, destination with the observed specialization membership query, and Coursera's course-number/workload summary. It answers program membership and sequence, which the existing catalog search and individual Course JSON-LD read do not answer. Both complete original operation objects and all six original cases are unchanged.

The operation uses the actual public document at `https://www.coursera.org/specializations/{slug}`. Its supported HTML recipe selects `[data-track-component=syllabus] [data-testid=accordion-item]`, reads the `sdp-course-list-link` anchor and the adjacent accessibility workload text, and excludes footer recommendations. Output preserves source order. Workload estimates can change. Displayed order does not prove an enrollment prerequisite. Certificates, degrees, paid lessons, assessments, enrollment and account actions are outside this read.

## Actual captures and learning

The repository's unchanged `bench/discovery/capture-document.mjs` ran directly with a separate absolute `API_ANYTHING_HOME` and the atomic global `browser.lock`. It allows only the exact requested GET document, aborts other requests, uses its existing 15-second timeout, and closes its browser in `finally`. Inline scripts may execute. No private browser profile or cookie import was used. No resource snapshot, watchdog wrapper, recovery pair or resample wait ran.

- A, https://www.coursera.org/specializations/machine-learning-introduction, capture `cmvrs3hvy18895f`, selected document ID 1, HTTP 200, three curriculum records. Sixty-one other exchanges were aborted.
- B, https://www.coursera.org/specializations/deep-learning, capture `cmvrs5fvu15b824`, selected document ID 1, HTTP 200, five curriculum records. Eighty-one other exchanges were aborted.
- D, https://www.coursera.org/specializations/excel, capture `cmvrs8j4ke98bca`, selected document ID 1, HTTP 200, four curriculum records. Seventy-five other exchanges were aborted. This separate capture happened after the unseen tier-1 call.

A and B were grounded by the preceding source reports. D was grounded from the actual public Excel Skills for Business anchor in A. Only that link identity was inspected before replay; no D detail metadata had been opened, indexed or used to construct the recipe. Python for Everybody was excluded as an unseen holdout because earlier indexed content was exposed.

CLI `inspect` tested the recipe on the actual A capture. CLI `add` learned from the genuine A/B captures with differing slug examples, `--from`, `--from2`, and document request ID 1. It returned `minTier: 1`, zero learning warnings and no `unproven` mark. The five-course B output differs from A's three-course output. The current B capture reports 29 hours for Sequence Models; earlier hosted source notes reported 37. The operation retains the current document's estimate.

## Ordered qualification gates

The receipts contain their own UTC timestamps. The relevant sequence was:

1. 07:17:14, CLI public-example candidate export, zero export warnings.
2. 07:17:31.417, offline candidate JSON plus draft-notes `vetShared` preflight, zero errors and warnings, 1,241 caller UTF-16 units.
3. 07:17:37, unseen `slug=excel` CLI call, tier 1, four records.
4. 07:17:51, separate real Chrome Excel document capture, followed by independent comparison at 07:18:25.
5. 07:18:25, exact candidate export's new operation called from its own initially empty cold home, tier 1, three Machine Learning records. First-send Cookie and Authorization were both absent.
6. 07:18:48–07:18:57, CLI `verify coursera` on the exact export, all nine read cases passed at tier 1, zero failures, inconclusive cases or skips.
7. 07:19:18, CLI final public-example export, zero warnings, byte-identical to the candidate and cold-home input.
8. 07:19:38, exact saved JSON plus final notes `vetShared`, zero errors and warnings, 1,241 caller UTF-16 units.

The cold home started with no entries. Only the candidate JSON and draft caller notes were installed before its first call. Coursera issued `CSRF3-Token` and `__204u` to that signed-out call. Later all-read verification could send only guest cookies issued to that isolated home. No Cookie or Authorization values are present in this report or the registry files. Raw response headers, jars and captures remain solely under the ignored evidence root.

All-read verification covered search examples `python`, `cybersecurity`, `digital marketing`; course slugs `python`, `python-basics`, `python-crash-course`; specialization slugs `machine-learning-introduction`, `deep-learning`, `excel`. Every result's tier was 1. The six existing case expectations and both complete operation objects were preserved.

## Independent meaning check and stop guard

The independent comparator is an owned Python standard-library `HTMLParser` script. It walks semantic course-link anchors, their subsequent workload text and the program heading, without importing the runtime CSS extractor or core judge. It compares complete arrays across all three returned fields, destination identity, specialization membership query and explicit ordinals. A matched all three records, B all five, and genuinely unseen D all four. D's independent source was a separate actual Chrome document capture after replay, not its runtime response body.

A worker-owned fetch guard invokes the real core `judge` on each response before returning it to the CLI. Every non-ok result writes a durable stop and terminates the process before the runtime can retry, heal or escalate transport; later processes check that stop before any send. A local mock HTTP 200 login body classified `auth`, exited 77, and the next invocation exited 78 before any fetch. This was a local guard control, with no Coursera request and no frontend-evidence claim. Its original stop and denial receipts are retained. No live Coursera response tripped the guard.

The complete current host-stop and alias ledgers were scanned before the first website request. Neither Coursera alias had a stop. All live responses qualified here were HTTP 200 and core-judged ok. No auth, rate, challenge, repeated-error or redirect stop was observed. No alternate transport or automatic retry after a consumer stop occurred. No origin status was inferred from a helper failure.

## Exact versions and handoff

The final JSON SHA-256 is `500527915050784d61fa4e6a75c3934f5230a18f0b4103dc4ec10ab6166898bd`.

The final notes SHA-256 is `6c623a980ec64e50ba13ff69d5cc129c527743ef6c897e4b510d74426729992d`.

The new operation's complete serialized-object SHA-256 is `44199ed520207a331d4f5b3cc096329557d99dd6c7193dd0c4eed01e038b7df4`. The real checks-module operation hash is `44199ed520207a33`, matching its saved passing verification record. The original search and getCourse complete hashes are retained in `qualification.json`.

Evidence root: ignored `bench/explore/state/discovery/coursera-curriculum-qualified-r2-20261028/`. `manifest.json` hashes raw captures, response bodies, guest jars, scripts, all gate receipts, final tracked files, original local mock failures, execution receipts and owned cleanup. Browser profile caches and mutable parent-owned delegation metadata are excluded. `qualification.json` records version equality, timestamp ordering, original-object preservation, all-read outcomes and exact operation hashes. `owned-cleanup.json` records every launched child PID and confirms no owned child or Chrome process remains. Each capture's cleanup receipt records mutex release. No unrelated process was stopped.

The eight frozen publication files match their approved manifest hashes, and the approved manifest was read only. No source, dependency, existing helper, state, scheduler or runbook was edited. An initial read used an incorrect state path and stopped before reading it. An empty temporary display file was inadvertently created outside the allowlist and then removed; no data was written into it. These local inspection errors caused no website request and are recorded separately.

Parent work remaining: audit this evidence, run the integrated registry test and shared lint/type checks, then decide whether to count the addition. There are no missing worker qualification gates and no live access stop to persist.
