No account is needed.

- `frontPage`: job posts have neither `points` nor `comments`. Self posts (Ask HN) have a relative
  `url` such as `item?id=...`. Only the first page is included, with no pagination.
- `search` returns stories only, ranked by popularity, and only page 0 (30 hits).

## Maintainer notes

Verified 2026-09-27, logged out, with `api-anything verify hacker-news` passing from a clean
`API_ANYTHING_HOME`.

| op | args | returns | tier |
|---|---|---|---|
| `frontPage` | none | 30 front-page stories: `title`, `url`, `points`, `comments` | 1 (HTML GET of news.ycombinator.com, about 150 ms) |
| `search` | `query` (example `sqlite`) | up to 30 story hits: `title`, `url`, `points`, `num_comments`, `objectID`, `author`, `created_at` | 1 (POST to the Algolia index behind hn.algolia.com, about 1 s) |

```sh
api-anything call hacker-news frontPage
api-anything call hacker-news search query=duckdb
```

### Known limits

- `frontPage` values are page text: `points` is `"105 points"`, and `comments` is `"11 comments"` or
  `"discuss"`.
- The `search` request carries Algolia's public search-only key (`x-algolia-api-key`, the one
  hn.algolia.com ships to every browser). The export hex-blob warning refers to that key.
- Algolia sends its JSON body under `content-type: application/x-www-form-urlencoded` (to skip
  the CORS preflight). api-anything reads such a body as JSON, so `add` finds the query at
  `["body", "json:/query"]` by itself (re-verified 2026-09-27).
