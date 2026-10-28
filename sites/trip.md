`listHotels(destination)` reads the hotel list on a public destination landing page.
Use the complete final route segment from a Trip.com hotel-list URL, for example
`shanghai-hotels-list-2`, `singapore-hotels-list-73`, or `london-hotels-list-338`.
The city name alone is insufficient. No account is required for the checked pages.

The list contains the page's JSON-LD hotel entries, nine in each checked destination.
It is not every hotel in the city. Guest ratings use a ten-point scale; stars are
hotel classifications. Ratings and review counts can change. This operation does
not select travel dates, search availability, quote prices, apply filters or page
through results. Hotel URLs identify public detail pages; no detail operation is
included.

## Maintainer notes

Verified 2026-10-26 UTC, approximately 09:30 through 09:33, in a new signed-out
browser profile. No everyday browser cookies or private sessions were imported.
Source and request are the same public GET document:
`https://www.trip.com/hotels/{destination}/`.
Destination route segments came from actual links on `https://www.trip.com/`.

Learned with two real frontend captures:
- `shanghai-hotels-list-2`, capture `cmvp23gt5`, first hotel Radisson Collection Hyland Shanghai, detail ID 375477.
- `singapore-hotels-list-73`, capture `cmvp23soy`, first hotel Hotel Boss, detail ID 3801236.

The recipe reads `itemListElement[*].item` from the first application/ld+json
script. The current pages place the Hotel ItemList before FAQPage. This ordering
is a maintenance dependency. The stable matcher is GET, www.trip.com, /hotels/*/;
it contains no captured hash, nonce or destination ID.

Unseen `london-hotels-list-338` answered at tier 1 with nine hotels. All nine
name/URL pairs exactly matched separate frontend capture `cmvp24vs2`; the first
was Park Grand Heathrow, detail ID 3037865, followed by Royal National Hotel,
detail ID 2985758. These replace the Shanghai example hotels. `verify trip`
passed both the Shanghai example and London check, each at tier 1, with zero
failures or inconclusive cases.

Export with public examples returned zero warnings. Copied only that exported
spec into a fresh API_ANYTHING_HOME with no cookies, session values, browser
profile or user-agent cache. Its London call succeeded at tier 1 and returned
the same nine name/URL pairs. Raw captures, calls and gate logs remain ignored
under bench/explore/state/discovery/shopping-travel-r3/home/.

These checks cover public destination lists only. They do not establish stable
ranking, a complete inventory, live bookable availability, or accessibility from
every location. No booking, account or payment action was performed.
