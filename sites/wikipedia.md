No account is needed. English Wikipedia only (en.wikipedia.org).

- `searchArticles` matches titles by prefix, like the search box: use it to turn a name into an
  article `key`. For a topic rather than a name, use `searchText`.
- `getSummary` takes the `key` from `searchArticles` (`Ada_Lovelace`). A title that redirects
  (`USA`) answers with the target article (`United States`). A title that doesn't exist answers `class: "input"`.
- A `getSummary` with `type: "disambiguation"` is a page listing several meanings: its `extract`
  says little. Search again with a more specific title.
- `searchText` returns page 1 only (20 hits). `url` is the full article link; the article `key` is
  its last path segment.

## Maintainer notes

Verified 2026-10-31, logged out, from a clean `API_ANYTHING_HOME`: `api-anything verify wikipedia`
passed 5 of 5 cases (each op's example, plus an `empty` check for `searchText` and an `input` check
for a missing page in `getSummary`). Every call answered at tier 1 (plain HTTP).

| op | how it was learned | checked with (not an example) | tier |
|---|---|---|---|
| `searchArticles` | typing into the search box on the Main Page fires `GET /w/rest.php/v1/search/title?q=...&limit=10` | `q="ada love"` (Ada Lovelace first) | 1, about 0.4 s |
| `getSummary` | `GET /api/rest_v1/page/summary/<title>`, the endpoint the page previews (link hover cards) call; the trigger opens that URL directly, since the trigger steps can't hover | `title=Ada_Lovelace`, `title=Grace Hopper` (with a space), `title=USA` (redirect), `title=Mercury` (disambiguation) | 1, about 0.4-0.7 s |
| `searchText` | the server-rendered `Special:Search` page (`fulltext=1` so an exact title does not jump to the article; `ns0=1` for articles only), read with an HTML recipe | `q="tidal locking moon"` (Tidal locking first); `q=zzqqxxwvnothingmatch` gives `[]` | 1, about 1.5 s |

The `empty` element of the `searchText` recipe is `p.mw-search-nonefound`, the "There were no
results" message.
