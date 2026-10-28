These operations read Coursera's public, signed-out catalog. No login is needed.

`search(q)` returns the first server-rendered catalog page. Results may include courses, specializations, professional certificates and guided projects. Ranking, ratings and rounded summary counts can change. Pagination and catalog filters are not supported.

`getCourse(slug)` accepts the slug from a `/learn/` course link. It does not accept specialization, certificate or project URLs. Use the public course link from search. Course descriptions can be shortened by Coursera's JSON-LD source. Missing metadata is omitted.

These operations expose public discovery metadata only. They do not access paid lessons, assessments, enrollment, accounts or purchases. Availability of a public listing does not imply free course access.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using isolated API_ANYTHING_HOME directories, without importing browser cookies or logging in.

Frontend route provenance came from https://www.coursera.org/ links to `/courses?query=python`, `/courses?query=cybersecurity` and `/courses?query=digital%20marketing`. Python catalog cards supplied `/learn/python`, `/learn/python-basics` and `/learn/python-crash-course`. No guessed API endpoint or course identifier was used.

Real Chrome document captures used the experimental `bench/discovery/capture-document.mjs` helper under the resource watchdog and global browser mutex. It permits only the requested GET document and aborts other requests; inline scripts can still execute. Redirects are unsupported. Capture IDs were `cmvp2y0r17529af` for Python search, `cmvp2y86j1ef914` for cybersecurity search, `cmvp2yswv5e1527` for python details, and `cmvp2z2f0b68de5` for python-basics details. Each selected request was document ID 1, HTTP 200. Both operations learned with two differing examples and no final learning warnings.

Search trigger/request is `https://www.coursera.org/courses?query={q}`. Its recipe reads only `#searchResults .cds-ProductCard-base`, excluding other recommendation cards. Examples were q=python and q=cybersecurity. An unseen q=digital marketing tier-1 replay matched 12/12 separately fetched public frontend cards in order, exactly for title, URL, provider and summary.

Course trigger/request is `https://www.coursera.org/learn/{slug}`. It reads the first JSON-LD script, which was schema.org Course in every checked page, and picks metadata rather than reviewer text or lesson material. Examples were slug=python and slug=python-basics. The unseen slug=python-crash-course tier-1 replay matched all 10 returned fields against a separately fetched public Course JSON-LD object, including identity, title, provider, description, skills, learning outcomes and rating values.

Recorded public checks cover both examples and each unseen input, with tier-1-only verify. Separate initially empty fresh-home reuse is also tier 1 without cookies. Exact verification, export, vet and reuse receipts are retained under ignored `bench/explore/state/discovery/education-r1/`; the research report is `docs/research/discovery/education-r1.md`.

Only these public pages and inputs were checked. Locale, ranking and rating values may vary. The recipe's first JSON-LD script assumption has not been tested across the whole catalog. A later challenge, auth response or rate limit requires stopping the discovery run. Paid content and all site writes are excluded.
