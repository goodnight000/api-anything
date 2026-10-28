# Fandango qualification r2

2026-10-26 UTC. **PASS for the assigned Fandango operation.** Two real frontend document captures, a held-out tier-1 replay with an independent semantic comparison, current-version verification, export with public examples, initially empty-home cookie-free reuse and direct shared vetting passed. The parent still owns integrated registry checks. Saved `sites/fandango.json` and `sites/fandango.md` are local working-tree additions; nothing was published.

This continuation ran approximately 11:32 to 11:40 UTC, within 20 minutes, on the shared dirty branch `t3/reverse-engineer-high-leverage-apis`, HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. It read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the unchanged experimental capture-document.mjs, prior Fandango report, saved source, prepared helpers, existing registry and discovery reports before network work. The prior `fandango-trustpilot-r1.md` remains authoritative for its earlier receipts. Trustpilot was never requested in this continuation and remains stopped after its AWS WAF 403. No nesting, source/dependency edits, shared-state/runbook/catalog edits, private browser import, login, site writes, commits, pushes, PRs or publication occurred. Other sites were untouched.

Raw evidence and batch-only helpers are ignored under:

`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/fandango-qualified-r2/`

All evidence filenames below are relative to that directory. The explicit absolute `API_ANYTHING_HOME` values are its `fandango-home`, `replay-home` and `fresh-home` subdirectories. No session file was copied to either replay home.

## Qualified contract

`getMovie(moviePath)` sends GET `https://www.fandango.com/{moviePath}/movie-overview`. Copy the complete single path segment before `/movie-overview`, including its numeric suffix, from a public movie link. The learned slot is `path:0`; the matcher is GET, host `www.fandango.com`, path `/*/movie-overview`. There are no volatile anchors, credential references, trigger steps or writes. The operation is `readOnly: true`, `minTier: 1`, `learnedLoggedIn: false`.

The recipe selects the standalone Movie JSON-LD script before FAQPage, rather than treating the first arbitrary JSON-LD object as movie data.

| Returned field | Exact source and established meaning |
|---|---|
| `title` | Movie `name`, including the site's displayed year |
| `runtimeMinutes` | Numeric Movie `duration`; independently matched to hours/minutes labels on all three movies |
| `contentRating` | Movie `contentRating`, preserving the site's label |
| `releaseDate` | Movie `datePublished`; held-out HTML explicitly labels it RELEASE DATE, the advertised film release date |
| `genres` | Movie `genre`, preserving the site's comma-separated string and genre labels |
| `url` | Movie `url`, matching the held-out canonical link |

The release date does not establish a dated cinema screening or availability. Tickets, showtimes, cinema inventory, location/account actions, carts, purchase links and article/synopsis copying are excluded. No empty-result or missing-movie behavior was qualified. The schema may change, and missing metadata fields can be omitted.

## Grounding and real captures

The initial saved source from r1 was inspected offline first. Its actual links establish both Wildwood and Clayface; no ID, slug or route was guessed. The pre-existing candidate and qualify helpers were treated as unexecuted preparation, then copied into this batch and adjusted locally.

| Role | Exact moviePath | Frontend capture | Observed metadata |
|---|---|---|---|
| First example | `klara-and-the-sun-2026-246291` | `cmvp6ia9z7f2426`, request 1 | Klara and The Sun (2026); 116 minutes; PG-13; 2026-10-23; Comedy,Drama |
| Second example | `wildwood-2026-246438` | `cmvp6j6dq03e747`, request 1 | Wildwood (2026); 130 minutes; PG-13; 2026-10-23; Animated,Sci-Fi/Fantasy |
| Held out until replay | `clayface-2026-244768` | No browser capture required or fabricated | Clayface (2026); 108 minutes; R; 2026-10-23; Horror |

Each exact page/request URL is `https://www.fandango.com/` followed by the complete path above and `/movie-overview`. Capture 1 completed at approximately 11:34:08 UTC after 9,561 ms, with HTTP 200, 79 exchanges and 78 aborted requests. Capture 2 completed at approximately 11:34:49 UTC after 3,240 ms, with HTTP 200, 81 exchanges and 80 aborted requests. Final document URLs matched the sourced inputs and neither had a bot-wall finding.

These were actual Chromium frontend GET document captures with the unchanged exact-GET helper, 15-second timeout and atomic global mutex. Other requests were aborted. Inline scripts could execute. Capture 1 sent no Cookie or Authorization; its isolated profile acquired five guest cookies, which capture 2 sent. There was no private-session import. This proves document capture, not a fully hydrated GUI. Saved capture JSON lives in `fandango-home/captures/`; helper receipts are `capture1-2.out` and `capture2-0.out`. Local offline inspection also saved each captured document as `<captureId>.html`.

Visible runtime statements agree with numeric durations: 116 equals 1 hr 56 min, 130 equals 2 hr 10 min. The new examples establish minutes instead of assuming the initial movie's units generalize.

`learn.json` and `learn-0.out` record genuine two-capture learning with no warnings. Its empty `captures` array means saved captures were supplied to addOperation; it is not evidence of absent frontend captures. The operation's capture IDs are recorded above and in the preserved source files.

## Held-out semantic proof and qualification receipts

`replay-initial.json` records a separate initially empty replay home receiving only the learned spec. `unseen.json` and `unseen-0.out` record one cookie-free, Authorization-free GET to Clayface, HTTP 200, tier 1, 352 ms, without healing or truncation. Clayface was never used in learning; it was subsequently exercised as a verification check.

A separate ordinary cookie-free GET at `2026-10-26T11:35:50.475Z` independently obtained the held-out document. `unseen-independent.meta.json` records HTTP 200 and no redirect or bot-wall finding; `unseen-independent.html` retains the ignored source. `compare.py` uses Python's standard HTMLParser over the labeled HTML and canonical link, without the learned Movie JSON-LD recipe. `unseen-comparison.json` matches all six returned fields:

- Heading Clayface (2026) establishes identity.
- Runtime label 1 hr 48 min independently gives 108 minutes.
- Rating label R and the genre span Horror agree.
- RELEASE DATE Friday, Oct 23, 2026 converts to 2026-10-23.
- The canonical link equals the exact Clayface movie URL.

One local comparison initially included the `genre-title` label in the expected genres. Restricting the independent parser to genre value spans corrected that helper mistake; it did not change the operation or trigger another site request.

| Gate | Evidence | Result |
|---|---|---|
| Current `verifySite`, `maxTier: 1`, 15-second timeout | `verify.json`, `verify-requests.json`, `verify-fixed-0.out`; persistent record `replay-home/checks/fandango.json` | Klara example, Wildwood check and Clayface check all pass at tier 1; three HTTP 200 requests |
| Current-operation hash | `verify-hash.json` | Operation and record both `8c123c2840b5dcab` |
| Export, `keepExamples: true` | `export.json`, `export-scan.json`, `export-0.out` | No secrets or warnings; public example/check inputs retained; response shape/sample and learned timestamp removed |
| Initial empty-home reuse of exported spec | `fresh-initial.json`, `fresh.json`, `fresh-requests.json`, `fresh-0.out` | One GET, HTTP 200, tier 1, 307 ms, no Cookie/Authorization, no healing/truncation; all six fields match independent expected values |
| Direct `vetShared` on export and notes | `vet.json`, `export-0.out` | Zero errors and warnings |
| Direct `vetShared` on exact saved site files | `vet-saved.json`, `vet-saved.out` | Zero errors and warnings |
| Exact saved bytes | `saved-files.json` | SHA-256 receipts for both new files; site JSON equals the vetted export |

The first verification helper attempt refused the replay home's newly stored guest cookies before sending any request, producing three inconclusive local `cookie-free qualification` errors. `verify-3.out` retains that attempt. The helper was corrected to permit ordinary guest cookies during signed-out verification; `verify-fixed-0.out` records the successful run. This was a local assertion failure, not a site error or access-control response. Ordinary verification sent guest cookies, while held-out replay and fresh export reuse each proved cookie-free operation. The final current record is the successful one. No auth, challenge, 429 or repeated origin error occurred, and no transport fallback ran.

## Resource limits and cleanup

The exact-GET browser captures and bounded tier-1 commands used memory admit 89% / stop 90%, CPU admit 65% / stop 85%, under the runbook's narrow exception. The final direct saved-file vet used the default memory admit 88% / stop 90%. The unchanged resource gate sampled during owned commands; it cannot guarantee an absolute host-wide transient bound.

Capture 1 admission was denied twice: 11:32:54 UTC at 25.50% CPU / 89.29% policy memory and 11:33:26 UTC at 24.69% / 90.01%. The wrapper waited at least 30 seconds between samples without website traffic. The third sample admitted at 11:33:57 UTC, 31.42% / 88.78%. Capture 2 admitted at 11:34:45 UTC, 26.48% / 88.95%. The initial verify command had three denied samples at 89.76%, 89.61% and 89.68% memory, then admitted its fourth and final attempt at 88.95%. No replacement loop or relaxed resource threshold was used.

Across 25 saved samples, peak CPU was 52.71%; policy memory peaked at 90.01% on a denied sample. Admitted/running policy memory peaked at 89.43%. Raw occupied memory peaked at 99.70%, including file-backed cache; this is distinct from the runbook's policy memory metric. `resource-summary.json` aggregates every gate log. No watchdog stop occurred.

Each capture wrapper acquired the global mutex atomically and exited successfully after closing its browser and releasing its own token's lock. `cleanup.json` at 11:39:39 UTC found no live batch-owned helper or Chrome process. A global lock was present again at final audit and was left untouched; this worker did not remove anyone else's lock. Isolated homes, guest-session state and raw evidence remain ignored for audit. No unrelated process or dirty file was changed. The parent owns integrated checks and updates to the shared state, catalog and runbook.
