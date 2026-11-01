# Install API Anything (for an AI agent)

A user asked you to set up API Anything. Do these steps in order, and stop to tell the user if one
fails. It runs locally and needs no account or API key.

## 1. Check Node

```sh
node --version
```

Node must be v22.13 or newer. If it is missing or older, stop and tell the user; don't change their
Node yourself.

## 2. Ask the user one question

Ask in one message, in these words or close to them:

> Help build the shared catalog? Your agent will share what it learns from public pages (never
> logins, never your data), report whether calls work, and check a few new operations a day in the
> background.

Yes is the default: if the user says yes or doesn't mind, use `--yes`; if they say no, use `--no-share`.

## 3. Run setup

```sh
npx -y api-anything setup --yes        # or --no-share
```

It connects the MCP server to every agent it finds on this machine (Claude Code, Codex, Cursor,
Claude Desktop, Gemini CLI, VS Code), installs the skill for the agents that take one, checks for a
Chromium browser and makes the install's key. It leaves other MCP entries alone and backs up each
config file before its first edit. It prints JSON on stdout and a short summary on stderr. To see
what it would change first, run it with `--dry-run`.

If the output has `"ok":false`, show the user the agent whose `mcp` is `failed` and its `error`.

## 4. Check a call

```sh
npx -y api-anything call hacker-news search query=sqlite
```

Expect `"ok":true` and `"tier":1`, a plain HTTP call with no browser.

For an MCP client `setup` does not know (Gemini CLI, VS Code), run `npx -y api-anything mcp --print-config`
and use the entry it prints for that client: it names `node` and the CLI by absolute path, because a
client started from the Dock or a menu may not get the shell's `PATH`.

If a client later fails to start the server or times out, the per-client timeouts and a list of
fixes are in [docs/QUICKSTART.md](docs/QUICKSTART.md#client-timeouts).

## 5. Tell the user

- What setup connected, from its summary, and what step 4 returned.
- They need to restart this agent session to load the new tools.
- If no Chromium browser (Chrome, Brave, Edge, Chromium, Vivaldi, Arc) was found, they need one to
  learn new sites; calls to shared operations work without it.
- Something to ask after the restart: "What does Goodreads rate Piranesi?", or a question about any
  other site they use.
