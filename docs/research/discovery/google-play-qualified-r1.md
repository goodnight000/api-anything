# Google Play qualified r1

Coordinator validation: current repository `opHash` records, exact exported-spec equality
and direct saved-file vetting passed at 11:59:29 UTC. The refreshed integrated all-bundled
registry test passed at 12:00:53 UTC, one test selected and zero skipped. Receipts are
`audit-google-play-export.json` and `integrated-20261026T1200-r1.out` under the ignored
discovery evidence root. No additional live website requests were needed for these checks.

Outcome: **PASS**. Saved one proven public read, `google-play.getApp(packageId)`, in `sites/google-play.json` and caller/maintainer notes in `sites/google-play.md`. Two genuine frontend document captures, independently grounded held-out tier-1 replay, current tier-1 verification, public export, empty-home cookie-free reuse and direct shared vetting all passed. Integrated repository checks remain the coordinator's responsibility.

Work date was 2026-10-26 UTC. Source/capture/qualification commands ran from 11:39:38 through 11:50:13, within the 20-minute batch. Shared dirty branch `t3/reverse-engineer-high-leverage-apis`, HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`. Read AGENTS.md, docs/DESIGN.md, CONTRIBUTING.md, skills/api-anything/SKILL.md, bench/discovery/README.md, the unchanged document helper and resource gate, existing registry/state and app-catalog-source-prep-r1.md. No nested agents were created.

## Operation and meaning

`getApp(packageId)` is an anonymous GET of `https://play.google.com/store/apps/details?id={packageId}`. Its only learned slot is `query:id`. The stable matcher is GET, host `play.google.com`, path `/store/apps/details`. It learned at tier 1 without warnings, volatile values, credential refs or a Cookie header. Package IDs must be dotted identifiers without URL/query syntax. The source is the server-rendered HTML document, with a compact HTML selector recipe; no internal RPC endpoint was guessed.

Returned fields and their meaning:

- `packageId` is read from the response's canonical app link, independently of the supplied argument. `listingUrl` is that canonical link, including the language value actually returned.
- `name`, `developer`, `developerUrl`, `category`, and `categoryUrl` are the app title, displayed developer name and its Play catalog link, and the displayed category and category link. A displayed developer name is not a verified legal identity.
- `headerRatingDisplay` is the header's spoken rounded score label, such as "Rated 4.0 stars out of five stars". `headerReviewsDisplay` is its adjacent rounded label, such as "2.01M reviews". Both selectors are scoped to the app's `Information badges` region. Neither is an exact rating count or proof of a global/device population.
- `contentRating` is the age/content label. `updatedOnDisplay` preserves the listing's displayed update date without timezone or installed-version inference. `localeDisplay` is the footer's country/language context.

Only the English layout and three public Android listings were qualified. No price/currency, OS requirements, device eligibility, downloads, install/purchase, developer-console data, reviewer identities/text or app-description copying is included. Play Developer APIs were already screened as permissioned publisher tools in the source-preparation report, not an anonymous consumer catalog path. No developer-console request occurred. Google Search/Trends and all other assigned/frozen platforms were untouched.

## Real frontend captures

Before launching a browser, a gated cookie-free GET of the exact VLC source page returned HTTP 200 and exposed the title, developer/category links, header badge grouping, footer context, canonical link and SoftwareApplication JSON-LD. The HTML recipe was understood from that actual source before using the narrow document-capture admission exception.

- VLC: `https://play.google.com/store/apps/details?id=org.videolan.vlc`, capture `cmvp6rs4966a64d`, request 1, HTTP 200. Final URL equaled the requested URL. The helper recorded 54 exchanges and aborted 53. Extracted `org.videolan.vlc`, VLC for Android, Videolabs, Video Players & Editors, Everyone, update Oct 14, 2026. Header showed 4.0 and 2.01M reviews.
- To Do: `https://play.google.com/store/apps/details?hl=en&id=com.microsoft.todos`, capture `cmvp6s2jxc934ad`, request 1, HTTP 200. Final URL equaled the requested URL. The helper recorded 45 exchanges and aborted 44. Extracted `com.microsoft.todos`, Microsoft To Do: Lists & Tasks, Microsoft Corporation, Productivity, Everyone, update Oct 22, 2026. Header showed 4.6 and 484K reviews.

Both were real browser document requests through unchanged `bench/discovery/capture-document.mjs`, under the atomic global browser mutex, watchdog, exact-GET interception and 15-second document timeout. Every other request was aborted. Inline scripts could execute. This proves server-rendered document content, not a fully hydrated GUI. No raw HTTP response was fabricated into a capture. No everyday-browser cookies or private login were imported. The second request carried a guest cookie from the first visit, which was removed by learning and independently excluded by fresh-home reuse.

Captures are retained in the ignored absolute home `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/google-play-qualified-r1/home/captures/`. `learn.json`, `vlc-extracted.json`, `todo-extracted.json`, and `scope-evidence.json` record the learned operation and compact public field evidence without needing to reopen the site.

## Rating and locale boundaries

VLC's separate ratings panel showed 4.1 and 1.86M reviews; To Do's panel showed 4.6 and 465K reviews. These differ from their app-header badges. The source establishes separate DOM groups, and the recipe deliberately returns the paired header labels only. The panel's device controls were not exercised; the population behind either aggregate remains unproved. No exact rating count was derived from rounded review wording, and no fields combine the two groups.

Both captured footers showed `United States (English (United States))`. VLC's canonical link used `hl=en_US`; To Do's used `hl=en`. The earlier remote To Do source had appeared to have a different region. No locale query parameter was invented, added or learned. The stored request has no language/country parameter. The operation returns the observed footer and canonical-link context and makes no future fixed-US or global claim.

## Unseen comparison

The VLC capture contains a real anchor `/store/apps/details?id=org.scratchjr.android` with ScratchJr and Scratch Foundation in its app-card text. `third-link-grounding.json` ties that exact link to capture `cmvp6rs4966a64d`, request 1. No package ID or endpoint was invented.

A separate signed-out, cookie-free GET of that linked page returned HTTP 200. Python's standard HTMLParser independently parsed its canonical identity, title, displayed developer link, category, paired header labels, content rating, update date and footer. Identity and meaning were cross-checked against the page's SoftwareApplication JSON-LD: title and author agreed; the category-link code equaled its applicationCategory; the header's rounded score was consistent with aggregateRating.ratingValue. No reviewer material or description was included in the comparison output.

Unseen tier-1 replay returned `org.scratchjr.android`, ScratchJr, Scratch Foundation, Education, "Rated 3.9 stars out of five stars", "39.3K reviews", Everyone, Nov 26, 2023, and the US/English footer. All 12 returned fields exactly matched the independently parsed source, including both developer/category links and canonical listing URL. `replay.json` records tier 1, no healing, 347 ms; `replay-comparison.json` records all field comparisons true. Independent evidence is `third-source-meta.json`, `third-expected.json`, and `third-ground-r1.out`; the raw source is ignored.

## Verification, export and fresh reuse

All paths below are relative to ignored `bench/explore/state/discovery/google-play-qualified-r1/`.

- `verify.json` and `home/checks/google-play.json`: `verifySite("google-play", {maxTier: 1, timeoutMs: 15000})` passed the VLC example, To Do check, held-out ScratchJr check and local `invalid/path` refusal. Three result cases were tier 1; invalid input sent no request. No healing occurred.
- `export.json` and `export-receipt.json`: `exportSite("google-play", {keepExamples: true})` retained public examples and reported zero secrets and warnings. The exported JSON is the saved site file byte for byte.
- `fresh-initial-home.json`: absolute home `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/google-play-qualified-r1/fresh-getApp` was initially empty, with `entries: []`. Only the exported spec was copied in before calling its single operation.
- `fresh.json`, `fresh-requests.json`, and `fresh-comparison.json`: the first fresh-home ScratchJr request was GET, with neither Cookie nor Authorization header. It succeeded at tier 1 in 338 ms, without healing, and matched all 12 independent expected fields.
- `verify-export.json`, `verify-export-current-gate.json`, and `fresh-getApp/checks/google-play.json`: repeated the four cases against the exact exported operation. All passed without healing, and the current-version verification gate had zero errors at `2026-10-26T11:49:39.058Z`. Result timings were 352, 917 and 915 ms, plus a 0 ms local input refusal.
- `vet.json` and `vet-saved.json`: direct `vetShared` on the exported candidate plus notes, then on the exact saved site files, returned `errors: []` and `warnings: []` each. These were completed before claiming a reusable registry operation. No integrated registry/unit test was run by this worker.

Saved SHA-256 values:

- `sites/google-play.json`: `4fa81198e438230d509dbbe6bbceb314a59eeb9da0bbe01bcfd6e752a08d16ca`, 3945 bytes.
- `sites/google-play.md`: `4a83929275abd4d53f5dee4bcc9152dd60457bf3cac9ca513e642ac9845ee00d`, 3960 bytes.

## Resources, stops and cleanup

Every network/browser or expensive Node command used the unchanged resource gate with CPU admission 65%, CPU stop 85%, memory admission 89% and hard stop 90%. Browser commands used the understood-source document-only exception; no full or unknown interactive browser was launched. Tier-1 verification was browser-free and bounded to 15 seconds per call. `resource-summary.json` summarizes 31 samples and the individual `*.gate.log` receipts retain the underlying evidence.

Sampled peaks during admitted work were CPU 46.20% and policy memory 89.34%. Across admission checks as well, CPU peaked at 76.52% and policy memory at 90.60%; those high samples denied commands before they ran. Raw occupied RAM, reported separately by the gate and including reclaimable file-backed cache, peaked at 99.72% during admitted work and 99.74% across all samples. Thus the policy metric stayed below the user's 95% ceiling in observed samples; these samples cannot guarantee transient system-wide peaks, and raw occupied RAM was above 95%.

Six command attempts were denied before sending any site request: initial VLC capture, initial held-out source fetch, three verification attempts, and initial exported-version verification. Each retried command waited at least 30 seconds before resampling, with no site/browser request during its wait. Verification used its three permitted resamples and then passed on the final one after memory fell to 84.76%. No thresholds were raised and no watchdog stopped an admitted command.

No authentication gate, challenge, HTTP 403/429 or repeated site error was observed. All actual requested app documents answered HTTP 200. No host/route/transport switch was used to evade controls. Runtime qualification used a fetch wrapper that prevents further network calls if a control is observed.

Both browser commands exited normally and ran `closeBrowser` in the helper's finally block. Their owned mutex tokens were removed only after the owned commands exited. Final inspection found no browser mutex and no Chrome/helper process for this batch. All owned command sessions finished; raw evidence and isolated homes were retained, ignored. Nothing unrelated was killed or removed.

Only this report and `sites/google-play.json` plus `.md` were added to tracked-file candidates. No src/dependency, shared state/runbook/catalog, other site's file, commit, push, PR or publication changed. No authentication, install, purchase or review action occurred. The coordinator can integrate the three files and run the repository-wide checks.
