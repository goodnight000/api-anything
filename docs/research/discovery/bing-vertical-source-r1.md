# Bing News: remote source preparation, round 1

2026-10-27. **ZERO operations added, installed, learned or counted.** Source links alone are not working APIs. Existing `search` was neither inspected nor changed; its health is unknown here. The supplied state snapshot lists it as the sole saved operation.

## Scope and evidence

Hosted public reads only, using `mcp__codex_apps__search_service_web_run` with its discovered `open` and `system2_search_query` arguments. UTC window: **2026-10-27 19:24:10–19:24:41**, bracketed by the clock tool. Individual website calls have no separately exposed timestamps. No local execution, local network, repository/source analysis or browser was used. The coordinator-supplied runbook and state snapshots governed this task; they were not reread locally.

| Receipt | Source and supported observation | Evidence level |
| --- | --- | --- |
| R1 | [Bing home](https://www.bing.com/) exposed the input label “Search the web”, but no Images/News navigation in the tool's 13-line representation. | Hosted `open`, HTML text representation; no frontend exchange. |
| R2 | Domain-restricted provider search for `site:bing.com Bing News` returned [Bing News](https://www.bing.com/news). | Indexed-source discovery, not a Bing API response. |
| R3 | Opening that exact News URL exposed “Top stories”, “More news”, “No more news” and anonymous inputs, in 27 lines. | Hosted `open`; no article list or usable form attributes exposed on this entry page. |
| R4 | Domain-restricted provider search for `site:bing.com/news "Technology" "Science"` returned the A/B/C links below. | Indexed-source leads; publisher snippets are not independently verified news facts. |
| R5 | Opening exact discovered A and B links exposed different article lists with headline links, publisher labels, relative ages and summary text. | Hosted `open`, HTML text representations, 84 and 92 lines respectively. Neither is a raw origin response or captured request/response exchange. |

Both R5 results returned tool `isError: false` and content type `text/html`. HTTP status, headers, redirect chain, cookies, origin fetch time and remote-provider identity/session behavior were not exposed. A tool crawl label of “today” does not prove a fresh origin fetch.

## One proposed workflow: public News topic search

This is a candidate distinct vertical: find news articles about a public topic, with publisher and age context. It is not a second wrapper around the saved web-search fields. The source pages support a News-specific result presentation; actual operation distinctness still requires frontend capture and comparison with the saved operation by the coordinator.

- **A, opened:** [science technology news](https://www.bing.com/news?FORM=NSBABR&q=science+technology+news). The page title carries that topic. Its visible list concerns science/technology, with article destinations and summaries.
- **B, opened:** [Singapore](https://www.bing.com/news/search?FORM=NSBABR&nvaug=%5BNewsVertical+Category%3D%22rt_Singapore%22%5D&q=Singapore). The page title carries Singapore, and the visible list concerns that place, including energy-related reporting. This discovered URL also contains a category value, so A/B are **not** a clean controlled pair proving one mutable keyword parameter.
- **C, reserved unopened:** [熱門報導 News lead](https://www.bing.com/news/search?FORM=Z9LH3&nvaug=%5BNewsVertical+Category%3D%22rt_MaxClass%22%5D&q=%E7%86%B1%E9%96%80%E5%A0%B1%E5%B0%8E). This exact provider-indexed link was returned in R4. It is a future navigation/example lead only, not an unseen replay argument already qualified for the proposed operation. Its category/language context needs inspection after the stop is resolved.

**Observed fields:** article headline, article destination link, publisher label, relative age, short summary, and occasional image/MSN attribution. Fields are not present uniformly. These are rendered-page observations, not an extraction schema or an API contract. No publisher/article destination was opened.

**Input limits:** News pages exposed anonymous `[Input]` entries. No News input label, form action, field name, method, filter controls, pagination control or accepted argument range was exposed. Topic strings and URL components are observed source values; no parameter template, hidden endpoint, query identifier or input schema is inferred from them. Homepage-to-News navigation was not established: the News entry point came from an indexed Bing-owned link.

Unsupported here: date/sort/language/market filters, pagination, result counts, guaranteed timestamps, full article text, image retrieval, complete result coverage and a reusable News request. Images was not investigated. No provider `image_query` was used.

## Conservative Bing stop report

At R5, **both** opened News pages displayed: “Some results have been hidden because they may be inaccessible to you”, followed by “Show inaccessible results”. That action was not followed. Treating the notice conservatively as an access restriction, all further Bing requests stopped immediately after this batched response. No alternative Bing route, alias, cache search or transport was attempted afterward.

Parent stop-record handoff: site **Bing**, observed host **www.bing.com**, affected URLs **A and B above**, observed UTC window **19:24:10–19:24:41 on 2026-10-27**. Apply any persisted stop brand-wide to Bing routes/aliases/transports. No other alias was tested. This was a visible partial-result restriction, **not an observed HTTP 401/403/429, login demand or CAPTCHA**; the cause and status are unknown. No ordinary tool/origin error occurred, so no retry was attempted. Parent stop/state files remain untouched. BBCGoodFood, Eventbrite and Hays were not visited.

## Gates remaining before any API addition

1. Coordinator resolves/persists the stop and obtains fresh resource admission before any further Bing work. No follow-up is authorized by these source notes alone.
2. Read the authoritative design/contribution/skill material and existing Bing spec/notes under local admission; preserve `search` and compare semantics.
3. Follow real News UI navigation and capture actual public frontend traffic for two differing inputs. Establish the real form/request fields, scope, response classification and extraction recipe. Do not fabricate an exchange from these hosted representations. Respect every auth/rate/challenge/error stop.
4. Learn only from real captured exchanges; draft metadata and provenance, then run offline `vetShared` preflight on the candidate export and notes.
5. Replay a genuinely unseen third input at tier 1 and independently compare result identity and meaning. C above has not satisfied this gate.
6. For each addition, test its first call with the exact final export in an initially empty isolated home; prove that the first request sends neither Cookie nor Authorization, recording later guest-cookie reuse separately.
7. Reverify all reads in the modified export, export public examples, run final exact-file/notes vet and the focused integrated registry gate, and retain exact hashes/receipts before counting.

**No frontend/browser capture, actual API learning, API call, fresh-home proof, header proof, independent meaning check, verification, export or vet gate passed.** No evidence hash manifest was generated; generating one is left to the parent under admission. No raw output dump was saved.

Cleanup: no local browser, process, mutex, profile, `API_ANYTHING_HOME` or other live resource was created. No registry/state/publication files were changed; no commit, push, PR, publication or submission occurred.
