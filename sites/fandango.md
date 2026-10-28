`getMovie(moviePath)` reads public movie metadata. Copy the complete path segment before
`/movie-overview` from a Fandango movie link, including its numeric suffix. For example,
`clayface-2026-244768`. Titles include the year displayed by the site.

`runtimeMinutes` is numeric minutes, confirmed against the page's hours/minutes label on
three movies. `releaseDate` is the film release date advertised by Fandango. It does not
establish a cinema screening or ticket availability. `genres` is the site's comma-separated
string, preserving its labels. The content rating is the site's supplied label.

No login is needed for the verified reads. Showtimes, cinemas, personal location, ticket
inventory, purchasing, accounts, pagination and film search were not verified. Movie paths
must come from public links; malformed or missing movie pages were not qualified. Metadata
can change. There is no synopsis or article-body extraction.

## Maintainer notes

Verified signed out on 2026-10-26 UTC with isolated browser and replay homes. No everyday
browser profile or private cookies were imported. Actual frontend GET document captures:
`cmvp6ia9z7f2426` for
`https://www.fandango.com/klara-and-the-sun-2026-246291/movie-overview`, and
`cmvp6j6dq03e747` for
`https://www.fandango.com/wildwood-2026-246438/movie-overview`. Each selected document is
request 1. The exact-GET document helper aborted 78 and 80 other requests respectively,
with its 15-second timeout and global browser mutex. Inline scripts could run and set guest
cookies; the second capture sent guest cookies from this isolated profile. This proves
frontend document capture, not a fully hydrated GUI.

Learning used both differing examples without warnings. The recipe selects the standalone
Movie JSON-LD before FAQPage. Numeric durations 116 and 130 match visible runtime statements
of 1 hr 56 min and 2 hr 10 min. The held-out Clayface path was an actual link in the saved
first source, without ID or route guessing. Its single cookie-free tier-1 GET returned
Clayface (2026), 108 minutes, R, 2026-10-23, Horror and the matching canonical URL.
A separate cookie-free GET and Python HTMLParser comparison of labeled HTML, without the
Movie JSON-LD recipe, matched all six fields. Its runtime label is 1 hr 48 min.

Current-version verify passed all three public movies at maxTier 1. Export retained public
examples and removed response samples. Reuse of the export from an initially empty home
passed at tier 1 without Cookie or Authorization. Direct vetShared returned no errors or
warnings. The parent owns integrated registry checks. Exact evidence paths, operation hash,
resource samples and limitations are in `docs/research/discovery/fandango-qualified-r2.md`.
Raw documents and captures remain ignored under
`bench/explore/state/discovery/fandango-qualified-r2/`.
