# ALDI qualification r1

PASS for worker qualification of one operation. Parent receipt audit and focused registry gate remain required before integration. No publication is authorized or performed.

UTC date 2026-10-26. Batch `aldi-qualified-r1`, one site, domain `aldi.co.uk`. Work ran from 20:28 UTC through this report, within the 20-minute bound. Source HEAD remained `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd` on shared dirty branch `t3/reverse-engineer-high-leverage-apis`. Existing unrelated work was preserved. No source, helper, dependency, runbook, catalogue or state edits; no commits, pushes, PRs, account imports, login, website writes or nested agents.

## Official access screen and source chain

Reused the bounded primary-source screen in `docs/research/discovery/uk-discount-retail-source-prep-r1.md`. ALDI's official mobile-app page documents consumer groceries/offers/stock overlap. The supplier-products page documents business product-data intake and portal links. Neither established a readily usable anonymous technical catalogue API or MCP contract. Portal credentials, approval, API schemas and current technical-field coverage remain unknown. No broad duplicate research or official app/portal launch was performed.

The source listing was captured at https://www.aldi.co.uk/products/specialbuys/electricals/k/1588161416584101 . `source.inspect.json` records shown text and actual raw hrefs after current `parseShown`, without fetching linked details. It confirmed A and B and recovered C as `/product/ambiano-styling-barrel-000000000751122001`. The indexed-only lead ending `002` was not fetched. This is a material href correction, not inferred variant semantics.

- A: `https://www.aldi.co.uk/product/ambiano-soup-maker-000000000734442001`
- B: `https://www.aldi.co.uk/product/ambiano-immersion-blender-000000000737164001`
- C: `https://www.aldi.co.uk/product/ambiano-styling-barrel-000000000751122001`

No actual auth, challenge, rate, 403, 429 or repeated website error was observed. Every captured or replayed document was HTTP 200, body-inspected immediately before the next qualification gate. No stopped host or other site was queried.

## Operation and honest semantics

Saved `sites/aldi.json` and `sites/aldi.md`:

`applianceDetails(productSlug)` returns one record with `title`, `brand`, `description`, `details`, and an optional `selectedOptionLabel`.

`productSlug` is the exact final path segment of an observed ALDI UK public product link, including its suffix. The format uses the simple character class `[a-z0-9-]{3,180}`. Captures prove a path slot, not a general meaning for numeric suffixes. No model, GTIN, ID or variant identity is inferred.

The recipe uses `main` and the current core's shown HTML: `h1.product-details__title`, `.product-details__brand-name`, `.product-details__information .p360-richtext`, `all:.product-details__information li`, and `.product-variant-dropdowns input@value`. The Product Details section has a show-more container with max-height; no claim is made that every bullet is initially in the viewport. No hidden streaming markup was promoted to shown content and the extractor was unchanged.

A gives Soup Maker, AMBIANO, six advertised functions, approximate 1.6-litre appliance capacity and stainless-steel blades. B gives Immersion Blender, AMBIANO, ON/Turbo buttons, two release buttons, a 2-tip blade and hanging loop. Their initial option labels are preserved literally as `Stainless Steel` and `High Speed Blending Set, Black`. This is useful descriptive appliance metadata, rather than a title-only result.

C gives Styling Barrel, AMBIANO, two heat and two speed settings, named brush/diffuser attachments and retailer-advertised `Power Output: 1000-1200W`, with initial label `Black`. Such statements are retailer descriptions, not independent performance or safety findings. Output is not a complete technical specification; no stock, availability, live pricing, model or dimensions are inferred. Adjacent descriptive paragraphs/bullets can join without separators. Other categories and arbitrary slugs remain unqualified. The initial label does not enumerate options or define a uniform colour/material taxonomy.

## Sequential qualification receipts

All evidence paths below are relative to ignored `bench/explore/state/discovery/aldi-qualified-r1/`. Independent stage commands ran sequentially, and each result was inspected before issuing its dependent command. Each substantive command had fresh resource admission.

1. Exact frontend source-document capture and shown/raw href recovery completed before A/B detail work. All browser runs used the unchanged `bench/discovery/capture-document.mjs`, exact GET only, its 15-second timeout and an atomic owned-token global browser mutex. Other requests were aborted. Inline scripts could run. These are genuine SSR frontend document captures, not synthetic exchanges or fully hydrated GUI proof.
2. A/B body inspections found distinct useful technical descriptions and no controls. `structure.out` and `recipe.out` record bounded selector discovery. One provisional recipe targeted a nonexistent class and returned no detail bullets; it was corrected to the actual `.product-details__information li` before learning. This was offline recipe exploration, not a heldout mismatch or website error.
3. `learn.json`: offline `addOperation` from A/B captures, two differing public `productSlug` examples, explicit document request 1, no browser and a fetch implementation that throws if offline learning attempts network. No warnings, no `unproven`, `minTier:1`, `readOnly:true`, `learnedLoggedIn:false`. No secret literals were saved.
4. `preflight.json`: public-example candidate export plus draft notes passed `vetShared` with zero errors and warnings; export secrets and warnings were empty. This completed before C capture or any heldout/verification/fresh work.
5. C was first opened only after preflight, using the actual source href. `c.inspect.json` independently established its title, brand, two heat/two speed settings, accessories and advertised power. `heldout.json` then called unseen C at tier 1 exactly once. Every extracted field deep-equaled the independent frontend C document, including the literal selected option label. No mismatch occurred.
6. `verify.json`: `verifySite('aldi',{maxTier:1})` passed 2/2 cases, Soup Maker example and differing Immersion Blender check. Both returned parsed data matching their independent frontend captures. Current local learned-op hash and record hash were `8b3c1c1dd93fabca`; gate errors were empty.
7. `export-final.json`: exact public-example export SHA equaled the preflight candidate. No export secret or warning. Its template URL is parameterized, so its operation hash differs from the local learned request's concrete example URL. The exported artifact is qualified separately below.
8. `fresh.json`: absolute `fresh-home` did not exist, was created empty, and had `initialEntries:[]` before installing only the exact exported spec. Its first operation call, C, returned tier 1 and matched all independent fields. The first actual request had no Cookie or Authorization. No everyday browser/profile state was imported. Later calls could use only guest cookies issued to this isolated home; request receipts below record booleans, never values.
9. `fresh-verify.json`: exact exported operation passed 2/2 tier-1 verification cases, each compared with independent A/B capture extraction. Record and current exported op hash both `ab0cd714eee3e923`; current-version gate errors empty.
10. `final.json`: exact saved JSON and final notes passed `SiteSchema` and `vetShared` with zero errors and zero warnings, tied to that exported-op verification record. JSON bytes equal the fresh-tested export. Only then were the two assigned site files retained. Parent alone runs focused registry/integrated checks.

No empty/nonexistent product was guessed or fetched. No optional filters or pagination are claimed. No live empty/not-found check was established. Local format validation is represented by the explicit parameter pattern, not claimed as an observed site response.

## Capture provenance

Each document request had no Cookie and no Authorization. All capture commands exited 0 and released their own mutex after the child exited.

| Label | Capture ID | HTTP | Answered / aborted exchanges | Raw document SHA-256 | Full capture JSON SHA-256 |
|---|---|---:|---:|---|---|
| source | `cmvppmpf5f9229e` | 200 | 1 / 116 | `ade1dc0151469ee5e5da9ae9f828b6c1162bbacf7e60b4c7718e9cb60b896e3e` | `499541ce1ef974ddbad839ed5b4cf015ded1e08e146c0d085021d35689234be6` |
| a | `cmvppndnh7f14a5` | 200 | 1 / 106 | `08eea6108370fccc6ff271355eecff21916dd2bf16b6bfbad101aacf15fd334f` | `813c8d9e79898eee72817d94b8a1c4f150742bb338f12ac071b1ac629d2054b0` |
| b | `cmvppnxone9f44a` | 200 | 1 / 107 | `17d92fe5306c99a37e496a0c5be65d0767c56a8a584fa6be3ae6863d647665d4` | `573dfe5e15c6ff3f39d087b43bcc6bf506e287d4166da3be75ecc8ca392ec509` |
| c | `cmvpppraq5d0fbf` | 200 | 1 / 107 | `8518c1f03d5adcd30f12645ad6787b32c63479056a9b7ffd3feda6ff23f5f086` | `3f7308f0031510e681ff642dfc987569fc29195b6e1f39326443f1963297ec1d` |

Raw response bodies, parsed outputs, request booleans, status and failure fields are retained only in ignored evidence. Observer request receipts and stage result files are written in `finally`, including error paths; no missing failure receipts are fabricated. Full capture JSON remains under the isolated `home/captures/`. No contacts, profiles or residential addresses are output by the operation.

## Tier-1 request receipts

`Cookie / Authorization` means actual outbound header-presence booleans. Set-Cookie means response header presence, without logging values. Parsed outputs and failure details are in the corresponding `.requests.json`; actual raw bodies are `.requestN.body.html`.

| Stage/request | Exact productSlug | HTTP | Cookie / Authorization | Set-Cookie | Body SHA-256 |
|---|---|---:|---|---|---|
| `heldout` 1 | `ambiano-styling-barrel-000000000751122001` | 200 | false / false | false | `72ef0f5df57f88c12c84f63199f4cd529c89c7519bbe9331a3029179b01d2190` |
| `verify` 1 | `ambiano-soup-maker-000000000734442001` | 200 | false / false | false | `6e61fa2668f58434c940037d6c65a862c0272e31de2d68214ac1b14b64e2f185` |
| `verify` 2 | `ambiano-immersion-blender-000000000737164001` | 200 | false / false | false | `2348b50ced6cca270fc5beb346144360b1f9e77e5377aa2f4e7bdb0e700c42cc` |
| `fresh` 1 | `ambiano-styling-barrel-000000000751122001` | 200 | false / false | false | `72ef0f5df57f88c12c84f63199f4cd529c89c7519bbe9331a3029179b01d2190` |
| `fresh-verify` 1 | `ambiano-soup-maker-000000000734442001` | 200 | false / false | false | `6e61fa2668f58434c940037d6c65a862c0272e31de2d68214ac1b14b64e2f185` |
| `fresh-verify` 2 | `ambiano-immersion-blender-000000000737164001` | 200 | false / false | false | `2348b50ced6cca270fc5beb346144360b1f9e77e5377aa2f4e7bdb0e700c42cc` |

## Exact final artifacts

- JSON SHA-256: `2fb07e57211aff98d74753b2b203570f876e33de169077f46461bf4ea9394a2a`
- Notes SHA-256: `d13bafe7532dc8ff0599382a5b60fe07044d550f6ef99ef2f8d41c4da1d69342`
- Exported current operation/verification record hash: `ab0cd714eee3e923`
- Frontend helper SHA-256: `a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663`
- Resource gate SHA-256: `a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08`
- Machine-readable summary: `receipt-manifest.json`.

## Resources and cleanup

Every exact SSR helper capture used `--admit 89 --hard 90`; bounded browser-free heldout, verify and fresh reuse used 89/90. Offline learning, selector analysis, export and vet used 88/90. CPU admission/stop stayed 65/85. No gate was nested. No exit-75 admission or watchdog stop occurred, so no denial resampling or self-respawn occurred.

Across 18 workload receipts and 32 resource samples, sampled peak CPU was 55.17%, non-cache policy memory 87.40%, and raw occupied memory 99.71%. Raw occupied memory is separate. These are sampled host readings, not a global cap or proof about unsampled peaks. The supplied 20:27:58 launch-only snapshot authorized no child workload by itself.

| Workload receipt | Admission UTC | Sampled CPU peak % | Non-cache peak % | Raw occupied peak % |
|---|---|---:|---:|---:|
| `a.inspect` | 2026-10-26T20:30:07.028556+00:00 | 13.39 | 81.93 | 95.23 |
| `a` | 2026-10-26T20:29:54.476599+00:00 | 38.07 | 87.07 | 99.71 |
| `b.inspect` | 2026-10-26T20:30:33.115324+00:00 | 22.60 | 82.84 | 97.44 |
| `b` | 2026-10-26T20:30:20.487935+00:00 | 20.02 | 85.84 | 99.69 |
| `c.inspect` | 2026-10-26T20:31:59.491197+00:00 | 38.25 | 85.71 | 99.61 |
| `c` | 2026-10-26T20:31:45.958505+00:00 | 16.31 | 86.56 | 99.66 |
| `export-final` | 2026-10-26T20:32:57.206909+00:00 | 15.18 | 86.12 | 99.43 |
| `final` | 2026-10-26T20:33:52.359409+00:00 | 18.01 | 85.65 | 99.68 |
| `fresh-verify` | 2026-10-26T20:33:21.300572+00:00 | 18.60 | 84.00 | 98.68 |
| `fresh` | 2026-10-26T20:33:10.476407+00:00 | 15.31 | 78.99 | 92.26 |
| `heldout` | 2026-10-26T20:32:24.269514+00:00 | 27.08 | 87.12 | 99.68 |
| `learn` | 2026-10-26T20:31:09.977578+00:00 | 11.80 | 85.15 | 99.65 |
| `preflight` | 2026-10-26T20:31:27.852025+00:00 | 9.40 | 85.24 | 99.51 |
| `recipe` | 2026-10-26T20:30:51.267318+00:00 | 18.71 | 85.21 | 99.67 |
| `source.inspect` | 2026-10-26T20:29:39.026031+00:00 | 14.61 | 83.78 | 98.26 |
| `source` | 2026-10-26T20:29:14.895470+00:00 | 52.74 | 86.68 | 99.70 |
| `structure` | 2026-10-26T20:30:40.683415+00:00 | 55.17 | 84.72 | 99.60 |
| `verify` | 2026-10-26T20:32:38.241359+00:00 | 20.50 | 87.40 | 99.63 |

All owned child commands exited. Final process inspection found only the audit shell matching the batch path, with no owned browser/workload remaining. The global mutex was absent at this audit and no other worker's lock was touched. Isolated homes, raw bodies and receipts are intentionally retained for parent independent re-extraction. No unrelated process was stopped or unrelated file removed. Parent state/runbook/catalogue were not edited.
