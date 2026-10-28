# Gumtree qualification r4, 2026-10-26

PASS for worker qualification. Saved `sites/gumtree.json` and `sites/gumtree.md` after every assigned worker gate passed. Parent receipt audit and the focused registry gate remain required before integration. No integrated-check, publication, price-freshness or listing-availability claim follows.

The shared dirty branch is `t3/reverse-engineer-high-leverage-apis`, source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, checked before and after the workloads. Read `AGENTS.md`, `docs/DESIGN.md`, `CONTRIBUTING.md`, `skills/api-anything/SKILL.md`, `bench/discovery/README.md`, current `bench/discovery/state.json`, [classifieds-source-prep-r1.md](classifieds-source-prep-r1.md), and Gumtree r1/r2/r3. State explicitly assigns this worker Gumtree only. No nesting occurred. Work ran approximately 17:24 to 17:31 UTC, within the 20-minute bound. Only the two assigned site files, this report, and ignored evidence under `bench/explore/state/discovery/gumtree-qualified-r4/` were written.

## Operation and exact public inputs

`getListingMetadata(category, slug, adId)` returns only `adId`, `title`, `askingPrice`, `currency`, and `url`, selected from Product JSON-LD in the public UK listing document. `askingPrice` is a decimal string containing the asserted item price, excluding buyer-protection, delivery and suggested offer amounts. The result carries seller assertions, without authenticating product condition. Seller, contact, profile and location fields are excluded.

| Role | category | slug | adId | Observed item amount |
| --- | --- | --- | --- | --- |
| Learning A | `kids-bikes` | `frog-55-kids-bike-purple` | `1804023430` | GBP90.00 |
| Learning B | `hybrid-bikes` | `ridgeback-velocity-ladies-hybrid-bicycle-with-kryptonite-lock-step-through-frame-` | `1803965714` | GBP75.00 |
| Heldout C | `folding-bikes` | `blue-brompton-6-speed-2021-c-line` | `1803924977` | GBP775.00 |

Source and exact GET request URLs are identical for each input:

- A: https://www.gumtree.com/p/kids-bikes/frog-55-kids-bike-purple/1804023430
- B: https://www.gumtree.com/p/hybrid-bikes/ridgeback-velocity-ladies-hybrid-bicycle-with-kryptonite-lock-step-through-frame-/1803965714
- C: https://www.gumtree.com/p/folding-bikes/blue-brompton-6-speed-2021-c-line/1803924977

All three URLs came from actual source links recorded in source preparation. Category and slug are exact path components from a public listing URL, not search filters. The three components changed together in this qualification; independent server sensitivity to category or slug was not proved. Only these public UK listing examples were checked. Removed listings may fail. No complete search, inventory, availability, regional coverage beyond the UK, or authenticated condition guarantee is provided.

## Retained capture audit and offline learning

No recapture or new browser run occurred. Genuine frontend captures A `cmvphvdyk842c88:1` and B `cmvphw6b6fa88fa:1` were read in place from `../gumtree-qualified-r1/home/captures/` relative to this batch's evidence directory. They were originally made by the unchanged exact-document helper, under the global mutex and 15-second bound, with only the exact GET document allowed and all other requests aborted. There is no fully hydrated GUI claim. No HTTP read was synthesized into a capture.

The current unchanged `parseShown`, `extract`, `botWall` and `judge` inspected both actual retained bodies before new Gumtree traffic. Both were HTTP 200, had no bot wall, classified `ok`, and returned all five fields. H1 and extracted titles matched after comparison whitespace normalization only. A returned `Frog 55 Kids Bike – Purple`, `90.00`, GBP. B returned `Ridgeback Velocity ladies hybrid bicycle with Kryptonite lock, step through frame`, `75.00`, GBP. Their visible item prices were distinct from buyer-protection amounts GBP5.20 and GBP4.45. Hidden streaming markup was not treated as visible and the parser/extractor was not weakened. A's original captured request had Cookie=false and Authorization=false; B had Cookie=true and Authorization=false. These capture booleans do not substitute for fresh-home reuse.

The retained r3 draft initially failed locally at save-time schema validation. Contrary to the earlier draft assumption, current `AddInput.response` also requires `embedded: {regex}`, as does extraction; the CLI accepts a string and wraps it before calling `addOperation`. The corrected ignored script used the object shape in both places. Global fetch and `addOperation.fetchImpl` refused network throughout learning. The real `addOperation` then succeeded from A/B with no warnings, `minTier:1`, `learnedLoggedIn:false`, no volatile anchors and no `unproven` mark. C was not a learning example; it was reserved as a later check.

Metadata used simple bounded character classes: `[a-z0-9-]{3,180}` for category/slug and `[0-9]{6,16}` for adId. Public-example candidate export reported no secrets and no warnings. Candidate JSON plus draft notes passed `vetShared` with zero errors and warnings at 17:26:19 UTC, before any new Gumtree request. Receipts are `capture-inspections.json`, `added.json`, `candidate.json`, `candidate.md`, `preflight-vet.json` and `preflight.json`.

## Independent heldout meaning comparison

At 17:27:14 UTC a separate cookie-free, Authorization-free Node GET fetched C with manual redirects and a 15-second timeout. Its actual 524,721-byte body was inspected immediately: HTTP 200, no redirect, no bot wall, `judge` class `ok`, readable H1 `Blue Brompton 6 speed 2021 C Line`, and matching canonical URL/identity. The initial independent visible-price assertion assumed A/B's `Private£...` layout and failed locally. No further request was used to resolve it. Offline inspection of that exact saved body found visible `[data-q="ad-price"]` text `£775`. The amount is separate from suggested-offer buttons showing GBP697.50, GBP658.75 and GBP620.00.

`source-c-grounded.json` therefore grounds identity and URL from the canonical link, title from visible H1, item amount from visible `ad-price`, and GBP from the pound sign on the UK listing page. This comparison source does not use the Product JSON-LD recipe. `parseShown` remained unchanged. The first price assertion was a local comparison-script failure, not site auth, a challenge or an extractor gap.

At 17:28:39 UTC, the learned operation called unseen C at tier 1, without healing, and matched every independently grounded field:

```json
{"adId":"1803924977","title":"Blue Brompton 6 speed 2021 C Line","askingPrice":"775.00","currency":"GBP","url":"https://www.gumtree.com/p/folding-bikes/blue-brompton-6-speed-2021-c-line/1803924977"}
```

This heldout call used only guest state in the isolated learning home, including cookies retained from the genuine signed-out captures. It was not the empty-home proof. Receipts are `source-c.json`, `source-c-grounded.json`, `shown-c-audit.json`, `heldout-call.json`, `heldout-requests.json` and `heldout-comparison.json`. Every live body was immediately classified and its five extracted fields compared with visible H1/item-price and canonical identity. The wrapper stops subsequent network requests after an actual control or unsuccessful response; no such response occurred. No website control or transport was bypassed.

## Verification, exact export and fresh reuse

`verifySite('gumtree', {maxTier:1, ...})` passed the stored A example and B/C checks, three of three, without healing. Its current learned-operation hash is `dce013cc2d8be082`. `verify-record.json` matches that hash, and the core checks gate has no errors. Export with public examples preserved the exact preflight candidate bytes, stripped the learned response shape and reported no secrets/warnings. `exact-export.json` and `exact-export-receipt.json` record that export. Its operation hash is `675e28675849ab14`; the difference from the learned hash is the exported response shape removal, not an unverified request change.

Fresh reuse used the absolute initially absent home `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/gumtree-qualified-r4/fresh-home`. It installed only the exact candidate/exported spec. The first operation request was C, Cookie=false and Authorization=false, and succeeded at tier 1 with all five independently grounded fields. That response issued guest cookies. Subsequent A/B/C verification requests sent only those site-issued guest cookies from this home, Authorization=false throughout; no session or cookies were imported. All three exact-export cases passed at tier 1, with hash `675e28675849ab14` matching `fresh-record.json` and the exact saved operation. Booleans, not cookie values, are recorded in `fresh-requests.json`.

The batch made nine public GETs: one independent source request, one heldout operation call, three learned-spec verification cases, and four fresh-home operation/verification requests. All answered HTTP 200/class `ok` and all eight operation responses passed visible/canonical meaning comparisons. There were no redirects, auth/challenge/rate responses, repeated site errors, browser fallbacks or heals. The first-call and subsequent-cookie distinction is explicit in `fresh-complete.json`.

At 17:29:58 UTC `final.mjs` checked every preceding receipt, exact export equality and current fresh verification hash, wrote only the assigned site JSON/notes, reread their exact bytes and ran final `vetShared`: zero errors, zero warnings. `final-vet.json` records PASS. JSON SHA-256 is `76817bc26b0ac7119160b278155c68c35efb53bb542fb4d388023feb7515dd4b`; notes SHA-256 is `cca06e8dff7bfb35305cd41f9c08e27511e3e5fe1b4940369161dfad06a0143b`. The focused registry test and other integrated checks were not run by this worker and remain parent-owned.

## Resource receipts

The assignment supplied two replacement samples 39.25 seconds apart at 17:22:42/17:23:22 UTC, below CPU65% and policy memory88%, followed by a launch-only snapshot at 17:24:35 with CPU10.07%, policy memory88.96% and raw occupied99.61%. That launch-only snapshot had no child and authorized no workload at 95%.

Every workload below received fresh admission through unchanged `python3 bench/discovery/resource_gate.py --admit N --hard 90 -- ...`. CPU admission/stop defaults remained 65%/85%. Only bounded browser-free tier-1 qualification used N=89. All other workloads used N=88. No workload denial, resample, self-respawn or watchdog stop occurred in this batch.

| UTC admission | Workload | N | Admission CPU | Policy memory | Raw occupied | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| 17:25:56 | Retained audit + initial learning draft | 88 | 30.49% | 85.67% | 99.63% | Exit 1, local recipe shape |
| 17:26:19 | Corrected real learning/export/preflight | 88 | 12.23% | 86.18% | 99.51% | Exit 0 |
| 17:27:11 | Independent C source GET | 88 | 14.44% | 86.78% | 99.33% | Exit 1 after readable response, local price layout assertion |
| 17:27:29 | Saved C visible-body audit | 88 | 9.24% | 87.05% | 99.66% | Exit 0, no traffic |
| 17:28:29 | Independent C grounding from saved body | 88 | 14.90% | 85.90% | 99.69% | Exit 0, no traffic |
| 17:28:37 | Unseen tier-1 comparison | 89 | 15.13% | 86.27% | 99.66% | Exit 0 |
| 17:28:46 | Learned verification + exact export | 89 | 34.79% | 86.64% | 99.28% | Exit 0 |
| 17:29:02 | Empty-home first call + exact-export verification | 89 | 13.68% | 87.08% | 99.66% | Exit 0 |
| 17:29:58 | Save exact files + final vet/provenance | 88 | 10.27% | 86.82% | 99.64% | Exit 0 |

Across all observed admission/runtime samples, maxima were CPU34.79%, policy non-cache memory87.27%, raw occupied99.74%. Among watchdog samples after admission, CPU peaked at27.16%; that last sample was emitted after the Node child had finished. The supplied launch snapshot's policy memory88.96% was higher but had no child. These are sampled observations, not continuous peaks, a global cap or an unsampled guarantee. Exact admission and runtime samples are in the nine named `.resources` files. No unrelated process was stopped.

## Provenance

Fresh offline hashes below identify reused immutable captures and the current documents/helpers. `provenance-final.json` additionally records full hashes of all learning/qualification scripts and JSON receipts. All provenance hashes remain in maintainer research/evidence, not caller notes.

| Artifact | SHA-256 |
| --- | --- |
| `AGENTS.md` | `6f5be3bffedef5266ff2bd35c62ba8dd6337563f0f7bd6edb50d7738769fe91d` |
| `docs/DESIGN.md` | `62c519e2036bac771031b402b565674bf6d2d6baa9591e44e881044a164aa275` |
| `CONTRIBUTING.md` | `1780fbcb3997fc5e19f108cb2155ce85829ac3ef86bb713cd74de7a6eaa3009d` |
| `skills/api-anything/SKILL.md` | `f67c92e6f88be19e8565c75c0685cb4cb8e878fbf287bc403c40cc0508007e52` |
| `bench/discovery/README.md` | `c08815b5b00e4a642fc295f8a2b0711f88cef514d8e06dd4ee2689c2c3894552` |
| Unchanged exact-document helper | `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663` |
| Unchanged resource gate | `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08` |
| Source preparation report | `da490c6e15521ad48c24cc179adc24b2f9f36f8ddccad1bd881ff38ed97b8cef` |
| Gumtree r1 report | `2c24a1c058997c4a7e1c9142c00c41711db1c800ea09b20e000f83d8409d980f` |
| Gumtree r2 report | `a7fa5c76083badf9f7fff8ff69927391fe62aeabeef1ebb89572b47b9fa3e878` |
| Gumtree r3 report | `eef998595441b863f6a69a91acfeb9f9f9a9b45a0ffe11f35b806b03cca22947` |
| A capture `cmvphvdyk842c88` | `397c7a890fdbd4c88e73957ab445ef29af566030878c396ac8bcd386d729d198` |
| A retained body | `33cd303c75bb25f495a0ebd246a0ea0fc8dcd8f1f653d03aeeb6aaa7444aba58` |
| B capture `cmvphw6b6fa88fa` | `099777fad0bf9c6c25ec6edb1aba4e11f793f65206ea72dfdb8b6cefe8908db1` |
| B retained body | `98eb98dd57f01c603747625ecc327d71bbadd020cec029e442a7da378d59e8c5` |
| Independent C source body | `dd1987794f56701d12c4c7c22fa0a741cbc5f9540ceb3b6326acb3c4b315aa42` |
| Saved JSON / exact export / candidate | `76817bc26b0ac7119160b278155c68c35efb53bb542fb4d388023feb7515dd4b` |
| Saved notes / candidate notes | `cca06e8dff7bfb35305cd41f9c08e27511e3e5fe1b4940369161dfad06a0143b` |

## Cleanup and handoff

All nine workload commands exited. A process-list inspection found no owned Node/browser workload remaining; only the inspection's own shell/search matched the batch names. No browser or global mutex was acquired by this batch, so no lock was released; the global lock was absent at final inspection. Both absolute isolated homes and retained captures remain ignored evidence. No everyday browser import/login, website write, CAPTCHA/control action, proxy, source/dependency/helper edit, other-site/frozen-spec edit, state/runbook/catalog mutation, commit, push, PR or publication occurred. Existing shared dirty work was preserved. Parent should audit the exact receipts and run its focused registry gate before integration.
