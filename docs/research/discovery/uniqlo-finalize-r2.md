# UNIQLO qualification continuation r2

Status: **PASS**. One reusable public read operation was saved as `sites/uniqlo.json`
with caller and maintainer notes in `sites/uniqlo.md`. The unseen tier-1 semantic
comparison, three-case verification, current-version verification gate, public-example
export, initially empty-home cookie-free reuse, and direct saved-spec-plus-notes
`vetShared` all passed. Integrated repository checks remain with the coordinator.

Date: 2026-10-26 UTC. Admitted execution ran from 11:14:06 through final saved-file
vetting at 11:17:19; cleanup was recorded at 11:17:41. The complete continuation,
including initial review, stayed within its 20-minute batch. Branch was
`t3/reverse-engineer-high-leverage-apis`, HEAD
`f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. The checkout already contained unrelated
untracked discovery work, which was preserved.

Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md,
bench/discovery/README.md, the document-capture helper, existing registry/state/report
entries, home-apparel-source-prep-r1.md and home-apparel-qualified-r1.md. Reviewed the
prior unexecuted source-audit, replay, verify-export, fresh and resource-wrapper
scripts. Continuation scripts were written only in this batch's ignored evidence
directory. The source comparison was strengthened to assert every displayed ID and
all returned field semantics, rather than just a nonempty result or the first ID.

## Operation and field meanings

`uniqlo.getProduct(routeProductId, routeSuffix)` reads a public Denmark English
product document. Both required inputs preserve actual product-link path components:

- `routeProductId`, string matching `E[0-9]{6}-[0-9]{3}`.
- `routeSuffix`, two-digit string, including leading zeroes. Preserve the suffix from
  the same actual link. The source names it `priceGroup`; no independent meaning for
  arbitrary combinations, price amount, selected color or size was established.

The returned fields are `name`, `routeProductId`, `routeSuffix`,
`displayedProductIds`, `composition`, `care` and `gender`. The route fields come from
embedded `productId` and `priceGroup` and were compared to the actual route.
`displayedProductIds` preserves the full embedded `l1Ids` array; it is not substituted
with digits from the route. Composition and care are source text. Gender is the
source category label. No price, selected variant, availability or delivery claim
is made. Search, catalog coverage, pagination and other storefronts were not qualified.

## Reused genuine capture evidence

No new browser capture was needed or performed. The terminal preceding batch's
captures were re-read without modification:

| Example arguments | Exact captured GET URL | Capture / document | Result |
|---|---|---|---|
| `E489013-000`, `00` | `https://www.uniqlo.com/dk/en/products/E489013-000/00` | `cmvp5inuvb11ebe` / 1 | DRY-EX T-Shirt; displayed ID `489013` |
| `E422992-000`, `02` | `https://www.uniqlo.com/dk/en/products/E422992-000/02` | `cmvp5j75n11a298` / 1 | Crew Neck T-Shirt; displayed IDs `461556`, `455360` |

Both actual captured documents have HTTP 200. They contain 46/47 exchanges with
45/46 aborted, respectively. The prior exact-GET-only helper allowed the requested
document and aborted other requests; inline scripts could execute. This proves
frontend document capture, not a fully hydrated GUI or working variant controls.
Offline audit found exactly one embedded-product recipe match in each document.

Capture SHA-256 values are
`d248202e8176eb566289573fd1e7f3cc249052e617558a73d93eaa30ef586370` and
`d942e1fd4e2ce75300eb6b2d309cd2f14457714bcbc42ae245d74ca7145df30b`.
Their files remain under
`bench/explore/state/discovery/home-apparel-qualified-r1/uniqlo-home/captures/`.
The earlier learner result and candidate were reused; they were not reconstructed
from HTTP source reads. Local path slots remain `path:3` and `path:4`, with GET
matcher `www.uniqlo.com`, `/dk/en/products/*/*`, `minTier: 1`.

## Independent held-out comparison

Before the first unseen replay, the saved actual source document
`home-apparel-qualified-r1/uniqlo-heldout-source.html` was audited offline. Its
original request was
`https://www.uniqlo.com/dk/en/products/E465185-000/00?colorDisplayCode=39`, HTTP 200
at 11:07:48.922 UTC in the preceding batch. Its SHA-256 is
`a64f2068201adaeaf7bf9b412829538c6f6796119a0f1fd4b3dfce24621ed6d8`.
This remains independent source evidence, not a browser capture.

The canonical link asserted the exact query-free route
`https://www.uniqlo.com/dk/en/products/E465185-000/00`. Visible main-heading and
paragraph markup, read independently of the embedded-product recipe, established:

- AIRism Cotton Oversized Crew Neck T-Shirt.
- All displayed IDs, in source order: `489927`, `493232`, `482295`, `475355`, `465185`.
- `53% Cotton, 30% Polyester - Recycled Fiber, 17% Elastomultiester`.
- `Machine wash up to 40 degrees, gentle cycle, Dry Clean, Not suitable for tumble-drying.`

The document title identifies Unisex. The unseen call used
`routeProductId=E465185-000`, `routeSuffix=00`, `maxTier: 1`. It returned `ok`, tier 1,
without healing at 11:15:28.133 UTC. Every returned field matched the independently
recorded expectation, with gender compared ignoring title capitalization. Its name
differed from both learning examples. No behavior of `colorDisplayCode` was inferred.
The markup comparison does not compute stylesheet visibility or prove hydrated UI.

## Verification, export and reuse

`verifySite('uniqlo', {maxTier: 1, ...})` passed all three routes at tier 1 without
healing: example `E489013-000/00`, check 1 `E422992-000/02`, and check 2
`E465185-000/00`. The local current operation hash and stored record hash both were
`d006477e75cc29c6`; the verification gate returned no errors immediately before export.

`exportSite('uniqlo', {keepExamples: true})` retained the public examples and returned
zero secrets and warnings. The export intentionally replaces captured request values
with parameter placeholders, so its operation hash differs from the verified local
template. No post-verification behavioral edits were made. Exact saved JSON SHA-256:
`d9ec5eebc3e6e5772b9429abc83c5b5d98b4ee23d02872d49aa57c3e4382d8ad`.

The exported spec was installed into a separately recorded initially empty
`fresh-home`. One tier-1 held-out call sent neither Cookie nor Authorization and
returned exactly the same data. No browser profile was created. The qualification
home had copied only the previous candidate and guest session, retaining the latter
for the export's exact live-value scan. Its four replay/verify requests sent guest
cookies; the separate fresh-home request proves no such cookie dependency for this
operation. No private browser cookies were imported.

All five network requests in this continuation were exact product-document GETs,
HTTP 200 and classified `ok`. A batch fetch guard refused unqualified URLs/methods
and would stop further traffic on auth, challenge, 429, redirect or repeated error.
No stop condition occurred. Lowe's was neither touched nor requested and remains
stopped after its prior first-GET 403.

Direct `vetShared` returned `{errors: [], warnings: []}` first on the export, then
on the schema-parsed saved JSON plus final notes. One initial finalization command
failed offline before executing because the helper imported `siteSchema` instead
of the repository's `SiteSchema`. The corrected admitted command passed; both logs
are retained. This error sent no request and wrote no spec.

## Evidence, resources and cleanup

Absolute private evidence base:
`/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/uniqlo-finalize-r2/`.

The absolute isolated homes are `qual-home/` and `fresh-home/` beneath it.
Key receipts are `start.json`, `source-audit.json`, `audit.json`, `unseen.json`,
`unseen-comparison.json`, `verify.json`, `current-hash.json`, `export.json`,
`qualified-uniqlo.json`, `fresh-initial.json`, `fresh.json`, `vet-spec.json`,
`vet-saved.json`, `network.jsonl`, `resources-summary.json` and `cleanup.json`.
Each invoked offline/tier-1 command has command, stdout, exit and resource logs.

Every expensive/offline/network execution used `resource_gate.py`, memory admission
89%, stop 90%, CPU admission 65%, stop 85%, under the authorized bounded browser-free
exception. Nine retained samples peak at CPU **27.38%** and gate-defined memory
**88.75%**. No admission denial, wait or watchdog termination occurred. Raw occupied
RAM separately peaked at **99.64%**. The runbook metric excludes file-backed cache
but retains anonymous inactive and compressed memory. These samples do not guarantee
host-wide raw RAM or unsampled transients stayed below 95%.

No browser was started and no browser mutex was acquired. Cleanup found no owned
long-running process, no browser mutex, no fresh-home profile and no domain-stop
record. No unrelated process was stopped. No nested work, source/dependency edits,
shared state/runbook/catalog edits, commits, push, PR, publication, login or site
write occurred. Only UNIQLO JSON/notes, this report and this batch's ignored evidence
were written. Integrated checks are explicitly left to the parent.
