# site2api

site2api turns a website that only has a GUI into operations an agent can call directly, such as
`hn.front` or `flights.search`. It learns each request from the site's own frontend running in
your Chrome, replays it as a plain HTTP call, and re-learns it on its own when the site changes.

## Quickstart (30 seconds)

Requires Node 22+ and Google Chrome.

```sh
npx -y site2api add hn front --trigger https://news.ycombinator.com/news --match path=/news \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'
npx -y site2api call hn front
```

The first command opens the page twice in a headless Chrome and saves an operation to
`~/.site2api/sites/hn.json`. Its output includes a `preview` of what a call returns. The second
is a single HTTP request that takes about 200 ms and returns JSON. (Sites that challenge plain
HTTP clients answer through Chrome instead, in 1 to 2 s; the result's `reason` says so.)

Everything lives in `~/.site2api`; set `SITE2API_HOME` to use another directory.

Bundled specs, verified live and logged out on 2026-09-27: `x` (getUser, getProfile),
`instagram` (getProfile, getPosts), `google-flights` (search, top), `hacker-news` (frontPage,
search). `site2api sites` lists them; each has notes in `sites/<site>.md`.

## Install

**Claude Code** (skill + MCP server):

```
/plugin marketplace add Sift-wiki/site2api
/plugin install site2api@site2api
```

**Any MCP client.** Add this server entry:

```json
{
  "mcpServers": {
    "site2api": { "command": "npx", "args": ["-y", "site2api", "mcp"] }
  }
}
```

It exposes three fixed tools, `list_sites`, `list_operations` and `call_operation`, so the
tool list costs the same whether you have 2 sites or 200. Writes are hidden until you start the
server with `site2api mcp --allow-writes`.

`call_operation` takes `{ site, op, args: { name: value } }` and returns the same JSON as the CLI.

**Codex and other agents.** Install the CLI (`npm i -g site2api`; from a checkout, `npm install &&
npm pack` then `npm i -g ./site2api-<version>.tgz`). Then point the agent at the
skill file, [`skills/site2api/SKILL.md`](skills/site2api/SKILL.md), or copy it into the agent's
skills directory (for Codex, `~/.codex/skills/site2api/SKILL.md`). The skill teaches the
create loop, the failure loop, and the write rules. Every command prints JSON and gives a
`next:` hint on failure.

**Library:**

```ts
import { call } from "site2api";
const r = await call("hn", "front", {});
// { ok, class, data, tier, healed?, ms, next? }
```

## Worked example

Suppose you want Hacker News search as an operation. Start by seeing which requests the page makes:

```sh
$ site2api capture "https://hn.algolia.com/?q=sqlite" --example q=sqlite
{"capture":"cmujqsybh","requests":38,"candidates":[
  {"id":21,"kind":"fetch","method":"POST","url":"https://uj5wyc0l7x-dsn.algolia.net/1/indexes/Item_dev/query?x-algolia-agent=...","status":200,"type":"application/json","carries":["q"],"size":61234},
  {"id":1,"kind":"document","method":"GET","url":"https://hn.algolia.com/?q=sqlite","status":200,"type":"text/html","size":2841}, ...]}
```

`site2api inspect <capture> <id>` shows a candidate's response, without a browser. Then describe
how to make the page fire that request. Give two example values, so the learner can tell params
from nonces:

```sh
$ site2api add hn-search search --trigger "https://hn.algolia.com/?q={query}" \
    --example query=sqlite --example2 query=postgres --match host=uj5wyc0l7x-dsn.algolia.net \
    --extract hits --pick "title,url,points,comments=num_comments"
{"ok":true,"site":"hn-search","op":"search","request":"POST https://uj5wyc0l7x-dsn.algolia.net/1/indexes/Item_dev/query",
 "params":["query:string"],"readOnly":true,"minTier":1,"match":{"host":"uj5wyc0l7x-dsn.algolia.net"},"extract":"hits",
 "preview":{"count":30,"first":{"title":"Hosting SQLite databases on GitHub Pages or any static file hoster","url":"https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/","points":1812,"comments":244}},
 "warnings":[],"captures":["cmujqsybh","cmujqszcj"],"next":"site2api call hn-search search query=..."}

$ site2api call hn-search search query=duckdb
{"ok":true,"class":"ok","tier":1,"data":[{"title":"The DuckDB Local UI","url":"https://duckdb.org/2025/03/12/duckdb-ui.html","points":926,"comments":188}, ...],"ms":990}
```

The `add` and `call` output is real, from 2026-09-27, shortened; the `capture` listing shows its
shape (ids and sizes vary). `--pick`
accepts `name=path` to rename a field. If the preview is wrong, fix `--extract`/`--pick` and
re-run `add --from <one of the captures>`: no browser needed. For a server-rendered page, use
`--html '{"items":"<css>","fields":{...}}'`, or `--embedded '<regex>'` for JSON inside the page;
`inspect` accepts the same flags, so you can try selectors first.

## How self-healing works

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
   `~/.site2api/heals.jsonl`. Two guards stop heal loops: a heal that produces an identical
   template is not drift, and an op that drifts again within 10 minutes of a heal is marked
   stale for 30 minutes.
3. **Fallback.** For reads, the triggered browser run has already received the answer. When a
   template can't be replayed (for example, per-request signatures), that answer is returned.

Transport tiers, cheapest first. The lowest tier that worked is remembered for each op.

| tier | transport | used when |
|---|---|---|
| 1 | Node `fetch` with a domain/path-scoped cookie jar | default |
| 2 | `fetch()` inside a real Chrome page on the site | tier 1 is `blocked` |
| 3 | run the trigger in Chrome and read the site's own response | per-request signatures, a failed heal (reads only) |

## Safety and terms of service

- site2api automates your own browser session on your own accounts. It is meant for things you
  could do by hand, at human pace. Requests to one site are spaced at least 1 s apart.
- **Writes** (posting, sending, buying) are learned by intercepting the request and aborting it
  in the browser, so learning never performs them. Calling a write needs `--allow-writes` on the
  CLI, the MCP server, or the library. A write is sent once and is retried only when the
  server certainly did not run it (400, 401, 403 or 404). Timeouts and 5xx errors are reported,
  not retried.
- Credentials stay in `~/.site2api` (directories 0700, files 0600). Specs hold references
  such as `cookie:ct0`, never values. `site2api export` strips your example values, and it
  refuses to write a spec that contains any live cookie or session value from your machine.
- site2api does not solve CAPTCHAs, impersonate TLS fingerprints, or read your everyday Chrome
  profile. It uses its own profile, and you sign in once with `site2api login <site>`.
- Many sites' terms restrict automated access. Read them. You are responsible for how you use
  this tool.

## Prior art

| project | the honest difference |
|---|---|
| [unbrowse](https://github.com/unbrowse-ai/unbrowse) | Learns routes passively from browsing; its inference runs on a closed server, and drift is handed back to the agent to re-capture. site2api is local, learns from known example values, and repairs the template itself. |
| [Integuru](https://github.com/Integuru-AI/Integuru) | An LLM picks the request and writes Python code for it (AGPL). site2api learns deterministically, with no LLM, and stores data rather than code, so a single executor can heal any site. |
| [reverse-api-engineer](https://github.com/kalil0321/reverse-api-engineer) | A coding agent writes a per-site client and hardcodes the captured credentials in it. site2api keeps credentials out of specs, and it heals at runtime instead of re-running an agent. |
| [mitmproxy2swagger](https://github.com/alufers/mitmproxy2swagger) | Turns proxy captures into OpenAPI docs, with a human editing templates in between. It is a documentation tool: it has no replay, auth, or drift handling. |

## Status and limits

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
  missing data as `drift`.
- Request pacing (1 s per site) holds within one process: separate CLI runs are not paced
  against each other.
- Optional request structure (a reply block that only some calls have) needs a separate op.
- Rescan only reads scripts that the page references directly. An id inside a lazily loaded
  chunk heals through recapture instead, which is slower.
- A site behind a bot wall that challenges a real Chrome as well needs you to clear it by hand
  (`site2api login`). There is no CAPTCHA solving and no TLS impersonation.
- Pagination is not modeled.

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) to add a site spec.
