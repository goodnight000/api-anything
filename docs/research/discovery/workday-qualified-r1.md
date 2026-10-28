# Workday tenant qualification

2026-10-26 UTC. **BLOCKED on resource admission for final qualification.** Public frontend discovery, two differing linked job examples, learning and an unseen tier-1 replay succeeded. The final `verifySite` command was denied initially and on three spaced retries. It never ran. No `sites/workday.json` or `sites/workday.md` was created. This batch adds no reusable registry operation yet. Workday itself did not present an observed access-control stop.

Scope is Workday's own public employer tenant only, `workday.wd5.myworkdayjobs.com`, site `Workday`. It is not a universal API for employers using Workday. The corporate-careers-to-catalog link was grounded in [prior source preparation](job-platforms-source-prep-r1.md). The exact initial URL was `https://workday.wd5.myworkdayjobs.com/Workday/?source=Careers_Website`. No other employer, iCIMS, or frozen site was contacted.

## Actual frontend evidence

All browser commands used the repository CLI, a new isolated absolute `API_ANYTHING_HOME`, normal CPU 65% and memory 88% admission, CPU 85% and memory 90% stops, and the global atomic browser mutex. No personal profile or cookies were imported and no login ran. Initial jobs JSON explicitly reported `userAuthenticated: false`. Captures contain no HTTP status >=400. These were full frontend traffic captures; the experimental document-only helper was read but not used. No SSR 89% browser exception was claimed.

| Capture | Actual action and exchange | Result |
| --- | --- | --- |
| `cmvpa9sc1` | Initial catalog, exchange 25, frontend POST `/wday/cxs/workday/Workday/jobs` | HTTP 200; 20 displayed jobs of 369; public title/location/requisition/path evidence |
| `cmvpac455` | Fill source-grounded `[data-automation-id=keywordSearchInput]` with `Manager`, click `keywordSearchButton`; exchange 45 | HTTP 200; actual query body carried `searchText: Manager`; final frontend URL had `q=Manager` |
| `cmvpad1mq` | Click catalog anchor whose href contains `Manager--Technical-Support-Delivery_JR-0110529`; exchange 45 | HTTP 200 GET `/wday/cxs/workday/Workday/job/Manager--Technical-Support-Delivery_JR-0110529` |
| `cmvpadmig` | Click catalog anchor whose href contains `Director--Channel---Reseller-Sales---EMEA---APJ_JR-0110793`; exchange 45 | HTTP 200 GET `/wday/cxs/workday/Workday/job/Director--Channel---Reseller-Sales---EMEA---APJ_JR-0110793` |

The bundled frontend source, already captured as exchange 5 in `cmvpa9sc1`, grounded the search input/button identifiers and showed `externalPath` used for rendered job anchors. Endpoints and tenant identity were observed in real frontend traffic, not guessed from a Workday CXS convention. The two clicked jobs ended on `/en-US/Workday/details/<job>?source=Careers_Website`.

Only one Manager search was captured. No search operation was learned or qualified, and complete catalog coverage, filters and pagination remain unproved.

## Candidate contract

Unpublished isolated candidate `getJob(job)` sends a GET to `https://workday.wd5.myworkdayjobs.com/wday/cxs/workday/Workday/job/{job}`. `job` is the complete final public job-link segment including the `JR-` suffix, not the requisition alone. The stable matcher is GET, this exact host, `/wday/cxs/workday/Workday/job/*`. The learned input slot is `path:5`, with a separate templated Referer slot. The trigger template is the observed `/en-US/Workday/details/{job}` route; cold direct trigger replay was not separately tested.

The recipe extracts `jobPostingInfo` and picks `title`, `location`, `additionalLocations`, `timeType`, `remoteType`, `jobReqId`, `jobPostingId`, `externalUrl`. `location` is the primary displayed location; `additionalLocations` was absent in the tested jobs and its populated form remains unproved. `remoteType` is a work arrangement such as Flex. `timeType` is the frontend's time-type label, Full Time in these cases. `externalUrl` is the public job detail URL, not a proven application-submit URL. No description body, applicant/profile data, contact details, questionnaire identifiers or write capability is returned.

Two-example learning used `add ... --from cmvpad1mq --pick-request 45 --from2 cmvpadmig` and returned `readOnly: true`, `minTier: 1`, no volatile anchors and zero learning warnings. The first example is the Warsaw Manager job, requisition `JR-0110529`. The second is the London Director, Channel & Reseller Sales – EMEA & APJ job, requisition `JR-0110793`.

A captured CSRF header became a `cookie:CALYPSO_CSRF_TOKEN` reference, with no literal credential in the candidate. Cookie-free operation has not yet been proved. The learner initially marked `learnedLoggedIn: true` from guest cookie names. The isolated candidate metadata was corrected to false before final verification, based on the initially empty profile, no login/import and explicit `userAuthenticated: false` in the catalog response. No capture was modified. Two result checks for the London and held-out Hong Kong jobs were added before the attempted verification. These metadata/check edits have not received a current verification record or direct shared vet.

## Unseen identity and meaning comparison

Held-out input, absent from learning examples: `job=Technical-Consultant_JR-0110821`. CLI `call ... --max-tier 1` returned `ok: true`, tier 1, 431 ms, title Integration Consultant, Hong Kong, Full Time, Flex, requisition `JR-0110821`, and its exact public detail URL.

The original catalog's third row independently grounded this job before replay. A separate cookie-free GET of its linked public document, `https://workday.wd5.myworkdayjobs.com/Workday/job/Hong-Kong/Technical-Consultant_JR-0110821`, returned HTTP 200 on 2026-10-26 at about 13:26:44 UTC, without a bot-wall marker. Python `HTMLParser` extracted its schema.org JobPosting and OpenGraph metadata, independently of the operation's API extraction.

Ten explicit comparisons passed: catalog title, location, work arrangement, requisition, slug and URL; independent document title, requisition, location and URL. The public title is Integration Consultant despite the historical `Technical-Consultant` slug. Do not infer the title from the URL. The SEO document says `employmentType: OTHER` and `jobLocationType: TELECOMMUTE`; these are not interchangeable with the frontend API's `timeType: Full Time` and `remoteType: Flex`. The frontend bundle independently grounds the API labels' display roles. No normalization to a universal employment or remote-work enum was attempted.

## Missing qualification gates

`verifySite('workday', {maxTier:1, ...})`, public-example export, reuse from an initially empty cookie-free home, direct `vetShared` with zero issues, and parent integrated checks remain **unrun**. The final verifier would stop further sends on an observed control. Its executable never started because each resource gate returned 75. No export or empty-home reuse was attempted afterward. Do not count this candidate as saved or fully qualified.

Raw ignored evidence root is `bench/explore/state/discovery/workday-qualified-r1/`. The absolute isolated home is `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/workday-qualified-r1/home/`.

- Actual captures: `home/captures/<capture-id>.json`, with original responses, browser cookies and storage intact.
- Successful learning: `learn-getjob-retry2.stdout`, `.resources.jsonl`, `.exit`; candidate `home/sites/workday.json`.
- Unseen replay: `unseen-retry1.stdout`; comparison `unseen-comparison.json` records 10/10; separate source `third-source.html`, `third-source.json`, `third-independent.json`.
- Deferred verifier/export receipts: `verify-export.resources.jsonl`, `verify-export-retry1.resources.jsonl`, `verify-export-retry2.resources.jsonl`, `verify-export-retry3.resources.jsonl`, corresponding empty stdout and exit 75 files. Actual `verify.json`, export, fresh reuse and vet receipts do not exist.
- Prepared but unrun finalization helpers: `qualify.mjs`, `fresh.mjs`. Review them before reuse. `fresh.mjs` deliberately refuses an existing fresh home. The empty home does not yet exist.
- Resource and cleanup summaries: `resources-summary.json`, `cleanup.json`.

The final verifier was denied at 13:27:48, 13:28:47, 13:29:48 and 13:30:56 UTC, policy memory 89.06%, 89.83%, 89.58%, 89.56%. Retry waits were at least 30 seconds and made no site requests. Browser-free learning/replay used only the runbook's bounded tier-1 89% admission and 90% stop exception; no browser ran under that exception. All normal browser/source commands retained 88% admission. Across 39 retained admission/running samples, peak CPU was 48.32% and policy memory 89.83%, including denials; successful running browser samples reached 89.15%. Raw occupied memory separately reached 99.72%, so this does not claim the host stayed below 95% under every possible memory metric. Sampling cannot prove the absence of transients between samples.

Every owned command exited. The browser mutex was released only after the owned command returned; final cleanup found no mutex and no process using this worker's profile. Shared state, catalog, runbook, other workers' files, source/dependencies and Git history were untouched. No commits, pushes, PRs, publication, nested agents, login, private imports or site writes ran. Parent owns any continuation and integrated qualification.
