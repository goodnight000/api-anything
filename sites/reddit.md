No account is needed. Reddit answers plain HTTP from many networks with a JS challenge, so a
caller's first call often goes through the browser tier (about 12 s with Chrome starting, then 1 to
2 s a call). Later calls start there.

- `search` returns the first page of post results, about 7, ranked by Reddit. `votes` and
  `comments` are strings of digits. No comments, communities or people results.
- `hot` returns the posts the subreddit page renders first, usually 3 to 10, with no paging.
  `url` is the linked page on a link post and the post itself on a text post; `permalink` is
  relative to reddit.com.
- A subreddit that is private, banned or misspelled answers `input` (no posts on the page).

## Maintainer notes

Learned 2026-10-31 with `api-anything learn`, logged out, from the pages reddit.com serves
(`/search/?q=` and `/r/<sub>/hot/`), with an explicit `--html` recipe over the attributes Reddit
puts on each result. Holdouts `rust async` and `r/sqlite` answered at tier 1 in the learning
profile; the clean replay with no cookies met Reddit's JS challenge, which a caller's browser
passes on its own. `api-anything verify reddit` passed 4 of 4 from an empty `API_ANYTHING_HOME`,
at tier 2.

This replaces the `.json` data-endpoint spec proposed in #82: from this network those endpoints
answer `403 blocked by network security`, and no Reddit page requests them, so a browser could
not heal them.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `query` (example `linux kernel`) | about 7 posts: `title`, `subreddit`, `votes`, `comments`, `posted`, `url` | 1, or 2 behind the challenge |
| `hot` | `sub` (example `rust`) | the first posts: `title`, `subreddit`, `author`, `score`, `comments`, `url`, `permalink`, `posted`, `id` | 1, or 2 behind the challenge |

```sh
api-anything call reddit search query="local llm"
api-anything call reddit hot sub=programming
```
