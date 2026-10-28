# Zalando UK qualification r2

2026-10-26 UTC. **PASS** for one narrow public read operation, `getProduct(productPath)`. Saved `sites/zalando.json` and `sites/zalando.md`. Two real learning captures, unseen tier-1 semantic comparison, three tier-1 verification cases, public-example export, empty-home cookie-free reuse and direct `vetShared` all passed. Integrated repository checks remain the coordinator's responsibility.

## Scope and method

Read `AGENTS.md`, `docs/DESIGN.md`, `CONTRIBUTING.md`, `skills/api-anything/SKILL.md`, `bench/discovery/README.md`, the existing registry/discovery index, `fashion-source-prep-r2.md` and `zalando-official-screen-r1.md`. No existing Zalando spec or duplicate live assignment was found. The official screen established UCP participation but no anonymous retailer service, independent-client access contract or UK coverage. No UCP route was guessed or tested.

All raw evidence and scripts are ignored under `bench/explore/state/discovery/zalando-qualified-r2/`. The absolute isolated home was `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/zalando-qualified-r2/home`, initially empty. No user browser data was imported, and no login occurred. `learnedLoggedIn` is false.

Browser work used the repository's experimental `capture-document.mjs` after reading its implementation. Each command acquired the global browser mutex atomically, recorded an ownership token and released it after its owned subprocess exited. Every capture used the default 65% CPU/88% policy-memory admission and 85% CPU/90% policy-memory stop. Only the exact requested GET document was allowed; all other captured requests were aborted. Bodies were inspected before the next Zalando request. Inline scripts may run, but this is server-rendered document evidence, not a fully hydrated GUI.

## Captures and exact inputs

All three source/request URLs were `https://www.zalando.co.uk/` followed by the exact input below and `.html`. Each document returned HTTP 200 with product content and no observed auth wall, challenge or rate limit. The only occurrence of “challenge” was ordinary embedded moderation-appeal translation text. Helper success was followed by body inspection rather than treated as sufficient proof.

| Role | Exact `productPath` | Capture and document exchange | Displayed article |
| --- | --- | --- | --- |
| Learning A | `adidas-originals-samba-og-unisex-trainers-core-black-ad115o1o3-q11` | `cmvpaqy4re1ffaa`, 1 | `AD115O1O3-Q11` |
| Learning B | `adidas-originals-samba-unisex-trainers-whitecardboard-ad115o1pp-a12` | `cmvparjlm5a9573`, 1 | `AD115O1PP-A12` |
| Held out from learning | `adidas-originals-handball-spezial-unisex-trainers-carboncarbongum-ad115p09y-q11` | `cmvpasbead23d44`, 1 | `AD115P09Y-Q11` |

Capture files are `home/captures/<captureId>.json` in the evidence directory. The three captures recorded 57, 48 and 62 exchanges respectively, with 56, 47 and 61 aborted. Three documents were allowed, 164 other recorded requests were aborted. No alternate host, route or transport was used to work around a control.

## Operation and field semantics

`getProduct(productPath) -> name, articleId, brand, schemaColour, url` takes the complete sourced product-link path segment before `.html`. It does not synthesize a slug from an article ID. The learned GET template has one `path:0` slot with `{productPath}.html`, no session/cookie reference, no volatile anchors, and `minTier: 1`. Both-run learning returned zero warnings and no `unproven` mark. `learn-requests.json` is empty, proving learning used the saved captures without an additional site replay.

The recipe reads the first item of the document's JSON-LD array and picks only those five fields. `articleId` comes from `productGroupID` and matches the separate displayed article-number detail. It is not a selected-size SKU. The nested size variants have separate SKUs and are excluded. `name` and `brand` match the product heading, and `url` matches the canonical link.

`schemaColour` is structured metadata and agrees with the document title. It can be longer than the selected colour label. On the held-out page, the metadata/title says `carbon/carbon/gum/anthracite`, while the selected colour label and product name use `carbon/carbon/gum`. Caller notes state that distinction. This operation does not claim to return the exact selected colour label as a separate field.

Offers, price, currency, stock, size selection, seller fulfillment, delivery promises and checkout totals are excluded. The earlier remote price discrepancies remain unresolved; observing GBP in nested size-variant offer metadata does not justify selecting or flattening one offer into the product result. Broader product families and non-trainer categories were not independently tested.

## Unseen semantic comparison

A Python standard-library parser independently read the held-out capture's heading brand/name, article-number `dt`/`dd`, canonical link and document title. It did not use JSON-LD, the operation recipe or core extraction code. `third-independent-source.json` records this method and the selected-colour distinction; `third-expected.json` holds the expected five-field result.

The initial tier-1 unseen call completed in 2033 ms with no heal. `replay.json` and `replay-comparison.json` show exact equality for all five fields:

- name `HANDBALL SPEZIAL UNISEX - Trainers - carbon/carbon/gum`;
- article `AD115P09Y-Q11`;
- brand `adidas Originals`;
- schema colour `carbon/carbon/gum/anthracite`;
- canonical URL for the exact held-out route above.

This checks identity and field meaning, beyond HTTP status or nonempty output.

## Verification, export and reuse receipts

All paths below are relative to the ignored evidence directory unless stated otherwise.

- `verify.json`: `verifySite('zalando', {maxTier: 1, ...})` passed all three cases, A, B and held-out C. All answered at tier 1 without healing. `verify-current-gate.json` has zero errors and the current operation record at `2026-10-26T13:36:39.472Z`.
- `export-receipt.json` and `export.json`: export used `keepExamples: true`, with zero secrets and warnings. The example and both checks are public product routes.
- `fresh-initial-home.json`: separately empty absolute `fresh-home` directory before loading the export. No profile or session was copied.
- `fresh.json` and `fresh-comparison.json`: exported operation replayed held-out C at tier 1 in 1701 ms, without healing, exactly matching the independently derived five fields.
- `fresh-requests.json`: the one outgoing GET had neither Cookie nor Authorization header. No browser was launched for this phase.
- `vet.json`: direct `vetShared(export, callerAndMaintainerNotes)` returned `{ "errors": [], "warnings": [] }`.
- `resource-cleanup-summary.json`: saved spec bytes equal the vetted export, and saved notes bytes equal the vetted candidate notes. No post-vetting content changes were made to `sites/zalando.json` or `.md`.

## Resource observations and cleanup

All expensive local phases ran under `resource_gate.py`. Browser-free learning/replay/verification/export/vetting used the documented bounded 89% policy-memory admission and 90% stop, retaining 65% CPU admission and 85% stop. The browser captures retained default 88% admission. No admission was denied and no watchdog stop occurred.

Across 22 samples, peak CPU was **43.41%**, peak policy memory **89.06%**, and peak raw occupied RAM **99.69%**. Raw occupied RAM includes file-backed cache and exceeded 95%; do not claim raw RAM stayed below the user's ceiling. The configured policy excludes file-backed cache and stayed below its 90% stop. These sampled host measurements cannot guarantee transient peaks or constrain unrelated programs. Per-command receipts are `capture-{1,2,3}.gate.jsonl`, `learn.gate.jsonl`, `replay.gate.jsonl`, `verify.gate.jsonl`, `export.gate.jsonl`, `fresh.gate.jsonl` and `vet.gate.jsonl`.

All owned capture commands exited and closed their browsers. The mutex was absent at cleanup, and the process census found no remaining process using this batch's profile/path beyond the census shell itself. Isolated evidence homes remain for audit. No other worker's lock or process was touched.

Only the assigned site files and this report were saved outside ignored evidence. No shared state, runbook, catalog, source, dependencies, frozen sites or other worker output was edited. No nested agents, site writes, cookie import, commit, push, PR or publication occurred. No integrated checks were run by this worker.
