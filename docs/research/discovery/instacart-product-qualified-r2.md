# Instacart product metadata qualification r2

PASS at the worker qualification layer. One distinct new read, `getProduct(product)`, is saved alongside the unchanged `listStores(region, city)`. Two operations total. The parent must run integrated focused registry, lint and type checks before counting the addition.

The exclusive worker started at 2026-10-28T07:00:45.037591Z and finished at 2026-10-28T07:08:04.266215+00:00. Commands ran directly. No CPU or memory snapshots, resource wrappers, resource waits, nested workers, private-cookie imports, site writes, commits, pushes, PRs or publication were used. Only the two Instacart site files, this report and the reserved ignored receipt directory were written. The temporary global browser mutex was acquired atomically and released by its recorded owner after each command.

## Baseline and access ledger

Read the current discovery runbook and policy, aliases and stop ledger before website requests, then the authoritative design, contribution guide, repository api-anything skill, existing site files and both product-source reports. `ledger-audit.json` records the recursive state audit, all 132 host-stop keys, aliases and the exclusive task claim. No Instacart stop matched. No other brand was requested. The current policy disables resource checks and wrappers; the old helper comment was not treated as current policy. Helper/source/dependencies/state/runbook remain unedited.

The exact starting hashes matched the supplied baseline:

- JSON `34452e6af3409d49c05d19077105b6272678ef6159217f7784b283d339aa6487`
- Notes `e659d361647720b8ce973a61ae9ffb70922ae8fef69c6101495342825d4e2c5f`

The complete original listStores operation, including its San Francisco example and West Cornwall/Long Island City checks, is structurally equal to the baseline. All eight frozen first-four publication files match their recorded hashes. The approved manifest was read without modification; its observed hash is `1d01121e845f272dbb78c8687166c09bf086c5bdcf6535b47c0e0357e8118a33`. Details are in `frozen-preservation.json`.

## Genuine frontend evidence and failures

Each capture ran the unchanged `bench/discovery/capture-document.mjs` directly with a separate absolute API_ANYTHING_HOME and owned atomic browser mutex. This is the repository Chrome workflow, restricted to the exact GET document with a 15-second capture timeout. Other requests were aborted, while inline scripts could run. No ambient private browser profile was used. These are genuine browser document captures, not fabricated exchanges or fully hydrated GUI evidence.

The historical A/B `/products/` URLs each generated a browser-observed `/store/products/` destination request. The helper aborted those destination requests because they differed from its exact supplied URL. Both helper runs reported `ok:false` and recorded no response body/status for the original document; no redirect status is invented. These are helper redirect-boundary failures, not observed site auth/rate/challenge or repeated website-error responses. Each actual observed destination was then captured with the same browser transport, without changing the helper or bypassing a control.

Learning pair:

- A, `cmvrro6k6094e75`, document request 1, HTTP 200, 159 exchanges with 158 aborted. <https://www.instacart.com/store/products/19875642-s-s-soup-base-bonito-12-packs-12-ea>
- B, `cmvrrpsg25d2844`, document request 1, HTTP 200, 159 exchanges with 158 aborted. <https://www.instacart.com/store/products/53947-rustichella-d-abrzzo-extra-virgin-olive-oil-16-9-oz>

The original redirect-boundary captures are `cmvrrnmog02bf7a` and `cmvrronix5b4c07`. All failures are retained in ignored captures and logs.

A's actual schema.org breadcrumb grounded the public Other Broths category URL. Category capture `cmvrrqcr3849a19` returned HTTP 200 with 70 of 71 exchanges aborted:
<https://www.instacart.com/categories/316-food/844-pantry/1239-soups/1242-broths-stocks/3378-other-broths>.

An actual anchor in that response supplied unseen D before its detail capture or replay:
<https://www.instacart.com/store/products/279311-kitchen-basics-original-seafood-stock-32-fl-oz>.
D was not guessed or used for learning. Its link exposes identity through the slug; its detail metadata had not been inspected when the input was selected. Historical Banza C was not used as a holdout because its indexed content was already exposed. D capture `cmvrrryp97f6f34` returned HTTP 200 with 170 of 171 exchanges aborted.

## Learning, supported scope and omissions

The repository CLI `add` learned from the two saved real captures with `--from`, `--from2`, `--pick-request 1`, their differing public product segments, and trigger `https://www.instacart.com/store/products/{product}`. Learning returned minTier 1, no warnings and no unproven mark. `add.json` retains the command result.

The existing embedded extractor starts at the JSON-LD Product object using regex `(\{\s*"@type"\s*:\s*"Product"\s*,)`. It picks `name`, literal `size`, short schema.org `description`, `brand.name`, `category` and the product page `offers.url`. The latter is only the identity URL. No offers price, stock or availability is returned. The product argument is the complete copied final path segment, bounded by a simple non-nested regex.

A's current structured data explicitly identifies brand S&S and size `0.246 oz`; B identifies Rustichella D'abruzzo and `16.9 fl oz`. These independently structured brand properties were not proved by the old hosted extracts. A's historical `12 x 0.246 oz` label is not conflated with the current literal size or reconstructed from the slug. No pack normalization is promised.

Ingredients, directions and the richer Details description occur in URL-encoded application state. The existing embedded recipe does not decode that state. They are omitted, rather than changing the extractor/helper or presenting an encoded payload as decoded data. Structured-data descriptions may be shorter or different from the Details prose. A field may be absent when the source omits it. No price, inventory, availability, delivery, address coverage or personal-location promise is made.

## Qualification gates

1. The candidate public-example export plus draft caller/maintainer notes passed offline `vetShared` with zero errors and zero warnings before D's detail capture, cold replay or verification. `preflight.json` and `export-preflight.json` retain this gate.
2. `fresh-home` did not exist. The runner created it, recorded that it was empty, then installed the exact candidate export. Its first API request was D via repository `call` at maxTier 1. The fetch receipt proves Cookie absent and Authorization absent. HTTP 200, class ok, tier 1, no healing. No private session or capture jar was copied into this home.
3. A separate Python HTMLParser parsed D's browser document, selected the JSON-LD Product by type and read the canonical link independently. All six returned fields matched exactly, including identity URL. Its title also identifies Kitchen Basics Seafood Stock with `32 oz`. `D-independent-expected.json`, `D-comparison.json` and `cold-result.json` retain the comparison. This is independent parsing of frontend document evidence, not a fully hydrated visual comparison.
4. The cold response issued ten guest-cookie records to that isolated site home. No session values or import source were present. Later verification sent Cookie, always lacked Authorization, and reused only cookies issued by Instacart to that home. Cookie names/counts and booleans are retained; values are not copied into this report or the spec.
5. `verifySite('instacart', {maxTier:1})` passed all six cases: listStores San Francisco, West Cornwall and Long Island City; getProduct A, B and D. Every response was HTTP 200 at tier 1. Current-version verification record hashes match the final operations. No healing or browser fallback occurred.
6. Final `exportSite` kept the public examples and returned zero secrets and zero warnings. The final export is byte-identical to the candidate installed before the cold first call. Final saved JSON plus final notes passed `vetShared` with zero errors and zero warnings. Caller notes are 1264 UTF-16 code units before the exact `## Maintainer notes` heading.

No auth, rate-limit, bot challenge or site error was observed. No new site stop or stop handoff is needed. The qualification runner had a sticky no-further-network guard for an access/error response; it was never activated. Existing stopped brands remain stopped. Parent registry/lint/type integration remains outstanding and no shared count is changed by this worker.

## Exact final identities

- `sites/instacart.json` SHA-256 `906d138d68da09beb3f1e67ba6b8f261510f2479f90e41026ded267c1fe3c4e5`
- `sites/instacart.md` SHA-256 `2c19251ba2dacc278a3a13a9bbd1b789cee8d6ca1b963a0c374891f3d937e1d6`
- listStores full canonical operation SHA-256 `8472fe72f37cccd364ef9da465aefa174c422c3138077b6c65b328be93afb12d`, verification record `8472fe72f37cccd3`
- getProduct full canonical operation SHA-256 `86311ace04b6d7433b5800a58c43835f6b3613b01303322e212558a8c7ab1c4d`, verification record `86311ace04b6d743`

Full operation hashes use SHA-256 over JSON.stringify of the parsed operation, matching the repository check-record input. Exact file-byte hashes are listed separately. The cold request body receipt, all actual capture file/body hashes, source URLs/times, original failures, process IDs and verification receipts are in:
`bench/explore/state/discovery/instacart-product-qualified-r2-20261028/manifest.json`.
Raw responses, browser profile and guest cookie material stay only in that ignored directory.

## Owned cleanup

Capture exec PIDs were 75008, 76057, 77078, 79252, 81154 and 83694, each recorded immediately when its process launched. All have exited. Each helper ran closeBrowser in finally. No Chrome/capture process tied to the owned isolated home remains, and the global browser mutex is absent. No unrelated process was stopped. Receipt files and isolated profiles are retained for audit; no watcher was started. Cleanup evidence is in `cleanup.json`.
