# EU shopping qualification r2

BLOCKED by resource admission, with a partially qualified Auchan candidate retained only in ignored evidence. Zero registry additions. OTTO remains incomplete. No website-control stop was observed on either domain.

## Scope and current state

Work ran on 2026-10-26 from 16:40:49 UTC to the final workload attempt at 16:49:32 UTC. Source HEAD remained `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd` on shared dirty branch `t3/reverse-engineer-high-leverage-apis`. Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, current state and eu-shopping-r1.md. State assigned only otto and auchan to this batch. No nesting or delegation.

The launch snapshot was historical context, not workload admission. Every source/network, browser, offline analysis, learning, export and replay workload had a fresh explicit resource gate. General admission was 88% non-cache memory, exact-document captures and bounded tier-1 qualification used 89%, and sampled stop was 90%. CPU defaults remained 65% admission and 85% stop. Neither helper was edited. The 89% capture exception was used only after source reads established the exact SSR product documents and their useful content.

Evidence directory: `bench/explore/state/discovery/eu-shopping-r2/`. Absolute isolated home: `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/eu-shopping-r2/home`. It began empty; its later guest-cookie qualification is explicitly not an empty-home first-call reuse proof.

## OTTO: BLOCKED, no candidate

Reused the retained anonymous homepage body from r1 without requesting the root again. Current offline `parseShown` analysis reproduced its title, ordinary storefront text and `/suche` form. Its shown links did not provide product examples. Raw form inspection showed a disabled search input without a name, so no query semantics were invented. Source inspection of hidden navigation is not evidence of visible product content. No product route, official consumer API/access screen or operation was established. No fresh OTTO website request or capture ran in this batch. No website authentication, challenge, 403 or rate response was observed.

Retained source body SHA-256: `aa8241d4558f7cd7d3bc49d9e16a501971f0945541064e8a8e4ff4eb25a91b7f`. This is reused source evidence, not a fresh response or a browser capture. See `otto-home-retained.json` and `otto-home-analysis.resources` in this batch, and `eu-shopping-r1/otto-home.body` plus its original response metadata.

## Auchan: BLOCKED, candidate passed intermediate gates

Public-read candidate contract: `getProductDetails(slug, productId) -> title, brand, specifications`. Both arguments are the exact pair from a source-linked French product URL. `productId` includes its C prefix. `slug` is a route component, not a proven independent filter. Patterns are simple bounded character classes. The saved local operation hash after metadata and checks was `f5fa30eadbf4cbbb` according to `opHash`; the verification record uses the same hash.

The response contains one product record. `specifications` contains French general-characteristic label/value text blocks, including a descriptive paragraph where supplied. It omits other technical sections and can vary by product. No full technical-specification, complete list, price, seller-offer, stock, delivery, store, review or variant-selection claim is made. The source itself warns that prices and promotions can vary with purchase mode. The candidate deliberately extracts identity and general characteristics only.

### Official access screen

The public homepage links to product information and marketplace information. Product information links to product manuals/support and spare-part availability. Marketplace information describes third-party sellers and links to seller onboarding. Onboarding requires a European professional business, registration/tax/contact details and a request to join. These primary pages did not document anonymous consumer catalog API access. This bounded screen does not prove that no official API exists. A remote search-tool invocation returned an empty error result and supplies no evidence. No seller application, login, API-key request or website write was performed.

Primary pages inspected, all anonymous GET 200 with ordinary bodies and no detected wall:

- `https://www.auchan.fr/`
- `https://www.auchan.fr/informations-produits/ep-informations-produits`
- `https://www.auchan.fr/informations-marketplace/ep-informations-marketplace`
- `https://www.auchan.fr/devenir-vendeur-marketplace/ep-devenir-vendeur-marketplace`

### Source-linked examples and independent held-out meaning

Homepage link “jouets Lego” led to `https://www.auchan.fr/jouets-jeux-video-loisirs/jeux-jouets/lego-playmobil-construction/lego/ca-6860409`. That actual category body linked all three product examples below. The category contains many offers and is not saved as a list operation.

| Role | Exact slug | productId | Independently read meaning |
|---|---|---|---|
| Example 1 | `lego-city-60337-le-train-de-voyageurs-express-telecommande` | `C1553147` | LEGO City 60337 train, 764 pieces, minimum age 7 |
| Example 2 | `lego-friends-42687-la-maison-de-famille-de-liann` | `C1849115` | LEGO Friends 42687 house, 946 pieces, minimum age 7 |
| Held out | `lego-city-60316-le-commissariat-de-police` | `C1486035` | LEGO City 60316 police station, 668 pieces, minimum age 6 |

Each exact product URL is `https://www.auchan.fr/<slug>/pr-<productId>`. Before capture/learning, all three actual source bodies were read separately, inspected immediately, and passed through unchanged `parseShown`. They returned product content, not HTTP-200 challenge pages. Source reads are source evidence only; they were never converted into captures.

The held-out source was obtained at 16:45:47.078 UTC. After learning and offline candidate preflight, the tier-1 call at 16:49:07 returned exactly one record with brand LEGO, title “City 60316 - Le commissariat de police”, and the general-characteristic entries `LicenceCity`, `Nombre de pièces668` and `Age minimal6`, plus its description. The independent source had already established those facts. The comparison explicitly asserted one record, successful tier 1, the 60316 title identity, LEGO brand and the 668-piece entry. It did not merely check HTTP 200 or a nonempty result.

### Capture and qualification receipts

| Gate | Actual result / evidence |
|---|---|
| Example 1 frontend capture | `cmvphoh38cdd363`, document exchange 1, GET 200, 60 exchanges, 59 aborted; `auchan-capture1.stdout` |
| Example 2 frontend capture | `cmvphp22n853513`, document exchange 1, GET 200, 56 exchanges, 55 aborted; `auchan-capture2.stdout` |
| Actual capture-body inspection | Both products inspected immediately after command completion with the core HTML extractor; expected distinct titles/brand appeared. First capture also exposed general characteristics. `auchan-capture1-inspect.stdout`, `auchan-capture2-inspect.stdout` |
| Offline two-capture learning | Passed, no network permitted by the supplied fetch implementation, no warnings, `minTier:1`, `learnedLoggedIn:false`; `auchan-learn.json` |
| Candidate export plus draft-notes preflight | Passed. Export secrets `[]`, export warnings `[]`, `vetShared` errors `[]` and warnings `[]`; `auchan-candidate.json`, `auchan-candidate.md`, `auchan-preflight.json` |
| Independent third-input tier-1 comparison | Passed as described above; `auchan-heldout.json`, `auchan-heldout-requests.json` |
| `verifySite(maxTier:1)` | Passed 3/3 cases, example plus both other products, all tier 1, hash `f5fa30eadbf4cbbb`; `auchan-verify.json`, `auchan-verify-requests.json` |
| Final current export with public examples | Attempted at 16:49:32, resource gate exited 75 before child launch. No `auchan-final.json`; candidate export is only an intermediate artifact |
| Export-version hash / verification | Not established. The learned hash includes learned response shape, which export removes; do not relabel it as an exact exported-version hash |
| Initially empty-home cookie-free first-call reuse | Not run; missing |
| Final exact saved JSON plus notes `vetShared` | Not run; missing |
| Parent audit and focused registry gate | Not run; no registry files submitted |

Captures used the unchanged `bench/discovery/capture-document.mjs`, with its exact GET allowlist and 15-second trigger timeout, under owned global mutex tokens. Other requests were aborted; inline scripts may run. This proves genuine browser document captures, not a fully hydrated GUI. The global lock was released only after each gate child exited. The first captured document took about 10.1 seconds before helper output and subsequent browser cleanup; the second took about 2.3 seconds. No Shopee capture monitor was used.

Every raw HTTP scout sent neither Cookie nor Authorization and did not reuse Set-Cookie values. Browser captures began with the isolated profile and obtained site-issued guest state. Held-out and verification requests sent Cookie `true`, Authorization `false`; those were site-issued guest cookies in this isolated home, not imported account cookies. Responses set guest cookies. Values are not included here. These runs must not be counted as fresh-home cookie-free reuse. Their bodies were inspected for challenge/status markers before any subsequent request; all were ordinary HTTP 200 products. No control stop was observed.

### Full source and replay provenance hashes

All hashes below are SHA-256 of the observed response body. Raw bodies and capture files remain ignored. Captured-body/file hashes were not independently computed before the final resource deferral, so the source hashes must not be attributed to captures.

| Evidence basename | SHA-256 |
|---|---|
| `auchan-home` | `a8dad0a361801c5e9346680314e733fd7dbbd72dad87f9bed76e777dce8acb59` |
| `auchan-product-info` | `24a51f3009d03ad385eb046eb0e24aa7ba48b920e3ac9ba1dc60eec9c2f88f34` |
| `auchan-lego-category` | `a90cf75e3bb32b39ac1fca57a8c5ebffafa96d5bb51f39b03c9b93cee564949d` |
| `auchan-product1` | `e24492d5d408e964e811e8ae3ce7b8b0fc51fccb8a0b568f48dcef4b4dafa870` |
| `auchan-product2` | `b3b3199999719b34425fd6f0bda567b2e92b50b47088cee91e0fbd1760b9bbcb` |
| `auchan-heldout-source` | `b3450bd484d3f3e1984aa75e15f75644890fc1be10c49fd5f9257fc236bb1eea` |
| `auchan-marketplace-info` | `60a9db4597ab8c49f368f8cd8f862a35ef34331145289bfc41079fe6ea01b9e5` |
| `auchan-seller-access` | `3f150d494efee12c2f40aa12b54bcdef47fb2d08b60fd0a691e064e43f3baed7` |
| `auchan-heldout-response-1` | `0707047eab434b0f82572cb714ad35728390edf1a8e3695b785f5ff465df1946` |
| `auchan-verify-response-1` | `597a79c280509420f75ce2997eb0e671c84540c5a508deff853dd681808b2f9b` |
| `auchan-verify-response-2` | `510e0c6b5b972de43853c31628ec669ceadbde89eff52f4180b9908977ccee3d` |
| `auchan-verify-response-3` | `4c1d4e56cedeedcf843db369fc5630e86452b60c0d0f4f2b38998363e3b119cc` |

## Resource receipts and stop

Initial gate denial and the three permitted resamples:

| UTC | Intended workload | CPU % | Non-cache memory % | Raw occupied % | Result |
|---|---|---:|---:|---:|---|
| 16:41:56.075 | Retained OTTO analysis | 18.41 | 89.79 | 99.48 | 75, no child |
| 16:42:41.208 | Resample 1, retained analysis | 14.56 | 89.47 | 99.62 | 75, no child |
| 16:43:31.493 | Resample 2, Auchan source | 28.90 | 88.43 | 99.67 | 75, no child |
| 16:44:16.768 | Resample 3, Auchan source | 16.72 | 85.02 | 99.62 | Admitted; exited 0 |

Each resample followed more than 30 seconds without own website/browser requests. After headroom recovered, each later workload obtained its own gate. Final export admission at 16:49:32.102 recorded CPU 13.70%, non-cache memory 88.50%, raw occupied 99.66%, exited 75 and launched no child. With all three batch resamples already used, no further workload was launched and no self-respawn occurred.

Across admitted workloads and their watchdog samples, sampled peaks were CPU 37.85%, non-cache memory 89.18%, and raw occupied memory 99.69%. Including admission denials, non-cache memory peaked at 89.79%; this denial is not a workload peak. The exact-document captures' sampled CPU peak was 37.85% and memory peak 86.09%. The tier-1 verification memory peak was 89.18%. Raw occupied memory is separate from the policy metric. These are sampled observations, not a global or unsampled cap guarantee. All exact samples remain in the per-command `.resources` files.

## Cleanup and integration boundary

All owned workload children exited. Both browser commands completed `closeBrowser`; the owned browser locks were removed after child exit. No ongoing browser workload or owned mutex remains. Raw captures, isolated guest state, scripts, candidate JSON and draft notes remain ignored for a future explicitly assigned continuation. Do not treat the local home spec or candidate export as a registry addition.

Only this report was added outside ignored evidence. No `sites/otto.json`, `sites/otto.md`, `sites/auchan.json` or `sites/auchan.md` was created. No other site, first-four frozen spec, source, dependency, state, runbook or catalog was edited. No integrated checks, commits, pushes, PRs, publication, everyday browser import/login, website writes, CAPTCHA/control bypass, proxy changes or unrelated cleanup occurred. Parent may resume from retained evidence only under renewed assignment and fresh admission, preserving all missing gates above.
