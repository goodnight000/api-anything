# hacker-news

Verified 2026-09-27, logged out, with `site2api verify hacker-news` passing from a clean
`SITE2API_HOME`. No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `frontPage` | none | 30 front-page stories: `title`, `url`, `points`, `comments` | 1 (HTML GET of news.ycombinator.com, about 150 ms) |
| `search` | `query` (example `sqlite`) | up to 30 story hits: `title`, `url`, `points`, `num_comments`, `objectID`, `author`, `created_at` | 1 (POST to the Algolia index behind hn.algolia.com, about 1 s) |

```sh
site2api call hacker-news frontPage
site2api call hacker-news search query=duckdb
```

## Known limits

- `frontPage` values are page text: `points` is `"105 points"`, and `comments` is `"11 comments"` or
  `"discuss"`. Job posts have neither field. Self posts (Ask HN) have a relative `url` such as `item?id=...`.
  Only the first page is included, with no pagination.
- `search` returns stories only, ranked by popularity, and only page 0 (30 hits). The request carries
  Algolia's public search-only key (`x-algolia-api-key`, the one hn.algolia.com ships to every
  browser). The export hex-blob warning refers to that key.
- Algolia sends its JSON body under `content-type: application/x-www-form-urlencoded` (to skip
  the CORS preflight). site2api reads such a body as JSON, so `add` finds the query at
  `["body", "json:/query"]` by itself (re-verified 2026-09-27).
