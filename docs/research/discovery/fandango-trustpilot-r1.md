# Fandango and Trustpilot r1

2026-10-26 UTC. **BLOCKED for qualification.** Trustpilot is stopped after its first local public document request returned an AWS WAF challenge, HTTP 403. Fandango has a grounded public movie-metadata candidate, but all four browser-capture admission checks were denied. No registry JSON or caller notes were saved. Neither site counts as reusable.

This batch ran from approximately 11:18 to 11:25 UTC, within the 20-minute bound. It read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the unchanged capture-document.mjs, movie-source-prep-r1.md, existing reports, registry filenames and coordinator state. The shared dirty checkout was branch `t3/reverse-engineer-high-leverage-apis`, HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. No nested worker, source/dependency change, state/runbook/catalog edit, site write, login, private cookie import, commit, push, PR or publication occurred. Other assigned and stopped sites were untouched. The parent owns integrated checks.

All raw evidence and prepared local helpers are ignored under the absolute batch directory:

`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/fandango-trustpilot-r1/`

## Official integration suitability

A bounded remote search found Trustpilot's official [Business Units API overview](https://developers.trustpilot.com/business-units-api-overview/) and [public Business Units API](https://developers.trustpilot.com/business-units-api-%28public%29/). They document public business-unit lookup with an API key. The official [Data Solutions guide](https://developers.trustpilot.com/data-solutions-how-to/) also describes score, category and review-count data with a key. This is an official integration route, but readily usable anonymous access was not established. No API endpoint was called, application created or key requested. The available tool catalog exposed no dedicated Trustpilot or Fandango operation; this is a session-catalog finding, not a claim that no MCP exists elsewhere.

Fandango's prior preparation and this batch's bounded official-domain search did not establish a current, readily usable movie-metadata API. Search surfaced an old [API license document](https://images.fandango.com/doc/FandangoAPILicenseTermsandConditions.pdf), which does not establish a working integration. Absence of an API is not proved. Public frontend metadata remained a useful candidate.

Remote search/open results are source preparation, potentially cached. They are separate from local origin receipts and never represented as browser captures. `remote-source-result.json` retains the opened primary-page preparation. Raw page content is not included here.

## Trustpilot stop

The exact profile links `https://www.trustpilot.com/review/www.ikea.com` and `https://www.trustpilot.com/review/www.amazon.com` were grounded in remote search and opened remotely before the local failure. Their public documents exposed business identity, aggregate score/count and category labels. No review operation was designed; reviewer identity and review text are outside this task and are not copied into tracked output.

The first local, cookie-free ordinary GET to the sourced IKEA profile returned:

- UTC receipt: `2026-10-26T11:21:42.955Z`.
- HTTP 403, title `Verifying Connection`.
- Repository classifier: `AWS WAF challenge page (HTTP 403)`.
- Evidence: `trustpilot-source.meta.json`, `trustpilot-source.gate.jsonl`, and `trustpilot-stopped.json`.

The domain stopped immediately. There was no second local profile request, browser attempt, alternate route/host, challenge execution, proxy, login or bypass. No Trustpilot capture ID exists. No learning, unseen replay, verify, export, fresh-home reuse or vetting occurred. A remote document's public contents do not override the local access-control failure.

## Fandango candidate and grounded inputs

The exact initial page came from movie-source-prep-r1.md:

`https://www.fandango.com/klara-and-the-sun-2026-246291/movie-overview`

Its ordinary cookie-free GET returned HTTP 200 at `2026-10-26T11:21:31.895Z`, with 140,284 JavaScript string characters and no `botWall` finding. This is an HTTP source read, not a browser capture. `fandango-source.html`, `fandango-source.meta.json`, `fandango-source.out` and its gate log retain it. A separate remote open also identified the movie, its runtime and release-date labels. Neither source is described as a fully hydrated GUI.

The document contains a standalone Movie JSON-LD script before its FAQPage script. The Movie's numeric `duration` is 116. Visible page text and the separate FAQ say 1 hr 56 min, establishing minutes for this source example. The source identifies Klara and The Sun (2026), content rating PG-13, Comedy and Drama, and a release date of October 23, 2026. The loading showtime/calendar controls establish neither empty inventory nor availability.

Actual links in that source document ground the other candidate inputs. No slug, numeric ID or endpoint was guessed.

| Role | Complete moviePath | Exact sourced URL |
|---|---|---|
| Planned first example | `klara-and-the-sun-2026-246291` | `https://www.fandango.com/klara-and-the-sun-2026-246291/movie-overview` |
| Planned second example | `wildwood-2026-246438` | `https://www.fandango.com/wildwood-2026-246438/movie-overview` |
| Planned unseen input | `clayface-2026-244768` | `https://www.fandango.com/clayface-2026-244768/movie-overview` |

The candidate is `getMovie(moviePath)`, where the caller copies the complete single path segment before `/movie-overview`, including the numeric suffix. Its proposed request/trigger is an exact GET of `https://www.fandango.com/{moviePath}/movie-overview`. This is a candidate contract only, saved in ignored `fandango-candidate.json`, not a learned operation.

| Proposed field | Source and meaning |
|---|---|
| `title` | Movie JSON-LD `name`, including the site's displayed year |
| `runtimeMinutes` | Numeric Movie JSON-LD `duration`; 116 agrees with the initial page's visible 1 hr 56 min |
| `contentRating` | Movie JSON-LD contentRating, as labeled by the site |
| `releaseDate` | Movie JSON-LD datePublished; agrees with the initial page's release-date label, and does not mean a screening is available |
| `genres` | Site-supplied comma-separated Movie JSON-LD genre string |
| `url` | Movie JSON-LD canonical movie URL |

No tickets, cart, account, favorites, personal location, venue availability, dated showtime or inventory operation was attempted. The second and third pages were not requested locally. Their content and the candidate's reusable field semantics remain unverified beyond the initial source.

## Capture admission and missing proof

The unchanged experimental exact-GET capture helper was prepared with an isolated absolute `API_ANYTHING_HOME` ending in `fandango-home`. It would have allowed only the requested GET document and aborted other requests, with its unchanged 15-second timeout and unsupported redirects. No browser command actually started.

The wrapper acquired `bench/explore/state/discovery/browser.lock` atomically, wrote a random owned token, and checked resource admission before launching the helper. After each denial it waited 30 seconds with no site request, then resampled, at most three retries. All four attempts were denied before browser creation:

| UTC sample | CPU % | Policy memory % | Result |
|---|---:|---:|---|
| 11:22:08.877825 | 24.78 | 89.85 | Denied |
| 11:22:40.549148 | 21.43 | 91.48 | Denied |
| 11:23:12.256666 | 22.62 | 90.99 | Denied |
| 11:23:43.968465 | 20.21 | 90.08 | Denied |

Each exact receipt is `fandango-capture1-<attempt>.gate.jsonl`, attempts 0 through 3. Their corresponding stdout files are empty. The wrapper completed with exit 75 and released only its token's lock after the owned command exited. No alternate capture path or relaxed threshold was tried.

Capture IDs for both sites: **none**. The planned two differing examples, held-out third-input tier-1 replay and independent identity/meaning comparison did not run. `verifySite` with maxTier 1, current-version record checks, export with public examples, initially empty-home cookie-free reuse and direct `vetShared` did not run. No PASS paths exist for those gates. The ignored prepared qualification helper is unexecuted and is not evidence of a working operation. Nothing was written to `sites/fandango.*` or `sites/trustpilot.*`.

## Resource and cleanup receipt

All site/network work used resource admission. Bounded HTTP work and the attempted source-grounded document capture used admission 89% and hard stop 90% memory, CPU admission 65% and hard stop 85%. Remote source preparation used a fresh bounded snapshot gate. An initial 89.83% memory denial and a later 90.31% remote-open denial caused waits before admitted attempts. No website requests ran during those waits.

Across ten saved samples, peak CPU was 51.60%, policy memory 91.48%, and raw occupied memory 99.70%, including file-backed cache. The high policy-memory samples denied commands. Among admitted samples, maxima were CPU 51.60% and policy memory 88.43%. The resource metric and samples cannot guarantee an absolute host-wide transient bound. No watchdog termination occurred because the actual local HTTP reads completed before the next sample and every browser command was denied.

`cleanup-resource.json` records the final audit at 11:24:25 UTC: global browser lock absent, no Chrome process using this batch's profile path, no Fandango or Trustpilot home created, and all four assigned site output paths absent. The HTTP helpers exited and the capture wrapper exited before cleanup. Ignored source documents, receipts and prepared helpers remain; no unrelated process, profile, lock or dirty file was changed.

Fandango is resource-deferred, not domain-stopped. Trustpilot is domain-stopped on the observed challenge. The coordinator alone decides any later resource-admitted continuation and updates shared state.
