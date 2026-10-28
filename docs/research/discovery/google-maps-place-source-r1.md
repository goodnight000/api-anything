# Google Maps place details: remote source preparation r1

UTC window: 2026-10-27 19:47:02–19:47:23 UTC (hosted source reads). Report written immediately afterward, within the eight-minute bound.

Status: source-only; zero operations added, zero registry additions. Stop at the hosted representation boundary described below. No API, capture, working-operation, or tier-1 compatibility claim.

## Supplied control snapshot

The parent states that Google Maps is already saved with `searchPlaces(query)` and three saved tier-1 cases. Parent-supplied spec SHA256: `c0ee9707a1cd02b5aabea5b294cc3b585f4057287edc98e25f2d97e61eeac81d`. These files, cases, precise fields, and hash were not inspected or verified here. Parent reports no current depth map, matching Maps stop, or live owner, and provider cooldown expiry at 2026-10-26T13:03:41.783722+00:00. Parent owns state persistence, baselines, qualification, and counting.

## Grounded examples and evidence levels

The hosted `mcp__codex_apps__search_service_web_run` search returned the following actual Google Maps links. Search queries requested Google Maps place sources for these three landmarks. The returned paths were `/maps/search/`, not invented `/place/` links. A single-place-looking indexed representation at a search URL does not establish a separate operation from the saved search.

- A — British Museum: <https://www.google.com/maps/search/Visit%20British%20Museum%2C%20London%2C%20United%20Kingdom>. Indexed evidence only for details: the tool labeled the crawl “last week” and showed a museum category, full Great Russell Street postal address, a Thursday hours entry, `britishmuseum.org`, and a public business phone. These are historical indexed fields, not current validated values. This was the only example opened.
- B — Sydney Opera House: <https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House+Bennelong+Point+Sydney>. Indexed evidence only; tool labeled the crawl “2 days ago.” It showed performing-arts category, Bennelong Point postal address, `sydneyoperahouse.com`, and a public business phone. Not opened because A reached the boundary. No hours or facility contract established.
- C — reserved unopened indexed lead, Eiffel Tower: <https://www.google.com/maps/search/Eiffel%2BTower%2B>. Tool labeled the crawl “4 months ago.” The index showed category, precise postal address, a Monday hours entry, `toureiffel.paris`, and a containing-place relationship. It also displayed a limited-view notice. Not opened; not a held-out replay or independent meaning check.

Only these concise field summaries are retained. No individual reviews, contributor profiles, private location information, raw response dumps, or account information are recorded. No other search results were opened.

## A: fetched representation and stop

Opening A returned a tool result labeled `text/html`, “Crawled: today,” with five total lines. The tool reported redirection to this exact URL:

<https://www.google.com/maps/search/Visit%20British%20Museum,%20London,%20United%20Kingdom>

The representation contained an image link, generic JavaScript fallback prose, and an “Enable JavaScript to see Google Maps.” support link. It exposed no place-detail fields, usable place-navigation links, form contract, or frontend request contract. The support link and image were not followed. The result had `isError: false`; no HTTP response status or headers were exposed.

All further Google Maps reads stopped after this open, across aliases, routes, and transports. No retry or alternate route was attempted. This is a hosted representation accessibility boundary: it does not prove a Google HTTP denial, authentication requirement, bot challenge, rate limit, or underlying cause. None of those explicit signals was exposed. Missing fields alone are not evidence of login. C's indexed limited-view notice is likewise not evidence of authentication. Parent should retain the exact A URL and this UTC window when recording the boundary; no further Maps testing is authorized by this report.

## Candidate workflow and distinctness limit

The sole candidate remains public place/business/landmark details: open an actual public Maps place context and inspect hours, official website/contact, precise address, category, and public facility information where available. The indexed A/B representations suggest address, category, official-site label, and business phone; A/C additionally suggest hours, and C a containing-place relationship. Facility attributes and full weekly hours were not established.

This is a source hypothesis, not a proposed field-only wrapper to save. The opened representation did not expose those details. All grounded links use search routes, and the saved operation's exact extraction fields are unknown here. Distinctness from `searchPlaces` must later be checked against the actual saved JSON, notes, and recipes. If those already yield the represented detail fields, this lead reaches a duplication boundary and should not be counted as another operation. No further source breadth is needed for this task.

## Unknown contracts and evidence limits

No form was submitted or inspected interactively. Request method, exact frontend request URL, parameter binding, payload, identifiers, pagination, extraction recipe, response bytes, status, headers, cookies, redirect chain, and error behavior remain unknown. The displayed URLs are grounded navigation links only; their visible query syntax is not a learned or validated request template. No IDs, endpoint templates, or parameter contracts were invented.

Hosted indexed snippets and fetched representations do not prove freshness, signed-out conditions, absence of Cookie/Authorization, real browser rendering, capture provenance, or tier-1 replay. Tool crawl labels are tool metadata, not independently verified timestamps. No private cookies, profiles, account access, API keys, paid APIs, website writes, bypass, or third-party place-data substitute were used.

## Missing gates and cleanup

All runtime and registry gates remain missing: actual frontend capture; learning from differing examples; offline candidate export-plus-notes `vetShared` preflight; cold-first-call header proof from an initially empty home containing the exact final export; independent unseen identity-and-meaning checks; all-read verification against the exact final export; exact export/hash verification; final exact JSON-and-notes vet; parent integrated registry test, lint, and type checks. No add, call, verify, export, vet, test, or local hash manifest was run. Local design/source inspection was prohibited by this worker's bootstrap restriction and was not performed.

Only this report was written through `apply_patch`. No local commands, shell, local network, browser, local repository reads, captures, homes, profiles, temporary raw artifacts, or local processes were created or accessed. No optional bench directory was used. No cleanup was required. Registry files, state, runbook, dependencies, helpers, other reports, commits, pushes, PRs, and publication were untouched. Parent alone persists the stop and any later qualification decision.
