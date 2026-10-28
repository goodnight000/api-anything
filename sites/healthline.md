# Healthline news bibliography

Use `getNewsMetadata` with the final slug copied from an existing public `https://www.healthline.com/health-news/` link. It covers news article pages, not arbitrary Healthline routes. No login is needed.

These are bibliographic publisher labels. `creditedReviewer` comes from schema.org `reviewedBy`; on the checked pages the visible credit says "Fact checked by", so it does not establish medical review. Dates are the publisher's structured publication, modification and review labels. Equal timestamps do not prove separate review or update events. The title can differ from the browser-tab title. No article body, summary, clinical advice or treatment recommendation is returned.

Search, pagination, other sections and absent/private articles are unqualified. Copy known links rather than constructing slugs. Stop if a call reports auth, a challenge or rate limiting.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using an isolated home and real requested-GET document captures. The unchanged experimental `bench/discovery/capture-document.mjs` aborted every other request under the global atomic browser mutex and resource watchdog. Inline scripts may run. This proves server-rendered documents, not a fully hydrated GUI.

Operation `getNewsMetadata(slug)` requests `GET https://www.healthline.com/health-news/{slug}` and picks bibliographic fields from the document's NewsArticle JSON-LD. The match names GET, www.healthline.com and /health-news/*; the learned param is path segment 1. No cookie/session refs, public-key exemptions, volatile anchors or write steps are needed.

Captured example A: `physical-activity-may-improve-mood-and-quality-of-life-during-menopause`, capture `cmvpat2738091c7`, document 1. Captured example B: `ultra-processed-food-intake-linked-to-higher-dementia-stroke-risk`, capture `cmvpatm7p4e811a`, document 1. Both were grounded in actual root/news navigation links. They return different titles, URLs and date labels. Their authors and fact checker happen to be the same.

Unseen slug `pistachios-may-support-sleep-review-finds` answered at tier 1 without healing. An independent cookie-free document supplied its visible heading, canonical link and byline before replay. The returned identity, author Andrea Rice, fact checker Jill Seladi-Schulman, Ph.D., and 2026-10-19 calendar date matched. Time-of-day and separate modification/review events are only publisher labels.

Current `verifySite` with `maxTier:1` passed all three article cases, including the independently grounded held-out article. Export retained public examples, stripped learned shape, and reported no secrets or warnings. The exported operation also answered the unseen slug from an initially empty, cookie-free home. A response can set guest cookies for later calls. Direct `vetShared` on the exported file and these notes returned zero errors and zero warnings. Evidence is in ignored `bench/explore/state/discovery/health-sources-r1/`; the research report records exact paths and resource limits.

Bounded official-source search found no readily usable documented API/feed, which does not prove absence. The root exposed a search control but no form action or grounded search route, so no search endpoint was guessed. Mayo Clinic's root separately returned a 403 Access Denied page and that domain was stopped.

The coordinator verified the final exported version and repeated first-call cookie-free reuse in separate initially empty homes. Current-version and exact-export audit receipts are under ignored `bench/explore/state/discovery/healthline-coordinator-finalize-r2/`.
