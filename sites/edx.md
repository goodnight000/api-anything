# edX public provider courses

`listCourses(school)` lists the initial public course cards on an edX provider page. Use a provider slug from an actual `https://www.edx.org/school/` link, such as `harvardx`, `edx` or `uc-berkeleyx`.

Each row returns the displayed course `title`, displayed `provider` and absolute frontend `url`. Program and certificate cards are excluded. The initial list is partial. Pagination, the complete catalog, course details, tuition, workload, enrollment and access to course content are outside this operation. A successful listing does not establish that enrollment is open or free. A removed or empty provider page can fail extraction; no reliable empty-provider contract was established.

## Maintainer notes

Qualified signed out on 2026-10-26 UTC. Real exact-document browser captures were Harvard `cmvp9nj6ebd5213`, document 1, and edX `cmvp9qelpd6897c`, document 1. Each capture supplied 32 course cards matching an independent HTMLParser audit. Request URLs were `https://www.edx.org/school/harvardx` and `https://www.edx.org/school/edx`; these documents directly contain the returned data. The capture helper limits requests to the exact GET document and does not prove a fully hydrated GUI.

The held-out `uc-berkeleyx` provider was grounded in an indexed official URL, then independently read and parsed. Its clean canonical `/school/uc-berkeleyx` route was supplied by that document. Every replay URL and combined title, provider and Course label matched the independent source. Current exported-version verification passed all three provider cases at tier 1. Fresh reuse from an initially empty home passed at tier 1 with no Cookie or Authorization header on its first request. Ordinary anonymous response cookies may be used by later requests in a verification home; no private session was imported. Export retained public examples, and final JSON plus these notes passed `vetShared` with zero issues.

Detailed capture, source, comparison, request-header-presence and current-version receipts are described in `docs/research/discovery/edx-coordinator-finalize-r4.md`. Raw HTML, captures and local session state remain in the ignored evidence directory. This recipe was verified on one date and may change with the frontend.
