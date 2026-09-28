# API Anything

**Teach your agent a website once. After that, it calls the site like an API instead of driving a browser.**

API Anything watches a site's own page make a request and learns which parts of it are your
inputs. It saves the result as an operation. Your agent calls that operation with new inputs
over MCP, the CLI or TypeScript, and gets JSON back over plain HTTP.

[![Two agents race on the same Google Flights task: one drives Chrome, one calls API Anything](docs/media/agent-race.gif)](docs/media/agent-race.mp4)

<sub>Same agent (Claude Opus 5.5), same prompt, started together. Left: it drives headless Chrome
through Playwright MCP. Right: it calls API Anything's Google Flights operation. Real time, no cuts,
recorded 2026-09-28. [MP4](docs/media/agent-race.mp4) · [how it was recorded](bench/README.md#the-recorded-race)</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/agent-benchmark-dark.svg">
  <img alt="Median time and cost per task. 1 date: browser 12.9 s and $0.166, API Anything 8.4 s and $0.074. 5 dates: browser 41.6 s and $0.154, API Anything 21.1 s and $0.152." src="docs/media/agent-benchmark-light.svg">
</picture>

Across 5 runs of each task, the agent using API Anything answered 1.5 to 2× sooner, read about
half as many tokens, and cost the same or less. All 20 answers were correct.
[Method, raw numbers and limits](bench/README.md).

## Quickstart

Needs Node 22.13+, npm and git. The package isn't on npm yet, so install it from GitHub:

```sh
git clone https://github.com/goodnight000/api-anything.git && cd api-anything
npm ci && npm install -g "$(npm pack --silent)"
api-anything call hacker-news search query=sqlite
```

```json
{"ok":true,"class":"ok","tier":1,"data":[{"title":"Hosting SQLite databases on GitHub Pages or any static file hoster","url":"https://phiresky.github.io/blog/2021/hosting-sqlite-databases-on-github-pages/", ...}, ...],"ms":111}
```

`tier: 1` means the call went over plain HTTP with no browser. A failure returns `ok: false`
with a `class`, a `reason` and a `next` step. Google Chrome is needed only to learn new operations
and for browser fallback. Don't use `npm install -g github:...`, because it failed under npm 11.6.2.
[Setup details](docs/QUICKSTART.md).

## Give it to your agent

The MCP server has four tools: `list_sites`, `list_operations`, `call_operation` and `login`.

```sh
codex mcp add api-anything -- api-anything mcp                 # Codex
```

```json
{ "mcpServers": { "api-anything": { "command": "api-anything", "args": ["mcp"] } } }
```

In Claude Code: `/plugin marketplace add goodnight000/api-anything`, then
`/plugin install api-anything@api-anything`.

Over MCP an agent **calls** operations. To **create** one, an agent needs a shell and the
[skill](skills/api-anything/SKILL.md), or you run the CLI yourself.

## Teach it a new site

Give it the page URL with a placeholder, and two example inputs:

```sh
api-anything add hn-demo links \
  --trigger 'https://news.ycombinator.com/from?site={domain}' \
  --example domain=github.com --example2 domain=github.io --match path=/from \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'

api-anything call hn-demo links domain=arxiv.org      # 30 arxiv.org stories, tier 1
```

Headless Chrome loads the page once for each example. The part of the request that changed with
the input becomes a parameter, and the rest is stored as a template. The agent (or you) picks the
request and the fields. API Anything builds the template without an LLM.
[Recorded demos](docs/demos/README.md).

## What's included

17 read operations across 8 sites: `google-flights` (search, top, price calendar), `hacker-news`,
`x` and `instagram` profiles, `youtube`, `airbnb` and `amazon` search, and `linkedin` (profiles,
companies and search, with your own login). They cover selected features, not whole sites.
`api-anything ops <site>` lists parameters and caveats.

## How it works

- **Learn.** Chrome records the page's requests for two example inputs. The request that
  followed the inputs becomes a template with slots, and cookies and tokens become references to
  a local store.
- **Call.** Fill the slots and send the request with Node's `fetch`. If the site blocks that,
  fetch from inside a Chrome page. As a last resort for reads, run the page itself and read its
  own response.
- **Repair.** If the request stops working (a rotated id, a moved field), re-learn it and save
  the new version only after a replay succeeds. Otherwise the call returns an error, not
  someone else's data.

[Details](docs/REFERENCE.md#replay-fallback-and-repair) · [design](docs/DESIGN.md)

## Limits

- It is a local tool, not a hosted API. It uses your machine, your network and your sessions.
- It knows only the operations it was taught. It doesn't support every feature of every site.
- Repair can fail. There is no CAPTCHA solving, and if a site challenges real Chrome, you have
  to clear the challenge by hand.
- No write operations are bundled. LinkedIn messaging isn't bundled and hasn't been tested
  against LinkedIn. Writes are tested only against a local fixture, and they need
  `--allow-writes`. An HTTP 2xx doesn't prove a message was delivered.
- Credentials stay in `~/.api-anything`, and specs hold references, never values. Read each
  site's terms: you are responsible for how you use it.

[All limits](docs/REFERENCE.md#status-and-known-limits)

## Docs

[Benchmark](bench/README.md) · [Demos](docs/demos/README.md) · [Setup for agents](docs/QUICKSTART.md) ·
[Reference](docs/REFERENCE.md) · [Design](docs/DESIGN.md) · [Release checks](docs/RELEASE-READINESS.md) ·
[Contributing](CONTRIBUTING.md)

MIT licensed.
