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
  method, host, path with hash-like segments and the segments a param or a ref fills wildcarded, and GraphQL operationName.
  **Never a queryId/doc_id/hash**; putting those in the matcher is what makes rotation unhealable
  (as happened to unbrowse).

One routine, *capture → match → learn*, does three jobs:

1. **Create**: run the trigger with example args, capture, pick the matching request, learn the template.
2. **Heal**: on classified drift, run the trigger with the current args, capture, re-learn,
   validate, save, and retry. A moved parameter can heal, but a change to its established encoding
   requires re-adding the operation to confirm its meaning. No site-specific code.
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
`form[1]:<key>`, and so on. A JSON object has no such form: a pointer reaches a key's first occurrence
only. The walk reads every occurrence, so learning knows what any of them would be, and refuses the request
where a repeated key is, or holds, a param, a session reference or a volatile anchor in any occurrence
(`{"token":A,"token":B}`): the later value could be neither blanked nor filled. A repeated key that is none of
those is a constant and is sent as captured, byte for byte (`{"limit":1,"limit":2}`). Header names are lower-cased when a spec is parsed.
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
A param may declare `pattern` (a regex the whole value must match) and `hint` (what a valid value
is, "a date as YYYY-MM-DD"): an arg that fails it is `input`, named with the hint, and nothing is sent.
A numeric string whose exact value is past the largest safe integer (2^53 − 1) is never rounded: plain digits are sent exactly, and any other form (an
exponent, a decimal point: `9007199254740993e0`) is `input`, saying so, with nothing sent. `"false"` is false.

## Learning (`learn.ts`)

Input: the captured exchanges plus one or two example arg sets. Output: an Operation.

1. **Pick the request.** Use the `match` if given (then nothing in the pool counts as noise). Otherwise
   take the candidates that carry the example values (searched at every decoded layer) and return
   JSON-ish data, drop noise (subresource assets, analytics, beacons; a document or XHR whose path ends
   in `.js` is not an asset), and rank them. A data-less answer (empty 2xx, `{"success":true}`, `OK`)
   ranks below every real answer: a read's answer is data. With a response recipe (`--html`, `--embedded`,
   `--extract`), a candidate the recipe resolves on wins over a beacon that echoes the page URL. The
   agent confirms which one when it's ambiguous. A read picked this way whose answer is data-less
   and does not carry an example value is refused (an analytics beacon's ack whose echo of the page
   went unrecognized), with a hint to `--pick-request` the data request or learn the document with
   `--html`/`--embedded`; a request picked by id or pinned by `match` is the agent's call.
2. **Decode and substitute.** Walk every decoded layer of URL path, query, form, and JSON (including JSON
   inside strings, base64 JSON, and every occurrence of a repeated key). A leaf equal to an example
   value → a slot. A string leaf containing it (or its percent-encoded form) → a slot with a
   `template`; digits must not touch other digits, and number, flag and null leaves are never partial.
   A leaf equal to one param's value belongs to that param even if another's value is inside it, and
   several params in one leaf are replaced longest first. Headers the browser computes (user-agent,
   accept*, content-type, sec-*) are never slots. A `true`/`false`/`null` example binds only to the
   leaf named like the param, even when it is the only such flag. An array or object example binds to the equal JSON container. Example
   values must be distinct and at least 3 chars: a shorter one found by substring in one capture is ambiguous.
   A shorter value (`US`, `page=2`, a small enum) is accepted only with a second example that differs, and its
   run. A param with a short value in either example (`USA`, then `US`) is then placed only where a whole decoded leaf equals its value in run 1 and equals the other example at the
   same place in run 2, never inside a longer leaf; a leaf that equals it and does not follow (`gl=US` on every
   request, `size: 2` beside `page: 2`) is no slot. The same both-runs match says which request carries it, endpoint by endpoint:
   run 2's evidence counts for the request with the same method, host and path (a path segment may differ the way the
   examples do), so another endpoint's `country=CA` does not vouch for a feed that always asks for `US`.
   Without that evidence the example is refused, with a hint to pass a second one. A known limit: two leaves that both
   follow the examples (`{"page":1,"counter":1}`, then `{"page":2,"counter":2}`) both become slots for the param, with
   the warning below; two runs cannot tell them apart. If a value appears in several unrelated places,
   record all of them but warn. (Google Flights reuses the destination as the return-leg origin.)
   A short example (4 chars or fewer, "SFO") inside a random-looking leaf counts only where it
   stands alone between non-alphanumerics: inside a base64 blob it is chance.
   Referer, Origin, Cookie and any other echo of the page's location follow the args, but they are
   not evidence: an example value found nowhere else in the chosen request is an error, since the
   param would change nothing the server reads and every call would silently return the example's
   data. An echo is found structurally from the capture's page URLs (its documents, every Referer,
   the filled trigger, and every location the page's main frame had, history API changes and the
   final URL included, since an SPA's pushState URL is in no document and a cross-origin Referer
   is origin-only): a leaf holding the page's href or origin anywhere, or starting with its path
   or search string, at any percent-encoding depth (analytics `context.page.url`, `x-page-path`,
   `src=`/`redirect=` params). A request whose only hits are echoes (a Segment-style beacon) is no
   candidate. A request the agent picked by id (`--pick-request`) is exempt: its echo-shaped leaf
   is evidence (a route resolver posting `{path:"/facebook/react"}`). `--match` is not, since heals
   pass it too. An example found raw in a URL leaf is filled percent-encoded, unless encoding would
   change it (the slash in `/facebook/react`): then the leaf evidently holds it raw.
3. **Two-run diff** (create with two example sets, recommended). A position that changes with the args is a
   param. A position that changes although the args did not (including the text around the arg in a
   templated leaf, such as a signed URL; browser-computed headers never count) is a nonce/signature, so the op gets `minTier: 3`,
   unless one tier-1 replay of run 1's template with example 2's args still answers ok: then the value is
   session-scoped (Google's `f.sid`), not a signature, and `minTier` stays 1. Everything else is a constant.
   That includes a place step 2 gave a param which stays as it was although the param changed (the endpoint's own
   segment in `/api/search?q=search`, when example 2 is `q=kitten`): run 2 disproves it, so it is no slot, and learning
   runs again without it, which makes the leaf a constant to every step (the match names the segment, a credential in
   it is found). A param left with no place is an error, not a warning. This covers params whose example is a
   string, number or flag. An object or array param is outside it: its places are not checked against run 2, so a
   copy of it elsewhere in the request that did not follow stays a slot, and the leaves inside it, which change with
   the example, are read as nonces (`minTier: 3`). Run 2's request is chosen on the evidence
   run 1's was: what the response recipe reads, when there is one, and for a read an answer that is data: a captured 2xx,
   not a bare acknowledgement, an error, or a request nobody answered (unless run 1's own answer, pinned by the caller, is no data either). Among the requests that pass, the one on run 1's own path that carries the args comes first (the
   wildcard a false path param puts in the match fits sibling endpoints too). When none passes, run 2 disproves nothing.
4. **Session references.** A header, query or JSON leaf whose value equals a cookie value (raw,
   quote-stripped, or URL-decoded; ≥ 8 chars) becomes a `cookie:` ref. Capture also snapshots the
   final page origin's localStorage and sessionStorage; a leaf equal to a stored value (or to a
   string inside a JSON entry, as auth SDKs keep tokens; ≥ 8 chars) becomes a `session:` ref named
   after the storage key. The leaf's own name changes none of this: under a persisted-query key (`sha256Hash`,
   `doc_id`, `queryId`, `hash`) a cookie or stored value is a ref as anywhere else, whole or inside the leaf, since a
   token the page stores and sends as `queryId` reads exactly like a query id it caches there. So a query id the app
   keeps in storage is a `session:` ref too; only one that is in no cookie and no storage stays a volatile anchor. A key or header named like a credential (its words: token, secret, key,
   auth, sess(ion), sid, signature, password, credential; "author" is not) with a random-looking
   value (≥ 16 chars, two character classes, ≥ 3 bits/char) is a `session:` ref too, unless the site
   ships that value in a static bundle to every visitor (a public API key): then it stays
   literal and is listed in `public`. A static bundle is a GET script that shared caches may keep
   (not `private`/`no-store`), fetched without the user's cookies or marked `public`/`immutable`;
   a per-user script sent with the session cookie proves nothing. A random value (≥ 16 chars, as
   above) that an earlier response of the same capture holds (a bootstrap JSON, a per-user config
   script, a token in the document; not a static bundle) is server-issued: a `session:` ref named
   after its leaf, whatever the name. This rule leaves hash-like path segments and persisted-query keys
   alone: issued, but in no cookie and no storage, they stay volatile anchors. Like every `session:` ref it is refreshed by each trigger run; when it
   expires, tier 1 answers `auth` or a bare 403, and the ladder's tier-3 run (below) re-derives it
   and answers the call, so it needs no `minTier` of its own. Auth/anti-bot-looking
   headers (authorization, x-*-token, x-csrf*, x-goog-batchexecute-bgr, x-client-transaction-id)
   become `session:` refs, whose values live in the session store and are refreshed by every capture. So do
   per-session fields in forms, queries and JSON bodies (`at`, `fb_dtsg`, `lsd`,
   `authenticity_token`, `csrf*`, `access_token`, `token`, `session_id`), and a header repeating one of
   them (Meta's `x-fb-lsd`) shares its ref. A cookie or stored value (≥ 16 chars) inside a longer
   leaf (`v1:<cookie>`, percent-encoded in a `next=` URL, JSON-escaped) is a templated ref that
   re-encodes it the same way; in a leaf that also holds an arg (`next=/search?q={q}&auth=<cookie>`)
   it is a `{cookie:x}` hole in the param's template, filled at call time. A hole is filled with the value as
   stored; only a ref slot's own value takes a `transform`. So a cookie that could only be a hole and sits
   there unquoted or URL-decoded has no safe form, and learning refuses the request rather than keep its text. When that slot has no
   escape of its own and the value sits there percent- or JSON-encoded, the slot takes that escape. The text then left
   around the holes of a param's leaf may be a credential beside the arg. Under a per-session field or header name
   (`token`, `x-csrf-token`) it is one from 8 characters on, as a whole leaf there is (`token=kittens.<token>`). Under any
   other name, one that only reads like a credential's included (`cache_key`, `api_key`), it is one only when a piece of
   it, without the separators next to the hole, is a token and nothing else: one unbroken run of 16 or more characters
   of the hex or URL-safe base64 alphabet that is random-looking (`api_key=<token>:kittens`). Text with separators inside
   it is structure and stays (`cache_key=query:{q}:page:1:sort:relevance`, a path), and so are words and numbers joined
   by `-` or `_` (a slug). A credential there refuses the request. It is not made a hole, because no later capture
   could tell where the arg ends and the credential begins (`red.fox.<token>`), and a refresh would store the wrong
   text. The rule goes by shape, so it also refuses a public id or hash that stands alone beside the arg
   (`/<docId>/kittens`, `rev=kittens@<hash>`); the caller can mark the name public when the text is the same for every
   visitor. A capture refreshes a
   templated `session:` value from its place in the leaf. A `session:` value the page later sends empty is not
   refreshed: the stored one is kept. Slots never overlap, and a container that is a
   session value is never serialized in part. A container is a string that holds JSON, as it is or in base64. One that
   is a session value as a whole (a header named like a credential, a value equal to a cookie, a value the page also
   keeps in storage under any key) is one ref: blank in the spec and sent whole from the session at call time, so no
   key, no short leaf and no encoding of its text reaches the spec. The refs found inside it are dropped. A param
   inside it could not be filled on replay, so the learn is refused: the error names the container and the param.
   Where the container is one only by its header's name (it is in no cookie and no storage), the way on is to mark
   it public (`--public x-csrf-token`) when the rest of it is the same for every visitor: it then stays as captured,
   with the param inside it filled and any cookie or stored value inside it still a ref. Otherwise learn another
   request. A container that is a cookie or a stored value as a whole (a body the page saved) has only that second
   way: it is a ref under a public name too, and the error does not offer the mark. Only a header is a session value by its name alone: a
   container under a credential-like field name is judged leaf by leaf. A stored value counts as a credential under a credential's name or when it is random-looking, in any
   entry that holds it and whatever the entries' order; a stored JSON text by its key, and each string in it on its
   own. A stored setting sent under a credential's name in the request (`token=<it>`) counts too. Newly learned session references are scoped by operation, with distinct request positions
   for different tokens that share a name: one name never means two values, wherever the second was
   found (a storage entry called `token` inside `v1:<value>`, next to a `token` field holding another). All discovered credentials participate in compound-copy
   removal. Learning ends with one check behind all of these rules: the save-time secret scan, run over the stored
   request and the slot templates. It looks for credentials, not for everything live: every cookie (the jar's and
   the request's own Cookie header); the `session:` values that are credentials (found by name or as issued, stored as
   one, or sent under a credential's name), those of refs dropped from inside a container sent whole included; and
   the stored values that are credentials, whether or not anything made them refs. One exception, in this check only: a
   stored value that is a credential by its storage key's name alone (`token: "solarized-dark"`), neither random-looking
   nor shaped like a token (a JWT, a bearer, a long hex or base64 blob), does not refuse the learn, since the check
   fires only for a copy that could not be a ref and the text is then kept as captured; where it can be a ref it still
   is one. That lets through a short token (under 16 characters) kept under such a key and copied where no pass
   reaches it. A stored setting
   (a theme, a locale) is not looked for, also when a leaf that equals it made it a ref: a ref keeps a value fresh,
   it does not make it secret. A copy no rule could turn into a ref (too short to template, base64, percent-encoded
   twice) fails the learn, closed, and the error names the leaf that holds it. No name exempts a leaf, one marked
   public included; exempt is only the caller's own example, for stored values. Add and heal
   run the scan again before saving, against the site's whole session (every stored session value, settings too), and refuse to save any spec that still contains one.
   What the scan finds is a copy of a value it is given, 6 characters or longer, as it is or unquoted or URL-decoded:
   in the text; in what the text decodes to, through up to three layers of percent-encoding, JSON escapes and base64
   runs of 16 characters or more decoded whole; and as the value's own base64 encoding at any byte offset, in the
   standard and the URL-safe alphabet (a six-character value's eight characters, an encoding that follows other text).
   That last search only says where to look: the text there is decoded at that offset and must hold the value's bytes,
   so a match is always a copy of the value, never another one that encodes alike (`xqbcdef` beside `abcdef`).
   It does not prove a spec holds no credential. These can still reach one: a cookie or value under
   6 characters; a credential that is a number (a number leaf is never a ref, and digits alone are not random-looking, so
   one is caught only as a copy of a known value); a credential split across two leaves; a copy behind more encoding
   than that (four layers, base64 twice after other text, hex); a cookie that only the second run's request carried and the jar does not hold; a value under a
   credential's name that is too plain for the name's rule (under 8 characters for a per-session name, not random-looking
   for a credential-like one); beside a param under a name that is not per-session, a token with separators in it or
   around it in the same piece (a JWT's dots, standard base64's `+` and `/`, `auth=<token>` after other text) or under
   16 characters; and a credential no rule recognizes (not a cookie, not stored, not named like one, not issued by an
   earlier answer). Export scans a
   spec again, by name and by shape, before it is shared. At call time a `cookie:` ref takes the
   cookie sent to the request URL, else one of the same registrable domain (by the Public Suffix
   List, private section included: co.uk, github.io and run.app are suffixes), never another site's.
   The same `siteOf` scopes Set-Cookie domains, the profile's exported cookies and browser import. A header or field name a human marks public
   (`add --public authorization` for a web app's shared bearer) is listed by the op in `public`
   and keeps literal what these rules would take by that name: a header by its name (`authorization`, `x-csrf-token`),
   a credential-like name over a random-looking value (`api_key`), a value an earlier answer issued, the text beside
   a param. It exempts nothing else. A per-session field (`token`, `csrf`, `at`: the list above) is a ref under a
   public name too. A public leaf that equals or embeds a cookie or a stored value becomes its ref as anywhere else,
   whatever the stored value looks like: a name or entropy rule that does not fire is no proof a stored value is
   safe to keep. One that holds a cookie or a stored credential in a form no rule can make a ref (too short, base64)
   fails the final check. The save-time scan (`heal.ts`) and export still waive a public header whole, and no other public name.
   Learning runs first on every add and recapture, so a public header reaches them holding no cookie and no stored
   credential the scan can find; a public query or body field that holds a session value another operation of the site stored
   learns, and `add` then refuses to save it.
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
an upvote may be `new Image().src`, a link, a GET form, JSONP or an iframe), those too when they are
the site's own endpoint in disguise (same site, and no asset extension or a query carrying an
example value: `<link rel=stylesheet href=/api/vote?id=..>`), and anything matching a
known write's `match`; WebSocket messages any of the run's pages sends (a popup's too: the socket
route is context-wide) are dropped too. The guards are lifted only after the run's pages are closed:
an open page still sends (a client's retry; Chrome reloads an aborted navigation's error page after
about a second), and removing a route releases the requests paused in it. Service workers are
blocked in the profile, since their fetches bypass routing. The op is learned from the intercepted
request. A read's tier-3 trigger also aborts unsafe requests other than the op's own once its steps
run, so a spec that says "read" can't write. While the page is a bot challenge's interstitial the
steps are not running yet: its own verify POSTs (AWS WAF's `mp_verify`, Cloudflare's
`/cdn-cgi/challenge-platform`) go through, or it would never reload; the guard applies from the real
document on. Any 2xx to a write is `ok`, whatever the body (204,
"OK", an HTML page with a password field), because the server took it, with one exception: a
sign-in form (a password field next to a username field, or a form posting to a login path) where
the op's answer is not a page is `auth`: the session was gone and nothing ran. An explicit JSON `ok: false` or `success: false` rejects a write even with HTTP 200.
A write executes exactly
once per call. Retry only on a definite non-execution (400/401/403/404 answered to the request
itself: after a redirect, as in Post/Redirect/Get, it ran; at tier 3 the page sent it, and the
answer judged may be a redirect's follow-up, so a tier-3 write is never retried); timeouts, 5xx and network errors are
ambiguous and are never retried. Writes need `allowWrites` at every entry point (CLI flag, MCP
server flag, library option).

## Failure classifier (`classify.ts`)

Every response is classified, never by status code alone:

| class | signals | action |
|---|---|---|
| `ok` | 2xx, expected content type, extract path present (an empty list there is a search with no results: `data: []`; for an html recipe whose items selector is `<container> <item>`, the container present with no element of the item's tag), no GraphQL `errors` with null `data` or next to a null extract target; any 2xx to a write | return |
| `drift` | 404/410 on a templated API path, GraphQL "PersistedQueryNotFound"/"must be defined", 400 schema errors, extract path missing, breaking shape change (compared under the extract path; id-keyed maps are `*`) | heal once |
| `auth` | 401, 400/403/422 with login wording ("Bad Authentication data") or an explicit CSRF failure (token missing/invalid/mismatch, verification failed, InvalidAuthenticityToken; not a page that merely carries a csrf field), a 403 login page, 419, 200 + HTML login page where JSON expected, a sign-in form that embeds a CAPTCHA widget or a vendor script that also rides on ordinary pages (reCAPTCHA on a login page guards the login; an interstitial's own markers still make the page `blocked`), an html/embedded op's page without its data that says "sign in" or shows a sign-in form (a mere Sign-in link, like Google's ServiceLogin button, is not one), a redirect to a login path, `require_login: true`, a trigger that lands on a sign-in page | once per call, at any tier (a write only when it certainly did not run, so never at tier 3): re-import a browser-imported session; else refresh the jar's cookies from the profile, retrying if that changes the request (a tier-2 page sends the profile's cookies itself, so there only a `cookie:` ref counts: an `x-csrf-token` header); for a read with `session:` refs, one trigger run refreshes them and answers; then diagnostic "run `api-anything login <site>`" |
| `rate` | 429 (with the server's Retry-After), "please wait", "rate limit" | back off, report; no heal |
| `blocked` | challenge pages (Cloudflare, Akamai, DataDome, PerimeterX, AWS WAF, Amazon, Imperva, Kasada, self-solving JS challenges, reCAPTCHA; an interstitial's title even on a big page, unless the op's html/embedded recipe finds its data there: "Robot check-in: how our robots work"), even at 200. The interstitial's own structure counts at any status; a vendor script that also rides on ordinary pages (AWS WAF's challenge.js, DataDome's tags.js, Imperva's resource script, Kasada's ips.js and `x-kpsdk-*` headers) counts only on a challenge status (202, 403, 405, 429, 503); a bare 403 with no markers. A page showing a sign-in form is `auth`, not a wall, when its only challenge marker is one that also rides on ordinary pages (a CAPTCHA widget, a vendor script or header on a challenge status); an interstitial's own structure or title on that page is still a wall | escalate transport tier; then diagnostic `gated`. A read's bare 403 first replays the example args once at the same tier: if they answer, the call is `input` (a private or missing entity), with no climb and no heal |
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
| 1 | Node `fetch` + domain/path-scoped cookie jar + session values; redirects followed by hand (cookies set on a hop ride on the next; credential headers dropped on an origin change; a hop to another origin that would carry a `session:`/`cookie:` value in its body or URL is not taken, and the call fails naming the redirect); Set-Cookie answers are merged into the jar; the body is decoded with its declared charset | default |
| 2 | `fetch()` inside a real page on the site origin (real TLS, cookies, sec-fetch) | tier 1 `blocked`, or op `minTier: 2` |
| 3 | run the trigger in the browser, capture the matched response | op `minTier: 3`, or after a heal fails for reads |

Heal strategies, cheapest first:
- **rescan**: no browser. Fetch the trigger document and the JS bundles it references (resolved
  against the document's final URL), find a token of the recorded shape within ~300 chars of each
  volatile anchor, swap it in, and validate. The anchor must stand as its own name ("Followers" is
  not inside "FollowersYouKnow"), and an occurrence in code beats one in prose (whitespace next to
  it, a log message). A token in the anchor's own group beats a nearer one outside it: between them
  no bracket closes the group and no `;` ends a statement at that level (Meta's previous module
  ends in `}),null);`, while its own `"use strict";` is nested); a tie is no answer. For a write, whose validation
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
spec (every add and heal, re-read under the lock) are read-modify-written under a lock file, so
concurrent processes and calls lose nothing.
Tier 2 honours `timeoutMs` (the wait for the site's answer, as at tier 1; starting Chrome is not
counted); when the origin's root redirects to another origin, it fetches from a
blank stand-in page on the request's origin. When the origin page navigates mid-fetch (its own
challenge or redirect destroys the context), a read waits for the new document and fetches once
more; a write is never resent. The tier-3 answer is the matching request whose declared parameter positions equal the
materialized call, including short and structured values, and whose response judges ok (a `softFrom` page fires its own; a WAF interstitial precedes the page).
A param's default is filled into the args once, before the first tier, so every tier runs with the
same values: the tier-3 trigger opens `?count=20`, never a literal `{count}`.
An `auth` answer starts recovery at whichever tier got it (an op with `minTier: 2` or `3`, or one a
remembered escalation starts there), at most once per call. At tier 3 only the re-import applies,
and only to a read: the page just ran with the profile's own cookies and session values, so there is
nothing fresher to take, and a write the page sent is never sent again.

## Browser

- playwright-core, `channel: "chrome"` (the installed Chrome; no browser download). A persistent
  profile at `~/.api-anything/profile`. Headless by default, with the user agent's `HeadlessChrome`
  replaced by `Chrome`. `login` runs headed.
- Capture listens on the context, keeps the run's own pages and the popups they open (closed
  afterwards), and reads bodies **inside the response handler** (bodies vanish after navigation).
  The document body is kept raw. Pages load to `domcontentloaded` (a hung tracker or a download URL
  doesn't fail the run). The run waits for the network to go quiet, ignoring streams, an endpoint's
  repeats (beacons, polling), requests open over 3 s, and the previous document's requests once the
  page starts a new one (they never finish; their bodies get 2 s); with an op's match it ends soon after that
  request answers; with no XHR yet it waits up to 2 s more for a deferred one. When the page it
  ended on is a bot challenge's interstitial (a JS challenge that solves itself, often after a second
  or more), it waits up to 15 s for the real document, then waits for its data as before; UI steps
  wait for it the same way before they run. It records every URL the main frame had (history API
  changes included) as the capture's `locations`.
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

`response.extract` (dot/bracket path; `[*]` maps the rest over an array and flattens one level, skipping items without it, undefined when none has it) → optional `pick` (list of paths kept per item, or per
object; `name=path` renames, `name=path~regex` keeps what the regex's group 1 finds in a string; a picked item left empty, such as a shelf or an ad, is dropped) → a hard output cap (the
result is never over it) with a truncation note that says what was cut. Arrays are cut at an item
boundary, an item too big on its own is cut rather than dropped, strings are cut as strings, and
objects stay objects: members above a common size cap are shortened, then trailing members are
dropped. It runs in about linear time on 10k-member objects. For HTML-only pages, `response.format:
"html"` with a selector recipe `{ items: "<css>", fields: { name: "<css>[@attr]" } }` parsed
in Node; a field written `all:<css>[@attr]` returns every match as a list (a book's genres). For data embedded in the HTML document (for example Google's `AF_initDataCallback`), `format:
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
exact-match secret scan against live jar/session values, found under any encoding the spec may
carry them in (percent-encoded up to three layers, JSON- or `\u`-escaped, base64), plus regex
heuristics. It also refuses any literal the learner would have made a ref (a session field or
header, a random value under a credential's name), and warns about a literal IP address (a client
`remoteHost` the page reported), whole or inside a longer leaf (`ip:port`, an x-forwarded-for list,
`ip=` text; a version string after a letter or `/`, or one ending in `.0`, is not one). Names an op lists in `public` are allowed.

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
- **Profile choice**: scan every profile of every installed browser for the site's `loginCookies`
  (for an unknown site, auth-looking cookie names, else any cookie for the site). One profile holds
  them: it is used. Several do (a work and a personal profile, or another person's account in the
  same Chrome): never a guess. `login` answers `ok: false` with each candidate's profile, display name
  and Google account email (from Chrome's `Local State` `profile.info_cache`) and a `next` of
  `api-anything login <site> --profile "<Browser/Profile>"`. Only cookies whose domain is the site's
  are read. The chosen source (`"chrome:Profile 1"`, `"window"`, `"file"`) is recorded in the session
  file, and success prints the profile's display name and account.
- **Targets**: a site name, a domain (`linkedin.com`, `www.linkedin.com`) or a URL. A domain or URL
  on a known site's baseUrl host (with or without `www.`) is that site; any other becomes a site
  named after its host.
- Imported cookies go into the jar **and** into api-anything's own Chrome profile (`addCookies`), so
  tier 2/3 and heals are logged in too.
- `--window` opens a visible Chrome window on api-anything's profile for a by-hand sign-in (an
  independent session). It is also the automatic fallback when nothing is importable.
- `--cookies <file>` imports a `cookies.txt` (Netscape) or JSON array (Cookie-Editor / Playwright)
  export, for servers/CI with no browser.
- **Self-healing auth**: when a call classifies `auth` and the session came from a browser import,
  exactly the recorded profile is silently re-imported once (browserless) and the call retried (a write
  only when it certainly did not run, so never one the page sent at tier 3); only if it is
  still `auth` does the result carry the "run `api-anything login`" hint. This runs at tiers 2 and 3 as at
  tier 1: the import also lands in the Chrome profile those tiers send their cookies from.
- **`logout <site>`** clears the jar and that site's cookies in the profile.

`node:sqlite` is chosen over the `sqlite3` CLI: it is built in (no dependency, present on every
Node ≥ 22.13, which the `engines` floor now requires; its one ExperimentalWarning is silenced) and
returns the encrypted BLOB as bytes directly, where the CLI would need `hex()` plus escaping of
binary output. An imported session is the **same** session as the everyday browser: if the site
revokes it, both are logged out, so heavy headless automation on it is avoided; `--window` is the
independent alternative.

## Agent interface

- **CLI** `api-anything`:
  - `login <site|url> [--profile "Chrome/Profile 1"] [--window] [--cookies <file>]`, `logout <site>`
  - `capture <url> [--steps ...] [--interactive]` prints a compact, noise-filtered list of candidate
    requests with ids
  - `add <site> <op> --trigger <url-template> --example k=v [--example2 k=v] [--match ...] [--pick ...] [--write]`
  - `call <site> <op> [k=v ...] [--allow-writes]`
  - `inspect <captureId> [requestId]` reads a saved capture with no browser: a response at a path, or
    the items an `--html`/`--embedded` recipe would return; JSON inside strings (batchexecute
    payloads, a form's `f.req`) is shown decoded, in the response and the request body. Every `add` saves its trigger runs as
    captures, so `add --from <id>` re-learns (a fixed `--extract`) without Chrome. Captures hold
    full responses and the run's cookie values (one page can be tens of MB), so each new one prunes
    the directory to the newest 20, none older than 24 h.
  - `capture --outline` / `inspect --outline` (the explorer's scout, `outline.ts`): for the top
    candidates, a compact summary instead of the body — where the example values sit, a suggested
    extract and pick fields with samples, JSON the page embeds (JSON-LD, `__NEXT_DATA__`,
    `application/json` scripts, `window.X =` state) with a ready `--embedded` regex, a repeated
    HTML list holding the example as a ready `--html` recipe, and labelled texts on a detail page.
    Deterministic and site-agnostic; the agent reads it instead of inspecting bodies. Paths through
    id-like keys (Apollo's `Book:kca://...`) are flagged, since they don't generalize.
  - `verify [site]` (health-checks every read op with its example, healing as needed)
  - `sites`, `ops <site>` (params with their description and format, `returns` where the recipe names them: the keys a result item
    can carry, read from the op's `pick`, else from an HTML recipe's fields when no `extract` reshapes its
    items, so it cannot disagree with the recipe; a key the site leaves out is absent, and the site's notes: `<site>.md` beside its
    spec, the user's copy first, up to its `## Maintainer notes` heading; the rest of the file is
    for people working on the spec), `heal <site> <op>`, `export <site>`, `mcp`
  - All output is JSON-first, compact, and ends with a `next` hint on failure.
- **MCP server** (`api-anything mcp`) with fixed meta-tools: `list_sites`, `list_operations`,
  `call_operation`, and `login` (so an agent can fix an `auth` failure itself), so the tool list
  costs the same at 2 sites or 200. The agent may be steered by page content, so MCP `login` import
  only refreshes a site that has a spec and a browser source a human chose with the CLI, from that
  same profile; anything else answers `next`: ask the user to run `api-anything login <site>`. Mode
  window is allowed (a human signs in). MCP cannot create operations: capture and add are CLI only. Writes are hidden unless
  it is started with `--allow-writes`. `list_operations` carries each op's `returns`, the site's notes and each param's
  `hint`/`pattern`. A `next` served over MCP names the tools (`list_operations {"site":"x"}`, the
  `login` tool) instead of CLI commands, and tells the agent to run a CLI-only one (heal, add) in its
  own shell, or to hand it to the user when it has none.
  `call_operation` sends `data` that is a list of two or more records as `{columns, rows}` (a
  missing field is null): the keys, repeated in every item, were half of a flight search's tokens.
- **Skill** `skills/api-anything/SKILL.md`: the create loop (capture → add → call → verify), the
  strict failure loop (follow `next` at most once, then stop and report), and the safety rules.
- **Claude Code plugin** manifest (skill + MCP), plus copy-paste install lines for Codex and other agents.
- Library: `import { call, open } from "api-anything"`.

## Non-goals (v1)

TLS impersonation transports, CAPTCHA solving, signature reimplementation, seroval parsing,
a hosted registry or marketplace, typed-client codegen, and Windows app-bound cookie decryption
(login falls back to `--window` there).
