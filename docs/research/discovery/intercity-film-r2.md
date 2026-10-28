# FlixBus and Letterboxd qualification, round 2

2026-10-26 UTC. ISSUES overall. FlixBus PASS: one reusable public read, `listStops(city)`, saved in `sites/flixbus.json` with caller/maintainer notes in `sites/flixbus.md`. Letterboxd BLOCKED: its first admitted public request returned a Cloudflare challenge, so the domain was stopped immediately. No Letterboxd spec was saved.

## Scope

Batch `intercity-film-r2` exclusively owned FlixBus and Letterboxd. The worker read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the capture helper, current discovery state, existing registry/reports, `intercity-film-r1.md` and `intercity-source-prep-r1.md`. The current runbook's understood-document allowance, memory admission below 89% with a 90% stop, was applied only to the source-grounded FlixBus document workflow. No nested worker was launched.

Work stayed in the shared dirty checkout. No source/dependency edits, shared state/runbook/catalog edits, commits, push, PR, publication, private browser import, login, account action, booking, payment, ticketing, site write or access-control bypass occurred. Other sites and frozen specs were untouched. Prior HTTP source analysis was used as a lead, then qualified through new frontend captures. The parent owns integrated repository checks.

## FlixBus PASS

`listStops(city)` accepts a complete city slug copied from a public FlixBus `/bus/` city-page link. The New York source linked Boston and Philadelphia before either was used here. The learned request is GET `https://www.flixbus.com/bus/{city}`, matched by method GET, host `www.flixbus.com`, path `/bus/*`. Learning found one slot, `path:1`, with no volatile values, credential refs, warnings or unproven mark. The operation is read-only, learned signed out and has `minTier:1`.

The recipe reads the document's schema.org `@graph` of `BusStop` objects, selecting:

- `name`: published stop name.
- `streetAddress`: published stop street address.
- `locality`: the page's locality label, which can group outlying stops under the directory city.
- `postalCode`: string, including leading zeroes.
- `countryCode`: published schema.org address country code.
- `latitude`, `longitude`: published directory coordinates.

These are stop-directory metadata, not a guarantee of a dated departure's boarding location. The site directs travelers to their ticket for current boarding information. For example, the Philadelphia directory includes Malvern and Camden while retaining `Philadelphia, PA` as their locality label. Keep address/postal/coordinate information together. Live departures, dates, fares, inventory, missing-city behavior, empty directories and non-US pages were not qualified.

### Real frontend captures

Each run used the repository's experimental exact-GET-only `capture-document.mjs`, a separate isolated profile and the global atomic browser mutex. The actual requested document answered 200. All other observed requests were aborted. The helper retains real browser exchanges, cookies and storage intact. Its timeout was 15 seconds. Redirects are unsupported; none occurred here. Inline scripts may execute. This is document-only frontend evidence, not a fully hydrated GUI observation.

| Role | Public request URL | Capture ID | Directory rows | Aborted other requests |
| --- | --- | --- | ---: | ---: |
| Example 1 | `https://www.flixbus.com/bus/new-york-ny` | `cmvp5hxm1b0ab87` | 13 | 75 |
| Example 2 | `https://www.flixbus.com/bus/boston-ma` | `cmvp5jbib665439` | 3 | 75 |
| Independent unseen comparison | `https://www.flixbus.com/bus/philadelphia-pa` | `cmvp5mvml48c7d3` | 4 | 74 |

Both learning captures contained zero cookies. The Philadelphia capture followed the successful unseen tier-1 replay, and was not used as a learning example. Learning used only the New York and Boston captures through `add --from --from2`, with no browser recapture.

### Unseen identity and meaning check

The first call with `city=philadelphia-pa` returned `ok:true`, `class:ok`, tier 1, four rows. A separate browser document capture then grounded the answer independently of the operation's JSON-LD recipe. An offline comparison read the frontend's separate `handleStopsLocation` map-directory array and the stop-accordion headings.

All four rows matched in order on name, street address, locality, postal code, latitude and longitude. All four names matched the published headings. Each stop's rendered country label was United States, matching `countryCode:US`. The identities were Philadelphia Bus Station, Philadelphia 30Th St Station, Malvern and Camden Walter Rand Trans Center. Philadelphia Bus Station's published address was `1001 Filbert St.`, postal code `19107`, coordinates `39.9529, -75.1571`. These checks establish correspondence with public frontend directory content; they do not establish current physical boarding conditions.

### Verification, export and reuse

Final `verifySite('flixbus', {maxTier:1})` passed three cases: example `new-york-ny`, result check `boston-ma`, and result check `philadelphia-pa`. All returned tier 1. The checks assert nonempty results. Parameter meaning was assessed separately through the differing captured directories and the independent unseen comparison.

Export used `exportSite('flixbus', {keepExamples:true})`. All retained examples/check arguments are harmless public city slugs. The final export scan reported zero secrets and zero warnings. A first metadata validation regex was rejected by `vetShared` for a nested quantifier. It was simplified to `[a-z0-9-]+`; the final operation was verified and exported again. This changed validation metadata only, with no source change.

The final exported spec was installed, without sessions/profile data, into an initially empty absolute home dedicated to `listStops`. Initial directory entries were `[]`, initial cookie count was zero, and the actual tier-1 request had no Cookie header. `city=philadelphia-pa` returned four rows exactly equal to the independently compared unseen result. Direct `vetShared` over the final parsed spec and final notes returned `errors:[]`, `warnings:[]`. Only then was the proven JSON saved to `sites/flixbus.json`.

All receipt paths below are relative to ignored `bench/explore/state/discovery/intercity-film-r2/`:

- Capture files: `flixbus/home/captures/<capture ID>.json`.
- Learning: `flixbus/learn.0.stdout`; captured example contrast: `flixbus/captured-examples.json`.
- Unseen replay: `flixbus/unseen.json`; independent source comparison: `flixbus/comparison.json`; comparison code: `compare.py`.
- Final verify: `flixbus/verify.json`, `flixbus/verify-final.0.stdout`, and `flixbus/home/checks/flixbus.json`.
- Final export: `flixbus/exported.json`, `flixbus/export.json`, `flixbus/export-vet.json` and `flixbus/export-final.0.stdout`.
- Final fresh reuse: `flixbus/fresh.json`, `flixbus/fresh-final.0.stdout`; `flixbus/network.jsonl` records statuses and Cookie-header presence only, without cookie values.
- Final direct vet: `flixbus/vet.json`, `flixbus/vet.0.stdout`.
- Initial metadata-version receipts are explicitly retained under `flixbus/initial-*`; they are not the final proof.

The absolute learning home is `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/intercity-film-r2/flixbus/home`. The final fresh home is its sibling `fresh-final-home-listStops`. Its previous metadata-version reuse used the separate sibling `fresh-home-listStops`. No unrelated home was read or modified.

## Letterboxd BLOCKED

After one resource denial and a 30-second wait, the first admitted signed-out GET of the supplied root `https://www.letterboxd.com/` completed at `2026-10-26T11:06:34.104Z`. It returned HTTP 403, title `Just a moment...`, 5,462 response bytes. Repository `botWall` classified it as `Cloudflare challenge (cf-mitigated)`.

The domain was stopped immediately. There was no replay, browser attempt, alternate host/route, challenge interaction or film-page request. No film input, metadata recipe or operation was qualified. No users, reviews or account data were requested. `letterboxd/root.json`, `letterboxd/root.html` and `letterboxd/root-scout.1.stdout` retain the actual HTTP reconnaissance evidence. This is not a frontend capture. Its absolute isolated home, the batch's `letterboxd/home`, remained empty.

## Resources and cleanup

Every network/browser command ran under `resource_gate.py`. Letterboxd HTTP scouting used normal memory admission below 88%. The understood FlixBus document helper and bounded browser-free tier-1 qualification used admission below 89%. Every command retained CPU admission below 65%, CPU stop at 85%, and memory stop at 90%. Each browser run acquired `browser.lock` with atomic mkdir and a unique owner token; the wrapper released only its owned lock after the command exited.

Admission was denied once for Letterboxd scouting, once for the unseen FlixBus replay and twice for the independent Philadelphia capture. Each denial was followed by 30 seconds without website requests before resampling. No command exceeded three resamples. No watchdog stop or repeated site error occurred. FlixBus remained public 200 throughout; Letterboxd's first control ended its work.

Across 25 samples, peak CPU was 53.76% and peak policy memory, occupied memory excluding file-backed cache, was 89.43%. Raw occupied RAM, separately including file cache, peaked at 99.71%. These are sampled system metrics, not a guarantee against between-sample spikes or unrelated workloads. `resources-summary.json` lists every command's admission and peak; individual `*.resources.jsonl` files retain timestamps.

Final census at `2026-10-26T11:12:10.510878Z` found no owned browser processes and no global browser mutex. All owned commands had exited. No unrelated process was stopped. `cleanup.json` records the census; raw ignored evidence and isolated homes remain for parent review. Saved deliverables are only the proven FlixBus JSON/notes and this report. Integrated checks remain the parent's responsibility.
