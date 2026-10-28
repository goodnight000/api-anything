# Shopping and travel discovery

Worker: `shopping-travel`. Batch date: 2026-10-26 UTC.

Status: **deferred at resource admission**. No discovery request, browser capture,
learning, replay, verification, vetting, or export ran in this batch. No site spec
or caller notes were created. Site accessibility remains unknown.

## Resource evidence

Command: `python3 bench/discovery/resource_gate.py`

Exit status: `75`. Exact emitted sample:

```json
{"at": "2026-10-26T09:08:29.039414+00:00", "cpu_percent": 26.79, "memory_percent": 87.81, "raw_occupied_percent": 99.66, "file_cache_gib": 2.13, "total_gib": 18.0, "admitted": false}
```

The current runbook requires CPU below 65% and non-cache memory below 85%.
Memory failed admission. The worker did not retry the gate or start expensive
work. No browser lock was acquired, browser profile opened, or everyday browser
session imported. No local CLI operation was created, so an isolated
`API_ANYTHING_HOME` was not used.

## Assigned sites and remaining work

| Priority | Site | Evidence and status | Remaining lead |
|---|---|---|---|
| 1 | Costco, `costco.com` | Unattempted by this worker. Parent reports one HTTP 200 homepage at 08:49 UTC, capped at 2 MiB, with a genuine title. Its file exists at `bench/explore/state/discovery/coordinator-food/costco.html`; this worker did not inspect its contents or independently validate the response. A generic CAPTCHA string alone did not establish an active wall. | Public product search, suggestions, and detail remain untested. Derive detail IDs from frontend results. |
| 2 | Skyscanner, `skyscanner.com` | Unattempted. No HTTP or frontend capture evidence. | Inspect public destination or airport suggestions and public travel search/detail, if signed-out access permits. |
| 3 | Trip.com, `trip.com` | Unattempted. No HTTP or frontend capture evidence. | Inspect public destination/hotel suggestions and detail. Derive IDs from frontend results. |
| 4 | Agoda, `agoda.com` | Unattempted. No HTTP or frontend capture evidence. | Inspect public destination/hotel suggestions and detail. Derive IDs from frontend results. |

These are research leads, not endpoint templates or reusable operations. No
request URLs, arguments, response identities, transport tiers, or signed-out
access claims were established for them in this batch. No official API was
counted as reverse-engineered value.

## Handoff

Keep all four sites pending for a later admitted batch, in the order above.
Before expensive work, run the current resource gate once; exit 75 means defer.
Wrap owned expensive commands with its watchdog. Use
`API_ANYTHING_HOME=bench/explore/state/discovery/shopping-travel/home` and acquire
the shared browser mutex with atomic `mkdir` before any browser capture,
releasing only the lock acquired by this worker.

The acceptance work remains the full source-CLI capture/add/call/verify/export
workflow, preferably with two differing public examples and an unseen tier-1
input whose result identity and meaning are checked. Only captured, replayed,
verified and `vetShared`-accepted operations belong in `sites/`.

Do not revisit Booking, Expedia, Tripadvisor, or Yelp, which the parent marked
blocked. Steam remains parent-owned. No site writes, core/dependency edits,
coordinator-state changes, commits, pushes, or publication occurred here.

## R2 continuation, 2026-10-26 UTC

Worker: `shopping-travel-r2`. Status: **deferred after the initial admission
denial and all three permitted retries**. This section supersedes the older
handoff's single-sample retry policy. All four sites remain uncaptured and
unattempted over the network by this worker. No reusable operation was produced.

Read the current `bench/discovery/README.md`, `docs/DESIGN.md`, `CONTRIBUTING.md`
and `skills/api-anything/SKILL.md`. The current runbook admits expensive commands
only below 65% CPU and 85% non-cache memory. Each command below was
`python3 bench/discovery/resource_gate.py`, with exit status `75`.

| Sample UTC | CPU % | Non-cache memory % | Raw occupied % | File cache GiB | Result |
|---|---:|---:|---:|---:|---|
| 09:14:10.761031 | 19.79 | 89.12 | 99.69 | 1.90 | Initial denial |
| 09:15:06.225794 | 11.43 | 88.29 | 99.69 | 2.05 | Retry 1 denied |
| 09:15:58.144379 | 8.30 | 87.09 | 99.65 | 2.26 | Retry 2 denied |
| 09:16:38.933503 | 22.41 | 87.35 | 99.28 | 2.15 | Retry 3 denied |

Each retry followed an explicit 30-second wait. No website requests or browser
commands ran during the waits or elsewhere in this batch. CPU passed every
sample; memory failed every sample. All samples report 18 GiB total RAM.
Exact JSON samples are retained in the ignored worker directory at
`bench/explore/state/discovery/shopping-travel-r2/resource-admission.jsonl`.

### Cached Costco source assessment

Inspected only the parent-owned local file
`bench/explore/state/discovery/coordinator-food/costco.html`, without changing
it or fetching anything. It is exactly 2,097,152 bytes, consistent with the
parent's stated 2 MiB cap. Its title is `Welcome to Costco Wholesale`.
The source includes forms, including `FindAWarehouseForm-all-find_a_warehouse`,
and three case-insensitive `captcha` mentions. These strings do not prove a
visible challenge, and a title does not prove accessible product search.
No frontend was opened, no product identity or suggestion was verified, and
no operation or endpoint was inferred from this partial document. The parent's
reported HTTP 200 remains reused parent evidence, not a fresh response.

### R2 coverage and handoff

| Site | R2 evidence | Remaining work |
|---|---|---|
| Costco, `costco.com` | Local inspection of the capped parent source only. Signed-out frontend access, product search and suggestions remain unknown. | Start with the actual frontend and stop on a visible control. Derive product IDs from results. |
| Skyscanner, `skyscanner.com` | No HTTP request or frontend capture. Accessibility unknown. | Public destination/airport suggestions or search, if signed-out access permits. |
| Trip.com, `trip.com` | No HTTP request or frontend capture. Accessibility unknown. | Public destination/hotel suggestions or detail, with IDs from results. |
| Agoda, `agoda.com` | No HTTP request or frontend capture. Accessibility unknown. | Public destination/hotel suggestions or detail, with IDs from results. |

`node_modules` was present when checked, but no source CLI command ran after
resource admission failed. The isolated home directory is reserved at
`bench/explore/state/discovery/shopping-travel-r2/home`; no session was imported
or created. The browser mutex was never acquired or released.

No capture, add, replay, check, verify, `vetShared`, registry test, or export
ran. There are no replay arguments, response identities or transport tiers to
claim. No `sites/costco.*`, `sites/skyscanner.*`, `sites/trip.*`, or
`sites/agoda.*` files were created by this worker. Official APIs were not
counted as discovery value. No site writes, subdelegation, source/dependency
edits, coordinator-state edits, commits, pushes or publication occurred.

Return all four leads to the coordinator as resource-deferred, not site-blocked.
A later batch must obtain fresh admission before website work and use the
watchdog for expensive commands. For an understood server-rendered source,
prefer source CLI `add` with a document matcher and two differing examples.
Acceptance still requires real captures, an unseen tier-1 replay whose identity
and meaning are checked, verification, export, and shared vetting. The
coordinator owns the integrated registry/type/lint checks. Booking, Expedia,
Yelp and Tripadvisor were not revisited.

## R3 continuation, 2026-10-26 UTC

Worker: `shopping-travel-r3`. Work ran approximately 09:24 through 09:40 UTC.
This section preserves the earlier rounds as history and supersedes their resource
thresholds and coverage. Current expensive-command admission is CPU below 65%
and non-cache memory below 88%; the watchdog stops owned command groups at 85%
CPU or 90% memory, sampling approximately every two seconds.

Outcome: one reusable public read operation, `trip.listHotels`, saved in
`sites/trip.json` with caller and maintainer notes in `sites/trip.md`.
Costco remains research-only. Skyscanner stopped at a CAPTCHA redirect. Agoda
returned useful frontend suggestions, but the learner refused to serialize a
live session value, so no Agoda spec was saved.

### R3 resource and ownership evidence

The initial gate and two retries emitted these exact values. Both retries
followed an explicit 30-second wait with no website requests or browser commands
while waiting. Admission passed on retry 2; retry 3 was unnecessary.

| Sample UTC | CPU % | Non-cache memory % | Raw occupied % | File cache GiB | Result |
|---|---:|---:|---:|---:|---|
| 09:25:07.097083 | 40.06 | 89.58 | 99.68 | 1.82 | Initial denial, exit 75 |
| 09:26:01.693653 | 47.20 | 88.45 | 99.71 | 2.03 | Retry 1 denied, exit 75 |
| 09:26:43.673957 | 29.20 | 87.18 | 99.26 | 2.18 | Retry 2 admitted, exit 0 |

Exact samples are in `bench/explore/state/discovery/shopping-travel-r3/admission-{0,1,2}.json`.
Every website command ran under the current default `resource_gate.py` watchdog.
Across 83 retained command samples, peak CPU was 70.12% and peak memory 89.03%.
No watched command reached its stop threshold. Memory reaching 88% during an
already admitted command did not authorize another browser launch.

Browser commands acquired `bench/explore/state/discovery/browser.lock` with
atomic `mkdir`, recorded this worker's name and wrapper PID, and released only
that owned directory after command exit. Busy-lock attempts exited 73 without
starting a browser; HTTP research continued instead. Another worker's lock was
present during the final audit and was left alone. No everyday browser profile
or cookies were imported. The new isolated home is
`bench/explore/state/discovery/shopping-travel-r3/home`.
Raw HTML, captures, request bodies, session/profile data and command logs remain
ignored there, with the initial admission and Costco HTTP logs also in the
ignored worker directory. No raw response dump is included in this report.

### Trip.com, accepted public destination hotel list

Operation: `listHotels(destination)` returns hotel names, public detail URLs,
star classifications, guest ratings and review counts from the landing page's
JSON-LD Hotel ItemList. It covers the page's nine structured entries, not the
city's full hotel inventory. No dates, live room availability, prices, booking,
filters or pagination are claimed.

The fresh signed-out homepage request at 09:29:38 UTC returned HTTP 200,
180,225 bytes, with title `Trip.com Official Site‎‎ | Travel Deals and Promotions`.
Actual homepage links supplied all three destination routes below. The Shanghai
HTTP scout at 09:29:51 returned HTTP 200, 3,871,563 bytes, with title
`10 Best Shanghai Hotels, China (from US$33) | Trip.com` and Hotel ItemList data.
These HTTP scouts were research, not fabricated browser captures.

The learned source is the real frontend GET document at
`https://www.trip.com/hotels/{destination}/`, matched narrowly on method GET,
host `www.trip.com` and path `/hotels/*/`. The recipe extracts
`itemListElement[*].item` from the first `application/ld+json` script.
Current pages put the ItemList before FAQPage; this script ordering remains a
maintenance dependency.

| Gate | Exact arguments and evidence | Outcome |
|---|---|---|
| Frontend example 1 | `destination=shanghai-hotels-list-2`, document capture `cmvp23gt5` at 09:30:37.913 UTC. Source/request `https://www.trip.com/hotels/shanghai-hotels-list-2/`. First of nine hotels was Radisson Collection Hyland Shanghai, detail ID 375477. | Real capture; source CLI `add` succeeded. |
| Frontend example 2 | `destination=singapore-hotels-list-73`, document capture `cmvp23soy` at 09:30:53.314 UTC. Source/request `https://www.trip.com/hotels/singapore-hotels-list-73/`. First of nine was Hotel Boss, detail ID 3801236. | Distinct destination and hotel identities; no learning warnings; minTier 1. |
| Unseen replay | `call trip listHotels destination=london-hotels-list-338 --max-tier 1`. Source/request `https://www.trip.com/hotels/london-hotels-list-338/`. | `ok:true`, `class:ok`, tier 1; nine hotels. First Park Grand Heathrow, detail ID 3037865; second Royal National Hotel, detail ID 2985758. |
| Independent frontend identity | London capture `cmvp24vs2`, document request 1. Applied the stored recipe with source CLI `inspect`. | All nine ordered name/URL pairs exactly matched the unseen tier-1 call. |
| Verify | Stored Shanghai example plus explicit London result check. `verify trip` ran 09:32:50 through 09:32:55 UTC. | Two pass, zero fail, zero inconclusive, both tier 1. |
| Export | `export trip --keep-examples --out <owned-home>/research/trip-export.json`. All examples and the London check are public destinations. | Success, zero warnings. |
| Cookie-free reuse | Copied only the exported JSON into `<owned-home>/fresh-reuse/sites/trip.json`. Before the call, that fresh home contained only its `sites` directory. Called the unseen London argument with `--max-tier 1`. | Success at tier 1. All nine ordered name/URL pairs exactly matched the independent frontend capture. No browser profile was created. |
| Shared vetting | `vetShared(parseSite(exported JSON), caller notes)` from current source. | `errors:[]`, `warnings:[]`. Only then copied the export and notes into `sites/trip.*`. |

Receipts under the owned home include `research/trip-list-add.json`,
`trip-london-call.json`, `trip-london-frontend.json`, `trip-verify.json`,
`trip-fresh-call.json`, `trip-identity-check.json`, `trip-vet.json`, and each
command's `.stderr` gate log and `.exit` file. Browser exchanges are the original
`captures/<captureId>.json` files. HTTP 200 alone was not the acceptance gate.

### Costco, real captures but no proven product search operation

At 09:27:36 UTC, a fresh cookie-free HTTP homepage request to
`https://www.costco.com/` returned HTTP 200, 3,220,471 bytes, and title
`Welcome to Costco Wholesale`. It exposed a `Search Costco` input and real
`/s?keyword=...` links. At 09:28:04 UTC, the public URL
`https://www.costco.com/s?keyword=coffee` returned HTTP 200, 2,523,044 bytes,
with title `Search | Costco`. This improves on the earlier capped-source
observation but establishes no product result by itself.

Real signed-out search capture `cmvp213pi` at that URL recorded 214 requests.
Its document was HTTP 200, 2,522,715 bytes, with a `#productList` container but
no product rows. Source CLI inspection of `main` returned category navigation
such as K-cups, Ground Coffee and Whole Bean Coffee. The ranked candidates
carrying the example were analytics identity acknowledgements from
`smetrics.costco.com`; they were not learned as product data.

A final real homepage capture, `cmvp2cbgx`, filled the source-derived selector
`input[placeholder="Search Costco"]` with `coffee` and waited 1,800 ms. It
recorded 258 requests and ended quiet with zero open requests and document
status 200. No search/suggest/typeahead/autocomplete request or request URL
carrying `coffee` appeared. It did capture unrelated homepage product summaries
from `gdx-api.costco.com/catalog/product/product-api/v2/products/summary` and
warehouse data. A coffee string in one of those products' descriptions did not
prove the input affected the request. No product ID or detail URL was invented.

No active challenge, auth wall or rate limit was established on Costco in R3.
No `add`, unseen replay, verify, export or shared vetting was claimed for it.
Product search remains unproven; a second differing search example and product
detail capture remain unattempted. No `sites/costco.*` files were created.

### Skyscanner, stop at an explicit CAPTCHA route

The signed-out HTTP request to `https://www.skyscanner.com/` at 09:29:26 UTC
redirected to `https://www.skyscanner.com/sttc/px/captcha-v2/index.html` with
site-generated query values. The final status was 200, body 708 bytes, title
`Skyscanner`, and a JavaScript app shell. The actual final CAPTCHA route is the
stop evidence; it is stronger than merely finding a CAPTCHA word in unrelated
source. The exact final URL and shell are retained only in the owned ignored
HTTP receipt. No challenge was solved or bypassed, and no further request or
browser capture ran on this domain. Suggestions, search and detail remain
unattempted. No Skyscanner spec was created.

### Agoda, frontend suggestions captured; credential-safe learning refused

The HTTP homepage at 09:29:44 UTC answered 200 with 234,923 bytes but no title,
links or visible document text. It was a JavaScript shell, not proof of a
challenge. Real signed-out frontend capture `cmvp25g9j` completed successfully,
recording 203 requests. Its public top-destination response supplied actual city
IDs and routes, including Kuala Lumpur 14524 at `/city/kuala-lumpur-my.html`.
An HTTP request to that exact route at 09:33:31 returned 200, 87,193 bytes,
also a shell with no title or links. No city detail operation was inferred.

The captured frontend's script, request 56, rendered the hotel search input
with `dataSelenium:"textInput"`. This supplied the selector
`input[data-selenium="textInput"]`; it was not a guessed endpoint.
Two real frontend runs filled that input and waited 1,800 ms:

| Example | Capture and request | Response evidence |
|---|---|---|
| `q=London` | `cmvp29udb`, request 103, GET `/api/cronos/search/GetUnifiedSuggestResult/3/1/1/0/en-us/` with `searchText=London` | HTTP 200 JSON, 13,719 bytes. `ViewModelList` included London, ObjectId 233, SearchType 1, CityId 233, and other distinct place suggestions. |
| `q=Paris` | `cmvp2actf`, request 95, same actual frontend path with `searchText=Paris` | HTTP 200 JSON, 13,638 bytes. The first Paris suggestion had ObjectId 15470. |

The real requests also carried changing guest/session headers and query values.
Learning used the two saved captures, explicit request 103, the source-derived
input trigger, `ViewModelList`, and selected public identity fields. The
source CLI returned `ok:false`, exit 1, with this refusal:

> refusing to learn a request that would keep a credential in the spec: header:x-gate-meta holds the live session value storage:e9addec1881f/message/uid. No name marked public waives one.

That is a credential-preservation gate, not proof of a visible CAPTCHA or an
HTTP auth failure. The raw value is not reproduced here. No header was marked
public, removed to bypass the gate, or copied into a registry spec. No core fix
was attempted. No operation was saved. Unseen tier-1 identity, verify,
cookie-free reuse, export and `vetShared` therefore remain unrun for Agoda.
A future batch needs a source and request the existing learner can keep safe,
or a separately authorized core investigation; repeating this request is not
useful evidence. No `sites/agoda.*` files were created.

### R3 handoff

Artifacts owned by this batch are `sites/trip.json`, `sites/trip.md`, and this
appended R3 report. The coordinator owns integrated registry tests, typecheck
and lint. A direct scoped Biome invocation ignored `sites/trip.json` under the
repository configuration and processed zero files; it is not claimed as a lint
pass. No integrated checks were run by this worker.

Unattempted leads are Costco product detail and a proven second search input;
all Skyscanner data operations after its stop; Trip.com hotel detail and dated
availability; and Agoda's unseen replay and acceptance gates after learning was
refused. These are not reusable operations or endpoint templates.

No nested delegation, core/dependency/coordinator edits, private browser import,
cart/membership/booking action, CAPTCHA/proxy circumvention, commit, publication
or modification of Pinterest, RottenTomatoes, Rightmove or Steam occurred.
Booking, Expedia, Yelp and Tripadvisor were not revisited. Keep Skyscanner
stopped and Agoda's credential refusal in research. Costco remains an unresolved
lead rather than a challenge-blocked domain. Trip.com is ready for the parent's
integrated checks, not a claim of universal availability.
