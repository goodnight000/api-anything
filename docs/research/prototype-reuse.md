# prototype → api-anything reuse audit

Source: the v0 prototype, the private predecessor project (MIT, same author, HEAD `7199102`, 9 commits,
~7.0k lines; `npm test` = 79/79 pass on 2026-09-27). Judged against `docs/DESIGN.md` (draft v0).
Everything marked **[verified]** was checked on 2026-09-27, either by running code (`npx tsx`) or
by a live `curl`. **[unverified]** means I could not check it.

## 0. What broke on 2026-09-27, confirmed live

| Capsule | Probe (2026-09-27) | Result |
|---|---|---|
| X resolver (`src/methods/persisted-query.ts:101`) | `GET https://x.com/home` with UA + dummy `auth_token=000…; ct0=0000` | **307** → `/i/jf/onboarding/web?redirect_after_login=%2Fhome&mode=login`, empty body. The response is the same with no cookie. `x.com/` returns 200 but serves only `abs.twimg.com/x-web/x-web/entry-client-logged-out-BX0aFYXb.js`: no `responsive-web/main.*.js`, no `featureSwitch`, 0 `queryId`. The dummy-cookie trick no longer works. **[verified]** |
| X guest mint | `POST api.x.com/1.1/guest/activate.json` with the public bearer | **200** `{"guest_token":…}`. It still works. **[verified]** |
| X read with the *old* baked queryId | `GET /i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName?variables=…&features=%7B%7D` + guest token | **200** with the full @NASA payload. The queryId from 2026-08-11 is still valid 7 weeks later, and `features={}` is accepted. **[verified]** |
| X 307 side effect | same `/home` request | Sets a `gt=<guest token>` cookie (Max-Age 9000) on `.x.com`. **[verified]** |
| Instagram `getProfile` | `GET /api/v1/users/web_profile_info/?username=nasa` with every header from the capsule | **401** `{"message":"Please wait a few minutes before you try again.","require_login":true,"status":"fail"}`. **[verified]** |

Takeaways for api-anything:

- **The X capsule died from its own resolver, not from drift.** The prepare step
  (`runtime.ts:72-74`) is mandatory and throws before any request goes out. The baked id it
  replaced would still have worked. So healing must be *reactive*: send the stored template
  first and re-learn only when a drift signal shows up. It must never be a precondition for
  making the call.
- Instagram's failure is on the **auth / rate-limit axis**: logged-out reads are dead or
  throttled. It is not TLS fingerprinting. DESIGN's claim that "Instagram always needs tier 2"
  is unsupported. What the evidence does show is "Instagram needs a logged-in session". Whether
  tier 1 works with the session is **[unverified]**.

## 1. File-by-file plan

Verdicts: **COPY** = mostly verbatim. **ADAPT** = reuse the logic with the listed changes.
**DROP** = don't port. The proposed target paths are suggestions only; DESIGN does not fix a
layout yet.

### src/

| prototype file (lines) | Verdict | api-anything target | What to take / change |
|---|---|---|---|
| `template.ts` (73) | **COPY** `coerceArg`, `getPath`. **ADAPT** `fillValue`. **DROP** string `fillString` as the primary mechanism | `src/template.ts` | `coerceArg` (l.12-24) takes a number only when `String(Number(v)) === v`. That is the snowflake fix, so copy it verbatim along with its test (`test/core.test.ts:393`). `getPath` (l.58-73): copy, then fix a limitation: `seg[0]` indexing needs `\w+` before the bracket, so `foo-bar[0]` fails. `fillValue` (l.38-55): keep the "exact `{name}` keeps native type" and "drop key when undefined" semantics. **Do not keep `fillString`/`\{(\w+)\}` interpolation over captured literals.** It blanks any literal `{word}` in verbatim captured text, such as minified GraphQL `{viewer{id}}`, and the `\w` regex can't express `{cookie:ct0}`. See §3.1. |
| `ir.ts` (264) | **ADAPT** | `src/spec.ts` | Keep `HttpMethod`, `ParamSpec`, `BodySpec` kinds (`none/json/graphql/form/raw`), `RequestSpec`, `ResponseSpec.extract`, `PaginationSpec`, `Operation.readOnly`, `findOperation`, `applyParamDefaults`, `paramsToZodShape`, `safeParse*`. Add `trigger`, `match`, `transport`/`minTier`, `response.pick`, per-op `learnedAt` + `learnedLoggedIn`. Drop `CaptureMethod`, `capturedVia`, `confidence`, `AuthSpec.{bearer,bearerEnv,apiKey,oauth2,prepare,PrepareStep.resolver}`, `authProbe`, and `staleSignals` (replaced by a generic classifier, §3.3). **Two bugs to fix while porting:** (1) `zodForParam` uses `z.coerce.boolean()` (l.223), and `{b:"false"}` parses to `true` **[verified]**. (2) `type:"number"` → `z.coerce.number()` (l.220) silently corrupts 19-digit ids. The learner must default every param to `string`; §2 row 13 shows this actually happening. |
| `auth.ts` (97) | **ADAPT** (small) | `src/session.ts` | Copy `parseCookieString` (l.21-31). The CSRF-from-cookie logic (l.76-82: `fromCookie` + `strip-quotes`) becomes the learner's generic "header value == cookie value" rule, which emits `{cookie:NAME}` or `{cookie:NAME\|unquote}` (§3.2). Drop `credentialsFromEnv` and the `<SLUG>_COOKIES/_BEARER/_HEADERS/_QUERY` env model, because DESIGN uses a jar in `~/.api-anything/sessions/`. Optionally keep a single env override for CI. **Bug:** `applyAuth` puts *all* cookies on *every* request, including absolute-URL prepare steps on other hosts. In the X capsule that sends `auth_token` to `api.x.com`. The api-anything jar must match cookies to each request URL by domain and path (store Playwright cookie objects, not a flat name→value map). |
| `runtime.ts` (321) | **ADAPT** core, **DROP** prepare/resolver | `src/call.ts` | Keep the `prepareRequest` skeleton: absolute-vs-relative URL (l.158-160), lowercased headers, `BODYLESS`, per-kind body build, `setDefault` content-type, `looksJson` + JSON parse fallback, `onRequest` dry-run hook, `fetchImpl` injection (it makes heal testable offline, see `test/persisted-query.test.ts:81`), `allowWrites` guard (l.222-226), `AbortController` timeout, and the `_healed` one-retry guard (l.274). Drop `runPrepareSteps`/`prepareCache`/`resolveRegistry`/`usesResolver`/`mergeInjected`. **Defects to avoid:** (a) query values equal to `""` are dropped (l.168), which changes requests that need `cursor=`; learned templates must replay empties verbatim. (b) JSON-in-query is built by string interpolation, so the X capsule's own `searchPosts` example (`"prototype" OR …`) produces invalid JSON **[verified]**. (c) the query is rebuilt with `URLSearchParams.set`, which re-encodes RestLi `(`→`%28` and space→`+`, and doesn't keep the captured raw encoding. (d) the form body does `String(v)` on nested objects → `[object Object]`. (e) the heal trigger hard-codes X strings (`404 \|\| "features cannot be null"`, l.273) in the generic runtime. (f) the minted-token cache is never invalidated on an auth failure, so a dead guest token sticks until its TTL runs out. |
| `methods/network-capture.ts` (740) | **ADAPT** (biggest reuse) | `src/capture.ts` (normalize + filter + summarize) and `src/learn.ts` (template learning) | **Copy verbatim:** `rec/arr/str/num`, `extractEntries` (HAR / `{entries}` / bare array / nested `data.log`), `headerMap` (drops HTTP/2 `:pseudo` headers, l.74), `pairs`, `toSample` including the XSSI strip `)]}'` (l.114), `ASSET_EXT`, `DENY_RESOURCE`, `DENY_MIME`, `isApiEntry`, `findExtract` (largest array, breadth-first, depth ≤5, then a `data/result/…` fallback), `trimSample`, `inferSchema` (types only; reuse it for drift detection by schema diff), the `PAGE_SIZE/OFFSET/PAGE_NUM/CURSOR` regexes, `richest/score`, `camel/pascal/uniqueName/operationName/qualifiedName` (for naming `capture` candidates). **Adapt:** the CSRF detector in `inferAuth` (l.400-409) becomes the generic cookie-ref rule, applied to every header, query value, and body leaf, with a minimum value length (§3.2). **Replace, don't port:** shape heuristics for params (`isIdSegment`, `paramizeObject`, "every query key is a param"). They are wrong for a value-driven learner. [Verified] with a synthetic HAR: `/i/api/graphql/Gb-d6r0vxPOADdG62OEBpQ/UserByScreenName` → `{id}` param (it templated the queryId, the one thing that must stay verbatim); the whole `variables` JSON → one opaque string param; `/api/tweets/2085462611575857621` → `id:number`, which `prepareRequest` then sends as `…857700`. DESIGN's rule (substitute only the example-arg values, keep everything else) replaces all of this. **Also wrong for replay:** the static-header rule (`STATIC_HEADER_OK`, l.378) keeps only `x-*`, `accept`, `accept-language`, `content-language`. It drops `user-agent`, `referer`, `origin`, and `sec-fetch-*`, which is exactly why the Instagram capsule needed those added by hand. `SECRET_NAME` (l.34) matches `auth`, so it drops `x-twitter-auth-type` (verified), and it also matches `key` and `sig`. Keep per-op headers verbatim minus a denylist (§3.2). The global "≥ half the samples" promotion is not needed. |
| `share.ts` (151) | **ADAPT** | `src/secrets.ts` + `export` command | Copy `scrubSpecForSharing` (deep clone, drop `response.sample`, drop personal `meta`), the recursive `scan`, and the `classify` regexes (`JWT`, `COOKIE_PAIR`, `HEX_BLOB`, `BASE64_BLOB`, `PLACEHOLDER` skip). Copy the CLI UX (`cli.ts:317-382`): show exactly what would be sent, and do nothing without `--yes`. **Measured false positives [verified]:** the X capsule flags `auth.headers.authorization` (the public web bearer, not a secret), and the LinkedIn capsule flags both `queryId` values as "long hex blob". **Gaps:** it doesn't scan `pathTemplate`, `params[].example`, or `meta`, and it can't know real secrets. Add an **exact-match scan against the live jar**: every cookie and session value of 6 or more characters, searched as a substring of the serialized spec. That check is deterministic with zero false positives, and the regexes stay as warnings. On export, strip `params[].example` by default, since learned examples are the user's own handles and ids. Drop `share()`/`SharePayload`/registry POST (a hosted registry is a non-goal). |
| `learnings.ts` (118) | **DROP** module. Port the **content** | none. Content goes to the learner rules (§2), `sites/<site>.json` `notes`, and test fixtures | The ledger was a crutch for agent-driven reverse engineering. In api-anything the generic learner must encode these lessons as behavior. The schema (`signals[]`, `problem`, `solution`, append-only JSONL) is fine, but it adds a module, a CLI verb, and a second kind of state. If something ledger-like is wanted later, a per-site `notes` string plus failing-case fixtures cover it. |
| `login.ts` (156) | **ADAPT** | `src/login.ts` | Copy `missingCookies`, the poll loop (1 s, 180 s timeout, Enter-to-confirm, always close), the `0o700` dir + `0o600` file + explicit `chmod` after write (l.81-84: `writeFile` mode is ignored on an existing file). Change `chromium.launch()+newContext()` (ephemeral, needs a downloaded chromium) to `playwright-core` `launchPersistentContext(~/.api-anything/profile, {channel:"chrome", headless:false})`. Change `.env` persistence to jar JSON with full cookie objects (domain/path/expires/httpOnly/sameSite). Keep the concept of `auth.cookies` as `session.loginCookies`, the declared names whose presence means you are logged in (X `auth_token`,`ct0`; IG `sessionid`,`csrftoken`,`ds_user_id`; LI `li_at`,`JSESSIONID`). Drop `parseEnvFile/loadStoredEnv/envPrefix`. |
| `mcp.ts` (89) | **ADAPT** | `src/mcp.ts` | Keep `McpServer` + `StdioServerTransport`, the write gate that returns `isError` with an actionable message, `annotations:{readOnlyHint, destructiveHint}`, `safeStringify`, `asStructured`, and the try/catch→`isError`. Replace the per-op `registerTool` loop with DESIGN's three fixed meta-tools (`list_sites`, `list_operations`, `call_operation`). `call_operation` validates args with `paramsToZodShape(op.params)` at call time. |
| `cli.ts` (655) | **ADAPT** fragments | `src/cli.ts` | Keep `node:util parseArgs`, the `--arg k=v` + `coerceArg` + `--json` merge (l.198-203), `--dry`, `--allow-writes`, the `verify` loop that builds args from `params[].example` (l.427-469, reuse as `api-anything verify` with heal), the `share` confirm-before-send flow, and `fail()`/`out()`. Drop `validate/gen/docs/features/doctor-rendering/from-openapi/introspect/scan/learn/auth(env instructions)`. `from-har` can survive as `api-anything add --har <file>`, feeding the same learner offline. It is also the offline test path. |
| `doctor.ts` (146) | **ADAPT** (small) or defer | `src/cli.ts doctor` | Keep the pure `DoctorCheck[]` return (no printing) and `canImport`. Checks become: Node ≥20, `playwright-core` importable, Chrome channel present, profile dir writable, per-site session age. Drop the "browser observation" text and the env-credential checks. |
| `codegen.ts` (179) | **DROP** | none | Typed-client codegen is a DESIGN non-goal. `generateDocs` could feed `ops` output, but `list_operations` already covers that. |
| `features.ts` (128) | **DROP** | none | Feature-map coverage was scope planning for hand-built capsules. api-anything adds ops on demand. Keep the X feature list (below) as a backlog note only. |
| `index.ts` (17) | **ADAPT** | `src/index.ts` | Library export `call` + types (DESIGN "Library export"). |
| `methods/persisted-query.ts` (154) | **DROP** | none | This is the X-specific resolver, and it is the thing that broke. Its only reusable piece is `braceMatch` (l.52-69), a string-literal-aware `{…}` matcher. Port it only if SSR-embedded state extraction (`__INITIAL_STATE__`) ever becomes a tier-3 fallback. **Also buggy:** the regex ignores `fieldToggles`, and the registry cache has no in-flight dedupe. |
| `methods/browser-automation.ts` (185) | **ADAPT** a small part | `src/trigger.ts` | Keep the `DomStep` type (`goto/click/fill/waitFor`), `checkSteps` validation with per-step error messages, and `interpolate` (it leaves unknown `{x}` visible instead of blanking, which is the right failure mode for triggers). Drop `extractText/extractAttr` (data comes from captured traffic), the `playwrightScriptFromRecipe` code generator, and the separate `chromium.launch`. |
| `methods/bundle-analysis.ts` (244) | **DROP** | none | Static bundle scraping is the approach DESIGN abandons. Bundles are split, lazy, or withheld from logged-out clients (the X x-web client ships 0 queryIds). |
| `methods/graphql-introspect.ts` (422) | **DROP** | none | GUI-only sites have introspection off. Nothing in the repo shows it working on a real target. |
| `methods/openapi-import.ts` (362) | **DROP** | none | A documented API is out of scope for "GUI-only" sites. |
| `methods/index.ts` (9) | **DROP** | none | n/a |

### test/ (79 tests, `node --import tsx --test`)

| File | Verdict | Notes |
|---|---|---|
| `core.test.ts` | **COPY** the template/`coerceArg`/`getPath`/`fillValue`/csrf-strip-quotes/`prepareRequest`/`executeOperation`(fake fetch)/write-guard tests. DROP codegen and per-op MCP tests. | The snowflake regression test (l.393-399) goes in verbatim. Add new regression tests for the bugs above: `z.coerce.boolean("false")`, JSON-in-query quote escaping, a numeric-looking path id that must stay a string, and preserved empty query values. |
| `network-capture.test.ts` | **ADAPT** | Keep its HAR fixture (fetch + GraphQL POST + an image to filter). Assert filtering, XSSI, and the cookie-ref rule. Drop the path-id/param-shape assertions. |
| `persisted-query.test.ts` | **ADAPT the pattern** | The offline heal test (fake `fetchImpl`: the old id 404s, the new id 200s, asserting exactly one re-learn and `healed:true`) is the template for api-anything's heal test. Swap the resolver for a fake trigger capture. |
| `share.test.ts` | **ADAPT** | Keep the scrub/no-mutate and the baked-cookie-flag tests. Add a jar exact-match test and the public-bearer false-positive case. |
| `login.test.ts` | **ADAPT** | Keep `missingCookies`/`cookieHeader`. Drop the env-file tests. |
| `prepare.test.ts`, `learnings.test.ts`, `features.test.ts`, `doctor.test.ts`, `browser-automation.test.ts`, `bundle-analysis.test.ts`, `graphql-introspect.test.ts`, `openapi-import.test.ts` | **DROP** | They follow their dropped modules. |

### agents/, marketing/, registry/, root

| Path | Verdict | Notes |
|---|---|---|
| `agents/skill/SKILL.md` | **ADAPT** heavily | Keep the safety section verbatim in spirit: own accounts only, reads before writes, per-write consent, never put credential values in a spec, `--dry` writes and diff ids byte-for-byte. Replace the 10-step manual loop with the api-anything CLI loop (`login → capture → add → call → verify`). Drop the method-selection table. |
| `agents/PLAYBOOK.md`, `method-selection.md`, `FEATURE-MAPPING.md`, `RECURSIVE-IMPROVEMENT.md` | **DROP** | Manual reverse-engineering doctrine for agents. The "escalation ladder" (RECURSIVE-IMPROVEMENT) matches DESIGN's tiers. The one line worth keeping: "reproduce the browser's exact request; diff `call --dry` against devtools". |
| `agents/capture-snippet.js` | **DROP** (lesson kept) | It monkeypatches `fetch`+`XHR` and truncates bodies to 20 000 chars (l.54,69), so big GraphQL responses won't parse. api-anything captures at the Playwright/CDP network layer, which sees XHR, fetch, and beacons with full bodies. |
| `agents/learnings.jsonl` | **PORT content** | See §2. |
| `marketing/x/*` | **PORT lessons, not ids** | Operation shapes are useful as fixtures: `UserByScreenName`, `SearchTimeline` variables, the `CreateTweet` body, and reply = the same mutation + `variables.reply`. The queryIds are historic. `x.apispec.json` stores the public bearer in `auth.headers`. |
| `marketing/instagram/*` | **PORT lessons** | `x-ig-app-id: 936619743392459`, `x-requested-with: XMLHttpRequest`, and the Sec-Fetch set. The endpoint is now login-only (§0). |
| `marketing/linkedin/*` | **Treat as unverified. Do not port values** | The README calls it "a real, working API", but no live run is recorded anywhere (the ledger has no LinkedIn entry). Both GraphQL `queryId` hashes look fabricated: `voyagerFeedDashMainFeed.6c8f0f4f2f0a9d3e0c1b2a3d4e5f6a7b` and `voyagerSearchDashClusters.1d2c3b4a5e6f7a8b9c0d1e2f3a4b5c6d` are sequential hex patterns. `searchPeople` substitutes `{keywords}` into RestLi without escaping; [verified] that `developer relations, (EU)` produces an unbalanced RestLi structure. Keep only the structural lessons (§2, rows 10-11). |
| `marketing/*/*.client.ts`, `*.server.ts`, `*.api.md` | **DROP** | Codegen output. |
| `registry/worker.js`, `wrangler.jsonc`, `docs/REGISTRY.md` | **DROP** | Hosted registry is a non-goal. |
| `CONTRIBUTING.md`, `PREREQUISITES.md`, `README.md` | **DROP** (rewrite) | They describe the env-var, codegen workflow. |
| `package.json` | **ADAPT** | Same toolchain works: `type: module`, `tsc` (TS ^7.0.2), `node --import tsx --test`, deps `zod ^3.25.76` + `@modelcontextprotocol/sdk ^1.30.0`. Add `playwright-core` (a regular dependency, not optional as prototype had it). |

## 2. Hard-won site lessons the generic learner must still handle

Sources: `agents/learnings.jsonl` (16 entries), capsule READMEs and specs, `x.features.json`, and
the probes in §0.

| # | Lesson (source) | Mechanism api-anything needs |
|---|---|---|
| 1 | **Fetch Metadata / browser headers.** IG's edge returns `400 SecFetch Policy violation` for requests without `sec-fetch-site: same-origin`, `sec-fetch-mode: cors`, `sec-fetch-dest: empty`, plus `origin`, `referer`, `user-agent`, `accept-language` (ledger `browser-sec-fetch-headers`). | The tier-1 template keeps the captured request headers verbatim, including `sec-fetch-*`, `origin`, `referer`, and `user-agent`. Playwright `request.allHeaders()` includes them. Strip only a denylist: `:pseudo`, `host`, `content-length`, `connection`, `cookie` (rebuilt from the jar), and probably `accept-encoding` (my recommendation). The UA must match the profile's real Chrome version, not prototype's hard-coded `Chrome/126.0`. Node fetch sends these headers, since the X/IG live calls in 2026-08 used them from Node. |
| 2 | **X uses XHR, not fetch**, for GraphQL. A fetch-only hook captures nothing (PLAYBOOK §2, snippet header). | Capture at the network layer (`context.on('request'/'response')`), never by patching page JS. Also make sure tier-2 `page` transport doesn't depend on the site's own fetch wrapper. |
| 3 | **A session-only header breaks the guest path.** `x-twitter-auth-type: OAuth2Session` alongside a guest token → `401 {"code":32} Could not authenticate you` (ledger `x-x-twitter-auth-type…`, `x-send-x-twitter-auth-type…`). | Headers are per operation *and per session state*. Record `learnedLoggedIn` with each template. If the current session state differs (the user logged out, or the cookie expired), re-learn rather than replay. Never promote headers to site-global by frequency. prototype's global `auth.headers` is what made this bite. |
| 4 | **CSRF = a cookie echoed in a header.** X `ct0` → `x-csrf-token` verbatim. IG `csrftoken` → `x-csrftoken` verbatim. LinkedIn `JSESSIONID="ajax:…"` (stored *with quotes*) → `csrf-token` *without* quotes. | The learner's cookie-equality rule must test `value`, `unquote(value)`, and `decodeURIComponent(value)`, and emit `{cookie:NAME}` or `{cookie:NAME\|unquote}`. It applies to every header, query value, and JSON/form leaf, with a minimum length (≥8) so short values like `yes` or `1` don't produce false matches. (The `strip-quotes` transform is from `network-capture.ts:404`; the min-length guard is my recommendation.) |
| 5 | **Public bearer embedded in the web bundle.** X sends the same `Authorization: Bearer AAAA…%3D1Zv7…` to every visitor, and it is not a user secret (ledger `x-graphql-reads-need…`). | DESIGN says auth-looking headers become `{session:authorization}`. That's safe, and it gets refreshed by every capture. The cost: a community spec can't do tier 1 until one capture has run. The secret scanner flags it ([verified] false positive), so exports need a per-header `public: true` override that a human confirms. |
| 6 | **Guest token.** `POST api.x.com/1.1/guest/activate.json` with the public bearer → `guest_token`, sent as `x-guest-token`, cached for about 3 h (still works as of 2026-09-27). X also sets a `gt` cookie on the `/home` 307 now. | In a real browser trigger the site mints the token itself. If the header value equals the `gt` cookie, rule 4 turns it into `{cookie:gt}` automatically. Whether the x-web client sends `x-guest-token` equal to the `gt` cookie is **[unverified]**. No prepare-step machinery is needed. |
| 7 | **Guest allowlist: 403/404 look like drift but are auth.** Guest works for `UserByScreenName`. `SearchTimeline` → 403. `TweetDetail` → **404** (ledger `x-guest-token-unlocks…`). The rule it states: "a queryId pulled minutes ago cannot be stale". | Drift classifier: after one heal, if the freshly learned template fails the same way, or the learned template is byte-identical to the stored one, classify the failure as **auth/input**, report it ("login required"), and don't overwrite or loop. A 404 while logged out is ambiguous, so heal at most once. |
| 8 | **Mandatory rotating `features` blob + rotating queryId.** 400 `The following features cannot be null` means features are missing or stale. 404 means the queryId rotated (ledger `x-graphql-the-features…`, `x-drift-self-heal…`). The "rotates every few hours" claim is contradicted for `UserByScreenName`: the old id and `features={}` still returned 200 on 2026-09-27. | The learner keeps `features`/`fieldToggles`/queryId verbatim from the capture, which is exactly DESIGN's plan. Drift signals for the generic classifier: 404 on a GraphQL path, `400` whose body contains `cannot be null`, `PersistedQueryNotFound`, or `"errors"` with no `data`, and a missing extract path. Keep a site-agnostic list and don't hard-code it in the runtime. |
| 9 | **JSON inside query params.** X GraphQL GETs carry `variables`, `features`, and `fieldToggles` as URL-encoded JSON strings. | The learner must parse any query value (and any form field) that is valid JSON, look for example-arg values at JSON leaf level, and store a structural slot. The encoder must `JSON.stringify` on replay. [Verified] that prototype's string interpolation builds invalid JSON when the arg contains `"`, and its own capsule example contains quotes. Numeric leaves like `count` must stay numbers. |
| 10 | **RestLi encoding (LinkedIn).** `variables=(count:20,start:0,query:(keywords:…,flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE)))))`. Persisted `queryId=voyager<Name>.<hash>`. `decorationId` selects the response projection. Static headers: `x-restli-protocol-version: 2.0.0`, `x-li-lang`, `accept: application/vnd.linkedin.normalized+json+2.1`. | A RestLi codec: parse to locate example values, and escape reserved `( ) , : '` inside substituted values on replay. **Preserve the raw captured query-string bytes** and substitute into the raw string instead of rebuilding through `URLSearchParams`, which re-encodes parens and spaces. Whether LinkedIn accepts `%28`-encoded parens is **[unverified]**. Everything in this row comes from the unverified LinkedIn capsule, so treat it as a hypothesis until one live capture confirms it. |
| 11 | **Normalized responses.** LinkedIn `normalized+json` puts entities in a top-level `included[]` array referenced by URN (capsule `getMe.extract = "included"`). | `response.pick` needs to work on `included[]` too. URN-reference resolution is **[unverified]** and deferrable. |
| 12 | **Static app id header.** IG requires `x-ig-app-id: 936619743392459` (plus `x-requested-with: XMLHttpRequest`). | Covered by the verbatim per-op headers in row 1. |
| 13 | **Snowflake ids.** A 19-digit id went through `Number()` → `…857700`, and the reply would have gone to a different post (ledger `cli-arg-silently…`, promoted). The same bug is still live in prototype via param typing (`network-capture.ts:576,599` types digit strings as `number` → `z.coerce.number`) [verified]. | Keep `coerceArg`. The learner types params as `string` unless the example was a JSON number in the captured body. `number` params validate without coercing past 2^53. `JSON.parse` of responses loses precision on bare big-int fields. X ships string `rest_id`, but a generic tool may hit bare ints. Detection or lossless parsing is **[unverified]** as needed. |
| 14 | **Optional nested blocks.** Reply = `CreateTweet` + `variables.reply:{in_reply_to_tweet_id, exclude_reply_user_ids:[]}`. Quote = `CreateTweet` + `attachment_url` ([unverified], from `x.features.json`). | A single-example learner can't discover optional structure. Model these as separate operations, each with its own trigger (`reply` triggered from a post's reply box). |
| 15 | **Writes can't be learned without side effects** unless intercepted. prototype read `CreateTweet` out of the bundle to avoid posting (ledger `x-createtweet-queryid…`). | See §3.4: intercept and abort. |
| 16 | **Logged-out endpoints die or throttle.** IG `web_profile_info` logged out: throttled (2026-08, ledger `authenticated-session…`) → `401 require_login` + "Please wait a few minutes" (2026-09-27). Business accounts 400 `Asset …ig_business_category_subvertical has been deleted` when logged out (ledger `instagram-web-profile-info-business-400`). | Default to logged-in capture. Classify `require_login`, `Please wait`, and 429 as **auth/rate-limit**, then back off and don't heal, because a heal fires a browser load and makes throttling worse. A per-input 400 on one account is not drift: re-learning yields an identical template, so row 7's rule stops it. |
| 17 | **Bundle scraping is fragile.** The x-web client ships 0 queryIds to logged-out users, the dummy-cookie fallback died between 2026-08-12 and 2026-09-27, and `/home` now 307s to onboarding [verified]. | This is the evidence for DESIGN's trigger/matcher approach. It also means X trigger URLs may redirect logged-out browsers to login, so X tier 3 likely needs a session too. Whether `x.com/<handle>` renders for logged-out users is **[unverified]**. |
| 18 | **XSSI prefixes** (`)]}'`) on JSON (`network-capture.ts:114`). | Strip before parse in both capture and the tier-1 response parse. prototype's runtime (`runtime.ts:250`) does *not* strip, so a spec could learn from a response it can't parse on replay. |
| 19 | **Multi-request operations.** Media upload = INIT/APPEND/FINALIZE on `upload.x.com` ([unverified], from `x.features.json`). Follow/DM use legacy form-encoded REST (`/i/api/1.1/friendships/create.json`, `dm/new2.json`) ([unverified]). | Out of scope for single-template ops. Tier 3 (drive the UI) is the only path. Form-encoded bodies must be learned with the same leaf-level substitution as JSON. |
| 20 | **`--dry` every write and diff ids byte-for-byte.** That check caught the snowflake bug before it posted to the wrong tweet. | Keep a `--dry` on `call` that prints the fully materialized request with session values redacted. |

X backlog with endpoints (from `x.features.json`, historic, [unverified] today): `UserTweets`,
`TweetDetail` (404 for guests), `HomeTimeline`/`HomeLatestTimeline`, `FavoriteTweet`,
`CreateRetweet`, `DeleteTweet`, `UnfavoriteTweet`, `CreateBookmark`, `Bookmarks`, `Followers`,
`Following`, `ListLatestTweetsTimeline`, `SearchTimeline product=People`,
`/i/api/2/notifications/all.json`, `/i/api/2/guide.json`.

## 3. Mechanisms to fix rather than copy (they feed the DESIGN changes)

### 3.1 Templates: structural slots, not inline `{x}`
prototype writes placeholders inside strings and fills them with `fillString`. Three
failures [verified or read in code]:
- no escaping, which breaks JSON-in-query;
- collisions with literal `{word}` in verbatim captured text;
- re-encoding through `URLSearchParams`.

Proposal: a learned request stores the **raw captured request** (URL with its raw query string, headers, body bytes) plus a list of **slots**:

```
{ at: "query.variables" | "path" | "header.x-csrf-token" | "body",
  codec: "raw"|"json"|"form"|"restli",
  pointer?: "/screen_name",
  ref: "param:screen_name" | "cookie:ct0|unquote" | "session:authorization" }
```

Replay decodes the location with its codec, sets the leaf, re-encodes, and splices it back.
Everything else stays byte-identical. Learning is the inverse: decode each location, search leaves
for example-arg values and cookie values, and record the slots.

### 3.2 Header policy
Per-operation, verbatim, captured from Playwright's `allHeaders()`. Deny list:
`:*`, `host`, `content-length`, `connection`, `cookie`. Session refs are created by rule 4 (cookie
equality) or by name (`authorization`, `x-*-token`, `x-csrf*`, `x-guest-token`) → `{session:name}`.
Never globalize.

### 3.3 Failure classifier (replaces `staleSignals`)
prototype's X spec lists `"Bad guest token"` and `'"code":32'` under `staleSignals`
(`x.apispec.json`) while its runtime comment (`runtime.ts:271-272`) says those are the auth
axis. `verify` therefore reports auth failures as STALE. api-anything should classify each failure into
one of four axes:

| Axis | Signals | Action |
|---|---|---|
| **drift** | 404 on a GraphQL path, `PersistedQueryNotFound`, `cannot be null`, 400 with a schema error, extract path missing, response schema changed (reuse `inferSchema`) | heal once |
| **auth** | 401, 403, `code":32`, `Bad guest token`, `require_login`, `login_required`, a redirect to a login URL | refresh session values from the jar once, then emit `api-anything login <site>` |
| **rate** | 429, `Please wait a few minutes`, `rate limit` | back off; no heal |
| **input** | anything that remains after a heal produced an identical template | return the error |

### 3.4 Learning writes without side effects
Trigger the write in the UI with `page.route(matcher, r => { capture(r.request()); r.abort(); })`.
The request is recorded and never reaches the server, so the template is learned without posting.
The first real execution then goes through tier 1.

Tier-3 *fallback* for writes (letting the UI send it) is the write itself. It counts as the one
attempt and must never be followed by a retry. Whether sites tolerate an aborted mutation without
side effects (optimistic UI or a preceding "draft" request) is **[unverified]** per site.

### 3.5 Cookie jar scoping
Store full Playwright cookie objects and attach only cookies whose domain and path match the
request URL. This fixes prototype's cross-host leak (`auth.ts:70-74` applied to the
`api.x.com` prepare request).
