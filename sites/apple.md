# Apple US iPhone

`listProductFamilies(family)` lists the model-family tiles in the public US `iphone`, `ipad` or `mac` catalog. Use the returned URL as published. A tile can link to an overview or directly to specifications. For iPhone specs, obtain the single path segment from an actual `/specs/` link before calling `getTechSpecs`. Catalog links are not inventory or availability guarantees. The catalog can include associated families such as displays. Rows retain document order, including repeated responsive sections, so callers may deduplicate equal name/URL pairs. Other categories and layouts are unsupported.

`getTechSpecs(product)` reads an iPhone model-family specifications page. Copy `product` from a public Apple US `/specs/` link, such as `iphone-16`. Only iPhone pages using this layout were checked.

Arrays preserve the page's specification columns. A column can describe one model, both models, one display, or an open/closed device state. Read its text before assigning it to a variant. `models` can be empty on a single-family page. Units and footnote numbers remain in the publisher's text. Battery figures are advertised test claims, not measured runtime. No prices or stock are returned.

## Maintainer notes

Verified signed out on 2026-10-26 UTC. Two real browser GET-document captures were learned with `add --from/--from2`: `iphone-18-pro`, capture `cmvp3hk4s0a130f`, and `iphone-16`, capture `cmvp3hz3f395ae4`, request 1 in each. Source and request URLs are `https://www.apple.com/iphone-18-pro/specs/` and `https://www.apple.com/iphone-16/specs/`. Routes came from Apple's homepage, iPhone catalog, and model-page links.

The document-only helper aborted other requests. This proves server-rendered document content; a fully hydrated GUI was not checked. No login, imported browser state, UI actions, writes, or credential refs were used.

Unseen `product=iphone-duo` replayed at tier 1 and exactly matched all extracted fields from an independently fetched `https://www.apple.com/iphone-duo/specs/`, parsed separately with Python HTMLParser. The comparison checked identity, both displays, chip, open/closed dimensions, capacity, and battery text. These names and claims are the site's returned content as observed on the verification date.

`verifySite("apple", {maxTier: 1})` passed the example, two other model families, and a local invalid-path refusal. Export retained public examples. Fresh-home cookie-free tier-1 reuse and direct `vetShared` receipts are recorded in `docs/research/discovery/electronics-r1.md`. Raw evidence is ignored under `bench/explore/state/discovery/electronics-r1/`.

Original getTechSpecs qualification limitations: no category/search operation, numeric unit conversion, footnote resolution, other Apple product families, configurators, purchases, or account features were verified. Missing arrays are not proof that a specification is unavailable in other page layouts.

Catalog extension on 2026-10-27 UTC: `listProductFamilies` was learned from exact GET-document browser captures of `https://www.apple.com/iphone/` and `https://www.apple.com/ipad/`, request 1 in captures `cmvr0caugf6b9f7` and `cmvr0cm03ef4d08`. These URLs and the held-out `https://www.apple.com/mac/` came from retained public Apple navigation. Only server-rendered documents were captured; other browser requests were aborted. No hydrated GUI, imported private state, login or writes were used. The recipe covers the two observed tile layouts. Independent held-out meaning checks, isolated first-call header evidence, exact-export verification, resource receipts and artifact hashes are in `docs/research/discovery/apple-catalog-qualified-r1.md`. The complete pre-existing `getTechSpecs` operation and its four cases are preserved.
