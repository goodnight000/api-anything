# Vinted qualification, round 4

Status: **PASS for worker qualification**, 2026-10-26 16:04 UTC. Saved `sites/vinted.json` and `sites/vinted.md`. Parent receipt audit and focused integrated registry gate remain pending; this worker did not run shared checks or update the catalog/state.

Worked on the shared dirty branch `t3/reverse-engineer-high-leverage-apis`, source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, current discovery state, vinted-qualified-r3.md and home-resale-qualified-r2.md before work. Only the assigned Vinted JSON, notes, this report and ignored round-4 evidence were written. No delegation, source/dependency edits, shared-state/runbook/catalog changes, commits, pushes, PRs, publication, everyday browser imports, login, site writes, CAPTCHA/control bypass or proxy changes occurred. No Wayfair work or frozen-spec changes occurred.

## Operation and exact public inputs

`getItemMetadata(slug)` reads a known public US item document and returns a one-item list containing `pageTitle`, `description` when present, and `url`. The input is the complete path segment following `/items/`, including the numeric item ID and descriptive suffix, without a query. The pattern is the simple character class `[a-z0-9-]{1,200}`.

- Learning example 1: `slug=10544127958-precious-moments-tender-tails-ornaments`.
- Learning example 2 and stored check: `slug=10544122490-aritzia-grey-sweatpants-tall`.
- Unseen heldout and fresh-home input: `slug=10544122240-hollister-hooded-zip-up-sweatshirt-junior-girls-size-medium`.

`pageTitle` is the document's Open Graph title and includes `| Vinted`. `description` is its search/social summary: it repeats the item title and may contain line breaks, be shortened or be absent. `url` is the document's canonical URL. The recipe reads `head` metadata through the unchanged current HTML extractor. It does not promise a full listing description, price, condition, availability, shipping, images, seller details or other regional domains. No seller profiles, usernames, buyer, account or order fields were selected. Metadata for sold/removed items may disappear. No list completeness, variant or live-stock claim is made.

## Source grounding and genuine captures

The retained actual homepage response is historical evidence, not a new root fetch. Its first three exact `/items/` anchors grounded all three source reads. The round-3 exact-anchor source helper was copied unchanged into round-4 evidence before use. The first local item request launched at 15:55:13 UTC and returned HTTP 200 at 15:55:14. Each original homepage query was preserved verbatim for its source GET, privately; none was stripped or published. Source GETs used manual redirects, a 15-second timeout, no Cookie and no Authorization.

All three exact tracked sources returned HTTP 200 with distinct item titles, description metadata and explicit query-free canonical links. Body inspection found no bot wall, password form, auth, rate or HTTP-error response. The first item also carried Product JSON-LD. The second did not match a Product JSON-LD block, so the proposed operation was narrowed to document metadata. Neither hidden streaming markup nor a weakened extractor was used.

Canonical requests were separately grounded by the actual documents' canonical links. The tested title, description and canonical identity matched their original tracked sources. This does not assert general tracking-query equivalence or equivalent state for other fields. A final private audit confirmed every original query value is absent from the saved spec and notes.

Two genuine frontend captures ran under the atomic global browser mutex and a fresh gate each, using the unchanged `bench/discovery/capture-document.mjs`:

| Capture ID | Exact requested canonical document | Status | Exchanges / aborted others | Helper time |
| --- | --- | --- | --- | --- |
| `cmvpfwx7r88dc40` | `https://www.vinted.com/items/10544127958-precious-moments-tender-tails-ornaments` | 200 | 115 / 114 | 9,441 ms |
| `cmvpfxoo02e479f` | `https://www.vinted.com/items/10544122490-aritzia-grey-sweatpants-tall` | 200 | 114 / 113 | 2,777 ms |

Both final URLs were unchanged. Each actual captured body was inspected after the helper returned: all three metadata fields matched its independently retained tracked source. Only the exact GET document was sent. Other recorded requests were aborted. The first capture had no Cookie or Authorization; the second reused only site-issued guest cookies in this batch's isolated profile. The helper has a 15-second bound; inline scripts may execute, other requests are aborted and redirects are unsupported. This is exact-document capture evidence, not fully hydrated GUI proof. The Shopee monitor was never used.

## Qualification receipts

Ignored evidence is `bench/explore/state/discovery/vinted-qualified-r4/`. All executable workload commands used an absolute isolated `API_ANYTHING_HOME` beneath that directory.

1. `learn-receipt.json`: offline `addOperation` from the two actual capture IDs, distinct examples and document recipe. Preview matched source 1, `minTier:1`, `learnedLoggedIn:false`, one `path:1` slot, no learned warnings or unproven mark. Candidate public export plus draft-notes `vetShared` preflight had **zero errors, zero warnings and zero secrets** before heldout/fresh/verification requests.
2. `item3-summary.json` and `item3.html`: independent third-input exact-anchor source GET at 15:59:29 UTC, completed 15:59:30, HTTP 200. It established the Hollister item title, summary and canonical identity before the operation call.
3. `heldout-receipt.json`: unseen third input replayed once at **tier 1**, 1,017 ms, no heal. One returned row, page title, complete summary text including line break, canonical URL and requested item identity all matched the independent source (five assertions). HTTP body retained privately. No output was accepted from `ok:true` alone.
4. `verify-receipt.json`: `verifySite('vinted',{maxTier:1})` passed both the public example and differing apparel check, 802/962 ms, no heal. Both actual response bodies also matched all three independent source metadata fields in `final-audit.json`.
5. `export-receipt.json`: public-example `exportSite(...,{keepExamples:true})` had no secrets/warnings and was byte-identical to the preflight candidate. The exported operation was installed before live qualification, so the current verification hash matches the exact export.
6. `fresh-receipt.json`: a separate initially empty absolute `fresh-home` installed the exact candidate/export. Its **first operation request had Cookie:false and Authorization:false**, returned HTTP 200, tier 1, 816 ms, no heal, and matched all five third-input assertions. It received site guest cookies only after that first request. The normal qualification home's heldout and verification requests used only guest cookies issued within this signed-out batch; no cookie values appear in receipts.
7. `final-audit.json`: exact saved `sites/vinted.json` plus `sites/vinted.md` parsed with the real schema and passed **zero-error, zero-warning `vetShared`** at 16:02:37 UTC. It checked export byte identity, notes identity, export/heldout/verification/fresh operation hash agreement, empty-home and first-header evidence, both verification cases and semantic comparisons. No operation or notes edits followed.

Current operation/check-record hash: `bfade3d90d213261`.

Saved JSON SHA-256: `86fde09488f6f1f34189ddfa7cb71d7fc34dc7e0a62a1915a2a3ec73a554adb8`.

Saved notes SHA-256: `294ced3e6944b9f04ec00d4d366e4b829b47b426af20624a969a9fc8188d6056`.

Two local helper failures are preserved rather than hidden. Source 2's command exited 2 because its initial post-read completeness check expected Product JSON-LD; its real HTTP 200 metadata remained valid. The current metadata recipe handles it without changing the core. The initial final-audit command exited 1 on an incorrect local `siteSchema` import before any request; it was corrected to the existing `SiteSchema`, freshly gated and passed. Neither was a site auth/control response. No fresh-home pre-fetch assertion failed.

## Resource policy, provenance and cleanup

Every expensive/network/browser command used `python3 bench/discovery/resource_gate.py --admit 90 --hard 95 -- ...`. The helper retained CPU admission below 65% and sampled CPU stop at 85%; memory admission was below 90% and sampled memory stop at 95%. The helper and both prior exact-anchor and exact-document helpers remain unchanged. The old 88%/90% memory defaults did not govern this run.

All workload admissions succeeded; no exit-75 resampling was needed. Across recorded admitted command samples, CPU peaked at **40.62%**, policy non-cache memory at **89.66%**, and raw occupied memory at **99.70%**. These are separate metrics. The two-second watchdog samples do not prove an unsampled/global cap or constrain unrelated programs. The work completed within the 20-minute batch bound, on Vinted only.

`batch-receipt.json` contains the resource samples, thresholds, peaks, gate index, explicit local helper failures, tracking-absence boolean and cleanup. `artifact-sha256.json` contains full hashes for raw sources, genuine captures, scripts, request/body proofs, receipts, spec and notes. Selected source/helper provenance:

- `bench/explore/state/discovery/home-resale-qualified-r1/vinted-root.html`: `b797935c3bd5721baf05b8c90192f0a9587494227e9805593f1b44bfb07e475e`.
- `bench/explore/state/discovery/vinted-qualified-r4/item1.html`: `2d1bdc7c8584b61b2369a7a0bc55d07e74153b93e7f34e013bd1e2f25a8b0d7d`.
- `bench/explore/state/discovery/vinted-qualified-r4/item2.html`: `21fd976fea76cc0212f785010a4a51d816a46f79cc47603f2e2a5e1d31d367db`.
- `bench/explore/state/discovery/vinted-qualified-r4/item3.html`: `42bcdb1b69b0abef9fa48476b81d5d01be7ca07760ce098a9d19f99ee7097aca`.
- `bench/discovery/capture-document.mjs`: `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`.
- `bench/discovery/resource_gate.py`: `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08`.

Both captures atomically acquired `browser.lock`, recorded distinct owned random tokens and released only their own locks after child exit. All owned commands exited, no matching owned helper/profile processes remained, and the global browser mutex was absent at cleanup. Isolated homes and raw evidence were retained privately. No unrelated process was stopped or file changed. Parent alone should audit these receipts and run the focused registry gate before counting this addition as integrated.
