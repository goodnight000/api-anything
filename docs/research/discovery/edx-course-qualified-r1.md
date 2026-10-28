# edX course detail qualification

PASS on 2026-10-28 UTC. Added one useful public read, `getCourse(subject, courseSlug)`, bringing edX to two operations. Six exact-version verification cases passed at tier 1. The parent still owns integrated registry, lint, type and counting gates; none was run or claimed here. No commit, push, PR change or publication occurred.

## Source contract and identity

All inputs were frozen in `grounded-inputs.json` before any new course detail source was opened. Literal `/learn/` hrefs came from genuine provider capture request 1: Harvard `cmvp9nj6ebd5213` and edX `cmvp9qelpd6897c`. Their original and round-3 copies were read offline, verified byte-identical, and never rerun. The separate provider HTML bodies and href inventories are retained in this worker root.

- A: `https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science`.
- B: `https://www.edx.org/learn/how-to-learn/edx-how-to-learn-online`.
- Held-out D: `https://www.edx.org/learn/python/harvard-university-cs50-s-introduction-to-programming-with-python`.

Subject and courseSlug are the two segments of one literal course URL. A/B change both together and prove differing course identities, descriptions and outcomes. Independent mixing of the two slots is unproved and excluded in caller notes. No tracking parameters are saved.

The unchanged `bench/discovery/capture-document.mjs` made three genuine exact-GET browser document captures, each HTTP 200, signed out, in separate isolated homes. A is `cmvrx92nq80e9cd`, B `cmvrxanm3499913`, D `cmvrxc7l882618b`, each document 1, each with 59 other requests aborted. Real capture envelopes are in `capture-A-home/captures/`, `capture-B-home/captures/`, `capture-D-home/captures/`; decoded bodies are separately retained as `source-A.html`, `source-B.html`, `source-D.html`. These do not prove a fully hydrated GUI. Source contract discovery and clean candidate preflight completed at 09:40:25.560Z, before the 09:43:30.986744Z source deadline. Qualification completed at 09:41:42.508Z, before the 09:55:30.986744Z absolute deadline.

The source contains actual `application/ld+json` scripts, separate from escaped React stream representations. The embedded recipe reads the Course at `@graph[1]`, returning title, URL, ordered provider names, description, level, language, ordered learning outcomes and ordered prerequisite statements. A Python HTMLParser independently selects actual JSON-LD scripts and recursively finds `@type: Course`, without using the recipe regex or graph index. It asserts one Course and canonical identity. The core recipe was proved on A, B and D; no hidden streaming-node selector is used.

## Learning and functional evidence

Actual paired `addOperation` used the genuine A/B capture objects, request 1, with networking explicitly prohibited during learning. `learn.json` records zero warnings, no unproven mark, tier 1, two path slots and no credential reference. Final metadata uses simple slug character classes. `preflight-vet.json` records zero errors and warnings for the candidate public export plus draft notes before D source, cold-home call or live verification.

All eight fields, every provider, every prerequisite and every outcome, in order, match the independent parser for A/B captures and D cold replay. The final offline audit also compares all three new-op tier-1 verification responses against the independent documents. A has six learning outcomes, B five and D ten; all three have one provider and one prerequisite statement. `semantic-final-audit.json` records every comparison. The D result is a distinct Python course with its own description and ten outcomes, not a title-only wrapper.

`cold-home/` was created empty, then given only the exact candidate export bytes. Its first call was held-out D. `homes.json`, `requests.json` and `unseen-cold.json` record initial emptiness, input SHA, first boundary, tier 1, no healing, and Cookie/Authorization absent. `unseen-comparison.json` records all eight fields and array order matching a separate frontend document. The cold input, candidate and saved final JSON are byte-identical.

A separately empty `verify-home/` received the same bytes. `verifySite` ran with maxTier 1 and a fifteen-second per-request bound. Its six cases passed: unchanged listCourses harvardx/edx/uc-berkeleyx, then getCourse A/B/D. The old listing returned 32/32/30 rows respectively. Seven total tier-1 requests, including the cold unseen call, each returned HTTP 200 and actual operation core `ok`. Every response was judged with its real operation before return to the runtime and before the next send. No healing, retry or browser fallback was used. Bodies and per-operation judgments are retained separately as `tier1-1.html` through `tier1-7.html` and matching judgment JSON. Current operation records are under `verify-home/checks/edx.json`.

## Preserved baseline, exports and vetting

The complete old listCourses operation, including all three cases, is deeply identical to `parent-baseline.json`. The incoming JSON SHA was `f0d75b018021beec06228e281ea6e5bd3ef3fd48d0a794a5b16e64a82c977ad9`; notes SHA was `b9d9d451e434ee1328386ebaaa7b1e744bed00645635fcb1868fea255578a9e8`. Original JSON and notes remain in this owned root. Historical provider evidence was retained below the exact `## Maintainer notes` heading; caller text is 940 UTF-16 units.

Final listCourses opHash: `03b81f01d7250eed`. Final getCourse opHash: `c1926fb57479a7bd`. Both current records contain three passing cases and match final operations. Public-example export found zero secrets and warnings. Final exact JSON and notes passed vetShared with zero errors and warnings before save and again after save. Only after every functional gate passed were the two site files written.

Final JSON SHA-256: `5b4399cc70018a1b979e10007c2517d88c95fe7d624d7fbdd55c179dba0aba18`.
Final notes SHA-256: `09c68ec65014880bea5bca4818543c2e71cf61d9194ffdbb84a1714a5b59a1d3`.

All eight frozen Pinterest/Rotten Tomatoes/Rightmove/Steam JSON/notes files and `publication-approved-20261026/approved-manifest.json` match the opening hash snapshot. PR 65 was not changed or queried. No shared state, runbook, source, dependency, helper, other site or old evidence was edited.

## Cookies, stops and bounds

No login, private cookie import, enrollment, site write, payment, course-content access or bypass occurred. The anonymous site issued `__cf_bm`, `authx_coin_flip` and `dapi_random_id` response cookie names. Later requests sent only `authx_coin_flip` and `dapi_random_id`, originating from that verification home's own first anonymous response. No Authorization was sent. Capture homes independently received the latter two guest cookie names. Values remain only in ignored local state and capture envelopes, never this report or public spec.

All current host stops, aliases, task claims and provider cooldown were screened. The live ledger had 140 stop hosts, no matching edX stop or competing worker claim, and an expired provider cooldown. `state-screen.json` retains recursive stop/alias/claim entries; `guard.jsonl` records fresh screening before every capture and tier-1 send. No stopped domain was requested. `guard.mjs` checks persistent STOP.json before any fetch and saves a brand-wide stop on any actual operation non-ok or request failure before returning the response. There were zero real stops or failed sends, so no STOP.json was produced. No alternate route or transport was attempted after a failure.

All workload invocations used the owned `run.py` bounded wrapper. `processes.jsonl` records its own PID, direct child PID while alive, command, time, home environment and exit, plus observed owned descendant PIDs and Chrome profile paths while alive. Orchestration wrappers have no API home themselves; helper-specific homes are explicit in capture.mjs and observed Chrome profile command lines. Qualification home initialization and request-boundary receipts record later dynamic homes. Continuing terminal sessions 13398, 55586, 3389 and 46360 were retained promptly in `terminal-sessions.jsonl`. The wrapper used process ownership inspection only, with no CPU/memory snapshots, admission checks, resource watchdog, recovery checks or resample waits. The exact-document helper's fifteen-second trigger bound was unchanged.

Each browser mutex was acquired atomically with PID/token owner and released only after its helper exited. `lock-A-released.json`, `lock-B-released.json`, `lock-D-released.json` and `cleanup.json` retain receipts. Three capture commands and qualification exited 0. The ownership audit found no retained capture descendant process and no browser lock. No unrelated program was stopped.

## Evidence manifest and limits

All local evidence is under `bench/explore/state/discovery/edx-course-qualified-r1-20261028/`. `manifest.json` inventories every retained regular file and symlink with bytes and SHA-256, excluding the manifest itself to avoid self-reference. It separately categorizes capture envelopes, decoded bodies, probes, baselines, operations, homes/profiles and receipts. It includes the reused original provider capture envelopes and their verified copies as external references, the final site files, unchanged helper and this report. Manifest generation occurs after the last wrapped child exits and its process log is finalized.

Supported meaning is public structured metadata on the observed course documents. There is no claim of displayed full curriculum, hydrated GUI equivalence, enrollment availability, free access, price, start dates, exact duration/workload or paid-content rights. Some fields can be absent on other courses, and the graph position may change with future frontend revisions. Arbitrary subject/slug combinations, unlisted course URLs, paging and exhaustive catalog coverage remain unproved. Parent integrated shared gates and counting are pending.
