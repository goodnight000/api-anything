# api-anything — design v1

Evidence behind every decision: [research/prior-art.md](research/prior-art.md),
[research/prototype-reuse.md](research/prototype-reuse.md),
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
`json:<RFC6901 pointer>` (the current string is parsed as JSON), `b64` (the current string is
base64 of JSON), `body` (the whole body). A repeated key's later occurrences are `query[1]:<key>`,
`form[1]:<key>`, and so on. Header names are lower-cased when a spec is parsed.
Filling decodes only the layers a slot touches, sets the value, and re-encodes only those layers.
Untouched bytes stay identical, so RestLi parens, key order and the exact encoding survive.
No `{x}` string interpolation over raw captured text. In a slot `template`, `{{` and `}}` are
literal braces, so a leaf's own text (a minified GraphQL `{name}` selection) survives filling.
A templated slot records how the value is escaped inside its leaf: `escape: "url"` when the leaf
is a URL (a `next=/search?q=...` param, a twice-encoded state, found percent-encoded), so the arg is
percent-encoded; `escape: "json"` inside a JSON string literal (inline GraphQL `search(q: "{q}")`).
Referer and Origin templates are always URL-escaped. No header value is ever sent as non-ASCII.
A body labeled form-urlencoded that is really JSON (Algolia's client does this to skip the CORS
preflight) is walked as `body > json:`.

A JSON leaf replaced by a param keeps the arg's native type, except that a leaf that was a JSON
string stays a string (`"id":"123"` next to `ids:[123]`). Params default to type `string`.
Numbers are never coerced beyond 2^53, and `"false"` is false.

## Learning (`learn.ts`)

Input: the captured exchanges plus one or two example arg sets. Output: an Operation.

1. **Pick the request.** Use the `match` if given (then nothing in the pool counts as noise). Otherwise
   take the candidates that carry the example values (searched at every decoded layer) and return
   JSON-ish data, drop noise (subresource assets, analytics, beacons; a document or XHR whose path ends
   in `.js` is not an asset), and rank them. With a response recipe (`--html`, `--embedded`,
   `--extract`), a candidate the recipe resolves on wins over a beacon that echoes the page URL. The
   agent confirms which one when it's ambiguous.
2. **Decode and substitute.** Walk every decoded layer of URL path, query, form, and JSON (including JSON
   inside strings, base64 JSON, and every occurrence of a repeated key). A leaf equal to an example
   value → a slot. A string leaf containing it (or its percent-encoded form) → a slot with a
   `template`; digits must not touch other digits, and number, flag and null leaves are never partial.
   A leaf equal to one param's value belongs to that param even if another's value is inside it, and
   several params in one leaf are replaced longest first. Headers the browser computes (user-agent,
   accept*, content-type, sec-*) are never slots. A `true`/`false`/`null` example binds only to the
   leaf named like the param. An array or object example binds to the equal JSON container. Example
   values must be distinct and at least 3 chars. If a value appears in several unrelated places,
   record all of them but warn. (Google Flights reuses the destination as the return-leg origin.)
   Referer, Origin and Cookie follow the args, but they are not evidence: an example value found
   nowhere else in the chosen request is an error, since the param would change nothing the server
   reads and every call would silently return the example's data.
3. **Two-run diff** (create with two example sets, recommended). A position that changes with the args is a
   param. A position that changes although the args did not (including the text around the arg in a
   templated leaf, such as a signed URL; browser-computed headers never count) is a nonce/signature, so the op gets `minTier: 3`,
   unless one tier-1 replay of run 1's template with example 2's args still answers ok: then the value is
   session-scoped (Google's `f.sid`), not a signature, and `minTier` stays 1. Everything else is a constant.
4. **Session references.** A header, query or JSON leaf whose value equals a cookie value (raw,
   quote-stripped, or URL-decoded; ≥ 8 chars) becomes a `cookie:` ref. Auth/anti-bot-looking
   headers (authorization, x-*-token, x-csrf*, x-goog-batchexecute-bgr, x-client-transaction-id)
   become `session:` refs, whose values live in the session store and are refreshed by every capture. So do
   per-session fields in forms, queries and JSON bodies (`at`, `fb_dtsg`, `lsd`,
   `authenticity_token`, `csrf*`, `access_token`, `token`, `session_id`), and a header repeating one of
   them (Meta's `x-fb-lsd`) shares its ref. A cookie value inside a longer leaf (`v1:<cookie>`) is a
   templated `cookie:` ref. The spec never holds a credential. At call time a `cookie:` ref takes the
   cookie sent to the request URL, else one of the same registrable domain (country-code second
   levels such as co.uk and shared hosts such as github.io count as suffixes), never another site's. A header a human marks public
   (`add --public authorization` for a web app's shared bearer) stays literal; the op lists it in `public`,
   and export allows it.
5. **Volatile anchors.** A hash-like literal (queryId path segment, doc_id, persisted hash) gets a
   `volatile` entry recording its shape (charset + length) and a stable **anchor** string next to it
   (the GraphQL operationName or the neighboring path segment). This is what the cheap heal uses.
6. **Headers.** Keep captured per-op headers verbatim (including sec-fetch-*, origin, referer,
   user-agent) minus `:pseudo`, host, content-length, connection, cookie, conditional headers
   (`if-none-match` and co., which would turn every replay into a 304), and content-encoding (a
   gzip-compressed request body is captured and stored decoded). Never promote headers to
   site-global: a globally promoted x-twitter-auth-type broke every X guest read.
7. Record `learnedLoggedIn` (whether the session had auth cookies). If an op learned signed in comes
   back without its data and the jar has no login cookie, the call is `auth`, not drift.
8. **Response.** Store the content type, the XSSI prefix to strip (`)]}'`), a suggested `extract` path (the
   richest array/object carrying the example value), and an inferred **shape** (key paths + types)
   for drift detection. The agent may set `pick` (fields per item) for token efficiency.

## Writes

A write must never be performed to learn it. Create/heal for writes runs the UI trigger with a
context-wide route (popups included) that **aborts** before it leaves: every non-GET request, every
request but stylesheets, fonts and media once the UI steps start (a "Follow" button may send a GET,
an upvote may be `new Image().src`, a link, a GET form, JSONP or an iframe), and anything matching a
known write's `match`; WebSocket messages the page sends are dropped too. Service workers are
blocked in the profile, since their fetches bypass routing. The op is learned from the intercepted
request. A read's tier-3 trigger also aborts unsafe requests other than the op's own once its steps
run, so a spec that says "read" can't write. Any 2xx to a write is `ok`, whatever the body (204,
"OK", an HTML page with a password field), because the server took it. A write executes exactly
once per call. Retry only on a definite non-execution (400/401/403/404 answered to the request
itself: after a redirect, as in Post/Redirect/Get, it ran); timeouts, 5xx and network errors are
ambiguous and are never retried. Writes need `allowWrites` at every entry point (CLI flag, MCP
server flag, library option).

## Failure classifier (`classify.ts`)

Every response is classified, never by status code alone:

| class | signals | action |
|---|---|---|
| `ok` | 2xx, expected content type, extract path present, no GraphQL `errors` with null `data` or next to a null extract target; any 2xx to a write | return |
| `drift` | 404/410 on a templated API path, GraphQL "PersistedQueryNotFound"/"must be defined", 400 schema errors, extract path missing, breaking shape change (compared under the extract path; id-keyed maps are `*`) | heal once |
| `auth` | 401, 400/403/422 with login or CSRF markers ("Bad Authentication data"), 419, 200 + HTML login page where JSON expected, `require_login: true`, a trigger that lands on a sign-in page | refresh cookies from the profile; for a read with `session:` refs, one trigger run refreshes them and answers; then diagnostic "run `api-anything login <site>`" |
| `rate` | 429 (with the server's Retry-After), "please wait", "rate limit" | back off, report; no heal |
| `blocked` | challenge pages (Cloudflare, Akamai, DataDome, PerimeterX, AWS WAF, Amazon, Imperva, Kasada, self-solving JS challenges, reCAPTCHA; an interstitial's title even on a big page), even at 200 | escalate transport tier; then diagnostic `gated` |
| `input` | 400 with validation error mentioning a param; 404 with the param in the path; a read's 404, empty 2xx or missing data while the example args still answer; a GraphQL not-found; an unknown arg name | return the error to the caller |
| `error` | anything else (a network error names its cause) | return with details |

Login and rate wording in a 2xx JSON body only counts when the data is missing (Instagram sends
`require_login: false` on its rate-limit answers). **Missing data is ambiguous**: "no such user"
and "no results" look exactly like a moved extract path. Before healing a read, the stored
template is replayed once with the op's example args; if that answers, nothing drifted and the
call returns `input`. This costs one request instead of a browser run. If that replay is
throttled, challenged or logged out, the call stops there with that class and nothing is healed.
If the examples get no data either and re-learning gives the same request, the response recipe
drifted (a renamed field): `drift`, with a hint to re-add with a new `--extract`.

Two guards against heal loops. A heal that produces a byte-identical template (compared with the
same args filled in) is not drift. An op healed less than 10 minutes ago that fails again, or
whose heal failed, is marked stale for 30 minutes with a reason, not re-healed. While stale, a read
still tries its trigger (tier 3), unless the trigger did not answer either. A heal that learned
nothing about the op (its check was rate limited, challenged or logged out, or another process held
the browser profile) stops at once and marks nothing stale.

## Execution ladder

| tier | transport | when |
|---|---|---|
| 1 | Node `fetch` + domain/path-scoped cookie jar + session values; redirects followed by hand (cookies set on a hop ride on the next; credential headers dropped on an origin change); Set-Cookie answers are merged into the jar; the body is decoded with its declared charset | default |
| 2 | `fetch()` inside a real page on the site origin (real TLS, cookies, sec-fetch) | tier 1 `blocked`, or op `minTier: 2` |
| 3 | run the trigger in the browser, capture the matched response | op `minTier: 3`, or after a heal fails for reads |

Heal strategies, cheapest first:
- **rescan**: no browser. Fetch the trigger document and the JS bundles it references (resolved
  against the document's final URL), find a token of the recorded shape within ~300 chars of each
  volatile anchor, swap it in, and validate. The anchor must stand as its own name ("Followers" is
  not inside "FollowersYouKnow"); a token in the anchor's own statement beats a nearer one across a
  `;` or `})` boundary (Meta's previous module); a tie is no answer. For a write, whose validation
  is a real send, only a token that is the single candidate is tried.
- **recapture**: run the trigger in the browser, match, re-learn, and validate by replaying at the op's
  tier (at most 2: at tier 3 the site's own request would answer, validating nothing) with the current
  args (classifier must say `ok` and the extract must resolve). It learns from the call's args with
  defaults filled when they can be located (every param present, 3+ chars, distinct), else from the
  op's examples. A new slot where the arg merely equals the old template's constant there (q=search
  in /api/search) is dropped; a candidate that loses any param's slot is refused. Values of newly
  learned `session:` refs are stored before the check.

A healed template is saved to the user's spec dir only after validation. Every heal is
appended to `~/.api-anything/heals.jsonl` (op, strategy, diff summary). A tier an op escalated to
(above its own `minTier`) is remembered per op as a speed hint (a lower `--max-tier` still tries
its own tier), and a call that ran above tier 1 says why in `reason`. The jar, `state.json` and a
healed spec are read-modify-written under a lock file, so concurrent processes lose nothing.
Tier 2 honours `timeoutMs`; when the origin's root redirects to another origin, it fetches from a
blank stand-in page on the request's origin. The tier-3 answer is the matching request that carries
the call's args and judges ok (a `softFrom` page fires its own; a WAF interstitial precedes the page).

## Browser

- playwright-core, `channel: "chrome"` (the installed Chrome; no browser download). A persistent
  profile at `~/.api-anything/profile`. Headless by default, with the user agent's `HeadlessChrome`
  replaced by `Chrome`. `login` runs headed.
- Capture listens on the context, keeps the run's own pages and the popups they open (closed
  afterwards), and reads bodies **inside the response handler** (bodies vanish after navigation).
  The document body is kept raw. Pages load to `domcontentloaded` (a hung tracker or a download URL
  doesn't fail the run). The run waits for the network to go quiet, ignoring streams, an endpoint's
  repeats (beacons, polling) and requests open over 3 s; with an op's match it ends soon after that
  request answers; with no XHR yet it waits up to 2 s more for a deferred one.
- Chrome locks a profile to one process. The browser is released after 3 s idle, and a second
  process waits up to 15 s for the profile before it fails with a short hint. SIGTERM exits.
- After every browser run, cookies are exported (full Playwright cookie objects) to
  `~/.api-anything/sessions/<site>.json`, together with session values seen in captured headers.
- `softFrom` loads the neutral page, then navigates in-app: a link the app rendered is clicked
  (its router handles it); otherwise `history.pushState` + `popstate`, which client routers listen
  to. Only if nothing fired does it load the URL. An injected `<a>` is not routed by React Router,
  TanStack or Comet, so it would be a second full page load that fires no data XHR.
- Service workers are blocked in the profile: their fetches bypass routing and capture.
- A per-site minimum interval between network requests (default 1 s) keeps usage at human scale.

## Response extraction and token efficiency

`response.extract` (dot/bracket path) → optional `pick` (list of paths kept per item, or per
object) → a hard output cap with a truncation note. Arrays are cut at an item boundary, an item too
big on its own is cut rather than dropped, strings are cut as strings, and objects stay objects. For HTML-only pages, `response.format:
"html"` with a selector recipe `{ items: "<css>", fields: { name: "<css>[@attr]" } }` parsed
in Node. For data embedded in the HTML document (for example Google's `AF_initDataCallback`), `format:
"embedded"` with a regex whose capture group is JSON, followed by `extract`. Seroval/JS-literal
payloads are out of scope for v1.

## Spec files and where they live

One JSON file per site: `{ name, displayName, baseUrl, description, operations[] }`, zod-validated.
Site names are case-insensitive (lower-cased), so one file never gets two sets of state.
Resolution order: `~/.api-anything/sites/<site>.json` (user-created and healed copies win) → the
bundled `sites/<site>.json` (community). A heal of a bundled spec writes a user copy.
`api-anything export <site>` writes a shareable copy. It strips examples (unless `--keep-examples`:
a human confirmed they are public, so `verify` works for others) and samples (response shapes,
whose keys can be user data; typed example values in the request become null), and it runs an
exact-match secret scan against live jar/session values (also found percent-encoded or
JSON-escaped in the spec) plus regex heuristics. Headers an op
lists in `public` (marked by a human) are allowed.

## Logging in (`login.ts`, `import.ts`)

The easiest sign-in is the one the user already did. `api-anything login <site|url>` by default
**imports** that site's cookies from the user's everyday browser, so there is no password to type
and no 2FA/captcha to redo — the human solved those in their own browser already.

- **Chromium family** (Chrome, Arc, Brave, Edge, Chromium, Vivaldi; macOS + Linux). The cookie DB
  is copied to a temp dir first (the browser holds it open), then read with `node:sqlite`. Cookie
  *names* are plaintext, so the right profile is chosen with no decryption and no Keychain prompt;
  only the chosen profile's *values* are decrypted, so at most one macOS Keychain dialog appears.
  Values are `v10`-prefixed AES-128-CBC (IV = 16 spaces) under PBKDF2-SHA1(password, `"saltysalt"`,
  1003, 16). The password is the "<Browser> Safe Storage" Keychain item on macOS, `"peanuts"` (1
  iteration) for Linux v10. When the DB's `meta.version >= 24` the plaintext is prefixed by a 32-byte
  SHA-256 of `host_key`, which is stripped. `expires_utc` is microseconds since 1601.
- **Firefox**: `cookies.sqlite` `moz_cookies` is plaintext on every OS.
- **Windows chromium** uses app-bound encryption and is not supported: `login` falls back to the window.
- **Profile choice**: scan every profile of every installed browser; pick the one that has the
  site's `loginCookies` (or, for an unknown site, the most recently used profile with cookies for the
  site). `--profile "Chrome/Profile 2"` overrides. Only cookies whose domain is the site's are read.
  The chosen source (`"chrome:Profile 2"`, `"window"`, `"file"`) is recorded in the session file.
- Imported cookies go into the jar **and** into api-anything's own Chrome profile (`addCookies`), so
  tier 2/3 and heals are logged in too.
- `--window` opens a visible Chrome window on api-anything's profile for a by-hand sign-in (an
  independent session). It is also the automatic fallback when nothing is importable.
- `--cookies <file>` imports a `cookies.txt` (Netscape) or JSON array (Cookie-Editor / Playwright)
  export, for servers/CI with no browser.
- **Self-healing auth**: when a call classifies `auth` and the session came from a browser import,
  the same profile is silently re-imported once (browserless) and the call retried; only if it is
  still `auth` does the result carry the "run `api-anything login`" hint.
- **`logout <site>`** clears the jar and that site's cookies in the profile.

`node:sqlite` is chosen over the `sqlite3` CLI: it is built in (no dependency, present on every
Node ≥ 22.13, which the `engines` floor now requires; its one ExperimentalWarning is silenced) and
returns the encrypted BLOB as bytes directly, where the CLI would need `hex()` plus escaping of
binary output. An imported session is the **same** session as the everyday browser: if the site
revokes it, both are logged out, so heavy headless automation on it is avoided; `--window` is the
independent alternative.

## Agent interface

- **CLI** `api-anything`:
  - `login <site|url> [--profile "Chrome/Profile 2"] [--window] [--cookies <file>]`, `logout <site>`
  - `capture <url> [--steps ...] [--interactive]` prints a compact, noise-filtered list of candidate
    requests with ids
  - `add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [--match ...] [--pick ...] [--write]`
  - `call <site> <op> [k=v ...] [--allow-writes]`
  - `inspect <captureId> [requestId]` reads a saved capture with no browser: a response at a path, or
    the items an `--html`/`--embedded` recipe would return. Every `add` saves its trigger runs as
    captures, so `add --from <id>` re-learns (a fixed `--extract`) without Chrome.
  - `verify [site]` (health-checks every read op with its example, healing as needed)
  - `sites`, `ops <site>`, `heal <site> <op>`, `export <site>`, `mcp`
  - All output is JSON-first, compact, and ends with a `next` hint on failure.
- **MCP server** (`api-anything mcp`) with fixed meta-tools: `list_sites`, `list_operations`,
  `call_operation`, and `login` (so an agent can fix an `auth` failure itself: mode import or
  window), so the tool list costs the same at 2 sites or 200. Writes are hidden unless
  it is started with `--allow-writes`.
- **Skill** `skills/api-anything/SKILL.md`: the create loop (capture → add → call → verify), the
  strict failure loop (follow `next` at most once, then stop and report), and the safety rules.
- **Claude Code plugin** manifest (skill + MCP), plus copy-paste install lines for Codex and other agents.
- Library: `import { call, open } from "api-anything"`.

## Non-goals (v1)

TLS impersonation transports, CAPTCHA solving, signature reimplementation, seroval parsing,
a hosted registry or marketplace, typed-client codegen, and Windows app-bound cookie decryption
(login falls back to `--window` there).
