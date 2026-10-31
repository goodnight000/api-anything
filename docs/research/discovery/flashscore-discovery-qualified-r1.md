# Flashscore competition pair navigation qualification r1

**PASS functional qualification. One distinct read added. Parent integration gates pending.**

Sole worker `flashscore-discovery-qualified-r1-20261028`, no nesting, on 2026-10-28 UTC. Reservation began at `12:02:35.132426Z`; the absolute source cutoff was `12:10:35.132426Z` and qualification cutoff `12:22:35.132426Z`. The source contract, paired learning and offline preflight were established by `12:07:25.745Z`. Final exact files passed direct vetting and were saved at `12:10:20.088Z`, within both cutoffs.

Saved only the authorized Flashscore JSON, notes and this report, plus ignored worker artifacts. No runtime, dependency, existing helper, other site, old evidence, shared state or runbook edits. No commits, push, PR or publication. Parent owns the focused registry, lint, type and count checks.

## Qualified read

`listFootballCompetitionPairs(country, competition)` reads `GET https://www.flashscore.com/football/{country}/{competition}/`. Both input segments must come from an actual public competition link. It returns the publisher's link `label`, absolute `pairUrl`, and complete `first` and `second` slug-and-ID URL segments. The response recipe reads only `#extraContent .next_round a[href^="/match/football/"]`, then extracts the two segments from each href.

This is a competition-specific collection of navigation links, distinct from the original selected-event metadata read. Collection scope is the literal source document's anchor order. It does not claim complete competition membership, hydrated table order, a schedule, event/date selection or freshness. Surrounding prose and dates are excluded. Label order is not a home/away contract. No score, status, time, kickoff, schedule, odds, betting, recommendations, accounts or article body is returned.

The original `resolveFootballPairMetadata(first, second)` object, including descriptions, examples and both checks, remains exactly equal to the separate baseline copy. All three original cases were retained. Its hash remains `12c36c6a1c3518dd`. First and second remain literal URL order, not home/away order. Pair routes select a fixture and can select a different event, competition or date from the listing. Returned identity and competition must still be inspected; a title saying LIVE proves no live-play state.

## Grounding and frontend evidence

The retained actual root document `sports-scores-r2/flashscore-root.body` contains the exact three competition anchors used below. Retained capture `cmvpbqz32e8b9d9` and its actual `window.environment` show the genuine Premier League competition link and team detail links. The old document and captures ground navigation only; they are not fresh health proof. No ID, country, endpoint, pagination or host was guessed. No internal feed or source-only configuration became an API.

Fresh public signed-out documents returned HTTP 200 for these exact URLs, without redirect follow or credentials:

- A: `https://www.flashscore.com/football/england/premier-league/`
- B: `https://www.flashscore.com/football/spain/laliga/`
- Independent unseen D: `https://www.flashscore.com/football/germany/bundesliga/`
- Independent handoff source, grounded in D before workflow output: `https://www.flashscore.com/match/football/elversberg-6in2Eknb/mainz-EuakNmc1/`

The main results/fixtures tables inspected in A were empty source containers. That is a capture/extraction limitation of those tables, not an access-control failure or evidence the existing metadata API failed. The populated `.next_round` anchors provide the narrower useful source contract.

| Case | Actual frontend capture | Returned collection | Capture isolation |
| --- | --- | --- | --- |
| A, England/Premier League | `cmvs2jc74dbcb99`, request 1 | 15 rows | One answered document, 109 aborted other requests |
| B, Spain/LaLiga | `cmvs2jlw414f152`, request 1 | 15 different rows | One answered document, 111 aborted other requests |
| D, Germany/Bundesliga | Separate public HTTP source document, not a third browser capture | 18 rows | Independent Python HTMLParser before workflow output |

`captures.audit.json` compares every A/B field and row order to the separate public source documents parsed with `independent.py`. The paired `addOperation` result in `add.json` has zero warnings and no unproven mark. Actual request method/path and the single answered document were asserted. These are exact-GET document captures using the unchanged `bench/discovery/capture-document.mjs`, not XHR evidence or proof of a fully hydrated GUI.

A envelope SHA-256: `62fece40b6279669f8d15262a0c311ec14cf6bad57a2fc0f8167a1aae640baf4`.
A decoded body SHA-256: `c15a88b569e6b52eed4a259fe92275865b92d71f97d4a3851caf4ead7188b23f`.
B envelope SHA-256: `a686968ea43e531153350230dad0800da3dc882f23548ef73924ca2241b560fa`.
B decoded body SHA-256: `bd84a0452d68cf2a4edf2f657bebf179053076ad512c8c644575e502b53ca983`.

## Functional gates and exact files

All receipt paths here are relative to ignored `bench/explore/state/discovery/flashscore-discovery-qualified-r1-20261028/`.

- `vet.preflight.json`: exact public-example candidate and complete draft notes passed offline `vetShared` with zero errors and warnings before unseen/cold/live qualification. The two operation hashes are `12c36c6a1c3518dd` and `dbd61232d617ef21`.
- `independent-d.expected.json`, `unseen.call.json`, `unseen.comparison.json`: D was grounded and independently parsed before its proposed workflow output. Tier 1 matched every one of the 18 rows and all four fields, including label, both URL-order identities, href and order. The declared meaning is navigation, not fixture-date truth.
- `cold.initial.json`, `cold.send-1.json`, `cold.call.json`, `cold.comparison.json`: a separate initially empty home installed only the exact candidate bytes. Its first actual send had no Cookie or Authorization. It repeated the full 18-row comparison at tier 1 without healing.
- `verify.json`, `verify.records.json`, `verify.send-1.json` through `verify.send-6.json`: all three original metadata cases and all three new collection cases passed at `maxTier:1`, without healing. Every case has a passing record for its current operation hash. The exact actual operation was judged before each response returned to core and before the next send.
- `handoff.expected.json`, `handoff.call.json`, `handoff.comparison.json`: the first independently grounded D row feeds unchanged first/second segments to the original resolver. A separate source parser decoded the selected event before the workflow result. All nine fields matched selected event `j9drDZFO`, Football, Bundesliga - Round 8, Germany, Elversberg `6in2Eknb` home and Mainz `EuakNmc1` away, competition link `/football/germany/bundesliga/`. This observed agreement does not remove pair/date ambiguity or establish sports truth.
- `unseen.done.json`, `cold.done.json`, `verify.done.json`, `handoff.done.json` and their reexports: candidate, installed inputs, reexports and final saved JSON are byte identical. No samples, credentials, volatile anchors, public exemptions or writes were added.
- `final.json`: exact final saved JSON and complete saved notes pass direct `vetShared` with zero errors/warnings. Caller notes before exact `## Maintainer notes` are 1301 UTF-16 units; complete notes are 7176 bytes.

Final `sites/flashscore.json` SHA-256: `5ed45fac6151ae9974b2a5d055e7224b8727d0ef6b6a7b50c481649641aa39f0`.
Final `sites/flashscore.md` SHA-256: `039eced1cb00b4253a69df352a1d00a1024b3fcf13668a6b6b6aba11d84468b6`.
New operation hash: `dbd61232d617ef21`.
Baseline JSON SHA-256: `2bf2c4082bc59b6cc22eb992ef0276c621516217a7f18035c8d5eb993d485b6d`.

## Stops, cookies and boundaries

Current state tasks, claim, stops, aliases and provider cooldown were screened before sends. The reservation belongs to this sole worker, there was no competing Flashscore task or recorded Flashscore stop, and the recorded provider cooldown had expired. `screen-state.json` retains the controls; each live send records the then-current state hash and claim.

`live.mjs` enforces a persistent worker `STOP.json` check before fetch. It judges the actual operation before returning the response; actual non-ok/auth/rate/challenge or request failure persists STOP before any later send can proceed. No stop was triggered. All nine tier-1 sends were individually judged `ok`; there was no retry, healing, transport fallback or access workaround. All four source documents and both browser captures also answered 200. Fifteen answered public document sends were made in total: four source documents, two browser documents and nine tier-1 operation sends. Aborted subrequests are retained separately.

No Cookie or Authorization was sent by the source probes. Both frontend captures report no cookies. Every isolated live home's first send had neither header, and all nine live response receipts have empty Set-Cookie-name lists. No guest cookies were needed or reused. No login, private-cookie import, session/profile copying or cookie values appear in this report. Profiles, jars, raw bodies and probe sources remain ignored.

SofaScore's recorded HTTP403 stop remained in force and it was never contacted. ESPN/BBC Sport remained excluded. Recorded stopped brands and aliases, including TradingView, Healthline, Zalando, JYSK, UNIQLO and JustWatch, were not contacted. All website sends stayed on the exact grounded `www.flashscore.com` football URLs.

An initial local source-probe import-path error occurred before any fetch. Its path was corrected within this worker's ignored probe; it is not an origin error or access verdict. No local parser or assertion failed during qualification. A later extra offline audit launched through Node eval hit a local module-loader syntax error before execution; the persisted `final-audit.mjs` then passed. `local-diagnostics.json` separates both corrected local launch errors from origin verdicts.

## Ownership, cleanup and remaining limits

Browser commands used atomic `mkdir` acquisition of `bench/explore/state/discovery/browser.lock` with unique token and wrapper PID. `capture-a.process.json` and `capture-b.process.json` record actual wrapper/child PIDs, command, isolated home, live start/exit and release after helper exit. Their stdout/stderr files were opened before launch. `*.descendants.json` records live Chrome descendants during those commands. The helper's trigger bound remained 15 seconds; the owned wrapper's outer startup/cleanup bound was 60 seconds. Both exited 0, without outer timeout. Tool terminal session IDs are recorded in `terminal-sessions.json` rather than reconstructed.

`cleanup.json` records no owned live browser or registered owned command remaining, no global browser mutex, and no killed unrelated process. Homes and evidence remain for audit. The eight frozen Pinterest/RottenTomatoes/Rightmove/Steam files match `parent-baseline.json`; that parent file was not edited. Separate baseline copies were made. The approved publication manifest and PR65 scope manifest were only read, with hashes in `publication-readonly.json`. No PR65 or remote publication operation occurred.

Commands ran directly. No CPU/memory snapshot, resource admission, watchdog, recovery or resample wait was run. No monitor was built or reused, and existing helpers were not changed.

`manifest.json` lists artifact paths, bytes and SHA-256, separating actual capture envelopes from decoded document bodies and including probes, baselines, homes and final files. It omits itself to avoid a self-hash cycle.

Missing entities, other competitions beyond the observed examples, team pages, populated participant directories, pagination, fully hydrated tables, stable event selection and freshness remain unknown or unqualified. No broader workflow map is claimed. The parent must still run integrated registry/lint/type/count gates before counting this batch as integrated.
