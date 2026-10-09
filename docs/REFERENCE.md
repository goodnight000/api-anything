# Reference

Details behind the [README](../README.md). The design and its reasons are in
[DESIGN.md](DESIGN.md); setup for agents is in [QUICKSTART.md](QUICKSTART.md).

- [Creating an operation from captured traffic](#creating-an-operation-from-captured-traffic)
- [Replay, fallback and repair](#replay-fallback-and-repair)
- [Logging in](#logging-in)
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

## Replay, fallback and repair

Besides its request template, each operation stores two things:

- **trigger**: how to make the site's own frontend fire the request. This is a URL template,
  plus optional UI steps.
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
that same profile once on its own before asking you to log in again.

On macOS the first import shows one Keychain prompt ("security wants to use the … Safe Storage" key);
allow it. The imported session is the *same* one as your browser, so if the site logs it out, both
go — avoid heavy automated traffic on it. Other ways in:

- `--window` opens a visible Chrome window to sign in by hand (an independent session). Use it when
  the site asks for 2FA or a captcha, or when you don't want to share your browser's session. It is
  also the automatic fallback when nothing is importable.
- `--cookies <file>` imports a `cookies.txt` (Netscape) or JSON export, for servers/CI with no browser.
- `api-anything logout <site>` clears the stored session.

Chrome, Arc, Brave, Edge, Chromium and Firefox are supported on macOS and Linux.

## Safety and terms of service

- api-anything automates your own browser session on your own accounts. It is meant for things you
  could do by hand, at human pace. HTTP replays to one site are paced at 1 s within one process; browser navigation may fire multiple requests.
- **Writes** (posting, sending, buying) are learned by intercepting the request and aborting it
  in the browser, so learning never performs them. Calling a write needs `--allow-writes` on the
  CLI, the MCP server, or the library. A write is sent once and is retried only when the
  server certainly did not run it (a 400, 401, 403 or 404 answered to the write itself, not after
  a redirect). Timeouts and 5xx errors are reported,
  not retried.
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

This is an early release for developers and agents. It ships 17 read operations across eight
sites. Those operations cover selected features, not the entire sites. LinkedIn messaging and
posting are not bundled. The engine's write handling is tested against a local fixture, not
against every site's real write endpoints. Check the returned receipt and read back a real write
before treating delivery as confirmed.

Site specs are executable request/interaction instructions. Install specs from sources you trust
and review their destinations and write declarations. A `readOnly` declaration is not a sandbox
for a malicious spec, and website text is data, not instructions for the agent.

This is version 0.1. The offline suite covers the learning, healing, tier and write paths
against a local fixture site. Individual real sites vary and are not continuously verified.
Known limits:

- An arg a site derives from another request (a numeric user id looked up from a handle, or a
  page-2 cursor) cannot be substituted. Model the lookup as its own op, or rely on tier 3.
  `add` refuses an example value that the chosen request does not carry.
- Example values need at least 3 characters and must appear in the request (multi-word values
  are fine; they are matched decoded, so `mcp server` finds `mcp%20server`).
- An op extracts one value from one request. Data in two places of one page takes two ops.
- `--html` returns text and attributes as they are in the page (relative `href`s stay relative).
- "Not found" is detected by replaying the op's example args, so a spec without examples reports
  missing data as `drift`. An empty result is `ok` with `[]` when the page shows it structurally:
  an empty JSON list at the extract path, or, for `--html`, an items selector written as
  `"<container> <item>"` whose container is on the page with no item-tag element in it.
- A param may declare a `pattern` (a regex the whole value must match) and a `hint`; a call whose
  arg fails it is `input`, with the hint, and nothing is sent.
- Request pacing (1 s per site) holds within one process: separate CLI runs are not paced
  against each other.
- Chrome locks its profile to one process. An MCP server releases it after 3 s idle; another
  process waits up to 15 s for it, then fails with a hint.
- Optional request structure (a reply block that only some calls have) needs a separate op.
- Rescan only reads scripts that the page references directly. An id inside a lazily loaded
  chunk heals through recapture instead, which is slower.
- A site behind a bot wall that challenges a real Chrome as well needs you to clear it by hand
  (`api-anything login`). There is no CAPTCHA solving and no TLS impersonation.
- Pagination is not modeled.


## Prior art

| project | the honest difference |
|---|---|
| [unbrowse](https://github.com/unbrowse-ai/unbrowse) | Learns routes passively from browsing; its inference runs on a closed server, and drift is handed back to the agent to re-capture. api-anything is local, learns from known example values, and repairs the template itself. |
| [Integuru](https://github.com/Integuru-AI/Integuru) | An LLM picks the request and writes Python code for it (AGPL). api-anything learns deterministically, with no LLM, and stores data rather than code, so a single executor can heal any site. |
| [reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer) | A coding agent writes a per-site client and hardcodes the captured credentials in it. api-anything keeps credentials out of specs, and it heals at runtime instead of re-running an agent. |
| [mitmproxy2swagger](https://github.com/alufers/mitmproxy2swagger) | Turns proxy captures into OpenAPI docs, with a human editing templates in between. It is a documentation tool: it has no replay, auth, or drift handling. |
