# site2api — design v1

Evidence behind every decision: [research/prior-art.md](research/prior-art.md),
[research/api-anything-reuse.md](research/api-anything-reuse.md),
[research/live-probes.md](research/live-probes.md).

## Goal

Turn a website whose only interface is a GUI into operations an agent can call directly
(`x.getUser`, `google-flights.search`), fast and token-cheap, and keep them working when the
site changes, without a human.

## Core idea: one mechanism for create, heal, and fallback

Each operation stores, besides its request template:

- **trigger**: how to make the site's own frontend fire the request. It is a URL template
  (`https://x.com/{screen_name}`), optionally with UI steps or a soft navigation from a neutral page.
- **match**: how to recognize that request in captured traffic, using stable identity only:
  method, host, path with hash-like segments wildcarded, and GraphQL operationName.
  **Never a queryId/doc_id/hash**; putting those in the matcher is what makes rotation unhealable
  (as happened to unbrowse).

One routine, *capture → match → learn*, does three jobs:

1. **Create**: run the trigger with example args, capture, pick the matching request, learn the template.
2. **Heal**: on classified drift, run the trigger with the current args, capture, re-learn,
   validate, save, and retry. No site-specific code.
3. **Fallback**: for reads, the triggered browser run already produced the response. If
   the template can't be replayed (per-request signatures), return that captured response.

Healing is **reactive only**. Always send the stored template first. Never make a
heal/resolve step mandatory before a request (api-anything's X capsule died this way while its
baked queryId still worked).

## Request template = captured request + slots

Store the captured request **verbatim** (method, url, headers, body string) plus a list of
**slots**. A slot says where a value goes, as a path through *decoded layers*:

```jsonc
{ "param": "screen_name", "at": ["query:variables", "json:/screen_name"] }
{ "param": "origin",      "at": ["form:f.req", "json:/1", "json:/0/1/0/0"] }  // JSON inside a JSON string
{ "param": "query",       "at": ["query:q"], "template": "from:{query} lang:en" } // substring of a leaf
{ "ref": "cookie:ct0",    "at": ["header:x-csrf-token"] }
{ "ref": "cookie:JSESSIONID", "transform": "strip-quotes", "at": ["header:csrf-token"] }
{ "ref": "session:x-goog-batchexecute-bgr", "at": ["header:x-goog-batchexecute-bgr"] }
```

Step kinds: `path:<i>` (URL path segment), `query:<key>`, `header:<name>`, `form:<key>`,
`json:<RFC6901 pointer>` (the current string is parsed as JSON), `body` (the whole body).
Filling decodes only the layers a slot touches, sets the value, and re-encodes only those layers.
Untouched bytes stay identical, so RestLi parens, key order and the exact encoding survive.
No `{x}` string interpolation over raw captured text.

A JSON leaf replaced by a param keeps the arg's native type. Params default to type `string`.
Numbers are never coerced beyond 2^53, and `"false"` is false.

## Learning (`learn.ts`)

Input: the captured exchanges plus one or two example arg sets. Output: an Operation.

1. **Pick the request.** Use the `match` if given. Otherwise take the candidates that carry the example
   values (searched at every decoded layer) and return JSON-ish data, drop noise (assets, analytics,
   beacons), and rank them. The agent confirms which one when it's ambiguous.
2. **Decode and substitute.** Walk every decoded layer of URL path, query, form, and JSON (including JSON
   inside strings). A leaf equal to an example value → a slot. A leaf containing it as a
   substring → a slot with a `template`. Example values must be distinct and at least 3 chars. If a value
   appears in several unrelated places, record all of them but warn. (Google Flights reuses the destination as
   the return-leg origin.)
3. **Two-run diff** (create with two example sets, recommended). A position that changes with the args is a
   param. A position that changes although the args did not is a nonce/signature, so the op gets `minTier: 3`.
   Everything else is a constant.
4. **Session references.** A header, query or JSON leaf whose value equals a cookie value (raw,
   quote-stripped, or URL-decoded; ≥ 8 chars) becomes a `cookie:` ref. Auth/anti-bot-looking
   headers (authorization, x-*-token, x-csrf*, x-goog-batchexecute-bgr, x-client-transaction-id)
   become `session:` refs, whose values live in the session store and are refreshed by every capture.
   The spec never holds a credential.
5. **Volatile anchors.** A hash-like literal (queryId path segment, doc_id, persisted hash) gets a
   `volatile` entry recording its shape (charset + length) and a stable **anchor** string next to it
   (the GraphQL operationName or the neighboring path segment). This is what the cheap heal uses.
6. **Headers.** Keep captured per-op headers verbatim (including sec-fetch-*, origin, referer,
   user-agent) minus `:pseudo`, host, content-length, connection, and cookie. Never promote headers to
   site-global: a globally promoted x-twitter-auth-type broke every X guest read.
7. Record `learnedLoggedIn` (whether the session had auth cookies). If the session state differs at
   call time, that is a reason to re-learn rather than trust the template.
8. **Response.** Store the content type, the XSSI prefix to strip (`)]}'`), a suggested `extract` path (the
   richest array/object carrying the example value), and an inferred **shape** (key paths + types)
   for drift detection. The agent may set `pick` (fields per item) for token efficiency.

## Writes

A write must never be performed to learn it. Create/heal for writes runs the UI trigger with
`page.route` intercepting the matched request and **aborting** it before it leaves, then learns
from the intercepted request. A write executes exactly once per call. Retry only on a definite
non-execution (400/401/403/404 with no 2xx); timeouts, 5xx and network errors are ambiguous
and are never retried. Writes need `allowWrites` at every entry point (CLI flag, MCP server flag,
library option).

## Failure classifier (`classify.ts`)

Every response is classified, never by status code alone:

| class | signals | action |
|---|---|---|
| `ok` | 2xx, expected content type, extract path present, no GraphQL `errors` with null `data` | return |
| `drift` | 404/410 on a templated API path, GraphQL "PersistedQueryNotFound"/"must be defined", 400 schema errors, extract path missing, breaking shape change | heal once |
| `auth` | 401/403 with login markers, 200 + HTML login page where JSON expected, `require_login` | refresh session from browser once; then diagnostic "run `site2api login <site>`" |
| `rate` | 429, "please wait", "rate limit" | back off, report; no heal |
| `blocked` | challenge pages (Cloudflare, Akamai, DataDome, PerimeterX, reCAPTCHA), even at 200 | escalate transport tier; then diagnostic `gated` |
| `input` | 400 with validation error mentioning a param | return the error to the caller |
| `error` | anything else | return with details |

Two guards against heal loops. A heal that produces a byte-identical template is not drift. An op healed less than 10 minutes ago that fails again is marked stale for 30 minutes with a reason, not re-healed.

## Execution ladder

| tier | transport | when |
|---|---|---|
| 1 | Node `fetch` + domain/path-scoped cookie jar + session values | default |
| 2 | `fetch()` inside a real page on the site origin (real TLS, cookies, sec-fetch) | tier 1 `blocked`, or op `minTier: 2` |
| 3 | run the trigger in the browser, capture the matched response | op `minTier: 3`, or after a heal fails for reads |

Heal strategies, cheapest first:
- **rescan**: no browser. Fetch the trigger document and the JS bundles it references, find
  a token of the recorded shape within ~300 chars of each volatile anchor, swap it in, and validate.
- **recapture**: run the trigger in the browser, match, re-learn, and validate by replaying at the op's
  tier with the current args (classifier must say `ok` and the extract must resolve).

A healed template is saved to the user's spec dir only after validation. Every heal is
appended to `~/.site2api/heals.jsonl` (op, strategy, diff summary). The lowest tier that
worked is remembered per op.

## Browser

- playwright-core, `channel: "chrome"` (the installed Chrome; no browser download). A persistent
  profile at `~/.site2api/profile`. Headless by default, with the user agent's `HeadlessChrome`
  replaced by `Chrome`. `login` runs headed.
- Capture uses `page.on('response')` and reads bodies **inside the handler** (bodies vanish
  after navigation). The document body is kept raw.
- After every browser run, cookies are exported (full Playwright cookie objects) to
  `~/.site2api/sessions/<site>.json`, together with session values seen in captured headers.
- A per-site minimum interval between network requests (default 1 s) keeps usage at human scale.

## Response extraction and token efficiency

`response.extract` (dot/bracket path) → optional `pick` (list of paths kept per item, or per
object) → a hard output cap with a truncation note. For HTML-only pages, `response.format:
"html"` with a selector recipe `{ items: "<css>", fields: { name: "<css>[@attr]" } }` parsed
in Node. For data embedded in the HTML document (for example Google's `AF_initDataCallback`), `format:
"embedded"` with a regex whose capture group is JSON, followed by `extract`. Seroval/JS-literal
payloads are out of scope for v1.

## Spec files and where they live

One JSON file per site: `{ name, displayName, baseUrl, description, operations[] }`, zod-validated.
Resolution order: `~/.site2api/sites/<site>.json` (user-created and healed copies win) → the
bundled `sites/<site>.json` (community). A heal of a bundled spec writes a user copy.
`site2api export <site>` writes a shareable copy. It strips examples and samples, and it runs
an exact-match secret scan against live jar/session values plus regex heuristics. Public tokens
marked `public: true` by a human are allowed.

## Agent interface

- **CLI** `site2api`:
  - `login <site|url>`
  - `capture <url> [--steps ...] [--interactive]` prints a compact, noise-filtered list of candidate
    requests with ids
  - `add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [--match ...] [--pick ...] [--write]`
  - `call <site> <op> [k=v ...] [--allow-writes]`
  - `verify [site]` (health-checks every read op with its example, healing as needed)
  - `sites`, `ops <site>`, `heal <site> <op>`, `export <site>`, `mcp`
  - All output is JSON-first, compact, and ends with a `next` hint on failure.
- **MCP server** (`site2api mcp`) with fixed meta-tools: `list_sites`, `list_operations`,
  `call_operation`, so the tool list costs the same at 2 sites or 200. Writes are hidden unless
  it is started with `--allow-writes`.
- **Skill** `skills/site2api/SKILL.md`: the create loop (capture → add → call → verify), the
  strict failure loop (follow `next` at most once, then stop and report), and the safety rules.
- **Claude Code plugin** manifest (skill + MCP), plus copy-paste install lines for Codex and other agents.
- Library: `import { call, open } from "site2api"`.

## Non-goals (v1)

TLS impersonation transports, CAPTCHA solving, signature reimplementation, seroval parsing,
a hosted registry or marketplace, typed-client codegen, reading the user's real Chrome cookie DB.
