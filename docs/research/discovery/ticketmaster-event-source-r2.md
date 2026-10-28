# Ticketmaster focused event-source refinement, round 2

Observation window: 2026-10-27 22:36:51–22:37:21 UTC. Remote hosted source inspection only; work ended before the 22:44:19.843710 UTC deadline.

Result: no suitable replacement B obtained. One future-date theatre lead was fetched, but its public text contained no useful admission or arrival policy beyond an age phrase already exposed in the listing title. Do not promote it as a rich-policy example or create an operation from it. ZERO qualified APIs.

## Literal discovery chain and evidence

All source reads used the hosted `mcp__codex_apps__search_service_web_run` tool with the `ticketmaster.com` domain filter for searches. No URL, event ID, slug, or endpoint was guessed.

1. Restricted query `site:ticketmaster.com/event/ "2026" ("November" OR "December") ("Nutcracker" OR "theatre") ("age" OR "late" OR "bags")` returned the raw tool notice `Empty search results`. This was an empty search, not an established origin access error.
2. One simplified restricted query, `site:ticketmaster.com/event/ "December" "2026" "ages"`, returned indexed Ticketmaster search pages rather than literal event URLs. This was a second search after the empty result; no broad inventory was saved. The relevant indexed result was [Ticketmaster search page 19](https://www.ticketmaster.com/search?page=19&q=ages+ages&tt_scene=anchor_view). Its snippet mentioned Blippi and The Wiz; those were indexed observations only, and neither event was opened.
3. A hosted open of that exact indexed listing returned public event text and navigation links (189 lines). The fetched listing differed from the snippet: its link 17 identified A Christmas Carol, age 5 and up, at Peery's Egyptian Theatre in Ogden, Utah, Friday November 20, 2026 at 7:30 PM (lines 56–62). This was fetched listing evidence, not an assumption that indexed results were current. The listing included a browser-support recommendation, but delivered metadata and links; the recommendation alone did not establish a public access restriction.
4. Following that actual Ticketmaster listing link 17 produced the literal event URL [A Christmas Carol (Ages 5 and Up)](https://www.ticketmaster.com/event/Z7r9jZ1AAvA19). This was the sole event-page open. It returned 89 lines, including duplicated sections.

## Inspected B lead: future date, insufficient policy evidence

Exact displayed event identity: **A Christmas Carol (Ages 5 and Up)**.

Exact URL: https://www.ticketmaster.com/event/Z7r9jZ1AAvA19

The fetched event page displayed Friday November 20, 2026, 7:30 PM, Peery's Egyptian Theatre, Ogden, UT (lines 4–13, repeated at 45–54). The date is after October 27, 2026. No timezone was displayed: timezone remains unknown. A future header date does not verify current schedule, status, freshness, or ticket availability.

The age phrase was fetched in the event title, but the listing had already exposed it. No fetched text established whether it was a recommendation or enforced admission rule, how it was applied, or whether exceptions existed. The visible Important Info concerned Ticketmaster's role as a resale marketplace rather than arrival or admission rules. No price or availability investigation was performed.

No substantive age-policy paragraph, bag policy, duration, door/show distinction, late-arrival instruction, accessibility instruction, or other useful arrival context was visible. Repeated More Info labels were not expanded. Nothing from snippets was upgraded to fetched event-policy evidence.

This improves the old B only as a **future-date theatre lead**: the supplied brief identifies old Disney On Ice B as October 22, 2026, already past. It does **not** improve the required fetched rich-policy coverage. It therefore fails the replacement-B selection criterion. The existing `searchEvents(q)` workflow already returns event identity/time/venue/location/status fields; no title/date/venue/status wrapper or other operation was added.

## Stop and evidence limits

Stop URL: https://www.ticketmaster.com/event/Z7r9jZ1AAvA19

Stop observation window: within 2026-10-27 22:36:51–22:37:21 UTC; the completed event fetch was timestamp-bounded by the clock reading at 22:37:21 UTC.

The event result exposed a source-only public-data shell for this purpose: repeated metadata, unexpanded More Info labels, and the short raw text `Loading...` (line 40). It also carried a generic notice saying cookies and JavaScript are needed for certain functions, including purchasing (line 80). That buying-related notice alone is not proof of public metadata authentication, rate limiting, challenge, or denial. No such restriction, origin HTTP status, or origin headers were established by this result.

The useful policy content was absent from the returned shell. Under the task's source-only-shell stop rule, **all further Ticketmaster reads stopped after this result**. No retry, second event open, alternate route, alias, host, transport, endpoint, browser, or partner destination was used. This is a source inspection limit, not proof that the full browser page lacks policies or that JavaScript would expose a qualifying policy. No runtime behavior was tested.

## Untouched sources and cleanup

- Prior A, Another Day Dawns at Arrow/Allentown, was not reopened. Its prior fetched all-ages and doors/show observations remain supplied context, not fresh verification here.
- Old Disney On Ice B was not reopened.
- Reserved old C, https://www.ticketmaster.com/event/05006513C004B9ED?tt_scene=anchor_view, was not opened, clicked, requested, or reassigned as B.
- No new D with an exact literal event URL was grounded. The fetched listing naturally exposed other unclicked event-link labels, including another Christmas Carol performance; their hrefs were not returned as literal URLs in the tool text. Resolving them would require another read after the stop. They remain unopened, and no D policy is claimed unseen or verified. The initial indexed snippet had already exposed Blippi/The Wiz context, so those are not clean unseen policy examples either.
- No local commands, repository inspection, hashing, homes, capture, learning, execution, export, vetting, tests, browser session, cookies, accounts, or local helper were used. No temporary local resources were created; no cleanup action was needed. Only this report was written. Working operations and frozen publication files/approved manifest were not touched by this worker. No commit, push, PR, or publication occurred.

## Outstanding qualification work

This is source-only evidence. Actual frontend captures of A and a suitable B, learning, the zero-issue exact-export-and-notes preflight, and every API qualification step remain outstanding. Each new operation still needs a cold run from an initially empty home, an exact final export with Cookie and Authorization absent, independent unseen tier-1 verification of every claimed field's meaning, exact-hash ALL-read verification, a public-example export, final zero-issue vetting and credential scanning, and the parent's registry/lint/type gates. Later guest-cookie use must be disclosed. No schema, template, export, API qualification, or publication claim is made here.
