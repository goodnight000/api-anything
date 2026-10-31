# IKEA directory qualification, round 1

**BLOCKED. Zero additions.** 2026-10-28 UTC. The proposed `listStores()` passed its live
qualification and all original reads passed, but a local final-audit syntax failure latched STOP
before final acceptance or installation. `sites/ikea.json` and `sites/ikea.md` retain their exact
three-operation baseline bytes and all ten original stored cases. The candidate remains ignored.
No origin auth, rate, challenge or access-control failure was established.

## Terminal local failure

Immutable first STOP: `2026-10-28T17:43:47.517848+00:00`, cause `final: RuntimeError: final child exit 1`.
The exact diagnostic is retained in `final.stderr`: `SyntaxError: Unexpected token ')'` at
`final.mjs` line 7. `node --check` reported the same syntax error. The shell invocation mistakenly
continued to the guarded final launch after that failed check. The child exited 1 before executing
the final audit or save. Its wrapper persisted STOP before returning. This is an avoidable local
probe error, not an IKEA failure. No probe repair, qualification retry, website request or browser
launch followed. `final.mjs`, the first STOP and its diagnostic remain unchanged.

Final JSON-plus-notes acceptance and installation are therefore incomplete. Passing prior gates
are retained evidence, not an installed or counted API. The parent owns disposition of the stop,
shared state, registry/lint/type checks and operation counts. No shared checks were run here.

## Reservation and fixed-input contract

The inherited reservation was 17:34:10.226275 UTC. Absolute source cutoff stayed
17:42:10.226275 UTC and qualification cutoff stayed 17:54:10.226275 UTC. The local reservation
in `reservation.json` preceded inspection of proposed directory fields. Atlanta was selected from
a retained literal href only and separately reserved before its detail response was opened.
All four fresh captures completed before the source cutoff. The all-case rerun ended at
2026-10-28T17:42:41.683461+00:00. No deadline was reset.

The directory source and exact request were https://www.ikea.com/us/en/stores/ .
A/B are genuine fresh frontend snapshots of that same fixed GET. There is no varying argument,
state request parameter, ZIP filter, geolocation or pagination claim. D was a later reserved fresh
whole-directory capture, opened only after exact-candidate and complete-notes preflight.
D may share body bytes with another snapshot; independent fresh capture provenance is retained.
Atlanta is a downstream handoff, never a fictitious directory input.

The ignored candidate returns 49 entries explicitly labelled `Store`, with literal name, URL and
the URL's final Store segment. Small stores, plan-and-order points, and pickup facilities are
excluded. No state/metro fields, address, hours, geographic inference, fabricated pickup identity,
exhaustive network inventory, ranking, availability or transactional action is claimed.
This is distinct collection navigation feeding unchanged `getStoreDetails`, not an hours/address
wrapper or reopened search. Parked search and all other site stops remain untouched.

## Offline proof and captures

Before enabling website access, the real `SiteSchema` validated the provisional full operation,
including `html.items`. Probe syntax was checked. `offline-proof.json` records independent
all-field comparisons against all seven retained successful baseline bodies. Product metadata and
missing dimensions, opaque category identifiers including `s` prefixes, repeated cards,
metadata-only objects outside actual content containers, empty department/holiday lists and a
negative control with shifted department sections were exercised.

Routine pre-access setup corrections are retained. A literal space missed nonbreaking-space
Store labels; the selector was corrected offline before access. Missing optional category fields
needed explicit undefined handling. Removing a department shifted the old positional recipe;
the comparator correctly detected that negative control. No baseline recipe was changed.

`semantic.mjs` independently parses semantic paragraphs and exact facility labels, product
JSON-LD, actual category content cards with visible heading/link corroboration, and store headings
matched by department label. Expected data is not copied from runtime output. Every capture's
selected field, identity, row occurrence, type and order was compared synchronously before the
next website command. `capture-audit.mjs` compares runtime extraction and operation-specific
`judge` against that parser. This proves frontend document delivery. Stylesheet visibility and a
hydrated GUI were not proved.

| Role | Fresh capture | HTTP | Rows | Document body SHA-256 |
| --- | --- | ---: | ---: | --- |
| A | `cmvseed5x8e1368:1` | 200 | 49 | `cf9ed41d06bec3faec7a09db21925b52c16c3a9278b361254275fdaf7bd984f9` |
| B | `cmvsef14f890e2c:1` | 200 | 49 | `7bed2b398290fc3eaa21f7e825896a5e0f7f87018b313ff5ea68fb891a58236a` |
| D | `cmvseh7y0225b0d:1` | 200 | 49 | `cf9ed41d06bec3faec7a09db21925b52c16c3a9278b361254275fdaf7bd984f9` |
| H | `cmvseitbj278a20:1` | 200 | 1 | `861208d287c1c9ab8e46954723f656ba72cc0cebb00aefc1a28eace1c668a2fa` |

Each capture used an initially separate guest browser home and the unchanged
`bench/discovery/capture-document.mjs`, exact GET restriction and 15-second trigger bound, under
a 60-second outer bound. All other requests were aborted. Captures preserve complete exchanges,
raw status/headers/Location/body, and separate body files before downstream audit. They are not
XHR evidence. Each atomic global lock had an owned PID/token and was released after helper exit.
All four actual captured requests sent Cookie=false and Authorization=false.

## Learning, preflight and D/cold gates

Actual `addOperation` used A/B, empty examples `[{},{}]`, explicit document request selection
and exact method/host/path matching. It returned no warnings, no unproven parameter, readOnly
true and minTier 1. A/B semantic comparisons completed before D exposure.

At 2026-10-28T17:40:13.244Z, the exact public-example export and **complete** caller/maintainer notes passed
`vetShared` with zero errors/warnings and export with zero secrets/warnings. Caller text is
1787 UTF-16 units before the exact `## Maintainer notes` heading; whole notes are
4729 bytes. Required historical reports are linked there without dropping caller
caveats. No candidate recipe or metadata changed after D exposure.

The first actual `listStores()` call used a separate initially empty `cold/` home containing only
that exact candidate export. `cold-initial.json` retains emptiness and input/install hashes.
Actual first Cookie and Authorization headers were absent. The whole 49-row tier-1 response
matched D's independent source for every name, link, Store segment, identity, occurrence and order.
There was no sorting, dropping, refetch, alternate recipe or retry. This supports fixed-input
snapshot reuse, not a varying-parameter claim.

The first API response issued guest cookies named `ikexp_id`, `ikea_geo`, `__cf_bm`. Later calls
used only those IKEA-issued guest cookies in that same home. Native `Headers.getSetCookie()`
lines were retained before header serialization, without deduplication; no duplicate issuance
occurred in these ten API responses. The original Response/Headers were returned to the core.
No cookie values, private import, everyday profile, login or API key appears in tracked output.

## Handoff and exact original-case rerun

A literal directory result supplied `store=atlanta` to the unchanged `getStoreDetails`.
Its separate fresh frontend source and actual tier-1 result matched all ten fields. Semantic
headings corroborated Store, Click & Collect, Småland, Swedish Restaurant and Swedish Bistro
hours, dated Thanksgiving/Christmas closures, and `specialStoreHours: []`. The address was
corroborated against FurnitureStore JSON-LD. Hours remain literal scoped text, without timezone
or open-now inference. `H.meaning.json`, `handoff-semantic-1.json`, and `handoff-proof.json` retain
the complete all-field proof, including the empty special-hours list.

The bounded stored-case runner calls the real `call` and `judgeCase`, with maxTier 1 and a
real-fetch guard. It executes the exact example plus every original check, preserving all
purposes/arguments in the candidate operation objects. Every live response passed its actual
operation's `judge` and the independent full-field parser before another send. Then the returned
`call` data was compared in full. The runner writes native-format current-hash records; it does
not claim to have invoked `verifySite` itself.

All 11 stored cases passed: seven original live results, the three original local invalid/path
refusals and one new fixed-directory example. The three local cases sent zero requests and are
not origin failures. Eight verification GETs returned 200 at tier 1. Cold and Atlanta handoff add
two separate GETs, for ten actual API sends. No retry, fallback, heal or session import occurred.

| Candidate operation | Parsed opHash | Stored cases passed |
| --- | --- | ---: |
| `getProduct` | `f9166b77c2ef7ea2` | 4 |
| `listCategoryProducts` | `d6f378bdabbc4764` | 3 |
| `getStoreDetails` | `ccda2ca39a48d537` | 3 |
| `listStores` | `2b22abde9ad7284e` | 1 |

`opHash` was computed from `parseSite`/`loadSite` operations. The three original whole operation
objects and ten cases are unchanged. Candidate, cold installed JSON and cold/handoff/verified
public-example exports have identical bytes, SHA-256
`058d4295e403a8215f53081d13fa22800bbaf650b9a943492a66b2f0f7eb2d5c`. Candidate notes SHA-256 is
`dc626d6665d55c2ad4660c69fd0bd4646808400d2ee61471fe2d0a34f21da187`. These ignored candidate proofs remain separate from final acceptance.
The failed final probe never performed its planned final exact JSON/notes credential scan,
final vet, tested-final-export write or registry installation. Those are not claimed passed.

## Preservation, artifacts and cleanup

Current saved JSON SHA-256 remains `b3b78d6795f9e5975db15c3ce8b1ffb7b1bada992b63da5100699f30b0caa66c`.
Current saved notes SHA-256 remains `43d4cdc3e2b2ac9fb4edfbbbfdc81954d513cd1c4e3160d41386af6a9861b4ad`.
All eight frozen Pinterest/RottenTomatoes/Rightmove/Steam files match both parent baseline and
approved publication manifest. The approved manifest SHA-256 is `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`;
PR65 and publication state were untouched. `parent-baseline.json` was retained intact; separate
actual baseline copies are in this worker's ignored root.

Receipts are under ignored
`bench/explore/state/discovery/ikea-directory-qualified-r1-20261028/`.
`closeout-proof.json` derives the gate state from retained artifacts. `artifact-manifest.json`
covers exact paths, byte lengths and SHA-256 for every regular file in that root, all fresh
profiles/homes/captures/raw envelopes/separate bodies/baselines/probes/candidate files, this report,
the unchanged registry pair and referenced approved manifest. Symlinks, if present, are recorded
without following them. The manifest excludes only itself to avoid a circular hash.

Launch/execution receipts retain wrapper/child PIDs, exact commands, isolated homes, UTC
start/exit, stdout/stderr and recursive owned PID-specific Chrome observations while alive.
`terminal-ids.json` retains the asynchronous terminal IDs. Cleanup uses only recorded owned PIDs;
no host/resource inventory or unrelated-process termination was performed. All four capture
locks were released after helper exit. Live recorded owned processes: 0.
Global browser lock present at closeout: false.
No qualification/browser child remains active. Offline closeout only accounts for evidence and
writes this report; it does not repair or retry the stopped qualification.

Only this report and the assigned ignored root were written. No source/dependency/helper,
other-site/old-evidence/shared-state/runbook changes, commits, push, PR, publication, website
writes, bypass, alternate transport or nested worker occurred. Parent integrated acceptance
remains unrun. Terminal result is **BLOCKED, zero additions**.
