# Home and apparel qualification r1

Status: **BLOCKED**. Lowe's stopped after its first public product request returned HTTP 403. UNIQLO produced two real frontend document captures and a learned local metadata template, but resource admission prevented the next check. Zero reusable operations were qualified, and no `sites/lowes.*` or `sites/uniqlo.*` files were saved.

Recorded 2026-10-26 UTC. Site work ran from 11:05:33 through cleanup at 11:10:02, within the 20-minute batch. Shared dirty branch was `t3/reverse-engineer-high-leverage-apis`, inspected HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. This worker read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the experimental document helper, current registry filenames/state/reports, and home-apparel-source-prep-r1.md including the coordinator assessment. No existing Lowe's or UNIQLO spec was found. The partner API documentation was not treated as excluding ordinary public Lowe's metadata.

Only this report and ignored batch evidence were written. No nested work, source/dependency edits, commits, push, PR, publication, private browser import, login or site write occurred. State, runbook, catalog, frozen sites and other workers' files were left untouched. Home Depot, TheFork and Decathlon were not probed. Parent owns integrated checks.

## Lowe's stop

The first and only Lowe's request was the exact sourced GET:

`https://www.lowes.com/pd/CRAFTSMAN-20-volt-Max-1-2-in-Keyless-Cordless-Drill-1-Batteries-Included-and-Charger-Included/5018700285`

At `2026-10-26T11:05:35.717Z` the signed-out, cookie-free Node source read returned HTTP 403, 540 bytes, title `Access Denied`. Lowe's stopped immediately. No browser capture, alternate host/route, second product, replay or learning followed. The previously sourced URL product ID `5018700285`, item `6812913` and model `CMCD702D1` were not verified in this response. There is no qualified operation, price, inventory, location or purchasing result.

Evidence: `lowes-source.html`, `lowes-source.meta.json`, `lowes-source.command.json`, and `lowes-source.attempt0.{out,resources.jsonl,exit}` under the evidence base below. The HTTP read is source evidence, not a browser capture.

## UNIQLO capture and local learning

All URLs are Denmark English. The two actual captures used `bench/discovery/capture-document.mjs` with the exact-GET-only policy, 15-second document timeout, atomic global browser mutex and watchdog. Each returned its requested document with HTTP 200 and no reported challenge. Other captured requests were aborted. Inline scripts could execute. This establishes server-rendered document traffic, not a fully hydrated GUI or working interactive variant controls.

| Exact source and captured request URL | Capture ID | Document ID | Exchanges / aborted | Approximate UTC completion |
|---|---|---:|---:|---|
| `https://www.uniqlo.com/dk/en/products/E489013-000/00` | `cmvp5inuvb11ebe` | 1 | 46 / 45 | 11:06:25 |
| `https://www.uniqlo.com/dk/en/products/E422992-000/02` | `cmvp5j75n11a298` | 1 | 47 / 46 | 11:06:50 |

The first URL also had an independent cookie-free source read at `11:05:52.035Z`, HTTP 200, title `Men's DRY-EX T-Shirt | UNIQLO DK`, 1,050,981 bytes. Local source inspection found actual product markup and `window.__PRELOADED_STATE__`. It distinguished the visible `30-Day Lowest Price: 129 DKK` from a current price. No price field was learned.

`addOperation` learned a local `uniqlo.getProduct(routeProductId, routeSuffix)` from those two saved captures at `11:07:38.863Z`. It reported no warnings and `minTier: 1`. The two learned slots are the actual path segments `path:3` and `path:4`. The generated matcher is GET on `www.uniqlo.com`, `/dk/en/products/*/*`. This is a candidate in the isolated home, not a registry contribution or a PASS.

Exact learning examples:

- `routeProductId=E489013-000`, `routeSuffix=00`.
- `routeProductId=E422992-000`, `routeSuffix=02`.

`routeProductId` is the complete route identifier, constrained locally to `E[0-9]{6}-[0-9]{3}`. `routeSuffix` preserves the exact final route component, locally constrained to two digits. The embedded product calls it `priceGroup`; this does not establish a selected color, selected size, price amount or independent meaning for arbitrary suffix combinations. Callers would need to preserve both components from a real product link.

The candidate returns `name`, `routeProductId`, `routeSuffix`, `displayedProductIds`, `composition`, `care` and `gender`. The first two route fields come from embedded `productId` and `priceGroup`; `displayedProductIds` preserves the complete `l1Ids` list, rather than replacing it with route digits. `composition` and `care` are the product's source text. No selected variant, current/historical price, membership, stock or delivery field is returned.

| Captured identity | Displayed product IDs in source state | Fabric composition | Care distinction |
|---|---|---|---|
| DRY-EX T-Shirt, `E489013-000/00` | `489013` | 40% Polyamide, 30% Polyester, 30% Polyester - Recycled Fiber | Machine wash up to 40 degrees, gentle cycle; do not dry clean; not suitable for tumble-drying |
| Crew Neck T-Shirt, `E422992-000/02` | `461556`, `455360` | 100% Cotton | Machine wash up to 40 degrees, gentle cycle; do not dry clean; suitable for tumble-drying |

The embedded recipe anchors the product object inside `pdpEntity`, using a wildcard for its varying map key rather than extracting through the first example's ID. Offline inspection found exactly one such match in each captured document. Generality to the held-out product remains unproved. The source's default color/size and representative variant are not assumed equivalent, and no variant argument was learned.

## Held-out source and missing qualification

An independent, signed-out GET fetched the exact previously sourced held-out URL:

`https://www.uniqlo.com/dk/en/products/E465185-000/00?colorDisplayCode=39`

It returned HTTP 200 at `2026-10-26T11:07:48.922Z`, 1,078,581 bytes, title `Unisex AIRism Cotton Oversized Crew Neck T-Shirt | UNIQLO DK`. This is source evidence only. The query belongs to the actual source link; arbitrary color behavior was not inferred. No call of the learned operation used this product.

The next offline source-audit command, which would have established the canonical URL and visible identity/material/care expectations before unseen replay, was denied before Node started on all four admission samples. These samples were at 11:07:59, 11:08:31, 11:09:02 and 11:09:34 UTC, with memory 89.04%, 89.04%, 89.56% and 89.13%. All exits were 75. Three waits of at least 30 seconds separated the resamples; no site request or browser command ran during those waits. There was no higher-threshold retry or transport switch.

Consequently, there is **no unseen tier-1 replay or independently asserted semantic comparison**, no `verifySite` result with `maxTier: 1`, no export retaining public examples, no fresh-home cookie-free reuse, and no direct `vetShared` result. None is claimed as passing. Preparation scripts named `replay.mjs`, `verify-export.mjs` and `fresh.mjs` were written but never executed. Planned result files such as `unseen-comparison.json`, `verify.json`, `export.json`, `fresh.json` and `vet-spec.json` do not exist. The initially empty fresh home remains empty. No JSON was copied into `sites/`.

UNIQLO encountered no observed auth wall, challenge or 429 in this batch and is resource-deferred, not stopped for a site access control. Lowe's remains stopped for the recorded 403.

## Evidence, resources and cleanup

Absolute ignored evidence base:

`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/home-apparel-qualified-r1/`

Isolated absolute homes beneath it are `lowes-home/`, `uniqlo-home/` and `uniqlo-fresh/`. The site homes began empty, as recorded in `start.json`. Captures remain private files in `uniqlo-home/captures/`; the unqualified candidate is `uniqlo-home/sites/uniqlo.json`. `learn.json` records the learner result and local metadata edits are in that candidate. No capture was fabricated or reconstructed from an HTTP read.

Other receipts are `uniqlo-source.{html,meta.json}`, `uniqlo-heldout-source.{html,meta.json}`, the corresponding command and attempt logs, both `uniqlo-capture*.command.json` and attempt logs, `uniqlo-learn.*`, and `uniqlo-source-audit.attempt{0,1,2,3}.*`. Source-audit stdout files are empty and are not evidence of successful assertions. `run.py`, `read-document.mjs` and the unexecuted continuation scripts are owned helpers under this ignored directory. The evidence directory is mode 0700.

All expensive/network/browser commands were wrapped in `resource_gate.py`. Browser-free commands and the authorized source-grounded document helper used memory admission 89%, stop 90%, with CPU admission 65%, stop 85%. No full-page capture or unknown interactive workflow used the exception. Each browser command acquired the global mutex by atomic mkdir, stored a random owner token, and released only its own lock after its command exited.

Seventeen retained resource samples peak at CPU **56.13%** and gate-defined memory **89.56%**. The peak memory sample was a denied admission. No admitted command was watchdog-terminated. Raw occupied RAM separately peaked at **99.71%**. The runbook metric excludes file-backed cache while retaining anonymous inactive and compressed memory. These are sampled observations, not a guarantee about raw occupied RAM, unrelated processes or unsampled transients.

`resources-summary.json` retains all samples and their originating log names. `cleanup.json`, at `2026-10-26T11:10:02.577672+00:00`, records all owned commands exited, no owned Chrome process using this batch's profile, no global browser mutex, empty Lowe's and fresh homes, and no registry files written. No unrelated process was stopped. Raw responses and isolated guest session evidence remain ignored for parent inspection; this report contains no raw credential values.
