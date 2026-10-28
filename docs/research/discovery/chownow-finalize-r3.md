# ChowNow final qualification, round 3

Coordinator follow-up, 12:10 UTC: the corrected offline cap audit ran successfully against
the actual saved spec and both retained browser documents. Khanom's 14 sections / 126 items
become 6 sections / 58 items at 19,788 characters, with explicit `truncated` output. Chicago's
6 sections / 47 items remain complete at 9,827 characters. Saved JSON plus notes passed
direct `vetShared` with zero errors or warnings. Receipts are `cap-audit.json`, `vet.final.json`
and `coordinator-cap-audit.out` in this batch's ignored evidence directory. No website request
or registry-file rewrite occurred. This resolves the optional count gap recorded below.

The separate parent current-hash/export audit was initially denied admission on its initial
attempt and all three spaced resamples, last at 12:14:09 UTC (89.99% policy memory). A later
continuation passed at 12:17:06 UTC: repository `opHash` matches both passing tier-1 records,
the actual export equals the parsed registry spec, and saved JSON plus notes vet clean.
`audit-chownow-export.json` records that result. The refreshed all-bundled registry test then
passed at 12:17:45 UTC, one selected test and zero skipped, in `integrated-20261026T1218.out`.
ChowNow is now included in the coordinator's 23-site / 28-operation integrated totals.

2026-10-26 UTC, completed 12:08 UTC, within the 20-minute batch. **ISSUES: one qualified public-read operation saved; large-menu truncation is explicit, and the optional final cap-count audit was resource-deferred.** Required capture/learning, unseen semantic replay, current tier-1 verification, export, initially empty-home reuse, and direct spec vet gates passed. Parent retains integrated registry/type/lint/test checks.

Only `sites/chownow.json`, `sites/chownow.md`, this report, and ignored batch evidence were written. Branch `t3/reverse-engineer-high-leverage-apis`, HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Shared dirty work was preserved. No nesting, source/dependency/helper/runbook/catalog/state changes, login/import, writes, commits, pushes, PRs or publication. No Toast requests and no other-site work.

## Operation and scope

`getPublicMenu(restaurantId, locationId)` reads the exact GET document `https://order.chownow.com/order/{restaurantId}/locations/{locationId}` at tier 1. Both required string parameters accept digits and must be copied together from one actual public URL. The learned slots are `restaurantId -> path:1` and `locationId -> path:3`; matching is method GET, host `order.chownow.com`, path `/order/*/locations/*`. Both IDs changed together in the examples; independent variation and arbitrary combinations are unproved.

An embedded JSON-LD recipe selects the source Restaurant object, then picks `name`, `address`, `hasMenu`. `hasMenu[] -> hasMenuSection[] -> hasMenuItem[]` retains menu/section context, item names, optional descriptions and optional offers. Omitted offers stay absent, never zero. Explicit `offers.priceCurrency` is per-source data, USD on the US examples and CAD on the held-out Canadian restaurant. Prices are published schema offers, not configured totals, taxes, stock, availability or orderability. No fulfillment choice, diner location, cart or ordering action was performed.

The embedded JSON-LD is source-document data. Noscript fallback text supplies a separate semantic comparison but is hidden in JavaScript browsers. No fully hydrated visible GUI is claimed. The registry operation has no pagination or section selector. Large menus exceed the runtime's 20,000-character output cap; callers must inspect `truncated` and treat shortened nested results as partial. Khanom's full selected captured object measures 37,295 JSON characters. Exact retained sections/items were not measured because the optional cap audit failed locally, then was denied resource admission. No silent flattening or spec-imposed item limit was introduced.

## Capture and example evidence

The batch reused the two genuine browser captures from `chownow-qualified-r2`, copying their bytes into a new isolated learning home. Originals remain intact. `capture-copy-audit.json` records byte equality and SHA-256. Supported `addOperation` loaded both captures, explicitly selected document 1, and learned minTier 1 without warnings. No fresh browser or fabricated exchange was used. `learn.json` and `learn.retry2.stdout` contain the result.

| Captured URL / input pair | Capture / document | Identity and full captured menu |
| --- | --- | --- |
| `/order/44216/locations/66421` | `cmvp6pdp046a839`, 1, HTTP 200 | KHANOM THAI BZN, Bozeman; 14 sections, 126 items, 126 USD offers; Crispy Spring Roll 9 USD |
| `/order/36632/locations/55612` | `cmvp6pp0125cada`, 1, HTTP 200 | Ain't She Sweet Cafe, Beverly, Chicago; 6 sections, 47 items, 46 USD offers; Jerk Chicken Bowl 12 USD; Chicken Gumbo has no offer |

Those captures each recorded the actual GET document and aborted 11 other exchanges. The first capture had no Cookie header; the second used site-issued cookies from the same isolated profile, not imported user credentials. This round's learned-home verifies likewise sent the isolated capture's cookies. They are not cookie-free proof. The prior macOS watchdog exit race is documented by the parent's repair report and is not a ChowNow domain stop. This round used the current repaired helper unchanged.

## Unseen source and initially empty-home replay

The held-out URL `https://order.chownow.com/order/8670/locations/11721` came from the prior grounded source report and was unused in learning. One independent cookie-free GET returned HTTP 200 without redirect or bot-wall classification, saved as `moms.html`, `moms.headers.json`, `moms.source.json`. These are HTTP evidence, not browser captures. The remaining Besa Mi Taco lead was untouched.

A separate parse of the source's noscript heading, address, section headings and every item/price label checked identity and meaning against its JSON-LD. All 17 section labels and 138 item labels were compared. All 134 published offer labels use CA$ and have explicit CAD codes in JSON-LD. The other four labels have no offer or price label. `heldout-grounding.json` records the complete comparison.

The exported candidate was installed into the initially empty absolute home below, with no copied sessions or profile. The first operation call used `{restaurantId:"8670",locationId:"11721"}`. The instrumented real fetch recorded no Cookie header, HTTP 200, tier 1, no healing and no truncation. The full returned nested value deep-equaled the independently fetched source object's selected name/address/hasMenu, including every item and missing offer. No constant USD default was applied.

Identity: Mom's Fries - Timmins, 473 Pine St S, Timmins, ON P4N 2L5, CA. First section `Mom's Fries & Poutine`, Mini Fries 4.29 CAD matching source label `Mini Fries — CA$4.29`. Unpriced items remained absent offers: `Frozen- Ice crean &Treats` in `Frozen- Ice Cream& Treats`; `Pet Food`; `Syrup, Pasta Sauce, Dressing Sauce` and `Coffee, Sugar, Tea` in `Grocery Section`.

Receipts: `fresh.heldout.json`, `fresh.requests.json`, `heldout-comparison.json`. The result contains 17 sections, 138 items and 134 offers. This proves one third paired URL, not arbitrary pairing or independent ID semantics.

## Current verification, export and vet

Final current home for parent export/verification audit:

`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/chownow-finalize-r3/fresh-home`

The final spec is at `fresh-home/sites/chownow.json`; current record is `fresh-home/checks/chownow.json`. `verify.final.json` records both the Khanom example and the different-restaurant Chicago check passing at tier 1. `gate.final.json` has zero errors and current operation hash `bb4a07fc5f37b6f0`, verified at `2026-10-26T12:03:15.970Z`. No healing occurred. Final verify sent only the two real public document GETs, HTTP 200, using cookies set by the earlier successful public held-out response.

`export.final.json` is `exportSite(...,{keepExamples:true})`: zero secrets/warnings; public ID examples retained; response shapes and learned timestamps stripped. Its spec equals `candidate.json` and the saved registry JSON. `vet.preliminary.json` records direct `vetShared` on that same exported spec, zero errors/warnings. The initial optional audit also completed `vetShared(spec, notes)` successfully before an unrelated downstream extract-call argument-order TypeError; its error stack is in `audit.resources.jsonl`. No dedicated notes-vet JSON was emitted before that error, so the direct spec-vet receipt is the clean reusable receipt. Parent should rerun the integrated registry test on JSON plus notes.

Saved JSON SHA-256: `74ae5e58258972837fef7442d17e908a38bc3ecea87cc9f4789761e1cc6471fe`.
Saved notes SHA-256: `33cefae61570781c524b4692e86967784f642286cd08ac913fc880edbbce340f`.
`save-audit.json` records export equality and these hashes.

One local harness error is retained candidly: after the successful initially cookie-free held-out call, the fresh harness rejected any subsequent cookie-bearing request. Both following verify cases were locally prevented from sending and marked inconclusive in `verify.fresh.json`. This was not a website error/control and did not produce further site requests. The final verification phase corrected that test overconstraint by allowing the site's newly set public cookies; both cases then passed. The original first-request cookie-free receipt remains intact.

## Resources and cleanup

Every expensive/local-network command used the repaired resource gate, memory admit89/stop90 for bounded browser-free work, CPU admit65/stop85. Denials were followed by 30-second waits, with at most three resamples per denied command and no site requests during waits. No browser was launched in this round, so no global browser lock was acquired or touched. There were six website requests total: one independent held-out source GET, two learned-home verification GETs, one initially cookie-free unseen replay, and two final-home verification GETs. All were the same public document route on `order.chownow.com`, all HTTP 200. No auth, challenge, redirect, 403, 429 or website error was observed.

`resource-summary.json` summarizes each `.resources.jsonl` receipt. Across admitted commands, peak sampled CPU was 66.75%, policy memory 88.92%, and raw occupied memory 99.73%. Across all admission samples, including denials before any child ran, policy memory peaked at 91.29%. Raw occupancy includes file-backed cache and was already above 95%; do not claim every memory measure stayed below the user's ceiling. No admitted sample crossed CPU85 or policy memory90; the helper did not terminate a live owned command in this round. Sampling does not bound unrelated programs or transient spikes.

The extra offline cap audit initially failed because its call to `extract` passed body/spec in reverse order. The ignored script was corrected, but the corrected command was denied at memory89.65, 90.64, 89.99 and 89.45 over the initial attempt plus three resamples. No more gated command or network work followed. This optional retained-count measurement remains deferred. The proven export and already-vetted note text were saved using inexpensive file writes; no gate was bypassed to run a corrected audit.

All started owned commands exited. No owned browser existed in this batch, no process was killed, and no lock was acquired. Capture originals, copied captures, guest cookie material, raw HTML, scripts and receipts remain under ignored evidence only. No raw credentials appear in tracked output or this report. Parent owns all integrated checks and shared-state/catalog updates.
