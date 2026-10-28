# Workday employer job-detail qualification

PASS for `getJob(job)`, 2026-10-26 UTC. Saved `sites/workday.json` and caller/maintainer notes. This covers Workday's own employer careers tenant only, not all employers using Workday. The earlier worker's provisional candidate passed the remaining current-version verification, initially empty-home reuse and export/vet gates in this parent continuation. Integrated registry validation is recorded separately in the discovery index.

## Genuine learning and independent held-out evidence

Reused genuine browser captures `cmvpad1mq` and `cmvpadmig` from `workday-qualified-r1/home/captures/`. They captured actual GET job-detail requests on `workday.wd5.myworkdayjobs.com`, with differing Warsaw technical-support and London sales roles, requisitions `JR-0110529` and `JR-0110793`. The candidate's route, matcher, request template and parameter slots came from that traffic. No CXS endpoint was guessed and no capture was fabricated or modified.

The earlier held-out `Technical-Consultant_JR-0110821` tier-1 replay returned Integration Consultant, Hong Kong, Full Time and Flex, with matching requisition and public detail URL. Ten independent identity/meaning comparisons passed against the genuine catalog capture and separately parsed public SEO document. The original catalog is capture `cmvpa9sc1`, exchange 25. Worker receipts `unseen-retry1.stdout`, `unseen-comparison.json`, `third-source.json` and `third-independent.json` remain under the ignored round-1 evidence root. [The worker report](workday-qualified-r1.md) distinguishes each source and field meaning.

The slug's historical Technical Consultant wording is not the displayed title. SEO `employmentType: OTHER` is not the API's `timeType: Full Time`; SEO `jobLocationType: TELECOMMUTE` is not the frontend's `remoteType: Flex`. Frontend label evidence grounds the returned API fields without a universal enum conversion.

## Export warning and final public examples

The first parent export found no literal/live secret, but its heuristic warned that two long public job slugs looked like base64 blobs. An assertion stopped the continuation before any site request. The original warning receipt and stderr are preserved in `initial-export.original-warnings.json` and `qualify.initial.resources`. No scanner, core code or vet rule was changed or waived.

The parent read the original genuine catalog and selected three shorter, actual linked job segments for public verification fixtures. Learning still uses the original two differing frontend captures. The final example/check inputs are:

- `Technical-Consultant_JR-0110821`, Integration Consultant, Hong Kong.
- `Web-Designer_JR-0110973`, Web Designer, USA CA Remote label.
- `Digital-Project-Consultant_JR-0110941`, Digital Project Consultant, Seattle.

These were copied from real catalog entries, not invented or shortened routes. Caller notes describe the learning roles by title and requisition rather than embedding the flagged long segments. The final exported spec and notes have zero warnings, without changing the actual request shape or extraction semantics.

## Current verification and reuse

At 13:37 UTC, the exact exported version passed all three `verifySite` cases with `maxTier: 1`, no healing and no browser. The operation hash is `93b5d0286c55e585`. Verification calls returned successful public JSON documents of 7,693, 10,079 and 10,283 bytes. The export retained public examples and contained no secret findings or warnings.

A separate initially empty home then reused the final export for the held-out Hong Kong job at tier 1. All returned data equaled the previously independently checked unseen result. First requests from both verification and fresh homes sent no Cookie, Authorization or CSRF header. Later anonymous response cookies in the verification home were allowed; no private session was imported. The learned optional CSRF header remains a cookie reference, not a literal credential, and was absent from all four requests.

Final spec plus notes passed `vetShared` with zero errors or warnings. A separate parent saved-file receipt audit checks the registry hash against the verification record, actual export equality, three passing tier-1 cases, publication gate and direct final JSON-plus-notes vet. Receipt: `bench/explore/state/discovery/audit-workday-export.json`.

Evidence root: `bench/explore/state/discovery/workday-coordinator-finalize-r2/`. Current verification home is its `verify-home`; the separate reuse home is `fresh-home`. Receipts include `initial-export.json`, `verify.json`, `export.json`, `fresh.json`, `requests.json`, `summary.json`, `vet.json`, `audit.out`, and corresponding resource logs. Original worker files remain unchanged. Raw responses, captures and session state remain ignored.

## Contract and limits

`job` is the complete final job-link segment including its requisition suffix, copied from a public job link for this employer tenant. Output is title, primary location, optional additional locations, frontend time-type and work-arrangement labels, requisition ID, posting slug and public detail URL. Additional locations can be absent. Neither the listing nor an arrangement label establishes current vacancy, application eligibility or a fully remote guarantee. Search, pagination, other employers, applications, accounts, uploads and full job descriptions are excluded.

The worker used an initially empty isolated browser and no login/import. The public catalog explicitly had `userAuthenticated: false`. Its correction of `learnedLoggedIn` from a guest-cookie heuristic to false was grounded in that evidence, not a fabricated signed-out capture.

## Resources and cleanup

Parent work used only bounded offline processing and tier-1 verification under the existing 89% admission / 90% stop memory allowance and CPU 65% / 85% thresholds. The successful final qualification samples peaked at CPU 33.26% and policy memory 87.50%. Raw occupied memory reached 99.64%; policy memory excludes file-backed cache, so no global all-memory-below-95% claim is made. The initial local export assertion made no site request. All actual requests used manual redirects, a 15-second deadline, 5 MiB response cap and a failure latch preventing subsequent sends after a control or error.

All owned commands exited. This continuation launched no browser and acquired no browser mutex. No unrelated process, lock, source, dependency or other site's spec was changed. No commit, push, PR or publication occurred. Discovery remains active.
