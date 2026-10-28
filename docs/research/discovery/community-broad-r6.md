# Meetup and Houzz discovery, community-broad-r6

Status: **Meetup PASS; Houzz ISSUES**. One qualified site with one operation is saved for parent audit. Nothing was published. Houzz has no registry files.

## Scope and baseline

Work ran on 2026-10-26 UTC, source HEAD `f5bcd5b99716fde0c910cbdf63d02f63e9a722fd`, shared dirty branch `t3/reverse-engineer-high-leverage-apis`. Read `AGENTS.md`, all of `docs/DESIGN.md`, `CONTRIBUTING.md`, `skills/api-anything/SKILL.md`, `bench/discovery/README.md`, relevant current state, the r3/r4/r5 reports and the unexecuted r5 audit draft. The first substantive command was the required offline actual-body audit of retained Meetup capture A. No website/browser traffic preceded that audit.

Only `sites/meetup.json`, `sites/meetup.md`, this report and ignored r6 evidence were added. Parent-owned state, catalog, runbook and integrated checks were not changed or run. No source/dependency/helper changes, site writes, everyday-browser imports, login, bypass, nested delegation, commits, pushes, PRs or publication occurred. All prior dirty work and historical evidence were preserved.

Ignored evidence root is `bench/explore/state/discovery/community-broad-r6/`. The absolute isolated learning/capture home is `/Users/charleszheng/.t3/worktrees/api-anything-oss/t3-09f40733/bench/explore/state/discovery/community-broad-r6/home`. Fresh reuse used a separate initially empty absolute `.../community-broad-r6/fresh-home`.

## Meetup PASS

Saved operation `eventSchedule(namespace, eventId) -> title, start, schedule` reads one public event's advertised title and local scheduled time. Namespace and event ID must be copied together from an event URL. The examples changed both route components, proving the pair, not independent acceptance of arbitrary namespace/event-ID combinations. `start` retains the page's UTC offset; `schedule` is its human-readable local-time wording. There is no search, list-completeness, attendance, organizer, profile, address, contact, recurrence, cancellation or event-occurrence claim.

The official Meetup GraphQL guide retained in r3 documents authenticated event-data overlap. This anonymous document summary is a narrow convenience for public URLs, not a claim that official event APIs are absent or that a complete supported-access inventory was performed.

The exact source URLs, including the preserved homepage query, are:

- A: `https://www.meetup.com/ananda-yoga-and-guided-meditation/events/317020116/?eventOrigin=home_logged_out_near_location`
- B: `https://www.meetup.com/vibe-code-la/events/316840610/?eventOrigin=home_logged_out_near_location`
- C: `https://www.meetup.com/la2jp-los-angeles-japan/events/316886756/?eventOrigin=home_logged_out_near_location`

All three paths came from retained r3 `https://www.meetup.com/` source. A was reused without recapture. B and C received fresh HTTP source reads, with no Cookie or Authorization and immediate actual-body inspection. These source reads were never represented as frontend captures.

| Case | Exact inputs | Meaning confirmed |
|---|---|---|
| A, example | `namespace=ananda-yoga-and-guided-meditation eventId=317020116` | `Ananda Yoga for Relaxation`, start `2026-11-05T17:30:00-08:00`, Thursday Nov 5, 5:30 PM to 7:00 PM PST |
| B, differing example/check | `namespace=vibe-code-la eventId=316840610` | `Vibe Code LA Meetup Event`, start `2026-10-26T18:00:00-07:00`, Monday Oct 26, 6:00 PM to 8:00 PM PDT |
| C, unseen heldout | `namespace=la2jp-los-angeles-japan eventId=316886756` | `Halloween Social | ハロウィン Night in West LA!🎃`, start `2026-10-30T19:00:00-07:00`, Friday Oct 30, 7:00 PM to 10:00 PM PDT |

A's retained genuine capture is `cmvplqezm1e5e14:1`, historical capture time `18:40:21.346Z`. At `19:12:09.579Z`, the first r6 audit read its actual 97,446-byte body. `botWall=null`, `signInForm=false`, `loginPath=false`, zero shown password inputs, and unchanged `parseShown` plus `judge` returned all three desired fields with class `ok`. It had 53 exchanges, 52 aborted and one answered document. The capture hash remained unchanged. The r5 draft was copied into r6 before running; its output path was later parameterized for B. Historical r4/r5 files were not edited.

B's new genuine capture is `cmvpmw7icd6ec99:1`, time `19:12:51.204Z`, 54 exchanges, 53 aborted, 10,110 ms. Its immediate independent body audit at `19:13:20.667Z` also returned all fields, no detected challenge/auth form/login path and class `ok`. The unchanged exact-document helper was run with its 15-second bound and an owned atomic global browser mutex. This proves document capture only; inline scripts could run while other requests were aborted. No fully hydrated GUI claim is made.

Qualification receipts relative to r6:

| Gate | Receipt | Result |
|---|---|---|
| Offline two-capture learning | `learn.out`, `preflight.json` | A+B, no network allowed by injected fetch, minTier 1, zero add warnings |
| Candidate export + draft notes preflight | `preflight.json`, `meetup.candidate.json`, `meetup.draft.md` | Export secrets 0, warnings 0; `vetShared` errors 0, warnings 0 |
| Independently grounded C | `meetup-event-c.json`, `heldout.json` | Fresh source title/start/schedule equals all three tier-1 result fields; homepage listing `2026-10-31T02:00:00Z` independently agrees with start. C was absent from learning/check examples |
| `verifySite(maxTier:1)` | `verify.json`, `home/checks/meetup.json` | A example and B check both pass at tier 1, no heal |
| Initially empty home reuse | `fresh.json` | Empty home asserted before spec install; first call A matched captured meaning at tier 1, no Cookie or Authorization. First response issued guest cookies. Subsequent A+B verification used only those site-issued guest cookies and both passed at tier 1 |
| Exact final export + final saved JSON/notes vet | `final-meetup.json` | Export byte-identical to qualified candidate; current verification record matches op hash; proof gate has no errors; exact saved JSON and notes `vetShared` errors 0, warnings 0 |

Current/exported operation hash is `7ecbd4c60b67ee9f`. Final JSON SHA-256 is `9247bd3c696fb1aabac4f23a62a4294053acbb8e9da9189761b9ce08f5977e74`; notes SHA-256 is `15b7624e5e3a698358484e614f631742a48a49ab55d8294571ac995843204099`. No subsequent change was made to either file. HTTP200 alone was never used as qualification. Fresh/heldout fetch wrappers inspected actual bodies before returning them to the core, with a refusal latch for actual controls/errors, and logged cookie/auth presence as booleans only.

## Houzz ISSUES, stopped with no registry addition

The gated offline retained-source audit confirmed that the kitchen category is not a useful photo-list proof: `Loading photos`, 123 skeleton elements, and only navigation/category links were found. No photo-list candidate was saved. The retained Houzz Pro authentication documentation is company-scoped and does not establish public editorial coverage; no exhaustive absence-of-API claim follows.

The retained homepage also supplies ordinary topical magazine links. A gated source-link extraction saved exact leads in `houzz-story-leads.json`. The tested alternative was `articlePreview(story) -> title, summary, url`, a headline/editorial-subtitle/canonical-link preview for deciding what design article to read. It does not claim article text, photos, products, professionals, authors or contact data. Exact grounded inputs and URLs are:

- A: `story=how-to-create-a-calm-and-relaxing-bedroom-stsetivw-vs~63077166`, `https://www.houzz.com/magazine/how-to-create-a-calm-and-relaxing-bedroom-stsetivw-vs~63077166`
- B: `story=what-to-consider-when-choosing-a-bathroom-vanity-stsetivw-vs~165712705`, `https://www.houzz.com/magazine/what-to-consider-when-choosing-a-bathroom-vanity-stsetivw-vs~165712705`
- C: `story=10-cozy-patio-upgrades-to-warm-up-your-fall-evenings-stsetivw-vs~185863500`, `https://www.houzz.com/magazine/10-cozy-patio-upgrades-to-warm-up-your-fall-evenings-stsetivw-vs~185863500`

Fresh source A/B/C HTTP reads each returned ordinary HTTP200 article source, with no Cookie or Authorization sent and no observed challenge/auth form. Source A had headline `How to Create a Calm and Relaxing Bedroom` and subtitle `Find out how to set the scene for a good night’s sleep`. Source B had a distinct bathroom-vanity headline/subtitle. Source C had `10 Cozy Patio Upgrades to Warm Up Your Fall Evenings` and subtitle `Create an inviting outdoor space after dark with these ideas for adding ambiance, comfort and entertainment`.

Genuine document captures A `cmvpn1hdo8160d4:1` and B `cmvpn22w69edddf:1` completed under separate owned global mutexes and fresh 89/90 gates using the unchanged 15-second helper. A had 35 exchanges/34 aborted, 3,183 ms. B had 34/33 aborted, 2,208 ms. Each actual-body audit completed before further traffic and found all three metadata fields with unchanged core extraction, no detected challenge/auth form/login path and no shown password inputs. There is no hydrated-GUI claim.

Offline two-capture learning and candidate export/draft-note preflight completed. `houzz-preflight.json` reports minTier 1, op hash `1401ccda28b1cadd`, no add/export warnings or secrets, and `vetShared` zero errors/warnings. This was only a candidate in ignored evidence, not a registry addition.

**Live qualification failed.** `houzz-heldout.resources` records an admitted C call that ended with local `Heldout mismatch`. The helper threw before saving its normal result/request receipt. Then `houzz-verify.resources` records an admitted verification command; `home/checks/houzz.json` preserves two failing tier-1 cases, both `drift`, with `selector "html" matched 1 items but none of their fields (title, summary, url)`. The core reports no useful rescan and refuses recapture at maxTier 1. The operation has no volatile entries, so that rescan returned without source/bundle requests. The runtime's normal missing-data/example retries could run inside these calls.

Execution deviation: verification should not have launched after the heldout mismatch. It was launched before the mismatch was inspected. Once the repeated extraction failure was inspected, all Houzz website/browser traffic stopped. No transport switching, new site request, fresh-home attempt or recapture followed. The wrapper would latch detected auth/challenge/rate/error signals, but it did not latch `drift`. The failure path also lost the in-memory per-request observations and full heldout answer because the exception preceded receipt persistence. Therefore exact failed-request count/status/body hashes and the heldout result are **unknown**, not reconstructed. No actual access control is established by these errors; retain Houzz as stopped after repeated qualification error, without relabeling it an access-blocked domain.

A subsequent **offline-only** gated audit, `houzz-offline-failure-audit.json`, rebuilt the candidate request for A/B/C and confirmed each URL exactly equals the grounded source URL. The same candidate recipe judged each retained A/B/C HTTP source body `ok` with all three fields. Thus a global core inability to extract these fields is **not proved**. The live tier-1/body/session/header discrepancy remains unresolved. The browser/source proof cannot substitute for failed live qualification, and no extractor was weakened or hidden raw HTML treated as shown text.

Houzz's independent unseen tier-1 meaning comparison **did not pass**. Verification **failed 2/2**. Initially empty-home cookie-free reuse and final exact saved export/notes vet are **missing**. No `sites/houzz.json` or `sites/houzz.md` was created. The candidate op hash is not qualified and must not be integrated or published.

## Resources and cleanup

Every substantive offline/source/browser/verification command had its own fresh gate. General work used `--admit 88 --hard 90`; only bounded tier-1 qualification and understood exact-document helper captures used 89/90. CPU admission/stop remained 65/85. The parent's prior two snapshots and launch-only snapshot admitted no worker workload. No workload used 95% hard memory.

One Houzz source launch was denied, CPU 78.39%, at `19:15:30.048508Z`, before child execution. An explicit 31-second sleep issued no own site/browser requests. Resample 1 at `19:16:11.036916Z` passed, **40.988408 seconds** after denial. One of three permitted resamples was used; no self-respawn occurred. All later gates were fresh, not reuse of that admission.

Across admitted-workload samples, observed host peaks were CPU **58.25%**, policy non-cache memory **87.90%**, raw occupied memory **99.80%**. Across all samples CPU peaked at **78.39%**, while memory/raw peaks were unchanged. Raw occupancy is separate from policy memory. These are sampled host measurements, not a global cap, a per-process peak, or proof excluding unsampled spikes.

| Resource receipt | UTC admission | CPU % | Policy memory % | Raw occupied % | Child admission |
|---|---|---:|---:|---:|---|
| `audit-capture.resources` | 19:12:09.478164 | 18.29 | 87.15 | 99.68 | yes |
| `meetup-event-b.resources` | 19:12:30.457814 | 29.01 | 87.06 | 99.69 | yes |
| `meetup-capture-b.resources` | 19:12:40.948046 | 37.49 | 85.04 | 98.47 | yes |
| `audit-b.resources` | 19:13:20.563622 | 30.87 | 83.90 | 97.86 | yes |
| `learn.resources` | 19:13:40.782444 | 37.74 | 82.58 | 95.88 | yes |
| `meetup-event-c.resources` | 19:13:56.809923 | 15.05 | 85.81 | 99.66 | yes |
| `heldout.resources` | 19:14:26.229068 | 25.50 | 85.45 | 99.38 | yes |
| `verify.resources` | 19:14:34.562199 | 25.08 | 85.97 | 99.70 | yes |
| `fresh.resources` | 19:14:38.338175 | 23.12 | 85.30 | 99.07 | yes |
| `houzz-audit.resources` | 19:14:57.270881 | 20.16 | 84.74 | 99.66 | yes |
| `houzz-leads.resources` | 19:15:15.160903 | 34.05 | 85.89 | 99.62 | yes |
| `houzz-story-a.resources` | 19:15:30.048508 | 78.39 | 83.87 | 98.70 | no, exit 75 |
| `houzz-story-a-resample1.resources` | 19:16:11.036916 | 27.21 | 86.68 | 99.36 | yes |
| `final-meetup.resources` | 19:16:32.101110 | 35.88 | 86.55 | 99.05 | yes |
| `houzz-story-b.resources` | 19:16:34.349382 | 56.50 | 86.90 | 99.67 | yes |
| `houzz-capture-a.resources` | 19:16:53.933929 | 39.74 | 87.90 | 99.69 | yes |
| `houzz-audit-a.resources` | 19:17:10.411881 | 37.38 | 85.97 | 99.64 | yes |
| `houzz-capture-b.resources` | 19:17:22.762596 | 31.00 | 86.30 | 99.34 | yes |
| `houzz-audit-b.resources` | 19:17:29.419288 | 15.46 | 85.80 | 97.66 | yes |
| `learn-houzz.resources` | 19:17:51.864058 | 14.05 | 86.82 | 99.25 | yes |
| `houzz-story-c.resources` | 19:17:54.099133 | 16.62 | 86.67 | 99.13 | yes |
| `houzz-heldout.resources` | 19:18:10.342612 | 28.72 | 87.29 | 99.66 | yes |
| `houzz-verify.resources` | 19:18:14.674519 | 42.06 | 86.53 | 99.34 | yes |
| `houzz-offline-failure.resources` | 19:19:05.548682 | 20.73 | 86.11 | 99.64 | yes |

The exact-document commands each acquired `bench/explore/state/discovery/browser.lock` with atomic `mkdir`, wrote their own token, waited for gate/helper exit, checked the token and released only their own lock. Tokens were `community-broad-r6-meetup-b-1913`, `community-broad-r6-houzz-a-1916`, and `community-broad-r6-houzz-b-1917`. The helper closes its browser in `finally`. Final targeted process inspection found no remaining owned child, and the global browser mutex was absent. No unrelated process, lock, profile or evidence was removed. Isolated evidence/cookie jars remain ignored for audit; no values are copied into this report or caller notes.

The last substantive workload was admitted at 19:19:05Z and exited around 19:19:08Z, within the 20-minute/two-site bound. Subsequent work was small report/hash/ownership bookkeeping only. Parent should audit Meetup's receipts and run the focused registry gate before integrating it. Do not count Houzz, resume its traffic, or publish either site from this handoff.

## SHA-256 provenance

Full critical provenance follows; `receipt.json` contains all resource/script/source/receipt hashes. Paths below are repository-relative. Source/capture bodies remain ignored, not tracked response dumps.

```text
a6bb0f70e385196a6c4dbb71f884ad0e6693d067bb6f56fa2a253add162d1c08  bench/discovery/resource_gate.py
a5c2c869126c523e9a6c2dd950b35be146d4f9692afb805e521a4cff045e7663  bench/discovery/capture-document.mjs
e62a51dd4523ac5293e41ad9fc2e9f5ee5ae27f5df0d2e957e4d0dd9ecc5dded  bench/explore/state/discovery/community-broad-r4/home/captures/cmvplqezm1e5e14.json
287cfd1d444a16f88af8da894baed1b4ab034f5c360ac29f3c6960a74948db24  bench/explore/state/discovery/community-broad-r3/meetup-home.html
46034a02a96fc44d1d68caea58033ba843a4baa94b506f8f6cc4beef7cd12af2  bench/explore/state/discovery/community-broad-r3/houzz-home.html
cbe450a875f1b392bfbc6d7a3e799f5cd587e7fbf3e045439d6a05c73e075038  bench/explore/state/discovery/community-broad-r4/houzz-api-doc.html
4da8185b614fcc35f84a97a0c5d0e02d482560b3a0452a446002081ce70dbda2  bench/explore/state/discovery/community-broad-r4/houzz-category-a.html
9247bd3c696fb1aabac4f23a62a4294053acbb8e9da9189761b9ce08f5977e74  sites/meetup.json
15b7624e5e3a698358484e614f631742a48a49ab55d8294571ac995843204099  sites/meetup.md
c87a7cf58c63988082b69f608dad3c88959a54095b1f945d998add847f0bfd90  bench/explore/state/discovery/community-broad-r6/qualify-houzz.mjs
e2c5bb7b01aabce567d062416f0f29103bea865e8bb328184a9663e342c7fbdf  bench/explore/state/discovery/community-broad-r6/final-meetup.json
5616611b57d10837723b5da83cc069a14de053a3fcc5e98c5ab5e178f306fe87  bench/explore/state/discovery/community-broad-r6/fresh.json
ed76e08c6f503191cfb620462d6ed1aa6ba8618c2843dd9692c4e7bc173b90ef  bench/explore/state/discovery/community-broad-r6/heldout.json
d9a816fa6ef737f91feb29e19cac8b5af0509af60d802235bfa95ebb85ef2d01  bench/explore/state/discovery/community-broad-r6/houzz-offline-failure-audit.json
d8ab46b6a18f0fc9adc99afd8ec055452efb17cde9900d8dc7d971a0bfe9b2ab  bench/explore/state/discovery/community-broad-r6/houzz-preflight.json
2103c1bf68b2cb17541e4a998580f286c606d2fd754e0102ca8ba283a833a6cb  bench/explore/state/discovery/community-broad-r6/preflight.json
9f262789f5096282c7cf1ee9536941a598cdf5aea761b54a3a6e81c3549cb254  bench/explore/state/discovery/community-broad-r6/verify.json
3fe0c731312047d9582c5c6ad73049afe133869ead0bff98c8ebb25e0b66df8e  bench/explore/state/discovery/community-broad-r6/houzz-story-a.html
e46cac39cf9eeefea31388aa80d00e1ab0e6c62d4e827105767da2d7fe3f96e6  bench/explore/state/discovery/community-broad-r6/houzz-story-b.html
640357e91b1cee152df310a8e645a9774d6af4218b6bd88fd857ad0c65239b25  bench/explore/state/discovery/community-broad-r6/houzz-story-c.html
6267f8954f0eb06e571c09f5dd91073c860d5f7dcf1def873a7d359e03ca605a  bench/explore/state/discovery/community-broad-r6/meetup-event-b.html
574836f6112ff533d80a66fb4a435d5fbe692992dc6aa424b3a1659557a0886d  bench/explore/state/discovery/community-broad-r6/meetup-event-c.html
c5a86dda52c347742d57b80b29db8565ea6123f0490592df3167b9f15d565720  bench/explore/state/discovery/community-broad-r6/home/captures/cmvpmw7icd6ec99.json
104f0f961d03975186f7f871e4cef6f96b3d642b94845b60f11f74599c6ecb8d  bench/explore/state/discovery/community-broad-r6/home/captures/cmvpn1hdo8160d4.json
7bd2746e2405bd26afeb06cba8976f8549b03b0b433cafbe155243b65d132b4d  bench/explore/state/discovery/community-broad-r6/home/captures/cmvpn22w69edddf.json
```
