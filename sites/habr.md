No account is needed. Results are in Russian (the author's language).

- `articleId` is the number in an article or news link: `habr.com/ru/articles/541600/`,
  `/ru/news/541600/`, `/ru/companies/selectel/news/1100148/`. Short posts (`/ru/posts/<id>/`) have no
  AMP page and answer `class: "input"` (not found).
- `text` is the body as plain text, without images or code formatting. A long article is cut at the
  output cap (`truncated`).
- `author` is the login, not the display name. `tags` can be empty.
- Search is not covered: there is no op that finds articles by words. Get ids from habr.com links.

## Maintainer notes

Verified on 2026-10-31 (US Pacific; 2026-11-01 UTC), logged out, from a US network, with an isolated
`API_ANYTHING_HOME` and no imported cookies. Habr served every page with no challenge.

- `getArticle` reads `https://habr.com/ru/amp/publications/{articleId}/`, the AMP version, with an
  HTML recipe. Examples 541600 (a 2021 news item) and 1098040 (an article). Unseen calls at tier 1:
  1102148 (article, 8 tags) and 1100148 (a company-blog news item); 999999999 and the short post
  1095606 answer 404. `verify habr` passed 2/2 at tier 1, also in a second empty home given only
  the exported spec.
- Why AMP and not the regular page: Habr's script sets a cookie `habr_web_home_feed=/articles/`, so
  any learned URL containing `/articles/` (the regular article page, hub listings
  `/ru/hubs/<hub>/articles/`, and the JSON API `/kek/v2/articles/...`) is refused by `add` as holding
  a live cookie value. The AMP page runs no Habr script and has no `/articles/` in its path.
- Search was tried and dropped. `/ru/search/?q=` renders no results on the server; the frontend
  fetches `https://habr.com/kek/v2/articles/?query=...` through its service worker, which captures
  never see. That JSON (fetched directly, it works over plain HTTP) holds the results as a map keyed
  by article id (`publicationRefs`), which `extract`/`pick` can't turn into a list (`varyingKeys`).
  The RSS search feed (`/ru/rss/search/?q=`) failed to load in the capture browser
  (`ERR_SOCKET_NOT_CONNECTED`, twice).
- Hub listings (`/ru/hubs/<hub>/news/`, `/posts/`) are server-rendered and would work, but carry
  only news and short posts, so they were left out.
