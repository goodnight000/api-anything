# Prior art: unbrowse, Integuru, reverse-api-engineer, mitmproxy2swagger

Research date: 2026-09-27. I read the source of shallow clones in `/tmp/site2api-prior/`:

| Repo | Commit | License | Language |
|---|---|---|---|
| unbrowse-ai/unbrowse | `a0b1e9b` (2026-09-27), monorepo v11.4.0 | MIT for the client; the backend is proprietary (see below) | TS on Bun, plus Zig and Go binaries |
| Integuru-AI/Integuru | `b063940` (2026-05-25), labelled "v0" | **AGPL-3.0** | Python 3.12 |
| kalil0321/reverse-api-engineer (RAE) | `ab9919b` (2026-09-23), v0.14.0 | MIT | Python 3.11+ |
| alufers/mitmproxy2swagger | `f432aca` (2026-06-24), PyPI 0.15.0 | MIT | Python 3.12 |

Paths below are relative to each clone. "Unverified" means I did not confirm the claim in source or by running the code.

---

## 1. unbrowse

### What it is

It is a very large system: the repo is 460 MB, `src/orchestrator/index.ts` is 9,254 lines and `src/execution/index.ts` is 7,790 lines. It bundles a Solana/x402 micropayment marketplace, wallets, a shared route graph, and an MCP server with about 20 tools. The claim is narrow: learn the first-party XHR routes behind a UI from browsing, then replay them. The paper arXiv 2604.00694 (Tham, Mac Gregor Garcia, Hahn, 2026-04-01) reports a 3.6x mean and 5.4x median speedup over Playwright on 94 domains, with warm cached calls at 950 ms vs 3,404 ms.

The paper also admits several limits:
- It gives no concrete algorithm for which request values become parameters.
- A 6-hour background verification loop re-runs safe GETs and compares response schemas, but "the automatic deprecation threshold logic is not yet wired into the verification loop."
- Anti-bot protection is listed as a limitation. On WAF-protected sites the median speedup was 2.1x vs 6.8x on unprotected sites.
- Cold start succeeded on 18 of 20 new domains. The 2 failures had no identifiable API.

### Open vs closed split

The split matters because we cannot copy what we cannot see. `docs/OPEN-SOURCE-NOTICE.md` says the backend is a private repo on Cloudflare Workers and owns "route graph, ranking, … recursive contract compilation". `src/capture/reveng-server-first.ts` says the endpoint-inference heuristics "are moat IP and run SERVER-side only". The client obfuscates captured traffic and POSTs its structure to `/v1/reveng`. The local fallback `src/capture/reveng-local.ts` was added only because the server returned HTTP 426 and whole captures were being dropped.

`packages/skill/vendor/contract/*/libcontract.dylib` (9 MB) is a prebuilt Zig library. Its `manifest.json` gives the source as `~/.claude/skills/contract/libcontract`, a local path that is not in the repo. Unverified: whether its source is public anywhere.

The npm `unbrowse@12.0.0` package is 53 KB unpacked, has no dependencies, and exposes `bin: dist/cli.js`. Unverified: what that CLI does; it no longer matches the repo's `packages/skill` (v11.4.0).

### Capture

Capture uses CDP, and several sources are merged by `mergePassiveCaptureData` in `src/capture/index.ts:1061`. In priority order:
1. An injected JS monkeypatch of `fetch`/XHR (`INTERCEPTOR_SCRIPT`, around `:902`), which records bodies.
2. A HAR recorded by **Kuri**, a Zig CDP browser driver vendored as a ~6 MB binary (`justrach/kuri`).
3. Raw CDP `Network.requestWillBeSent` / `responseReceived` / `loadingFinished` + `getResponseBody` (`captureSession`, `:1716`). This is also set up with `Network.setCacheDisabled` and `setBypassServiceWorker` (`:1928-1929`). The code comments say HAR drops auth headers and CDP is used to recover them.
4. A browser-extension observer (`chrome.webRequest`).
5. Performance-API URLs, re-fetched to get bodies.

There is also an alternative Chrome-free engine, "obscura" (a sidecar that emits NDJSON), selected in `src/capture/engine.ts`. That engine returns a three-way outcome: `routes`, `error: origin_down`, or `blocked: [{url, vendor}]`. The reason given is that "Cloudflare refused this endpoint" and "this endpoint does not exist" both look like `routes: []`, and an empty result invites the wrong repair.

### Choosing and generalizing a request (local path only; the server path is not visible)

**Admission** (`reveng-local.ts` header comment and `admitCandidate`, around `:648`): a request is a data endpoint only if its response decodes to a structure containing an array of 2 or more records with the same shape. The walk is bounded (depth 12, 40k nodes). It also covers `<script type=…json>` blocks, JSON assignments inside SSR HTML, XSSI prefixes, and protobuf. Telemetry is separated by direction: a beacon's payload goes out in the request, while a data endpoint's payload comes back in the response. Candidates are then ranked by information gain (response bytes ÷ request bytes). No host or path lists are used.

**Variable params** (`inferVariableParams`, `:769`): a query param becomes `{name}` if any of these holds:
- (a) the obfuscator redacted it;
- (b) it is empty;
- (c) it has 2 or more distinct values on this route;
- (d) the same param name has 2 or more values anywhere in the capture;
- (e) it is a bare integer;
- (f) its value is **echoed** somewhere in the response's scalar leaves.

Everything else stays literal. The observed value is stored as the default, so replay with no arguments reproduces the captured request exactly.

**Path params** (`src/capture/obfuscate.ts:79`): a path segment becomes `{id}` only if it is a UUID or at least 16 characters of hex or secret-looking text. So `/users/jack` stays literal.

**Body params:** there is no local body templating. `body_params` exists on `EndpointDescriptor` and is filled server-side (unverified how).

**GraphQL and gRPC:** `src/execution/protocol-decomposers.ts` parses the JSON in `variables`/`features` (including JSON inside URL query values), exposes each variables key as an agent parameter, and rebuilds the request at call time. `buildGraphqlRequestParams` does this at `:104`; Connect/gRPC is handled the same way.

**Endpoint shape** (`src/types/skill.ts:218`): `url_template`, `headers_template`, `body`, `trigger_url`, `auth_tokens`, `csrf_plan`, `oauth_plan`, `response_schema`, `graphql_info.operation_name`, `proven_recipe`, `verification_status`, and `reliability_score`.

### Auth

- **Cookies are read straight from the user's Chrome or Firefox SQLite databases** (`src/auth/browser-cookies.ts`, adapted from `jawond/bird`). Chrome's cookie store is decrypted with the macOS Keychain "Safe Storage" key via PBKDF2 + AES-128-CBC. They are then stored per domain at `~/.unbrowse/obscura/<domain>/cookies.json` (mode 0600).
- `unbrowse auth <login_url>` opens a visible Kuri-managed tab (`interactiveLogin`, `src/auth/index.ts:370`). It detects a finished login when the cookie count changes and the URL leaves the login pages (`LOGIN_PATHS` regex).
- **Token locators** (`src/capture/replay-tokens.ts`, `src/execution/token-resolver.ts`): for each captured token value of 16+ characters, it searches for where the value came from — a `<meta>` tag, an inline-script regex, a regex over the JS bundle, or a cookie name. It stores a list of locators in `endpoint.auth_tokens`. At call time it fetches `trigger_url` again, re-runs the locators, and injects fresh values. This handles CSRF tokens that rotate per page load, bearer tokens kept in bundles (x.com), and `__INITIAL_STATE__` tokens.
- `src/auth/stale-endpoints.ts`: endpoints that return 401/403 or a GraphQL error envelope go into `~/.unbrowse/stale-endpoints.json` with a 30-minute TTL and a `reason`. They are hidden from resolve until the TTL expires or a re-auth happens.

### Self-heal and drift

**Trigger-and-intercept** (`triggerAndIntercept`, `src/capture/index.ts:2632`) is the closest thing to site2api's trigger, so here is exactly what it does:
- It opens a fresh tab, injects cookies, navigates to the origin, and injects the interceptor.
- It navigates to `trigger_url`, injects the interceptor again, then polls every 1 s for up to 15 s.
- It looks for a response whose URL contains the template's base path (placeholders removed), **and** whose URL contains the stored `queryId` prefix when there is one.
- Arguments are applied only as **query params** on `trigger_url` (`execution/index.ts:4264-4275`). A path argument such as `x.com/{screen_name}` cannot be substituted.
- It is used only for safe methods, and it returns only the response data. **It does not re-learn the template from the request it intercepted.**
- Because the matcher includes the old queryId, a rotated queryId makes it time out instead of healing.

**Schema drift** (`src/transform/drift.ts`, used at `execution/index.ts:5011`):
- After each successful call, it infers a schema from the response and diffs its field paths against the stored `response_schema`.
- Removed fields or incompatible type changes count as breaking. The call is marked failed (`schema_drift_recapture_required`) but the body is kept.
- Additive changes, number↔integer, and nullable variance only produce an informational note.
- A GraphQL `errors[]` with no `data` becomes `graphql_error_envelope` and marks the endpoint stale.
- In every case it returns a `re_capture_signal` that tells the **agent** to run `unbrowse_go` headed on the context URL (`drift-recapture-signal.ts`).
- The only inline recovery is page-level DOM extraction (`drift-page-recovery.ts`, confidence ≥ 0.5). The template is never repaired inline.

**Verification loop** (`src/verification/index.ts`): every 6 hours it re-runs GET endpoints only, through the browser, and moves each endpoint to `verified`, `pending`, or `failed`.

### Execution ladder and anti-bot

The ladder (`execution/index.ts` around `:4150-4300`, `src/execution/probe.ts:170`) runs in this order:
1. Proven-recipe replay.
2. Writes skip the probe and go straight to server fetch. The code comment says a HEAD probe against write-only routes returns 404, which was misread as "stale".
3. A HEAD/GET probe, then `decideFromProbe`. JSON goes to server fetch. A 401/403 fetches the full body so vendor-block markers can be classified. A 400 + `text/html` also goes to server fetch. Other 4xx/5xx are returned to the caller "without escalating". A network error goes to libcurl-impersonate.
4. `classifyExecuteFailure` detects vendor block pages returned with HTTP 200 (Akamai bm-verify, DataDome, PerimeterX, Cloudflare) and then falls back to fetching in the browser.
5. Trigger-intercept, or a full browser.

The impersonation ladder (`src/capture/fetch-ladder.ts`, `src/capture/DESIGN_NOTES.md`) tries, in order:
- `curl_cffi` impersonation;
- the same through a residential proxy;
- camoufox (~200 MB Firefox);
- headed patchright.

Every rung is optional and returns `null` if it is not installed. This is called "honest degradation".

`submodules/utls-proxy` is a Go CONNECT proxy that sends a Chrome-131 ClientHello via uTLS. There are also per-vendor solvers: `cf-challenge.ts`, `px-challenge.ts`, `akamai-challenge.ts`, `kasada-challenge.ts`, `tencent-waf-solve.ts`, `captcha-solve.ts`. The agent path hard-codes `solvedAndReplayed = false`: it requires a human to clear challenges and uses no paid solver.

### Install and agent UX

- `npm i -g unbrowse && unbrowse setup` installs a `SKILL.md` into about 30 agent hosts; the repo has `.claude`, `.codex`, `.roo`, `.kiro`, … directories. Setup does **not** write MCP config. `unbrowse mcp` is kept as a "compatibility" stdio server.
- The skill contract is one command, `unbrowse "<task>" --url <url>`, plus exactly one retry driven by `next_step`, and then stop.
- There are also `curl | sh`, an SDK (`createHole().fill`), and drop-in shims for Playwright, Firecrawl, and Stagehand.
- **Publishing to the shared marketplace is opt-in by default**: `share_pointers=true` and auto-publish at the `sync`/`close` checkpoint (README, "When Unbrowse discovers").

### Dependency weight

- Root runtime dependencies include `@solana/web3.js`, `@solana/kit`, `viem`, `sodium-native`, `openai`, `fastify`, `chrome-remote-interface`, `@puppeteer/browsers`, and `cheerio`.
- `packages/skill/vendor` is 276 MB of per-platform Kuri, obscura, and libcontract binaries.
- The optional Python venvs add curl_cffi, camoufox, and patchright.

---

## 2. Integuru (v0, AGPL-3.0)

This is about 1,400 lines of Python using LangGraph and gpt-4o/o1. Its output is **generated Python code**, not a spec that can be executed.

- **Capture:** HAR. `create_har.py` launches headed Playwright Chromium with `record_har_path` and `record_har_content="embed"`. The user performs the action and presses Enter, and the script dumps `context.cookies()` to `cookies.json`. There is no persistent profile.
- **Noise filter** (`integuru/util/har_processing.py`): drops static file extensions and requests mentioning google, taboola, datadog, or sentry. Header names containing cookie, `sec-`, accept, user-agent, referer, or common analytics vendors are removed.
- **Request choice** (`agent.py:end_url_identify_agent`): an LLM gets `(method, url, mimeType, 30-char preview)` for every entry and uses function-calling to pick the URL "responsible for {prompt}".
- **Generalization is a dependency DAG, not a template** (`agent.py`, `graph_builder.py`):
  1. An LLM lists the "dynamic parts" of the chosen request as a minified curl: values that are "unique to a user or session and checked by the server". It is told to ignore cookies, common headers, and free-text user input.
  2. User-supplied `--input_variables` present in the curl are removed from that list, via an LLM call plus a substring check.
  3. For each remaining dynamic value: if it is a substring of a cookie value, the node becomes a `cookie` leaf. Otherwise it searches every HAR **response body** for the value, requiring that the value does not appear in that request itself. If several requests match, an LLM picks the "simplest" one. HTML and `.js` sources are dropped.
  4. It repeats until only cookie leaves remain (`find_curl_from_content`, `:326`). `find_json_path` (`util/print.py:96`) then finds the JSON path to extract each value.
  5. Code generation walks the DAG from the leaves up and has the LLM write one function per node.
- **Auth:** static cookies from the capture session. There is no refresh and no re-login.
- **Self-heal and drift:** none. Anti-bot and TLS: none, since the generated code uses `requests`.
- **UX:** `poetry run integuru --prompt … --model …`. No MCP, no skill. The README says this repo is the frozen v0 and the product lives at integuru.com.
- **License is AGPL-3.0**, so we must not copy code. The algorithm (value provenance by searching earlier responses) is an idea and is fine to reimplement.

---

## 3. reverse-api-engineer (RAE)

RAE uses an LLM coding agent (Claude Agent SDK, OpenCode, Cursor, Copilot, or Ollama) to **write a per-site API client** in one of about 10 languages, or an OpenAPI document (`output_mode == "docs"`).

- **Capture:** HAR in both modes.
  - Manual mode (`src/reverse_api/browser.py`): `launch_persistent_context(channel="chrome", user_data_dir=<temp copy of your Chrome profile>, record_har_path=…, record_har_content="embed")`. If Chrome is missing it falls back to Playwright Chromium with `playwright-stealth` plus custom stealth arguments and an init script.
  - Agent mode (`auto_engineer.py:_get_mcp_config`) attaches a browser MCP server launched through `npx`: `rae-playwright-mcp@latest run-mcp-server <run_id>` (records the HAR), `chrome-devtools-mcp@latest` (drives the user's real Chrome, requires Chrome 146+), or Vercel `agent-browser`.
- **Request choice and generalization:** entirely inside the LLM. The prompt is `prompts/engineer/system.md`: read the HAR, find auth patterns, and "extract endpoint patterns — required vs optional params". There is no deterministic templating.
- **Auth:** the prompt says to **"Hardcode all credentials, cookies, tokens, and session data found in the traffic. No env vars, no config files"**, and "if the traffic reveals a token refresh or login flow, implement automatic re-authentication" (`prompts/engineer/system.md`, `prompts/auto/system.md`).
- **Anti-bot:** the prompt tells the agent to prefer `httpcloak` (TLS/HTTP2 fingerprint matching), then fetch through the browser via Playwright CDP, and only then use full browser automation. This is the same ladder as site2api's tiers, but written as prompt text rather than runtime code.
- **Verification:** the prompt allows up to 5 attempts, each recorded in an `<attempt_log>`. An in-process MCP tool, `report_client_verified` (`engineer.py:98-134`), must be called once after the agent actually runs the client live. It replaced parsing Bash output, which automated review kept finding ways to fool: "eight rounds of automated review kept finding new ways a Bash command could *look* like a real client execution without being one".
- **Self-heal:** none at runtime. Repair means running RAE again on the same run id ("iterative refinement" of the existing scripts, `prompts/engineer/user.md`).
- **UX:** `uv tool install reverse-api-engineer` gives a TUI/CLI. The base dependencies are small (click, claude-agent-sdk, rich, httpx…). Playwright is the optional `[manual]` extra. There is no MCP server exposing the generated operations, and no skill.

---

## 4. mitmproxy2swagger (brief)

- **Capture:** mitmproxy flow dumps (a proxy, so the user must install its CA certificate) or a DevTools HAR. The input format is guessed by comparing heuristic scores.
- **Generalization** is two passes with a human in between (`mitmproxy2swagger.py`):
  1. Pass 1 writes every unseen path into `x-path-templates` with an `ignore:` prefix. Path segments matching `--param-regex` (default `[0-9]+`) become `{id}`.
  2. The human edits the YAML: removes `ignore:`, merges paths into templates, renames parameters.
  3. Pass 2 matches requests against the templates (`path_to_regex`) and emits OpenAPI 3.0: query params and schemas inferred from JSON, form, or msgpack bodies. Examples and headers are included only with `-e`/`-hd` because they "might expose sensitive information".
- It merges into an existing spec file, so it is incremental.
- It has no auth, replay, drift handling, or agent integration. Dependency weight is mostly `mitmproxy`.

---

## 5. Comparison

| | Capture | Which request | Generalization | Auth | Drift / heal | Anti-bot | Agent UX |
|---|---|---|---|---|---|---|---|
| unbrowse | CDP + JS hook + Kuri HAR | response shape (record array), info gain | variation / echo / integer / redaction on query params; opaque path ids; GraphQL vars decomposed | cookies decrypted from real Chrome/Firefox DBs; token locators re-scraped per call | schema diff → agent re-captures by hand; trigger-intercept returns data only | impersonation ladder, uTLS proxy, vendor detectors | skill-first, MCP as compatibility, SDK |
| Integuru | Playwright HAR | LLM | LLM "dynamic parts" + value-provenance DAG | static cookies.json | none | none | CLI; outputs code |
| RAE | Playwright HAR / browser MCP | LLM agent | LLM agent | **hardcoded** into generated code | re-run the agent | httpcloak → CDP fetch → browser (in the prompt) | CLI/TUI; outputs code |
| mitmproxy2swagger | proxy or HAR | human | regex + human edits | none | none | none | CLI; outputs OpenAPI |

---

## 6. Mechanisms site2api should take

1. **Capture through CDP `Network.*` events, not a JS monkeypatch.** unbrowse's `triggerAndIntercept` injects its interceptor after navigation, so requests fired early or by a service worker can be missed. This is why it also runs CDP capture with `setBypassServiceWorker`. Playwright's `page.on('response')` / CDP sees everything, including auth headers that HAR strips.
2. **Record a request's provenance and follow it one hop up** (Integuru's core idea, reimplemented because the code is AGPL). After substituting args and cookies, any remaining non-constant value (for example x.com `UserTweets.variables.userId`) should be searched for in earlier captured response bodies from the same trigger run. Record `{fromOp/fromRequest, jsonPath}` (`find_json_path`) so the learner can chain two requests or mark the operation "requires a lookup". Without this, template substitution silently fixes arguments that were derived from other arguments.
3. **Run two examples and diff them.** This is unbrowse's "≥2 distinct values" rule turned into an active step. Run the trigger twice, with different example args (or the same args twice):
   - positions that change with the args are params;
   - positions that change with the same args are nonces, timestamps, or signatures, which means the operation should be pinned to tier 2/3;
   - positions that never change are constants.
   This removes most false substitutions (such as example `"1"` hitting `count=1`) without per-site code.
4. **Template on the decoded tree, not the raw string.** Parse JSON inside URL query values (`variables=`, `features=`), JSON and form bodies, and do the substitution on leaves, then re-encode. unbrowse needs `protocol-decomposers.ts` for exactly this (x.com GraphQL, Connect/gRPC). Raw string replacement misses URL-encoded or JSON-escaped occurrences of an example value and corrupts partial matches.
5. **Token locators for `{session:x}`.** For every session-like header value, store where it came from: a cookie name (x.com `ct0` → `x-csrf-token`), a `<meta>` tag, an inline-script regex, or a JS-bundle regex (x.com's bearer). Refresh from the locator; only re-capture if that fails. Copy the pattern from `replay-tokens.ts` and `token-resolver.ts`.
6. **Use the response echo as a signal.** If a request value comes back in the response (`page=2` → `"page":2`), it is a caller-controlled coordinate. This is useful when the example args do not appear verbatim, for example after normalization.
7. **Response-shape drift for "200 but wrong".** Store an inferred response schema. After each tier-1 call:
   - removed paths or type changes, or `errors[]` with `data: null`, mean heal;
   - additive fields, number↔integer, or nullable variance mean no heal.
   Use unbrowse's breaking/additive split (`transform/drift.ts` plus the classification at `execution/index.ts:5011`). Add GraphQL error envelopes to DESIGN.md's drift triggers explicitly.
8. **Treat block, drift, and auth as separate outcomes.** Detect vendor block pages even when the status is 200 (Cloudflare "Just a moment", Akamai bm-verify, DataDome, PerimeterX): they should escalate the tier, not trigger a heal. 401/403 after a fresh cookie jar should lead to `login`, not a heal. unbrowse's `blocked` result and `classifyExecuteFailure` show that mixing these up causes the wrong repair.
9. **Record why an operation is stale, with a TTL.** A stale record like `{op, reason, status, ts}` stops the agent (and `verify`) from repeatedly calling an operation already known to be broken. See `stale-endpoints.ts`.
10. **Never probe writes.** unbrowse learned that a HEAD probe on a write route returns 404 and gets misread as drift (`execution/index.ts:4154-4172`). Writes should skip probing and heuristic tier selection.
11. **Keep rungs optional and degrade honestly.** If an optional transport (impersonation) is not installed, return "unavailable" and move to the next tier. Never throw, never fake a result, never provision implicitly (`fetch-ladder.ts`, DESIGN_NOTES).
12. **Verification must be observed, not claimed.** RAE's `report_client_verified` tool is the agent-facing version. For site2api, `add` and `heal` should be marked done only after a tier-1 replay of the learned template, using a new arg value, returns a response that passes the stored extract/pick schema. unbrowse ships locally inferred routes as `verification_status: "unverified"` until replay confirms them.
13. **Skill-first packaging.** unbrowse moved from MCP-first to a skill with a strict loop (one command, at most one `next_step` retry, then stop and report). That supports DESIGN.md's CLI + skill plus a small MCP. Copy the "exactly one retry then report" rule into SKILL.md.
14. **Export to OpenAPI** (mitmproxy2swagger, RAE docs mode) as an optional `share` format. It is cheap and interoperates with other tooling.

## 7. Pitfalls to avoid

- **Credentials in artifacts.** RAE hardcodes cookies and tokens into generated code on purpose. mitmproxy2swagger only warns about it. unbrowse needed three layers of redaction plus a final "drop the descriptor if any harvested secret still appears" sweep, because `headers_template` and `proven_recipe` "have historically carried the cookie jar" (`reveng-local.ts` header). site2api should run a fail-closed secret scan on **every** save, not only on `share`, using harvested actual cookie and header values, not just regexes.
- **Matchers that include rotating ids.** unbrowse's trigger-intercept matches on the stored `queryId`, so the one case it could heal (rotation) turns into a 15 s timeout. Matchers must key on stable identity: GraphQL `operationName` or the last path segment, a path with hash-like segments wildcarded, and the method.
- **Heal that only signals.** unbrowse detects drift but hands repair back to the agent (`re_capture_signal`, run it headed). Agents usually do not follow up. site2api's automatic re-learn is the real improvement over it; do not weaken it to "emit a hint".
- **Scope creep.** unbrowse's payments, wallet, marketplace, 30 host directories, 9k-line orchestrator, opaque vendored `libcontract.dylib`, and opt-in-by-default publishing are what the core route-replay idea turned into. Keep the non-goals.
- **Reading the user's main browser cookie store.** Decrypting Chrome's SQLite database with the Keychain key triggers macOS keychain prompts, is fragile across Chrome versions, and surprises users about privacy. DESIGN.md's dedicated profile plus `login` is the better choice. Note that RAE copies the real profile to a temp directory, which also avoids Chrome's profile lock.
- **Code generation as the artifact** (Integuru, RAE). Every site becomes a separately authored program that cannot heal itself, and a new LLM run is the only repair. A data spec plus one generic executor is what makes generic healing possible.
- **LLM in the hot path of learning.** Integuru makes 3+ LLM calls per DAG node, with temperature 1, so the result is nondeterministic. site2api's deterministic substitution is cheaper and reproducible; reserve the LLM (the calling agent) for choosing among candidates in `capture`.
- **Noise filtering by vendor lists** (Integuru's google/taboola/datadog list) goes stale. unbrowse's structural test (the response contains records, and the payload direction is inbound) needs no list.
- **Proxy-based capture** (mitmproxy) needs a CA certificate installed, and the proxy's TLS changes the fingerprint (the reason unbrowse built a uTLS proxy). site2api should stay with CDP in a real Chrome.

## 8. Where site2api's trigger + matcher + learn design is different, or weaker

**Genuinely different or stronger:**
- **Known example args.** None of the four knows the argument values in advance. unbrowse infers variability from passive traffic; Integuru and RAE ask an LLM. Substituting known examples is deterministic and names the params correctly (`{screen_name}`, not `{id_2}`).
- **One routine for create, heal, and read fallback.** unbrowse has the pieces (`trigger_url`, trigger-intercept, drift detection, re-capture) but they are not connected: trigger-intercept returns data without re-learning, and drift hands off to the agent. site2api closing that loop, so a tier-3 success rewrites the template and the next call is tier 1, does not exist in any of the four.
- **Path-argument triggers** (a URL template plus UI steps). unbrowse can only add query params to `trigger_url`.
- **Deterministic and local.** No server-side inference, no LLM needed to learn, MIT throughout.

**Weaker or not yet designed:**
- **Derived arguments.** Plain substitution cannot handle a request value computed from an argument by a previous request (userId from screen_name, a cursor from page 1). Integuru's provenance search covers this and DESIGN.md does not (see 6.2).
- **Discovery.** site2api learns only the operations someone writes a trigger for. unbrowse learns every data route seen during browsing and finds them by intent. `capture` partly covers this; consider "promote a captured candidate to an operation" so a trigger is authored from the page URL where the request was seen.
- **UI-step triggers rot too.** Heal depends on the UI still firing the request. When selectors or flows change, the heal fails and tier 4 is correct. There is no second source of truth, whereas unbrowse can fall back to DOM extraction.
- **Loose matchers can heal to the wrong request.** A re-learn that picks a different request with the same operationName but different semantics would silently return wrong data. Heal should be accepted only if the new response still satisfies the stored extract path and schema (6.7, 6.12).
- **Tier 1 on protected sites.** Node `fetch` has a Node TLS/HTTP2 fingerprint. unbrowse and RAE both put an impersonation rung (`curl_cffi`/`httpcloak`) between plain fetch and the browser. site2api jumps straight to tier 2 (seconds instead of about 100 ms) on Cloudflare-class sites. This is acceptable because "remember the lowest tier" amortizes it, but it is a known ceiling.
- **No shared registry** (a non-goal). unbrowse's network effect, where one person's capture serves everyone, is its main moat. That is a fine trade-off for an MIT tool, but community `sites/` will drift with no verification loop running across users.
- **Anti-bot coverage.** unbrowse detects about 6 vendor challenge types and routes them to the right handler. DESIGN.md has none of this; at minimum, add block detection (6.8).

## 9. Unverified

- How unbrowse's server-side `/v1/reveng` generalizes request bodies and path params. The server is closed; only `reveng-local.ts` was read.
- What the published npm `unbrowse@12.0.0` (53 KB, `dist/cli.js`) actually runs, and whether `libcontract` source is published anywhere.
- Whether unbrowse's `looksLikeSecret` turns x.com's GraphQL queryId path segment into `{id}`. If it does, that would accidentally parameterize the rotating id.
- None of the tools were executed. All behavior described here comes from reading source and prompts.
