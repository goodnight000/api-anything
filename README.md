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
`~/.site2api/sites/hn.json`. The second is a single HTTP request that takes about 200 ms and
returns JSON.

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

**Codex and other agents.** Install the CLI (`npm i -g site2api`). Then point the agent at the
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

Suppose you want a site's search as an operation. Start by seeing which requests the page makes:

```sh
$ site2api capture "https://hn.algolia.com/?q=sqlite" --example q=sqlite
{"capture":"cmg2k8x1","requests":41,"candidates":[
  {"id":17,"method":"POST","url":"https://uj5wyc0l7x-dsn.algolia.net/1/indexes/*/queries?...","status":200,"type":"application/json","carries":["q"],"size":48211},
  {"id":1,"method":"GET","url":"https://hn.algolia.com/?q=sqlite","status":200,"type":"text/html","carries":["q"],"size":3120}, ...]}
```

Then describe how to make the page fire that request. Give two example values, so the learner
can tell params from nonces:

```sh
$ site2api add hn-search search --trigger "https://hn.algolia.com/?q={q}" \
    --example q=sqlite --example2 q=postgres --extract "results[0].hits" --pick title,url,points
{"ok":true,"site":"hn-search","op":"search","request":"POST https://uj5wyc0l7x-dsn.algolia.net/1/indexes/*/queries",
 "params":["q:string"],"minTier":1,"match":{"method":"POST","host":"uj5wyc0l7x-dsn.algolia.net","path":"/1/indexes/*/queries"},
 "warnings":[],"next":"site2api call hn-search search q=..."}

$ site2api call hn-search search q=duckdb
{"ok":true,"class":"ok","tier":1,"ms":212,"data":[{"title":"DuckDB 1.0","url":"https://...","points":812}, ...]}
```

The output above is abbreviated and shows the shape of each response. It was not re-run
against the live site for this README. The offline test suite (`test/e2e.test.ts`) runs the
same flow end to end against a local fixture site.

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
- Example values need at least 3 characters and must appear in the request as typed.
- Optional request structure (a reply block that only some calls have) needs a separate op.
- Rescan only reads scripts that the page references directly. An id inside a lazily loaded
  chunk heals through recapture instead, which is slower.
- A site behind a bot wall that challenges a real Chrome as well needs you to clear it by hand
  (`site2api login`). There is no CAPTCHA solving and no TLS impersonation.
- Pagination is not modeled.

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) to add a site spec.
