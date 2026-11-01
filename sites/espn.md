No account is needed.

- `date` is `YYYYMMDD`. ESPN groups games by US Eastern day, so a late game can start after
  midnight UTC (`date` in the result is UTC).
- Soccer and other sports with a league segment in the URL are not covered.
- In `scoreboard`, `team1Home` says whether team1 is the home team (it usually is). MLB games have
  an empty `team1Score`/`team2Score`; get the score with `getGame`.
- College basketball scoreboards list only the games ESPN features by default (Top 25 and
  similar), not every Division I game.
- `getGame` numbers are strings except `attendance`. `leaderStats`, `homeLeaders`,
  `homeLeaderValues`, `awayLeaders` and `awayLeaderValues` line up by index (`points`, `rebounds`,
  `assists` in the NBA; passing, rushing, receiving yards, sacks and tackles in football). Before a
  game, the score, linescores and attendance are missing and the leaders are season totals.

## Maintainer notes

Learned 2026-10-31 with `api-anything capture` and `add`, logged out, from the JSON ESPN embeds in
each page as `window['__espnfitt__']` (`--embedded`): `page.content.scoreboard.evts` on
`/<league>/scoreboard/_/date/<YYYYMMDD>` and `page.content.gamepackage` on
`/<league>/game/_/gameId/<id>`.

| op | args | returns | tier |
|---|---|---|---|
| `scoreboard` | `league`, `date` (example `nba`, `20261030`) | each game: `gameId`, `date`, `status`, `state`, `team1`/`team2` with abbrev and score, `team1Home`, `venue`, `note` | 1 |
| `getGame` | `league`, `gameId` (example `nba`, `401909277`) | `status`, home and away score, linescores and record, `venue`, `attendance`, leaders, `headline`, `recap` | 1 |

Checked with inputs that were not examples: `scoreboard` for `mlb` 20261024, `nfl` 20261101,
`college-football` 20261031, `wnba` 20260815, `mens-college-basketball` and
`womens-college-basketball` 20261103; `getGame` for a college football final, an NFL game not yet
played, an MLB World Series game and a WNBA final. `api-anything verify espn` passed 3 of 3 (2
examples and an offseason-day `empty` check) in the learning home and from an empty
`API_ANYTHING_HOME`, all at tier 1 (under 1.5 s).

- Learning tripped the live-credential guard on values that are page text, not credentials: the
  cookie `IR_gbd` (`espn.com`, in every URL), local-storage entries holding the page URL
  (`arLastUrl`, `visionPageUrl` and others) and one holding the browser's user agent
  (`ab.storage.device...`, which `add` turned into a `session:` ref for the `user-agent` header).
  They were removed from the four captures before `add --from/--from2`. A heal in a browser picks
  them up again and will be refused the same way.
- MLB scoreboard events carry runs in `competitors[].runs` and an empty `score`; picking `runs`
  would make every other league's call answer `drift` (the field is gone for the NBA example), so
  it is left out. The game page's `prsdTms.*.score` has MLB scores.
- The `league` enum lists the slugs checked with this URL shape. The standings page was looked at
  and left out: its stats are positional, with a column order that differs by league.
