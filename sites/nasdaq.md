# Nasdaq stock listing information

Use the stock symbol shown on Nasdaq, in uppercase, such as AAPL. Only simple NASDAQ-listed common-stock symbols AAPL, MSFT and NVDA were validated. No account is needed.

exchange is Nasdaq's listing label, such as NASDAQ-GS. It does not identify the venue of a particular trade. Prices are omitted because the captured quote currency field was null. Market-session and trade-time fields are omitted because this batch did not independently verify their GUI meaning. No articles, recommendations, accounts or watchlist actions are returned.

## Maintainer notes

2026-10-26 UTC, fresh signed-out browser profile, no private-cookie import or login. Real source-CLI captures: cmvpbhbik for the Apple summary, selected request 172; cmvpbko7q for the Microsoft summary, corresponding info request 166. Frontend GET https://api.nasdaq.com/api/quote/{symbol}/info?assetclass=stocks supplies data scoped to data.symbol. This was observed traffic, not an inferred endpoint. The trigger is the stock summary page. Lowercase source summary URLs were captured; the uppercase-symbol trigger spelling and automatic healing were not exercised.

The actual Symbol Screener link from the public summary/hub grounded its frontend capture cmvpbjdfj. Request 138 supplied the Microsoft and held-out NVIDIA summary URLs. Independent NVDA identity comparison uses that screener's separate row plus TradingView's public NVIDIA instrument document, not a second read of the info response. The attempted separate Nasdaq NVIDIA source-document GET was resource-denied before launch. The root docs previously established Nasdaq Basic as a licensed/contact-trial product; no licensed feed, credential or trial was requested.

The first held-out replay used an initially empty home and sent no cookies. Nasdaq then issued anonymous visitor cookies that normal verifySite calls reused. No captured/imported browser cookies were installed in that home. An earlier strict harness rejected these subsequent cookies locally before network; that run was preserved and corrected. Exact exported bytes, final verifySite with maxTier 1, control audits and vetShared results are recorded in docs/research/discovery/finance-qualification-r4.md and its ignored evidence directory. The document alone had unavailable quote placeholders. Full source-CLI capture observed actual frontend traffic, but no claim is made that every visual GUI element was checked.
