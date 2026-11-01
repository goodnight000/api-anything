No account is needed.

- Dates are `YYYY-MM-DD`, today or later. `adults` defaults to 2, in one room, with no children.
- A property is named by two parts of its URL, `/hotel/<country>/<hotel>.html`: `searchHotels`
  returns them as `country` and `hotel`, and `getHotel` and `getRooms` take them.
- Prices are strings in US dollars (`"$248"`), the total for the whole stay. Taxes the price leaves
  out are in `getRooms`' `taxes`.
- `searchHotels` returns the first page only (about 20 to 25 stays), in Booking.com's default order,
  which includes sponsored stays. `rating` is out of 10 and `reviews` is the review count, as text.
- `getRooms` returns one row per rate. `room` is named only on the first rate of each room; the
  rows after it with the same `roomId` are other rates (breakfast, cancellation) for that room.
  `maxPeople` is missing on some properties. Sold-out dates answer `input` (no rates on the page).
- `getHotel` has no dates: it does not say whether the property is available.
- Plain HTTP to the search page meets an AWS WAF challenge when no earlier visit set its cookie, so
  the first `searchHotels` call often runs in the browser (about 20 s, then about 8 s a call).
  `getHotel` and `getRooms` answer over plain HTTP.

## Maintainer notes

Learned 2026-10-31 with `api-anything capture` and `add`, logged out (never signed in), from the
pages booking.com serves: `/searchresults.html?ss=...` and `/hotel/<cc>/<slug>.html`, each with an
explicit `--html` recipe over the `data-testid` attributes and the server-rendered rooms table
(`#hprt-table`). `learnedLoggedIn` is set to `false` by hand: the learning profile only held the
guest cookies booking.com gives every visitor (`bkng_sso_session` matches the sign-in name
heuristic).

| op | args | returns | tier |
|---|---|---|---|
| `searchHotels` | `destination`, `checkin`, `checkout`, `adults` | about 25 stays: `name`, `country`, `hotel`, `location`, `distance`, `price`, `rating`, `reviews`, `room` | 1 with the WAF cookie, else 3 |
| `getHotel` | `country`, `hotel` | `name`, `address`, `latlng`, `rating`, `reviews`, `subscores`, `facilities`, `description`, `checkIn`, `checkOut` | 1 |
| `getRooms` | `country`, `hotel`, `checkin`, `checkout`, `adults` | one row per rate: `roomId`, `room`, `maxPeople`, `price`, `taxes`, `conditions`, `left` | 1 |

Checked with inputs that were not examples: `searchHotels destination=Madrid` (2027-01-20 to 23,
3 adults) and `destination=Kyoto`; `getHotel` for `gb/the-savoy` and `pt/eurostars-museum`;
`getRooms` for `gb/the-savoy` (2027-02-14, 1 adult). `api-anything verify booking` passed 3 of 3
in the learning home (all tier 1) and 3 of 3 from an empty `API_ANYTHING_HOME` (`searchHotels` at
tier 3, the others at tier 1).

- The example dates (2027-10-13 to 15) were moved out by hand so `verify` keeps working for about
  a year; move them again before they pass.
- `address` strips the location-score blurb ("Excellent location – rated 9.7/10!") the page
  appends to the address text, by regex; `checkIn`/`checkOut` are read by regex from the policies
  section's text ("From 3:00 PM", "Until 11:00 AM").
- Sold-out dates were not tried live: with no `#hprt-table` rows the runtime replays the example,
  which answers, so the call should come back `input`.
- `maxPeople` reads the rooms table's screen-reader text; on `gb/the-savoy` that cell has none.
- `hotel` comes from the result link; a slug with a language suffix (`.en-gb.html`) would not be
  matched, but none appeared logged out with `accept-language: en-US`.
- The JSON-LD `Hotel` block on the property page has name, address and rating too; the HTML recipe
  was chosen for the facilities, subscores and policies it adds.
