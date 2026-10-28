# Meetup public event discovery qualification, r1

2026-10-28 UTC. **ISSUES: functional qualification passed; cold-command launch PID receipt is incomplete.** One new operation is saved for parent review. Parent registry, lint, type and count gates are pending. No publication acceptance is claimed.

Worker: `meetup-discovery-qualified-r1-20261028`, sole worker, no nesting. Scope was one distinct signed-out public event collection feeding the unchanged `eventSchedule`, not another scalar wrapper. No runtime, dependencies, existing helper, other site, old evidence, shared state or runbook was edited. No memory lookup, CPU/memory snapshot, resource gate, recovery wait, commit, push, PR or publication ran.

## Reservation and deadlines

The coordinator reservation began `14:55:01.801808Z`, source deadline `15:03:01.801808Z`, qualification deadline `15:15:01.801808Z`. The contract and exact candidate/draft-notes preflight were complete at `14:59:33.473Z`. Final saved-file audit completed at `15:04:11.793Z`, within the qualification deadline.

`reservation.json` was written at `14:57:17.908620Z`, before any new-workflow origin request or output exposure. Literal group anchors in retained event sources grounded all three group inputs:

| Role | Group namespace | Exact public document URL | Retained grounding |
|---|---|---|---|
| A | `ananda-yoga-and-guided-meditation` | `https://www.meetup.com/ananda-yoga-and-guided-meditation/` | actual r4 capture `cmvplqezm1e5e14` |
| B | `vibe-code-la` | `https://www.meetup.com/vibe-code-la/` | actual r6 capture `cmvpmw7icd6ec99` |
| D, unseen group workflow | `la2jp-los-angeles-japan` | `https://www.meetup.com/la2jp-los-angeles-japan/` | retained r6 event-C document |

Old sources grounded navigation only. D's event page was historical prior evidence; its **group collection** was unseen by this workflow until after A/B comparisons and preflight. No invented group, `/events/` navigation, `/find/` route, filter, page or identifier was used. No source map was treated as an API.

The prior official Meetup GraphQL guide documents authenticated event-data access. No protected GraphQL request, token, login or alternate host was used. This report makes no official-API-absence claim.

## Operation and independent evidence

`listGroupEvents(namespace) -> title, url, schedule, namespace, eventId` reads all selected `Event Card` anchors from the public group home document in document order. It is a meaningfully varying populated collection: A has six cards and B has three, with different event identities and schedules. The namespace is server-bound in the captured request path. The operation is tier 1, read-only, learned signed out, with no `unproven` mark or add/export warning.

The selected cards include past-event sections. D contains a featured card and an upcoming card for the same event; both remain, with their different observed source queries and original order. No sorting, deduplication, dropped row, retry or post-D selector change occurred. No collection machine datetime attribute is claimed. A's source attributes appeared inconsistent with literal local schedule text, so the contract uses that displayed wording only. This is a partial advertised collection, without completeness, ranking, availability, attendance, cancellation, recurrence, organizer, contact or location guarantees.

| Gate | Evidence under worker root | Result |
|---|---|---|
| Genuine differing A/B frontend captures | `capture-A/B.stdout`, actual `capture-home/captures/*.json` | A `cmvs8o4a16fe143:1`, B `cmvs8p65u88c2eb:1`; each 55 exchanges, 54 aborted, one answered HTTP200 document |
| Actual op-specific body judgment | `capture-A/B.audit.json` | `judge(op, observed)` ok; all claimed fields present in every row; no detected challenge/login |
| Independent all-row A/B comparisons before D | `compare-independent.py`, `compare-A/B.json` | Python stdlib HTMLParser, no core extraction imports; all 6/6 and 3/3 rows, fields, identities and order equal |
| Paired `addOperation` plus exact export/complete draft notes | `learn.mjs`, `candidate.json`, `candidate.md`, `preflight.json` | `14:59:33.473Z`; zero add/export warnings, zero secrets, zero vet errors/warnings; 880 caller UTF-16 units |
| Separate actual D frontend | `capture-D.stdout`, `capture-D.audit.json`, `compare-D.json` | `cmvs8qhwba3699f:1`; 59 exchanges, 58 aborted; all four complete cards independently parsed, duplicates preserved |
| Initially empty-home first call, unseen D tier 1 | `cold-input.json`, `cold-send-1.screen.json`, `cold-result.json`, `heldout-comparison.json` | Home did not exist before install; exact candidate input; one send, no Cookie/Authorization; all 4/4 rows, fields, identities, order equal to separate frontend; tier 1, no heal |
| New discovery pair feeds unchanged detail operation | `chain-reservation.json`, `capture-E.*`, `chain-result.json`, `compare-detail.py`, `chain-comparison.json` | New pair `ananda-yoga-and-guided-meditation / 316899021`; all three fields equal to separate frontend, tier 1, no heal |
| All original/new stored cases | `verify.json`, `verify-record.json`, `cold-home/checks/meetup.json` | Four of four pass, tier 1, no heal; current hashes on both records |
| Exact tested export and final saved JSON/notes | `cold/chain/verify-export-check.json`, `final.json` | Candidate/cold input/tested exports/saved JSON byte-identical; final vet zero errors/warnings; caller 913 UTF-16 units |

The independent Python parser extracts each card's h3 and time text, and splits its URL pathname for the paired inputs. It does not call runtime extraction or sort the results. The D tier-1 response is distinct from the genuine frontend response. All fields and ordered identities are compared, not merely status, count or a selected row.

The chained frontend capture `cmvs8t7kkf1c3fd:1` used the exact source anchor:

`https://www.meetup.com/ananda-yoga-and-guided-meditation/events/316899021/?eventOrigin=group_upcoming_events`

The unchanged operation called the same namespace/eventId with its fixed observed query `eventOrigin=home_logged_out_near_location`. The separate frontend and tier-1 answer agreed on title, start `2026-10-28T10:00:00-07:00`, and literal schedule `Wednesday, Oct 28 · 10:00 AM to 11:30 AM PDT`. The differing query bytes are retained and disclosed, not normalized away.

## Original operation preserved

The whole `eventSchedule` operation object is identical to the worker copy of the parent baseline, hash **`7ecbd4c60b67ee9f`**. It retains exactly its original example A `ananda-yoga-and-guided-meditation / 317020116` and check B `vibe-code-la / 316840610`. Both passed fresh tier-1 verification. B remains the original past-event source. Historical event C `la2jp-los-angeles-japan / 316886756` was not added to or substituted into stored cases. The chain case is evidence only, not an extra stored case.

New operation hash: **`af2f70bb96114375`**. It has A as its example and B as its single check. The stored eventSchedule trigger/template retains `https://www.meetup.com/{namespace}/events/{eventId}/?eventOrigin=home_logged_out_near_location` and the paired-input constraint.

## Requests, cookies, stops and cleanup

Four genuine exact-document captures issued four permitted document GETs, with 218 aborted resources collectively; aborted resources are not answered XHR. Six tier-1 sends completed: one cold D, one chained detail, and four verification cases. There were no HTTP retries, heals, fallbacks or redirect follows. Every actual operation-specific judgment was inspected before the next send. Raw response envelopes/status/headers/Location and separate decoded bodies were persisted before HTTP classification, including a bodyless-redirect path if one had occurred; no redirects occurred.

Before each permitted send, the wrapper reread the current claim, deadline, cooldown, all 154 host stops and 134 aliases, and screened the exact literal URL. No Meetup stop matched. Stopped brands were not probed or worked around. `STOP.json` is a persistent pre-fetch refusal latch for any actual op-core non-ok or request failure; it was never created. This establishes only no observed control in these requests, not future access or live event health.

A's initial browser document and the cold home's initial tier-1 request sent no Cookie or Authorization. B/D/E browser captures reused only guest state issued to the isolated capture profile. Later cold-home chain and verification requests used only site-issued guest cookies `MEETUP_BROWSER_ID` and `SIFT_SESSION_ID`, with no Authorization. Their values remain ignored. No everyday-browser cookies, private login or cross-home jar import was used.

Each capture used the unchanged `bench/discovery/capture-document.mjs`, its 15-second trigger timeout and an owned 60-second outer bound. Each acquired the global atomic `browser.lock` with wrapper PID/token, retained live Chrome descendant receipts and launch stdout/stderr, and released its own token only after helper exit. Owned capture, chain and verification process receipts record wrapper/child PID, command, home, start and zero exit. Terminal IDs are A `9084`, B `20183`, D `20513`, E `70461`, cold `76027`, verify `70642`. The chain command completed in its initial tool call and had no continuing terminal session.

**Process receipt issue:** the cold command was launched directly, so its terminal session and successful exit are retained, but launch wrapper/child PIDs were not recorded while alive. The later targeted inspection found it already gone. `cold.terminal.json` labels this unknown; no PID was reconstructed and the request was not repeated to manufacture a receipt. Parent must adjudicate this procedural limitation before accepting/counting the saved addition.

`cleanup.json` records owned helper exits and targeted owned-process inspection. No owned browser/helper remains, the global mutex is absent, no sticky stop exists, and no unrelated process was stopped. Ignored profiles, jars, captures, raw bodies and probes are retained. All eight frozen Pinterest/RottenTomatoes/Rightmove/Steam files match the parent baseline. `parent-baseline.json` remains intact, SHA-256 `af318d887b0b18f7dbdf0ec33a7f1c379531696b6cf533073fa0cbf4e1929c7a`.

## Artifacts and hashes

Ignored evidence root: `bench/explore/state/discovery/meetup-discovery-qualified-r1-20261028/`. `manifest.json` inventories paths, byte counts and SHA-256 for retained evidence, probes, separate envelopes/bodies, baselines, homes and final files. The manifest excludes itself. `initial-state-screen.json` retains the full relevant stops, aliases, tasks, claim and cooldown snapshot; worker baselines are separate from the parent file.

- Candidate, cold input, tested exports and saved `sites/meetup.json`: `dca5b5a82b8fdbb9523692e5bd18b34105b7cd3f396580ac4d9894534ea1414e`
- Saved `sites/meetup.md`: `033bff0a137edde7290cbdfce9a5f33b4a24979207fa8a174d13f787c242f8ba`
- Retained A event capture grounding: `e62a51dd4523ac5293e41ad9fc2e9f5ee5ae27f5df0d2e957e4d0dd9ecc5dded`
- Retained B event capture grounding: `c5a86dda52c347742d57b80b29db8565ea6123f0490592df3167b9f15d565720`
- Retained D navigation grounding: `574836f6112ff533d80a66fb4a435d5fbe692992dc6aa424b3a1659557a0886d`

Parent owns registry/lint/type/count gates and acceptance of the PID receipt issue. No shared check or accepted addition count is claimed by this worker.
