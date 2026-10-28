# Instacart category discovery qualification r1

PASS at the worker qualification layer. Added one distinct public read, `listPantryCategoryProducts(aisle, group, category)`, for the initial product cards of five-level food/pantry categories. Instacart now has three operations and nine saved cases. The parent owns shared registry, lint and type checks before counting this addition.

The exclusive claim started at 2026-10-28T07:25:39.227174+00:00. The worker finished at 2026-10-28T07:34:30.917147+00:00, within twenty minutes. Commands ran directly. No CPU or memory checks, resource wrappers, recovery waits, nested workers, private-cookie imports, site writes, source/dependency/helper changes, commits, pushes, PRs, publication or watchers were used. Only the two Instacart site files, this report and the reserved ignored receipt directory were written.

Read the discovery runbook, current claim and full stop ledger, design, contribution guide, repository api-anything skill, both existing site files and the product worker/parent reports before live work. The complete recursive stop audit and alias map are in `ledger-audit.json`. No Instacart stop matched. Existing stops remain in force. The parent claim was the only category qualification worker.

## Runnable workflow and scope

The supported request and trigger are `https://www.instacart.com/categories/316-food/844-pantry/{aisle}/{group}/{category}`. Each argument is one complete ID-and-slug segment, copied in order from the same actual category link. Learning produced three separate codec path slots. It does not bind an entire slash-containing route to one segment, invent a shortened route, or promise other category depths.

The HTML recipe reads the initially published product anchors under `data-experiment-id=seo-taxonomy-products`. It returns each card's name, literal size and resolved product URL in source order. The caller can pass that URL's final segment to unchanged `getProduct`.

Public examples and checks:

- A, Other Broths. `aisle=1239-soups group=1242-broths-stocks category=3378-other-broths`. Retained genuine capture `cmvrrqcr3849a19` has 48 cards.
- B, Olive Oils. `aisle=845-baking-and-cooking group=900-cooking-oils category=910-olive-oils`. Genuine capture `cmvrskrc84edf7e` has 48 different cards. Its full route came from the previously captured Rustichella product breadcrumb. All three arguments change and bind to the corresponding request segments.
- D, genuinely unseen Beef Broth. `aisle=1239-soups group=1242-broths-stocks category=3374-beef-broth`. The actual Broths and Stocks navigation capture `cmvrsl7x1dc1113` supplied the literal link before D's content was captured or replayed. `D-selection.json` records that boundary. D capture `cmvrsmwxp240d07` has 48 cards. The final segment differs from A while its two ancestor segments stay fixed.

This operation covers the initial page only. Pagination, filters, arbitrary category routes, other depths, prices, stock, availability, delivery and address coverage are excluded. Size labels are literal; packs and units are not normalized. No site-specific runtime code was added.

## Genuine capture and learning

The unchanged `bench/discovery/capture-document.mjs` ran directly under owned atomic `browser.lock` directories, with an absolute isolated `API_ANYTHING_HOME`. Each run allowed only its exact GET document, used the helper's fifteen-second capture timeout and aborted other requests. Inline scripts could execute. These are frontend document captures, without fully hydrated GUI proof. No HTTP response was fabricated as a browser exchange.

The reused A evidence passed exact SHA-256 validation against the supplied original manifest, file and body pins. The original manifest remains `12eab37fb83ea49bc1481b8d492db5f72248680929a10e94d3940b194fb1ea07`. A's file is `5aaa0fe0766bc773138915185f8360638034e58266524aef6e5b6644ca736445` and its decoded body is `f458d844613aa8e18ccea83ecf232c90c575ce2dd03e79c1e7ceb065f5095950`. The original product A/B captures were inspected only to ground actual category links. Kitchen Basics product 279311 was already known and is not claimed as an unseen product here.

The repository CLI `add` used genuine A/B captures, request 1, the two differing public argument sets and the HTML recipe. It returned minTier 1, no warnings and no unproven mark. `learn-command.json` and `learn.log` retain the exact command and result. An independent Python HTMLParser corroborated all 48 A rows and all 48 B rows against their captured core judgments. A and B differ in identities and content.

## Qualification gates

The candidate metadata, public-example export and draft caller/maintainer notes passed offline `vetShared` with zero errors and zero warnings at 2026-10-28T07:28:57.136Z. This embedded UTC timestamp precedes D's capture at 2026-10-28T07:29:07.645Z, its cold call and final verification. The candidate operation hash was already final at preflight.

The cold home did not exist. The runner created it, recorded its initially empty directory, and installed the exact final JSON export. Its first API call requested D at maxTier 1. The request sent neither Cookie nor Authorization. It returned HTTP 200, class ok, tier 1, with no healing. The independently parsed frontend D document matched every name, size and identity URL for all 48 rows, in exact order, for 144 field values. `D-independent.json`, `D-comparison.json`, `cold-initial.json` and `cold-requests.json` retain those proofs.

The cold response issued seven guest-cookie records. Subsequent calls reused only cookies issued by Instacart to this isolated home. The final session has ten cookie records, no session values and no import source. Every later request sent Cookie and omitted Authorization. Names/counts and header-presence booleans are recorded, while values remain only in ignored local jars.

A real returned D card supplied `/store/products/69764-swanson-beef-broth-32-oz`. A separate genuine product document capture, `cmvrsov9f36ed2c`, grounded this newly encountered product. The category-to-product call passed through unchanged `getProduct` at tier 1. A separate Python JSON-LD parser and canonical-link reader matched all six product fields. Category and detail sources agree on Swanson's Beef Broth, 32 oz and the canonical identity URL. This demonstrates a runnable discovery-to-detail workflow rather than a field-only wrapper. `chain-input.json` and `chain-comparison.json` retain the chain and comparison.

`verifySite` then passed every read in the modified final export, all nine cases at tier 1 with no healing. These are the original listStores San Francisco, West Cornwall and Long Island City cases; original getProduct soup-base, olive-oil and Kitchen Basics cases; and the new Other Broths, Olive Oils and Beef Broth category cases. The complete two original operation objects, including examples and checks, remain unchanged. No prior cold proof was rerun. Their required all-read verification was run against this modified export.

Final library export and repository CLI export kept the harmless public examples, returned zero warnings and secrets, and are byte-identical to the preflight candidate used for the cold first call. Final saved JSON plus final saved notes passed `vetShared` with zero errors and warnings at 2026-10-28T07:32:44.670Z. Caller notes contain 1685 UTF-16 code units before exact `## Maintainer notes`; the full notes are 6899 bytes. `exact-operation-verification.json` checks each final operation against its stored current-version verify record.

## Sticky stop guard

Every real tier-1 response passed the real core `judge` inside the fetch wrapper before the wrapper returned it to core. Any non-ok judgment latches a persistent stop before core can retry or another send can occur, including HTTP 200 auth. Mock responses reproduced auth at HTTP 200, rate, blocked, server error and drift. Each test allowed one underlying send and refused the next. These are mock controls, not frontend evidence. `guard.mjs`, `qualify.mjs` and `mock-controls.json` retain the implementation and controls.

All eleven real tier-1 requests, one cold category call, one chained product call and nine verification calls, were HTTP 200/class ok. No auth, rate, challenge or site error occurred; no new stop is required. No transport switch or stop bypass occurred. All four new browser captures returned HTTP 200. The retained A was also HTTP 200.

## Exact final identities

- Final `sites/instacart.json` SHA-256 `493313ee35dc3d7f702c28f3680054ee37fe77cffab865b7355c70f25bfddb0b`.
- Final `sites/instacart.md` SHA-256 `227dd01c649619735a485710c964fb49027a0ef3fafa9aa20d699c76e90f185a`.
- Full parsed `listStores` operation SHA-256 `8472fe72f37cccd364ef9da465aefa174c422c3138077b6c65b328be93afb12d`; verify record `8472fe72f37cccd3`.
- Full parsed `getProduct` operation SHA-256 `86311ace04b6d7433b5800a58c43835f6b3613b01303322e212558a8c7ab1c4d`; verify record `86311ace04b6d743`.
- Full parsed `listPantryCategoryProducts` operation SHA-256 `68067e4be598b55f4e419b265a83613560471a0ada0564632b6f390617c32fe5`; verify record `68067e4be598b55f`.

Full operation hashes use SHA-256 of JSON.stringify over the parsed operation. Exact file hashes are separate. All eight frozen publication files and the approved manifest match their supplied hashes. The approved manifest remains `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`. No state, runbook or old receipt was edited.

Full capture file and decoded-body SHA-256 values:

- A `cmvrrqcr3849a19`, 2026-10-28T07:03:48.495Z, HTTP 200, 70 of 71 exchanges aborted. File `5aaa0fe0766bc773138915185f8360638034e58266524aef6e5b6644ca736445`. Body `f458d844613aa8e18ccea83ecf232c90c575ce2dd03e79c1e7ceb065f5095950`. Source <https://www.instacart.com/categories/316-food/844-pantry/1239-soups/1242-broths-stocks/3378-other-broths>.
- B `cmvrskrc84edf7e`, 2026-10-28T07:27:27.080Z, HTTP 200, 73 of 74 exchanges aborted. File `64e777f85110cb94d7fb8db133aedd3a713760fa7fd79573e15898135f37e652`. Body `dfe47fff74e9ed44ebb3155ad9d1b421c5b0d063cfa867a23649760f9e1f2051`. Source <https://www.instacart.com/categories/316-food/844-pantry/845-baking-and-cooking/900-cooking-oils/910-olive-oils>.
- navigation `cmvrsl7x1dc1113`, 2026-10-28T07:27:48.565Z, HTTP 200, 71 of 72 exchanges aborted. File `2ab7bd4b7418e2f76a869028560e1fe6fd135c023a09df8f2a1d0c025bf9aa72`. Body `20a24e0764f247ba1148c077d20c26dc97c1fd8813015b6e3b952afa63ea1948`. Source <https://www.instacart.com/categories/316-food/844-pantry/1239-soups/1242-broths-stocks>.
- D `cmvrsmwxp240d07`, 2026-10-28T07:29:07.645Z, HTTP 200, 94 of 95 exchanges aborted. File `e05584690a837f63a19881880ad3554840a56e61152e0fcfe20be1d8ce33bcae`. Body `57356a061795893a3f8638e52a9ece70d1c8305f705c77455eab08ad933ea845`. Source <https://www.instacart.com/categories/316-food/844-pantry/1239-soups/1242-broths-stocks/3374-beef-broth>.
- chain product `cmvrsov9f36ed2c`, 2026-10-28T07:30:38.787Z, HTTP 200, 181 of 182 exchanges aborted. File `8f6dd26ff53f4ccf80fbd37b9307eef50a84bce0693ad14e819f9ae669e0c9fb`. Body `16749c2618c336aeea5651f2303c9fb971bd1e958f887a0ca4bc136c0ea82e04`. Source <https://www.instacart.com/store/products/69764-swanson-beef-broth-32-oz>.

## Owned cleanup and handoff

All owned capture commands exited and each helper ran closeBrowser in finally. Capture exec PIDs were 63379, 65316, 68107 and 73709. Core runner PIDs were 74972, 77214 and 78056 for chain, verify and export. The cold exec session was 55109. Immediate process receipts and returned session IDs remain in the ignored root. The owned-profile Chrome process check found none remaining, and the global browser mutex is absent. No unrelated program was stopped. Profiles, guest jars and raw captures remain ignored for audit. No watcher was started.

Report: `docs/research/discovery/instacart-category-qualified-r1.md`.
Manifest: `bench/explore/state/discovery/instacart-category-qualified-r1-20261028/manifest.json`.
Manifest SHA-256 `930f3788e2f18cd598e386f54b184ed43b6c0d73f1f7226773036b7332d881ed`.

The worker result is PASS with one addition. Shared integration and state/count updates remain with the parent.
