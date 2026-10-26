# Reference

Details behind the [README](../README.md). The design and its reasons are in
[DESIGN.md](DESIGN.md); setup for agents is in [QUICKSTART.md](QUICKSTART.md).

- [Creating an operation from captured traffic](#creating-an-operation-from-captured-traffic)
- [Replay, fallback and repair](#replay-fallback-and-repair)
- [Logging in](#logging-in)
- [MCP server](#mcp-server)
- [Safety and terms of service](#safety-and-terms-of-service)
- [Status and known limits](#status-and-known-limits)
- [Prior art](#prior-art)

## Creating an operation from captured traffic

Suppose you want Hacker News search as an operation. Start by seeing which requests the page makes:

```sh
$ api-anything capture "https://hn.algolia.com/?q=sqlite" --example q=sqlite
{"capture":"cmujqsybh","requests":38,"candidates":[
  {"id":21,"kind":"fetch","method":"POST","url":"https://uj5wyc0l7x-dsn.algolia.net/1/indexes/Item_dev/query?x-algolia-agent=...","status":200,"type":"application/json","carries":["q"],"size":61234},
  {"id":1,"kind":"document","method":"GET","url":"https://hn.algolia.com/?q=sqlite","status":200,"type":"text/html","size":2841}, ...]}
```

`api-anything inspect <capture> <id>` shows a candidate's response, without a browser. Then describe
how to make the page fire that request. Give two example values, so the learner can tell params
from nonces:

```sh
$ api-anything add hn-search search --trigger "https://hn.algolia.com/?q={query}" \
    --example query=sqlite --example2 query=postgres --match host=uj5wyc0l7x-dsn.algolia.net \
    --extract hits --pick "title,url,points,comments=num_comments"
{"ok":true,"site":"hn-search","op":"search","request":"POST https://uj5wyc0l7x-dsn.algolia.net/1/indexes/Item_dev/query",
 "params":["query:string"],"readOnly":true,"minTier":1,"match":{"host":"uj5wyc0l7x-dsn.algolia.net"},"extract":"hits",
 "preview":{"count":30,"first":{"title":"Hosting SQLite databases on GitHub Pages or any static file hoster","url":"https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/","points":1812,"comments":244}},
 "warnings":[],"captures":["cmujqsybh","cmujqszcj"],"next":"api-anything call hn-search search query=..."}

$ api-anything call hn-search search query=duckdb
{"ok":true,"class":"ok","tier":1,"data":[{"title":"The DuckDB Local UI","url":"https://duckdb.org/2025/03/12/duckdb-ui.html","points":926,"comments":188}, ...],"ms":990}
```

The `add` and `call` output is real, from 2026-09-27, shortened; the `capture` listing shows its
shape (ids and sizes vary). `--pick`
accepts `name=path` to rename a field, `name=path~regex` to keep the part of a string the
regex's group 1 finds (`publicId=navigationUrl~/in/([^/?]+)`), and `[*]` in a path collects from every array item
(`sections[*].items` joins each section's items); items with none of the picked fields are dropped. If the preview is wrong, fix the recipe: re-run
`add <site> <op> --from <one of the captures>` with the recipe flags (`--extract`, `--pick`,
`--html`, `--embedded`). No browser is needed, and no `--example`: the operation's stored examples
are used, so its params stay. From a capture made with other values, pass those with `--example`.
For a server-rendered page, use
`--html '{"items":"<css>","fields":{...}}'`, or `--embedded '<regex>'` for JSON inside the page.
`inspect` accepts the same recipe flags (`--extract`, `--pick`, `--html`, `--embedded`), so you can
try a recipe first: it exits non-zero when a path or selector finds nothing. An `--html` items
container that is on the page and empty is a page with no results: `data: []`, with a `note`.

In `capture`'s output, `pageStatus` is the page's own HTTP error when a request it loaded is
recommended all the same, and `blocked` is the bot challenge the site served.

`add` can also learn from a saved capture instead of running the trigger: `add <site> <op> --from
<capture> --pick-request <id> --example k=v`. A capture holds one run, so the second example needs a
second capture of the page, made with its values: `--from2 <capture2> --example2 k=v2`.

`add` does not save an op whose captured answer is a bot challenge, a sign-in page, a rate limit or
a server failure: log in (`api-anything login <site>`) or wait, then add again. When example 2 is
answered with example 1's data, the op is saved with a warning and marked `unproven`: the server may
not read those params at all (it goes by a cookie or the IP). Pick an example 2 that excludes
something example 1 returned, such as another place or a filter value one of its rows fails.

`--enum name=a,b,c` lists the values a param takes (the site's whole set, such as a picker's
options), and `--min name=n` / `--max name=n` bound a numeric one. A call with another value is
`input` and nothing is sent; `ops` and MCP `list_operations` show them. Set them on an existing op by
editing its spec. An op learned again keeps its params' allowed values and descriptions.

A list that pages takes `--paging`. Learn a cursor-paged list from the request that loads page 2
("Show more"), with the cursor as the example, and say where the answer gives the next cursor:

```sh
api-anything add goodreads getReviews --from <captureId> --pick-request <id> \
  --example workId=kca://work/... --example after=<page 2's cursor> \
  --extract data.getReviews.edges --paging after=data.getReviews.pageInfo.nextPageToken
```

The cursor param becomes optional, and its captured value is dropped. A call without it gets page 1,
with the cursor's slot emptied. Each call returns `nextPage`, the value to pass as `after` for the
next page, and `hasMore` (`false` when the site says it is the last page). `--paging page`, with no
path, marks numbered pages: the call says nothing about the next page, since a non-empty page is
also what the last one looks like. `verify` asks a paged op for the page after its example's and
fails it when that page holds only page 1's items again.

A write can prove it landed. Name a read of the same site that shows it, filled from the write's
args:

```sh
api-anything readback todo addTodo listTodos --find "title={title}"
```

After the write is sent and answered 2xx (or may have run), the call runs that read once. When an
item's `title` equals the write's, `write` is `applied`. When it is not there yet, the write stays
`accepted`, and `reason` says so. The read is never a resend.

Record what a human confirmed on the site as checks, then let `verify` run them with the examples:

```sh
api-anything check hn-search search query=zzqqxxnothing --expect empty --purpose "no story matches"
api-anything verify hn-search
```

`--expect` is `result` (data), `empty` (the site's own no-results) or `input` (the args are
refused). `verify` reports each case as `pass`, `fail` or `inconclusive`: a challenge, a sign-in
page, a rate limit or a server that failed or could not be reached tests nothing. Check args are
shared with the spec, so use public values only.

## Replay, fallback and repair

Besides its request template, each operation stores two things:

- **trigger**: how to make the site's own frontend fire the request. This is a URL template,
  plus optional UI steps. A write's trigger may also hold `confirms`: the `confirm()` dialogs its
  learning accepted, each as a step index and a SHA-256 digest (no page text), which a tier-3 call
  accepts again when the page asks the same question.
- **match**: how to recognize that request in captured traffic by stable identity only
  (method, host, path with hash-like segments wildcarded, GraphQL operation name). It never
  uses a queryId or hash.

One routine, run the trigger, match the request, learn the template, does three jobs:

1. **Create.** `add` runs the trigger with your example values. It substitutes only those values
   and stores everything else verbatim, down to key order and the site's own percent-encoding.
   Cookies and auth headers become references to a local session store, so a spec file never
   holds a credential.
2. **Heal.** Every call sends the stored template first. The response is classified as ok,
   drift, auth, rate, blocked, input or error, and only drift triggers a heal. The heal tries:
   - **rescan**, with no browser: fetch the page and its scripts and find the new id next to
     its anchor;
   - **recapture**: run the trigger again with your current args and re-learn from it.

   A healed template is saved only after a replay succeeds. Each heal is logged to
   `~/.api-anything/heals.jsonl`. Two guards stop heal loops: a heal that produces an identical
   template is not drift, and an op that drifts again within 10 minutes of a heal is marked
   stale for 30 minutes.
3. **Fallback.** For reads, the triggered browser run has already received the answer. When a
   template can't be replayed (for example, per-request signatures), that answer is returned only if the captured request matches the call’s arguments at their declared positions. Otherwise the call fails rather than returning another query’s data.

Transport tiers, cheapest first. The lowest tier that worked is remembered for each op.

| tier | transport | used when |
|---|---|---|
| 1 | Node `fetch` with a domain/path-scoped cookie jar | default |
| 2 | `fetch()` inside a real Chrome page on the site | tier 1 is `blocked` |
| 3 | run the trigger in Chrome and read the site's own response | per-request signatures, a failed heal (reads only) |

## Logging in

For sites that need an account, one command signs you in:

```sh
api-anything login linkedin.com
```

The target can be a site name (`linkedin`), a domain (`linkedin.com`, `www.linkedin.com`) or a URL.
By default this **imports** the site's cookies from your everyday browser — you are almost always
already signed in there, so there is no password to type and no 2FA or captcha to redo. It prints
the browser profile it used, with the profile's display name and Google account, and the cookie
*names* (never the values). Then LinkedIn operations just work:

```sh
api-anything call linkedin getCompany universalName=openai
api-anything call linkedin getProfile publicId=williamhgates
```

**Several profiles signed in.** If more than one browser profile is signed in to the site (a work
and a personal profile, or someone else's account in your Chrome), `login` does not guess. It
answers `ok: false` with a `candidates` list, each with its profile, display name and email, and you
pick one:

```sh
api-anything login linkedin.com --profile "Chrome/Profile 1"
```

The choice is remembered: when a call later returns `class: "auth"`, api-anything re-imports from
that same profile once on its own before asking you to log in again. It retries the call only if the
re-import brought new login cookies. If they are the same ones, the site has ended that sign-in in
your browser too, so the call's `next` says where to sign in, for example `sign in to linkedin.com in
Chrome profile "Work"`, rather than sending you back to `login`, which would import them again.

**What counts as signed in.** Many sites give every visitor a session cookie named like a login
(`laravel_session`, a Rails `_app_session`, `ci_session`). Before it imports or opens a window,
`login` fetches the site once with no cookies and records the names of the cookies it is given
(names only, in the session file). Those never count as a sign-in. The output says `loggedIn` and
`renewed`, plus a `warning` when the imported cookies show no sign-in or are the same login cookies
the session already had. If a site's real login cookie has an unusual name, list it in the spec's
`loginCookies`; that list always wins.

A write learned while signed in is checked before it is sent: if the session has no live login
cookie (expired or missing), api-anything re-imports first, and if there is still none the call
returns `class: "auth"` and sends nothing.

On macOS the first import shows one Keychain prompt ("security wants to use the … Safe Storage" key);
allow it. The imported session is the *same* one as your browser, so if the site logs it out, both
go — avoid heavy automated traffic on it. Other ways in:

- `--window` opens a visible Chrome window to sign in by hand (an independent session). Use it when
  the site asks for 2FA or a captcha, or when you don't want to share your browser's session. It is
  also the automatic fallback when nothing is importable. Finish signing in, 2FA included, then close
  the window or press Enter: it does not close itself, because some sites set their login cookie before
  the second factor is done. It counts only if a login cookie appeared or changed while it was open;
  otherwise `login` answers `ok: false`, says why, and keeps the session you had.
- `--cookies <file>` imports a `cookies.txt` (Netscape) or JSON export, for servers/CI with no browser.
- `api-anything logout <site>` clears the stored session.

Chrome, Arc, Brave, Edge, Chromium and Firefox are supported on macOS and Linux.

## MCP server

`api-anything mcp` serves these tools over stdio:

| tool | what it does | hints |
|---|---|---|
| `list_sites` | the sites, with how many operations each has | read-only |
| `list_operations` | a site's operations, each with a JSON Schema of its args (`inputSchema`) the keys its items carry (`returns`), how it pages (`pages`) and the read a write is confirmed by (`readback`), and the site's notes | read-only |
| `call_operation` | call a read; a write op is refused and nothing is sent | read-only, idempotent |
| `call_write_operation` | call a write, with `again` and `idempotencyKey`; only with `--allow-writes` | destructive, not idempotent |
| `get_job` | wait up to 25 s for a pending call's result | read-only |
| `login` | refresh a session from the profile chosen with the CLI, or open a window to sign in by hand | changes the local session only |

- `--sites goodreads,hacker-news` also serves each operation of those sites as a tool of its own,
  `<site>__<op>` (at most 40 characters, any other character as `_`), that takes the op's args
  directly. A write is one only with `--allow-writes`.
- A tool call still running after about 25 s answers `{ok: false, class: "pending", job}` and keeps
  running; `get_job {job}` returns its result, or pending again, and never runs it again. The same
  call while it runs joins it, so a second `login` for a site whose window is open returns that
  job. Jobs end when the server does; a finished one is kept 15 minutes. A sign-in window nobody
  closes is closed after 10 minutes.
- Each answer is JSON text, and the same object as `structuredContent`.
- `--print-config` prints how to add the server to Claude Code, Codex, Gemini CLI, VS Code, Cursor
  and Claude Desktop, with absolute paths. Client timeouts and fixes for common problems are in
  [QUICKSTART.md](QUICKSTART.md#client-timeouts).

## Safety and terms of service

- api-anything automates your own browser session on your own accounts. It is meant for things you
  could do by hand, at human pace. HTTP replays to one site are paced at 1 s within one process; browser navigation may fire multiple requests.
- **Writes** (posting, sending, buying) are learned by intercepting the request and aborting it
  in the browser, so learning never performs them. Calling a write needs `--allow-writes` on the
  CLI, the MCP server (whose `call_write_operation` sends it; `call_operation` never does), or the library. A write is sent once and is retried only when the
  server certainly did not run it (a 400, 401, 403 or 404 answered to the write itself, not after
  a redirect). Timeouts and 5xx errors are reported,
  not retried. The result's `write` says what happened (`not_sent`, `not_applied`, `accepted`,
  `may_have_applied`), and `retry` says whether to send it again (`no` for one accepted or that may
  have gone through). The same write with the same args within 10 minutes of one that was accepted
  or may have gone through is refused (`class: "duplicate"`), unless the caller passes `--again`
  (MCP `again`, library `again`). `--idempotency-key <k>` makes a repeat return the first call's
  record instead of sending. The record (`~/.api-anything/writes.json`, kept 24 hours) holds the
  site, the op, the time, the outcome and an HMAC of the args under a random local key, never the args.
- A failure's `reason` quotes the site's answer, and `next` can name values too: both have every
  live cookie and session value replaced by `[redacted]` (as stored, URL-encoded, JSON- or
  HTML-escaped, or base64), including what is left of one the 160-character quote cut short. So do
  stale marks and the heal log. `data`, the answer you asked for, is not redacted.
- **Native dialogs** in the browser: leaving a page ("unsaved changes") is accepted, since leaving
  sends nothing; alerts and prompts are dismissed; a `confirm()` is dismissed during reads. While a
  write is learned its request is intercepted, so its confirm is accepted and recorded as a digest
  of the page's origin, the step and the question with your example values abstracted. A tier-3
  write call accepts a confirm only when it matches that record with the call's own values; any
  other is dismissed, and the call's reason says so. A call whose trigger fired no matching request
  says why the browser stopped waiting: whether the page went quiet or the time ran out, the page's
  address without its query, its HTTP status, the requests still open and the dialogs it showed.
- Credentials stay in `~/.api-anything` (directories 0700, files 0600). Specs hold references
  such as `cookie:ct0`, never values. Captures (`~/.api-anything/captures`, kept for `inspect` and
  `add --from`) hold full responses and the run's cookie values, so only the newest 20 are kept and
  none past 24 hours. `api-anything export` strips your example values, and it
  refuses to write a spec that contains any live cookie or session value from your machine.
- api-anything does not solve CAPTCHAs or impersonate TLS fingerprints. It runs its own Chrome
  profile; `api-anything login <site>` copies only that site's cookies from your everyday browser
  (or signs in through a window), and only when you run it.
- Many sites' terms restrict automated access. Read them. You are responsible for how you use
  this tool.

## Status and known limits

This is an early release for developers and agents. It ships 25 read operations across ten
sites. Those operations cover selected features, not the entire sites. LinkedIn messaging and
posting are not bundled. The engine's write handling is tested against a local fixture, not
against every site's real write endpoints. Treat `write: "accepted"` as taken, not done: give the
op a `readback`, so a call can say `applied`, or check the site before treating delivery as confirmed.

Site specs are executable request/interaction instructions. Install specs from sources you trust
and review their destinations and write declarations. A `readOnly` declaration is not a sandbox
for a malicious spec, and website text is data, not instructions for the agent.

This is version 0.1. The offline suite covers the learning, healing, tier and write paths
against a local fixture site. Individual real sites vary and are not continuously verified.
Known limits:

- An arg a site derives from another request (a numeric user id looked up from a handle) cannot be
  substituted. Model the lookup as its own op, or rely on tier 3. A page-2 cursor is the exception:
  `--paging` passes the site's own cursor back as an arg.
  `add` refuses an example value that the chosen request does not carry.
- Example values need at least 3 characters and must appear in the request (multi-word values
  are fine; they are matched decoded, so `mcp server` finds `mcp%20server`).
- An op extracts one value from one request. Data in two places of one page takes two ops.
- `--html` returns text as it is in the page. `@href` and `@src` are links, so a relative value
  is resolved against the page's `<base href>` or else the final URL the answer came from, and
  returned absolute; the other attributes (`@title`, `@id`, ...) and plain text stay as they are.
- `--html` and `--outline` read only what the page shows: `<script>`, `<style>`, `<noscript>` and
  `<template>` are dropped, and so is every element with the `hidden` attribute (not
  `hidden="until-found"`) or an inline `display:none`/`visibility:hidden`, with all it holds.
  `aria-hidden="true"` stays: it hides from screen readers, not from the eye. Hiding done by a
  stylesheet (an `sr-only` class, off-screen positioning) is not seen, so such text still comes back.
- "Not found" is detected by replaying the op's example args, so a spec without examples reports
  missing data as `drift`. An empty result is `ok` with `[]` when the page shows it structurally:
  an empty JSON list at the extract path, or, for `--html`, an items selector written as
  `"<container> <item>"` whose container is on the page with no item-tag element in it. A list
  that `--pick` empties (no item has a picked field), or `--html` items with none of their fields
  found, is missing data, not `[]`: the site may have renamed them. A picked field missing from
  some or all items is not detected, because it may be optional.
- A write's 2xx is `ok` unless its answer says it was refused: an error field that holds an error
  (`userErrors`, `error: "..."`), `ok`/`success` false, an error word as the root `status`, a body
  status of 400 or more, GraphQL errors with null or no data, or the form page answering with its
  errors. A redirect back to the form that shows an error, or to an address naming one, is
  `error`, because the write may or may not have run. A site that answers a failure with an
  unmarked 200 still reads as `ok`. None of these verdicts sends the write again.
- A signed-in read redirected to a consent, terms or "verify it's you" page of the same site is
  `error`. Its `next` names the page, which the user finishes in the browser before running
  `api-anything login <site>`. It is not healed and not marked stale.
- A param may declare a `pattern` (a regex the whole value must match) and a `hint`, an `enum` of
  the values it takes, and a `min`/`max`; a call whose arg fails one is `input`, and nothing is sent.
- Two examples that the site answers with the same data mark the op `unproven`, which may be a
  false alarm (two places with the same stores). `publish` refuses it until a re-add with a better
  example 2, or until `verify` sees two passing cases that differ only in those params answer
  differently. A param the server ignores is not caught when the two answers differ for another
  reason (a timestamp, a shuffled order).
- Request pacing (1 s per site) holds within one process: separate CLI runs are not paced
  against each other.
- Chrome locks its profile to one process. An MCP server releases it after 3 s idle; another
  process waits up to 15 s for it, then fails with a hint.
- Optional request structure (a reply block that only some calls have) needs a separate op.
- Rescan only reads scripts that the page references directly. An id inside a lazily loaded
  chunk heals through recapture instead, which is slower.
- A site behind a bot wall that challenges a real Chrome as well needs you to clear it by hand
  (`api-anything login`). There is no CAPTCHA solving and no TLS impersonation. A trigger run or
  repair that ends on a challenge that did not solve is `blocked` and marks nothing stale.
- Paging returns the site's own next cursor, and only when the answer holds one. Numbered pages
  get no `nextPage`. When the output cap cuts a page, the cut items are on neither that page nor
  the next, so `truncated` says to ask for fewer per page.
- A readback finds what the read shows: a write the site lists later, or under a value other than
  the one sent, stays `accepted`. An older item with the same value passes for a new one, so find
  something only this write makes.
- The recorded answers in `test/fixture/sites/` prove that a bundled recipe still parses the
  answer it was recorded from, not that the site still answers that way. Ops that send a cookie or
  session value have none.


## Prior art

| project | the honest difference |
|---|---|
| [unbrowse](https://github.com/unbrowse-ai/unbrowse) | Learns routes passively from browsing; its inference runs on a closed server, and drift is handed back to the agent to re-capture. api-anything is local, learns from known example values, and repairs the template itself. |
| [Integuru](https://github.com/Integuru-AI/Integuru) | An LLM picks the request and writes Python code for it (AGPL). api-anything learns deterministically, with no LLM, and stores data rather than code, so a single executor can heal any site. |
| [reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer) | A coding agent writes a per-site client and hardcodes the captured credentials in it. api-anything keeps credentials out of specs, and it heals at runtime instead of re-running an agent. |
| [mitmproxy2swagger](https://github.com/alufers/mitmproxy2swagger) | Turns proxy captures into OpenAPI docs, with a human editing templates in between. It is a documentation tool: it has no replay, auth, or drift handling. |
