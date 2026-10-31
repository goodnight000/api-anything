# Movie availability discovery round 1

2026-10-26 UTC. Batch outcome: BLOCKED by local resource admission. JustWatch and Fandango are deferred, with no website requests sent. Neither domain has been assessed as auth-gated, challenged, rate-limited, or broken.

The authorized scope was public title search, country-specific streaming availability and metadata, and public city/cinema/showtime discovery. This batch excluded accounts, personal location, location permissions, watchlists, seats, holds, purchases, playback, and access-control bypass. No nested delegation, shared state edits, source or dependency edits, commits, pushes, PRs, publication, browser import, login, or site writes occurred.

## Results and proof limits

| Site | Status | Operations saved | Evidence |
|---|---|---|---|
| JustWatch | Resource-deferred | None | The intended first signed-out GET to `https://www.justwatch.com/us` never passed admission. No document or frontend traffic was captured. |
| Fandango | Unattempted due to the same resource block | None | Work was ordered after JustWatch. No request URL or endpoint was explored. |

There are no operation names, accepted input formats, learned field semantics, capture IDs, or unseen third-input comparisons to report. No `verifySite`, export, fresh-home replay, or `vetShared` ran because no operation exists. No spec or caller notes were added to `sites/`. Availability semantics, country handling, monetization types, provider/source identity, and cinema/showtime inputs remain unverified. Documented API suitability was not assessed.

The existing registry and discovery reports had no JustWatch or Fandango operation. The coordinator state assigned both domains to this worker. That state, the runbook, catalog, frozen sites, and other workers' files were read only.

## Resource evidence

Every attempted network command was guarded by `python3 bench/discovery/resource_gate.py` with default CPU admission 65%, CPU stop 85%, memory admission 88%, memory stop 90%. All samples denied admission, so no Node fetch, browser launch, or website traffic ran.

| UTC | CPU percent | Gate-defined memory percent | Outcome |
|---|---:|---:|---|
| 10:17:15.319076 | 44.01 | 88.49 | Denied |
| 10:17:36.480110 | 27.55 | 89.56 | Denied |
| 10:18:08.243657 | 22.90 | 89.25 | Denied |
| 10:18:40.003782 | 20.11 | 89.14 | Denied |

The first resample occurred about 21 seconds after the initial denial, short of the required 30 seconds. This was a timing mistake. Subsequent resamples were more than 30 seconds apart. No website request ran during any interval. After the third denied resample, only the owned retry helper, PID 22902, was terminated while waiting, preventing another attempt. Its PTY process ended with exit 143. Each guarded attempt returned exit 75.

Sampled peaks were CPU 44.01% and gate-defined memory 89.56%. Raw occupied memory peaked at 99.69%, which is recorded separately: the runbook metric excludes file-backed cache but retains anonymous inactive and compressed memory. No claim is made about raw occupied memory staying below 95% or about unsampled transients. No expensive command was admitted or watchdog-terminated.

## Receipts and cleanup

Evidence root: `bench/explore/state/discovery/movie-availability-r1/`, ignored by Git. Absolute isolated homes were prepared at that root as `justwatch-home/` and `fandango-home/`; both remained empty. No cookie, session, browser profile, or capture file exists there.

- `justwatch-homepage.resources.jsonl` and `justwatch-homepage.log` retain the first denial.
- `justwatch-homepage-retry.command.json` records the prepared command.
- `justwatch-homepage-retry.attempt0`, `attempt1`, and `attempt2` each have `.resources.jsonl`, `.out`, and `.exit` receipts.
- `resources-summary.json` contains all four samples and the zero-request/zero-capture counts.
- `cleanup.json` records the empty homes, owned-helper stop, and absence of browser-lock ownership.
- `read.mjs` and `run.py` are ignored preparation helpers. The prepared HTTP reader never ran. No response was converted into a fabricated capture.

The browser mutex was never acquired. No browser process was started and no unrelated process was stopped. The experimental `bench/discovery/capture-document.mjs` was read but never invoked. Both domains can remain eligible for a later resource-admitted batch; this report is not a domain rejection.
