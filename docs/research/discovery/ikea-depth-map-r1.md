# IKEA US English depth map, round 1

Status: **SOURCE-ONLY; no new operation qualified.** Research date: 2026-10-27 UTC
(remote inspection clock receipt: 00:45:47 UTC). Prioritize category browsing and public
store lookup next. Search needs frontend evidence; do not repeat the known empty search
HTML request as if it supplied results.

## Scope and retained evidence

Read `bench/discovery/README.md` and `state.json` before site research. The runbook SHA-256
matches the assigned `4a52052d2f19d03efda45af808b2db4349e8bf4845e7ba55db046d893a96eeaa`.
No IKEA host stop was recorded. This worker relied on the parent's admitted lightweight
launch; it did not treat that admission as permission for local workloads.

The existing [spec](../../../sites/ikea.json) provides `getProduct(slug)` only. Its SHA-256
is `5371188542347ec395e727f937a53ad1642161bbc332241a573ea72e63441cde`.
The [caller notes](../../../sites/ikea.md) and [prior receipt](retail-weather-r1.md)
establish US English product metadata and national online USD prices, without store/ZIP
selection. Their existing product captures were reused as historical context, not rerun.
No product detail page was reopened. Store inventory and delivery eligibility remain outside
that operation. The historical homepage supplied a GET search form with action
`https://www.ikea.com/us/en/search/`, input `q`; the recorded
`https://www.ikea.com/us/en/search/?q=chair` HTML had no product rows.

Remote capability was available: `mcp__codex_apps__search_service_web_run`, using search,
open, click and find against public sources. These are reader/index observations, not a
browser session, origin-status receipt, raw-document capture or proof of signed-out tier-1
behavior. No credentials were supplied. Footer membership links and offer labels were
incidental public text, not an encountered authentication requirement.

## Official-interface check

Bounded searches for IKEA official public product APIs/developer documentation returned
consumer pages, documents and engineering job listings, rather than a usable supported
consumer API contract. No official API was established; this does not prove none exists.
The official [store directory](https://www.ikea.com/us/en/stores/) already supplies public
navigation without a location search, and the category pages below already supply product
discovery. Prefer those established interfaces to reconstructing a private endpoint.

## 1. Category product browsing — first priority

**Usefulness and distinction:** discover products from a department before knowing a product
slug. This returns a collection and navigation, unlike the existing single-product read.
Treat filters and continuation as capabilities of this workflow, not duplicate field-only
operations.

**Grounded A/B:**

- A: `https://www.ikea.com/us/en/cat/bookcases-10382/`, found in official search results and
  opened remotely. Reader lines 10–25 and 203–205 show 133 items, an initial 24-result slice,
  a BILLY white bookcase at $79.00, and a continuation control.
- B: `https://www.ikea.com/us/en/cat/cube-storage-55012/`, reached through A's related-category
  link labeled Cube storage. Lines 9–27 and 201–203 show 89 items, an initial 24-result slice,
  and a KALLAX white shelf unit at $79.99. Different category identity and leading product
  make useful future argument-effect checks.

**Observed fields and limits:** product-name links, descriptive text with color/dimensions,
displayed price, reviews, variant links and comparison inputs. A exposes special in-store
and member price labels: preserve price context rather than flattening every amount into a
national price. Both sources expose sorting headings and a Show more control. A also links
color-specific shelves. Sort choices, filter form names, accepted values, continuation
payloads, total-page limits and ordering guarantees were not observed. No filter or page
parameter has been established. The partial list is not the complete catalog.

**Reserved C:** `https://www.ikea.com/us/en/cat/wall-shelves-10398/`. A's related categories
contain a Wall shelves anchor; an official indexed result separately supplies this literal
URL. No open/click of that category was made. The index returned a content excerpt, so C is
reserved for an unseen frontend capture/replay, not claimed to be unseen source text. The
reader did not expose the anchor's literal target; the association with the indexed URL
still needs capture-time confirmation. The ID was taken from an actual result href, not
constructed from a label.

**SSR versus interactive:** readable rows make an initial document recipe plausible. Remote
reader output cannot prove those rows exist in an ordinary guest response. Continuation and
sort/filter behavior likely need an interactive capture because controls, rather than a
confirmed next-document href, were exposed. An indexed legacy shelving URL contains
`page=10`, and another indexed wall-shelf URL contains `page=2`; neither was opened or tested.
Those are historical URL observations, not evidence that a page argument currently works.

**Missing gates:** actual A/B frontend captures; raw markup/embedded-data inspection; stable
row and product-href extraction; independent identity comparison; controlled evidence for
each filter and continuation argument. Later pages must show changed product identities,
not just a changed count or URL. Reserve C until the final recipe is ready, then apply the
common qualification gates below. Initial-slice browsing may qualify separately if further
pagination cannot be proved, with its limit explicit.

## 2. Public store lookup — first priority

**Usefulness and distinction:** plan a store visit by finding locations, addresses and hours.
Product detail cannot answer this. The natural split is a directory read and a selected-store
detail read, with hours, services and visit instructions kept together rather than wrapped
as separate operations.

**Observed navigation:** `https://www.ikea.com/us/en/stores/` groups named location links by
state and sometimes metro area, and labels different location types. It separately lists
pickup facilities. Many pickup entries share one generic link, so do not manufacture a
unique store ID for every displayed pickup name. No distance ordering, ZIP input, geolocation
request, server-side state filter or pagination was observed. A directory operation can be
argument-free; California and Florida are row-group checks, not evidence of a state argument.

**Grounded A/B store detail:** both targets were followed from actual directory anchors.

- A: `https://www.ikea.com/us/en/stores/houston/` — 7810 Katy Freeway, Houston, TX 77024.
  Store hours distinguish Monday–Saturday 10 AM–9 PM from Sunday 10 AM–8 PM.
- B: `https://www.ikea.com/us/en/stores/orlando/` — 4092 Eastgate Dr, Orlando, FL 32839.
  Store hours show Monday–Sunday 11 AM–8 PM. Childcare hours are variable rather than a
  fixed schedule. These differences can detect a request that silently returns A for B.

Both public sources contain department hours, holiday closures and exceptions, a map link,
and pickup/service sections. Keep department and exception scope; do not infer a time zone,
open-now value or product availability from these texts. Some service links lead to booking,
check-in or queue actions; none was followed or performed. Public text does not establish
that restaurant menus or store-event listings are independently reusable workflows yet.

**Reserved C:** `https://www.ikea.com/us/en/stores/emeryville/`. The directory contains its
named anchor; an official indexed result supplies the literal href. No open/click of C
detail occurred. Search returned indexed detail text, so reserve C for independent frontend
and replay evidence, not an unseen-text claim. For an argument-free directory read there is
no distinct third request argument; use C's link membership as a directory check, and C's
detail only for the selected-store workflow.

**SSR versus interactive:** directory and A/B detail are document-shaped and readable through
the remote source tool. A guest document recipe is plausible for names, links, addresses and
hours; unproven until the real frontend response is captured. There is no reason from this
evidence to require a browser-driven ZIP search for the directory itself.

**Missing gates:** capture directory and A/B store documents; confirm literal hrefs and how
store identity is carried; extract location type separately from name; distinguish pickup
facilities from stores; verify hours and exceptions against visible source sections. Then
use unopened C and the common qualification gates. No ZIP, coordinates or inventory input
should be added without observing its public UI and request effect.

## 3. Free-text product search — defer to frontend evidence

**Usefulness and distinction:** find products by a user's phrase across departments without
requiring a category or product slug. The retained form grounds `q`, not a response recipe.

**A/B readiness:** historical A is `q=chair`, with a submitted URL but no HTML product rows.
Prospective B is `q=bookcase`, grounded by the public category vocabulary above but not
submitted in this round. Two differing successful result examples have not been grounded.
Do not relabel category rows as search responses.

**Reserved C:** novel free text `narrow bamboo shoe bench`; not submitted or opened. Its
results or lack of results are unknown. A free-text input needs no fabricated product ID.

**Observed fields/limits:** only the historical GET form action and query-input name are
established. Product result fields, page size, filters, sort values, pagination and query
length limits remain unknown. No query-length bound or endpoint template is proposed.

**SSR versus interactive:** the prior empty initial HTML is affirmative evidence against
claiming an already-understood SSR search recipe. Likely next step is a separately admitted
interactive frontend capture with its own bounded stop monitoring; the exact-document helper
that aborts other requests cannot establish a client-loaded search result exchange. No search
URL was requested again in this round.

**Missing gates:** successful public A/B results and their real request/response traffic;
proof that changing `q` changes result meaning; extraction and genuine empty-results behavior;
only then C and the common gates. A challenge, auth requirement or rate limit ends work
across IKEA aliases/routes/transports; it is not permission to try another search transport.

## Common qualification gates and handoff

All proposed additions still need resource admission appropriate to the actual next workload,
real frontend captures, two differing examples where applicable, credential-safe learning,
independent meaning checks, candidate offline shared-vet preflight, heldout tier-1 replay
where supported, exact-final-spec verification, first-call reuse from an initially empty home
for each new operation, export/final vet, and the coordinator's integrated registry check.
Reverify the existing read if the site export changes. Record exact hashes, request URLs,
tiers, limits and whether later guest cookies were issued. Source-reader success supplies
none of those runtime proofs. No speculative backend URL or transport recipe is recorded.

No new auth/rate/challenge/repeated-error stop was observed; new stop scope: **none**.
No local network commands, browser, capture, learning, replay, export or vet ran. No nested
agents, persistent local processes or locks were created. Short-lived local file-read/hash
commands exited. The only file this worker wrote is this report; shared state, site specs,
caller notes, helpers, source, dependencies and publication were left untouched.
