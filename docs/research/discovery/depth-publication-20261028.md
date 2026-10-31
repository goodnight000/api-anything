# Depth follow-up publication record

Prepared 2026-10-28T23:30:59.563509+00:00 against main commit `d13eacb3cf7751eaa54228c207dfe8c74a9ba0f7`. The user explicitly requested stopping discovery and opening a PR. The app schedule is disabled with no next run; no owned live task or browser lock remains. Existing stops and publication pins remain unchanged.

## Submitted change

23 public read operations are appended across sixteen existing sites; two public apparel checks are appended to Nike getSizeGuide. There are 68 added stored example/check cases, including local invalid-input cases. Uniqlo has a notes-only source limitation update. No operation is removed. Every pre-existing operation object remains equal to main, except the two appended Nike checks. The four frozen publication pairs remain unchanged. The known-failing JYSK pair, raw captures, session state, profiles, scheduler state and discovery helpers are excluded. Main’s Workday notes correction is preserved.

See [coverage and parent evidence](depth-coverage.md) for the operation list, source contracts and limits. Reports are historical evidence: some workers ended with receipt or comparator defects; parent acceptance, reuse of an already completed exact-version cold call for Apple’s directory example, and retained no-send STOPs are stated separately. This PR does not clear those stops or claim that every worker finished a flawless serial verification.

## Fresh local validation

- Bundled shared-rules test and the all-bundled caller-notes length test: 2 passed.
- `npm run lint`: passed.
- `npm run check`: passed.
- All seventeen affected site pairs: zero vet errors/warnings and zero static credential-scan issues.
- Current runtime public-example exports reproduce each submitted JSON exactly, retaining the file’s terminal-newline convention. Parsed operation hashes and the existing-operation preservation audit pass.
- Gitleaks 8.30.1 scans the proposed file scope with the repository’s unchanged configuration: zero leaks. The release archive checksum was verified before use.
- Relative Markdown report links and exact staged-file scope are checked before commit.

Local checks use Node 25.2.1 against the current main code. Repository CI runs the broader test and packaging jobs on Node 22 and 24; those hosted results are separate and are not claimed here. No source, dependency, test or secret-scan configuration is changed.

## Historical website evidence

The website captures, independent semantic comparisons, first-call header boundaries and all-read case evidence were collected during the original bounded qualification rounds. No website call or fresh live health test was made for this publication step after the user stopped discovery. The final JSON and notes below match the accepted local exports; no recipe, parameter contract or public example was changed to prepare this PR. Source-cookie scans from qualification remain described in the site reports; the fresh publication scan is static and imports no user session.

| Site | JSON SHA-256 | Notes SHA-256 |
| --- | --- | --- |
| ikea | `058d4295e403a8215f53081d13fa22800bbaf650b9a943492a66b2f0f7eb2d5c` | `dc626d6665d55c2ad4660c69fd0bd4646808400d2ee61471fe2d0a34f21da187` |
| nike | `d15b6b694256c8c557ce644929df8c18c0e40adb31402634c30491ba005dedfe` | `e5f15df438eace52c0cac730fea67b556e3c4ed13872aecfbb05715419b8753f` |
| coursera | `500527915050784d61fa4e6a75c3934f5230a18f0b4103dc4ec10ab6166898bd` | `6c623a980ec64e50ba13ff69d5cc129c527743ef6c897e4b510d74426729992d` |
| apple | `ad5890b0579007ba44963ed7a35fd94c95c03a54a1acf0ba9be424e7d8e0fc6c` | `eafa342994854dd050a7df8489ec4ec2d1fb41760c8c7fe65081ba1d4c906aa8` |
| instacart | `493313ee35dc3d7f702c28f3680054ee37fe77cffab865b7355c70f25bfddb0b` | `227dd01c649619735a485710c964fb49027a0ef3fafa9aa20d699c76e90f185a` |
| ulta | `c201a8dbe3fa6252198995d7fa0924715c247d068fc1a0045c466c8899f58095` | `6dbd61a01e7397cdfaa3a5ff6f459501c17b79ef965b167870b689b6dd0083f3` |
| uniqlo | `d9ec5eebc3e6e5772b9429abc83c5b5d98b4ee23d02872d49aa57c3e4382d8ad` | `7f55b0b0f45d21a02421b663ae065375c75906286ecbf3837b9f910b71acd335` |
| fandango | `9a4f3d049a6fad32deae511e59df73044fa799c7d384af5788b4c698e67b0203` | `98c9dde17eca1f6628a58e0dd27abd875a818887727a79e7ea06da70f33622c8` |
| google-play | `53a5881327bd6e82f919d9f4b0a1c3813fdf342c1e8fca8596ed848edd05be85` | `8958919069221395e9bd2f9058ccd0443d24bfed18e92d0b07e84a3303cc8307` |
| edx | `34519e2a899d3870c5e3e6eb8e5fd0115c96bb5d19848115460d01f14c6b9f72` | `8f0dfa48f7748243483f556d4edf81bd768df4da352e8d5cb0520f4f9f56e6b2` |
| tradingview | `a510e9e18ed74dcb2674dbb7a157298c02755567959d219f51604f21bc0c9e85` | `d6544f3e69234e2896d8551719719ded14165cf5a89e35e0cb82c078eb597ec5` |
| flashscore | `5ed45fac6151ae9974b2a5d055e7224b8727d0ef6b6a7b50c481649641aa39f0` | `039eced1cb00b4253a69df352a1d00a1024b3fcf13668a6b6b6aba11d84468b6` |
| mcdonalds | `668a9dc16eae3bba99eec9155232b80b6d545faad463fca40124b17bfb134d93` | `058d2513402b5db763bc39793f1092f7dcd8b27b34441ad1ee8b920e116e0b63` |
| netflix | `251fcbe65b3912b510c1104f5155dba6c2ec7c6eb438a46db9374f98b39b8d78` | `d53e1a3123ccc5ec4027c40a281842e1e788f71e2fb2ccee1e8e4bff3a8f414c` |
| disneyplus | `24dd0f2aec8b10e218720c73af214d52b4392847487b9b48eb54ca488e4dd9ca` | `1d89348dc02e6946e0a0f6c504fe0def7bd9760536dd479e85303f6c4b0f0f51` |
| waitrose | `a0350c39a0b271f79418c0df2b2985cb054ca53fd75072f59fa6a077978e7615` | `02203b586fe769c5365f8b6fc2e745071d7ba0447943870f559963a475573555` |
| meetup | `dca5b5a82b8fdbb9523692e5bd18b34105b7cd3f396580ac4d9894534ea1414e` | `033bff0a137edde7290cbdfce9a5f33b4a24979207fa8a174d13f787c242f8ba` |

Raw command receipts, isolated export homes and machine-readable audit data remain under ignored `bench/explore/state/discovery/depth-stop-pr-20261028/` in the discovery worktree. No raw website exchange or credential is included in the PR.
