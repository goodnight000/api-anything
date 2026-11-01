No account is needed. Covers any company whose careers page is a Lever board at
`jobs.lever.co/<company>`; `company` is that slug.

- `listJobs` returns every open posting in one answer, with no paging and no filter: a board with
  a few hundred postings takes several seconds (Lever sends the full descriptions, which the op
  drops). Filter by `team`, `location` or `commitment` yourself.
- `createdAt` is milliseconds since the epoch. `workplaceType` is `onsite`, `hybrid`, `remote` or
  `unspecified`.
- In `getJob`, `description` and `additional` are plain text; `sections` is a list of
  `{text, content}`, where `text` is a heading ("Responsibilities") and `content` is HTML `<li>`
  items. `salaryRange` (`min`, `max`, `currency`, `interval`) is present only when the company
  posts one.
- A company with no Lever board answers `input` (404), as does a closed or unknown posting.
- Boards on Lever's EU instance (`jobs.eu.lever.co/<company>`) are not covered.

## Maintainer notes

Verified 2026-10-31, logged out, from a US IP. `api-anything verify lever` passed all 3 cases at
tier 1.

| op | learned with | unseen call | tier |
|---|---|---|---|
| `listJobs` | `spotify` (89 postings), `palantir` | `zoox`: 227 postings, ~10 s | 1 |
| `getJob` | `spotify/2a55d6c9-...`, `palantir/6ed76ce8-...` | `zoox/e8a190f0-7a89-4c11-a6a0-452ff6234749`: with salary range | 1 (~0.4 s) |

The board page `jobs.lever.co/<company>` is server-rendered, but its markup puts the team in a
group heading above each posting, out of reach of a per-item HTML recipe. Both ops use Lever's
documented public postings API instead (`api.lever.co/v0/postings/<company>?mode=json` and
`.../<company>/<postingId>`), loaded directly as the trigger; no cookie, key or rotating id.
`getJob`'s `extract` was removed by hand after `add` (it suggested `lists`): the op returns the
whole posting object. The API also takes `team`, `location`, `commitment`, `limit` and `skip`
query params, not learned since the CLI has no optional params.

The `getJob` example is a live posting and will close some day: then `verify` fails with `input`.
Replace it with a current posting from `listJobs company=spotify`.
