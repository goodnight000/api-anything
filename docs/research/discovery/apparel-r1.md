# Apparel discovery r1

Status: ISSUES overall. Nike PASS with two reusable operations. H&M and Zara BLOCKED by access controls; no operations saved for them.

Completed 2026-10-26 UTC. Public reads only, signed out. No browser-cookie import, login, account/cart/order operation, challenge execution, proxy, alternate route after a control, commit, push or publication. Work stayed within the three assigned sites and the 20-minute batch. Shared state, runbooks, other workers' files, source and dependencies were not edited. Parent integration checks remain pending.

## Saved files and operations

- `sites/nike.json`
- `sites/nike.md`
- `listProducts(category)` returns the initial server-rendered category cards.
- `getProduct(slug, style)` returns public product identity, description, selected first variant/colorway and its JSON-LD offer.

Nike context is US English, USD, with no store, ZIP, destination or membership selected. `data-country="us"` appears on the catalog prices. Shipping, tax, member discounts, pickup, size-level stock and delivery eligibility were not established. The checked product offers have no availability field. Catalog coverage is the first 24 server-rendered cards in the checked categories; pagination, scrolling, filters and free-text search are not supported.

The homepage's search input had no HTML action; no search endpoint or request was guessed. Category and product paths below came from actual frontend links. No speculative endpoints or IDs were saved.

## Nike receipts

Ignored evidence base: `bench/explore/state/discovery/apparel-r1/`. The per-site home is `nike-home/`. HTTP research responses were saved as HTTP research, never converted into browser exchanges. Actual browser documents were captured by the repository's `bench/discovery/capture-document.mjs`, which allowed only the requested GET document and aborted other resources. This is document evidence, not a fully hydrated browser page.

Source and request URLs are the same documents:

| Purpose | URL | Browser capture |
| --- | --- | --- |
| Link discovery | https://www.nike.com/ | HTTP research only |
| Category example 1 | https://www.nike.com/w/mens-shoes-nik1zy7ok | `cmvp2qnwl3206ec` |
| Category example 2 | https://www.nike.com/w/womens-shoes-5e1x6zy7ok | `cmvp2qvw8ff1539` |
| Unseen category | https://www.nike.com/w/kids-shoes-v4dhzy7ok | `cmvp2rko50acb27` |
| Final product example 1 | https://www.nike.com/t/jordan-spizike-low-mens-shoes-E3tPjSZP/FQ1759-200 | `cmvp2s99ube452b` |
| Final product example 2 | https://www.nike.com/t/air-max-metro-mens-shoes-bWvVBEWx/IW4935-102 | `cmvp2zbbz2ac966` |
| Final unseen product | https://www.nike.com/t/dunk-low-retro-mens-shoes-5FQWGR/IM4414-700 | `cmvp2zpzh26a775` |

`nike-add-list.log` and `nike-add-product-final.log` show CLI learning from two actual captures per operation, minTier 1, and zero warnings. The matchers are GET `www.nike.com/w/*` and GET `www.nike.com/t/*/*`. Category extraction uses visible product-card markup; details use schema.org ProductGroup JSON-LD.

`nike-list-comparison.json` proves the unseen kids input returned tier 1 and matched all 24/24 frontend cards on name, subtitle, price and URL. Exact args are `category=kids-shoes-v4dhzy7ok`.

`nike-product-comparison-semantic.json` checks the final unseen args `slug=dunk-low-retro-mens-shoes-5FQWGR style=IM4414-700`. All seven extracted fields match its captured JSON-LD. The selected style is present in the frontend colorway picker and group ID is `5FQWGR`. USD 130 matches the men's catalog card. A literal heading comparison initially failed: JSON-LD calls it "Nike Dunk Low Retro SE Men's Shoes", while the heading and catalog omit "SE". That discrepancy is retained in the comparison receipts and caller notes. Identity is supported by the group and style, rather than silently treating the names as identical.

`nike-verify-final.log` records the real `verifySite('nike', {maxTier: 1})` runner, six passing cases, all tier 1, zero failed/inconclusive cases:

- `listProducts` example `mens-shoes-nik1zy7ok`, checks `womens-shoes-5e1x6zy7ok` and `kids-shoes-v4dhzy7ok`.
- `getProduct` example `jordan-spizike-low-mens-shoes-E3tPjSZP` / `FQ1759-200`, checks `air-max-metro-mens-shoes-bWvVBEWx` / `IW4935-102` and `dunk-low-retro-mens-shoes-5FQWGR` / `IM4414-700`.

No empty or invalid-product semantics were established, so no synthetic empty/input checks were invented.

`nike-export-final.log` records CLI export with `--keep-examples`, zero warnings. `nike-vet-final.log` is direct `vetShared` over the parsed exported spec plus caller/maintainer notes: `errors: []`, `warnings: []`.

`nike-fresh-reuse-final.json` records a separate initially empty home for each exported operation, no session files/cookies before either call, maxTier 1, and data identical to its unseen replay. These calls used the exported bundled file, with no capture or browser login. Homes are `nike-reuse-final-list-home/` and `nike-reuse-final-product-home/`.

Earlier learning used public Jordan 12 and Zoom Skylon URLs. The shared scanner flagged their long public slugs as token-like. Those warnings were not suppressed. The product operation was relearned using the shorter actual Spizike/Metro links, and the final public checks use Dunk. Earlier receipts remain ignored for provenance, including the first fresh-home passes.

## Blocked domains

H&M: the first GET to `https://www.hm.com/` at 2026-10-26T09:49:01Z returned HTTP 403 and "Access Denied", 364 bytes. `hm.json`, `hm-http.log` and `hm-http-resources.jsonl` retain the receipt. No browser capture or alternate host/path was attempted after it. No country, currency or store context was established; catalog and availability are unknown. `hm-home/` stayed fresh and unused.

Zara: the first GET to `https://www.zara.com/` at 2026-10-26T09:49:26Z returned HTTP 200 with a 2,139-byte Akamai interstitial, not catalog data. The document contains a `bm-verify` meta refresh, `/interstitial/ic.html`, and a script named `triggerInterstitialChallenge` that would POST to a security verification path. The Python HTTP reader did not execute scripts, load the frame or follow the meta refresh. Manual document inspection identified the challenge and the domain stopped. `zara.json`, `zara-http.log` and its resource log retain the receipt. No country, currency or store context was established; catalog and availability are unknown. `zara-home/` stayed fresh and unused.

No H&M or Zara JSON/notes were created in `sites/`.

## Resources and ownership

Every network, browser, learning, verification, export, fresh-reuse and vet command ran through `resource_gate.py`. Browser commands used the default admission CPU 65%, memory 88%, and stop CPU 85%, memory 90%. Bounded browser-free commands used the permitted memory admission 89%, hard 90%, with default CPU limits.

`resource-summary.json` aggregates 62 samples from 09:47:08Z through 09:57:18Z. Maximum CPU was 60.47%; maximum memory under the runbook's metric was 87.51%. There were zero admission denials and zero watchdog stops. Raw occupied RAM peaked at 99.69%; this includes file-backed cache and is reported separately from the enforced metric. These are sampled host measurements, not a guarantee against unsampled transient spikes or unrelated applications.

Browser ownership used atomic `mkdir bench/explore/state/discovery/browser.lock`. When busy, no browser command started. A later contention was followed by a 30-second wait and successful acquisition. The wrapper wrote its own owner marker and released only its own lock in `finally`, after the gated command exited. All owned commands have exited; no unrelated process was stopped. Raw captures and fresh homes remain only in the assigned ignored evidence directory.

Parent should run the integrated registry/type/lint checks once for the batch. This worker did not duplicate those checks and did not publish anything.
