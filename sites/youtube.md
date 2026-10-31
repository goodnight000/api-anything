No account is needed.

- `views` is page text (`"148,107 views"`). A live stream has no `views`.
- Only the first page of results (about 20) is included.

## Maintainer notes

Verified 2026-09-27, logged out, with `api-anything verify youtube` passing from a clean
`API_ANYTHING_HOME` (no cookies). Then, with YouTube's cookies (`VISITOR_INFO1_LIVE`) in the jar,
eight queries in a row (`kittens`, `rust programming`, `café crème`, `iphone 17 review`, `best vpn`,
`running shoes`, `car insurance`, `lofi hip hop`) each returned 20 videos with no `{}` items.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `q` (example `kittens`) | the first results page, videos only: `id` (video id), `title`, `channel`, `views` | 1 (HTML GET of /results, about 1 to 1.5 s) |
| `captions` | `id` (example `jNQXAC9IVRw`), `lang` (default `en`) | the video's captions as one WebVTT text | local (runs `yt-dlp` on this machine, a few seconds) |

```sh
api-anything call youtube search q=otters
api-anything call youtube search "q=café crème"
api-anything call youtube captions id=jNQXAC9IVRw
api-anything call youtube captions "id=https://www.youtube.com/watch?v=jNQXAC9IVRw"
api-anything call youtube captions id=aqz-KE-bpKQ lang=de
```

### How `captions` works

`captions` is a local op: it has no request, it runs a shell command on the caller's machine and
its stdout is the answer. The command needs `yt-dlp` on the machine's PATH (no account, no
cookies of the user's); author subtitles are preferred over auto-generated ones, `vtt` format.
Without subtitles in the asked language the command exits non-zero and the call fails saying why.

```sh
api-anything call youtube search q=otters
api-anything call youtube search "q=café crème"
```

### How it works

The op reads the results page itself (`GET /results?search_query=...&sp=EgIQAQ%253D%253D`), not the
innertube API. `sp=EgIQAQ==` is the page's own "Type: Video" filter; without it the first section
mixes in shelves, channels and "lockup" cards, which `pick` turned into `{}` items. The page
embeds its data as `var ytInitialData = {...}`, which `--embedded` parses. The page has no
rotating ids, so it needs no healing in the common case.

### Known limits

- **Ads after the first call.** Tier 1 keeps the cookies YouTube sets. Once the jar holds
  `VISITOR_INFO1_LIVE`, YouTube serves in-feed ads and splits the results: a leading section (a
  `searchPyvRenderer` ad, a shelf, one or two videos), an `adSlotRenderer` section, then the main
  list. The extract path uses `contents[*]`, which joins the videos of every section, and `pick`
  drops the ad and shelf items, so the call returns only videos either way.
- A live stream's count is "N watching", in another field.
- The innertube search POST (`/youtubei/v1/search`) sends a gzip-compressed body; api-anything now
  decodes such bodies, but this op keeps to the document, which needs no client context.
- `captions` has no tier ladder to heal with: the command failing is the answer (its exit and
  stderr come back as the reason). It can be a read that needs a machine's `yt-dlp` (and network
  reach to YouTube's timedtext endpoints); a `lang` the video does not have fails the call.
