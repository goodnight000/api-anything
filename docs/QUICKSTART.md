# Setup and demos

Use Node 22.13 or newer. Install Google Chrome if you want to learn operations or use browser
fallback. The runtime is local: it needs no API Anything account, cloud service, or model key.
Your coding agent supplies the reasoning when creating an operation.

## Install and check

```sh
npm install -g github:goodnight000/api-anything
api-anything sites
api-anything call hacker-news search query=sqlite
```

The last command should return `ok: true`, `tier: 1`, and a list of stories. It does not need an
account or Chrome. `ok: false` includes a class, reason and next step. CLI failures exit nonzero.
For a reproducible deployment, install `github:goodnight000/api-anything#<commit>` and update
that pin deliberately after testing. GitHub installs build TypeScript on installation; npm must
be allowed to run the package's `prepare` script. The package is not published to npm yet.

## Connect an agent

For Codex, after installing the CLI:

```sh
codex mcp add api-anything -- api-anything mcp
codex mcp get api-anything
```

Restart the agent session. Ask it to list API Anything sites, then search Hacker News for sqlite.
It should discover `list_sites`, `list_operations`, `call_operation` and `login`, and use
`call_operation` with `site: "hacker-news"`, `op: "search"`, `args: {"query":"sqlite"}`.
See the [official MCP setup instructions](https://developers.openai.com/codex/mcp).

For creating new operations, give the coding agent the installed skill:

```sh
mkdir -p ~/.agents/skills/api-anything
cp "$(npm root -g)/api-anything/skills/api-anything/SKILL.md" ~/.agents/skills/api-anything/SKILL.md
```

Codex discovers skills under `~/.agents/skills`; existing installations may also use
`~/.codex/skills`. See [official skill discovery](https://developers.openai.com/codex/skills).
An MCP-only client can call operations but needs a shell-capable agent or a person to create them.
Other MCP clients can use `{ "command": "api-anything", "args": ["mcp"] }` as their server entry.
If a desktop app cannot find the executable, use the absolute path from `command -v api-anything`.

## Demo 1: teach once, call with new arguments

This learns an HTML page, then requests a different domain without navigating a browser:

```sh
api-anything add hn-demo links --trigger 'https://news.ycombinator.com/from?site={domain}' \
  --example domain=github.com --example2 domain=github.io --match path=/from \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'
api-anything call hn-demo links domain=arxiv.org --max-tier 1
```

Check the preview after learning and inspect the returned URLs after the call. This demonstrates
one reusable operation; it does not map every feature of Hacker News. A new site usually needs
an agent to select requests, identify arguments and choose the response fields.

## Demo 2: an internal research workflow

From a checkout:

```sh
npm ci
npm run demo -- 'agent memory'
```

Or, with the global install:

```sh
node "$(npm root -g)/api-anything/examples/research.mjs" 'agent memory'
```

The example returns the first five Hacker News search results as JSON. It checks `ok` and
truncation before using the result and exits with an error when a call fails.

For company research, import your existing LinkedIn session once, then run the same workflow
with enrichment. If several profiles are found, select your account from the candidates; the
example profile name below is a placeholder, not an account to assume.

```sh
api-anything login linkedin
# If prompted: api-anything login linkedin --profile 'Chrome/<your profile>'
api-anything call linkedin getMe
node "$(npm root -g)/api-anything/examples/research.mjs" anthropic --linkedin
```

This searches companies and uses each returned ID to fetch company details, for at most three
companies. It sends no messages. The JSON can feed an agent's brief, a local report, or your
existing job runner. Use one persistent MCP process for shared pacing; independent CLI processes
have independent rate limits. Treat `auth`, `rate`, `blocked` and `drift` as incomplete work.

## Writes and limits

The engine supports learning writes by intercepting and aborting requests, then calling the
saved operation with explicit write permission. Local tests verify different recipients and
content, no sends during learning, write refusal by default, and ambiguous-response handling.
No LinkedIn messaging operation ships with this release. Building one requires observing its
real request flow and verifying delivery to an explicitly authorized recipient.

Calls are local, not a hosted REST service. Sites can change, require login, or block automation.
The framework attempts recovery; it cannot guarantee every site or every feature. A fallback
that cannot honor the requested arguments fails instead of returning unrelated data. Read each
site's notes with `api-anything ops <site>`, particularly the limits on dates, pagination and fields.
