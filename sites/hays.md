Use the exact segment after `/job-detail/` in a Hays UK posting URL as `job`, without the query string. Preserve literal parentheses where present. Only the tested UK document route is covered; this operation does not discover jobs or establish search filters or pagination.

The result is selected structured metadata supplied by the posting page. `jobReference` is the JOB-prefixed reference; `reference` is the separate public posting reference used in the URL. They are distinct identifiers. `location` is an advertised broad locality, not a workplace street address. Fields may be absent or differ across postings.

`employmentType` preserves the site's structured working-pattern label. FULL_TIME does not establish permanent tenure. Industry and occupational category are the site's labels. No salary, pay period, dates, application eligibility or current open availability is established. A successful response does not prove the vacancy remains open. Access was tested signed out; no account is required for the checked examples.

## Maintainer notes

Qualification date: 2026-10-26 UTC. Sources and exact arguments, capture IDs, independent held-out comparison and receipt hashes are recorded in `docs/research/discovery/hays-qualified-r2.md`. The two retained genuine frontend document captures were made with the unchanged exact-document helper. It allowed only the exact GET, aborted other requests and used a 15-second navigation bound. This is SSR document evidence, not proof of a fully hydrated GUI.

The operation reads JobPosting JSON-LD and selects only the safe metadata fields. Contact, recruiter, people, application/profile, CV, description, salary and street-address fields are excluded. The first training page's structured salary period conflicted with unestablished advertised pay-period semantics, so salary is excluded entirely.

Official sources advertise an applicant app, employer ATS/VMS integration and internal consultant tooling. The source screen did not establish a public anonymous jobs API, MCP or feed contract; it does not prove their absence. No login, everyday browser cookie import or website write was used. Parent receipt audit and focused registry check are required before integration.
