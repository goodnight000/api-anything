# youtube

Verified 2026-09-27, logged out, with `api-anything verify youtube` passing twice from a clean
`API_ANYTHING_HOME` (no cookies). No account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `q` (example `kittens`) | the first results page: `id` (video id), `title`, `channel`, `views` | 1 (HTML GET of /results, about 1 to 1.5 s) |

```sh
api-anything call youtube search q=otters
api-anything call youtube search "q=café crème"
```

## How it works

The op reads the results page itself (`GET /results?search_query=...`), not the innertube API:
the page embeds its data as `var ytInitialData = {...}`, which `--embedded` parses. The page has no
rotating ids, so it needs no healing in the common case.

## Known limits

- Items that are not videos (shelves, "people also search", channels, ads) come back as `{}`,
  since `pick` reads `videoRenderer` fields only. Skip empty objects.
- `views` is page text (`"148,107 views"`). Only the first page of results (about 20) is included.
- The innertube search POST (`/youtubei/v1/search`) sends a gzip-compressed body; api-anything now
  decodes such bodies, but this op keeps to the document, which needs no client context.
