# Setup and demos

Use Node 22.13 or newer. Install a Chromium browser if you want to learn operations or use the
browser tier: Google Chrome by default, or Brave, Microsoft Edge, Chromium, Vivaldi, Arc — any
Chromium executable works, and a non-default one is named with `API_ANYTHING_BROWSER` (a name
like `brave`, or the path). The runtime is local: it needs no API Anything account, cloud
service, or model key. Your coding agent supplies the reasoning when creating an operation.

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
account or a browser. `ok: false` includes a class, reason and next step. CLI failures exit nonzero.
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

For any other client, or when a client can't find `api-anything` or `node`, print its entry with
absolute paths:

```sh
api-anything mcp --print-config
```

It prints the add command for Claude Code, Codex, Gemini CLI and VS Code, and the JSON entry for
Cursor and Claude Desktop, all pointing at the absolute path of the `node` you ran it with and of the
installed CLI. Pass the flags you want served (`--allow-writes`, `--sites goodreads`) and it adds
them. A client started from the Dock or a menu may not get your shell's `PATH`, so a bare
`api-anything`, or a `node` installed with nvm, is not found there. `API_ANYTHING_HOME` and
`API_ANYTHING_BROWSER` are copied into the entry when you have them set.

Restart the agent session. Ask it to list API Anything sites, then search Hacker News for sqlite.
It should discover `list_sites`, `list_operations`, `call_operation`, `get_job` and `login`, and use
`call_operation` with `site: "hacker-news"`, `op: "search"`, `args: {"query":"sqlite"}`. A server
started with `--allow-writes` adds `call_write_operation`. See the
[official MCP setup instructions](https://developers.openai.com/codex/mcp).

`api-anything mcp --sites goodreads,hacker-news` also serves each operation of those sites as a tool
of its own (`goodreads__searchBooks`), with its arguments' schema, so the agent skips
`list_operations`. Each one adds to the tool list the client sends with every request, so name only
the sites you use.

For creating new operations, give the coding agent the installed skill:

```sh
mkdir -p ~/.agents/skills/api-anything
cp "$(npm root -g)/api-anything/skills/api-anything/SKILL.md" ~/.agents/skills/api-anything/SKILL.md
```

Codex discovers skills under `~/.agents/skills`; existing installations may also use
`~/.codex/skills`. See [official skill discovery](https://developers.openai.com/codex/skills).
An MCP-only client can call operations but needs a shell-capable agent or a person to create them.

### Client timeouts

A call over plain HTTP takes well under a second. A call that repairs itself or runs the page in the
browser can take minutes, and so can a sign-in window. So any tool call still running after about
25 seconds answers `class: "pending"` with a `job`, and `get_job` waits up to 25 seconds more for
it, so no call outlasts a 60-second client limit. The server never needs a tool timeout above 60
seconds. A cold start through `npx` downloads the package, which can outlast a short startup
timeout.

"From docs" means the client's own documentation; "from source" means its source code; "reported"
means an issue or forum post only. Checked in October 2026.

| client | startup timeout | tool-call timeout | how to raise them | |
|---|---|---|---|---|
| Claude Code | 30 s | about 28 hours; calls move to the background after 2 minutes | `MCP_TIMEOUT` and `MCP_TOOL_TIMEOUT` (ms) in the environment, or `"timeout"` on the server in `.mcp.json` | from [docs](https://code.claude.com/docs/en/mcp) |
| Codex (CLI and IDE) | 30 s (10 s in older builds and the docs) | 300 s (60 s in older builds and the docs) | `startup_timeout_sec`, `tool_timeout_sec` under `[mcp_servers.api-anything]` in `~/.codex/config.toml` | from [docs](https://learn.chatgpt.com/docs/extend/mcp) and source |
| Gemini CLI | 600 s, one setting for both | 600 s | `"timeout"` (ms) on the server in `settings.json`, or `gemini mcp add --timeout` | from docs and source |
| VS Code | none found | none found | none | from source |
| Cursor | not documented | not documented | not documented | from [docs](https://cursor.com/docs/context/mcp) |
| Claude Desktop | not documented | about 60 s; a `timeout` in the config is ignored | none | reported |

### Troubleshooting

- **The client says the server failed to start, or shows no api-anything tools.** It can't find
  `api-anything` or `node`. Run `api-anything mcp --print-config` and use its entry, which has
  absolute paths. Check `node --version` is 22.13 or newer for the `node` it names.
- **It worked, then stopped after you switched Node versions.** The entry names the old version's
  `node` (an nvm path holds the version). Run `--print-config` again and replace the entry.
- **The client reports a startup timeout through `npx`.** The first `npx` run downloads and builds
  the package. Run the `npx` command once in a terminal to fill npm's cache, or install the CLI
  globally, then raise the client's startup timeout (table above).
- **A call answers `class: "pending"`.** It is still running: call `get_job` with its `job`. Don't
  call the tool again: the same call while it runs joins it, and a write is not sent twice.
- **`get_job` answers `no job`.** The job finished more than 15 minutes ago, or the server
  restarted, which ends its jobs. Call a read again; for a write, check the site first.
- **A tool call times out in the client.** Raise the client's tool-call timeout to 60 seconds or
  more (table above). No tool waits longer than about 25 seconds before it answers.
- **The client asks for approval before every read.** Restart it so it loads the current tool list:
  `call_operation` is advertised read-only, and only `call_write_operation` asks.
- **`login` with mode `"window"` answers `pending`.** The window is open for the user. Tell them to
  sign in and close it, then call `get_job`. A second `login` meanwhile returns the same job, and
  the window closes by itself after 10 minutes.
- **The server sees none of your learned sites.** The client started it with another home. Set
  `API_ANYTHING_HOME` in your shell before `--print-config`, which copies it into the entry, or add
  it to the entry's `env`.
- **A per-op tool from `--sites` is missing.** A site named there that doesn't exist stops the
  server from starting: check `api-anything sites`. A write is a tool only with `--allow-writes`.

## Demo 1: teach once, call with new arguments

From the clone, with a Chromium browser (default Chrome; any works) and `jq` installed:

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
