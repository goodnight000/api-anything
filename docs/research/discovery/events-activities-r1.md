# Eventbrite and Klook discovery, round 1

Outcome: ISSUES overall. Eventbrite PASS with two local public-read exports. Klook BLOCKED by its first public HTTP request. Work ran 2026-10-26 09:43-09:51 UTC, within the 20-minute/two-site limit. No nested delegation, publication, commits, account actions, purchases, login, or personal cookie imports.

## Saved files and operations

- `sites/eventbrite.json`: `listFeaturedEvents(city)` and `getEvent(slug)`.
- `sites/eventbrite.md`: caller scope, input formats, limitations, and maintainer source/capture evidence.
- This report.
- Ignored evidence only: `bench/explore/state/discovery/events-activities-r1/`.

No Klook spec or caller notes were created. No shared state, catalog, runbook, source, dependency, or other worker output was edited. Integrated registry/type/lint tests are left to the coordinator.

## Eventbrite: PASS within the exported scope

First request, 2026-10-26T09:43:54Z: https://www.eventbrite.com/ , HTTP 200, cookie-free. This frontend linked the exact San Francisco, New York, and Los Angeles city routes. The San Francisco city document linked all three event URLs below. No IDs or routes were guessed.

Actual frontend GET documents were captured with `bench/discovery/capture-document.mjs` under the global browser mutex. This repository harness captures the requested document and aborts every other request. Each capture returned HTTP 200 with no classified challenge. The isolated home was `eventbrite-home/` beneath the ignored evidence directory.

| Use | Arguments | Source/request URL | Capture ID |
| --- | --- | --- | --- |
| Listing example 1 | `city=ca--san-francisco` | https://www.eventbrite.com/d/ca--san-francisco/events/ | `cmvp2lkv0ec53fb` |
| Listing example 2 | `city=ny--new-york` | https://www.eventbrite.com/d/ny--new-york/events/ | `cmvp2mi11f58f4d` |
| Listing unseen input | `city=ca--los-angeles` | https://www.eventbrite.com/d/ca--los-angeles/events/ | `cmvp2mx5cd464e3` |
| Detail example 1 | `slug=san-frans-largest-tech-startup-business-entrepreneur-networking-soiree-tickets-1976644210042` | https://www.eventbrite.com/e/san-frans-largest-tech-startup-business-entrepreneur-networking-soiree-tickets-1976644210042?aff=ebdssbneighborhoodbrowse | `cmvp2n83ce723f7` |
| Detail example 2 | `slug=rb-and-ribs-sf-halloween-tickets-2001891472283` | https://www.eventbrite.com/e/rb-and-ribs-sf-halloween-tickets-2001891472283?aff=ebdssbneighborhoodbrowse | `cmvp2nlj33a65c9` |
| Detail unseen input | `slug=fairmont-hotel-san-francisco-mega-halloween-party-tickets-1998382597143` | https://www.eventbrite.com/e/fairmont-hotel-san-francisco-mega-halloween-party-tickets-1998382597143?aff=ebdssbneighborhoodbrowse | `cmvp2oggr83686e` |

`listFeaturedEvents` reads the first desktop featured shelf, currently four cards. It returns name, URL, event ID, location, display time, and venue. The Los Angeles tier-1 replay matched all four ordered identities and all six returned fields after collapsing HTML display whitespace. One raw display-time label had doubled and trailing spaces, which the runtime normalizes. Receipt: `eventbrite-featured-la-comparison.json`; executable comparison: `compare-featured.mjs`.

`getEvent` reads schema.org event JSON-LD. The third-input tier-1 replay matched the independent frontend's identity and every returned field exactly: name, description, canonical URL, start/end times, event status, venue, address, organizer, and advertised offers. Receipt: `eventbrite-detail3-comparison.json`. This does not test booking availability or purchase behavior.

Learning used real CLI `add --from ... --from2 ... --pick-request 1`, with a JSON matcher, and emitted zero final warnings for both exported operations. There were two corrected local recipe mistakes, neither an upstream error: the initial embedded pattern omitted leading whitespace; the initial matcher passed comma-separated values as one method string and skipped the two-run diff. Both were corrected against the same genuine captures before the final exports.

A richer JSON-LD browse operation was deliberately removed from the isolated local spec before export. Its Los Angeles result contained 32 events, of which 28 identities and their name/date fields agreed; four online recommendations differed between browser and HTTP clients. That operation is not counted as passed. The featured-shelf recipe avoids claiming those changing recommendations were reproduced. The export covers city discovery and details, not keyword search, pagination, every shelf, or complete event inventory. More schema.org event types and cities remain untested.

Four public `check` cases cover New York, Los Angeles, the second event, and the third event. The actual `verifySite('eventbrite', {maxTier: 1})` harness returned six passes, all tier 1, with no failed, skipped, or inconclusive cases. Receipts: `eventbrite-verify.json`, `eventbrite-finalize.log`; reproducer: `finalize-eventbrite.mjs`. Changing cities excludes the original city's shelf; changing detail slugs returns different event identities.

The CLI exported with `--keep-examples --out sites/eventbrite.json`, zero export warnings. Each exported operation then replayed the third argument in a different newly created, initially empty home: `eventbrite-fresh-featured/` and `eventbrite-fresh-detail/`. Both returned `ok: true`, tier 1, no heal, and data exactly equal to their earlier tier-1 replays. Neither home received a copied profile/session, and the export has zero credential refs and zero Cookie headers. Receipts: `eventbrite-fresh-featured.log`, `eventbrite-fresh-detail.log`, `eventbrite-evidence-summary.json`.

Direct `parseSite` plus `vetShared(spec, notes)` returned `{"errors":[],"warnings":[]}` for the exported JSON and caller notes. Receipt: `eventbrite-vet.json`; reproducer: `vet-eventbrite.mjs`. Shared integrated checks were not duplicated.

## Klook: BLOCKED

First and only website request, 2026-10-26T09:49:37Z: https://www.klook.com/ . HTTP 403, 777-byte document, classifier result `DataDome challenge page (HTTP 403)`, with a captcha-delivery script. Stopped the domain immediately. No browser attempt, alternate route, challenge solving, endpoint guessing, API calls, or login followed. `klook-home/` was separate and empty. Receipts: `klook-root.json`, `klook-root.html`, `klook-root.log`, `klook-root.resources.jsonl`. Raw response evidence remains ignored, not copied into tracked files.

No public activity search/detail route was established from that blocked document, so there are no grounded endpoint leads to promote. Klook remains deferred pending an authorized accessible public frontend; do not automatically retry it in the next batch.

## Resources and cleanup

All browser/HTTP/learning/replay/verification/export/vetting commands ran through `resource_gate.py`. Browser commands used defaults: CPU admit 65%, memory admit 88%, CPU stop 85%, memory stop 90%. Bounded no-browser commands used the allowed memory admit 89%, stop 90%, with unchanged CPU thresholds. There were no admission denials or watchdog stops, so no exit-75 retries were required. The browser mutex was busy twice; no second browser ran while it was held.

Across 45 retained resource samples, peak CPU was 71.66% at 09:45:26Z, and peak runbook memory was 86.72% at 09:46:00Z. Receipt: `resources-summary.json`, backed by per-command `.resources.jsonl` files. This memory metric excludes file-backed cache; raw occupied RAM at the memory peak was 99.78%, and is not claimed below 95%. The watchdog measures the host and cannot guarantee unsampled transient usage.

Every owned capture command exited, and each acquired mutex was released only after its process exited and its ownership token matched. A final process census found no remaining worker command or browser process using the owned home paths. No unrelated process was stopped. Ignored captures and isolated homes remain for coordinator inspection. No work was published.
