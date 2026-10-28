# Flashscore football pair metadata

Copy `first` and `second` from an existing public `/match/football/<first>/<second>/` link, keeping their original URL order. Each segment contains a team slug and its eight-character ID. No login is needed.

The site selects a fixture for that pair. This route can select a different competition or date from another listing that uses the same link, and the selected event can change. Check the returned event identity and competition before using it. The inputs are URL order; the returned home and away identities come from the selected event's source metadata.

`competition` includes the publisher's round label. `country` is the competition country label. `competitionPath` is relative to `https://www.flashscore.com`. Scores, match status, kickoff dates and times are not returned. The page title can say LIVE for an upcoming match. This operation does not establish live or final score truth.

Only these public football pair routes were qualified. Other sports, schedules, search, historical event selection, pagination, missing entities, odds and betting are unqualified. No freshness or cache-age guarantee was established.

## Maintainer notes

Observed signed out on 2026-10-26 UTC, using an isolated absolute API_ANYTHING_HOME without browser import or login. The experimental requested-GET-only document helper ran under the global atomic browser mutex and resource watchdog. Each capture had one answered document and 114 aborted requests. Inline scripts may run; this evidence does not establish a fully hydrated GUI.

`resolveFootballPairMetadata(first, second)` requests `GET https://www.flashscore.com/match/football/{first}/{second}/`. It reads the document's JSON `window.environment`, retaining event ID, sport, competition and its link, competition country, and home/away IDs and names. No odds, generic feed fields, stage clock or status is extracted. The two slots are path segments 2 and 3; no credential refs, public exemptions, volatile anchors or write steps are used.

Example A is `first=chelsea-4fGZN2oK second=manchester-united-ppjDR086`, capture `cmvpbqz32e8b9d9`, document 1, selected event `OWc65atm`, Chelsea home, Manchester Utd away, Premier League - Round 9. Example B is `first=bournemouth-OtpNdwrc second=leeds-tUxUbLR2`, capture `cmvpbrbyg7cfdbd`, document 1, selected event `j1Ur5VU6`, Bournemouth home, Leeds away, Premier League - Round 9. All links came from the actual public root.

The unseen pair `first=brighton-2XrRecc3 second=manchester-city-Wtn9Stg0` answered at tier 1 without healing. A separate cookie-free document fetched before replay supplied the visible title Manchester City v Brighton and selected source event `vLaHlpR9`, EFL Cup - 1/8-finals, Manchester City home and Brighton away. All nine returned fields matched that independent fetch. This is separate HTTP source evidence, not a third browser capture. The root dated listing associates this pair link with 31 October, whereas the selected document's stage timestamp falls on 28 October. Those dates are not exported as an event-selection contract.

The root, general-information FAQ and sport-data FAQ were screened before learning. They exposed no documented public API, feed or agent interface in the inspected material; absence of such an interface elsewhere was not established. No API endpoint was guessed or called. SofaScore separately returned HTTP 403 Forbidden at its exact root and was stopped without alternate routes or hosts.

Raw evidence remains under ignored `bench/explore/state/discovery/sports-scores-r2/`. The research report records final verification, empty-home reuse and direct shared-vetting receipts.

Final exported operation hash `12c36c6a1c3518dd` was verified at 2026-10-26T14:06:34.903Z, with `verifySite(maxTier:1)` passing the example and both checks. Re-export equaled the candidate export. The separate initially empty `fresh-resolve-home` installed only that exported spec and its first site call reproduced the unseen comparison at 2026-10-26T14:06:47.310Z, tier 1, without healing. No cookies, sessions or browser profile were copied. Direct final JSON-and-notes vetting is recorded in `vet.final.json`.
