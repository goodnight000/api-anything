# Netflix related-title discovery qualification r1

2026-10-28 UTC. **PASS for one worker-qualified addition**, `listRelatedTitles(titleId)`, pending the parent's registry, lint, type and count gates. Saved only the assigned Netflix JSON/notes and this report outside ignored evidence. No commit, push, PR or publication.

Sole worker `netflix-discovery-qualified-r1-20261028`, no delegation or nesting. Reservation started at 13:06:52.647087 UTC; absolute source deadline 13:14:52.647087 and qualification deadline 13:26:52.647087. A supported current source contract and offline preflight were established at 13:11:20.681, before the source cutoff. Saved-file qualification finished at 13:16:36.463. Owned-process cleanup audit finished at 13:17:11.757478.

Evidence root: `bench/explore/state/discovery/netflix-discovery-qualified-r1-20261028/`, ignored. Raw bodies, response headers, browser capture envelopes, guest-cookie material, profiles, isolated homes, probe source and process receipts remain there. `manifest.json` records retained paths, byte counts and full SHA-256 values, with capture envelopes and decoded document bodies listed separately. No raw response body or cookie value is in this report or site notes.

## Operation and contract

`listRelatedTitles(titleId)` returns each title label, exact public title URL and numeric title ID from the title-specific **You Might Also Like** section, identified in current documents by `data-uia="more-like-this"`. This is publisher-advertised signed-out discovery. The request and trigger retain the observed fixed `pubDate=20250721` context. That query has no established date-filter meaning.

The recipe reads that section's list items only. It excludes the separately labelled Trending Now collection, global navigation, signup, trailers and watch/play links. Title IDs are extracted from captured title markers and independently cross-checked against the exact `/title/` link paths. Only public `https://www.netflix.com/title/…` links were used for handoff. No guessed feed, Top 10, Tudum, catalog endpoint or third-party adapter was contacted.

Order means source-document order for the particular response. Separate responses showed different permutations. No stable ranking, personalized recommendations, hydrated carousel order, current regional availability, playback or account entitlement is established. Collections may change, and these tests do not establish complete catalog coverage.

The whole original `getTitle` operation, including its request, fixed query, recipe, parameters, examples and checks, remains identical to the baseline. Its hash remains `b3bf49deb52197ac`. All three original cases remain present and passed at tier 1: `81018682` The Sea Beast, `80057281` Stranger Things and `80178603` My Father's Dragon. Genres, cast and starring retain publisher comma-separated text and may be incomplete. Creators remains optional.

New operation hash: `159262b4345d3158`.

## Grounding and fresh frontend captures

Read the discovery README first, followed by relevant coordinator state, stops, aliases, active task/claim/cooldown, AGENTS.md, DESIGN.md, CONTRIBUTING.md, the repository api-anything skill, current Netflix files and `streaming-qualified-r9.md`. Historical captures `cmvpfuhl116d1bb` and `cmvpfvhbp4381e7` were inspected only for navigation grounding, not fresh health. Their current counterparts were captured anew.

A cookie-free exact public source GET at 13:09:44 established the actual current section structure before the recipe was proposed. Its White Fang anchor was reserved in `heldout-reservation.json` before learning output was exposed. White Fang is a new discovery input here, not an assumption that previous metadata qualification proves a collection.

Fresh unchanged-helper exact-document captures:

- A, The Sea Beast: `https://www.netflix.com/title/81018682?pubDate=20250721`, capture `cmvs4tn4xdea752:1`, HTTP 200. Forty exchanges, 39 aborted, nine related titles.
- B, Stranger Things: `https://www.netflix.com/title/80057281?pubDate=20250721`, capture `cmvs4u1cz8f8fed:1`, HTTP 200. Sixty exchanges, 59 aborted, nine different related titles.
- Held-out D, White Fang: independently linked `https://www.netflix.com/title/80245121`, capture `cmvs4vay0241fba:1`, HTTP 200. Forty-three exchanges, 42 aborted, nine related titles. Captured after offline candidate/notes preflight and before the new operation's D output.

The exact-document helper was unchanged, with its 15-second trigger timeout. Each launch had a separate 60-second outer startup/cleanup bound. A's helper-reported duration was 18,195 ms including startup; B and D were 4,395 and 4,407 ms. No command hit the outer bound. Only the exact GET document answered; aborted subrequests are not answered XHR evidence. Inline scripts could run, but no fully hydrated GUI was verified. No full-page monitor or Shopee monitor was used.

Each browser command acquired the atomic global `browser.lock` directory with its own live wrapper PID and unique token. The worker released only its own mutex after helper exit. `capture-*.process.json` retained wrapper/child PIDs, commands, home, start/end/exit and Chrome descendants observed while alive. Terminal session IDs were recorded promptly in `terminal-sessions.json`. Stdout/stderr files were opened at launch. No CPU/memory snapshot, resource admission wrapper, watchdog, recovery or resampling was used.

## Learning and offline preflight

`stage.mjs` called actual `addOperation` using paired genuine A/B captures, with network forbidden. The title ID is server-bound at request path position 1. Nine A rows and nine B rows differed meaningfully. No learning warning, `unproven` mark, export secret or export warning remained.

`preflight.json` records the exact public-example candidate export plus full draft notes passing `vetShared` with zero errors/warnings before D capture, cold call or live verification. `independent.py` uses Python HTMLParser, not the runtime extractor. It locates the named section from its heading/ancestor structure, checks public title links and labels, derives IDs from href paths, and preserves document order. Independent A and B parses each matched all 27 returned field values and their source order.

## Unseen D, cold reuse and detail handoff

`cold-input.json` records an initially absent/empty dedicated `cold-home`. Only the exact candidate export was installed before its first call. That actual first request was:

`https://www.netflix.com/title/80245121?pubDate=20250721`

It sent neither Cookie nor Authorization, returned HTTP 200/core `ok` at tier 1 without healing or truncation, and yielded nine related titles. All nine identities and all 27 title/URL/ID values matched the separate genuine D frontend capture. Their order differed:

- Frontend IDs: `80244429, 70125931, 70059971, 80115432, 81040639, 80195962, 83077834, 80161029, 60022702`.
- Cold response IDs: `70125931, 80244429, 80115432, 81040639, 70059971, 80195962, 83077834, 60022702, 80161029`.

`ground-cold-response.json` independently parsed the actual cold response and matched every runtime field and its order exactly. `comparison-audit.json` retains both cross-document permutations and all 27 per-field comparisons. This proves the declared per-response document order; cross-response order equality is explicitly falsified.

The original cold script exited 2 because its assertion required identical order between separate responses. That was stricter than the already-written contract, which expressly disclaims stable ranking. `cold-adjudication.json` retains the failed receipt and adjudicates it offline against independent evidence. The recipe, export, response order and first-call history were not changed, sorted or retried.

White Fang came from A's discovery anchors and fresh A operation output. Its unchanged `getTitle` handoff at the fixed-query URL returned HTTP 200/core `ok`, tier 1. All five returned metadata fields matched both the separate genuine D frontend document and an independent parse of the detail response. Creators was absent.

The original detail assertion also exited 2 locally: `Object.keys` counted an in-memory optional creators key with value undefined, although JSON serialization omits it. `detail-adjudication.json` checks the serialized result against both independent documents and retains the failed receipt. All five fields matched; no detail request or recipe was repeated. Neither local assertion failure was an origin/core non-ok verdict or proof of an auth requirement.

The cold response issued guest cookies named `flwssn`, `nfvdid`, `SecureNetflixId`, `NetflixId` and `gsid`. Later detail/verification calls used only cookies issued to that isolated home. Authorization remained absent. No private cookie import, everyday-browser profile, login or account action was used. Cookie values remain ignored.

## All-read verification and exact saved files

`verify.json` records all six cases passing at `maxTier:1`, without healing: the untouched original three `getTitle` cases and related-title cases A, B and D. Every actual response was persisted with status, headers, Location and body diagnostics before local classification. `judge(op, observed)` ran for the actual operation before another verification send. No case was removed or replaced. Current verification-record hashes match both operations.

The guard screens current coordinator claim/deadline, stops, aliases, active task, cooldown and exact literal URL before every origin send. A persisted `STOP.json` would refuse later sends before fetch if actual operation-core non-ok, auth, rate, challenge or request failure occurred. None occurred. No retry, heal, browser fallback, route/country/transport workaround or repeat-to-match was performed.

The Vinted provisional-core-auth stop and all other brand stops remained absolute. No stopped, parked or unrelated service was contacted. Netflix's origin returned 200/core ok for every operation call; no new Netflix brand stop is warranted by these receipts. This says nothing about untested inputs or future health.

`final.json` proves byte equality among `candidate.export.json`, the cold home's installed JSON, `tested.final.export.json` and final `sites/netflix.json`. It also proves whole-operation/case preservation, the current records, independent comparisons and exact saved JSON plus notes passing zero-issue `vetShared`. Caller-facing notes contain 790 UTF-16 code units before the exact `## Maintainer notes` heading.

Final SHA-256 values:

- `sites/netflix.json`: `18a0d501437bccfb37f8bcd12c7c5ae9670d4eb4ff1458ead3e4a3042b988177`.
- `sites/netflix.md`: `c045dd4eb4ef216e6167c23f1dcb55a5f58b404703ec3eefbc91645f075edfcd`.
- Unchanged exact-document helper: `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`.
- Intact `parent-baseline.json`: `8df2e992cd56363485d52a6b45c687bb001ad7dd8010b721444513c852229434`.

## Cleanup and parent handoff

`cleanup.json` found no matching owned process still alive and no global browser mutex. It checked only retained owned PIDs/commands, without resource sampling. Each helper closed its browser; no unrelated process was stopped. Both isolated homes and all evidence were retained. The eight frozen Pinterest/Rotten Tomatoes/Rightmove/Steam files still match `parent-baseline.json`. The approved publication manifest and PR65 were not changed or acted on.

The parent alone owns coordinator state/runbook updates and integrated registry, lint, type and count gates. Those gates remain pending, and no integrated count or publication claim is made. This worker saved one distinct source collection and ended after qualification; it did not expand a workflow map or monitor project.
