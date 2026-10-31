These operations read Coursera's public, signed-out catalog. No login is needed.

`search(q)` returns the first server-rendered catalog page. Results may include courses, specializations, professional certificates and guided projects. Ranking, ratings and rounded summary counts can change. Pagination and catalog filters are not supported.

`getCourse(slug)` accepts the slug from a `/learn/` course link. It does not accept specialization, certificate or project URLs. Use the public course link from search. Course descriptions can be shortened by Coursera's JSON-LD source. Missing metadata is omitted.

These operations expose public discovery metadata only. They do not access paid lessons, assessments, enrollment, accounts or purchases. Availability of a public listing does not imply free course access.

`getSpecializationCourses(slug)` accepts the slug from a public `/specializations/` link and returns constituent courses in the displayed curriculum order. Each destination retains its specialization membership query. `courseSummary` contains Coursera's displayed course number and estimated workload. The order is not proof of enrollment prerequisites. Estimates can change. Certificates and degrees are separate page types.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using isolated API_ANYTHING_HOME directories, without importing browser cookies or logging in.

Frontend route provenance came from https://www.coursera.org/ links to `/courses?query=python`, `/courses?query=cybersecurity` and `/courses?query=digital%20marketing`. Python catalog cards supplied `/learn/python`, `/learn/python-basics` and `/learn/python-crash-course`. No guessed API endpoint or course identifier was used.

Real Chrome document captures used the experimental `bench/discovery/capture-document.mjs` helper under the resource watchdog and global browser mutex. It permits only the requested GET document and aborts other requests; inline scripts can still execute. Redirects are unsupported. Capture IDs were `cmvp2y0r17529af` for Python search, `cmvp2y86j1ef914` for cybersecurity search, `cmvp2yswv5e1527` for python details, and `cmvp2z2f0b68de5` for python-basics details. Each selected request was document ID 1, HTTP 200. Both operations learned with two differing examples and no final learning warnings.

Search trigger/request is `https://www.coursera.org/courses?query={q}`. Its recipe reads only `#searchResults .cds-ProductCard-base`, excluding other recommendation cards. Examples were q=python and q=cybersecurity. An unseen q=digital marketing tier-1 replay matched 12/12 separately fetched public frontend cards in order, exactly for title, URL, provider and summary.

Course trigger/request is `https://www.coursera.org/learn/{slug}`. It reads the first JSON-LD script, which was schema.org Course in every checked page, and picks metadata rather than reviewer text or lesson material. Examples were slug=python and slug=python-basics. The unseen slug=python-crash-course tier-1 replay matched all 10 returned fields against a separately fetched public Course JSON-LD object, including identity, title, provider, description, skills, learning outcomes and rating values.

Recorded public checks cover both examples and each unseen input, with tier-1-only verify. Separate initially empty fresh-home reuse is also tier 1 without cookies. Exact verification, export, vet and reuse receipts are retained under ignored `bench/explore/state/discovery/education-r1/`; the research report is `docs/research/discovery/education-r1.md`.

Only these public pages and inputs were checked. Locale, ranking and rating values may vary. The recipe's first JSON-LD script assumption has not been tested across the whole catalog. A later challenge, auth response or rate limit requires stopping the discovery run. Paid content and all site writes are excluded.

Curriculum qualification on 2026-10-28 UTC: genuine signed-out exact-document captures of Machine Learning and Deep Learning returned three and five ordered course records. The HTML recipe selects only the syllabus accordion course items. It does not select footer recommendations. Learning used both documents and emitted zero warnings. Qualification receipts and hashes are recorded in docs/research/discovery/coursera-curriculum-qualified-r2.md.

`getSpecializationCourses(slug)` uses `https://www.coursera.org/specializations/{slug}` as trigger and request. Actual Chrome document captures were machine-learning-introduction and deep-learning, selected request ID 1 in each, HTTP 200. The current captures show three and five courses. A distinct Excel specialization URL came from an actual link on the Machine Learning page, with no Excel detail content inspected before the tier-1 replay. A separate Excel Chrome document capture and a Python HTMLParser comparator matched every returned field and course position across all four records. A and B also matched independent comparisons. Public checks use deep-learning and excel in addition to the Machine Learning example.

Offline candidate preflight preceded unseen, cold and verification requests. An initially empty home received the exact final export, and its new operation's first call succeeded at tier 1 with Cookie and Authorization absent. Coursera then issued CSRF3-Token and __204u guest cookies; all-read verification reused only those isolated site-issued cookies. All nine saved cases passed at tier 1 on 2026-10-28 UTC, preserving both complete original operations and all six original cases. Final public-example export and exact JSON/notes vet had zero errors and warnings. The parent owns integrated registry, lint and type gates before counting.

The exact-document helper ran directly under the global browser mutex. Historical resource watchdog wording above describes the older baseline only. No resource snapshots or wrappers ran in this qualification. No private cookie import, paid content, enrollment or website writes occurred. No live access stop occurred. An isolated HTTP 200 login mock tested the sticky core-judge guard; it is not Coursera frontend evidence.
