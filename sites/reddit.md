No account is needed: the `.json` suffix is Reddit's own data endpoint for the page it mirrors.
Anonymous calls are rate-limited; a 403 or 429 is a "try again in a minute", not a change of shape.

- `search` is site-wide, ranked by Reddit; it answers the first page (about 25 posts).
- `hot` is one subreddit's hot feed, first page.
- `selftext` is present only on self posts; `url` is the external link on link posts.

## Maintainer notes

Verified 2026-10-30, logged out.

| op | args | returns | tier |
|---|---|---|---|
| `search` | `query` (example `linux kernel`) | about 25 posts: `title`, `url`, `subreddit`, `author`, `score`, `comments`, `permalink`, `selftext`, `created_utc` | 1 (GET of www.reddit.com/search.json) |
| `hot` | `sub` (example `programming`) | the subreddit's hot posts, same fields minus `subreddit` | 1 (GET of /r/<sub>/hot.json) |

```sh
api-anything call reddit search query="linux kernel"
api-anything call reddit hot sub=programming
```
