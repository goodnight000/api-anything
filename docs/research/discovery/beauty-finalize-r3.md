# Beauty finalize r3

Status: ISSUES. Ulta PASS, one reusable public read saved. Sephora BLOCKED on the final cookie-free fresh-home request, which returned HTTP 403 Access Denied. No Sephora registry spec was saved, and the domain is stopped.

Research date 2026-10-26 UTC. Continued `beauty-qualified-r2` and `beauty-source-prep-r1` on shared dirty branch `t3/reverse-engineer-high-leverage-apis`, inspected HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, existing registry/state/reports and the document capture helper. This worker touched only its Sephora/Ulta candidates, notes, ignored evidence and this report. No nested agent, source/dependency edit, shared state/runbook/catalog edit, commit, push, PR or publication occurred. The parent owns integrated checks.

All evidence paths below are relative to the absolute batch directory `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/beauty-finalize-r3/`. Each site has an isolated absolute API_ANYTHING_HOME. No private browser import or login occurred. Sephora was stopped immediately on the fresh-home HTTP 403 at 11:10:54 UTC. Ulta exposed no observed auth, challenge or 429. No alternate host, proxy, challenge solution or access-control workaround was used.

## Real captures and provenance

`provenance.json` records byte-identical copies and SHA-256 hashes of the three original CaptureFiles. Originals remain untouched in the absolute sibling `beauty-qualified-r2/sephora-home/captures/` and `beauty-qualified-r2/ulta-home/captures/`. Copied captures live in `sephora-home/captures/` and `ulta-home/captures/`. No HTTP response was represented as a browser capture.

All captures used the experimental repository document helper. Only the exact requested GET document was allowed; other requests were aborted and redirects are unsupported. Inline scripts could execute. This proves the frontend document and embedded data, not a fully hydrated GUI. New captures used the global atomic browser mutex with an owned token, the default resource gate and the batch's bounded capture wrapper.

| Site | Source and captured request URL | Genuine capture, request ID | Evidence |
|---|---|---|---|
| Sephora | `https://www.sephora.com/product/the-ordinary-deciem-niacinamide-10-zinc-1-P427417?icid2=products+grid:p427417&skuId=2031391` | `cmvp4wr0q38d513`, 1 | Original r2, HTTP 200 |
| Sephora | `https://www.sephora.com/product/the-ordinary-deciem-natural-moisturizing-factors-ha-P427414?skuId=2210581` | `cmvp4x7hr424d45`, 1 | Original r2, HTTP 200 |
| Ulta | `https://www.ulta.com/p/niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111` | `cmvp4y70cb9f6bc`, 1 | Original r2, HTTP 200, link grounding only |
| Ulta | `https://www.ulta.com/p/glycolic-acid-7-exfoliating-brightening-daily-toner-pimprod2007097?sku=2551155` | `cmvp5ehrs313765`, 1 | New HTTP 200, 243 exchanges, 242 aborted |
| Ulta | `https://www.ulta.com/p/niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111?sku=2551167` | `cmvp5frzy06b94b`, 1 | New HTTP 200, 245 exchanges, 244 aborted |

The first new Ulta source was grounded in the prior linked primary-page preparation. The second was the actual canonical offer link in the original default-page capture. These selected-SKU captures avoid adding a query parameter to the original default capture. Their completion receipts are `ulta-capture2-attempt2.stdout` and `ulta-capture-selected1-attempt0.stdout`. Canonical Sephora family captures never ran and are not claimed here.

## Sephora contract and observed meaning

BLOCKED, not reusable. The following contract is an ignored candidate, not a saved registry operation. Earlier capture-home replays and verification passed, but they did not prove cookie-free reuse.

`getProductDocument(productSlug, familyId, skuId)` reads `script#linkStore` JSON at `page.product`. The caller copies all three values from one public US product link, splitting the final `-P` family ID from the slug. It reports family identity separately from the document's `currentSku`. It does not promise that changing skuId selects a requested variant.

| Field | Meaning |
|---|---|
| `familyId`, `name`, `brand` | Product family identity and retailer labels |
| `canonicalPath` | Relative canonical family path, resolved against `https://www.sephora.com` when a URL is needed |
| `documentSku`, `documentSize` | SKU and size represented by the returned document |
| `documentListPrice` | Formatted advertised list-price string, not a checkout total |
| `ingredientDescriptionHtml` | Retailer HTML containing ingredient highlights and full ingredient description, not a clean ingredient-only list |

Exact learning inputs were `productSlug=the-ordinary-deciem-niacinamide-10-zinc-1 familyId=P427417 skuId=2031391` and `productSlug=the-ordinary-deciem-natural-moisturizing-factors-ha familyId=P427414 skuId=2210581`. The original CaptureFiles and their request bytes were preserved. Learning retains the first capture's public icid2 field, which also contains the family identifier. The learner warned that familyId appears in two places and that run 2 lacks icid2; these warnings are recorded, not suppressed. minTier is 1. No canonical-family request is substituted for either learning capture.

Unseen input `productSlug=the-ordinary-squalane-cleanser familyId=P444718 skuId=2278091` came from an exact public product link in capture `cmvp4wr0q38d513`. Tier-1 replay returned family P444718, document SKU 2278091, Squalane Cleanser Hydrating Makeup Remover, size 5 oz/150 mL and $21.00, with no healing or truncation. `sephora-comparison.json` compares the operation's linkStore fields with the separate standalone ProductGroup JSON-LD for family, SKU, name, brand, resolved canonical URL and numeric offer price. JSON-LD explicitly says USD. Ingredients contain Squalane; size and the complete ingredient HTML are document fields, not independently validated physical-product facts.

`semantic-verify.json` also checks all three replay documents against their expected family/SKU identities. The completed three-case tier-1 verification remains in `before-share-check-sephora-verify.json`, and its request bodies are ignored evidence.

Two local issues required a smaller sharing contract. Long full-path example strings triggered token-shape warnings, so the caller contract separates the product slug and family identifier without changing the captures. A login-name heuristic marked fresh guest cookies as signed in; the recorded profile provenance establishes no login occurred. `sephora-guest-classification.json` and `sephora-metadata-correction.json` record the metadata correction. Relearning after checks existed hit an exact scan collision between a recently-viewed product cookie and the public second-example SKU. The final shareable check list omits that redundant check while retaining the held-out Squalane result check. The genuine two-example learning evidence and the completed three-case verification remain. No credential-scanner rule was waived and no cookie value was deleted to force export. `sephora-shared-check-choice.json` records the decision.

The final candidate passed `verifySite` with maxTier 1 for its example and held-out Squalane result check, recorded in `sephora-verify.json` and `sephora-home/checks/sephora.json`. Export retained public examples with zero secret findings and zero shape warnings in `sephora-export-scan.json`. Direct `vetShared` returned zero errors and warnings in `sephora-vet.json`. Those intermediate passes do not override the final failure.

`sephora-fresh-initial.json` records an initially empty absolute `sephora-fresh-getProductDocument/` home. Only the exported candidate was installed. Its first tier-1 request, with requestCookiePresent false, returned HTTP 403 Access Denied at 11:10:54.246 UTC. Exact request: `https://www.sephora.com/product/the-ordinary-squalane-cleanser-P444718?icid2=products+grid:P444718&skuId=2278091`. `sephora-fresh-1-response.json`, `sephora-fresh.json` and `sephora-stopped.json` retain the failure. The result advertises tier 2 as required but capped by maxTier 1; no tier-2 browser request ran. No request, alternate route or browser retry followed the 403. No `sites/sephora.json` or `sites/sephora.md` was created. The ignored candidate remains only as research evidence.

## Ulta contract and qualification

PASS. Saved `sites/ulta.json` and `sites/ulta.md` after all gates.

`getProduct(productPath, sku)` takes the complete public path segment after `/p/` and a SKU from the same link. It reads the standalone Product JSON-LD. Returns `familyId` from productID, `sku`, retailer `name` and `brand`, `size`, the main offer `price` and explicit `currency`, plus `offerUrl`. No availability, subscription price, checkout total, pickup or delivery claim is returned.

Learning inputs were `productPath=niacinamide-10-zinc-1-serum-oily-skin-pimprod2007111 sku=2551167` and `productPath=glycolic-acid-7-exfoliating-brightening-daily-toner-pimprod2007097 sku=2551155`, from the two new genuine captures. `ulta-learn.json` records no warnings, minTier 1 and exactly two param slots, path:1 and query:sku.

The unseen third input reused the first product path with `sku=2614594`, absent from learning examples. Its exact link was present in original capture cmvp4y70cb9f6bc. The prior independent linked primary-page evidence identified 4.0 oz, item 2614594 and $19.60. Tier-1 replay returned that family, SKU, size and 19.60 USD main offer without healing or truncation. `ulta-visible-comparison.json` independently compares JSON-LD output with document HTML text outside scripts/styles: product name, `Item 2614594`, `Size: 4.0 oz` and `$19.60` all match. This resolves the earlier search-indexed 1.0 oz conflict for this live document; it does not make search-indexed variants authoritative.

`ulta-verify.json` records three passing cases at maxTier 1: the niacinamide example, different-family toner check and held-out larger-variant check. `semantic-verify.json` confirms expected family/SKU identities for all three actual response documents. `ulta-export-scan.json` has zero secrets and warnings with public examples retained. `ulta-vet.json` is direct vetShared on the exported candidate and notes, with zero errors and warnings.

`ulta-fresh-initial.json` records an initially empty absolute home `ulta-fresh-getProduct/`. Only the exported spec was installed there. `ulta-fresh.json` passed the held-out variant at tier 1, without healing or truncation, and matched the prior family/SKU. `ulta-fresh-1-response.json` records requestCookiePresent false. No profile, session or browser state was copied to this home.

## Resource admission and cleanup

Browser commands used CPU admission 65%, stop 85%, memory admission 88%, stop 90%. Bounded browser-free learning, tier-1 verification and export used memory admission 89%, stop 90%, with the same CPU defaults. Admission denials waited at least 30 seconds and retried at most three times. No site request was sent during waits. The normal 88% browser threshold was never raised by this worker.

Across 49 resource samples, 11 launches were denied. Peak sampled CPU was 49.43%, peak policy memory 89.88%, and raw occupied RAM 99.72%. No sample hit a watchdog hard stop. `resources-summary.json` records these values. Policy memory excludes only file-backed cache and differs from raw occupied RAM. Sampled watchdog results do not guarantee a host-wide ceiling or exclude transient spikes.

`cleanup.json` at 11:11:54 UTC found no browser process using either owned profile, no global browser mutex and no pending owned command. It also rechecked that all three copied original CaptureFiles still match their source bytes and hashes. Every capture wrapper released only its own token after the owned command exited. No unrelated process, lock or profile was changed. Original r2 evidence, new profiles and ignored receipts remain; no raw credentials are included in this report.

Local harness failures were retained as evidence: an initial relative-import setup error sent no request; an early assertion incorrectly expected verifySite to return an ok field even though all cases had passed; export assertions exposed the documented public-path warning and guest-cookie collisions. Final Ulta qualification uses the corrected harness and clean final receipts. The Sephora 403 is an actual site access-control response, not a harness or resource failure.

Only `sites/ulta.json`, `sites/ulta.md` and this report were added as tracked-path outputs. The batch ended at approximately 11:12 UTC, within the 20-minute bound. The parent still runs integrated registry and repository checks; this worker did not run or claim them.
