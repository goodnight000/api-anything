# Ulta category discovery qualification r1

PASS for worker API qualification. Added `listCategoryProducts(department, category, subcategory)` as a distinct cross-brand category workflow. Ulta now has three operations and nine saved cases. Parent owns independent audit, registry/lint/type integration, state and final count. Nothing was published.

2026-10-28 UTC. Exclusive claim `ulta-category-qualified-r1-20261028` started 08:16:12 UTC with deadline 08:36:12 UTC. Final saved-file vet passed at 2026-10-28T08:22:13.256Z. The discovery README, current claim and full recursive state/host-stop/alias ledger, DESIGN, CONTRIBUTING, repository api-anything skill, saved Ulta JSON/notes and both prior Ulta discovery reports were read. No matching Ulta stop was found. Other sites and their stops, including JustWatch and Trip, were preserved. No nested delegation, CPU/memory checks, resource wrappers or recovery waits ran.

`ROOT` below is the ignored directory `bench/explore/state/discovery/ulta-category-qualified-r1-20261028/`, absolute `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/ulta-category-qualified-r1-20261028/`. All raw documents, captures, isolated guest jars and mocks remain there. The only saved-site writes were `sites/ulta.json` and `sites/ulta.md`; this report is the only other non-ignored output.

## Distinct contract and route evidence

The operation discovers products across brands by a public category, complementing exact-brand listing and selected-product detail. It is not a renamed brand operation. Actual retained OLAPLEX document capture `cmvrttda1a7dc2c` contains the exact category anchor hrefs below. Before using those links, `retained-audit.json` verified all 72 artifacts against previous manifest `bb13b555fe273c1749442086d192f08072072e83d389420f1fd485ca7f7712d8`, including raw capture hashes. The navigation source SHA-256 is `07f7f5c8fdfeefb7f36c896a286de2e797c5e1bd897ff8907440af844fd3fcd8`.

Each parameter is exactly one route segment. Paired real-capture `addOperation` learned `department` at `path:1`, `category` at `path:2`, and `subcategory` at `path:3`, with literal `/shop/` retained. No arbitrary full path is inserted into one segment. No category ID, endpoint, filter or query shorthand was invented. Learn returned zero warnings, no unproven mark and minTier 1. Parameters have simple bounded-character patterns, descriptions and public examples.

| Case | Source and request URL | Document heading | Cards | Distinct brands |
|---|---|---|---:|---:|
| A, learning example | `https://www.ulta.com/shop/makeup/face/foundation` | Foundation | 64 | 26 |
| B, differing example/check | `https://www.ulta.com/shop/skin-care/moisturizers/night-cream` | Night Cream | 64 | 40 |
| D, unseen/check | `https://www.ulta.com/shop/hair/shampoo-conditioner/shampoo` | Shampoo | 64 | 20 |

All three input triples change the request and return different product identities across multiple brands. Their separate document titles, h1 and canonical URLs confirm the requested categories. A begins with Estée Lauder Double Wear foundation, SKU 2651970; B with TULA 24-7 Moisture day/night cream, SKU 2577530; D with Redken All Soft shampoo, SKU 2580410. These are initial document cards only. Other depths/layouts, complete catalog coverage, pagination, filters, search, hydration, inventory, store/pickup, delivery and reviews are unqualified. The operation returns no price or size.

## Genuine frontend capture and independent comparison

The unchanged exact-document helper ran directly with an absolute isolated `ROOT/home`, an owned atomic `browser.lock`, exact GET restriction and 15-second timeout. All other requests were aborted; inline scripts could run. This proves frontend document traffic, not a fully hydrated GUI. No private browser profile, cookie import, login, website write or control bypass occurred.

| Case | Genuine capture | HTTP | Exchanges / aborted | Child PID | Terminal session |
|---|---|---:|---:|---:|---|
| A | cmvrudyes24fe2f | 200 | 249 / 248 | 11691 | Handle not retained; see bookkeeping note |
| B | cmvrues2n069042 | 200 | 249 / 248 | 13119 | 57888 |
| D | cmvrug4ngac0679 | 200 | 236 / 235 | 15788 | 23350 |

All exact document responses were classified `ok` by the real core before another send. Wrapper/child PIDs, ownership tokens and times were written immediately. The A terminal-session handle was accidentally omitted when the first tool result was forwarded; its wrapper PID 11688 and child PID 11691 were recorded immediately and independently confirmed exited. This is a process receipt limitation, not a missing runtime qualification gate. No unrelated process was stopped.

The saved HTML recipe selects `.ProductListingResults__productList .ProductListingResults__productCard`. Independent comparison reads the separate frontend Apollo ProductListingResults items from each genuine captured document with JSON parsing only, never arbitrary site JavaScript:

| Claimed field | Runtime HTML source | Independent frontend JSON source |
|---|---|---|
| name | ProductCardBody title | productName |
| brand | ProductCardBody brandName | brandName |
| url | product anchor href | action.url |
| sku | card data-sku-id | skuId |

Every row, field, identity and ordering matches; each SKU also equals its own URL query. D's 64 records equal all 256 claimed field values from independent capture D. Both the cold result and final category verification responses match the separate capture sequences. `compare.mjs`, `separate-frontend-comparison.json`, A/B/unseen/cold comparison receipts, verify-7 through verify-9 comparisons and `category-identity.json` retain exact evidence. The six existing cases also passed; `existing-six-cases.json` checks all three existing product family/SKU identities and compares all three brand outputs with the independently parsed retained frontend captures.

## Preflight, unseen category and detail handoff

Final metadata, all public examples/checks and final draft notes were exported before live unseen/cold/verification work. `preflight-vet.json` at 2026-10-28T08:19:00.696Z reports zero errors and warnings for the exact final JSON and notes. Export reported zero secrets and warnings. No candidate metadata or notes changed after preflight.

D was grounded from the actual retained anchor in `unseen-grounding.json`. Its category detail was not inspected before the first tier-1 replay, which returned 64 cards without healing or truncation. The independent D frontend capture followed that replay. Learning used only A and B.

The first returned D card supplied the exact public product URL `https://www.ulta.com/p/all-soft-shampoo-dry-brittle-hair-xlsImpprod15511061?sku=2580410`. Before inspecting its detail metadata, the harness split it into `productPath=all-soft-shampoo-dry-brittle-hair-xlsImpprod15511061` and `sku=2580410` and called unchanged `getProduct`. It returned tier 1, family `xlsImpprod15511061`, represented SKU `2580410`, Redken, All Soft Shampoo For Dry, Brittle Hair, size `10.1 oz`, main structured offer `31.00 USD` and the same offer URL. Separate visible detail text outside scripts contains the product name, brand, Item 2580410 and size. Receipts are `handoff-input.json`, `handoff-result.json` and `handoff-comparison.json`.

Family ID and SKU remain separate. Requested item must match the represented SKU/size. Main structured offer is not a checkout total, subscription amount, stock promise or delivery quote. This proves one actual category-to-detail handoff, not all product layouts.

## Cold first send and all-read verification

`cold-initial.json` records an initially empty absolute `ROOT/cold-listCategoryProducts` home. Only the exact final export was installed. Its first call was the new operation with D, before detail or verification calls. `cold-1-response.json` proves Cookie absent and Authorization absent, HTTP 200 and core judge ok. Its 64 cards match separate frontend capture D in every field and order.

That first response issued isolated site guest cookies named `__ruid`, `X_ULTA_VISITOR_ID`, `AKA_A2`, `ULTA_SITE`, `X_ULTA_SITE` and `akaalb_alb_www_dsp`. Later handoff and verification calls could send those newly issued guest cookies and sent no Authorization. No prior session/profile was copied into the cold home. `request-summary.json` discloses headers by presence and guest-cookie names, never values.

All nine saved cases passed at tier 1 with no healing: original three selected-product cases, original three brand cases and new A/B/D category cases. Current verify records match all exact operation hashes. There were twelve tier-1 GETs total, plus three actual frontend document GETs. Every real response core judge was ok. The root live `STOP.json` is absent; no consumer stop occurred.

The actual `auditedFetch` function latches every non-ok core judge persistently before another send, including HTTP 200 auth/missing-data. Local mock-only controls test auth, drift, blocked, rate, server failure and network error. Each attempted one mock send and refused the second. Mock STOP files exist only below `local-controls/`; they are not website responses or frontend evidence. The first local harness run omitted an injected assertion dependency; that local-only harness was corrected before its successful control run. No alternate transport or website retry followed a non-ok response.

## Exact files and cleanup

- Baseline JSON: `4510db741cfb4a8ac730d9996c0f72c65ef211a6ca8929c7290458d013a1e81b`.
- Baseline notes: `55213b7e8e7a3d9f12521de3c26f9e361fef6432ada7f98b4e10ecd772279015`.
- Final `sites/ulta.json`: `c201a8dbe3fa6252198995d7fa0924715c247d068fc1a0045c466c8899f58095`.
- Final `sites/ulta.md`: `6dbd61a01e7397cdfaa3a5ff6f459501c17b79ef965b167870b689b6dd0083f3`.
- New operation SHA-256: `2cc0eef9f8e0f6fc9c067ad68224432e0fdb27be3e099589a0f8376c147189e5`; verify opHash `2cc0eef9f8e0f6fc`.
- Unchanged getProduct opHash `f09fca638fadf8d5`; unchanged listBrandProducts opHash `011c7c0cbeedfa1e`.
- `ROOT/manifest.json`: `1b5f8c45d8a55a63372986023691eab2aac0fef0c8c340e59c6824bffc9c7d4b`, covering 126 exact artifacts. The report is excluded to avoid a self-hash cycle.

`final-export.json` and `final-vet.json` record zero secrets/errors/warnings on the exact saved output. Preflight candidate, cold input, final verified export and saved files agree. Both complete original operation objects, descriptions, examples and checks are JSON-identical to baseline. Caller notes are 1844 UTF-16 code units before exact `## Maintainer notes`.

`frozen-preservation.json` verifies all eight frozen publication files and unchanged approved manifest `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`. Exact-document helper remains `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`. No source, dependency, existing helper, state, runbook, old receipt or publication manifest was edited. No commits, pushes or PR operations occurred.

`cleanup.json` confirms all owned capture processes exited, no browser using the owned profile remained, and the global browser lock was absent. Known execution sessions completed. Raw evidence and isolated jars remain ignored. Worker runtime gates are complete; parent integration gates and count remain pending.
