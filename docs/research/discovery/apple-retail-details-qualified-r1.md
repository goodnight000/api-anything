# Apple US selected retail store details, r1

2026-10-28 UTC. Overall **ISSUES**. One useful distinct `getRetailStoreDetails(store)` candidate is saved in `sites/apple.json` with complete notes in `sites/apple.md`. Its functional gates pass, but the provenance and command-boundary gaps below prevent an unqualified full-procedure PASS. Parent acceptance, integrated checks and counts remain pending. Existing `getTechSpecs` and `listProductFamilies`, their complete operation objects and all eight original cases are unchanged.

Sole worker `apple-retail-details-qualified-r1-20261028`, no nesting or delegation. Reservation remains `2026-10-28T17:58:19.726318Z`, source cutoff `18:06:19.726318Z`, qualification cutoff `18:18:19.726318Z`. Deadlines were never reset. Public source discovery and all three frontend captures finished before source cutoff. No new domain or quota was used. Product comparison remains parked.

## Useful contract and limits

`getRetailStoreDetails(store)` accepts a single segment copied from an actual Apple US retail directory link, bounded by `[a-z0-9-]{1,80}`. It returns one coherent object from Apple's public LocalBusiness JSON-LD: declared source type, identity and URL, store code, name, business telephone, structured address, regular opening-hours groups, and optional dated special-opening-hours groups. Nested source types, day arrays, literal time strings, date ranges, whitespace and source order are preserved. The operation does not silently align positional hour values with missing labels.

The regular groups are source-declared weekly hours. Special groups apply only to their own `validFrom` and `validThrough` dates and can be historical. All three observed stores publish an October 23 special entry. These are not today's hours or a reconciliation with the separately rendered dated hours table. No timezone, open-now result, computed date, live availability, stock, appointment, service eligibility or department-specific hours is inferred. Optional source absence is preserved, not interpreted as a closure. Only the US English retail route/layout was checked.

The source documents also contain visible store name, business address and telephone. The independent comparator corroborates those three against the JSON-LD. It independently parses the structured regular and dated special declarations without treating the visible current-week table as their equivalent. This is document source evidence, not computed-visibility or hydrated GUI proof. No image/media, map/directions action, booking, bag, purchase, trade-in, account or customer operation was fetched or exercised.

## Navigation and immutable candidate

The retained public Apple homepage footer literally linked `/retail/` as Find a Store. A fresh signed-out GET of `https://www.apple.com/retail/` exposed the literal Complete store list link `/retail/storelist/`. That exact directory returned HTTP 200 and its literal links supplied all selected stores. No store slug, endpoint, filter, ZIP, location or country input was invented.

`reservation.json` records A/B/D at `2026-10-28T18:02:10.579391+00:00`, before any selected-store response exposure. Its directory body SHA-256 is `d830d4ec274e50d8b6eba2e9b9776289cfa9c03d5f41d4ceb767b2314210bc98`.

- A: https://www.apple.com/retail/thesummit/
- B: https://www.apple.com/retail/anchorage5thavenuemall/
- D: https://www.apple.com/retail/appleparkvisitorcenter/

A and B were genuine fresh isolated frontend GET-document captures with explicit document request 1. `addOperation` consumed their actual envelopes with `from`, request ID 1, and `from2`; the second capture's answered document is also request 1. It returned zero warnings, no unproven marker, and minimum tier 1. A/B identities, addresses and regular closing hours differ. Their independent all-field comparisons passed before any next website command.

The exact exported public-example candidate and COMPLETE caller/maintainer notes passed `vetShared` and credential scans at `2026-10-28T18:04:16.386Z`, before D exposure. Caller text is 1774 UTF-16 units before the exact `## Maintainer notes` delimiter. The whole notes file passes vet. No recipe, operation metadata, examples, checks or notes changed after D exposure.

D stayed unopened until this preflight. Its genuine frontend capture completed at `18:05:03.802Z` with HTTP 200, request 1, exact final URL and synchronous independent semantic comparison. The unseen tier-1 call then matched the separate genuine D document for every claimed field, nested row, identity, occurrence, order, type and optional absence. There was no sorting, dropping, alternate recipe, refetch or retry to conceal a mismatch.

## Functional receipts

Ignored evidence root: `bench/explore/state/discovery/apple-retail-details-qualified-r1-20261028/`.

`offline-baseline.json` records successful independent Python HTMLParser comparisons against all six retained original live-result sources. They cover both original operations, optional/missing specification arrays, responsive duplicate catalog rows and actual product modules. A metadata-only fixture is rejected by the catalog recipe. The original `getTechSpecs` model/column meaning is preserved, including empty model arrays and state-specific columns. Retained comparison research was inspected and not executed or modified.

`unseen-complete.json` records one passing tier-1 D call. `cold-initial.json` proves an initially empty OWN cold home. `cold-installed.json` records installation of only the exact final export under `sites/apple.json`. `cold-complete.json` records the new operation's FIRST call from that home. Both the fetch wrapper and native `undici:client:sendHeaders` observation show Cookie and Authorization absent on that first request.

Later verification uses only the site's `geo` guest cookie issued by that cold first Apple response. No private cookie, login/import source or session value exists in that home. Each tier-1 response's native `Headers.getSetCookie()` array is saved before header serialization, including all issuance lines in order; the original Response and Headers are returned to core. One `geo` line was observed on the cold first response; later verification responses issued zero lines. No duplicate issuance occurred in these observed tier-1 responses. No values are disclosed here.

`verify-complete.json` records all 12 stored cases, using `call` with `maxTier: 1`, the actual operation-specific `judge` and `judgeCase`, and independent comparisons of every returned call before the next send. This is an owned serial verifier, not a claim that `verifySite` was invoked. It writes standard current parsed-operation-hash check records in `cold-home/checks/apple.json` and `verification-record.json`. `gate(spec)` accepts those actual passing records.

The two original operations each retain three public result cases and one local invalid/path refusal. They produced six tier-1 reads plus two local input results with zero sends. The new operation adds its A example, B and D result checks, and one local invalid/path input check. Total: nine tier-1 reads and three local inputs, exactly nine verification sends. No healing, retries, transport fallback or origin-level empty case was used. Response judgment and independent comparison complete within the guarded send; returned-call comparison completes before the next send.

`optional-absence-fixture.json` separately tests omission of special hours in an offline copy of retained A source. It proves independent absence matching without claiming that any observed live store omitted that field. A LocalBusiness-free metadata shell is rejected with actual core drift. No website request occurs in either fixture.

`tested-final-export.json`, the cold-installed spec, learn-home spec, candidate and saved JSON are byte-identical. Fresh exports from both own homes equal the parsed candidate, retaining public examples and producing zero credential/export warnings. Complete preflighted notes equal saved notes byte-for-byte. `final-audit.json` records final zero-error/zero-warning vetting and credential scans, exact equality, both whole original operation objects, all current case hashes, guest provenance and frozen files.

Parsed operation hashes:

- `getTechSpecs`: `e731d84649a42956`
- `listProductFamilies`: `20d7d3a61cf9cc3c`
- `getRetailStoreDetails`: `085e7a57b40cecfe`

Exact saved JSON SHA-256: `1e5ff4cf8dc529c82c8770d804d4a43673f9d344bb318d3c2f75b7ff40ffd85c`.
Exact saved notes SHA-256: `d749ea08822ac6878e94b2fb595405eb440bcd4755a1d73fb84962e7e27e4938`.
Actual pre-task JSON/notes baselines are saved separately as `actual-baseline-apple.json` and `actual-baseline-apple.md`, matching the assignment's hashes. `parent-baseline.json` is intact.

## Procedural issues and STOP status

The initial state-path read used the wrong local path and an initial retained catalog comparator included unrelated gallery cards and heading badges. Both were corrected offline before website access, as the current runbook permits. All six retained baseline comparisons passed before access. These setup errors were not origin failures and did not create a STOP.

A/B source capture wrappers returned before their separate guarded retail semantic commands. Both independent comparisons completed synchronously before the next website command, but they were not inside the same capture command. D and all tier-1 qualification sends do contain synchronous comparison inside their guards. The command-boundary distinction is retained rather than retroactively called compliant.

Browser-helper stdout/stderr for A/B/D were retained from launch. Early source/qualification wrapper stdout is in the tool transcript with supplemental terminal receipts, rather than launch-time wrapper stdout/stderr files. Cold, serial verification and final audit have launch-time stdout/stderr logs. Terminal IDs and actual wrapper/helper PIDs, commands, homes and start/exit data are retained in `terminal-receipts.json`, launch files and child/exit files. No missing wrapper log is fabricated.

The final offline-audit file was syntax checked before access with baseline-preservation logic, expanded for the successful candidate after live qualification, then syntax checked again before execution. No syntax failure occurred. This is disclosed because the final expanded audit was not the exact pre-access script. `verify-launch.json` records the initially selected learn-home; the serial verification switches to the cold-home before any send, and its completion receipt records that actual home.

No guarded website, core judgment or semantic comparison failed after access began. There is no `FIRST-STOP.json`. The guard uses exclusive create for first failure and checks the no-send latch before every fetch and capture child. Whole current presend state snapshots retain stops, aliases, tasks, claim and cooldown. All other brand/host stops, including Khan, IKEA and Google Play, remain untouched. No new Apple origin access-control conclusion is asserted.

## Cleanup and handoff

The unchanged `bench/discovery/capture-document.mjs` captured only each exact public GET document, with other requests aborted, 15-second trigger timeout and 60-second outer bound. All observed exact documents were HTTP 200 with no redirect. Each browser used an atomic global directory mutex containing the owned wrapper PID and token, released only after helper exit. Recursive owned children were recorded while alive using parent/PID-specific commands. `cleanup-final.json` found no remaining owned wrapper/helper/Chrome descendant and no browser mutex. No unrelated process was inspected as an inventory or stopped.

No memory lookup, CPU/memory snapshot, resource gate, admission/watchdog, recovery wait, dependency/source/helper edit, old-evidence edit, other-site edit, commit, push, PR, publication or state/runbook/count mutation occurred. Eight frozen Pinterest/Rotten Tomatoes/Rightmove/Steam files, the approved publication manifest and PR65 scope manifest match the actual baseline hashes. Parent alone owns integrated registry/lint/type/count acceptance. This report does not advance counts or claim publication.

`manifest.json` inventories exact paths, byte lengths and SHA-256 for all owned regular artifacts, raw captures and separate bodies, browser profiles, guest jars, homes, baselines, executable probes, candidate/tested export, saved JSON/notes, this report and directly used retained baseline source bodies. It excludes itself to avoid a hash cycle. Its hash is returned in the handoff. Parent may audit these artifacts offline without reopening qualification.
