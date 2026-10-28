# Education source preparation round 2

Status: ISSUES for research preparation. Both sites have grounded public course links. edX has useful opened catalog evidence; Khan Academy has official linked course identities but unreadable course bodies in the remote tool. Neither is qualified or saved as an operation.

Research date: 2026-10-26 UTC. All source URLs below were searched or opened on this date using the remote `mcp__codex_apps__search_service_web_run` tool. Its `Crawled` labels describe remote retrieval/index state, not independently measured origin freshness. No local browser, local website network command, API replay, login, cookie import, account action or site write occurred. Only this report was written. The parent supplied light-worker admission at 12:30:12 UTC, CPU 12.08% and policy memory 89.34%; that is not local browser admission or a continuous resource measurement by this worker.

Read current AGENTS.md, design material, the discovery runbook, discovery index, education-r1 report and the scoped task entry in state.json. Coursera remains out of scope. The prior Udemy challenge stop remains in force; neither was contacted. Shared catalog/state, specs, source and dependencies were untouched.

## Official interface screen

### edX

Opened primary documentation:

- [Discovery service introduction](https://edx.readthedocs.io/projects/edx-discovery-api/en/latest/intro_edx_apis.html) documents course, course-run, program, catalog and search metadata. This establishes an official implementation interface, not anonymous access to the current consumer catalog.
- [Course Catalog API overview](https://course-catalog-api-guide.readthedocs.io/en/latest/course_catalog/overview.html) explicitly requires requested credentials and an access token, and describes catalogs created for the caller.
- [Enterprise API credentials](https://business-support.edx.org/hc/en-us/articles/360005421553-4-1-Get-your-Enterprise-API-credentials) requires a company account, reviewed access request and client credentials. No access request or token call was made.
- [Catalog metadata synchronization](https://business-support.edx.org/hc/en-us/articles/13588952318231-3-1-Catalog-Metadata-Synchronization) describes API and batch-transfer options for customer-curated catalogs. This is a documented feed alternative for eligible enterprise customers, not demonstrated anonymous consumer access.

Bounded official-source searches did not establish a readily usable anonymous catalog API, public catalog feed or official agent connector. This is a limited search result, not proof that none exists. Public frontend metadata remains useful for a signed-out caller without enterprise integration. Prefer the official integration when the caller already has appropriate access.

### Khan Academy

Opened primary [engineering account of the rewrite](https://blog.khanacademy.org/technical-choices-behind-a-successful-rewrite-project/) describes a Go backend with GraphQL. It does not document a supported anonymous catalog API, endpoint, query or connector. No GraphQL request was attempted. Official-source API/feed/MCP searches did not establish an easy consumer catalog equivalent. The [status API](https://status.khanacademy.org/api), encountered as an index-only lead, concerns service health, not courses.

An opened [community discussion hosted on the help center](https://support.khanacademy.org/hc/en-us/community/posts/360073275571-Connecting-to-Khan-Academy-post-API-decommissioning) discusses decommissioning. It is user-authored, not authoritative current API policy, and its suggested unofficial route was not followed. The current availability of a supported public catalog interface remains unknown. Frontend investigation is conditional on that screening result and on later resource admission.

## edX candidate and varying examples

Opened primary [Harvard University catalog](https://www.edx.org/school/harvardx) identifies Harvard University as provider and separates Courses from Programs. It links all three detail pages below. The first two are prospective learning examples; the third is reserved for later unseen replay, although its public link and page were inspected during preparation.

1. [CS50's Introduction to Computer Science](https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science)
2. [CS50's Introduction to Programming with Python](https://www.edx.org/learn/python/harvard-university-cs50-s-introduction-to-programming-with-python)
3. [CS50's Introduction to Cybersecurity](https://www.edx.org/learn/cybersecurity/harvard-university-cs50-s-introduction-to-cybersecurity)

Each link was followed from the catalog. Opened detail responses had course-specific page titles but only shared navigation/footer body text. They do not establish a detail extraction recipe. The catalog itself supports title, linked frontend URL, provider and product kind. A linked URL is a candidate canonical identity, not proof of a canonical HTML tag or internal course ID.

Index-only metadata leads, not fresh detail proof: the exact Python URL above was indexed with 10 weeks and 3–9 hours/week; the Harvard catalog index showed introductory level and five weeks for Cybersecurity. Other indexed card summaries used months. Preserve the displayed context and units rather than normalizing card estimates into a definitive completion duration. Language, transcript language and course subject need independent detail evidence; URL categories alone are insufficient.

Useful next question: “What are these courses called, who provides them, and what level and workload does each detail page advertise?” Prioritize a narrow course-detail operation after actual capture establishes where its metadata lives. Provider-catalog listing is a separate operation and currently has only one opened provider example. The catalog's additional-course affordance means its initial list is not complete. Programs are aggregates, not course aliases; retain product type and provider separately. No request endpoint, bundle location, ID or selector is proposed.

## Khan Academy candidate and varying examples

Opened primary [Khan Academy's Texas course announcement](https://blog.khanacademy.org/khanfortexas/) directly links these public student courses. Followed links supplied the exact URLs:

1. [Geometry (TX TEKS)](https://www.khanacademy.org/math/geometry-tx)
2. [Algebra 2 (TX TEKS)](https://www.khanacademy.org/math/algebra-2-tx)
3. [High school biology (TX TEKS)](https://www.khanacademy.org/science/hs-biology-tx), reserved for later unseen replay.

The announcement supports names, Khan Academy identity and Texas TEKS alignment. The three course opens returned `text/html` records with zero readable lines. Earlier homepage, math and science discovery opens also returned no readable body. No extraction recipe, unit list, canonical tag, language, duration or current access claim follows from these responses. No repeat retrieval of the same URL or alternate transport followed.

Index-only variation evidence includes [Algebra 1 (TX TEKS)](https://www.khanacademy.org/math/algebra-1-tx), shown as 14 units and 160 skills, and [Algebra 1 (FL B.E.S.T.)](https://www.khanacademy.org/math/algebra-1-fl-best), shown as 13 units. Their opens supplied no readable body. These illustrate why curriculum alignment belongs in identity; neither is interchangeable with a generic Algebra 1 course. Counts are not current verified outputs. Do not mistake a skill count for lesson count or infer hours from unit count.

Useful next question: “Which public courses match a subject and curriculum, and which units belong to one course?” Keep subject, course, unit and lesson identities distinct. Initially scope output to title, frontend link, platform, subject and explicitly displayed grade/curriculum. Keep duration and language absent unless genuinely course-scoped evidence appears. Public unit metadata can be considered later; exercises, solutions, transcripts, full lesson text, classrooms and progress remain excluded. This site ranks below edX because opened course metadata is missing.

## Controls, continuation and missing proof

No tool response exposed an auth wall, challenge, HTTP 403/429 or robots restriction. Empty extraction is an evidence gap, not proof of an access control or successful public retrieval. Ordinary sign-in links on the readable help-center page were not auth walls. Documentation requiring credentials was read as documentation only.

After the parent admits local work, start with the grounded edX examples and inspect genuine frontend traffic without assuming SSR or JSON-LD. Khan Academy's linked Texas examples are the secondary candidate. Stop immediately on an observed control; do not try another domain, transport or route to get around it. Readable marketing pages do not prove free enrollment or current course access.

All operation gates remain missing: genuine frontend capture, two differing learning examples, source-grounded field mapping, independent semantic comparison of the held-out third, tier-1 replay, verify, empty-home cookie-free reuse, public export and shared vet. Search-index evidence cannot satisfy any gate. No spec or registry count should change from this report. Parent owns catalog/state integration and all later validation.
