# google-flights

Verified 2026-09-27, logged out, US IP, from a clean `API_ANYTHING_HOME`: `verify` passes, and live
calls covered airport, metro and city searches and 92-day calendars. No account is needed.

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

`search` and `top` read the results the page embeds (`AF_initDataCallback` `ds:1`: `[2][0]` is the top
list, `[3][0]` the other list). The JSPB paths are in `google-flights.json`. Each item:

| key | meaning | example |
|---|---|---|
| `airline` | airline names (several when the itinerary mixes carriers) | `["Delta"]` |
| `price` | USD for the whole one-way itinerary | `209` |
| `from` / `to` | departure / arrival airport | `"SFO"` / `"JFK"` |
| `departureTime` / `arrivalTime` | local time `[h,m]`; a missing entry is 0: `[9]` = 09:00, `[null,56]` = 00:56 | `[13,50]` |
| `arrivalDate` | `[y,m,d]`; the departure date is the one you asked for | `[2027,4,16]` |
| `durationMinutes` | total duration | `333` |
| `via` | stop airports in order; **absent for a nonstop flight** | `["IAH"]` |

The page also has the carrier code, flight numbers, aircraft, layover minutes and a booking token
per item. Add them to `pick` in your copy of the spec if you need them. `priceCalendar` reads
`[0][0][2]` of the batchexecute payload, one `[date, null, [[null, price], token], 1]` per day;
`price` is missing on a day with no fare.

## Known limits

- One-way, 1 adult, economy only. Round trips, cabins and passenger counts need their own ops.
- `search` and `top` are disjoint: the cheapest flight on a date can be in either. Together they are
  the whole results page, and each costs one 3 to 4 MB page download.
- Calendar ranges were tested up to 3 months per call. The trigger (tier 3) opens the date picker,
  which requests the page's own range, not `start`/`end`. The runtime refuses that response
  when its request differs from the requested range. If direct replay fails, the calendar may
  need re-capture or a repaired trigger; it will not claim the UI's default dates are your answer.
- The session tokens in the calendar's `f.req` (`json:/0/3`) and `f.sid` are session-scoped, not
  per-request signatures: stale values replay fine at tier 1 from a clean home. The export's base64
  warning refers to that token. It is issued to every logged-out visitor, not a credential.
- The example dates (`2027-04-15`, `2027-04-01` to `2027-04-30`) go stale. Bump them before then,
  or `verify` fails.
- A date in the past or a place Google can't resolve makes `search`/`top` fall back to Google's
  Explore page, which has no results list. The call replays the example args once; they answer, so
  it returns `input`: check the date and places. A malformed date (`Oct 21`) is refused by the
  param's `pattern` before anything is sent. `priceCalendar` with an empty range returns `input`.
- Prices and names follow `hl=en-US&gl=US&curr=USD` in the page URL and the calendar's
  `x-goog-ext-259736195-jspb` header. No pagination. The EU consent wall was not tested.
