# Retail and weather discovery, round 1

Status: **ISSUES**. One verified operation saved for IKEA. Weather.com and AccuWeather
remain incomplete leads. Research ran on 2026-10-26 UTC, from 09:42 through 09:56, in the assigned
order IKEA, Weather.com, AccuWeather. No nested agents were launched.

## Saved operation

| Site | Operation | Inputs | Evidence | Files |
| --- | --- | --- | --- | --- |
| IKEA US | `getProduct` | Complete source-linked product `slug` | Two differing real frontend document captures, unseen third-input tier-1 identity comparison, four passing verification cases, fresh-home cookie-free tier-1 replay, clean export and direct shared vet | `sites/ikea.json`, `sites/ikea.md` |

The region is fixed to US, English, with USD prices and no store or ZIP selected. Dimensions
retain the page's own units. This operation makes no claim about store inventory, delivery,
local pricing or checkout. Product search remains a lead because its initial HTML had no
product rows. No other IKEA operation was exported.

`https://www.ikea.com/us/en/` supplied both the search form action and every product link.
Search research used its GET form at `https://www.ikea.com/us/en/search/?q=chair`.
The source/request URLs for the saved operation were:

- `https://www.ikea.com/us/en/p/konstrunda-stool-pine-80623716/`
- `https://www.ikea.com/us/en/p/lindakra-sleeper-sofa-vissle-light-gray-green-60629272/`
- `https://www.ikea.com/us/en/p/foerlig-led-floor-wall-lamp-white-adjustable-color-80601291/`

The existing `bench/discovery/capture-document.mjs` harness made the real browser captures.
It allowed only the requested GET document, preserved its exchange and aborted other
requests. Captures were serialized under the global browser mutex. The CLI learned from
the first two captures with `--from`, `--from2`, `--pick-request 1`, the document matcher
`method=GET host=www.ikea.com path=/us/en/p/*/`, and an embedded recipe for the
`pip-range-json-ld` Product script. It saved `getProduct` with `minTier: 1` and no warnings.

| Case | Exact slug | Capture or replay receipt | Outcome |
| --- | --- | --- | --- |
| First frontend example | `konstrunda-stool-pine-80623716` | `cmvp2kj1134dd51`, 365 exchanges, 364 aborted | HTTP 200, article `806.237.16` |
| Second frontend example | `lindakra-sleeper-sofa-vissle-light-gray-green-60629272` | `cmvp2kxh2027309`, 357 exchanges, 356 aborted | HTTP 200, distinct article `606.292.72` |
| Unseen third input | `foerlig-led-floor-wall-lamp-white-adjustable-color-80601291` | `ikea-third-tier1.log`, 1983 ms, tier 1 | Article `806.012.91`; every returned field equals the third frontend document |
| Third frontend comparison | Same lamp slug | `cmvp2lwkk6846b1`, 336 exchanges, 335 aborted | HTTP 200; visible heading, article, $24.99 price and 52-inch size agree |
| Fresh-home reuse | Same lamp slug, exported bundled spec | `ikea-fresh-tier1.log`, 552 ms, tier 1 | Every returned field equals the frontend document; no captured cookies/profile/session copied |

The fresh home was created empty immediately before its call. The exported request has
no Cookie header or credential slots. CLI export used `--keep-examples` and returned zero
warnings. Only public product examples and format-check arguments were kept.

The existing `verifySite` harness ran with `maxTier: 1`. All four cases passed, with no
failed or inconclusive cases: stool example 980 ms, sofa result check 724 ms, lamp result
check 937 ms, and `slug=invalid/path` refused locally as input in 0 ms. The format check
sent no request and makes no claim about a site's no-results response. The positive checks
use different source-linked products and article numbers. Third-input meaning was checked
against its frontend, beyond the harness's result/nonempty check.

Direct `vetShared(parseSite(export), notes)` returned `errors: []`, `warnings: []`.
The coordinator owns integrated registry, type and lint checks; this worker did not duplicate
them. Publication remains subject to separate user approval. No publication command ran.

## Weather.com

HTTP research at `https://weather.com/` returned 200 without a challenge marker. The HTML
had a button labelled `Search for a location`, no search input, no selected location and
forecast links with an empty location suffix. No location identifier was invented.

A source-CLI scout attempted only to open that search button and wait 1000 ms:

```sh
node --import tsx src/cli.ts capture https://weather.com/ \
  --steps '[{"action":"click","selector":"button[aria-label=\"Search for a location\"]"},{"action":"wait","ms":1000}]' \
  --outline
```

It ran under the default resource gate and the global browser mutex. At
2026-10-26T09:47:55.706930Z, the watchdog sampled CPU 92.04% and memory 89.58%, stopped
its owned process group and returned 75. No completed capture or operation was saved.
The worker waited 30 seconds before further resource admission. The full-page browser
scout was not repeated. Subsequent browser-free source research passed admission.

Two bounded sequential batches read 24 script URLs already linked by that homepage,
with a one-second interval and no endpoint probing. They all returned 200. Useful leads:

- `https://weather.com/_next/static/immutable/chunks/1nqybqcb95jxg.js` defines GET URL
  configuration for `https://api.weather.com/v3/location/search` and
  `https://api.weather.com/v3/location/point`.
- `https://weather.com/_next/static/immutable/chunks/2eci6bf1zjkq-.js` maps location
  search results to city, country, coordinates, place ID and IANA time zone.
- `https://weather.com/_next/static/immutable/chunks/18kp7qwirhpa0.js` includes current
  observation request configuration with units and language arguments.

These are source-code leads, not frontend captures or verified operations. The scripts
carry a shared application key; its literal is not included here and was not used to probe
the API. No location response, forecast period, issue time, units or third-input replay was
verified. No Weather.com spec or caller notes were saved. A future attempt needs a cheaper
frontend capture with verified location/time/unit semantics and the full reuse gate.

## AccuWeather

`https://www.accuweather.com/` returned HTTP 200 and supplied a GET form with action
`/en/search-locations` and input `query`. Research therefore used
`https://www.accuweather.com/en/search-locations?query=London`, which also returned 200.
Its source contains ten public location rows under `.locations-list`, with names, region
text and source-linked `/web-api/three-day-redirect` URLs. This was HTTP research only.

The first London source link supplied a GB locality and coordinates. Following that exact
link returned a 302 Location, then a second canonicalizing 302, finally:

`https://www.accuweather.com/en/gb/london/ec4a-2/weather-forecast/328328?type=locality`

The final document returned HTTP 200 and identified London, London, United Kingdom.
Location ID `328328` and every route in this chain came from the source link or its actual
Location headers. No account, API key, location cookie or location ID was guessed or imported.

Both search results and the forecast markup were inside
`<div class="template-root" style="display:none">`. The existing `parseShown` removes that
container, so its HTML recipe cannot extract those source rows. The forecast document had
no JSON-LD forecast recipe. No core change, hidden-markup workaround or fabricated exchange
was made. Frontend rendering, forecast time/units, two-example learning and a third-input
replay remain unverified. No AccuWeather browser capture, spec or caller notes were saved.

## Receipts, resources and cleanup

All raw research, captures and command output are ignored under
`bench/explore/state/discovery/retail-weather-r1/`. Separate homes were used for each domain:
`ikea-home`, `weather-com-home`, `accuweather-home`, plus `ikea-fresh-home` for exported reuse.
There was no personal browser import, login, purchase, content submission or other intentional
site write. No auth, 403, challenge or 429 was observed in the completed HTTP reads or IKEA
captures. The interrupted Weather.com browser run has no completed traffic record, so its
network outcome is unknown.

Key exact receipts in that directory:

- `ikea-capture-stool.log`, `ikea-capture-sofa.log`, `ikea-capture-lamp.log` and the three
  unchanged capture files under `ikea-home/captures/`.
- `ikea-add-detail.log`, `ikea-third-tier1.log`, `ikea-identity-receipt.json`,
  `ikea-verify.log`, `ikea-home/checks/ikea.json`, `ikea-export.log`,
  `ikea-fresh-tier1.log`, `ikea-vet.log`.
- `weather-homepage.json`, `weather-scout.log`, `weather-scout.resources.jsonl`,
  `weather-bundles.log`, `weather-bundles-2.log`.
- `accuweather-homepage.json`, `accuweather-search-london.json`,
  `accuweather-london-redirect.json`, `accuweather-london-forecast.json`,
  `accuweather-london-canonical.json`. The intermediate file named `forecast` records
  the second 302, while `canonical` records the final HTTP 200 document.
- A local helper-path setup error sent no site request, was corrected, and is retained in
  `accuweather-link-setup-error.resources.jsonl`.

Every browser or network command ran under `resource_gate.py`. Browser commands used the
default admission CPU 65%/memory 88%, stop CPU 85%/memory 90%; browser-free commands used
the allowed memory admission 89%/stop 90%, with the default CPU limits. The 65 recorded
samples in `resource-summary.json` peaked at CPU 92.04% and policy memory 89.58%, both on
the stopped Weather.com scout. There were no admission denials. Sampling can overshoot the
85% stop threshold; it does not establish that every instantaneous CPU value stayed below
95%. Raw occupied RAM peaked at 99.70%, including file-backed cache; the policy memory
metric excludes that cache as specified by the runbook.

All owned browser commands exited before their mutex was released. `owned-cleanup.json`
records the final ownership checks. Those checks
found no process using this worker's browser profiles and no worker-owned browser mutex.
Other workers' processes and locks were left alone. Raw evidence was retained for the
coordinator. Shared state, runbook, catalog, source, dependencies and other sites were not
changed. No commits, pushes, PRs or publication occurred.
