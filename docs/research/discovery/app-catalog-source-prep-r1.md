# Public app catalog source preparation r1

Outcome: **ISSUES** for research preparation. Google Play has two readable, grounded app pages and a concrete metadata capture plan. Microsoft Store has two grounded app links but only JavaScript shells remotely, so extraction remains unknown. Zero captures, reusable operations or registry specs.

Research date: 2026-10-26 UTC, approximately 11:34–11:37. Batch `app-catalog-source-prep-r1` covers Google Play and Microsoft Store only. The supplied lightweight launch gate at 11:33:32 UTC recorded CPU 23.51% and policy memory 89.63%. No expensive local work was admitted or run. The parent owns resource admission and integration.

Read `AGENTS.md`, `bench/discovery/README.md`, the discovery index, relevant design/contribution/workflow guidance, `broad-search.md`, `web-search-r1.md`, a prior source-preparation report, and current `bench/discovery/state.json`. State assigns these catalogs to this batch. Google Search and Trends remain stopped; neither was revisited. Google Play was researched solely as an app catalog, without general-search queries on Google hosts.

Only the remote `tools.mcp__codex_apps__search_service_web_run` accessed websites. Local actions were file reads and this report write. No local network command, browser, capture, replay, private session import, login, install, purchase, account action, review action, nested agent, source/dependency/shared-state change, commit or publication occurred. No raw evidence files were saved.

## Evidence labels

“Remote primary document” means an exact official URL was opened and the tool returned source-attributed page text. Crawl dates can indicate cached material. This does not establish a fresh origin HTTP status, raw HTML, local signed-out behavior, frontend requests, selectors or a reusable recipe. “Search-indexed lead” means official-source search output, without a separate page open. Proposed operations and field interpretations below are inference until frontend qualification. No endpoint, package ID, product ID, parameter or bundle URL was invented. No third-party reverse-engineering package was used.

## Official access screen

Google's [Play Developer API getting started](https://developers.google.com/android-publisher/getting_started) was a remote primary document, crawled today. It requires a Cloud project, enabled API, and an OAuth client or service account with Play Console permissions. Google's [API overview](https://developers.google.com/android-publisher/?rd=1), a search-indexed primary lead crawled ten months ago, describes publishing and developer quality reporting. These are publisher-account tools, not evidence of anonymous consumer catalog lookup. No account setup or API call was attempted.

Microsoft's [Get app data](https://learn.microsoft.com/en-us/windows/uwp/monetize/get-app-data), a search-indexed primary lead crawled two months ago, describes apps already in the caller's Partner Center account. The [Store Developer CLI overview](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/overview), indexed two weeks ago, likewise describes account app listing and Entra credentials. [StoreContext product information](https://learn.microsoft.com/en-us/windows/uwp/monetize/get-product-info-for-apps-and-add-ons), indexed two weeks ago, concerns the current app and associated add-ons. These do not establish an easy anonymous consumer catalog API.

The same search batch returned [Azure Marketplace catalog search](https://learn.microsoft.com/en-us/rest/api/marketplacecatalog/dataplane/search/get?view=rest-marketplacecatalog-dataplane-2023-01-01-preview) and [Azure Marketplace MCP tools](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-marketplace). These concern Azure solutions, not proof of Windows consumer Store coverage. No API or MCP was connected or tested.

The Get app data search response included “Access to this page requires authorization.” **Stopped `learn.microsoft.com` immediately after that response.** No further Learn request, login or transport retry followed. No alternate host was used to retrieve that Microsoft documentation. Other Learn results above came from the already completed search batch. The notice is a documentation-host control, not evidence that `apps.microsoft.com` requires authentication.

The bounded screen did not establish a readily usable official anonymous catalog API/MCP for either platform. It is incomplete, especially for Microsoft's other official consumer tooling. Do not claim API absence or prioritize reverse engineering over an equivalent official read tool if one is subsequently documented. Browser metadata remains potentially useful for the precise consumer listing, region and platform presentation that these publisher tools do not establish.

## Google Play: strongest continuation

Both exact links came from official-domain search results and were opened once each. Both returned readable remote primary documents, crawled today:

| Source page | Grounded identity and metadata | Qualification issue |
| --- | --- | --- |
| [VLC for Android](https://play.google.com/store/apps/details?id=org.videolan.vlc) | Package `org.videolan.vlc`; displayed developer Videolabs; category Video Players & Editors. Header score/count 4.0 and 2.01M reviews. Footer identifies United States, English. | Ratings panel separately shows 4.1 and 1.86M reviews beside device tabs. Scope is unresolved. |
| [Microsoft To Do](https://play.google.com/store/apps/details?hl=en&id=com.microsoft.todos) | Package `com.microsoft.todos`; displayed developer Microsoft Corporation; category Productivity. Header score/count 4.6 and 484K reviews. | Ratings panel shows 4.6 and 465K reviews. The page shows PEGI and a VAT footer despite English language; region is unproved. |

Useful public question: “Who publishes this Android app, what category is it listed in, and what aggregate rating does this particular listing display?” Proposed `getApp(packageId)` is a plan, not an established operation. Keep locale fixed initially; vary only the two captured package identities. Developer display name, developer-page identity and package identity are distinct. Shared branding with Windows does not establish identical software, requirements or ratings.

The descriptions explicitly call both apps free, and the pages display Install. Neither observation establishes a numeric price/currency pair or device eligibility. Minimum OS and supported architectures were not grounded. Omit those fields until explicitly present in the captured source. Preserve rounded counts as display values; never relabel “reviews” as a proven exact rating count. Do not combine header and device-panel aggregates.

Capture plan after admission: use these exact pages for two real examples. Observe which document or read request supplies app identity, developer, category and header aggregate; inspect only that source. Compare visible header and panel scopes before choosing fields. Reserve a third app reached through an actual frontend app link for unseen semantic replay. No search endpoint, developer-catalog operation, pagination or arbitrary locale parameters are prepared here.

## Microsoft Store: conditional continuation

These exact official search-result URLs were opened once each:

- [VLC, US English](https://apps.microsoft.com/detail/xpdm1zw6815mqm?gl=US&hl=en-US), product route `xpdm1zw6815mqm`. Remote primary document crawled today returned only a JavaScript-required message.
- [Microsoft To Do, GB English](https://apps.microsoft.com/detail/9nblggh5r558?gl=GB&hl=en), product route `9nblggh5r558`. Remote primary document crawled last month returned only the same shell.

Search-index titles associate these routes with VLC and Microsoft To Do, respectively. They do not prove current developer, category, score/count, price/currency or Windows requirements. No populated response, linked bundle, selector or internal request was established. A separately indexed [VLC UWP listing](https://apps.microsoft.com/detail/9nblggh4vvnh?gl=US&hl=en-US), crawled six months ago, had another product identity; it was not opened or treated as interchangeable with desktop VLC.

Useful public question: “Which publisher and Windows requirements belong to this exact Store product, and what aggregate score and explicitly listed offer does its regional page show?” Proposed `getApp(productId)` remains conditional. This is the second capture plan, with lower confidence than Google Play.

After admission and the unresolved official consumer-tool screen, open these exact pages in a new signed-out frontend context and record final region/language. If populated, capture the actual read source for identity and metadata with these two examples. Their existing US/GB contexts differ; do not learn region as an argument from this pair. Normalize locale only through observed frontend navigation and separately prove its effect. Obtain any held-out third identity from a real frontend link. A shell, free-download title or Install/Get button cannot prove zero price, currency, compatibility or purchase entitlement.

## Controls and proof still missing

No catalog response exposed an authentication gate, challenge, HTTP 403 or HTTP 429. Microsoft Store's JavaScript requirement is an extraction limitation, not evidence of a bot challenge. The Learn authorization notice is the only newly observed control, and that host remains stopped for this run. No route or transport was used to get around it.

Both platforms still need real frontend capture, two differing captured examples, credential-free learning, independent unseen semantic replay, `verify`, fresh cookie-free reuse, export and `vetShared`. Region/language, aggregate scope, explicit offer currency, cross-platform identity and system requirements require fresh proof. Exclude reviewer identities/text and descriptive article copying. Stop a catalog immediately on any subsequently observed control. Parent owns state/catalog updates, local validation and all admission decisions. No `sites/` file was created.
