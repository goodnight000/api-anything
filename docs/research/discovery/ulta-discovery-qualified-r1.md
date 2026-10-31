# Ulta product discovery qualification r1

PASS for worker qualification. Added one public read, `listBrandProducts(brandSlug)`, feeding unchanged `getProduct(productPath, sku)`. Ulta now has two saved operations. Parent independent audit and shared registry/lint/type integration remain pending; this worker does not count integrated acceptance or publication.

2026-10-28 UTC. Exclusive claim `ulta-discovery-qualified-r1-20261028`, started 08:00:05 UTC with deadline 08:20:05 UTC. Qualification and saved-file vet completed at 08:07:56 UTC. No source-only substitution or new-domain research. Read discovery README, full state/stop/alias ledger, DESIGN, CONTRIBUTING, repository api-anything skill, saved Ulta spec/notes and beauty-finalize-r3 report before requests. No Ulta brand, alias, route or transport stop matched. The JustWatch stop was retained and no other site was requested. No nested delegation, CPU/memory snapshots, resource wrapper, recovery wait, private cookie import, login, website write, Git mutation, PR or publication occurred.

Evidence root, abbreviated `ROOT` below, is the ignored directory `bench/explore/state/discovery/ulta-discovery-qualified-r1-20261028/`. Its absolute path is `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/ulta-discovery-qualified-r1-20261028/`. Raw documents, captures and isolated guest jars stay there. No raw response or cookie value is included in tracked output.

## Contract and argument effect

`listBrandProducts(brandSlug)` sends the captured public GET template `https://www.ulta.com/brand/{brandSlug}`. The sole learned slot is `path:1`; there are no credential refs, public constants, volatile anchors, steps or write permissions. Paired `addOperation` used actual frontend captures A and B, request ID 1 in each, with `brandSlug=olaplex` and `brandSlug=redken`. It returned no warnings, no unproven mark and minTier 1. Public examples and Redken/Morphe result checks are retained in the export.

The recipe selects `.ProductListingResults__productList .ProductListingResults__productCard` and returns these independently checked fields:

| Returned field | HTML source | Separate frontend Apollo source | Comparison |
|---|---|---|---|
| `name` | `.pal-c-ProductCardBody--title` text | ProductListingResults.items[].productName | Exact text equality for every row |
| `brand` | `.pal-c-ProductCardBody--brandName` text | items[].brandName | Exact text equality for every row |
| `url` | Product anchor href | items[].action.url | Exact URL equality for every row |
| `sku` | Card data-sku-id attribute | items[].skuId | Exact ID equality for every row, also equals that URL's sku query |

The independent comparison parses the actual document's `window.__APOLLO_STATE__` JSON using `jsonValueEnd` and `JSON.parse`; it never executes source JavaScript or constructs exchanges from HTTP responses. Only the HTML recipe is saved in the operation. Private comparison scripts do not modify or extend the shared extraction implementation.

| Case | Actual source/request URL | Returned cards | First linked SKU | Evidence |
|---|---|---:|---|---|
| A, learning example | `https://www.ulta.com/brand/olaplex` | 30 | 2591018 | OLAPLEX No.7 Bonding Hair Oil |
| B, differing example/check | `https://www.ulta.com/brand/redken` | 64 | 2659627 | Redken All Soft Holiday Gift Set |
| C, genuinely unseen brand/check | `https://www.ulta.com/brand/morphe` | 64 | 2652511 | Morphe Lifeproof 16-Hour Continuous Setting Mist |

The differing brands return different identities and labels. All rows and their order matched each capture's separate Apollo product list. The complete tier-1 verification outputs also matched their respective separate browser capture card sequences. No field comparison is inferred from HTTP 200 or a nonempty list. `A-comparison.json`, `B-comparison.json`, `unseen-comparison.json`, `cold-comparison.json`, `verify-4-comparison.json` through `verify-6-comparison.json`, and `separate-frontend-comparison.json` contain receipts.

This is the initial public brand document, not a full-catalog guarantee. Pagination, filters, search queries, subsequent hydration, other page layouts and stock/store/pickup/delivery/address/review guarantees are unqualified. Discovery returns no price, stock, size, review, delivery or checkout fields. A linked SKU is the item represented by that link, not a list of every variant. No category IDs, query names or API endpoints were guessed.

## Literal navigation and genuine captures

Original retained capture `cmvp4y70cb9f6bc` has SHA-256 `1349526546bfc0d20ce5372842d7970d0f1232760d18596d89f53d4121262b69`, matching its original `beauty-qualified-r2/ulta-home/captures/` bytes and the prior provenance receipt. Its actual anchor hrefs include all three brand URLs above. `retained-audit.json` pins all three retained Ulta captures, including the untouched learning captures `cmvp5ehrs313765` and `cmvp5frzy06b94b`. Their hashes are retained in the manifest. They were used as retained navigation evidence, not relabeled as fresh captures.

| Case | New actual frontend capture | HTTP | Exchanges / aborted | Exact document |
|---|---|---:|---:|---|
| A | cmvrttda1a7dc2c | 200 | 249 / 248 | ID 1, OLAPLEX URL above |
| B | cmvrtu1ju1624f3 | 200 | 247 / 246 | ID 1, Redken URL above |
| C | cmvrtxged27a08b | 200 | 228 / 227 | ID 1, Morphe URL above |

The unchanged `bench/discovery/capture-document.mjs` ran directly with the owned atomic `browser.lock`, exact GET restriction, 15-second timeout and absolute isolated `ROOT/home`. Other requests were aborted; inline scripts could run. This proves actual frontend document traffic, not a fully hydrated GUI. Each helper exited and closed its owned browser before its lock was released. Capture PIDs were 73658, 74561 and 81629; terminal sessions were 65414, 15272 and 63797. Wrapper PIDs/tokens/times are in the per-capture process receipts. No ambient private profile was used.

## Preflight, unseen replay and detail handoff

Before any unseen, cold or verification request, the final candidate metadata, final public examples/checks and draft notes were exported with `exportSite({keepExamples:true})`. `preflight-export.json` has zero secrets and warnings. `preflight-vet.json`, timestamped 08:04:40.139 UTC, has zero errors and warnings for the exact candidate plus notes. No candidate or notes change followed that preflight. Export hashes at preflight, cold installation, final all-read verify and saved files agree.

Morphe was absent from learning examples. `unseen-grounding.json` records its actual retained anchor before the first replay. Neither the Morphe brand document nor linked product metadata was inspected before that replay. It returned 64 cards at tier 1 without healing or truncation. Capture C was obtained afterwards and independently matched every field and the complete sequence. Its separate capture also excludes a product link outside the product-list selector; the operation returns the 64 list cards, not every `/p/` anchor on the document.

The first unseen discovery result supplied the actual detail URL `https://www.ulta.com/p/lifeproof-16-hour-continuous-setting-mist-pimprod2057185?sku=2652511`. Before inspecting its detail metadata, the harness split that URL into `productPath=lifeproof-16-hour-continuous-setting-mist-pimprod2057185` and `sku=2652511` and called unchanged `getProduct`. It returned tier 1, no healing/truncation, family `pimprod2057185`, SKU `2652511`, Morphe, Lifeproof 16-Hour Continuous Setting Mist, size `2.8 oz`, main advertised structured offer `20.00 USD` and the same offer URL. Visible detail text outside scripts independently contained the name, brand, Item 2652511 and size. See `handoff-input.json`, `handoff-result.json` and `handoff-comparison.json`.

This proves one actual discovery-to-detail handoff. It does not qualify every brand or product detail layout. Existing distinctions remain: family ID and SKU are separate; check represented SKU/size against the requested item. Detail price remains the main advertised structured offer, not a checkout quote, subscription or delivery promise.

## Cold first call and final verification

`cold-initial.json` records that the absolute `ROOT/cold-listBrandProducts` home started empty. Only the exact final export was installed. Its SHA-256 is the saved export hash below, including the original operation. Its first call was the new operation with unseen `brandSlug=morphe`, before any detail or verification call in that home.

`cold-1-response.json` records Cookie absent and Authorization absent on that first send, HTTP 200 and core judge ok. It returned the same 64 cards, all fields and order matching separate capture C. The response issued only isolated site guest cookies, with names `__ruid`, `X_ULTA_VISITOR_ID`, `AKA_A2`, `ULTA_SITE`, `X_ULTA_SITE` and `akaalb_alb_www_dsp`. Later detail handoff and final verify calls used that same isolated site-issued jar; they could send Cookie and always sent no Authorization. No state or profile was copied into the cold home. `request-summary.json` discloses the first-versus-later distinction without values.

`verify.json` and `cold-listBrandProducts/checks/ulta.json` record six passing cases, all maxTier 1 and no healing, against the exact final export:

- Original niacinamide example, SKU 2551167, family pimprod2007111.
- Original glycolic-acid toner check, SKU 2551155, family pimprod2007097.
- Original larger niacinamide check, SKU 2614594, family pimprod2007111.
- Brand example `olaplex` and checks `redken` and `morphe`.

The entire original `getProduct` object, descriptions, params, request, response and saved cases are JSON-stringify-identical to baseline. `existing-case-identities.json` also checks actual response family/SKU identity for its three original cases. The six saved cases, unseen/cold calls and handoff sent nine tier-1 GETs in total, plus the three genuine frontend document GETs. Every real core judge was ok; no stop occurred.

`qualify.mjs` persistently writes `STOP.json` for every non-ok real core judge, including HTTP 200 missing-data/auth, before another send is possible. `capture.mjs` applies the same rule to each exact document. Each later send checks that file. No fallback or alternate transport follows a stop. No mock response is claimed as frontend evidence. Access denial was neither observed nor inferred.

## Exact output and cleanup

Baseline JSON SHA-256 was `443ff41bf1c4136e5771884bbb0d2ddae2d3da3925964d0fe53b3356bf72d39d`; baseline notes were `561e9b06263859c7feb5ea1b8b1b7697a51a27c7e9a6a309d20fc85203ae23b3`.

- Saved `sites/ulta.json`: `4510db741cfb4a8ac730d9996c0f72c65ef211a6ca8929c7290458d013a1e81b`.
- Saved `sites/ulta.md`: `55213b7e8e7a3d9f12521de3c26f9e361fef6432ada7f98b4e10ecd772279015`.
- Unchanged getProduct object SHA-256: `f09fca638fadf8d5f1949bb14464c44cdb1666aa7080422d6ac1296c1764886c`, verify opHash `f09fca638fadf8d5`.
- New listBrandProducts object SHA-256: `011c7c0cbeedfa1e372d96b1eb1859a7debe7bcdcfce5fdcc92519f2f4bf0de1`, verify opHash `011c7c0cbeedfa1e`.
- Exact `ROOT/manifest.json`: `bb13b555fe273c1749442086d192f08072072e83d389420f1fd485ca7f7712d8`.

`final-export.json` records zero secrets/warnings; `final-vet.json` records zero errors/warnings on saved JSON plus saved notes. Caller notes are 1449 UTF-16 code units before the exact `## Maintainer notes` heading. The manifest lists 72 artifacts with hashes, including final output, three actual captures, scripts, qualification receipts and all-read verification record. Raw HTML body hashes are in response receipts. No source/dependency/helper/state/runbook/approved-manifest changes were made.

`frozen-preservation.json` checks all eight first-four-publication files against approved per-file hashes. The approved publication manifest remains untouched, SHA-256 `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`. The existing exact-document helper remains SHA-256 `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`.

`cleanup.json` records all owned command sessions complete, no browser process using the owned profile and no global browser lock. Only owned resources were closed. Isolated profiles, guest jars and receipts remain as ignored evidence. The only saved-site writes were Ulta JSON/notes; the other tracked-path write is this report. Parent owns independent audit, shared registry/lint/type checks and final count.
