# Hays qualification r2

Status: **PASS for the operation qualification gates; parent integration pending.** One local diagnostic scope mistake is disclosed below. One saved operation, no publication. Source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, branch `t3/reverse-engineer-high-leverage-apis`. Work ran 2026-10-26 approximately 20:30–20:36 UTC, within the 20-minute, one-site batch. No delegation.

Saved files: `sites/hays.json`, `sites/hays.md`. Only those assigned site files, this report and ignored `bench/explore/state/discovery/hays-qualified-r2/` were written. No source/dependency/helper/runbook/state/catalog changes, shared checks, commits, pushes, PRs, everyday browser import, login or website writes. ALDI and travel worker files/processes were untouched.

## Official access screen

Read the prior primary-source screen in [global-recruiters-source-prep-r1.md](global-recruiters-source-prep-r1.md) before qualification, together with [hays-qualified-r1.md](hays-qualified-r1.md), AGENTS.md, DESIGN.md, CONTRIBUTING.md, the repository skill, discovery README and current Hays ledger entries. The official Hays applicant app, employer recruitment-technology ATS/VMS services and corporate partner/internal consultant tooling do not establish a readily usable anonymous posting-read API/MCP/feed contract. Access scheme and wider coverage remain unresolved. This is inherited source evidence, not a fresh exhaustive API-absence finding. No app, speculative API, account or partner service was invoked.

## Operation and meaning

`getJob(job)` takes the exact segment after `/job-detail/` in a source-provided Hays UK posting URL, without slash/query. It returns selected JobPosting JSON-LD metadata: title, JOB-prefixed reference, separate public posting reference, structured employmentType, industry, occupationalCategory and broad locality. The one learned slot is `path:1`; match is GET / www.hays.co.uk / `/job-detail/*`; minTier is 1; readOnly is true; learnedLoggedIn is false. Two-example learning returned no warnings and distinct parsed answers. Parameter pattern is the simple bounded class `[A-Za-z0-9_().-]{3,180}`.

| Case | Exact job argument | Independently grounded identity and meaning |
|---|---|---|
| A, example | `senior-quantity-surveyor--derbyshire_4840331` | Senior Quantity Surveyor; JOB_5421845; 4840331; Derbyshire; FULL_TIME; Construction; ConstructionProperty |
| B, training/check | `software-engineer-(aws-python-c-c-cfd-fea)-oxford_4763934` | Software Engineer (AWS, Python, C#/C++, CFD/FEA); JOB_5370351; 4763934; Oxford; FULL_TIME; Technology & Internet Services; Technology |
| C, unseen | `business-technology-lead-lisburn_4831815` | Business Technology Lead; JOB_5416734; 4831815; Lisburn; FULL_TIME; Manufacturing & Production; Technology |

A/B capture URLs, each observed verbatim, append `?jobSource=HaysGCJ` to their job-detail URLs. B uses literal parentheses as actually captured. No encoded-variant redirect proof is claimed. The learned fixed query is also sent for C; C's independently observed native listing URL itself has no query.

FULL_TIME is a structured working-pattern label, not proof of permanent tenure. Both reference forms are preserved separately. Broad locality is advertised metadata, not a workplace street address. Fields may be absent or differ for other postings. No salary/pay-period, dates, vacancy-open status, eligibility, applications, profiles, CV, people, recruiter/contact, description or street-address output is selected. A's structured salary DAY does not establish the period of the advertised pay text, so salary is entirely excluded. No discovery/search/filter/pagination operation or complete catalogue is claimed.

## Retained captures and C grounding

Reused genuine document captures `cmvpp93pmc0b26f:1` and `cmvpp9v0y14dd84:1`, copying only the intact capture containers to the new isolated home after matching both container and body hashes against r1's manifest and supplied body hashes. Prior evidence was untouched. Actual bodies were independently re-extracted with the current core, with status 200, no detected wall and the seven-field whitelist. A request Cookie/Authorization booleans were false/false; B true/false. These were signed-out, site-issued guest cookies only. No private session was imported.

The earlier unchanged exact-document helper permitted only the exact GET, aborted other requests and used a 15-second navigation bound under an owned global mutex. That is SSR document capture evidence, not a fully hydrated GUI claim. This batch launched no browser, performed no recapture and acquired no browser lock. The shared lock was absent at cleanup.

C remained unopened until after preflight. Offline resolution of the retained listing body from `https://www.hays.co.uk/job-search/technology-jobs` found `script#serverApp-state`, Angular transfer-state escapes, and its nested JSON response. The same `data.result.jobs[1].nonFilterableCustomFields` object associates exact `xLocaleRecordID` URL `https://www.hays.co.uk/job-detail/business-technology-lead-lisburn_4831815` with JobTitle, JobId, JobRef, xlocation, xIndustry, xSpecialism and FullTime. The shown button job card agrees on title and Lisburn. `parseShown` was used unchanged; no hidden markup was restored. This is native source navigation metadata, not a raw href or independently resolved equivalence to the old remote tool's anchor 52. No endpoint inferred from the state was fetched, and no HTTP response was converted into a fabricated capture.

`C.expected.json` was persisted before learning/replay. The unseen tier-1 result subsequently matched all seven independently grounded fields exactly. A/B safe metadata also matched both verification responses and A's fresh-home response. Four new website requests total, all inspected actual status/body immediately by the fetch wrapper. Each response receipt records method/URL, Cookie/Authorization booleans, status, body SHA, parsed whitelist and error slot. Bodies stay only in ignored state. The wrapper persists receipts in finally and refuses further origin traffic after a response/control error. No auth/challenge/rate/403/429 or origin error was observed, and no new Hays stop was established.

## Sequential gates and exact-version receipts

All dependent gates completed sequentially, with each command result inspected before the next gate.

| Gate | Receipt | Result |
|---|---|---|
| Capture container/body integrity and copies | `grounding.json`, `resolve.out` | Both captures match retained provenance |
| Native C source association before detail | `C.expected.json`, `native.json`, `learn.receipt.json` | Exact associated source URL and safe expected metadata |
| Offline add, two examples, current-core extraction | `learn.receipt.json` | No learning warnings; distinct answers; path slot; no unproven mark |
| Export credential scan plus draft-notes preflight | `preflight.json` | secrets 0; export warnings 0; vet errors 0/warnings 0 |
| Unseen C tier-1 meaning comparison | `heldout.receipt.json`, `heldout.requests.json` | PASS, one GET, all seven fields equal |
| `verifySite('hays', {maxTier:1})` | `verify.receipt.json`, `home/checks/hays.json` | 2/2 PASS at tier 1; A/B metadata independently equal retained captures |
| Exact public-example export | `export.receipt.json`, `export.json` | No secret/warning; exact candidate bytes unchanged after verify |
| Initially empty-home exported reuse | `fresh.receipt.json`, `fresh.requests.json` | PASS for the only op; home initially empty, first GET Cookie=false/Authorization=false; A meaning equal |
| Final exact saved JSON plus notes vet | `final.receipt.json` | errors 0, warnings 0; saved bytes equal preflight and tested export |
| Parent focused registry test/receipt audit | Parent-owned | Pending, not run by worker |

Current exported operation hash, matching stored verification record: `f46620355c1f80fd`.

Exact saved JSON SHA-256: `c58172f6bfeea59d96a061ea970d9e9f6dc11a3c771f53f87fce89a8d795996e`.

Exact saved notes SHA-256: `6817a0a9e4df609d4eea5f4f3a6c3b898c678f5bd3261147bc4da87d4b23c118`.

The regular capture/qualification home has only this site's capture-derived/site-issued guest session. Heldout and A/B verification request booleans are Cookie=true/Authorization=false. Fresh reuse used separate initially absent `fresh-home`, installed only the exact exported site file and sent its first request with neither header. It did not copy the capture home, profile, jar or session. No subsequent fresh-home network call was necessary.

## Provenance hashes

| Artifact | SHA-256 |
|---|---|
| Retained A capture container | `8e54ab4b89fd1293cb2f581b75a68f44aadfdc9c31035004ca3d44ded76df072` |
| Retained B capture container | `fa96509081309beeaab2aca33b3069ded9f32c9a83c02f72072fd919783b6069` |
| Retained A actual capture body | `d66c8b17dd044345b978e9030b9dd8ad32fc436a6c00ef93aa7602d61d83c36b` |
| Retained B actual capture body | `3601d17534601ebddbb1cd6a0fc370452599f44a2eb9c800e2f28314dbe3de65` |
| Retained C listing HTTP body | `6d7f4d165d9ad026aa8bda0354610c497d6ed92399739dea9c6b3677db9abc7e` |
| Unseen C body | `4082255ef31242a49ef27c1550beeba3e320828cf1d42e2eea525de123c3f6f6` |
| Verification A body | `64bb931cc09a9a5113304698b943256c390ed2f7d94bb1a9b22770eb6f63beef` |
| Verification B body | `cbc28debe57a22b37d05ec66c4497da593d8c00eda22176b92b931813509a063` |
| Fresh A body | `2ba466a085de777e539e0493cfb5e8341790945f28a6ec5fd4c10098bcf8e196` |
| Unchanged capture-document.mjs | `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663` |
| Unchanged resource_gate.py | `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08` |

Full owned-artifact manifest and sample aggregation: `bench/explore/state/discovery/hays-qualified-r2/batch.receipt.json`. Absolute isolated home: `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/hays-qualified-r2/home`. Fresh home is the sibling `fresh-home`.

## Resources, local issues and cleanup

All substantive offline learning/analysis/export/vet commands used fresh 88% admission / 90% stop gates. Only bounded browser-free heldout, verify and fresh tier-1 commands used 89% / 90%. CPU defaults stayed 65% admission / 85% stop. Ten commands were admitted, including one local parse failure, with 20 host samples total. Zero exit-75 denials and zero waited resamples were used. Supplied launch snapshots were not reused to authorize commands.

Observed sample maxima across this batch's workloads: CPU **32.69%**, non-cache policy memory **87.80%**, raw occupied memory **99.69%**. These are sampled host observations, not global/unsampled caps or a guarantee about unrelated work. No watchdog stop occurred.

Local issues: the first native-state script had a syntax error before evaluation; its actual stderr is retained in `native.resource.jsonl` and stdout is empty. No finally receipt was fabricated for that pre-execution failure, and it made no website request. The corrected script ran under a fresh gate. An initial source diagnostic emitted surrounding raw context including an excluded public contact field; this was a scope mistake. The context field was removed from the diagnostic code and retained summary/output. It was not used as expected data, included in any spec/notes/report, or fetched separately. Subsequent extraction used only the safe whitelist. Raw permitted source bodies remain in ignored evidence for parent re-extraction.

All workload children exited. Final process inspection matched only the inspection shell and rg, not a remaining Hays workload/browser. No process was stopped and no owned lock remains. No other site's file or process was altered. No publication was attempted or authorized. Parent should audit the exact receipts and saved hashes, then run its focused registry gate before integrating/counting Hays.
