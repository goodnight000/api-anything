# Wayfair retained-capture audit, round 3

2026-10-26 15:36 UTC. **ISSUES: current HTML recipe is incompatible with the retained documents.** No Wayfair registry files were saved. This audit supersedes the round-2 report's assumption that its proposed selectors could supply visible product data.

Workspace HEAD remained `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, branch `t3/reverse-engineer-high-leverage-apis`. All work in this continuation was offline. No new website requests, browser launches, private cookie imports, source changes or publication occurred.

## Learning and meaning

The previously running learning command completed. It used actual captures `cmvpem23baba3a2:1` and `cmvpemem0949983:1`, with network access disabled in its helper. Both requests are exact public Wayfair furniture detail URLs recorded in the round-2 report. The learned slots retain the product slug in the path and `piid` as the separate option parameter. Learning reported drift because the `body` item had none of the six expected fields. Public-example export and draft-notes vetting returned no findings, but those mechanical checks do not establish working extraction.

The capture audit explains the failed preview:

- Both responses are genuine HTTP 200 documents with no repository `botWall` finding. They have a generic Wayfair store title and no `h1` after `parseShown`.
- Raw HTML contains the correct Laguna and Pera product headings. Both headings have an ancestor `<div hidden id="S:1a">`. The current extractor intentionally removes that container. Product identity in raw text therefore does not establish the proposed visible HTML recipe.
- Both documents expose a JSON-LD `BreadcrumbList`, rather than a product object supplying the proposed fields. No alternative product recipe was learned.
- The second document's canonical link also contains affiliate/tracking parameters. That URL remains only in ignored evidence; it was neither requested nor copied into a registry file.

The earlier raw-source inspection used a parser that retained hidden content. Its product heading, dimensions and specifications were real source text, but their existence did not prove compatibility with the project's HTML extractor. No core behavior was changed to include hidden markup. The initial short audit described generic visible store content; the subsequent ancestry audit establishes that product content is present in hidden streaming markup, rather than absent from the response.

The attempted held-out-link scan returned no compatible furniture links. No third input was selected or requested. Unseen operation replay, independent held-out comparison, current-version verification and initially empty-home operation reuse remain unperformed. The candidate export and draft notes remain ignored and unqualified. Count zero additional sites or operations.

## Receipts and resources

Evidence is under `bench/explore/state/discovery/home-resale-qualified-r2/`:

- `parent-learn-r3.out` and `.resources`: completed offline learning, drift warning, clean draft vet and empty held-out-link scan.
- `capture-audit-r3.resources`: initial offline audit denied at 90.08% policy memory. Its process exited with 75.
- `capture-audit-r3-retry1.out` and `.resources`: admitted after an explicit 30-second wait, showing the visible-document field gap.
- `capture-audit-detail-r3.out` and `.resources`: exact request URLs, canonical links and bounded product-text contexts.
- `hidden-audit-r3.json`, `.out` and `.resources`: raw headings, hidden ancestor chains and JSON-LD types.
- `candidate-wayfair.json` and `offline-vet.json`: candidate artifacts, not registry proof.

Across this continuation's admitted offline commands, sampled CPU peaked at 44.55% and policy memory at 88.52%. The denied audit sample was 45.69% CPU and 90.08% policy memory. Raw occupied memory peaked at 99.67%, separately from the policy measure that excludes file-backed cache. The later hidden-markup audit admitted at 81.19% policy memory and 91.44% raw occupied memory; a fresh launch-only snapshot subsequently passed at 88.10% policy memory. These are samples, not a global or unsampled ceiling guarantee.

The inherited exec handle was no longer available on resumption. Its complete output and resource receipt were inspected instead, and process inspection found no remaining matching learning or capture process. Every newly launched audit process was observed to exit. No browser mutex was acquired by this continuation. The coordinator released its Wayfair claim after recording the extraction gap. Vinted remains a separate lead; this audit establishes no Vinted control or operation.
