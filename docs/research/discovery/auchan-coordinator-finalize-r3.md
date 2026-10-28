# Auchan coordinator finalization

2026-10-26 UTC. **PASS.** Saved `sites/auchan.json` and `sites/auchan.md`. The exact exported version passed three tier-1 verification cases, independent held-out meaning comparison, empty-home first-call reuse, final shared vetting and the parent bundled registry gate.

## Contract and limits

`getProductDetails(slug, productId)` returns a one-item list with `title`, `brand` and ordered `specifications`. The last field contains French label-and-value text blocks from the general characteristics section, including the description when supplied. It is not the entire technical specification. The slug and C-prefixed product ID must come from the same public product link.

Prices, seller offers, stock, delivery, store availability, reviews and selected variants are excluded. Only three LEGO products were tested. Titles can omit the brand. General characteristics differ across products. Marketplace onboarding targets professional sellers; the bounded primary-page screen did not establish an anonymous consumer API equivalent or prove that none exists.

## Capture and learning provenance

The [worker report](eu-shopping-r2.md) records genuine signed-out exact-document browser captures `cmvphoh38cdd363:1` and `cmvphp22n853513:1`, both HTTP 200. The first captured 60 exchanges with 59 aborted; the second captured 56 with 55 aborted. These are frontend document captures, not HTTP reads converted into fabricated browser exchanges. They do not prove a fully hydrated GUI. The worker completed offline learning and initial qualification but resource admission denied its final export.

The parent reused that retained candidate without browser recapture. Offline candidate export plus draft-notes `vetShared` preflight returned no errors or warnings before live reuse. Historical learned hashes are not the final acceptance version. The exact exported operation hash is `a4799e08044e10cf`.

| Case | Slug | Product ID |
| --- | --- | --- |
| Learning A | `lego-city-60337-le-train-de-voyageurs-express-telecommande` | `C1553147` |
| Learning B | `lego-friends-42687-la-maison-de-famille-de-liann` | `C1849115` |
| Held-out C | `lego-city-60316-le-commissariat-de-police` | `C1486035` |

Source and recorded request URLs are `https://www.auchan.fr/<slug>/pr-<productId>` with the exact pairs above. No authentication, challenge or rate response was observed during this finalization.

## Independent meaning and exact-version proof

The parent independently parsed the retained third-product source `bench/explore/state/discovery/eu-shopping-r2/auchan-heldout-source.body` using the current visible-markup parser. It read the heading, LEGO brand and labeled general characteristics separately from the operation result. Its SHA256 is `b3450bd484d3f3e1984aa75e15f75644890fc1be10c49fd5f9257fc236bb1eea`.

The expected third product is `City 60316 - Le commissariat de police`, brand LEGO. Its four general-characteristic rows contain the descriptive paragraph, `LicenceCity`, `Nombre de pièces668` and `Age minimal6`. All three returned fields, including the full ordered four-row specification list, matched that independently grounded expectation.

At 17:01:23 UTC the exact export was installed into a separate initially empty home. The first held-out tier-1 request sent neither Cookie nor Authorization and returned HTTP 200. Subsequent A/B/C verification reused only site-issued guest cookies; Authorization remained absent. All three `verifySite(maxTier:1)` cases passed without healing on hash `a4799e08044e10cf`. Re-export from that home equaled the installed export.

Final exact JSON plus notes `vetShared` at 17:02:06 UTC returned zero errors and warnings. Final file SHA256 values are:

- JSON: `376132c257b044d16a3ec49fe849d1b6a5ce34579a6f22e5b5a996879841b669`
- Notes: `1912cb17604c3f8fc2a7bf64dad6b6c0f06eb51ec1b58e02810f7c5f03823559`

The focused parent registry gate at 17:03:48 UTC selected `every bundled spec passes` in `test/registry.test.ts`: one test passed, zero failed or skipped. This local registry gate did not repeat live website verification. Integrated totals are now 37 sites, 43 operations and 125 passing cases, including 122 tier-1 reads and three local input-format refusals.

## Receipts, resources and cleanup

Ignored parent evidence is under `bench/explore/state/discovery/auchan-finalize-r3/`: `stage.json`, `ground.json`, `auchan-export.json`, `fresh-verify.json`, `fresh-home/checks/auchan.json`, `final.json`, response bodies and per-command resource receipts. Parent registry output is `bench/explore/state/discovery/integrated-auchan-current.out` with its `.resources` companion.

General offline work used explicit memory admission 88% and stop 90%; bounded tier-1 fresh reuse and verification used 89%/90%. CPU defaults remained admission 65% and stop 85%. Initial staging admission was denied at 91.47% non-cache memory without launching a child; after the required wait its sole retry admitted at 86.93%. Fresh verification admitted at 83.46%, with recorded running samples 83.92% and 84.31%. Final offline vet admitted at 86.49%; registry gate at 85.50%. The successful staging and fresh admissions were 44 seconds apart, satisfying the sustained-headroom rule. Each later command still needs fresh admission.

Raw occupied RAM in successful parent samples reached 99.68%, reported separately from non-cache memory. These samples do not establish a global or unsampled ceiling. All parent commands exited. No browser or mutex was acquired by parent finalization. Shared source, helpers, other sites and the four frozen publication candidates were preserved. No website writes, private cookie imports, commits, pushes, PRs or publication occurred.
