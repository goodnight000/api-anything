# Costco product metadata qualification

2026-10-26 UTC. **PASS**, including the parent bundled registry gate. Saved `sites/costco.json` and `sites/costco.md`. This continuation finished the retained r6 candidate without another browser capture. Preparation, source-link provenance and capture restrictions are in [r6](costco-coordinator-r6.md). Source HEAD remained `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd` on the shared discovery branch. No source, dependency, website write, browser-session import, publication or git mutation occurred.

## Operation and tested meaning

`getProduct(slug, catalogId)` returns an object with `name`, `itemNumber`, `brand`, `url` and `description`. The slug and catalog identifier must come from the same public canonical product link. Published item numbers differ from catalog IDs. Brand can be an empty string; description is the structured summary and may include promotion or feature prose.

| Case | Slug | Catalog ID | Published item number |
| --- | --- | --- | --- |
| A | `lg-s80ty-313-ch-soundbar-with-wireless-subwoofer` | `4000400860` | `1738485` |
| B | `uber-two-50-egift-cards` | `4000282374` | `1844199` |
| Held-out C | `costco-shop-card` | `10024438` | `1695786` |

Actual canonical requests are `https://www.costco.com/p/-/{slug}/{catalogId}`. These are US public documents. No catalog enumeration, arbitrary search, price, selected variant, member eligibility, stock, fulfillment or gift-card purchase/redemption operation was qualified. The Shop Card document labels the product member-only while exposing public metadata; this establishes no purchase entitlement.

## Evidence and checks

Ignored evidence root is `bench/explore/state/discovery/costco-coordinator-r6/`. Genuine frontend captures A/B were `cmvpg3yj0dd7912:1` and `cmvpg59ynb45d38:1`, HTTP 200. The unchanged exact-document helper aborted other requests under the owned global mutex. These are actual requested documents, not fabricated HTTP captures or fully hydrated GUI evidence.

Offline r6 learning used both captures. `preflight.json` records no learning warnings, minimum tier 1, no export warnings/secrets, and zero candidate-plus-draft-notes vet issues. No operation change was needed in r7. Current operation hash is `5e12eb81a1b67a0d`.

The independent C source was fetched in r6 before its operation replay. Its retained body hash is `64357a20ee624e9d82fc75ffbd7356e7dd052843f3c9fde2f67ebfed66bcb3ce`. In r7, `ground.json` independently parses the document's Product JSON-LD, checks the visible `Costco Shop Card` heading, visible `Item 1695786` context and canonical URL, and records the structured summary and empty brand. This does not use the operation's extractor to manufacture expected values.

| Receipt | Observed result |
| --- | --- |
| `heldout.json`, 16:18:16 UTC | One tier-1 GET, no healing, HTTP 200; all five fields exactly matched independently grounded C. Used only guest cookies already issued to the isolated capture home. |
| `verify.json`, 16:18:31 UTC | Example A plus checks B/C all passed at tier 1 without healing. Actual `home/checks/costco.json` records the current hash. |
| `final-costco.json` | Public-example export exactly equals the qualified candidate; no export secrets or warnings. |
| `fresh.json`, 16:18:44 UTC | Separate home started absent/empty. Installed only the exact export. First C request sent neither Cookie nor Authorization, returned 200 and matched all five fields. |
| `final.json`, 16:19:13 UTC | Exact saved JSON and final caller notes passed `vetShared`, zero errors/warnings. Current hash matched actual verification record. |
| `../integrated-20261026T1619.out`, 16:19:42 UTC | All-bundled shared-rules test passed, one selected test, zero skipped. |

The final JSON SHA-256 is `e01910724da3ca6535bc7f80298434fa5c99f2ed6b2ea27aa5a49ff50c782e39`; caller-notes SHA-256 is `c4d3d7a860a010ae62a5af0f730abf9471d8510c97262593ffaaa5cf326f97eb`. These hashes are provenance receipts, not parameters or secrets.

## Local failures and resources

Two offline independent-inspection assertions failed before any network request. The first searched for JSON-LD after `parseShown` had intentionally removed scripts. The correction reads structured metadata through a separate raw document parser while retaining visible heading/item checks. The second incorrectly required a nonempty brand; the source explicitly publishes an empty string for Shop Card. Corrected that assumption and documented it. No core extractor or spec behavior was changed. Initial and corrected script outputs remain in `ground*.out` and `ground*.resources`; `ground-failure.json` retains the later local assertion failure. These were helper errors, not website failures.

The initial held-out command was denied admission at 16:16:51 UTC, policy memory 90.14%, before launch. A 30-second sleep was interrupted after 23 seconds by a worker result; an additional 10-second sleep completed before the sole resample. `heldout-retry1.resources` records admission at 88.90%. No own site request ran during that wait. All later expensive commands independently used `python3 bench/discovery/resource_gate.py --admit 90 --hard 95`, retaining unchanged CPU admission 65% and cutoff 85%.

`r7-resource-summary.json` retains 11 continuation samples: peak CPU 30.77%, policy memory 90.14% including denied admission, admitted/running policy memory 89.47%, and raw occupied memory 99.68%. Policy memory excludes file-backed cache. Raw occupied RAM is separate, exceeded 95%, and is not evidence of a maintained global or unsampled ceiling. No watchdog termination occurred. Final vet and registry check were offline. All parent commands exited; this continuation launched no browser and acquired no browser mutex. Isolated evidence homes are retained. The Costco claim was released after integration, and other workers' files were preserved.
