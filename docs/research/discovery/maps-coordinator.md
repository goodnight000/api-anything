# Google Maps coordinator investigation

Status: PASS for one saved public-read operation, searchPlaces(query). Final saved files are sites/google-maps.json and sites/google-maps.md. Earlier incomplete stages below are retained as attempt history. Investigated 2026-10-26 UTC with public signed-out inputs.
Google Search and Trends remain stopped after their earlier controls. This work follows the
actual Maps frontend and does not claim access to general search.

Two standard CLI captures succeeded under the global browser mutex and resource watchdog:
`cmvp2un0o`, query `coffee San Francisco`, and `cmvp2xqi3`, query `pizza New York`.
Both captured the actual Maps frontend GET request to `https://www.google.com/search` with
`tbm=map`, query and Maps protocol parameters. Request 2 returned HTTP 200, XSSI JSON.
The places are the 20 records at `[64]`, each place under `[1]`. Public fields include name,
address, place ID, category, ratings, coordinates and website. The initial wildcard recipe
flattened positional arrays incorrectly; it was replaced through CLI add using the same
unchanged original captures. Failed preview evidence remains ignored.

The corrected local `searchPlaces(query)` candidate has minTier 1, established by the
learner's second-example template replay. The browser's own New York pizza results included
businesses outside New York, so the operation cannot promise a geographic boundary.
At that stage there was no unseen-input success, completed verify, fresh-home reuse, export or
shared vet, and the original candidate was excluded from the catalog.

## Browser header classification

The two requests carry the same opaque `x-browser-validation` value. No raw value is saved
in this report. Before sharing, its provenance must be distinguished from user/session data.
A primary Chromium source was retrieved at 10:06 UTC:

https://chromium.googlesource.com/chromium/src/+/main/chrome/common/request_header_integrity/request_header_integrity_url_loader_throttle.cc?format=TEXT

`AddRequestIntegrityHeaders` derives its validation digest from the build's integrity seed,
Google API key and user agent, with no profile/cookie input in that function. Public source
uses placeholder header names; branded names are in private build headers. It also supports
additional runtime headers, so the source alone does not classify every captured browser
header. No header, key, signature or validation digest was generated, altered or spoofed.
An independent fresh-profile Maps capture is pending to test equality across profiles.
Only the original captured template would be replayed if classified appropriately.

## Resource deferral and continuation

At 10:07:52 UTC an unseen `museums in Chicago` max-tier-1 call was denied admission at
89.23% policy memory. It sent no website request. A fresh-profile capture admission at
10:08:05 was also denied at 89.26%; no capture was produced. The second gate was sampled
13 seconds later, shorter than the runbook's 30-second resample interval. This scheduling
mistake sent no request; later resamples must wait the full interval. Both exited 75.

Raw captures, original CLI commands, local candidate, public-source file, denied logs and
continuation scripts remain ignored under `bench/explore/state/discovery/coordinator-maps/`.
No credentials or raw responses were copied into shared files. No publication or source
behavior change occurred. Continue only after resource admission, under the owned mutex.

## 10:11 UTC progress

Fresh-profile standard CLI capture `cmvp3h3cb` completed for `museums in Chicago`, with
HTTP 200 document and actual Maps request 2. The earlier template then returned 20 places
at tier 1; all 20 ordered place IDs and every extracted field exactly match that frontend
response. Receipt `chicago-comparison.json`. This establishes unseen semantic replay for
the original local candidate, but does not by itself authorize sharing its opaque headers.

This fresh capture used CLI `--write` to intercept unsafe requests. Its request representation
contains no `x-browser-*` headers, so profile equality could not be established. The comparison
receipt records absence rather than claiming equality. A replacement CLI add is being tested
using this genuine Chicago capture first and original pizza capture second. The latter file
was copied byte for byte with its original ID into the isolated fresh home; it was not modified.
The aim is a naturally captured template without opaque browser headers. No header was
manually removed and no validation algorithm was implemented.

The first replacement add was resource-denied at CPU 72.28%, memory 86.73%, at 10:10:10 UTC.
A subsequent premature coffee call found no local site and sent no request. That dependent
call should have been skipped; its local input failure is preserved. The new add retry waited
more than 30 seconds. No replacement spec or export is counted until it passes all gates.

## Final saved operation at 10:13 UTC

Replacement learning succeeded from Chicago and New York captures. Its request naturally
contains no opaque browser headers, Cookie header or credential refs. The CLI learner proved
tier1 replay with the second query. Final-template unseen coffee San Francisco matched all20
ordered frontend place IDs and every stable field; one review count differed. Ratings/counts
are time-dependent and no equality was forced. The later fresh-home replay matched every row.

All three real verifySite cases passed at tier1, no failed/inconclusive cases. Export scanning
and direct vetShared returned zero warnings/errors. CLI export used keep-examples and saved
sites/google-maps.json. A newly created, initially empty home loaded that export and made one
HTTP request at tier1, with no cookie, opaque browser header or healing. It returned20 rows
exactly equal to the unseen replay. The integrated all-bundled registry gate then passed.

Exact receipts: coffee-comparison.json, verify.json, export-candidate.json, vet.json,
finalization.json, fresh-reuse.json, cli-export.json, cleanup-resources.json, plus unchanged
captures and CLI logs. No core behavior was changed. No commit or public publication occurred.

Coordinator resource census: 45 samples, peak CPU 73.02%, policy memory 89.26%, raw occupied 99.69%. Denied admissions are included. Raw occupied includes file cache. Owned browser PID count 0, owned mutex False.
