# UK grocery qualification r1

UTC date: 2026-10-26. Batch `uk-grocery-qualified-r1`. Source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, shared dirty branch `t3/reverse-engineer-high-leverage-apis`. Work window 19:10–19:19:12 UTC, under the 20-minute / three-site bound. Read AGENTS.md, DESIGN, CONTRIBUTING, the repository api-anything skill, discovery README/current state and `uk-grocery-source-prep-r1.md`. Parent owns state, runbook, catalogue and integrated checks. No nesting or delegated children.

## Verdicts

| Site | Verdict | Result |
| --- | --- | --- |
| Waitrose | PASS, worker qualification; parent integration pending | Saved one operation and caller/maintainer notes after all worker gates passed. |
| Morrisons | BLOCKED | First cookie-free local source GET returned actual HTTP403 with CloudFront `Request blocked` body. Stopped across routes/transports immediately. No capture/spec. |
| Sainsbury's | ISSUES | First local consumer document HTTP200; visible-product HTML extraction gap under the unchanged core. No capture/spec and no consumer access-control stop. |

Only `sites/waitrose.json`, `sites/waitrose.md`, this report and ignored batch evidence were written. No other site files, src, dependency, helper, runbook, catalogue or state edits. No commit, push, PR or publication. No login/import, account, postcode, store, loyalty, cart or profile action. No speculative endpoint, query removal, alternate host, proxy or control bypass. The Sainsbury's API Hub host remains stopped at the indexed SSO boundary from source preparation; it was not requested.

The earlier source-preparation report's official API/MCP overlap screen remains a bounded negative result. No retailer-supported anonymous consumer catalogue API was established. Partner infrastructure does not establish such access. This batch did not repeat the screen or contact any API portal.

## Waitrose operation and exact inputs

`getProduct(slug, productId)` reads the exact source-linked public UK product document. Return value is a one-element list with title, pack-size text, main item-price text, unit-price text and canonical source URL. Both params must come from the same link. IDs preserve leading zeros; mixing slug/ID pairs is unverified. No availability, checkout, national price, delivery, freshness or machine currency claim. Main price is displayed text and may reflect a promotion; previous-price, multibuy and member-specific details are not returned or interpreted.

| Role | slug | productId | Independently expected identity and meaning |
| --- | --- | --- | --- |
| Learning A / example | essential-long-life-semi-skimmed-milk | 035307-17781-17782 | Essential Long Life Semi-Skimmed Milk; 1litre; £1.30; £1.30/litre. A separate Was £1.40 label is not the item price. |
| Learning B / check 1 | essential-long-life-skimmed-milk | 035309-17785-17786 | Essential Long Life Skimmed Milk; 1litre; £1.30; £1.30/litre. Identity differs despite equal prices. |
| Unseen C / check 2 | essential-unsweetened-soya-drink | 035050-17659-17660 | Essential Unsweetened Soya Drink; 1litre; £1.40; £1.40/litre. Different identity and price from both milk examples. |

Exact request and trigger family: `https://www.waitrose.com/ecom/products/{slug}/{productId}`. Matcher GET `www.waitrose.com`, `/ecom/products/*/*`; slots `path:2` and `path:3`. Simple patterns `[a-z0-9-]+` and `[0-9-]+`. Read-only, minTier 1, learnedLoggedIn false, no credential refs, no volatile anchors, no unproven marker, no learning warnings. Captured browser-computed public headers were retained by the existing learner; Cookie and Authorization are absent from the exported template.

The genuine local source GET of A established SSR before the helper was allowed at 89/90. The category source was fetched at its unchanged grounded URL `https://www.waitrose.com/ecom/shop/browse/groceries/fresh_and_chilled/milk_butter_and_eggs/milk/long_life_milk?tsrc=vdna`. Its actual anchors expose A/B/C exact hrefs, including `/ecom/products/essential-unsweetened-soya-drink/035050-17659-17660`; C detail was not fetched while resolving that link. `waitrose-category.source.json` and `waitrose-heldout-source.json` retain the source chain. Category SHA256 `af8ad9872fa9a2e82de8e48a391da0420b897f5b8cb0fc5e0d81004b831cea57`.

Genuine A/B captures used the unchanged `bench/discovery/capture-document.mjs`, exact GET only, 15-second timeout, under an atomic global `mkdir` mutex with this batch's unique owner token. Other requests were aborted. Inline scripts could run. These captures prove SSR document traffic, not a fully hydrated GUI or post-render DOM. Saved captures remain intact, including aborted exchanges, cookies and storage. No HTTP response was synthesized into a capture.

| Capture | Request ID | Exchange count / aborted | Capture file SHA256 | Document body SHA256 |
| --- | --- | --- | --- | --- |
| cmvpmwkw6c3f2af | 1 | 115 / 114 | `3883a88dea75a7a45c7d5fb4122a1a81c7831a1ccb10cab4f527bec933284a85` | `e81ef93aa707ad00fd85ead1b983e597b2fc099fda3440b1158e6c83d09e9ed6` |
| cmvpmx7hqc524eb | 1 | 115 / 114 | `ffc317736542bf4f6e479c5050e9737a3ddd4108687326e61b45c9883595b3c6` | `07d19002459706e8ac8cb54ca5e907bf2c37b6909bae1195a530fb1389ab2f63` |

Both captured bodies were separately inspected before subsequent traffic on that domain. HTTP200, no bot wall or sign-in form, and correct visible title/pack/price. Helper `ok:true` was not taken as sufficient proof. The core `parseShown` and HTML extractor were unchanged. HTML items `html`; fields use product-name, the h1 pack-size span, main product-pod-price, main price-per-unit and canonical link. The recipe excludes trolley totals and the separate previous-price label in these tested pages.

Offline `addOperation` consumed A/B captures, with a fetch implementation that refuses network. It returned no warnings, minTier1 and no unproven mark. Metadata, examples and B/C checks were drafted, exported and passed `vetShared` with draft notes before the first C detail request. `waitrose-learn.out` and `waitrose-learn.resources` are the preflight receipts.

The category's C card was independently read before C's first request, using its own h2, pack and price labels rather than the operation's detail-page recipe. First unseen tier1 response matched 5/5 expected fields, no healing, at 19:15:14 UTC. Body SHA256 `cd0777e5f9887c3398a22c3714dcb361f2d6819cc55308a7bed658abd926b4ba`. The initial unseen proof ran against the learned literal request with slots; export then normalized the request to parameter placeholders. The exact exported version was frozen in the local home before all final verification. The learning log's transient in-memory hash is not the final version receipt.

Final exact operation hash `fb9ab14ff90d3ed6`. Exported JSON SHA256 `168b0664edc38e045986e58a3d98ec80515b16763057e4b731aad39566b045bb`. Notes SHA256 `9f3ca107f11b0f561f6d2c826d5b0d0ae99ebe9f69baf30f02d8fd8ce1f98c93`. Export retained public A example and public B/C checks, with zero secrets and zero warnings. `waitrose-export.out` records the freeze. Both `waitrose-verify.json` and `waitrose-fresh.json` record three current passing tier1 cases at that exact hash, no healing. The initially absent/empty fresh home was asserted before saving the exact exported spec. Its first call was C with Cookie=false and Authorization=false; all five fields matched the independent source expectation. Later verification used only guest cookies issued to that isolated home, Cookie=true / Authorization=false, with no imported session. Cookie values were never logged in receipts.

`final-audit.json` re-read the exact exported JSON and final notes, required the re-export to match, checked the verification hash, re-extracted all seven final verify/fresh response bodies and both captured bodies, and asserted each complete five-field result. Every comparison passed. It then saved the assigned site files and ran final `vetShared` on those exact saved bytes: zero errors, zero warnings. Parent's receipt audit and focused integrated registry gate remain pending. This is not publication or integration proof.

| Exact-version response | Body SHA256 | Cookie / Authorization | Meaning comparison |
| --- | --- | --- | --- |
| verify request 1 | `2143b26865f4733e01f4bc5e38a7241fe4185e3e53d487750bd3defdf2a51ae8` | true / false | 5/5 exact fields |
| verify request 2 | `d816b08e506fa2fc5d4aec2cb3d3ac8639461d60ba07268fff50ea2c0b4b3cac` | true / false | 5/5 exact fields |
| verify request 3 | `d028e6466cc71ae5cb06f2c32ed33497808074552161debc7ef0ad0e1abd71d8` | true / false | 5/5 exact fields |
| fresh request 1 | `db508a83da30f4db5acd69cbb32a7289c1f7b4f8d618662b59006808c83e044b` | false / false | 5/5 exact fields |
| fresh request 2 | `57e909842d67900d4491eacdf73c012693ffd7b370f2b2256a5b159e8187c581` | true / false | 5/5 exact fields |
| fresh request 3 | `039a0f71e4aaf73e6b243986c73c9044c9b2df6bc3e25a7785a48218d1c43849` | true / false | 5/5 exact fields |
| fresh request 4 | `e5bf15c3751c6fe7605104fe578d82f7bd46685ba01047a71f2c7715d057dd57` | true / false | 5/5 exact fields |

## Morrisons stop

Only request: `https://groceries.morrisons.com/products/morrisons-british-semi-skimmed-milk-4-pint/113240422`. At `2026-10-26T19:11:59.402Z`, HTTP403, 919 bytes, no redirect, first request Cookie=false / Authorization=false. Body title `ERROR: The request could not be satisfied`, h1 `403 ERROR`, and actual wording `Request blocked.` followed by CloudFront's explanation. Body SHA256 `3b472e8ea962561051ce6cfe2258532e89d75520f84de6352fc8d57f6c78043a`. The generic `botWall` helper returned null, but independent status/body inspection triggered the required stop. No B/category/C request, alternate route/transport, retry or capture. C remains unopened and its exact category href unconfirmed. All registry qualification gates are absent. No Morrisons files saved.

## Sainsbury's gap

Only consumer request: `https://www.sainsburys.co.uk/groceries/product/sainsburys-british-whole-milk-568ml-1-pint`. At `2026-10-26T19:16:18.779Z`, actual HTTP200, 1,448,326 bytes, no redirect, Cookie=false / Authorization=false. Body SHA256 `04186aa457835fef7b69004353e332e16092202d38b1ee7c8142799aef94d706`. No bot wall or sign-in form was observed. A normal Log in / Register link was not an auth wall.

Gated offline source analysis found raw product h1 `Sainsbury's British Whole Milk 568ml (1 pint)` and displayed 85p / £1.50 per ltr inside hidden streaming container `S:2`. Unchanged `parseShown` removes that container: shown h1 count zero and no shown 85p. Raw markup was diagnostic evidence only and was not treated as visible. Product JSON-LD separately exposes product identity and an offer, including a machine currency property. That is a different representation; it does not supply the requested displayed unit-price text or establish general regular-versus-Nectar semantics. No price normalization or hidden-markup workaround was added.

There is therefore no qualified operation for the assigned displayed-metadata semantics. This is a source-level extraction/semantics gap, not proof that all browser-rendered or JSON-LD reads are impossible. No genuine capture, B/category/C request, learning or export was performed; C detail remains unopened and source-href equality unconfirmed. No Sainsbury's files saved. `sainsburys-inspect.json` retains diagnostic evidence under ignored storage; raw review author/content details are not in tracked output. Public consumer host is not stopped for controls. The separate API Hub SSO stop remains unchanged.

## Resource policy and cleanup

Every substantive offline, local-network and browser command used a fresh resource gate. Source inspection, analysis, learning, export and final audit used explicit memory 88/90; understood exact-document capture and bounded tier1 heldout/verify/fresh used 89/90. CPU admission/stop remained 65/85. No resource denial or retry/resample occurred, no nesting, and no self-respawn. Script creation, ordinary prerequisite reads and lightweight report bookkeeping used the stated exception. Earlier parent launch snapshots are not counted as workload admission.

Observed sampled peaks across this batch: CPU 47.85%; non-cache policy memory 87.6%; raw occupied memory 99.92%. Raw occupancy is separate. These are watchdog samples, not a global or unsampled cap guarantee. Per-command records:

| Resource receipt | Samples | Peak CPU % | Peak policy memory % | Peak raw occupied % | Admission |
| --- | --- | --- | --- | --- | --- |
| final-audit.resources | 1 | 15.7 | 86.6 | 99.06 | pass |
| morrisons-a.resources | 1 | 18.74 | 86.53 | 99.61 | pass |
| sainsburys-a.resources | 2 | 33.44 | 86.82 | 99.63 | pass |
| sainsburys-inspect.resources | 1 | 47.85 | 87.6 | 99.65 | pass |
| waitrose-a.resources | 2 | 27.16 | 86.21 | 99.13 | pass |
| waitrose-capture-a.resources | 6 | 46.31 | 86.63 | 99.67 | pass |
| waitrose-capture-b.resources | 2 | 31.64 | 86.77 | 99.92 | pass |
| waitrose-category.resources | 2 | 30.78 | 86.46 | 99.47 | pass |
| waitrose-export.resources | 1 | 23.6 | 84.37 | 98.31 | pass |
| waitrose-fresh.resources | 3 | 36.04 | 86.89 | 99.68 | pass |
| waitrose-heldout.resources | 2 | 40.16 | 85.96 | 99.65 | pass |
| waitrose-inspect-a.resources | 1 | 38.21 | 85.28 | 99.27 | pass |
| waitrose-learn.resources | 1 | 18.39 | 85.38 | 99.14 | pass |
| waitrose-prices.resources | 1 | 41.26 | 85.81 | 99.51 | pass |
| waitrose-verify.resources | 3 | 32.59 | 87.1 | 99.65 | pass |

All workload children exited. The helper closed its browser after each capture. The wrapper released only its own mutex after its child exited; global mutex was absent on final inspection. No unrelated lock or process was changed. Isolated absolute homes are under ignored `bench/explore/state/discovery/uk-grocery-qualified-r1/{home,fresh-home}`. Captures, raw bodies, scripts, resource logs and exact receipts remain there for parent audit. No website/browser requests remain in flight. No integrated registry test was run by this worker, per parent ownership.
