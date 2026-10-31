# Netflix displayed episode guide qualification r1

2026-10-28 UTC. PASS for one worker-qualified addition, `getDisplayedEpisodeGuide(titleId)`, pending parent registry, lint, type and count gates. Three reads and nine tier-1 cases are saved. Both whole pre-existing operations and all six original cases remain identical. No commit, push, PR or publication was performed.

Sole worker `netflix-episodes-qualified-r1-20261028`, no nesting. Coordinator reservation began at 13:24:02.029841 UTC, with source cutoff 13:32:02.029841 and qualification deadline 13:44:02.029841. Current source structure and paired learning/preflight were established at 13:28:22.456, before the source cutoff. Functional saved-file gates completed at 13:32:02.616. Cleanup completed before this report.

Evidence root: `bench/explore/state/discovery/netflix-episodes-qualified-r1-20261028/`, ignored. Probe source, stdout/stderr, process receipts, raw headers/bodies, browser capture envelopes, profiles, jars and isolated homes remain there. `manifest.json` lists paths, bytes and SHA-256 values, including envelopes separately from decoded document bodies, baselines, probes, homes and final files. Cookie values are absent from tracked notes and this report.

## Contract and limits

`getDisplayedEpisodeGuide(titleId)` reads the public document's explicitly headed Episodes section. Its result is one collection object with parallel `episodeTitleLabels`, `synopses` and `runtimeLabels` arrays in source-card order. The title label retains the publisher's ordinal prefix and title together. Runtime labels retain literal strings such as `49m`; no duration conversion or interpretation of units is inferred. `selectedSeasonLabel` is included only when the section has an explicitly selected option. It is absent for The Irregulars, which has no selector or season label in the captured section.

Only source-visible cards in the default displayed document are covered. This may be a preview or subset. The operation does not promise all seasons, a complete series, a complete catalog, release schedules, regional availability, account entitlement or playback. Join the parallel arrays only when lengths agree; a missing card field can shorten an array. The checked collections have matching lengths throughout. No episode IDs or media URLs are invented or returned.

Stranger Things explicitly selects the publisher label `Stranger Things`, not a season number inferred by this worker. Tales From '85 explicitly selects `Season 1`. Both source selectors have `aria-disabled="true"`. Their option values and local dropdown state are not proof of a season request parameter. No selector was exercised, and no season endpoint or parameter was proposed. The fixed observed `pubDate=20250721` query remains context, without date-filter meaning.

This is a distinct episode collection, separate from title metadata and You Might Also Like discovery. Existing genres, cast and starring remain incomplete advertised credits. Related-title order remains each response's own source order, without a stable ranking requirement. None of those older contracts was changed.

## Grounding and frontend evidence

Read the discovery README first, then current relevant state stops, aliases, tasks, claim and cooldown; AGENTS.md, DESIGN.md, CONTRIBUTING.md, the repository api-anything skill, Netflix JSON/notes and both prior Netflix reports. No memory or CPU/memory checks, admission wrappers, watchdogs, recovery checks or resampling were used. Existing runtime, dependencies, helpers, runbook, coordinator state and other sites were untouched.

The prior genuine Stranger Things capture `cmvs4u1cz8f8fed` grounded public series links, not current health. `heldout-reservation.json` reserved D, `https://www.netflix.com/title/81398721`, from its literal related-title anchor before any D episode source or operation output was exposed. The same old document grounded B, `https://www.netflix.com/title/80241581`. Fresh A independently retained both links.

Fresh captures used the unchanged exact-document helper, each at the literal title URL with `?pubDate=20250721`:

- A, Stranger Things, title `80057281`: `cmvs5evciadb385:1`, HTTP 200, eight episode cards, explicit selected label `Stranger Things`. 59 exchanges, 58 aborted; helper duration 13,291 ms.
- B, The Irregulars, title `80241581`: `cmvs5fcfn64c431:1`, HTTP 200, eight differing episode cards, no selected-season label. 51 exchanges, 50 aborted; helper duration 3,967 ms.
- D, Stranger Things: Tales From '85, title `81398721`: `cmvs5h5vtb6b564:1`, HTTP 200, ten episode cards, explicit selected label `Season 1`. 55 exchanges, 54 aborted; helper duration 4,288 ms. D was captured after the offline candidate/notes preflight.

The helper retained its 15-second trigger timeout and a separate 60-second outer startup/cleanup bound. No outer bound was reached. Each capture used the atomic global browser directory mutex, its live wrapper PID and unique token; only its own mutex was released after helper exit. `*.process.json` retains commands, homes, wrapper/child PIDs, start/end/exit and Chrome descendants observed while alive. `terminal-sessions.json` retains the returned terminal-session IDs. Child stdout/stderr files were opened at launch.

Only the exact GET document answered. Aborted requests are not answered XHR evidence. Inline scripts could run, but this does not establish a fully hydrated GUI or computed stylesheet visibility. No full-page monitor, Shopee monitor, hidden-content workaround, watch URL, playback, trailer, trial, account, signup, list, like, favorite or other website write was used.

## Learning and independent qualification

`stage.mjs` called actual paired `addOperation` with genuine A/B captures and network forbidden. `titleId` is bound at request path position 1. Both collections have eight cards but different title labels and synopses; the server-bound argument is supported by meaningful response differences. Learning has zero warnings, no unproven mark, minTier 1, and zero export warnings or secrets.

`preflight.json` records the exact public-example candidate export and full draft notes passing offline `vetShared` with zero errors/warnings before D capture, cold call or live verification. Final notes add measured results and a caution about joining unequal-length arrays; exact saved notes also pass zero-issue vet.

`independent.py` uses Python's stdlib HTMLParser, with no runtime extractor imports. It walks from the Episodes heading to its section, then each shown episode-card list item. It checks both card paragraphs, locates the literal runtime badge beside the card image, preserves the publisher title prefix and runtime suffix, and reads only an explicitly selected option. It independently checks the document h1 identity. A and B match all 24 card field values each, their own order and the presence/absence of selected-season text.

D's independent parser produced ten cards and explicit `Season 1` before its first operation call. `comparison.json` proves all ten identities, all 30 card field values, the season label and exact array/card order match the separate genuine frontend capture. An independent parse of the actual cold response also matches every field and order. D's h1 is Stranger Things: Tales From '85 in both sources, tying the collection to the requested title; section ancestry ties the cards to its displayed selected season. No row positions were converted to episode numbers or season membership.

`current-operation-audit.json` also checks all three captures with the actual new operation and independently parses all three episode verification responses. Each verification collection matches its own source body, the separate frontend's fields/order and the input title identity. These checks require no additional origin requests.

## Cold home, stops and all-read verification

`cold-input.json` records that the dedicated cold home initially did not exist and had no contents. Only the exact final candidate export was installed before its first call. The actual first send was `https://www.netflix.com/title/81398721?pubDate=20250721`, with Cookie and Authorization both absent. It returned HTTP 200/core ok at tier 1, without healing or truncation, and passed the independent D comparison. The cold response issued guest cookies named flwssn, nfvdid, SecureNetflixId, NetflixId and gsid. Later calls used only cookies issued to this isolated home; Authorization remained absent. No everyday browser profile, private cookie import or login was used.

`verify.json` records all nine cases passing at maxTier 1, without healing:

- Unchanged getTitle: `81018682`, `80057281`, `80178603`.
- Unchanged listRelatedTitles: `81018682`, `80057281`, `80245121`.
- New getDisplayedEpisodeGuide: `80057281`, `80241581`, `81398721`.

Each send persisted its status, headers, Location and body diagnostics before actual-operation `judge(op, observed)` and bot-wall classification. The operation judgment completed before the next verification send. All ten tier-1 sends, including the cold call, returned HTTP 200 and actual-operation core ok. No retries, healing, fallback, repeated requests to match order, alternate route/country/transport or changed cases were used.

The guard screens the current claim/deadline, active task, stops, aliases, cooldown and exact literal URL before each send. A sticky `STOP.json` is persisted before returning an actual core non-ok, challenge, auth, rate or request-failure verdict and refuses later sends before fetch. No stop occurred. No stopped or parked service was contacted, including the Vinted provisional-core-auth stop and TradingView, Healthline, Zalando, JYSK, UNIQLO, JustWatch, SofaScore, McDonald's, Nasdaq and Flashscore. Untested inputs and future origin health remain unknown.

## Exact files and handoff

`final.json` proves both whole original operations and all six stored cases are unchanged. The baseline JSON hash is `18a0d501437bccfb37f8bcd12c7c5ae9670d4eb4ff1458ead3e4a3042b988177`; baseline notes are `c045dd4eb4ef216e6167c23f1dcb55a5f58b404703ec3eefbc91645f075edfcd`. Separate baseline copies were retained, and `parent-baseline.json` was left intact.

Current operation hashes are getTitle `b3bf49deb52197ac`, listRelatedTitles `159262b4345d3158` and getDisplayedEpisodeGuide `b9ad342e2b265545`. All three have current-hash passing records for all three cases. Candidate export, cold-home input, tested final export and saved JSON are byte-identical. Exact saved JSON plus notes pass `vetShared` with zero errors/warnings. Caller notes are 1,486 UTF-16 code units before the exact `## Maintainer notes` heading.

Final SHA-256 values:

- `sites/netflix.json`: `251fcbe65b3912b510c1104f5155dba6c2ec7c6eb438a46db9374f98b39b8d78`.
- `sites/netflix.md`: `d53e1a3123ccc5ec4027c40a281842e1e788f71e2fb2ccee1e8e4bff3a8f414c`.
- Intact `parent-baseline.json`: `c069586366dc1e5c19ef774ea8432843b86ade0badb29436bf626c5c4684725f`.
- Unchanged capture helper: `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`.

`cleanup.json` records five successful owned commands and all 48 observed owned PIDs absent after exit, with the browser mutex absent. No process needed stopping and no unrelated process was touched. Homes and evidence were retained. All eight frozen Pinterest/Rotten Tomatoes/Rightmove/Steam files still match the parent baseline. The approved publication manifest and PR65 were not modified or acted on.

Only the assigned Netflix JSON, notes and this report were saved outside the ignored evidence directory. Parent alone owns state/runbook updates and integrated registry, lint, type and count gates. Those gates remain pending. This worker ends with one distinct collection addition, without starting a source map or monitor project.
