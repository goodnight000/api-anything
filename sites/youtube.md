# youtube

Verified 2026-09-27, logged out, with `api-anything verify youtube` passing twice from a clean
`API_ANYTHING_HOME` (no cookies). No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `q` (example `kittens`) | the first results page, videos only: `id` (video id), `title`, `channel`, `views` | 1 (HTML GET of /results, about 1 to 1.5 s) |

```sh
api-anything call youtube search q=otters
api-anything call youtube search "q=café crème"
```

## How it works

The op reads the results page itself (`GET /results?search_query=...&sp=EgIQAQ%253D%253D`), not the
innertube API. `sp=EgIQAQ==` is the page's own "Type: Video" filter; without it the first section
mixes in shelves, channels and "lockup" cards, which `pick` turned into `{}` items. The page
embeds its data as `var ytInitialData = {...}`, which `--embedded` parses. The page has no
rotating ids, so it needs no healing in the common case.

## Known limits

- **Ads after the first call.** Tier 1 keeps the cookies YouTube sets. Once the jar holds
  `VISITOR_INFO1_LIVE`, YouTube serves in-feed ads. It moves the first videos into an extra leading
  section (`searchPyvRenderer` ad, a shelf, one or two videos), then an `adSlotRenderer` section, then
  the main list. The op extracts section 0, so such a call returns only 1 to 3 items, and the
  ad/shelf ones are `{}`. Checked 2026-09-27: a cookieless call returned 20 clean videos, and the same
  query with the jar's cookies returned 3 items, 2 of them `{}`. The recipe language can't pick "the
  section that holds videos", so fixing this needs extract/pick support in `src/`. Until then, clear
  the cookies with `api-anything logout youtube` for a clean page.
- `views` is page text (`"148,107 views"`). Only the first page of results (about 20) is included.
- The innertube search POST (`/youtubei/v1/search`) sends a gzip-compressed body; api-anything now
  decodes such bodies, but this op keeps to the document, which needs no client context.
