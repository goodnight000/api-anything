# Classifieds source preparation, 2026-10-26

ISSUES overall. Gumtree passes remote source preparation only. Carousell is stopped after repeated remote retrieval errors. Neither site qualifies for registry addition. This batch owns this report and ignored evidence only; no `sites/` files were created or edited.

The shared branch is `t3/reverse-engineer-high-leverage-apis`, observed HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Existing untracked discovery files and site files were preserved. Read `AGENTS.md`, `docs/DESIGN.md`, `CONTRIBUTING.md`, `skills/api-anything/SKILL.md`, `bench/discovery/README.md`, and the current assignment in `state.json`. The state lists this batch as the owner of Carousell and Gumtree. No state, runbook or catalog edits were made.

## Official access screen

Bounded official-domain and broader searches did not establish a readily usable official consumer listing API or supported agent interface for either assigned site. This finding does not prove that no official API exists. Third-party scraping API results were not accepted as official access or invoked.

Carousell searches also returned `carousell.ai` and `carouseller.com`. Their affiliation and equivalent inventory were not established, so their API claims do not establish supported access to `carousell.sg`.

Gumtree's [official ShipStation announcement](https://www.gumtree.com/info/life/p/gumtree/press/gumtree-partners-shipstation-delivery/) describes seller delivery infrastructure. It does not document a public listing search/detail API. No demonstrated easy official overlap justified deprioritization in this bounded screen; supported access remains unresolved.

## Gumtree

PASS for source preparation. The [London bicycle results page](https://www.gumtree.com/for-sale/sports-leisure-travel/bicycles/uk/london) linked all three detail pages below, through links 22, 23 and 27 respectively. Remote text retrieval showed product facts without invoking contact, seller profile, delivery quote, payment or offer controls. Only city-level location is retained here.

| Role | Exact source input | Grounded meaning |
| --- | --- | --- |
| A | [kids-bikes / frog-55-kids-bike-purple / 1804023430](https://www.gumtree.com/p/kids-bikes/frog-55-kids-bike-purple/1804023430) | Frog 55 children's bicycle, purple, GBP90, good condition, London. Gears and brakes work; service recommended. |
| B | [hybrid-bikes / ridgeback-velocity-ladies-hybrid-bicycle-with-kryptonite-lock-step-through-frame- / 1803965714](https://www.gumtree.com/p/hybrid-bikes/ridgeback-velocity-ladies-hybrid-bicycle-with-kryptonite-lock-step-through-frame-/1803965714) | Ridgeback Velocity step-through hybrid, GBP75, fair condition, London. 24 gears and included lock. |
| Reserved third | [folding-bikes / blue-brompton-6-speed-2021-c-line / 1803924977](https://www.gumtree.com/p/folding-bikes/blue-brompton-6-speed-2021-c-line/1803924977) | Blue Brompton C Line, six speeds, GBP775, good condition, London. Recommended service parts are disclosed. |

A future candidate could answer `getListing(category, slug, adId)` with listing identity, category, asking price/currency, condition and product facts. This is an operation proposal, not a saved operation or established request template. The categories and identities differ across the two examples and reserved third. The third has not been used for learning or runtime tests.

Example A's first cached detail title showed GBP120; a subsequent remote retrieval and the index showed GBP90. Prices must be re-grounded at qualification time. Listing asking price excludes separately displayed buyer-protection and delivery charges. Condition and colour are listing-specific, potentially optional fields. Facts are seller assertions, not independently authenticated product condition. No complete search, stock, delivery coverage or availability claim follows from these pages.

The remote tool exposed no auth, challenge, rate restriction or repeated retrieval error on Gumtree. Origin HTTP status, request headers, guest cookies, local accessibility and frontend hydration remain unverified. Readable remote text does not establish that the current core can extract the document, or that exact-document capture is suitable.

## Carousell

BLOCKED for source completion. One [readable listing](https://www.carousell.sg/p/ikea-chair-1463252257/) establishes listing ID `1463252257`, IKEA chair, SGD17, lightly used, office/gaming-chair type, and the Furniture / Chairs category. The page is in the Singapore market; a listing-specific city was not established.

The initial [rattan-chair link](https://www.carousell.sg/p/ikea-rattan-chair-1458459937/) returned the remote tool error `Failed to fetch ...: (410) Gone`. One newer chair link then succeeded. Subsequent source-linked [TROTTEN desk](https://www.carousell.sg/p/ikea-trotten-desk-white-120x70cm-1460791446/) and [reserved study desk](https://www.carousell.sg/p/ikea-study-desk-1464373813/) links both returned `(410) Gone`. These two opens were already submitted in the same remote call before either error was observed. No Carousell request followed that result. Same-domain follow-ups should be sequential so a returned stop condition can prevent the next request.

Search-index text described the TROTTEN desk as white, 120x70cm, SGD60 and the reserved study desk as SGD40. These are stale-index leads, not readable current examples. The required differing readable pair and reserved readable third are missing. Do not treat remote 410 reports as independently measured origin responses or as evidence of an auth/challenge mechanism. Carousell remains stopped across transports for this batch.

## Missing qualification and provenance receipts

Capture IDs: none. Learned/saved operations: none. No fabricated exchanges or captures were made. No offline learning, candidate export, draft-notes `vetShared` preflight, unseen tier-1 meaning comparison, `verifySite({maxTier:1})`, exact public-example export, empty-home cookie-free first call, current operation/spec hash, final JSON-plus-notes vet, or integrated registry gate was run. Every one of those gates is still required before registry addition. No extractor gap has been proven because the core was not exercised.

The ignored evidence directory is `bench/explore/state/discovery/classifieds-source-prep-r1/`. `source-grounding.json` contains selected paraphrased observations, source URLs, source text line locations and exclusions. It retains no seller/profile/contact fields. It is not a raw response record or a browser capture.

A gated SHA-256 command for the required documents, unchanged capture helper and source-grounding record was denied twice with exit 75. Consequently full file provenance hashes are unavailable in this receipt; the source HEAD above is a Git identity, not a substitute for those hashes. `provenance-sha256.txt` and `provenance-sha256-resample1.txt` are empty denied-command outputs. Do not count them as hash receipts.

## Resources and cleanup

The assignment supplied an admitted launch-only snapshot at 16:37:58 UTC: CPU 9.51%, non-cache memory 87.67%, raw occupied memory 99.63%. This snapshot launched no child and authorized no workload at 95% memory.

Both hash attempts used `python3 bench/discovery/resource_gate.py --admit 88 --hard 90 -- shasum ...`, preserving CPU defaults of 65% admission and 85% stop. The initial denial at 16:42:26.969100 UTC measured CPU 35.82%, policy memory 89.20%, raw occupied 98.88%. After an explicit 30-second sleep with no site/browser requests, the sole resample at 16:43:15.168276 UTC measured CPU 18.61%, policy memory 90.00%, raw occupied 99.41% and was denied. No child launched. Receipts are `provenance-gate.log` and `provenance-gate-resample1.log`.

These are discrete samples, not continuous workload peaks or a global/unsampled cap guarantee. Across the supplied launch and denied-command samples, maxima were CPU 35.82%, non-cache memory 90.00%, raw occupied memory 99.63%. Remote service resource usage is unknown. No local browser/network command or expensive Node command ran. No additional remote source request followed the first local admission denial.

No browser, global mutex, child process or API Anything home was created. There is nothing owned to terminate or unlock. Only this report and its ignored evidence were written. No spec, dependency, source, helper, commit, push, PR or publication changes were made. Parent audit and any future integrated check remain separate.
