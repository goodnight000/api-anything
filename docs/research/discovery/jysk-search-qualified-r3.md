# JYSK UK product suggestions, qualification r3

2026-10-27 UTC. **Zero qualified additions; candidate not installed.** New actual document captures, paired CLI learning, zero-issue preflight, two credential-free cold first calls and unseen meaning checks passed. The mandatory all-read verification failed on the three preserved legacy operations. No registry/lint/type checks or counting were performed by this worker.

## Outcome and exact versions

The installed `sites/jysk.json` remains 8,799 bytes, SHA-256 `f80ec151da68bd03383e36bd2df1f97b45811c145214d1172bd413ab4e17368f`. Installed notes remain 7,250 bytes, SHA-256 `16afed876be3bf56e7c7cb705adf78aeda78c191063086ba2fefb180db5e03f2`. Complete existing objects, checks, examples and site metadata are unchanged. Their runtime hashes remain `204af1672b4575e5`, `6093c6498dcf22c2`, `e256e4a78e820988` in the assigned order.

Private candidate JSON is SHA-256 `a366d3f18978b2d4df29fdf7ead28173b8cfe012248e0d9dd091c62060992e73`. Its private draft notes are 8,066 bytes, SHA-256 `ff77088c6ce5a0f941f8fccf4078e98b9d7481c5c5c5b7df8482ddeb099d4828`. The new operation hash is `1bfd5e5caeac89da`. These exact bytes were fixed before C or live operation qualification and remained unchanged throughout. Draft wording is not an accepted qualification claim. No partial candidate is installed or counted.

## Actual new captures and learning

The unchanged `bench/discovery/capture-document.mjs`, with its existing 15-second bound, captured new actual GET browser documents from the already observed endpoint:

- A: https://jysk.co.uk/api/search/quick-search?query=3699007 at 15:33:35-15:33:46Z, HTTP200, sideboard SKU3699007.
- B: https://jysk.co.uk/api/search/quick-search?query=3699019 at 15:34:07-15:34:18Z, HTTP200, wardrobe SKU3699019.

Each capture had one answered exchange, zero aborted exchanges, the expected final URL, zero cookies, and no imported profile or session. Each used a separate initially absent isolated home. The helper admitted only the exact GET document. No hydration or search-box interaction was attempted in r3. Each capture command acquired `browser.lock` atomically before launching and released its own lock only after command exit. Both exited0 and closed the browser through the unchanged helper's finally block.

- A: `cmvquiaytf0ccba:1`, capture SHA-256 `3099bef2941efe6dcee6257513d3891ca2120966950b16dece023053b3d1a9c1`; response SHA-256 `6b845ca2e349e256c4337a232d13252d06928c0632dcfc588108ec6beb2527c3`.
- B: `cmvquizkv120989:1`, capture SHA-256 `0acf91f41097efe0babd1298016cdf0536665492ec36a9c70987c93eb6f21d48`; response SHA-256 `480e54f311797101327792d8605bd0dffbc17aa49b65b5d7baa754656684d0c6`.

Captured request header names were exactly `accept`, `upgrade-insecure-requests`, `user-agent`, `sec-ch-ua`, `sec-ch-ua-mobile`, and `sec-ch-ua-platform`. Neither captured document request had Cookie, Authorization, newrelic or traceparent. Learned headers equal capture A's headers verbatim. No tracing value was removed, relabelled public, waived or copied from the old candidate. The six-header navigation contract is a newly observed actual request, not a header-policy change.

The existing CLI learned `searchProductSuggestions(query)` from those genuine capture IDs with `--from`, `--from2`, `--pick-request 1`, examples `query=3699007` and `query=3699019`, and exact match `{"method":"GET","host":"jysk.co.uk","path":"/api/search/quick-search"}`. Recipe: extract `response.products.hits`; pick `sku=key,title=text,productPath=url,series=series`. Correct paired learning exited0, warnings[], minTier1, readOnly true, learnedLoggedIn false. The saved check is `query=3699019`, expect=result, with the purpose that wardrobe SKU/path replace the example sideboard. No C or D example/check was added.

The trigger is `https://jysk.co.uk/api/search/quick-search?query={query}`. It opens the observed JSON endpoint directly. It does not type into the search box. Prior audited r2 actual dropdown captures and the actual frontend GET bundle contract provide UI provenance. The original r2 evidence and candidate remain untouched.

An initial CLI invocation mistakenly supplied a comma-joined matcher, which the CLI read as one method string and warned that run2 did not match. It was corrected to the JSON matcher above and relearned from the same unmodified genuine captures before preflight. Both receipts are retained. No capture exchange was fabricated or edited.

## Preflight, cold calls and independent unseen meaning

At 15:35:37.522Z, exact-export-plus-draft-notes preflight passed with export secrets[], warnings[], exact-text scan secrets[], warnings[], vetShared errors[], warnings[]. It used `credentialsOf(besideOrigins(loadSession(site),[site.baseUrl,...site.operations.flatMap(opUrls)]))` and `scanSecrets([jsonText,notes],credentials)`. Preservation of all complete old objects and site metadata, notes<=8192, and captured headers verbatim were asserted. Exit0. C remained untouched until this passed.

Two separate operation homes were asserted absent, created, asserted empty, and loaded only with the exact candidate JSON/notes. No capture/browser cookie jar was copied. Each new operation's first request was observed and asserted credential-free at both the fetch boundary and Node Undici request-create transport boundary. Both used the stored template at tier1, maxTier1, no healing, escalation or truncation.

- Home1 first call at 15:37:56-15:37:58Z: `query=narrow hallway shoe storage`. Actual request https://jysk.co.uk/api/search/quick-search?query=narrow+hallway+shoe+storage . HTTP200, data[]. The raw product hits list was genuinely empty with no product error. It was not silently converted from a missing field. The retained frontend renderer's empty-list branch returns null, meaning no product suggestion cards. This alone proves no nonempty-field meaning.
- Home2 first call at 15:38:21-15:38:23Z: `query=MARKSKEL`. Actual request https://jysk.co.uk/api/search/quick-search?query=MARKSKEL . This distinct public series query was first reserved/used after preflight and was never training data. HTTP200, five suggestions, five distinct product identities. No cookies were issued in either cold home.

The independent unseen comparison executed the **unmodified actual product-card function** extracted from the retained r2 frontend bundle in a bounded offline VM, with inert JSX, localization and signed-out B2C stubs. Its source uses the hit key for click product identity, text for click title/image alt, URL for link/click target, series for the visible uppercase label, and highlighted text for the rendered product label. The comparison walks that resulting source-rendered card tree and click payload, strips highlighting markup for visible text, and checks all four operation output fields for every unseen D card. All20 scalar comparisons passed. D includes Single and Double bed frames, a coffee table, a TV bench and a sideboard; it is not a replay of either one-row SKU training answer. C produced no cards. No unseen GUI hydration is claimed.

Frontend source URL: https://assets.jysk.io/_next/static/chunks/2h6y6j-u8-2ym.js?dpl=9239b993fd53f9801dd3bdfdab06a1f14b2874d4 . Retained complete script SHA-256 `3759a802a0cc88417b34f2896e106bda0351ff949422499184307f422807aede`; executed unmodified function SHA-256 `f5936817f56041c5e73b78965d499ef600aa9563d6b28c2ee0851c168746b24a`. `assets.jysk.io` was treated as a JYSK alias; no new host was requested in r3.

A/B new document fields were also checked against the same renderer and the prior actual r2 rendered dropdown links/labels, plus supplied SKUs. These eight comparisons independently preserve the audited A/B meaning. Public A/B product links are https://jysk.co.uk/dining-room/sideboards/sideboard-markskel-3-door-white-wild-natural-oak-colour and https://jysk.co.uk/storage/wardrobes/wardrobe-markskel-162x210-white-wild-natural-oak-colour . The endpoint is partial product suggestions. Full results, ranking, relevance, recall, price, stock, filters and pagination remain unqualified.

A disposable proof initially imported absent `cheerio` and failed before its body, before creating a home or making a request. It was corrected to the already installed node-html-parser. No dependency or shared source changed. Failed and corrected exits are retained.

## Mandatory all-read gate failed

A single stock `verifySite` invocation at 15:39:07-15:39:15Z used home1, the exact candidate export, maxTier1, 15-second per-request timeout and the default one-second interval. It sent eight GETs. Every network response was200 and every request had no Cookie or Authorization at fetch and transport. No guest cookies were issued. No template healed or changed.

| getProductSpecifications | example | inconclusive | auth |
| getProductSpecifications | check 1 | inconclusive | auth |
| listSectionCategories | example | inconclusive | auth |
| listSectionCategories | check 1 | inconclusive | auth |
| getBuyingGuide | example | inconclusive | auth |
| getBuyingGuide | check 1 | inconclusive | auth |
| searchProductSuggestions | example | pass | result |
| searchProductSuggestions | check 1 | pass | result |

Exact existing cases were the saved sideboard product example and wardrobe product check; section=dining-room and section=storage; guide slug=guide-how-choose-right-sideboard and slug=ultimate-guide-choosing-perfect-wardrobe-and-storage-options. New cases were query=3699007 and query=3699019. Thus all eight saved cases were attempted, but only the two suggestion cases passed. The existing operations cannot be described as freshly working.

Offline inspection of the six retained200 HTML bodies found public product/category/guide h1 titles and Next.js output, but none of `.product-sumbox-sub-series`, `.category-content-container` or `.blog-post-page`. `signInForm(body)` was false. The core HTML classifier nevertheless reports auth when its recipe misses and `loginPage(body)` matches. A real origin login requirement is **unproved**. The changed layout and missing legacy selectors are verified from the actual response bytes. No source fix, selector repair, alternate route, recapture or transport retry was attempted because complete old operation preservation is required and the run is conservatively stopped.

Important monitor limitation: the disposable fetch guard checked status, botWall and signInForm, but did not run the operation-specific missing-recipe/loginPage classifier before returning. Stock verifySite continues its cases and only exposes the aggregate result at the end. Consequently the same invocation sent seven later GETs after the first core auth classification, including the two passing suggestion cases. This does not establish immediate per-case auth-stop enforcement. No website request was issued after that invocation returned at15:39:15.589Z. Further JYSK network work is stopped across brand hosts, aliases, routes and transports. Parent must record this conservative stop; shared state was not edited.

Home2 all-read verification was not started. A passing new operation cannot override the failed all-read gate, and the candidate stays private. Parent integrated registry/lint/type gates and counting remain unrun.

## Final offline scans, resources and cleanup

The final admitted offline audit at15:41:15.439Z exited0. Public-example exports from learn-home, cold-home-1 and cold-home-2 each equal the exact candidate JSON byte for byte. Each home independently passed the proper beside-origins credential collection, exact JSON+notes scan, export findings and vetShared with zero secrets, warnings or errors. No credentials were imported and no guest cookie was issued anywhere in r3. Clean scans establish export hygiene; they do not make the failed runtime gate pass.

All browser/document/source/offline audit workloads used unchanged resource_gate.py general88/90 with CPU defaults65/85 and roughly two-second sampling. Browser-free cold and all-read runs used89/90. The SSR89/90 exception was never used for API documents. The initial bounded instructional/helper text reads and low-impact report/code writes were not resource-wrapped; retained-source inspection, capture, learning, preflight and proof commands were gated. No workload relied on the coordinator's earlier launch-only snapshot.

One source inspection admission was denied at15:36:34.735Z, CPU8.54%, memory88.06%, exit75. No child launched. There was no website/browser work until after the successful resample at15:37:30.937Z, CPU13.07%, memory87.37%, 56.2seconds later. Exactly one of the maximum three batch resamples was used; successes did not reset it. No replacement batch, increased CPU limit, unrelated process stop or host-wide resource cap was used. New capture admissions were CPU8.46/memory86.34 and CPU12.27/memory85.74; final audit admission was CPU35.50/memory86.40. All source/log receipts retain their actual gate exits. Nonzero local helper exits are distinguished above from website outcomes.

Cleanup audit found no owned browser processes and no global browser mutex. Browser contexts closed at the end of their own capture commands. There was no full-page browser, private cookie import, account login, site write including recently-search POST, nested delegation, commit, push, PR, publication, watcher or persistent server. Raw responses, captures, profiles, trace/provenance values and executable disposable proofs remain only under ignored `bench/explore/state/discovery/jysk-search-qualified-r3/`.

Unchanged helper SHA-256 values are capture-document.mjs `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663` and resource_gate.py `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08`. Final artifacts and this public report are indexed with byte lengths and SHA-256 in artifact-hashes.json, excluding the manifest itself. The last indexing admission/exit and manifest hash are returned in the command transcript; the manifest has no self-referential hash. R2 files, shared state/helpers/source/dependencies and frozen publication files were untouched.
