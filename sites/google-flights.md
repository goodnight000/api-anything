# google-flights

Verified 2026-09-27, logged out, US IP, with `site2api verify google-flights` passing from a clean
`SITE2API_HOME` (no cookies, no session values). No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `origin`, `destination` (IATA codes), `date` (`YYYY-MM-DD`) | Google's "other departing flights" list, one-way, sorted by price (about 20 items) | 1 (POST `GetShoppingResults`, 0.3 to 1 s) |
| `top` | same | Google's "top departing flights" list (about 3 to 5 items) | 1 |

`top` and `search` read different parts of the same response and don't overlap. Together they
are the whole results page, which costs two requests.

```sh
site2api call google-flights search origin=SFO destination=JFK date=2027-02-10
site2api call google-flights top origin=BOS destination=MIA date=2026-11-18
```

## Result fields (positional JSPB)

The response is `)]}'` followed by length-prefixed chunks. Chunk 0 is `[["wrb.fr",null,"<JSON string>"]]`,
and the payload is at `[0][0][2]`, where `getPath` steps into the JSON string. Inside the payload,
`[2][0]` is the top list and `[3][0]` is the other list. `pick` keys are the raw paths:

| key | meaning | example |
|---|---|---|
| `[0][1]` | airline names (several when the itinerary mixes carriers) | `["Delta"]` |
| `[1][0][1]` | price, USD, for the whole one-way itinerary | `209` |
| `[0][3]` / `[0][6]` | departure / arrival airport | `"SFO"` / `"JFK"` |
| `[0][4]` / `[0][7]` | departure / arrival date `[y,m,d]` | `[2026,11,12]` |
| `[0][5]` / `[0][8]` | departure / arrival local time `[h,m]`. A missing entry is 0: `[9]` = 09:00, `[null,56]` = 00:56 | `[13,50]` |
| `[0][9]` | total duration, minutes | `333` |
| `[0][13]` | layovers: `null` for nonstop, else one `[minutes, airport, airport, null, name, city, ...]` per stop, so stops = its length | `[[154,"BOS",...]]` |

The unpicked item also holds `[0][0]` (carrier code), `[0][2]` (legs; `[0][2][i][22]` is the flight
number `["DL","606",null,"Delta"]` and `[0][2][i][17]` the aircraft), and `[1][1]` (a booking token).

## Known limits

- One-way, 1 adult, economy only. The trigger adds "one way" to the `q=` text, which makes the
  learned `f.req` carry trip type 2. Round trips, cabins and passenger counts need their own ops.
- `f.sid` and the token at `f.req > json:/1 > json:/0/3` differ between two captures, but they
  are session-scoped, not per-request signatures: stale values replay fine at tier 1, even from a
  clean home with no cookies and no `x-goog-batchexecute-bgr`. `add` now checks this with one
  replay and keeps `minTier: 1` (the first version of this spec needed a hand edit).
- The example date `2027-02-10` goes stale. Bump it before that date, or `verify` fails.
- A bad input (past date, unknown airport, no flights) returns no list. site2api replays the
  example route, which still answers, and returns `input` in about 1 s.
- Prices and names follow the `x-goog-ext-259736195-jspb` header (`en-US`, `US`, `USD`), which is
  stored verbatim. No pagination. The EU consent wall was not tested.
- The export's base64 warning refers to the search-session token inside `f.req`. It is issued to
  every logged-out visitor, and it is not a cookie or credential.
