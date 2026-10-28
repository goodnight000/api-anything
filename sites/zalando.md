Use `getProduct(productPath)` with the complete path segment of an actual Zalando UK product link, without its leading slash or `.html`. Preserve the slug and article suffix together.

`articleId` is the displayed article number and JSON-LD product-group identifier, not a selected-size SKU. `schemaColour` is the document's structured colour metadata. It can include extra components compared with the selected colour label, for example `carbon/carbon/gum/anthracite` versus `carbon/carbon/gum`. The product name retains its own shorter wording.

This returns public UK document metadata. It does not select a size or return prices, inventory, delivery promises or checkout totals. No login is required in the checked examples.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using an initially empty isolated home. Genuine browser document captures used `bench/discovery/capture-document.mjs`, which allowed only the exact requested GET document and aborted other requests. This proves server-rendered document content, not a fully hydrated GUI.

Learning pair:

- `adidas-originals-samba-og-unisex-trainers-core-black-ad115o1o3-q11`, capture `cmvpaqy4re1ffaa`, document request 1, displayed article `AD115O1O3-Q11`.
- `adidas-originals-samba-unisex-trainers-whitecardboard-ad115o1pp-a12`, capture `cmvparjlm5a9573`, document request 1, displayed article `AD115O1PP-A12`.

The held-out `adidas-originals-handball-spezial-unisex-trainers-carboncarbongum-ad115p09y-q11` was captured separately as `cmvpasbead23d44`, document request 1. The source and request URLs are `https://www.zalando.co.uk/<productPath>.html`. A Python parser independently read its heading name/brand, article-number detail, canonical link and title colour without using JSON-LD or the operation extraction. Unseen tier-1 replay matched all five fields, including article `AD115P09Y-Q11`.

The response recipe reads the first JSON-LD array item and picks only identity metadata. The article equals that item's `productGroupID`; nested `hasVariant[].sku` refers to size variants and is excluded. `schemaColour` agrees with the document title, while the selected colour text can be shorter. No price association or currency contract is claimed; earlier remote offer amounts conflicted. No control response was observed during this qualification.

Tier-1 verification covered both captured articles and the held-out article. Export kept the public example. A separately empty home reused the export at tier 1 without Cookie or Authorization headers. Direct `vetShared` passed with zero errors and warnings. Exact capture, comparison, verification, fresh-home and vet receipts are under ignored `bench/explore/state/discovery/zalando-qualified-r2/`. The qualification report is `docs/research/discovery/zalando-qualified-r2.md`.

Official UCP participation was screened separately in `docs/research/discovery/zalando-official-screen-r1.md`; it established no anonymous retailer service, UK entitlement or independent-client access contract. No UCP endpoint was guessed or tested.
