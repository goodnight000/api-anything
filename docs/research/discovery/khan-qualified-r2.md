# Khan Academy qualification round 2

Status: PASS. Saved two public read operations in `sites/khan-academy.json` and caller/maintainer notes in `sites/khan-academy.md`. Both operations passed six current verification cases altogether, exact-export cookie-free reuse and direct shared vetting with zero errors or warnings. No source, dependency, shared state, runbook, catalog or other site file changed. No commit, push, PR or publication occurred. The parent owns integrated checks.

The batch ran on 2026-10-26 UTC within the twenty-minute bound. Resource receipts cover 13:35:07 through 13:45:27. Work used the existing shared dirty checkout. Read the repository instructions, authoritative design, contribution guide, local api-anything skill, discovery runbook, earlier Khan report, education source preparation, exact-document helper and resource gate. No nested work or sub-agents were launched.

## Operations and field meaning

Both operations require `subject` and `course`, the two lowercase path segments of a real public course URL. The supported local format is `[a-z0-9-]+` for each segment. These are free-form existing-link inputs, not a claimed complete enum of subjects or courses.

| Operation | Extraction | Output meaning |
|---|---|---|
| `getCourse(subject, course)` | `data.contentRoute.listedPathData.course` | `id`: course content identifier; `title`: translated course name; `description`: short catalog description; `path`: relative frontend course path; `slug`: course slug; `locale`: course `kaLocale`; `subject`: parent domain title; `subjectPath`: relative parent domain path |
| `listUnits(subject, course)` | The same course's `unitChildren` array | Each row's `id`: unit content identifier; `title`: translated unit title; `path`: relative frontend unit path; `slug`: unit slug, which can include the course identifier and a colon |

Paths resolve against `https://www.khanacademy.org`. Unit ordering is the current frontend ordering. A unit can be teacher resources or simulations; it is not a lesson count. Country context `US`, `lang=en` and app `khanacademy` remain captured constants. No locale selector, pagination, exhaustive subject catalog or unlisted-course support is claimed. No exercise solutions, transcripts, full lessons, classrooms, enrollment or progress are returned.

## Retained-body audit and frontend captures

Before any new site request, inspected the round-1 Geometry document capture `cmvpaiktx05f276`, exchange 1, read-only at `bench/explore/state/discovery/khan-qualified-r1/home/captures/`. Its eight scripts contain feature configuration and browser bootstrap information; the document has a course-specific canonical URL but no course heading or unit metadata. There is no established embedded course recipe in that shell. The parent baseline's substring detections were not treated as course-data proof. This worker did not alter the original capture.

The shell required a frontend network capture under default browser admission, not the 89% understood-SSR exception. An ignored batch helper uses the repository's `runTrigger`, allows only GET requests to `www.khanacademy.org`, `cdn.kastatic.org` and `www.kastatic.org`, aborts every other request and uses no UI steps. Actual browser-issued requests supplied the endpoint and its query fields. None was guessed. Aborted traffic was retained in the genuine capture files; no HTTP response was fabricated into an exchange.

| Purpose | Public source page | Capture | Data exchange | Observed course / units |
|---|---|---|---:|---|
| Learning example 1 | `https://www.khanacademy.org/math/geometry-tx` | `cmvpawglv8314fd` | 79 | Geometry (TX TEKS), 13 units |
| Learning example 2 | `https://www.khanacademy.org/math/algebra-2-tx` | `cmvpax6g6320fe9` | 77 | Algebra 2 (TX TEKS), 12 units |
| Held-out comparison, captured after its tier-1 replay | `https://www.khanacademy.org/science/hs-biology-tx` | `cmvpb1tb2089048` | 78 | High school biology (TX TEKS), 12 units |

All three used the actual GET `https://www.khanacademy.org/api/internal/graphql/ContentRouteCourseData`. Source identity and Texas curriculum names were independently grounded by the official announcement recorded in [education preparation](education-source-prep-r2.md). The two learning inputs were `{subject: math, course: geometry-tx}` and `{subject: math, course: algebra-2-tx}`. The held-out input was `{subject: science, course: hs-biology-tx}`; it was not used to learn either template.

Immediately audited every new capture's response statuses and bodies for access-control markers. All recorded answered requests were HTTP 200; control arrays were empty. The capture home was a new absolute isolated `API_ANYTHING_HOME`, with no private browser import, account login or everyday profile. Sixteen unrelated or non-GET exchanges were aborted in each frontend capture. No challenge, auth response, 429 or repeated site error occurred. The rendered Biology heading and navigation were separately captured, but that snapshot does not prove every interactive feature hydrated.

## Learning and unseen semantic comparison

`addOperation` learned both operations from the two genuine differing captures without network or browser learning fallback. Both had `minTier: 1`, no `unproven` mark, and parameterized the decoded JSON `variables.path` and Referer as `{subject}/{course}`. The stable matcher names GET, the exact public host and `/api/internal/graphql/ContentRouteCourseData`; the numeric persisted-query hash stays in the request, never in the matcher.

Learning classified the captured `pcv` publish-version field as a session reference. The candidate removed that query parameter and the captured constant `x-ka-fkey: 1` header. No substitute value was invented. The first held-out calls proved the minimized request answered cookie-free at tier 1. There are no credential references or literal cookies in the final spec. No field was marked public to waive a secret finding.

The unseen calls returned Biology with its Science parent, its Texas TEKS title and twelve units. A separate genuine frontend capture was then parsed independently of the operation recipe. Exact comparison matched all eight course fields and all four fields in all twelve unit rows. A rendered DOM snapshot separately checked the H1, course URL path, document language, subject in the document title and course ID embedded in unit links. All twelve displayed unit titles, paths and slugs matched in the displayed order. Unit navigation starts with The cellular basis of life and ends with Teacher resources; simulations remain a distinct unit.

The page repeats unit links in sidebar navigation and section headings. The comparison keeps the first rendered link for each path and strips its displayed `Unit N` prefix. An initial offline assertion selected the later duplicate and retained an extra `Unit N:` label; it failed before any site request. Correcting that parser made the comparison pass. Raw internal unit IDs and the short course description were compared to the separate frontend JSON; an independent rendered description was not captured.

## Verification, export and fresh reuse

All paths below are relative to ignored `bench/explore/state/discovery/khan-qualified-r2/` unless stated otherwise.

| Gate | Receipt |
|---|---|
| Two genuine differing examples | `home/captures/cmvpawglv8314fd.json`, `home/captures/cmvpax6g6320fe9.json`; `learn.json` |
| Immediate body audits | `geometry-audit.json`, `cmvpawglv8314fd.audit.json`, `cmvpax6g6320fe9.audit.json`; each `*.capture.stdout` |
| Held-out tier-1 replay before comparison capture | `fresh-getCourse.json`, `fresh-listUnits.json`; each from its own initially empty home, one request, no Cookie header |
| Independent unseen comparison | `unseen-comparison.json`, `home/biology-rendered.json`, `home/captures/cmvpb1tb2089048.json` |
| Current `verifySite` with `maxTier: 1` | `verify-retry.json`: six passes, zero healed cases; authoritative local record `verify-home/checks/khan-academy.json` |
| Public-example export | `export.json`, `export-audit.json`: `keepExamples: true`, zero secrets, zero warnings |
| Exact-export fresh reuse per operation | `export-fresh-getCourse.json`, `export-fresh-listUnits.json`: separate initially empty absolute homes, exact exported spec, one Biology request each, tier 1, no Cookie header, no healing/truncation, exact equality with prior compared outputs |
| Direct shared vet | `vet.json`: zero errors, zero warnings over the exported spec and complete final notes |
| Final save equality | `final.json`: registry bytes equal `export.json`; notes equal `notes.md` |

The first verification had one 15-second Geometry metadata timeout and five passing cases. The same Geometry request succeeded later for `listUnits`. The single bounded retry passed all six cases: Geometry example, Algebra 2 check and Biology check for each operation. It retained the same 15-second timeout and maxTier 1; no route, host, transport or access-control workaround was introduced. The retry wrapper prevents further network requests after another failure or a control. No retry was needed afterward.

Current verification hashes describe the isolated learned local operations, whose learned response shapes are intentionally stripped by export. Exact-export reuse proves the final shared recipes independently. No integrated registry test, source typecheck, lint or full suite was run by this worker; those belong to the parent. Healing, query-hash rotation and long-term endpoint availability are unverified.

## Resource receipts and cleanup

Full browser commands used default CPU admission 65%, CPU stop 85%, memory admission 88% and memory stop 90%. Bounded browser-free learning, parsing, tier-1 verification and export/fresh/vet commands used memory admission 89% and stop 90%, retaining the default CPU thresholds. Every expensive command used the watchdog. No full-browser command used the SSR exception.

The initial browser command was denied at 13:36:03 UTC, CPU 11.15% and policy memory 88.44%. It launched no browser or site request. After a 30-second wait and further local inspection, one resample admitted capture at 13:36:56 UTC, CPU 19.63% and policy memory 86.99%. No site request occurred during the wait. No additional admission retries or watchdog terminations were needed.

`resources-cleanup.json` aggregates saved receipts and identifies the first offline-audit sample transcribed from tool output. Sampled peaks for this batch were CPU 46.48%, policy memory 88.83%, raw occupied memory 99.71%. The policy metric excludes file-backed cache. Raw occupied memory was above 95%, so this report does not claim the host remained below 95% by that measure or continuously by any measure. Sampled policy CPU and memory stayed below the watchdog limits; unrelated host activity is outside its control. The round-1 89.60% memory peak is historical and not this batch's peak.

Each frontend command acquired `bench/explore/state/discovery/browser.lock` by atomic mkdir and wrote a unique owned token. It released only its own token and lock after its child exited. The helper closed its browser in `finally`. At 13:45:27 UTC, no owned browser processes remained and the global browser mutex was absent. No unrelated process or lock was stopped or removed. All raw evidence and isolated homes remain ignored for audit. The parent may integrate these two operations and run shared checks.
