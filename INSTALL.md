# Install API Anything (for an AI agent)

A user asked you to set up API Anything. Do these steps in order and stop to tell the user if one
fails. Everything runs locally and needs no account or API key. Running the steps again updates an
existing install.

## 1. Check requirements

```sh
node --version && npm --version && git --version
```

Node must be v22.13 or newer. If Node is missing or older, stop and tell the user; don't change
their Node yourself. Also check whether Google Chrome is installed. It's needed only to teach new
sites, so a missing Chrome isn't a reason to stop.

## 2. Install the command

The package isn't on npm yet, so build it from a temporary clone. Run this as one command:

```sh
dir="$(mktemp -d)" && git clone -q --depth 1 https://github.com/goodnight000/api-anything.git "$dir" && (cd "$dir" && npm ci --no-audit --no-fund && npm install -g "$(npm pack --silent)"); status=$?; rm -rf "$dir"; (exit $status)
```

A non-zero exit status means the clone, the build or the install failed: stop and show the user
the output. Don't use `npm install -g github:goodnight000/api-anything`, because it fails under npm 11. If
the global install fails with a permission error (EACCES), don't use sudo. Tell the user and stop.

## 3. Check that it works

```sh
api-anything call hacker-news search query=sqlite
```

Expect `"ok":true` and `"tier":1`, which is a plain HTTP call with no browser.

## 4. Connect it to yourself

Run the block for the agent you are. Each block adds the MCP server, whose tools call
operations, and the skill, which teaches you how to turn new sites into operations. If an
`api-anything` MCP server is already configured, leave it as it is.

Claude Code:

```sh
claude mcp add --scope user api-anything -- api-anything mcp
mkdir -p ~/.claude/skills/api-anything && cp "$(npm root -g)/api-anything/skills/api-anything/SKILL.md" ~/.claude/skills/api-anything/
```

Codex:

```sh
codex mcp add api-anything -- api-anything mcp
mkdir -p ~/.agents/skills/api-anything && cp "$(npm root -g)/api-anything/skills/api-anything/SKILL.md" ~/.agents/skills/api-anything/
```

Any other MCP client: merge this server into its MCP config. If the client can't find the
command, use the absolute path from `command -v api-anything`. If the client loads skills,
install `SKILL.md` from the path above.

```json
{ "mcpServers": { "api-anything": { "command": "api-anything", "args": ["mcp"] } } }
```

## 5. Tell the user

- It's installed, and what step 3 returned.
- They need to restart this agent session to load the new tools.
- Things to ask after the restart: "What does Goodreads rate Piranesi?", "What sites can API
  Anything call?", or "Turn <a website> into an API for me."
- If Chrome is missing, they need it before teaching new sites.
