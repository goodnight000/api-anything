# Finance discovery evidence

Worker: `finance`. UTC batch: 2026-10-26 09:03-09:05. Shared checkout; no source,
dependency, coordinator-state, or other worker files changed. No site writes, account
logins, everyday-browser session imports, commits, pushes, or publication.

## Result

Resource-deferred. Zero reusable operations and zero registry specs saved. Frontend
capture did not complete, so there is no learned operation, unseen-input replay,
identity comparison, verify result, export, or `vetShared` result to report.
TradingView, Investing.com, and MarketWatch were not attempted.

## Yahoo Finance

- Source page: `https://finance.yahoo.com/quote/AAPL/`.
- Coordinator-supplied HTTP scout: HTTP 200 at 2026-10-26 08:58:56 UTC. This is
  reused HTTP evidence, not this worker's browser capture or replay.
- Raw scout file, owned by the coordinator and read without modification:
  `bench/explore/state/discovery/broad-search/yahoo-finance.html`.
- Offline inspection found a real Apple Inc. quote page, an `h1`, the public search
  input `#ybar-sbq`, and server-rendered Svelte fetched-data script elements. Actual
  referenced requests included paths under `query1.finance.yahoo.com` for
  `/v7/finance/quote`, `/v7/finance/spark`, and
  `/v6/finance/recommendationsbysymbol/AAPL`. These are observed source references,
  not captured frontend exchanges or independently callable operations.
- Some source references include a crumb. No crumb or response dump is copied into
  tracked files. Their need for a visitor session and independent replay remains
  unknown.
- One actual source-CLI frontend capture was attempted, with `symbol=AAPL`, an
  isolated fresh worker home, no login import, and the atomic global browser mutex.
  The watchdog terminated it before a capture ID or candidate output was saved.
  Signed-out browsing was intended through a fresh profile, but the final page and
  its signed-out state were not verified.

Command, run under the owned mutex:

```sh
python3 bench/discovery/resource_gate.py -- \
  env API_ANYTHING_HOME="$PWD/bench/explore/state/discovery/finance/home" \
  node --import tsx src/cli.ts capture 'https://finance.yahoo.com/quote/AAPL/' \
  --example symbol=AAPL --outline
```

Local attempt artifacts:

- `bench/explore/state/discovery/finance/yahoo-aapl-capture.json`: empty output.
- `bench/explore/state/discovery/finance/yahoo-aapl-capture.log`: watchdog samples.
- `bench/explore/state/discovery/finance/home/`: isolated browser profile and UA
  cache only; no saved capture or learned spec.

## Resource stop and ownership

Initial gate at 09:03:46 UTC admitted work at 37.63% CPU and 89.16% memory. The
capture gate at 09:04:31 admitted work at 38.17% CPU and 89.95% memory. Its
09:04:53 sample reached 96.3% CPU and 89.46% memory, exceeding the 95% hard CPU
limit. The command exited 75. This is a local resource stop, not evidence of a
Yahoo rate limit, auth wall, bot challenge, or endpoint failure.

The shell released only this worker's acquired mutex after the capture command
exited. A process inspection at 09:05 UTC found no remaining finance-profile or
Yahoo capture command. No heavy work or site retries followed exit 75.

## Remaining leads

On a newly admitted batch, first capture Yahoo's quote document and inspect its
HTML or embedded response recipe. Learn from AAPL and MSFT only after two real
captures, then test GOOG at tier 1 and compare ticker plus company identity before
counting reuse. Symbol autocomplete through the observed public search box is a
separate useful lead. History remains uncaptured. Do not count ordinary access to
a readily usable official API as discovery value.

TradingView, Investing.com, and MarketWatch remain unattempted priorities after
Yahoo. No access-control workarounds were attempted or proposed.

## Continuation: finance-r2, 2026-10-26

UTC batch: 09:14-09:17. Resource-deferred after the initial admission denial and
all three permitted resamples, each following a wait of at least 30 seconds.
The current runbook requires CPU below 65% and non-cache memory below 85% for
expensive work. Every resource-gate invocation denied admission with exit 75.

| UTC sample | CPU | Non-cache memory | Raw occupied RAM | Admitted |
|---|---:|---:|---:|---|
| 09:14:12 | 7.84% | 88.38% | 99.59% | no |
| 09:14:56 | 13.65% | 88.17% | 99.72% | no |
| 09:15:38 | 13.31% | 87.03% | 99.16% | no |
| 09:16:36 | 22.14% | 87.24% | 99.60% | no |

Exact timestamped gate outputs are in the ignored worker directory:

- `bench/explore/state/discovery/finance-r2/gate-initial.log`
- `bench/explore/state/discovery/finance-r2/gate-retry1.log`
- `bench/explore/state/discovery/finance-r2/gate-retry2.log`
- `bench/explore/state/discovery/finance-r2/gate-retry3.log`

Each sample used `python3 bench/discovery/resource_gate.py` with default limits.
No website requests or browser commands ran during this continuation, including
the wait periods. The browser mutex was never acquired. The separate worker home
`bench/explore/state/discovery/finance-r2/home/` was created and remains empty;
the previous worker home was not changed. Dependencies were present when checked,
but no source CLI command was admitted or run.

### Offline Yahoo lead

Read the coordinator's existing AAPL HTML without changing it. Its `h1` reads
`Apple Inc. (AAPL)`. The document contains a primary quote section identified by
`data-testid="price-statistic"`, with descendants identified by
`qsp-price`, `qsp-price-change`, and `qsp-price-change-percent`. These are source
observations, not a tested extraction recipe. The document also carries unrelated
instruments' quote data, so a broad embedded `regularMarketPrice` match is not
evidence that a returned price belongs to the requested symbol.

On a later admitted batch, prefer the current runbook's narrow document-matched
source CLI `add` over full-page scouting. Use two real browser captures for AAPL
and MSFT, then replay unseen NVDA at tier 1 and compare both symbol and company
identity. Scope quote fields to the primary instrument, and independently check
what the page's market-time notice means before describing the price as current.
This batch did not test that workflow or any endpoint.

### Outcome and remaining work

Zero frontend captures, learned operations, unseen-input replays, identity
comparisons, verify results, exports, or `vetShared` results. No site JSON or
caller notes were saved. Signed-out browser status was not verified because no
browser ran. This is a host-capacity deferral, with no new evidence about any
site's auth, rate limits, bot controls, or API accessibility.

Yahoo Finance remains uncaptured. TradingView, Investing.com, and MarketWatch
remain unattempted. The earlier Yahoo CPU stop above is preserved. Only this
report and ignored finance-r2 resource logs were written; no source, dependency,
coordinator state, other worker files, sessions, or registry artifacts changed.

## Continuation: finance-r3, 2026-10-26

UTC batch: 09:24-09:30. Used the current 65% CPU / 88% non-cache memory
admission limits and 85% CPU / 90% memory command stop limits, with roughly
two-second watchdog sampling. Only this report and ignored `finance-r3/`
artifacts were written. Prior finance history and all four frozen ready sites
were preserved. No source, dependencies, coordinator state, private browser
imports, trading/account actions, commits, or publication.

### Yahoo Finance narrow add

Offline inspection reused the coordinator's existing AAPL source at
`bench/explore/state/discovery/broad-search/yahoo-finance.html`. Applying the
source extractor to that file returned one primary instrument, with the identity
`Apple Inc. (AAPL)`, primary price `347.73`, change `-0.49`, percent `(-0.14%)`,
and `At close: October 23 at 4:00:01 PM EDT`. This is reused HTTP source evidence,
not a new frontend capture or a current-price claim. The `.primary` restriction
excludes the separate pre-market section. The price fields do not come from a
broad embedded-data match that could select another instrument.

The planned read operation was `quote(symbol)`, with AAPL/MSFT learning examples
and unseen NVDA reserved for tier-1 identity verification. Its HTML recipe used
`items: main`, `[data-testid="quote-title"] h1` for identity, and descendants of
`[data-testid="price-statistic"].primary` for `qsp-price`, `qsp-price-change`, and
`qsp-price-change-percent`; the full primary section supplied the market notice.
The exact recipe is in ignored `finance-r3/yahoo-recipe.json`.

The actual browser command was source CLI `add`, not a full-page scout:

```sh
python3 bench/discovery/resource_gate.py -- \
  env API_ANYTHING_HOME="$PWD/bench/explore/state/discovery/finance-r3/home" \
  node --import tsx src/cli.ts add yahoo-finance quote \
  --trigger 'https://finance.yahoo.com/quote/{symbol}/' \
  --example symbol=AAPL --example2 symbol=MSFT \
  --match method=GET --match host=finance.yahoo.com --match 'path=/quote/*/' \
  --html '<recipe stored in yahoo-recipe.json>'
```

`yahoo-add-command.json` and `yahoo-add-retry2-command.json` preserve the full
argument arrays, including recipe and description. Each attempt held the atomic
`browser.lock` directory with this worker's owner marker, and released only its
own mutex after the resource-gated command exited.

| UTC sample | CPU | Non-cache memory | Result |
|---|---:|---:|---|
| 09:24:50 | 24.17% | 88.41% | Initial snapshot denied, exit 75; no browser/request |
| 09:25:33 | 17.08% | 84.01% | First post-wait snapshot admitted |
| 09:25:49 | 35.00% | 88.39% | Command admission denied, exit 75; no browser/request |
| 09:26:47 | 50.43% | 87.65% | Second post-wait narrow add admitted and launched |
| 09:27:04 | 90.84% | 89.83% | Watchdog stopped its owned process group, exit 75 |
| 09:28:19 | 15.30% | 81.82% | Final post-wait snapshot admitted; browser mutex busy |

All three post-deferral waits were at least 30 seconds. No website or browser
commands ran during those waits. The final lock attempt exited 73 without
launching a browser or sending a website request; the existing lock was left
untouched. The admitted Yahoo command saved no capture ID, capture file, or
learned spec before the CPU stop. Its stdout file is empty. Its isolated home
contains a fresh generated browser profile and UA cache, not imported credentials.
The page's final signed-out state and whether both example navigations occurred
are unknown. A later process inspection found no surviving CLI or browser process
using this worker home. This is a host-resource interruption, not evidence of a
Yahoo auth wall, rate limit, challenge, or endpoint failure.

### HTTP leads while the browser mutex was busy

The runbook permits HTTP research when another worker holds the browser mutex.
One cookie-free public document GET per remaining domain ran under a resource
gate admitted at 09:28:29 UTC, CPU 25.80%, memory 83.96%. There were no retries,
private sessions, browser automation, or access-control workarounds.

| Site | Exact requested and final URL | UTC | Evidence and disposition |
|---|---|---|---|
| TradingView | `https://www.tradingview.com/symbols/NASDAQ-AAPL/` | 09:28:30 | HTTP 200 HTML, 558943 bytes; title identifies NASDAQ:AAPL, `h1` is `Apple Inc`, quote header names `NASDAQ:AAPL`. Primary price placeholders are empty. HTTP-only lead; no learned operation. |
| Investing.com | `https://www.investing.com/equities/apple-computer-inc` | 09:28:30 | HTTP 403, `text/plain`, three-byte body `403`. Stopped this domain; the response does not establish the mechanism of refusal. |
| MarketWatch | `https://www.marketwatch.com/investing/stock/aapl` | 09:28:30 | HTTP 401 HTML, 777 bytes, title `marketwatch.com`; visible text says `Please enable JS and disable any ad blocker`, with CAPTCHA code. Stopped at the challenge/auth boundary. |

A broad raw-text marker scan found `captcha` and `robot` strings in TradingView's
HTML. Its displayed document contained neither challenge text nor an interstitial;
it showed the Apple instrument, market-closed notice, and public content. Those
script-level marker hits alone do not establish a challenge. The empty
`[data-qa-id="symbol-last-value"]` nodes mean this source inspection did not prove
SSR quote-price extraction. No HTTP 200 was counted as an operation success.

Exact HTTP metadata, raw bodies, and the TradingView offline selector summary are
under the ignored worker home `finance-r3/home/research/`, with filenames
`<site>-http.json`, `<site>.html`, and `tradingview-offline-summary.json`.
`finance-r3/http-leads.jsonl` records the three metadata summaries;
`finance-r3/http-leads.log` records resource admission and the watchdog sample.
Resource-only logs are `gate-initial.log`, `gate-retry1.log`,
`gate-retry3.log`, `yahoo-add.log`, and `yahoo-add-retry2.log`.

### Gates and remaining leads

Zero registry specs or caller notes saved. No completed frontend capture, learned
operation, two-example proof, unseen NVDA tier-1 replay, current-page identity
comparison, verify, cookie-free fresh-home reuse, export, or `vetShared` result.
None of those gates is claimed. The offline AAPL selector check is the only
extraction result and does not substitute for them. Parent integration checks
remain with the coordinator.

All four owned domains received an attempt or a scout. Unattempted work remains
Yahoo's completed AAPL/MSFT capture and unseen NVDA replay; TradingView's first
real frontend capture and any quote-price source investigation; and all replay
and sharing gates. Investing.com and MarketWatch are stopped domains and should
not be retried on the next timer tick. TradingView's public instrument overview
is an uncaptured lead. Yahoo remains a resource-interrupted lead; another browser
batch needs available host capacity and the mutex. No other finance domains were
attempted in this batch.
