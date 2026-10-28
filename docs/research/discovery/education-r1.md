# Education discovery round 1

Status: ISSUES overall. Coursera PASS, Udemy BLOCKED. Two reusable Coursera operations saved. No Udemy spec saved.

Work ran on 2026-10-26 UTC, with first public request at 09:53:26 and final fresh-home replay at 09:59:14. Repository HEAD was `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Only the assigned Coursera JSON/notes, this report and ignored worker evidence were written. Existing specs, core, dependencies, shared discovery state and runbook were not edited. No commits, push, PR or publication.

## Saved files and operations

- `sites/coursera.json`: `search(q)` and `getCourse(slug)`, both read-only and minTier 1.
- `sites/coursera.md`: caller limits and maintainer provenance.
- `docs/research/discovery/education-r1.md`: this report.

Export SHA-256: `3cf6141453ce2ae19af5fb15c6c51f67239dfd701d8d7e3c70f5e6bb35277869`.
Notes SHA-256: `d30f95055fc4d0471bddd1a9d761fd0ae6ead4121a8c508478c554a66ae12378`.

## Coursera proof

All discovery was signed out. Separate isolated homes were used for each domain, and no personal browser cookies or login were imported. Only public catalog metadata was in scope. No lesson, assessment, enrollment, account or purchase operation was learned or called.

The public homepage `https://www.coursera.org/` returned HTTP 200. Its actual links supplied these catalog routes:

- `https://www.coursera.org/courses?query=python`
- `https://www.coursera.org/courses?query=cybersecurity`
- `https://www.coursera.org/courses?query=digital%20marketing`

The Python catalog supplied `/learn/python`, `/learn/python-basics` and `/learn/python-crash-course`. No endpoint, course ID or route was guessed.

Four genuine Chrome captures were made using the experimental document-only helper, each under the resource watchdog and atomic browser mutex:

- `cmvp2y0r17529af`: Python catalog, HTTP 200, document ID 1, 57 exchanges, 56 aborted.
- `cmvp2y86j1ef914`: cybersecurity catalog, HTTP 200, document ID 1, 56 exchanges, 55 aborted.
- `cmvp2yswv5e1527`: python course, HTTP 200, document ID 1, 64 exchanges, 63 aborted.
- `cmvp2z2f0b68de5`: python-basics course, HTTP 200, document ID 1, 74 exchanges, 73 aborted.

The helper permits only the exact requested GET document and aborts subresources. Inline scripts can still execute, and redirects are unsupported. HTTP scout responses were never converted into browser exchanges. These pages were understood SSR pages, not challenge workarounds.

`search(q)` learned from Python and cybersecurity examples. Its recipe reads `#searchResults .cds-ProductCard-base`, with title, absolute course URL, provider and card summary. An unseen `q=digital marketing` call succeeded at tier 1 and matched all 12 separately fetched frontend cards in order, exactly across all four fields. Search includes the product types the catalog shows, including specializations and certificates.

`getCourse(slug)` learned from python and python-basics. Its recipe reads public schema.org Course JSON-LD and picks 10 metadata fields. An unseen `slug=python-crash-course` call succeeded at tier 1. Its URL, title, description, provider, level, language, skills, learning outcomes, rating and rating count all matched the independently fetched public Course JSON-LD exactly. Reviewer text and paid course materials are excluded.

Final `verifySite('coursera', {maxTier: 1, timeoutMs: 15000})` ran at approximately 09:58:38-09:58:46 UTC with public example/check inputs:

- Search: python, cybersecurity, digital marketing.
- Course: python, python-basics, python-crash-course.

All six cases passed at tier 1, with no failed, skipped or inconclusive cases and no healing. The final export used the repository CLI with `--keep-examples`; export warnings were zero. Direct `vetShared` on the final exported spec and exact notes returned `errors: []` and `warnings: []` at 09:59:13 UTC. An earlier optional slug pattern was rejected for nested quantifiers; it was simplified, then verification, export, vet and reuse were rerun for the final version.

Two separate initially empty fresh homes loaded the final public export. Each made one request with maxTier 1. The fetch hook asserted no outbound Cookie header. Search used digital marketing; course details used python-crash-course. Both returned `ok: true`, tier 1, and data exactly equal to the original unseen-input replay. Fresh-home receipts are dated 09:59:14 UTC.

## Udemy stop

The first request, `https://www.udemy.com/`, returned HTTP 403 at 09:53:38 UTC. Its title was `Just a moment...`, and the document referenced Cloudflare challenge infrastructure. The domain was stopped immediately. No alternate route, browser attempt, cookie import, login or API probe followed. No operation or spec was saved.

## Exact local receipts

Everything below is under ignored `bench/explore/state/discovery/education-r1/`:

- Capture logs: `capture-python.log`, `capture-cybersecurity.log`, `capture-detail-python.log`, `capture-detail-basics.log`.
- Original capture files: `coursera-home/captures/<captureId>.json`.
- Learning: `add-search-final.log`, `add-detail-final.log`, each with no final warnings.
- Unseen calls: `call-search-unseen.log`, `call-detail-unseen.log`.
- Independent source comparison: `comparison.json`, `compare.log`.
- Final six-case verification: `verification.json`, `verify-final.log`, and `coursera-home/checks/coursera.json`.
- Public export: `coursera-export.json`, `export-final.log`.
- Direct vet: `vet.json`, `vet-final.log`.
- Final fresh reuse: `fresh-search.json`, `fresh-getCourse.json`, `fresh-search-final.log`, `fresh-detail-final.log`.
- Udemy: `udemy-root.meta.json`, `udemy-root.log`, private response HTML.
- Resources and cleanup: `resources.json`, `cleanup.json`.

Raw responses, session values and capture payloads remain ignored and are not in tracked candidate files.

## Resources, cleanup and remaining limits

Every browser command used the default admission CPU 65% / memory 88% and stop CPU 85% / memory 90%. Bounded HTTP, learning from saved captures and tier-1 checks used the authorized memory admission 89% / stop 90%, with the same CPU limits. Across 54 watchdog samples, peak CPU was 71.54% and peak policy memory was 88.37%. Raw occupied memory peaked at 99.70%, including file cache; this is distinct from the explicitly defined policy memory metric. There were no admission denials or owned-command watchdog terminations.

Every owned browser command exited before releasing its own mutex. Cleanup found no Chrome processes using the owned Coursera home, no mutex held by this worker and no remaining global mutex at the cleanup snapshot. No unrelated process was stopped. Isolated homes and ignored evidence were retained for the coordinator.

Only the checked public inputs are established. Search pagination, filters, full catalog coverage and other locales are unverified. Ratings and ranking may change. Detail metadata can be truncated by Coursera's source and assumes the first JSON-LD script is Course; that held across the three checked courses. Paid access is neither tested nor implied. Udemy remains blocked and must not be retried by switching routes.

The coordinator still owns integrated typecheck, lint and registry tests; this worker did not duplicate them. Publication requires explicit user approval.
