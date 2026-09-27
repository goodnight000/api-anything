# google-flights

Verified 2026-09-27, logged out, US IP, with `api-anything verify google-flights` passing from a clean
`API_ANYTHING_HOME` (no cookies, no session values). No account is needed. Checked live:
`search`/`top` for SFO→NYC (JFK, EWR and LGA results), BOS→London, SFO→Tokyo, Chicago→MIA and
PIT→HNL; `priceCalendar` for SFO→JFK, BOS→MIA and LAX→ORD (92 days in one call). The calendar's
cheapest BOS→MIA day ($80) matched the cheapest flight `top` returned for that date.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `origin`, `destination` (airport code, metro code or city name), `date` (`YYYY-MM-DD`) | Google's "other departing flights" list, one-way, sorted by price (about 5 to 30 items) | 1 (GET of the results page, about 1 to 1.6 s, 3 to 4 MB) |
| `top` | same | Google's "top departing flights" list (about 3 to 5 items) | 1 |
| `priceCalendar` | `origin`, `destination` (IATA **airport** codes only), `start`, `end` (`YYYY-MM-DD`) | the cheapest one-way fare for each departure date in the range: `{date, price}` | 1 (POST `GetCalendarPicker`, about 0.1 s) |

```sh
api-anything call google-flights search origin=SFO destination=NYC date=2027-04-15
api-anything call google-flights top origin=BOS "destination=London" date=2027-04-22
api-anything call google-flights priceCalendar origin=SFO destination=JFK start=2026-10-01 end=2026-10-31
```

"Cheapest flight next month" is one `priceCalendar` call per airport pair, then `search` and `top`
for the cheapest date to get the flights themselves. For a metro area, call the calendar once per
airport (New York: JFK, LGA, EWR).

## Places

`search` and `top` put the args into the page's own free-text query,
`/travel/flights?q=Flights from {origin} to {destination} on {date} one way&hl=en-US&gl=US&curr=USD`,
and Google resolves them. Airport codes (`JFK`), metro codes (`NYC`, `LON`, `TYO`) and city names
(`New York`, `Tokyo`) all work; a metro or city covers all its airports, and each item's `from`/`to`
says which one. An ambiguous city name is resolved the way Google's search box resolves it.

`priceCalendar` sends the airport code in its own slot (`["JFK",0]`). Google encodes a city there as a
different entity (`["/m/02_286",4]`), so a metro code returns an empty calendar. The param
`pattern` refuses 3-letter codes that are metro codes (NYC, LON, PAR, TYO, CHI, WAS, and so on);
the list is not exhaustive, and an unlisted metro code still comes back empty.

## Result fields

`search` and `top`: the page embeds its results as `AF_initDataCallback({key: 'ds:1', ..., data:[...]})`,
which the spec reads with `format: "embedded"`. `[2][0]` is the top list and `[3][0]` the other list,
the same positional JSPB as the `GetShoppingResults` XHR. `pick` names the fields:

| key | path | meaning | example |
|---|---|---|---|
| `airline` | `[0][1]` | airline names (several when the itinerary mixes carriers) | `["Delta"]` |
| `price` | `[1][0][1]` | price, USD, for the whole one-way itinerary | `209` |
| `from` / `to` | `[0][3]` / `[0][6]` | departure / arrival airport | `"SFO"` / `"JFK"` |
| `departureDate` / `arrivalDate` | `[0][4]` / `[0][7]` | date `[y,m,d]` | `[2027,4,15]` |
| `departureTime` / `arrivalTime` | `[0][5]` / `[0][8]` | local time `[h,m]`. A missing entry is 0: `[9]` = 09:00, `[null,56]` = 00:56 | `[13,50]` |
| `durationMinutes` | `[0][9]` | total duration, minutes | `333` |
| `stops` | `[0][13]` | `null` for nonstop, else one `[layover minutes, airport, airport, null, airport name, city, ...]` per stop, so the stop count is its length | `[[58,"IAH",...]]` |

The unpicked item also holds `[0][0]` (carrier code), `[0][2]` (legs; `[0][2][i][22]` is the flight
number `["DL","606",null,"Delta"]` and `[0][2][i][17]` the aircraft), and `[1][1]` (a booking token).
Add them to `pick` in your copy of the spec if you need them. `[1]` of the embedded data holds the
places Google resolved (`[["/m/02_286",4],"New York",...]`).

`priceCalendar`: the batchexecute payload is at `[0][0][2]`, and `[1]` of it is one
`[date, null, [[null, price], token], 1]` per day. `price` is missing on a day with no fare.

## Known limits

- One-way, 1 adult, economy only. Round trips, cabins and passenger counts need their own ops.
- `search` and `top` are disjoint: the cheapest flight on a date can be in either. Together they are
  the whole results page, and each costs one 3 to 4 MB page download.
- Calendar ranges were tested up to 3 months per call. The trigger (tier 3) opens the date picker,
  which requests the page's own range, not `start`/`end`; tier 1 needs no trigger.
- The session tokens in the calendar's `f.req` (`json:/0/3`) and `f.sid` are session-scoped, not
  per-request signatures: stale values replay fine at tier 1 from a clean home. The export's base64
  warning refers to that token. It is issued to every logged-out visitor, not a credential.
- The example dates (`2027-04-15`, `2027-04-01` to `2027-04-30`) go stale. Bump them before then,
  or `verify` fails.
- A date in the past or a place Google can't resolve makes `search`/`top` fall back to Google's
  Explore page, which has no results list. That page carries a "Sign in" link to
  `accounts.google.com/ServiceLogin`, and the classifier currently reads that as a login page, so
  the call returns `auth` ("login page instead of content"). google-flights needs no login: treat
  that answer as "no results for these args" and check the date and places. `priceCalendar` with an
  empty range returns `input`.
- Prices and names follow `hl=en-US&gl=US&curr=USD` in the page URL and the calendar's
  `x-goog-ext-259736195-jspb` header. No pagination. The EU consent wall was not tested.
