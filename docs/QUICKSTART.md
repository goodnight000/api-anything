# Setup and demos

Use Node 22.13 or newer. Install Google Chrome if you want to learn operations or use browser
fallback. The runtime is local: it needs no API Anything account, cloud service, or model key.
Your coding agent supplies the reasoning when creating an operation.

## Install and check

The shortest path is to paste this into your coding agent:
`Set up API Anything for me: https://github.com/goodnight000/api-anything/blob/main/INSTALL.md`.
[INSTALL.md](../INSTALL.md) lists the steps the agent follows. By hand:

```sh
git clone https://github.com/goodnight000/api-anything.git
cd api-anything
npm ci
npm install -g "$(npm pack --silent)"
api-anything sites
api-anything call hacker-news search query=sqlite
```

The last command should return `ok: true`, `tier: 1`, and a list of stories. It does not need an
account or Chrome. `ok: false` includes a class, reason and next step. CLI failures exit nonzero.
For a reproducible deployment, run `git checkout <commit>` before `npm ci` and update that pin
only after testing. Packing first avoids an npm 11 global Git-install failure that omits build
dependencies. The installed command contains built files and does not depend on keeping the clone.
The package is not published to npm yet. npm must be allowed to run its `prepare` script.

To try a read without a global install, this path is also verified:

```sh
npx -y github:goodnight000/api-anything call hacker-news search query=sqlite
```

Use `github:goodnight000/api-anything#<commit>` with `npx` to pin a revision.

## Connect an agent

For Claude Code, after installing the CLI:

```sh
claude mcp add --scope user api-anything -- api-anything mcp
mkdir -p ~/.claude/skills/api-anything
cp "$(npm root -g)/api-anything/skills/api-anything/SKILL.md" ~/.claude/skills/api-anything/
```

For Codex:

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

From the clone, with Chrome and `jq` installed:

```sh
./examples/teach-once.sh arxiv.org
```

The script learns `hn-demo.links` from the Hacker News pages for `github.com` and `github.io`.
It prints the saved slot, then calls the operation with `arxiv.org` over plain HTTP
(`--max-tier 1`). It exits nonzero unless every returned URL is on the requested domain. The
commands it runs:

```sh
api-anything add hn-demo links --trigger 'https://news.ycombinator.com/from?site={domain}' \
  --example domain=github.com --example2 domain=github.io --match path=/from \
  --html '{"items":"tr.athing","fields":{"title":".titleline > a","url":".titleline > a@href"}}'
api-anything call hn-demo links domain=arxiv.org --max-tier 1
```

This shows one reusable operation. It doesn't map every feature of Hacker News. A new site
usually needs an agent to choose the request, identify the arguments and pick the response fields.
To call the same operation the way an MCP client does, run
`node examples/mcp-call.mjs hn-demo links domain=nature.com`.

## Demo 2: an internal research workflow

From a checkout:

```sh
npm ci
npm run demo -- 'agent memory'
```

The example returns a short brief. It contains the first five Hacker News search results and a
`calls` log with each call's transport tier and time. It checks `ok` and truncation before using
a result, and exits with an error if a call fails.

For company research, import your existing LinkedIn session once, then run the same workflow
with enrichment. If several profiles are found, choose your account from the candidates. The
profile name below is a placeholder, not an account to assume.

```sh
api-anything login linkedin
# If prompted: api-anything login linkedin --profile 'Chrome/<your profile>'
api-anything call linkedin getMe
node examples/research.mjs anthropic --linkedin
```

This searches companies, then uses each returned `universalName` to fetch company details, for
at most three companies. It sends no messages. The JSON can feed an agent's brief, a local
report, or your existing job runner. Use one persistent MCP process for shared pacing, because
independent CLI processes are rate-limited separately. Treat `auth`, `rate`, `blocked` and
`drift` as incomplete work. Recordings and captured output for both demos are in
[docs/demos](demos/README.md).

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
