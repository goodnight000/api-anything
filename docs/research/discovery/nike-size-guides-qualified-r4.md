# Nike size-guide qualification r4

2026-10-27 UTC. Added one public read, `getSizeGuide(guide)`, from the parent's genuine saved A/B frontend document captures. The worker qualified the exact final export and notes, including the reserved unseen women's bra guide, and installed only the assigned Nike files. Parent independent audit, integrated registry/lint/type checks and counting remain pending.

The first required read began at `2026-10-27T14:16:50Z`. The first state-file path attempted was absent; the actual `bench/discovery/state.json` was then located and inspected before any website work. Full hostStops and aliases were retained privately and checked across keys and values for Nike. No Nike stop was present. Each workload rechecked current stops and the unchanged registry baselines before launching. No unexpected concurrent edit was found. One exclusive Nike owner worked without nesting, browser launches or changes to shared state.

## Workflow and scope

`getSizeGuide` sends the stored GET template `https://www.nike.com/size-fit/{guide}`. The bounded argument format is `[a-z0-9-]{1,80}`, copied from official US navigation. This is a path format, not a claim that every syntactically valid guide exists or uses this layout. The public example is `mens-footwear`; checks use `womens-footwear` and a locally rejected empty argument. Unknown-guide and empty-result semantics were not inferred or tested.

The embedded recipe selects the first object whose `containerType` is `size_chart`, then retains `title`, `description` and `sizeCharts`. It does not extract through a changing card ID. Each table retains its complete original `data` row arrays and `measurements` metadata, including null. The first cell labels a row. Later positions align across rows. Blank cells remain objects without `value`, with no collapse or inferred zero. Cell keys and row `system` remain intact. This is one table workflow, not row/field wrappers.

Only the first chart card is selected, including all tables inside that card. Other cards and the rest of the guide are outside scope. Runtime output is capped near 20,000 characters, and truncated output cannot be treated as a complete aligned table. Actual complete extracted sizes were 14,114 characters for A, 14,150 for B and 1,190 for C. There is no pagination, interactive bra size finder, exercised unit toggle, conversion formula, fit recommendation, stock or size-availability claim. CM / JP is box-label sizing, distinct from measured foot length.

## Genuine learning evidence

The parent supplied source GETs and genuine exact-GET document captures under ignored `bench/explore/state/discovery/coordinator-nike-size-guides-recovery-r58/`. The worker read the capture handoff, both source receipts and both capture command, output, resource and exit files. Parent source/capture/helper files and older r1/r2/r3 artifacts were not changed.

- A: `https://www.nike.com/size-fit/mens-footwear`, capture `cmvqrnf054bac0d`, document 1, 38 exchanges, 37 aborted. File SHA-256 `60a38d5749abc23e0e42ae3f50631928afdb34035e4dfbfb7f39c2ec4a40ac16`. Document body SHA-256 `6057b121c648439bdac7a0faf070b6acf388fbd49e7f901dffcfc96c32e25d36`.
- B: `https://www.nike.com/size-fit/womens-footwear`, capture `cmvqrnxmdf16591`, document 1, 39 exchanges, 38 aborted. File SHA-256 `b2ee3d9b4a3d96bf1752d571e4017cb3481353632cd973d837c7d7ee1b0cb0a1`. Document body SHA-256 `5e4e5ff8582377aa774c54ea0c47f0b42d1f0d04c3a6e8b6c54d61b7265a6abe`.

Each capture had exactly one nonaborted response, the requested GET document, HTTP 200, with SSR chart markup and `__NEXT_DATA__`. A links to B in the actual source. Both source GETs and A's captured document had no Cookie or Authorization. B's captured document carried guest cookies from the parent's isolated public profile and no Authorization. B is not cookieless. These are genuine frontend document captures, not hydrated GUI proof.

The worker created an initially empty separate learning home, recorded the listing, copied both capture files byte-for-byte, and proved their supplied hashes and copy equality. No parent session/profile was copied. Paired CLI `add` used `--from`, `--from2`, `--pick-request 1`, differing guide examples and the embedded recipe. It returned zero warnings and minTier 1. No captures were fabricated or repeated.

A has eight embedded rows with 38 size columns; B has eight with 39. Their leading rows are US - Men and US - Women respectively, and their blank positions differ. A has 30 blank kids cells. B has 28 blank kids cells and 11 blank cells in each measured-foot-length row. Every retained object and position equals the saved embedded data. Independent SSR comparisons matched all 273 default displayed cells including row labels in A, and all 280 in B.

Default SSR displays seven rows, including imperial foot length. The eighth metric row is grounded in actual embedded data and its `foot_length_cm` / METRIC toggle metadata. It was not observed after a GUI toggle. The initial offline comparator wrongly assumed all eight embedded rows were in default SSR and exited 1. Its correction matched displayed rows by label and explicitly recorded the metric row's evidence layer. No recipe or final export changed for that correction.

## Exact-final preflight, unseen C and cold call

The first admitted preflight found only that additive notes exceeded `vetShared`'s 8,192-byte limit. Caller/maintainer additions were shortened while retaining all baseline notes. At `14:20:26.811Z`, the final JSON and final notes passed the proper scan and export checks with zero secrets/warnings and `vetShared` with zero errors/warnings. This preceded any C request.

The scan used `credentialsOf(besideOrigins(loadSession('nike'), [site.baseUrl, ...site.operations.flatMap(opUrls)]))`, followed by `scanSecrets([jsonText, notes], credentials)`. Export secrets/warnings were checked separately. Full preflight results and exact hashes are in private `preflight.json`.

Reserved C remained `https://www.nike.com/size-fit/womens-bras`; it was not swapped or searched. Its first opening was an admitted source GET at `14:20:48.252Z`, HTTP 200, with only declared User-Agent/Accept and no Cookie/Authorization. Body SHA-256 `6a6485892477a363b91b5ce217f983f13bc5137d7614ad4660ac36e6a53dc248`. This is independent HTTP source evidence, not a C frontend capture.

C has two chart cards. The declared first-card recipe returns the first, titled `XXS – 4X`, with Alpha Size and Band/Cup Size rows, 11 aligned size columns, empty description and null measurements. All 24 cells including labels match the SSR table after ordinary display-whitespace normalization. The title equals its SSR caption. Embedded keys and multiline cell values are retained literally, including anomalous source text; no correction or sizing recommendation was invented. The second Alpha/Cup Size card, with 30 size columns, is excluded by the explicit first-card scope established before opening C. C therefore supports that bounded workflow, not a promise to return every bra chart or calculate measurements.

A separate cold home was created and its empty pre-load listing and absolute runtime path recorded in `cold-before-load.json`. Only exact final JSON/notes were loaded; no session, profile or cookies were imported. Its first actual call was `getSizeGuide({guide: 'womens-bras'})`, HTTP 200, tier 1, no healing and no truncation. The returned title, description, null measurements, every cell key/value and every position equal the independently grounded source. Cold response body SHA-256 `ab8379f73e317532faea97ebe4dba86b58d5f96ca34b7ce4352cf51d3820c821`; chart data are equal despite differing whole-document bytes.

The actual Undici request record has header names accept, upgrade-insecure-requests, user-agent, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform, accept-language, sec-fetch-mode and accept-encoding. Cookie and Authorization are absent in both the fetch-boundary and transport request records. Private receipts contain names/presence only, not credential values.

## All-read verification and final identity

The real `verifySite` runner with maxTier 1 passed all 13 current-version cases at `14:22:33.390Z`: three listProducts cases, three getProduct cases, four searchProducts cases and three getSizeGuide cases. There were 11 actual HTTP 200 GETs and two local empty-input refusals. No healing occurred. The complete per-case arguments, outcomes, exact opHashes and request status/body hashes are retained. All 11 later GETs carried only guest cookies issued to that cold home, with Authorization absent in both fetch and actual transport records. This is distinct from the cookieless first call.

Current A/B tier-1 chart data match every saved capture cell and measurement field. Their different chart hashes prove an argument effect, not merely two nonempty 200 responses. No full-body-byte equality was claimed. Current A body SHA-256 `1da9ba5009174d54a4de6012af49a977d79356f638df06c3995acef3f61a5533`; B body SHA-256 `f35a30f56b1a5182dab7724bbe6703d72c5ec7fc1e6c27e47646d6a04d942ba7`.

The three complete baseline operation objects, metadata and checks are deeply equal after export. Their old and final opHashes remain `45286cf0c36c26ef` for listProducts, `1541c1727896f614` for getProduct and `158cca443da8dcdc` for searchProducts. New getSizeGuide opHash is `55a54e9f05155a0f`. Site-level metadata were preserved.

Final installed JSON SHA-256 is `5c525f7d957b4f74db234b4694bdad5c28cc8782ddeab4e1722e3d56ab81b466`. Final notes SHA-256 is `7a91d8bada5d3c6ec6fb6cab72b2c35d9861e4809da8b8551885805dc73df4cb`. Both learning and cold loaded specs equal this final export, and each home's export is byte-identical to installed JSON. Final scans used each home's actual session and the proper origin-aware credentials. Both JSON-plus-notes scans, export secrets/warnings and final vet have zero issues. No hash-changing edit followed qualification.

## Resources, receipts and cleanup

All expensive/offline/source commands used unchanged resource_gate.py with explicit memory admission/stop 88/90 and unchanged CPU admission/stop 65/85. The browser-free cold call and all-read verify used 89/90. Sampling remains approximately every two seconds and does not establish a global cap. No browser or global mutex was acquired by this worker; the parent's released capture mutexes remain separate evidence.

The initial preflight was denied before launch at `14:19:23.885913Z`, CPU 22.89%, policy memory 88.20%, true exit 75. The one batch resample followed more than 30 seconds without Nike/browser requests and was admitted at `14:20:09.924910Z`, CPU 25.75%, policy memory 85.98%. That admitted command returned 1 for note length, not an origin failure. The corrected preflight passed. One resample was used across the entire batch; success did not reset the count. The offline SSR comparator's true exit 1 is also retained. All source/cold/verify/final-check commands passed; no website auth, rate, challenge or repeated-origin error was observed. No transport switching or access bypass occurred.

Private evidence is `bench/explore/state/discovery/nike-size-guides-qualified-r4/`. Command `.command.json`, `.out`, `.resources` and `.exit` files retain exact argv, actual exits and samples. Key receipts are capture-integrity.json, semantic-comparisons.json, preflight.json, source-c.json, cold-before-load.json, cold-proof.json, cold-requests.json, verify-proof.json, verify-requests.json and final-check.json. Raw HTML, embedded data and capture copies remain ignored. The manifest records full file hashes and sizes, and cleanup records ownership. No raw responses or credential values were added to tracked files.

All owned commands exited. No browser, worker child or lock remains owned, and no process was signalled. Isolated homes and their public guest sessions are retained as ignored audit evidence. Only sites/nike.json, sites/nike.md, this report and the assigned ignored directory were written. Shared state/coverage, frozen publication sites/manifest, other site files, source, dependencies and shared helpers were untouched. No commits, pushes, PRs, publication, website writes, login or private-cookie import occurred. Parent integrated checks and counting remain pending.
