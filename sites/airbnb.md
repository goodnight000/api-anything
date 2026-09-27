# airbnb

Verified 2026-09-27, logged out, with `api-anything verify airbnb` passing twice from a clean
`API_ANYTHING_HOME` (no cookies, tier 1). No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `loc` (example `Lisbon`) | the first page of stays: `id`, `name`, `price` (total for the default dates), `rating` | 1 (GraphQL POST, about 1.5 s) |

```sh
api-anything call airbnb search loc=Barcelona
api-anything call airbnb search "loc=São Paulo"
api-anything call airbnb search loc=東京
```

## How it works

The op replays the `StaysSearch` GraphQL request that airbnb.com's search page sends. It was
learned with `--soft-from https://www.airbnb.com/` (the XHR only fires on an in-app navigation).
The request carries the place in two JSON leaves and in the `referer` (percent-encoded when it is
filled, so any script works). The persisted-query hash in the path and body is a `volatile` with
the `StaysSearch` anchor, so a deploy that rotates it heals by rescan (verified live: about 5 s).

- `x-airbnb-api-key` is the public key airbnb.com ships to every browser; the export hex-blob
  warnings refer to the persisted-query hash, `traceparent` and `x-client-version`, all public.
- `x-csrf-token` and `x-csrf-without-token` are `session:` refs. With no session they are left
  out, and the search still answers.

## Known limits

- Dates, guests and filters are the site's defaults; only the place is a param.
- Only the first page (about 18 stays) is included. `price` is Airbnb's accessibility label text.
