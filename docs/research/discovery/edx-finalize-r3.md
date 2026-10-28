# edX finalization round 3

2026-10-26 UTC. **ISSUES, not registry-qualified.** The two supplied frontend captures passed independent course-card audits and learned a tier-1 candidate without warnings. The unseen third-provider comparison and fresh-home reuse remain missing. Current verification has one passing example and one locally prevented, inconclusive check. No `sites/edx.json` or `sites/edx.md` was written.

Only the assigned edX report and ignored evidence directory were changed. No source, dependency, shared state, runbook, catalog, other site, commit, push, PR, publication, browser login or cookie import was changed or performed. No subagents were started.

## Operation and frontend evidence

Candidate `listCourses(school)` reads `https://www.edx.org/school/{school}`. `school` is a public provider-page slug. Learning examples were `harvardx` and `edx`. The sole request slot is `path:1`; stable match is GET, `www.edx.org`, `/school/*`. The operation is read-only, `minTier: 1`, `learnedLoggedIn: false`, without a volatile anchor or credential reference.

Recipe selects `a[href^="/learn/"]`, reading `title` from `span.font-bold`, `provider` from `span.text-sm`, and `url` from the anchor href. `title` is the course-card title; `provider` is that card's displayed provider text; `url` is the resolved public frontend course link. This covers only the initial server-rendered course cards. Program cards under `/certificates/`, additional course pages, complete catalog coverage, course content, tuition, workload, enrollment and entitlement are excluded. A public course listing does not establish free access.

The coordinator's actual Chrome exact-GET document captures were copied into this worker's isolated absolute home, preserving the originals byte for byte:

| Input | Capture ID | Request ID | Status | Independent course audit |
| --- | --- | --- | --- | --- |
| `school=harvardx` | `cmvp9nj6ebd5213` | document 1 | 200 | 32/32 |
| `school=edx` | `cmvp9qelpd6897c` | document 1 | 200 | 32/32 |

Copied captures are under `bench/explore/state/discovery/edx-finalize-r3/home/captures/`. Original capture provenance remains in `../edx-coordinator-r2/`. The supplied receipts say signed out, 81 and 80 other requests aborted respectively. These are document captures, not proof of a fully hydrated GUI. This worker started no browser and acquired no mutex.

The new independent Python `HTMLParser` read anchor text, hrefs, page titles, headings and canonical links without using the CSS recipe or its span classes. Each extracted course row matched its independent anchor URL and complete text exactly as `title + provider + Course`, in order. Harvard had 53 linked products, 32 courses and 21 programs; edX had 33 linked products, 32 courses and one program. Page heading identity was Harvard University and edX respectively. Both documents declare their own query-free canonical URL. Audit evidence is `cmvp9nj6ebd5213.independent.json`, `cmvp9qelpd6897c.independent.json`, `capture-audits.json` and `learn.json` in the worker evidence directory. `captureCopyIntegrity` in `resource-summary.json` records matching SHA-256 values for both copies.

`addOperation` consumed the actual captures with `from` request ID 1 and `from2`; no fabricated exchange was constructed. It returned no warnings, `minTier: 1` and no `unproven` mark. Its isolated saved candidate is `home/sites/edx.json`. Offline learning explicitly prohibited network access through its supplied fetch implementation.

## Unseen provider source result and resource deferral

The only successful new source-inspection request was the exact officially indexed URL `https://www.edx.org/school/mitx?page=1`, at 13:10:44 UTC. It used the default 88% memory admission, a 15-second timeout, 5 MiB body cap, no cookies and manual redirects. The response was **HTTP 308**, 278,094 bytes, with Location `https://www.edx.org/?page=1`. It was not followed. Independent parsing found no title, heading, course anchor or canonical link. Consequently no query-free MIT route or MIT operation input was proposed or called. No auth, challenge or rate-limit marker was observed. Evidence is `mitx-source.source.json`, `mitx-source.html`, `mitx-source.independent.json` and associated resource logs.

The other explicitly supplied official source candidate, `https://www.edx.org/school/vjx`, was never requested. All four default-admission samples denied it before launch, with at least 30 seconds between attempts:

| UTC | CPU | Policy memory | Raw occupied memory |
| --- | --- | --- | --- |
| 13:11:18 | 27.66% | 88.79% | 99.66% |
| 13:12:16 | 23.59% | 89.77% | 99.39% |
| 13:13:51 | 23.24% | 88.63% | 99.64% |
| 13:14:36 | 24.07% | 88.26% | 99.65% |

No further source resample occurred after this phase exhausted its allowance. No alternate host or unsourced route was requested. The unseen third-input tier-1 replay and independent semantic comparison are **not performed**.

## Verification, export and direct vet receipts

All paths below are relative to the ignored evidence root `bench/explore/state/discovery/edx-finalize-r3/`. The root is absolute when supplied as `API_ANYTHING_HOME`.

- `candidate-export.json`: isolated public-example export from the learned candidate; no secret findings or warnings.
- `verify-home/`: initially absent, then populated only with that exported spec before `verifySite('edx', {maxTier:1, timeoutMs:15000, fetchImpl: boundedFetch})`. No browser tier was allowed.
- `verify.json` and `verify-home/checks/edx.json`: `school=harvardx` passed at tier 1 in 427 ms. The recorded `school=edx` result is inconclusive with reason `Cookie-free run must send no Cookie header`; it did not reach the network.
- `tier1-requests.json`: the single actual verification request, Harvard, returned HTTP 200, 2,309,564 bytes, without a Cookie header.
- `current-hash.json`: current operation hash and verification record hash both `a8db968eecbe29ab`; `current: true`, `allPass: false`.
- `export.json`: `exportSite('edx', {keepExamples:true})` on the normalized candidate in `verify-home`, with public Harvard example and edX check retained, `secrets: []`, `warnings: []`.
- `candidate-notes.md` and `vet.json`: direct `vetShared(parseSite(exported.spec), notes)` yielded `errors: []`, `warnings: []`. This vets an isolated candidate, not a final registry addition.

The verification helper incorrectly asserted that every sequential request remain cookie-free. Harvard's anonymous response set a guest cookie, and the assertion prevented the next case before fetch. This extra assertion is stricter than the requested fresh, initially empty-home reuse per operation. It is a local harness failure, not a demonstrated site authentication requirement, access control, rate limit or broken endpoint. All edX network activity stopped after that failed call result. The remaining current-hash, export and vet receipts were produced offline only. No retry, fresh-home call or later site request occurred. Fresh cookie-free reuse is **not performed**. `finalize.mjs` was prepared but never run, and its expected outputs are not evidence.

## Resources and cleanup

Every parser, Node learning command, source request and verification command ran beneath `resource_gate.py`. Browser-free offline/known tier-1 phases used the existing 89% admission and 90% stop exception. The unknown MIT and vjx source phases retained default 88% admission. CPU thresholds stayed at 65% admission and 85% stop. No threshold was broadened.

The first three offline parser samples denied at 89.15%, 89.23% and 89.14% policy memory. After spaced retries, the fourth admitted at 85.86%. No site requests occurred during waits. All four vjx attempts denied as listed above. Across this worker's samples, CPU peaked at 39.69%, policy memory at 89.77% and raw occupied memory at 99.70%. Across admitted command samples, peaks were CPU 34.63%, policy memory 88.70%, raw occupied memory 99.68%. Raw occupied memory exceeded 95%; these receipts therefore do not establish a literal global memory-below-95% claim. The gate excludes file-backed cache from its policy metric and cannot guarantee unsampled host-wide peaks.

All owned commands exited. The scoped process audit found no remaining process referencing this worker's absolute evidence path. No browser was launched, no browser mutex was acquired or released, and no unrelated process was stopped. `cleanup.json` and `resource-summary.json` retain receipts. No registry file should be counted. Parent alone runs integrated repository checks and updates shared state.

Continuation requires a new authorized batch with headroom for a grounded third populated provider source, its independent meaning comparison, an unseen tier-1 replay, an all-pass current verification and a separate initially empty-home reuse. Preserve the existing two captures and the distinction between courses and programs. The local cookie assertion must be corrected before any new batch; do not claim the incomplete record passed.
