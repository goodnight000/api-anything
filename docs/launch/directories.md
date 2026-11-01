# Directories

Where to list API Anything, what each place needs, and the copy to paste. Statuses were checked on
2026-10-31; directories change their rules often, so look again before submitting. Files in this
repository that a directory reads are described in [../DISTRIBUTION.md](../DISTRIBUTION.md).

## Copy to paste

Name: API Anything

Package: `api-anything` on npm. Server name on the MCP Registry: `io.github.goodnight000/api-anything`.

Install: `npx -y api-anything setup`, or as an MCP server
`{"command":"npx","args":["-y","api-anything","mcp"]}`.

Short description (92 characters, fits the MCP Registry's 100):

> Call websites as APIs: a shared catalog of operations learned from each site's own requests.

One paragraph:

> When an agent needs a website that has no API, API Anything finds the site in a shared catalog or
> learns its own request from two page loads, then calls it over plain HTTP from your machine. Shared
> operations are verified by other installs' calls and repaired when the site changes. Cookies and
> tokens stay on your machine as references; writes are off unless you allow them.

Longer description, where a directory has room:

> API Anything turns websites without an API into operations an agent can call. When an agent needs
> a site, `find_sites` searches a shared catalog. If another install already learned it,
> `call_operation` sends one HTTP request from your machine. If nobody has, `learn_site` loads the
> page in a headless browser with two example inputs, turns what changed into a parameter, checks it
> with a third value, replays it with no cookies, and shares it. A new operation goes live after
> installs on 2 other networks call it successfully. When a site changes, the first install to
> repair the operation shares the fix. The catalog stores specs and counts reports and never proxies
> a request. In a benchmark on Google Flights (Claude Opus 5.5, median of 5 runs), the same agent
> answered 1.5 to 2 times sooner with about half the tokens, at the same cost or less, 20 of 20
> correct. 107 read operations across 55 sites today. MIT licensed, no account, no API key.

Categories, in order of fit: Web data or Search & Data Extraction; Browser Automation; Developer
tools. Tags: web scraping, API, browser, reverse engineering, self-healing, MCP, Claude Code.

Media: `docs/media/logo.svg` (icon; export a square PNG for directories that refuse SVG),
`docs/media/agent-race.gif` (demo), `docs/media/how-it-works-light.svg` (diagram).

## In order

| # | where | how | cost | status on 2026-10-31 |
|---|---|---|---|---|
| 1 | Official MCP Registry | automatic from `release.yml` on the next release; or by hand, see DISTRIBUTION.md | free | not listed; needs an npm release with `mcpName` first |
| 2 | Glama (glama.ai/mcp/servers/goodnight000/api-anything) | sign in with GitHub as goodnight000, claim the listing (glama.json names you), rename it | free | listed under the old name site2api, "cannot be deployed", not graded |
| 3 | punkpeye/awesome-mcp-servers | pull request adding one line (below) | free | asks for a Glama listing first |
| 4 | GitHub MCP Registry (github.com/mcp) | reads the official registry | free | follows #1 |
| 5 | PulseMCP | ingests the official registry; its submit form is paused since September 2026 | free | follows #1 |
| 6 | Claude Code plugin (this repository) | already works: `/plugin marketplace add goodnight000/api-anything` | free | live, but main still says version 0.2.0 and lists 4 tools until this change merges |
| 7 | Anthropic's Claude directory (claude.ai/directory/manage) | submit the plugin; add `.claude-plugin/icon.png` first | needs a paid Claude plan | not submitted |
| 8 | MCP Market (mcpmarket.com/submit) | form: GitHub URL | free | not submitted |
| 9 | mcpservers.org (mcpservers.org/submit) | form | free | not submitted |
| 10 | LobeHub (lobehub.com/mcp) | sign in, submit the GitHub URL | free | not submitted |
| 11 | cursor.directory | sign in, submit as an MCP server with the JSON above | free | not submitted |
| 12 | mcp.directory | form | free | not submitted |
| 13 | Smithery (smithery.ai/new) | needs an MCPB bundle; see DISTRIBUTION.md | free | not submitted |
| 14 | mcp.so (mcp.so/submit) | form | $39 to list | optional |
| 15 | Cline MCP Marketplace (github.com/cline/mcp-marketplace) | open an issue with the repo URL and a 400x400 PNG logo | free | not submitted |
| 16 | Other GitHub lists: TensorBlock/awesome-mcp-servers, MobinX/awesome-mcp-list, tolkonepiu/best-of-mcp-servers, toolsdk-ai/toolsdk-mcp-registry | pull request per list's own format | free | not submitted |

Skip for now:

- **Docker MCP Catalog** (github.com/docker/mcp-registry): it runs servers in containers.
  Learning, logins and the browser tier need a Chromium browser and the user's own sessions, so a
  container listing would ship a server that can only call shared operations. Revisit with a
  `--no-learn` image if people ask.
- **Gemini CLI extensions** (geminicli.com/extensions): needs a `gemini-extension.json` in the
  repository. `api-anything mcp --print-config` already prints the `gemini mcp add` command, so
  this is a small follow-up if Gemini CLI users show up.

## awesome-mcp-servers line

Section: Browser Automation (or Search & Data Extraction). Keep the section's alphabetical order by
`owner/repo`. The emoji are the list's own legend (TypeScript, runs locally, macOS, Windows,
Linux), required by its format:

```markdown
- [goodnight000/api-anything](https://github.com/goodnight000/api-anything) [![goodnight000/api-anything MCP server](https://glama.ai/mcp/servers/goodnight000/api-anything/badges/score.svg)](https://glama.ai/mcp/servers/goodnight000/api-anything) 📇 🏠 🍎 🪟 🐧 - Call websites that have no API: finds an operation in a shared catalog or learns the site's own request from two page loads, calls it over plain HTTP, and repairs it when the site changes.
```

Pull request title: `Add goodnight000/api-anything`. Body: the one-paragraph description above.
