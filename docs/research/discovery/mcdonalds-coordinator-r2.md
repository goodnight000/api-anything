# McDonald's retained-candidate continuation

Superseded by successful final qualification in [round 3](mcdonalds-coordinator-r3.md). The following records the earlier deferred version.

2026-10-26 UTC. Qualification is incomplete pending the final export audit, JSON-plus-notes vetting and integrated registry gate. No McDonald's coverage is counted yet. This continuation uses the two genuine captures and local candidate from `mcdonalds-qualified-r1.md`; no browser or new capture was needed.

## Completed proof

- Candidate `getProduct(productSlug)` accepts an existing US product URL segment without `.html`, preserving size prefixes. It returns the product heading, canonical URL, document locale, source product ID and description. Detailed nutrition, allergens, restaurant availability and prices remain outside scope.
- Existing actual frontend examples are Big Mac `cmvpdlgxc5e67cc:1` and Small Fries `cmvpdoim09b1967:1`. Parent preliminary receipt inspection found distinct product IDs, source URLs matching both examples, no credential headers and zero learning warnings. That preliminary inspection alone was not independent replay proof.
- Held-out `productSlug=egg-mcmuffin` ran at tier 1 at 15:00:54 UTC from an initially empty separate home, using the actual public-example export. The one request sent no Cookie or Authorization and returned HTTP 200 without healing or truncation. Result identity was Egg McMuffin, source product ID `200298`.
- A separate signed-out GET at 15:02:08 UTC returned HTTP 200. Direct labeled HTML inspection matched all five fields exactly, including 310-calorie and Canadian bacon prose. Suggested-meal language remained inside the publisher description and was not interpreted as meal nutrition.
- Verification of that same exported operation passed 2/2 cases at tier 1 at 15:02:59 UTC. It covered Big Mac and Small Fries without healing. These requests reused only visitor cookies issued by McDonald's after the successful initially cookie-free replay. No account or private browser state was imported.

The first verification helper rejected those visitor cookies before sending either request. Its two cases were locally inconclusive, with zero network sends. A parent-owned helper then permitted site-issued guest cookies while still prohibiting Authorization; the corrected verification passed. The original failure and successful receipts are both retained. This was a helper assertion error, not a site access-control response.

## Exact evidence

Ignored evidence root: `bench/explore/state/discovery/mcdonalds-qualified-r1/`.

- Initial export: `export.json`, with zero findings in `export-audit.json`.
- Initially empty-home reuse: `fresh-getProduct.json`, `parent-unseen-r2.out`, `parent-unseen-r2.resources`; home `fresh-getProduct/`.
- Separate source and comparison: `parent-heldout-source-r2.{html,json}`, `parent-heldout-comparison-r2.json`, `parent-compare-r2.{out,resources}`.
- Rejected local assertion: `parent-verify-r2.{out,resources}`, original `verify.json`; no requests sent.
- Corrected verification: `parent-verify-r2-final.{json,out,resources}`, current record in `fresh-getProduct/checks/mcdonalds.json`.
- Final audit/save attempts: `parent-save-r2*`; pending until an admitted command succeeds. Candidate caller/maintainer notes are `parent-notes-r2.md`.

All expensive commands retained CPU admission/stop 65/85% and bounded browser-free memory admission/stop 89/90%. No browser, mutex, imported session, login, website write or publication occurred. Raw occupied RAM including cache exceeded 95%; no global or unsampled ceiling claim is made. Resource denials and final cleanup will be summarized after the remaining gate finishes or exhausts its bounded retries.

## Final admission deferral

The final offline audit/save command was denied initially at 15:03:47 UTC, memory 89.53%, then after three explicit 30-second waits at 15:04:50, 15:06:06 and 15:07:10 UTC, memory 89.94%, 90.76% and 89.89%. All four stdout files are empty and no audit child launched. This exhausts the continuation's retry window. No `sites/mcdonalds.*` file was saved and the operation remains uncounted.

The exact candidate export, independent comparison and two passing verification cases remain available without repeating website requests. Resume with the existing `parent-save-r2.mjs` against the final `fresh-getProduct` home after fresh bounded-offline admission. Then run the focused all-bundled registry test before counting it.

This continuation's 12 host samples peaked at CPU 57.80%, policy memory 90.76% and raw occupied RAM 99.69%. Denied snapshots are included; no command ran at those denied peaks. All owned commands exited. No browser or mutex was acquired, no site file exists and no publication occurred. `parent-cleanup-r2.json` records the final state.
