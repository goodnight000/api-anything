# edX provider-course qualification

PASS for `listCourses(school)`, 2026-10-26 UTC. Saved `sites/edx.json` and caller/maintainer notes. The parent completed the missing third-provider comparison, corrected a local cookie assertion, verified the exact exported operation, proved reuse from an initially empty home, and audited the saved files. Integrated registry validation is recorded separately in the discovery index.

## Reused frontend evidence

Reused genuine exact-document browser captures from the earlier coordinator and worker batches, without recapturing or fabricating exchanges:

| Provider | Capture, document | Request | Independent comparison |
| --- | --- | --- | --- |
| Harvard University | `cmvp9nj6ebd5213`, 1 | `https://www.edx.org/school/harvardx` | 32 course cards matched |
| edX | `cmvp9qelpd6897c`, 1 | `https://www.edx.org/school/edx` | 32 course cards matched |

These signed-out captures contain real HTTP 200 documents. The exact-GET capture helper aborts other requests and does not establish a fully hydrated GUI. Original captures remain in `edx-coordinator-r2/home/captures/` and byte-identical worker copies remain under `edx-finalize-r3/home/captures/`. Prior learning, recipe and independent-parser evidence is described in [round 3](edx-finalize-r3.md).

## Resolving the held-out provider

MIT's earlier HTTP 308 points to the homepage, not a usable MIT canonical provider route. It was not followed. The already sourced `https://www.edx.org/school/vjx` returned HTTP 200 at 13:21:22 UTC, with a valid canonical and provider heading but no course cards. It was not used as a successful populated third example. No empty-provider contract is asserted.

The prior official indexed Berkeley URL contained affiliate query parameters. A cookie-free source GET of that exact sourced URL succeeded at 13:25:47 UTC, after three default-admission denials. Its document supplied the clean canonical `https://www.edx.org/school/uc-berkeleyx`. The query parameters remain only in ignored source evidence and were never added to the saved request, trigger, slots, examples or notes. No guessed canonical route or redirect-following claim was needed.

An independent Python HTMLParser collected complete visible anchor text and URLs without using the recipe's span selectors. Berkeley had 36 linked product cards, comprising 30 courses and six programs. The held-out clean-route tier-1 call returned all 30 courses in source order. Every URL matched, and every independently parsed text string equaled replay title, provider and the visible Course label. Program cards were excluded. Evidence: `third-source.json`, `unseen.json` and `comparison.json` under the round-4 evidence root.

## Current verification and fresh reuse

The round-3 verifier incorrectly required no Cookie header on every sequential request. Its first anonymous response set a guest cookie, so the assertion prevented a later request locally. That was a harness failure, not an origin auth or challenge response. The continuation permits ordinary anonymous response cookies and requires no Cookie or Authorization header on the first request from each initially empty home. No private browser session was imported.

At 13:27 UTC, `verifySite` with `maxTier: 1` passed all three current-version cases: Harvard, edX and Berkeley. None healed or used a browser. The exact operation hash is `03b81f01d7250eed`. An additional Berkeley call from a separately initially empty home succeeded at tier 1 with no Cookie or Authorization header and returned exactly the same 30 rows as the held-out replay. The first call in the verification home also sent neither header. Logs retain header-presence booleans only, not credential values.

Export retained public examples and returned no secret findings or warnings. Final spec plus notes passed `vetShared` with zero issues. At 13:27:50 UTC the parent saved-file audit proved that the registry operation hash matches the verification record, the actual export equals the parsed registry spec, all three current cases pass, and final shared vetting is clean. Audit receipt: `bench/explore/state/discovery/audit-edx-export.json`.

Final verified home: `bench/explore/state/discovery/edx-coordinator-finalize-r4/verify-home`. Fresh home: the sibling `fresh-home`. Other receipts are `verify.json`, `export.json`, `fresh.json`, `requests.json`, `vet.json`, `summary.json`, and `audit.out`. Exact source reads and bounded denial logs are retained under the preceding `edx-finalize-r3/` evidence root. No raw HTML, captures, session state or tracking query is copied into tracked files.

## Contract and limits

`listCourses(school)` accepts a provider slug from an actual public `/school/` link. It returns displayed title, displayed provider and absolute frontend URL for initial server-rendered course cards. The recipe uses course-link anchors and their title/provider spans. This is a partial initial list, excluding programs, pagination and the complete catalog. Course detail, cost, workload, availability, enrollment, access and completion are not established by these rows. Removed or empty provider pages are not guaranteed to return a valid empty result.

## Resources and cleanup

Unknown initial source GETs retained default CPU 65%/85% and policy-memory 88%/90% admission/stop thresholds. Bounded parsing, tier-1 verification and saved-file auditing used the existing 89%/90% memory allowance. Berkeley's initial source attempt and two resamples denied before launch; the third spaced resample admitted. No requests ran during those denied commands. The successful source samples peaked at CPU 34.76%, policy memory 86.26%; qualification samples peaked at CPU 28.72%, policy memory 89.20%. Policy memory excludes file-backed cache. Raw occupied memory exceeded 95%, and no continuous host-wide memory-below-95% claim is made.

This continuation launched no browser and acquired no browser mutex. All owned source, parser, verification and audit commands exited. No unrelated process or lock was changed. Source, dependencies and frozen specs were untouched; no commit, push, PR or publication occurred. The ongoing discovery goal remains active.
