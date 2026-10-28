# Zalando official UCP access screen

2026-10-26 UTC. **ISSUES** for research preparation. Zalando's UCP participation is confirmed by official announcements. Anonymous catalog availability, a Zalando-specific service address and independent-client access remain **unknown**. No readily usable official consumer API was established, and no runtime was invoked.

## Scope and evidence

Read `AGENTS.md`, `bench/discovery/README.md`, the discovery index, `fashion-source-prep-r2.md`, and relevant current `bench/discovery/state.json` entries. State assigns this report to the Zalando official-access screen and preserves the earlier product-price ambiguity. The coordinator owns state/catalog changes and local resource admission.

All web research used remote `tools.mcp__codex_apps__search_service_web_run`. Only this report was written. No local browser, local network command, API replay, login, cookie import, site/account write, nested agent, source/dependency/shared-state change, commit or publication occurred. No raw evidence was saved. Lightweight reads and this document write provide no CPU/memory peak guarantee.

All external sources below were returned on **2026-10-26**. **Fetched primary document** means the remote tool opened official publisher content. It can be cached or transformed and is not an origin-status receipt, signed-out browser session or capture. **Indexed lead** means search output only. **Inference** and **unverified route** are identified explicitly. No third-party implementation was used as behavior evidence.

## Announcement versus available service

- **Fetched primary document:** Zalando's [12 March 2026 results announcement](https://corporate.zalando.com/en/investor-relations/zalando-full-year-2025-results) calls Zalando a European UCP launch partner and describes building discovery/purchase through assistants such as Gemini. It supplies no catalog service address, client registration instructions, anonymous-access commitment or UK coverage contract.
- **Fetched primary document:** Zalando's [20 July 2026 loyalty discussion](https://corporate.zalando.com/en/technology/loyalty-age-ai-how-zalando-plus-becoming-part-customers-everyday-lives) still describes external-agent interoperability as preparation and ambition. It discusses personalized Zalando Assistant/Plus experiences, without documenting an independent public catalog integration. This supports participation, not a conclusion that UCP is unavailable or production-ready.
- **Fetched primary document:** Google's [19 March 2026 UCP update](https://blog.google/products-and-platforms/products/shopping/ucp-updates/) announces optional catalog access covering selected product details, variants, inventory and pricing. Adopters choose their capabilities. Therefore Zalando's participation does not prove it implements Catalog Search or Lookup, or exposes them to arbitrary clients.

Bounded official-domain searches for Zalando UCP catalog/developer documentation returned the announcements and unrelated results, but no Zalando-specific access contract. This is a limited negative screen, not proof of absence. No indexed-only result established an additional usable integration. The newer loyalty article was opened before relying on it.

## Documented integration and authentication

The **fetched primary** [UCP Catalog REST specification](https://ucp.dev/specification/shopping/catalog/rest/) documents business-profile discovery at `/.well-known/ucp`, advertised services/capabilities and catalog search/lookup operations. Its examples identify protocol version `2026-08-25`. These are generic protocol instructions. No Zalando profile URL was supplied by the inspected retailer pages; no host/path combination was constructed or probed.

The same REST document lists OAuth client credentials or delegated-user authorization, business-issued API keys, and HTTP message signatures as authentication options. Individual authentication headers being marked optional does not grant anonymous access to a particular business. It also requires an agent profile header and request tracing identifier. This screen obtained no Zalando platform-registration procedure, credentials, trust relationship or permission to use the catalog.

The **fetched primary** [Merchant Center onboarding guide](https://support.google.com/merchants/answer/16992327), linked by Google's announcement, requires technical implementation, an interest form and selection before onboarding/sandbox access. It describes gradual US rollout, with Australia and Canada to follow. These are merchant steps for Google experiences, not instructions for an independent client to read Zalando's catalog. They establish neither UK support nor a global UCP geographic restriction. No form, account or sandbox was opened.

The **fetched primary** [UCP getting-started guide](https://ucp.dev/specification/getting-started/) teaches building a sample checkout server. It is not a Zalando connection recipe. Nothing was installed or run.

## Overlapping questions and field meaning

The **fetched primary** [Catalog model](https://ucp.dev/latest/specification/shopping/catalog/) separates products from purchasable variants. It documents IDs, titles/descriptions, product price ranges, variant selling prices, optional list prices, options such as colour/size, optional SKUs and availability. Price amounts use currency minor units with an explicit currency code. User-authenticated catalog scopes cover personalized results, member pricing and gated inventory.

**Inference:** this model could answer much of the proposed frontend work if Zalando supports it and grants access. No populated Zalando response or mapping was observed. A protocol product/variant ID cannot yet be equated with the displayed Zalando article number. Brand mapping, exact displayed colour, UK assortment, offer labels and freshness remain unproved. A product-wide price range or featured variant must not be presented as a selected-size offer.

The **fetched primary** [Catalog Search specification](https://ucp.dev/specification/shopping/catalog/search/) supports text queries, filters and cursor pagination, subject to implementation-specific input rules. Categories must come from responses, merchant documentation or an applicable taxonomy. Price-filter interpretation depends on currency context and may be ignored when ambiguous. These are documented protocol possibilities, not captured Zalando search inputs. No query, category value, cursor or product ID was invented or submitted.

Useful later questions are which article/colour a product represents, how two colourways differ, and which localized advertised offer belongs to each item. Broader search and size-specific availability should wait for actual supported fields or frontend evidence.

## Grounded continuation and missing proof

Keep frontend qualification conditional. If Zalando publishes supported client access answering these questions, prefer it and deprioritize overlapping frontend discovery. This screen found no such usable contract. Browser work remains potentially useful for displayed article, brand, colour and offer associations, subject to fresh parent-owned admission and ordinary stop rules.

The following are **unverified continuation routes in this screen**, carried from the prior report's remotely opened retailer pages. They were not reopened or captured here:

- Learning A: [black Samba](https://www.zalando.co.uk/adidas-originals-samba-og-unisex-trainers-core-black-ad115o1o3-q11.html).
- Learning B: [white/cardboard Samba](https://www.zalando.co.uk/adidas-originals-samba-unisex-trainers-whitecardboard-ad115o1pp-a12.html).
- Reserve for unseen comparison: [carbon Handball Spezial](https://www.zalando.co.uk/adidas-originals-handball-spezial-unisex-trainers-carboncarbongum-ad115p09y-q11.html), previously linked from black Samba recommendations.

The earlier white/cardboard price varied between remote views. Do not reuse any amount as current truth. Re-establish article/colour identity and offer labels together; sizes were unchosen. See [the prior source report](fashion-source-prep-r2.md) for that evidence and its limits.

Still missing: Zalando-specific capability advertisement, access entitlement/authentication policy, documented UK coverage, real response/field mappings and any runtime availability evidence. For a frontend spec, genuine capture, two examples, unseen semantic tier-1 replay, `verify`, fresh empty-home cookie-free reuse, export and `vetShared` all remain required. No `sites/` file or reusable operation resulted.

No fetched documentation response exposed an actual authentication wall, challenge, HTTP 403 or HTTP 429. Authentication requirements and error codes printed in protocol documentation are descriptions, not observed access-control responses. This says nothing about retailer runtime access. Stop the affected domain immediately if a later request exposes controls; do not switch routes, hosts or transports to work around them.
