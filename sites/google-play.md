# Google Play app listings

`getApp(packageId)` reads a public Android app listing. Copy the dotted package ID from a Google Play app link. Only the English listing layout was checked. The operation requests no fixed language or country. `localeDisplay` reports the response footer's context; results are not guaranteed to describe the US or a global catalog.

`developer` is the displayed publisher name and `developerUrl` is its Play catalog link, not a verified legal identity. `headerRatingDisplay` and `headerReviewsDisplay` are the paired app-header information badges. Review counts retain the site's rounded display labels. They are not exact rating counts. The separate ratings panel can show another score and count under its device controls; those are not combined with these badges. No device population or global aggregate scope is established.

`contentRating` is the listing's age/content label, not compatibility. `updatedOnDisplay` preserves the displayed date without inferring a timezone or installed version. Missing fields can reflect another layout. Install/free labels do not establish price, currency, device eligibility or OS requirements. No reviewer data, descriptions, install, purchase, login or review action is returned or performed.

## Maintainer notes

Verified signed out on 2026-10-26 UTC. Genuine browser GET-document captures were learned with `addOperation` from `org.videolan.vlc`, capture `cmvp6rs4966a64d`, and `com.microsoft.todos`, capture `cmvp6s2jxc934ad`. Request 1 was selected in each. Exact source/request URLs were `https://play.google.com/store/apps/details?id=org.videolan.vlc` and `https://play.google.com/store/apps/details?hl=en&id=com.microsoft.todos`. The learned request varies only `query:id`; match is GET, play.google.com, /store/apps/details. Learning reported zero warnings and tier 1.

The unchanged experimental document helper aborted every request except the exact requested GET document, under the shared browser mutex and a resource watchdog with a 15-second document timeout. Inline scripts could execute. This establishes server-rendered content, not a fully hydrated GUI. No private browser state or login was imported. The second capture carried the guest cookie created by the first visit; the exported request contains no Cookie header or credential refs. An initially empty isolated home separately proved cookie-free tier-1 reuse.

Both captured footers showed United States and English, with VLC canonical language en_US and To Do en. The earlier remote To Do evidence had a different apparent regional context. No locale parameter was invented or added to the request. These observations do not fix future locale.

VLC's paired header badges showed 4.0 and 2.01M reviews, while its separate panel showed 4.1 and 1.86M reviews. To Do's header showed 4.6 and 484K reviews and its panel 4.6 and 465K. The recipe reads only the app information badges. These display labels do not prove an exact count or a shared device population.

Held-out `org.scratchjr.android` came from an actual app link in the VLC capture, not a guessed package ID. Tier-1 replay matched all 12 returned fields against a separate cookie-free source fetch parsed independently with Python HTMLParser. Identity and category were also checked against the page's JSON-LD. Expected ScratchJr, Scratch Foundation, Education, 3.9 stars, 39.3K reviews, Everyone, and the displayed update date Nov 26, 2023.

`verifySite` with `maxTier: 1` passed the example, both other public identities and a local invalid-path refusal. Export retained public examples. Fresh-home replay and direct `vetShared` passed. Exact receipts, limits and resource samples are recorded in `docs/research/discovery/google-play-qualified-r1.md`; ignored evidence is under `bench/explore/state/discovery/google-play-qualified-r1/`. The coordinator owns integrated checks. These checks establish three public listings, not catalog-wide coverage.
