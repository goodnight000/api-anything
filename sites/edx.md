# edX public courses

`listCourses(school)` lists initial provider course cards. Use a slug from an actual /school/ link. Pagination and complete catalog coverage are excluded. Empty or removed provider pages have no established empty-result contract.

`getCourse(subject, courseSlug)` reads public structured course metadata. Take both arguments together from one actual /learn/{subject}/{courseSlug} URL returned by listCourses. Arbitrary combinations are unproved. Provider names and learning outcomes retain source order. Prerequisites are the source statements, including “None” when supplied. Language is the source language code. Missing source fields may be absent.

Details come from the document’s Course JSON-LD, not a fully hydrated course interface. Neither operation establishes enrollment availability, free access, price, completion, or access to course content. Course dates, duration and workload are excluded.

`getProgramCourses(programSlug)` lists course members of the observed professional-certificate route, in the document's supplied frontend course order. Use a slug from a literal program link. Course URLs retain the source's double slash before learn. Take subject and courseSlug together from the two segments following /learn/ to call getCourse; do not send the double-slash URL as a detail request. Membership order does not establish prerequisites or required sequencing. Full curriculum, certificate rights, prices and enrollment guarantees are unproved.

## Maintainer notes

Program membership qualification evidence: docs/research/discovery/edx-program-curriculum-qualified-r1.md. Signed out on 2026-10-28 UTC, genuine exact-GET frontend captures and paired learning. JSON-LD membership order agrees with separately parsed frontend courses props. Hydrated DOM order is not independently observed.



Course details qualified signed out on 2026-10-28 UTC using genuine exact-GET browser captures and paired learning. Independent source, unseen tier-1, initially empty-home and exact-version verification receipts are in docs/research/discovery/edx-course-qualified-r1.md. No private session imported. Only isolated site-issued guest cookies may be reused after the first cookie-free request.

### Historical provider evidence


Qualified signed out on 2026-10-26 UTC. Real exact-document browser captures were Harvard `cmvp9nj6ebd5213`, document 1, and edX `cmvp9qelpd6897c`, document 1. Each capture supplied 32 course cards matching an independent HTMLParser audit. Request URLs were `https://www.edx.org/school/harvardx` and `https://www.edx.org/school/edx`; these documents directly contain the returned data. The capture helper limits requests to the exact GET document and does not prove a fully hydrated GUI.

The held-out `uc-berkeleyx` provider was grounded in an indexed official URL, then independently read and parsed. Its clean canonical `/school/uc-berkeleyx` route was supplied by that document. Every replay URL and combined title, provider and Course label matched the independent source. Current exported-version verification passed all three provider cases at tier 1. Fresh reuse from an initially empty home passed at tier 1 with no Cookie or Authorization header on its first request. Ordinary anonymous response cookies may be used by later requests in a verification home; no private session was imported. Export retained public examples, and final JSON plus these notes passed `vetShared` with zero issues.

Detailed capture, source, comparison, request-header-presence and current-version receipts are described in `docs/research/discovery/edx-coordinator-finalize-r4.md`. Raw HTML, captures and local session state remain in the ignored evidence directory. This recipe was verified on one date and may change with the frontend.
