# Finance qualification r4

2026-10-26 UTC, approximately 13:50-14:07. PASS for two narrow public metadata operations.
No price operation was qualified. Only TradingView and Nasdaq were researched. Existing dirty
work and all excluded domains were preserved. No source, dependency, coordinator state,
catalog, runbook, commit, PR or publication changes were made. No private-cookie imports,
logins, account actions, trading, portfolio/watchlist changes or article extraction occurred.

## Saved operations

- `tradingview.getInstrument(instrument)` returns the instrument's exchange-qualified identity,
  symbol, company name, exchange, instrument type, currency, ISIN and instrument time zone.
  Input is the exact overview path identifier, such as `NASDAQ-AAPL`; output instrument uses
  the colon spelling `NASDAQ:AAPL`. Currency and time zone are instrument metadata, not a
  price or a trade timestamp. Learning examples were `NASDAQ-AAPL` and `NASDAQ-MSFT`.
- `nasdaq.getStockInfo(symbol)` returns symbol, security name, stock type, Nasdaq's listing
  exchange label and asset class. Learning examples were `AAPL` and `MSFT`. Only simple
  uppercase stock symbols are admitted by this spec. No listing universe enumeration is claimed.

Both held out `NVDA` for their first tier-1 replay. Final checks cover AAPL, MSFT and NVDA.
No prices, recommendations or articles are returned. Nasdaq's response had a null currency
field despite dollar-prefixed prices; these prices were omitted. Its market-status and
last-trade-time fields were also removed from the final export because their GUI meaning
was not independently established in this batch. TradingView's document quote nodes remained
placeholders; its separate metadata assignment was populated and instrument-scoped.

## Official access screen and source chain

Read `finance.md`, including r3, and `finance-broad-source-prep-r4.md` before requests.
Nasdaq's prior primary-source screen established Basic as a licensed/contact-trial product,
not a readily usable anonymous replacement. No licensed endpoint, trial or credential was used.

TradingView's previously sourced Apple document linked to its Symbol Overview widget docs.
The actual Data FAQ link, including its ordinary slash redirect, led to
`https://www.tradingview.com/widget-docs/faq/data/`. Its visible answer says it has no API
giving access to data and distinguishes brokerage integration. It also says widgets cannot
export/download data. The qualified operation reads ordinary public instrument metadata;
no widget feed, brokerage integration or exchange entitlement was invoked.

The old TradingView Apple source's real navigation named Microsoft and NVIDIA overview URLs.
Fresh browser document captures used those actual Apple/Microsoft URLs. Nasdaq's sourced Apple
summary and Market Activity hub linked to `/market-activity/stocks/screener`. Its actual
frontend response supplied `/market-activity/stocks/msft` and `/market-activity/stocks/nvda`.
No internal route, symbol or quote schema was guessed.

## Frontend captures

All evidence is below the ignored absolute directory
`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/finance-qualification-r4/`.
The capture home is that directory's `home/`, with no imported session.

- TradingView Apple: `cmvpbihy1269444`, document request 1,
  `https://www.tradingview.com/symbols/NASDAQ-AAPL/`.
- TradingView Microsoft: `cmvpbjtvu19de74`, document request 1,
  `https://www.tradingview.com/symbols/NASDAQ-MSFT/`.
- Nasdaq Apple: `cmvpbhbik`, selected info request 172,
  `https://www.nasdaq.com/market-activity/stocks/aapl`.
- Nasdaq Microsoft: `cmvpbko7q`, corresponding info request 166,
  `https://www.nasdaq.com/market-activity/stocks/msft`.
- Nasdaq screener grounding: `cmvpbjdfj`, request 138,
  `https://www.nasdaq.com/market-activity/stocks/screener`.

TradingView used the reviewed experimental `capture-document.mjs`, permitting only the exact
GET document and aborting 281/282 other requests. This is real frontend document traffic,
not a fully hydrated GUI. Redirects are unsupported by that helper. The understood recipe
reads `window.initData.symbolInfo`, not broad price strings or another instrument's data.

Nasdaq used source-CLI frontend captures. The observed GET was
`https://api.nasdaq.com/api/quote/{symbol}/info?assetclass=stocks`, with response identity at
`data.symbol`. No capture was synthesized from an HTTP scout. The public document alone had
unavailable-data placeholders, while actual frontend responses were populated. No assertion
is made that all rendered GUI elements were inspected. Lowercase source summary URLs were
captured; uppercase-symbol trigger spelling and automatic healing remain untested.

Every returned capture body was audited before a subsequent request on that site. The three
Nasdaq audits covered 280, 262 and 216 responses; each found zero control responses. The two
TradingView audits covered their one returned document each and found zero controls. Scout
bodies were audited immediately as well. No auth/challenge/403/429/robots boundary occurred.
Audits are `*-audit.json`; raw exchanges remain in `home/captures/<capture-id>.json`.

## Held-out meaning and final proof

TradingView's separate anonymous NVIDIA document established visible `NVIDIA Corporation`,
the quote-header `NASDAQ:NVDA`, and a separate FinancialProduct JSON-LD ticker, Stock category,
ISIN `US67066G1040` and USD currency. These independently matched the held-out operation result.
The independent extractor does not reread `symbolInfo`. Evidence is
`tradingview-nvda-independent.*`, `tradingview-nvda-independent-product.json` and
`tradingview-unseen-comparison.json`.

Nasdaq's separate screener row established `NVDA`, `NVIDIA Corporation Common Stock`, its
stock-summary URL and common-stock meaning. TradingView's independently read NVIDIA document
corroborated the company and parent NASDAQ exchange. `NASDAQ-GS` is retained as Nasdaq's own
listing label, not as an independently measured trade venue. The comparison is
`nasdaq-unseen-comparison.json`. A separate Nasdaq NVIDIA document scout was admission-denied
before launch and supplied no evidence.

Final exports kept public examples. Each exact export was installed in its own initially
empty home, replayed with held-out NVDA at maxTier 1, then passed `verifySite` at maxTier 1
for the example and both checks. No browser ran in these final proof commands. All network
responses were control-audited through `fetchImpl`; a detected control would stop further
requests. Each exported JSON remained byte-identical throughout verification.

- TradingView JSON SHA-256:
  `880cd3d961a60aaa0445426caa957e3a04b4170b41ca15011a78f11061607d95`.
  Fresh home `fresh-tradingview-getInstrument/`; four tier-1 requests, all cookie-free.
  Receipt `tradingview-qualification.json`, final cases `tradingview-final-verify.json`,
  current-version check record `fresh-tradingview-getInstrument/checks/tradingview.json`.
- Nasdaq final JSON SHA-256:
  `0e293d37ae685eaee291f7a1b95c2dbc11b0665cf0ce1ca4e7dd4df4eedea2cc`.
  Fresh home `fresh-nasdaq-getStockInfo-r3/`; initial held-out request sent no cookie or
  authorization. Nasdaq issued anonymous visitor cookies, reused in the three ordinary
  verification requests. No browser/captured cookie was installed in this home.
  Receipt `nasdaq-qualification.json`, final cases `nasdaq-final-verify.json`,
  current-version check record `fresh-nasdaq-getStockInfo-r3/checks/nasdaq.json`.

Both exact final JSON-plus-notes pairs passed direct `vetShared` with zero errors and zero
warnings. Export secret scans and export warnings were empty. The saved `sites/` bytes were
compared to these qualified export hashes and their vetted notes before handoff. Parent owns
integrated registry/type/lint checks; this worker did not rerun the shared suite.

An initial Nasdaq harness incorrectly demanded no cookies on every request. Its first
cookie-free held-out call succeeded, then the harness refused three local verification
attempts before network because the site had set visitor cookies. This was an instrumentation
failure, not a site control. Files suffixed `.initial-cookie-guard` preserve it. A subsequent
successful broader-context export is preserved as `.prior-context-scope`; it is not the final
qualified version. Final proof above applies to the narrower metadata-only export.

## Resources and cleanup

Each expensive/network/browser command had its own resource gate. Unknown sources and full
captures used default CPU 65/85 and memory 88/90 admission/stop limits. Only understood exact
TradingView document captures and bounded browser-free commands used the permitted 89/90
memory exception. Every browser command held the atomic global mutex with a unique owned
token, released after its command exited. No mutex was stolen or unrelated process stopped.

Across saved samples, CPU peaked at 62.77%. Policy memory peaked at 89.02% during admitted
commands. Denied host snapshots reached 90.46%; those commands did not launch. Raw occupied
RAM, which includes file-backed cache, peaked at 99.92%. Thus there is no claim that raw
occupied RAM stayed below 95%, or that sampling excludes every transient spike.

The denied separate Nasdaq NVIDIA source scout was not retried. Offline preparation followed,
with no website request until more than 30 seconds after that denial. Later finalization
denials were followed by an explicit 30-second no-request wait and successful resample.
The last final verification denial was followed by another explicit 30-second wait, then
one successful retry. No domain transport/host/route was switched to evade a refusal.

Resource receipts are `*.gate.log*` and `resource-summary.json`. No watchdog termination
occurred. Final process inspection found zero surviving owned browser/capture processes;
the browser mutex was absent. `cleanup.json` records that inspection. Isolated homes and raw
evidence were retained for parent audit. Saved deliverables are only `sites/tradingview.json`,
`sites/tradingview.md`, `sites/nasdaq.json`, `sites/nasdaq.md` and this report.
