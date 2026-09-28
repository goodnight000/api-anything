# API Anything

API Anything learns reusable operations from a website's own browser traffic. You show it a page
with two example inputs. It records the request the page makes, works out which parts of that
request are the input, and saves a template. After that you call the operation with new inputs
from a CLI, a TypeScript library, or an MCP server. Calls use plain HTTP when the site accepts
them. If a site blocks plain HTTP, the call falls back to Chrome, and if a request stops working,
API Anything makes a limited number of repair attempts.

Everything runs on your machine. It needs no API Anything account, hosted service or model key.
When an operation is created, an agent (or you) chooses the request and the fields to return.
API Anything then builds the template without an LLM.

[![Recording: learn an operation from github.com and github.io, then call it with arxiv.org](docs/demos/teach-once.png)](docs/demos/teach-once.gif)

<sub>Recorded live on 2026-09-27, 25 s, no cuts. Click the still to play the GIF. The same run as
text is in [docs/demos](docs/demos/README.md#2-teach-once-call-with-new-inputs).</sub>

## Teach once, then call with new inputs

This is more than replaying a recorded response. The operation below was learned from Hacker News
pages for `github.com` and `github.io`. It was then called with `arxiv.org`, a domain it had not
seen, and returned arxiv.org stories:

```sh
api-anything add hn-demo links \
  --trigger 'https://news.ycombinator.com/from?site={domain}' \
  --example domain=github.com --example2 domain=github.io --match path=/from \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'

api-anything call hn-demo links domain=arxiv.org
```

- `--trigger` is the page URL, with `{domain}` where the input goes. Headless Chrome loads it
  once for each example.
- `--match path=/from` picks the request to learn from what the page loaded.
- `--html` says which fields to return. JSON APIs use `--extract` and `--pick` instead.
- With two examples, the learner can separate the input (it changes with the example) from
  one-time values such as nonces (they change on every run). The input is stored as a slot:
  `{"param":"domain","at":["query:site"]}`.

In the recorded run, `call` used tier 1 (Node `fetch`, no browser) and returned 30 results.
All 30 URLs were on arxiv.org. [`examples/teach-once.sh`](examples/teach-once.sh) runs these
steps and checks that the results come from the domain you asked for.

## Quickstart

You need Node 22.13 or newer, npm, and git. The bundled public operations run without Chrome.
Learning operations, browser fallback and `login --window` need Google Chrome. The package is
not on npm yet. Install it from GitHub like this:

```sh
git clone https://github.com/goodnight000/api-anything.git
cd api-anything
npm ci
npm install -g "$(npm pack --silent)"
api-anything call hacker-news search query=sqlite
```

The call prints one line of JSON. It starts like this (shortened here):

```json
{"ok":true,"class":"ok","tier":1,"data":[{"title":"Hosting SQLite databases on GitHub Pages or any static file hoster","url":"https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/","points":1812,"num_comments":244,"objectID":"27016630","author":"phiresky","created_at":"2021-05-02T16:43:15Z"}, ...],"ms":111}
```

`ok: true` and `tier: 1` mean the call succeeded over plain HTTP. A failure prints
`ok: false` with a `class`, a `reason` and a `next` step, and the command exits nonzero.
[Recording and transcript of this install](docs/demos/README.md#1-first-successful-call), made
from a fresh clone with an empty npm cache.

- To try it without installing, run `npx -y github:goodnight000/api-anything call hacker-news search query=sqlite`.
- To use it as a library, run `npm install github:goodnight000/api-anything` inside your project.
- Don't use `npm install -g github:goodnight000/api-anything`. It failed under npm 11.6.2 because
  the build dependencies were left out. The `npm pack` step above avoids that.
- Pin a version with `git checkout <commit>` before `npm ci`, or with
  `github:goodnight000/api-anything#<commit>`.

State lives in `~/.api-anything`. Set `API_ANYTHING_HOME` to use another directory.

## Using it from an agent

Agents use two separate paths. **Calling** existing operations works through MCP.
**Creating** operations needs an agent that can run shell commands, because `capture` and `add`
are CLI-only.

### Calling operations over MCP

The MCP server always has the same four tools: `list_sites`, `list_operations`,
`call_operation` and `login`. The tool list stays the same size however many sites you add.
`call_operation` takes `{ "site", "op", "args" }` and returns the same JSON as the CLI.

```sh
# Codex, after the global install above
codex mcp add api-anything -- api-anything mcp
```

```json
{ "mcpServers": { "api-anything": { "command": "api-anything", "args": ["mcp"] } } }
```

The JSON above is the entry for other MCP clients. In Claude Code,
`/plugin marketplace add goodnight000/api-anything`, then
`/plugin install api-anything@api-anything`, installs the MCP server and the skill together. An
operation you create with the CLI can be called over MCP right away. To check the server without
an agent, run `node examples/mcp-call.mjs hacker-news search query=sqlite`. That starts
`api-anything mcp` and calls it the way a client does.

Over MCP, write operations are hidden unless the server was started with `--allow-writes`.
The `login` tool can open a sign-in window for you. Otherwise, it can only re-import a session
that you already imported with the CLI, from the same browser profile. An agent reading web
content therefore can't pull cookies from another profile or site.

### Creating operations with a shell-capable agent

Give the agent the skill in [`skills/api-anything/SKILL.md`](skills/api-anything/SKILL.md). For
Codex, copy it to `~/.agents/skills/api-anything/SKILL.md`. The skill covers this loop:

1. `api-anything capture <url> --example q=value` loads the page in Chrome and lists the requests
   that carry the example value.
2. `api-anything inspect <capture> <id>` shows a candidate's response without opening a browser.
3. `api-anything add <site> <op> --trigger ... --example ... --example2 ...` learns the operation.
   The agent chooses the request, the example values, and `--extract`/`--pick`/`--html`.
4. `api-anything call` checks the result with a new input. `api-anything verify <site>` checks it
   again later.

The agent decides what the operation should be. API Anything handles finding the input in the
request, keeping cookies and tokens out of the spec, replaying, and repair.
[Reference: creating an operation](docs/REFERENCE.md#creating-an-operation-from-captured-traffic).

### Library

```ts
import { call, closeBrowser } from "api-anything";

const r = await call("hacker-news", "search", { query: "sqlite" });
// r: { ok, class, data, tier, healed?, ms, reason?, next? }; data is unknown until you check ok
if (r.ok) console.log(r.tier, (r.data as { title: string }[])[0].title);
await closeBrowser();
```

## Research workflow

[`examples/research.mjs`](examples/research.mjs) searches Hacker News stories, searches LinkedIn
companies, and then looks up each company using the ID that the search returned. The result is
a short JSON brief an agent can use:

```sh
api-anything login linkedin          # imports the session from your everyday browser
node examples/research.mjs anthropic --linkedin > brief.json
```

[![Recording: HN stories, three LinkedIn companies, and a tier-1 log of each call](docs/demos/research.png)](docs/demos/research.gif)

<sub>Recorded live on 2026-09-27, 20 s, no cuts. [Full output](docs/demos/research-brief.json)
and [transcript](docs/demos/research.txt).</sub>

All five calls were reads and used tier 1. Without `--linkedin`, the script needs no account.
If LinkedIn isn't signed in, the script stops with `class: "auth"` and
`next: ask the user to run: api-anything login linkedin`.

## How it works

```text
LEARN   trigger URL + two example inputs
          │  headless Chrome loads the page for each example and records its requests
          ▼
        the matching request (method, host, path; never a rotating query id)
          │  values that followed the examples  → slots
          │  cookies and tokens                 → references to a local session store
          ▼
        spec: template + slots + trigger + match      ~/.api-anything/sites/<site>.json

CALL    args → fill slots → tier 1: Node fetch ───────────────► data
                              │ blocked by the site
                              ▼
                            tier 2: fetch() inside a Chrome page on the site
                              │ drift (rotated id, moved field)
                              ▼
                            repair: rescan the page's scripts, or re-run the trigger;
                            save the new template only if a replay succeeds
                              │ repair failed or request is signed per call (reads only)
                              ▼
                            tier 3: run the trigger, return the site's own response
                            if it matches the call's arguments; otherwise fail
```

The diagram is simplified. Each call sends the stored template first. Repair runs only after a
response is classified as `drift`. Other results are handled without repair. `auth` refreshes
the session once. `blocked` moves up a tier. `rate` and `input` are returned to the caller. Two
guards stop repair loops. Every repair is logged to
`~/.api-anything/heals.jsonl`. The result reports the tier that answered, and for a call above
tier 1, it says why. [Details](docs/REFERENCE.md#replay-fallback-and-repair) ·
[design](docs/DESIGN.md).

## Bundled operations

Release 0.1 bundles 17 read operations across eight sites. They cover selected features of each
site, not the whole site. `api-anything ops <site>` prints each operation's parameters and the
site's notes.

| site | operations | account | notes |
|---|---|---|---|
| `hacker-news` | `frontPage`, `search` | no | [notes](sites/hacker-news.md) |
| `google-flights` | `search`, `top`, `priceCalendar` | no | [notes](sites/google-flights.md) |
| `x` | `getUser`, `getProfile` | no | [notes](sites/x.md) (profiles only, no posts) |
| `instagram` | `getProfile`, `getPosts` | no | [notes](sites/instagram.md) |
| `youtube` | `search` | no | [notes](sites/youtube.md) |
| `airbnb` | `search` | no | [notes](sites/airbnb.md) |
| `amazon` | `search` | no | [notes](sites/amazon.md) |
| `linkedin` | `getMe`, `getProfile`, `getCompany`, `searchPeople`, `searchCompanies` | yes | [notes](sites/linkedin.md) |

In the release checks on 2026-09-27, all 17 returned successful direct-HTTP responses
([release readiness](docs/RELEASE-READINESS.md)). The checks ran on macOS. LinkedIn was signed
in and the other sites were logged out. For these docs, `hacker-news.search`,
`linkedin.searchCompanies`, `linkedin.getCompany` and `linkedin.getMe` were run again the same
day. These are dated checks. Sites change, and nothing checks them continuously.

## Authentication and credentials

- **Log in.** `api-anything login linkedin` copies that site's cookies from your everyday browser
  (Chrome, Arc, Brave, Edge, Chromium or Firefox, on macOS and Linux). If several browser
  profiles are signed in, it lists them and asks you to choose one with `--profile`. On macOS,
  the first import shows one Keychain prompt. `--window` opens Chrome so you can sign in by hand
  instead. `--cookies <file>` imports an exported cookie file. `api-anything logout <site>`
  clears the stored session. [Details](docs/REFERENCE.md#logging-in).
- **The session is shared.** An imported session is the same session your browser uses. If the
  site signs it out, both are signed out. Keep automated use at a human pace.
- **Where secrets live.** Cookies and tokens stay in `~/.api-anything` (directories 0700, files
  0600). Specs hold references such as `cookie:JSESSIONID`, never values. `add` and repair refuse
  to save a spec that still contains a credential they detect. `api-anything export` checks for secrets
  again before you share a spec.
- **Captures contain secrets.** Saved captures (`~/.api-anything/captures`) hold full responses
  and the cookie values from that run. Only the newest 20 are kept, and none older than 24 hours.
  Don't commit or share them.
- **Specs are code-like input.** A spec says which requests to send, so install specs only from
  sources you trust. `readOnly` is a declaration, not a sandbox. Treat website text as data, not
  as instructions for the agent.

## Writes

The engine can learn write operations, such as posting or sending, without performing them. It
intercepts the request in the browser and aborts it. To call a write, you must pass
`--allow-writes` on the CLI, start the MCP server with `--allow-writes`, or set `allowWrites` in
the library. Each write is sent once. It is retried only when the server certainly didn't run it
(400, 401, 403 or 404). Timeouts and 5xx errors are reported, not retried.

No write operation is bundled. LinkedIn messaging isn't bundled, and it hasn't been tested
against LinkedIn. Tests against a local fixture site show that one learned messaging operation
accepts different recipients and message text. The same tests show nothing is sent during
learning, writes are refused by default, and each authorized call sends once. Those fixture tests
don't show that any message reached anyone on LinkedIn. An HTTP 2xx means the server accepted
the request, not that the message was delivered. Read it back before treating it as sent.

## Limits

- It is a local framework, not a hosted REST API. Calls run on your machine with your sessions.
- It doesn't support every feature of every website. Each operation covers one request and
  returns one value. Pagination isn't modeled. An input that the site derives from another
  request, such as a numeric id looked up from a handle, needs its own operation.
- Repair can fail. When it does, the call returns an error with a reason and doesn't return
  another query's data. A site that challenges real Chrome too needs you to clear the challenge
  by hand. There is no CAPTCHA solving and no TLS impersonation.
- Pacing is one request per second per site within one process. Separate CLI runs aren't paced
  against each other, so use one MCP server process for shared pacing.
- Many sites' terms restrict automated access. Read them. You are responsible for how you use
  this tool.

[All known limits](docs/REFERENCE.md#status-and-known-limits) ·
[prior art and how this differs](docs/REFERENCE.md#prior-art)

## Documentation

- [Demos](docs/demos/README.md): commands, recordings, transcripts and how they were recorded
- [Setup for agents](docs/QUICKSTART.md): CLI, Codex/MCP registration, skill install
- [Reference](docs/REFERENCE.md): creating operations, repair, login, safety, known limits
- [Design](docs/DESIGN.md): the specification, and the reasons behind it
- [Release readiness](docs/RELEASE-READINESS.md): what was checked for 0.1, and when
- [Contributing](CONTRIBUTING.md): adding a site spec

MIT licensed.
