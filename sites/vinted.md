Reads metadata for a known public item on the US Vinted site. Pass the complete path segment after `/items/`, including the numeric item ID and descriptive slug; omit query parameters.

The result is a one-item list. `pageTitle` includes the site's `| Vinted` suffix. `description` is the document's search/social summary and may repeat the title, be shortened, or be absent. It does not establish condition, availability, price, shipping, seller identity, or a complete listing description. Sold or removed items may stop returning usable metadata. Other regional domains are untested.

## Maintainer notes

Verified signed out on 2026-10-26 UTC. Two genuine exact-document frontend captures were learned offline. Only the requested GET document was allowed; other requests were aborted. This does not establish a fully hydrated GUI. Canonical item links came from the actual responses to exact homepage item anchors, whose original queries were preserved privately. No tracking values are stored here.

Source pages and request URLs: https://www.vinted.com/ and https://www.vinted.com/items/{slug}. Capture IDs, exact checked inputs, heldout comparisons, public export, fresh-home first-request headers, current verification hashes, and provenance receipts are recorded in docs/research/discovery/vinted-qualified-r4.md. No private browser session was imported.
