# McDonald's final export qualification

2026-10-26 UTC. PASS. Saved `sites/mcdonalds.json` and `sites/mcdonalds.md` for `getProduct(productSlug)`. The final exact export passed the held-out tier-1 reuse, current-version verification, saved-file audit, JSON-plus-notes vetting and integrated registry gate.

## Proven behavior

The operation reads a real US national product URL segment without `.html`, preserving size prefixes. It returns product heading, canonical URL, observed document language, source product ID and publisher description. Description can include item calorie prose, meal suggestions and promotions. It does not qualify detailed nutrients, ingredients, allergens, customized nutrition, restaurant prices, stock or availability.

Real frontend document examples remain Big Mac `cmvpdlgxc5e67cc:1` and Small Fries `cmvpdoim09b1967:1`, from the original worker. The unchanged exact-document helper captured each requested GET and aborted all 49 other requests. No fully hydrated GUI or interactive nutrition controls were proved. Learning from those captures had zero warnings.

Held-out Egg McMuffin originally passed at tier 1 and matched a separately fetched signed-out source in all five fields. The source product ID was `200298`; the description included 310-calorie and Canadian bacon prose, separately from its suggested meal. Receipts and the independent comparison are in `mcdonalds-coordinator-r2.md`.

The final export used a new initially empty `fresh-getProduct-r3` home. Its first `productSlug=egg-mcmuffin` call at 15:10:22 UTC sent no Cookie or Authorization, returned HTTP 200 at tier 1, did not heal or truncate, and exactly matched the independently checked prior result. Current exported verification then passed Big Mac and Small Fries, 2/2 at tier 1, at 15:10:51 UTC. Verification reused only guest cookies issued after that first request. No account, login or private browser import was used.

## Vet correction and exact version

The first admitted final audit at 15:08:48 UTC correctly rejected the local candidate's nested-quantifier slug regex and warned about the source commit hash in maintainer notes. No registry file was saved by that rejected audit. The own candidate pattern was simplified to `[a-z0-9-]+`; the source SHA remains in research rather than vetted caller notes. The extraction recipe and learned request did not change. The changed operation was exported, replayed from a new empty home and verified again.

Final operation hash: `0ff187835f3c5efe`. Final JSON SHA-256: `2673fde0e30eea5b4cc763fc0857a7b44264fef5f85ea1bfedbed7d39c24b9e2`. At 15:11:28 UTC the parent audit confirmed the actual public-example export equals the parsed saved registry spec, its operation hash matches the current verification record, both current cases passed without healing, and `vetShared` on exact JSON plus notes returned zero errors and zero warnings.

At 15:11:40 UTC the focused command `node --import tsx --test --test-name-pattern='every bundled spec passes' test/registry.test.ts` passed one selected test, zero failures and zero skipped tests. This is the integrated shared-rule gate, not another live replay. The catalog now counts 32 new sites, 38 operations and 111 passing cases, including the existing three local format refusals.

## Receipts, resources and cleanup

Raw evidence remains ignored under `bench/explore/state/discovery/mcdonalds-qualified-r1/`:

- `parent-save-r3.{out,resources}` retains the rejected audit, distinct from the final save.
- `parent-export-r3.json`, `parent-export-audit-r3.json`, `parent-fresh-r3.json` and `parent-fresh-r3.{out,resources}` retain exact-export first-call proof.
- `parent-verify-r3-final.{json,out,resources}` and `fresh-getProduct-r3/checks/mcdonalds.json` retain current-version verification.
- `parent-save-r3-final.{out,resources}` records the successful final audit/save.
- `bench/explore/state/discovery/audit-mcdonalds-export.json` is the parent receipt.
- `bench/explore/state/discovery/integrated-20261026T1511.{out,resources}` is the focused integration result.

All commands were bounded browser-free work using CPU admission/stop 65/85% and memory admission/stop 89/90%. No new browser or mutex was acquired. This final continuation's samples, including the rejected audit and integrated test, peaked at CPU 50.43%, policy memory 88.92% and raw occupied RAM 99.69%. The policy excludes file-backed cache. Raw occupied RAM exceeded 95%; no global or unsampled ceiling is claimed. All owned commands exited. No website write, source/dependency change, commit or publication occurred.
