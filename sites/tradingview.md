# TradingView instrument metadata

Use the exchange-prefixed path identifier shown in a TradingView overview URL, such as NASDAQ-AAPL. Validated on NASDAQ-listed common stocks only. The returned instrument uses a colon, such as NASDAQ:AAPL. No account is needed.

Currency describes the instrument's quoted currency, not a returned price. timeZone is instrument metadata, not a retrieval or trade timestamp. The operation returns no prices, recommendations or articles. ISIN can be absent for instruments outside the validated stock examples. Data comes from the overview document, without a fully hydrated GUI.

## Maintainer notes

2026-10-26 UTC, signed out in a fresh isolated profile, without browser-cookie import. Actual exact-GET frontend document captures: cmvpbihy1269444 for NASDAQ-AAPL and cmvpbjtvu19de74 for NASDAQ-MSFT, request 1 in both. Other requests were aborted by the experimental capture-document helper; inline scripts may execute. These are document captures, not full GUI verification.

The source is https://www.tradingview.com/symbols/{instrument}/ and the instrument-scoped window.initData.symbolInfo JSON assignment. Source navigation grounded NASDAQ-MSFT and held-out NASDAQ-NVDA. Independent third-input comparison uses NVIDIA's visible h1, quote-header symbol and separate FinancialProduct JSON-LD ticker, ISIN and currency, rather than reading symbolInfo again. Official widget data FAQ says TradingView has no data API; no brokerage integration was used.

Exact exported bytes, initially empty-home tier-1 reuse and verifySite with maxTier 1, control audits and vetShared results are recorded in docs/research/discovery/finance-qualification-r4.md and its ignored evidence directory. Only AAPL, MSFT and NVDA were checked. No price, session-status or live-market guarantee is made.
