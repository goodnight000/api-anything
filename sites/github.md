No account is needed for public repositories. Unauthenticated reads are limited to 60 per hour per
IP; a 403 with `x-ratelimit-remaining: 0` is "wait for the window", not a change of shape.

- `repo` and `readme` are single objects. `readme`'s `content` is base64 (decode it; `encoding` says so).
- `issues` answers the first page (30), newest first; GitHub lists pull requests in it too, so an
  entry with no `base` is a pull request. `pulls` is the pull-request-only list.
- All list calls answer one page; there is no paging param in these specs.

## Maintainer notes

Verified 2026-10-30, logged out, against api.github.com.

| op | args | returns | tier |
|---|---|---|---|
| `repo` | `owner`, `repo` (example `torvalds`/`linux`) | `full_name`, `description`, `stargazers_count`, `forks_count`, `open_issues_count`, `default_branch`, `license_name`, last activity | 1 (GET of api.github.com/repos/…) |
| `readme` | `owner`, `repo` | `name`, `size`, `content` (base64), `download_url` | 1 (GET of …/readme) |
| `issues` | `owner`, `repo`, `state` (default `open`) | up to 30: `number`, `title`, `state`, `author`, `comments`, dates, url | 1 (GET of …/issues) |
| `pulls` | `owner`, `repo`, `state` (default `open`) | up to 30: same plus `merged_at` | 1 (GET of …/pulls) |

```sh
api-anything call github repo owner=torvalds repo=linux
api-anything call github issues owner=torvalds repo=linux state=all
```
