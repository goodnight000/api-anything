# amazon

Verified 2026-09-27, logged out, with `api-anything verify amazon` passing twice from a clean
`API_ANYTHING_HOME` (no cookies, tier 1). No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `k` (example `kettle`) | the first results page: `asin`, `title`, `price` | 1 (HTML GET of /s, about 1.3 to 1.5 s) |

```sh
api-anything call amazon search "k=french press"
```

## How it works

The op reads the server-rendered results page (`GET /s?k=...`) with an `--html` recipe:
items are `div[data-component-type=s-search-result]`, with the ASIN from `data-asin`, the title
from `h2` and the price from `.a-price .a-offscreen`.

## Known limits

- Sponsored results are included as the page shows them. Items without a price omit `price`.
- Amazon answers automated traffic with a 503 "automated access" page or a captcha; api-anything
  classifies both as `blocked` and escalates to Chrome. If a real Chrome is challenged too, ask the
  user to run `api-anything login amazon` and clear it. Keep call volume human.
- Only amazon.com and the first results page are covered.
