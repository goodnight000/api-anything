# Hays qualification r1

Status: **BLOCKED, resource-deferred. Zero qualified operations and no registry addition.**

UTC 2026-10-26, work approximately 20:14–20:22. Source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, shared branch `t3/reverse-engineer-high-leverage-apis`. Read AGENTS.md, docs/DESIGN.md in bounded chunks, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, current bench/discovery/state.json and global-recruiters-source-prep-r1.md. Respected the existing Hays assignment and all other host stops. No nested workers, shared checks, ledger/runbook/catalog edits, source/dependency changes, commits, pushes, PRs or publication.

## Official access screen

The immediately preceding primary-source screen is recorded in [global-recruiters-source-prep-r1.md](global-recruiters-source-prep-r1.md). It opened Hays' app page, recruitment-technology page and corporate partners page. These describe consumer job search and applications, employer VMS/ATS services and internal consultant tooling. They do not establish a readily usable anonymous posting-read API/MCP/feed contract or public agent entitlement. Anonymous app access, partner credentials and broader API coverage remain unknown. This worker did not invoke any app, account or speculative endpoint. This is inherited source evidence, not a fresh exhaustive API-absence finding.

## Proposed operation and actual evidence

Proposed only, not learned: `getJob(job)`, where `job` would be an actual source-provided `/job-detail/` route segment, including its posting reference. No filter, location-query, pagination or search semantics were established. Intended output is safe advertised job metadata only. JSON-LD extraction was exercised offline on genuine captures with the current core and a whitelist of title, separate public references, employmentType, industry, occupationalCategory and addressLocality. No profile, recruiter/contact, address, description, application or people fields were selected.

Actual source chains, established by the preceding primary-source report:

- A: Hays home → job-search → `https://www.hays.co.uk/job-detail/senior-quantity-surveyor--derbyshire_4840331?jobSource=HaysGCJ`.
- B: `https://www.hays.co.uk/job-search/software-developer-jobs-in-cambridge-uk` → encoded-parenthesis detail link. The preceding remote tool reported its redirect to `https://www.hays.co.uk/job-detail/software-engineer-(aws-python-c-c-cfd-fea)-oxford_4763934?jobSource=HaysGCJ`. This worker captured that actually observed literal-parenthesis URL directly. It did not request the encoded variant or claim independent proof of that redirect.
- Reserved C: `https://www.hays.co.uk/job-search/technology-jobs`, source-prep anchor 52, Business Technology Lead, `JOB_5416734` / `4831815`, Lisburn. Its detail was never requested.

| Evidence | A | B |
|---|---|---|
| Genuine capture ID | `cmvpp93pmc0b26f` | `cmvpp9v0y14dd84` |
| Document request ID | 1 | 1 |
| Actual response / body inspection | 200, no detected bot wall, safe metadata parsed | 200, no detected bot wall, safe metadata parsed |
| Exchanges / aborted | 23 / 22 | 23 / 22 |
| Request Cookie / Authorization present | false / false | true / false |
| Title | Senior Quantity Surveyor | Software Engineer (AWS, Python, C#/C++, CFD/FEA) |
| Separate public references | JOB_5421845; 4840331 | JOB_5370351; 4763934 |
| Broad location | Derbyshire | Oxford |
| employmentType | FULL_TIME | FULL_TIME |
| Industry | Construction | Technology & Internet Services |
| occupationalCategory | ConstructionProperty | Technology |

A/B request URLs and final URLs were identical to each other within their respective captures; no capture redirect was observed. Each capture used the unchanged exact-document helper, a fresh 89/90 resource gate and an atomic global mutex with a unique owned token. The helper permits only that exact GET document, aborts all other requests, and has a 15-second navigation bound. Recorded helper durations were 14,575 ms and 6,828 ms before final browser shutdown. Both child commands exited 0, then their owned mutexes were released. Inline scripts may run. This is not a fully hydrated GUI claim.

Each capture's actual body was inspected before any next website request. The current core extracted the seven whitelisted fields from schema.org JobPosting JSON-LD. A's title also exists in parseShown text; there was no shown H1. No hidden markup was restored or extractor weakened. B's cookies came only from the preceding signed-out visit in this isolated capture home, with no everyday browser import or login. Cookie and Authorization values were never printed. This capture-home evidence is not the required initially empty fresh-home export reuse test.

The preliminary cookie-free A HTTP source read exposed structured salary unitText `DAY`. The advertised source-prep text `£70,000 - £80,000` establishes no pay period. Therefore that structured salary period was not selected or promoted to a semantic claim. The proposed reduced metadata output has no salary or permanent-contract inference. FULL_TIME describes the structured employment type, not proof of permanent tenure. No HTTP, posting date or relative label proves current availability/open status.

## C grounding remains incomplete

The single cookie-free listing GET returned 200 and no detected wall. Its raw and parseShown representations each had 98 anchors. No literal anchor matched C's title/reference, so the source script persisted a local extraction failure before exiting 2: `Reserved C actual anchor absent; do not synthesize`. This was a successful origin response with missing local anchor evidence, not an auth/network/site-error response.

An admitted offline inspection found C's title on a visible H4 inside `button.job-card`, plus its title/reference strings in the raw source. It also found the exact literal `https://www.hays.co.uk/job-detail/business-technology-lead-lisburn_4831815` in that response. This URL was observed, not synthesized. However its enclosing metadata location and equivalence to the preceding remote tool's anchor target were not resolved. It is not claimed as a confirmed raw href. The follow-up offline grounding command was denied twice and never ran. C remains unopened and there is no independent held-out comparison.

## Qualification gates

| Gate | Result |
|---|---|
| Actual A/B frontend document captures | Complete, inspected sequentially |
| Safe current-core extraction on those captures | Complete for the selected seven-field recipe |
| C actual anchor target and independently grounded expected semantics | Incomplete; literal URL and source labels only |
| Offline two-example learning, parameter causality and credential-safe candidate | Not run |
| Candidate export plus draft-notes vetShared preflight | Not run |
| Unseen C tier-1 replay and independent meaning comparison | Not run; no mismatch claimed |
| verifySite(maxTier:1) and exact current operation hash | Not run; no learned operation/hash exists |
| Exact export retaining harmless public examples | Not run |
| Initially empty-home first-call Cookie/Authorization absence, every operation | Not run |
| Final exact JSON plus notes vetShared zero issues | Not run |
| Parent focused integrated registry gate | Not run; nothing offered for integration |

No `sites/hays.json` or `sites/hays.md` was created. No operation is counted. Missing gates preclude a registry addition.

## Resource and stop receipts

All substantive offline/source commands used 88% memory admission / 90% stop. The two understood SSR exact-document captures alone used 89% / 90%. CPU defaults remained 65% admission / 85% stop. Every workload received a fresh gate; no launch-only or historical sample authorized its execution. No tier-1 workload was launched.

Initial denial and three subsequent spaced resamples:

| UTC sample | Requested work | CPU | Non-cache memory | Result |
|---|---|---:|---:|---|
| 20:15:27.567713 | C source read, initial | 55.89% | 88.87% | denied, exit 75, no child/request |
| 20:16:14.375733 | C source read, resample 1 | 34.85% | 87.18% | admitted |
| 20:16:49.838108 | A source read, new gate | 19.87% | 88.22% | denied, exit 75, no child/request |
| 20:17:35.637965 | A source read, resample 2 | 24.23% | 86.38% | admitted |
| 20:20:15.562970 | C offline grounding, new gate | 74.34% | 86.89% | denied, exit 75, no child |
| 20:21:00.635817 | C offline grounding, resample 3 | 15.30% | 91.00% | denied, exit 75, no child; end batch |

Each resample followed an explicit 31-second wait without own website/browser requests; sample timestamps establish intervals over 30 seconds. No self-respawn or subsequent workload was launched after exhaustion. Four denial receipts are retained, distinct from admitted runs.

Across admitted workload samples: maximum CPU 60.41%, non-cache memory 89.91%, raw occupied memory 99.92%. Across all samples including denials: CPU 74.34%, non-cache memory 91.00%, raw occupied memory 99.92%. These are sampled host observations, not global enforcement, unsampled peak bounds or a guarantee about unrelated workloads. No running child was stopped by the watchdog.

No actual Hays auth/challenge/rate/403/429 or repeated origin error was observed. This is resource deferral and incomplete grounding, not a new Hays host stop. Existing stopped domains were untouched. Both capture helpers exited; their ownership receipts record release. A final process inspection showed no remaining worker workload/browser command with this isolated path, only the inspection shell itself. Raw source bodies and genuine full captures remain solely in ignored evidence, not tracked notes/specs.

## Reproducible receipts and provenance

Ignored evidence root: `bench/explore/state/discovery/hays-qualified-r1/`. Absolute isolated capture home: `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/hays-qualified-r1/home`.

- `batch.receipt.json`: status, sample peaks, all denials, missing gates and artifact SHA-256 manifest.
- `source-C-r1.resource.jsonl`, `source-C-r1.out`, `listing-C.receipt.json`, `listing-C.html`: successful listing request and persisted local failure, including cookie/auth booleans, status, SHA, parsed output and error.
- `analyze-C.out`, `listing-C.analysis.json`, `source-inspection.json`: offline C/title/ref/anchor observations and A structured-data inspection.
- `source-A-r1.resource.jsonl`, `source-A-r1.out`, `source-A.receipt.json`, `source-A.html`: preliminary HTTP source response. It was not turned into a fabricated exchange/capture.
- `A.capture.*`, `B.capture.*`, `A.mutex.json`, `B.mutex.json`: exact-document outputs, resource traces and owned lock release/child exit.
- `home/captures/cmvpp93pmc0b26f.json`, `home/captures/cmvpp9v0y14dd84.json`: intact actual browser evidence.
- `A.capture.inspection.json`, `B.capture.inspection.json` and respective inspect logs: safe actual-body inspection and selected parsed outputs. Receipt writing runs in finally before failure reporting.
- `source-C.resource.jsonl`, `source-A.resource.jsonl`, `resolve-C.resource.jsonl`, `resolve-C-r1.resource.jsonl`: four denied admissions. Empty stdout files do not represent failed/partial launched workloads. The resolution script produced no grounding receipt because it never launched; no missing failure receipt was fabricated.

Full body SHA-256:

- C listing HTTP body: `6d7f4d165d9ad026aa8bda0354610c497d6ed92399739dea9c6b3677db9abc7e`.
- A preliminary HTTP body: `7248554cfd007368aca4df4207d4f91dd5d80d0932bc65f4139e82f368d6b060`.
- A actual capture body: `d66c8b17dd044345b978e9030b9dd8ad32fc436a6c00ef93aa7602d61d83c36b`.
- B actual capture body: `3601d17534601ebddbb1cd6a0fc370452599f44a2eb9c800e2f28314dbe3de65`.

Unchanged helpers at finish:

- capture-document.mjs: `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`.
- resource_gate.py: `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08`.

Parent disposition: retain genuine captures as source evidence, audit the resource deferral and unresolved C target, and do not integrate/count Hays. Any continuation requires separately authorized ownership/admission and completion of every missing gate on an exact candidate version.
