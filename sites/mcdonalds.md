Use the final segment of an existing US product URL without `.html`, such as `small-french-fries`. Preserve size prefixes. This operation reads the US national product page in its observed document language, with no restaurant selected.

`productId` is the page's identifier, distinct from the URL slug. `description` retains publisher prose, including any calorie sentence, meal suggestions and promotions. A calorie statement about the named item does not describe its suggested meal. Promotional price text does not establish a current restaurant price.

Detailed nutrients, complete ingredients, allergens, customized nutrition, availability and restaurant prices were not qualified. Descriptions can change and do not establish a current formulation date.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using the source HEAD recorded in the research report. Actual frontend GET documents were captured with the unchanged exact-document helper. Big Mac `cmvpdlgxc5e67cc:1` and Small Fries `cmvpdoim09b1967:1` each returned HTTP 200 and aborted all 49 other attempted requests. This is server-rendered document evidence; interactive nutrition controls and a fully hydrated GUI were not qualified.

Learning used `productSlug=big-mac` and `small-french-fries`, with no warnings. The learned request is GET `https://www.mcdonalds.com/us/en-us/product/{productSlug}.html`, matching the public document. Its HTML recipe reads the heading, canonical URL, document language, source product ID and description.

Held-out `productSlug=egg-mcmuffin` passed at tier 1 without healing. A separately fetched signed-out source document matched all five returned fields, including product ID `200298`, the 310-calorie sentence and Canadian bacon context. The linked meal remains publisher prose, not a qualified meal nutrition result.

Both current exported verification cases passed at tier 1. The exact export's first call from an initially empty separate home sent no Cookie or Authorization header; later verification reused only guest cookies issued by McDonald's. No account, private browser import or login was used. A preliminary verifier rejected those cookies locally before sending either request; its assertion was corrected and verification passed. Resource denials and that local helper failure are retained separately from successful receipts.

Exact commands, field boundaries, resource and cleanup receipts are in `docs/research/discovery/mcdonalds-coordinator-r2.md` and the original worker report. Raw captures, source documents and final receipts remain ignored under `bench/explore/state/discovery/mcdonalds-qualified-r1/`. No website write or publication occurred.
