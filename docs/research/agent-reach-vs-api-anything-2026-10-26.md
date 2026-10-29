# Agent-Reach vs api-anything — overlap evaluation (2026-10-26)

Status: **DEFERRED** (user decision 2026-10-26). Not installed on this machine
(`~/.agent-reach/` absent as of writing).

## Context

The user is designing a future "boss/coordinator" stack (local model orchestrates
work plus free external APIs). They found
[Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)
("give your AI agent eyes to the entire internet", ~102k stars, MIT, Python CLI,
actively maintained) and asked for an overlap evaluation against our `api-anything`
MCP before integrating anything.

## What Agent-Reach is

- `agent-reach <channel> <action> [args]`. Channels: default (bilibili, v2ex, github,
  youtube, web), optional (xiaohongshu, xueqiu, boss, xiaoyuzhou, linkedin, reddit),
  experimental (twitter, facebook, instagram).
- Each action = ordered list of preferred + fallback upstream tools (e.g. web: Jina
  Reader then Exa; youtube: yt-dlp family; github: local).
- Read-only. Login-protected channels use a dedicated background browser per site and
  copy that site's Chrome login into it (alt account recommended). State confined to
  `~/.agent-reach/`. Install is agent-driven via `docs/install.md`.
- A Groq/OpenAI key is needed only for audio→text; subtitles/captions work key-free.
- Privacy note: the "web" channel phones out to Jina Reader (external service) for
  clean markdown; the other default channels run local tools.

## Measured overlap (this machine, 2026-10-26)

`api-anything` (installed MCP; `list_sites`): airbnb, amazon, goodreads,
google-flights, hacker-news, instagram, linkedin, x, youtube.

YouTube ops verified live via MCP `list_operations` (site: youtube): **search only**
(id, title, channel, views) — no video info, no captions, no transcription.

| Capability | api-anything (ours) | Agent-Reach |
|---|---|---|
| YouTube search | yes | yes (overlap) |
| YouTube video info + captions + speech→text | no | yes (new; transcription needs Groq/OpenAI key) |
| Reddit (search / read / comments) | no | yes (login required) |
| GitHub structured (repo / issues / PRs + comments) | ≈ webfetch (noisy) | yes, local, clean |
| X / LinkedIn / Instagram | yes | "experimental" tier (we already have these) |
| Chinese platforms (bilibili, xiaohongshu, v2ex, xueqiu) | no | yes (bilibili/v2ex default, no login) |

## Decision and plan (when the user resumes)

Keep deferred. Plan (user's words): take what is good and useful and integrate it into
this project. An existing project line already works on api-anything (session
"api-anything: ripresa progetto + confronto RAE", October 2026).

Integration candidates (as new site specs / operations in `sites/`, following this
repo's tier-ladder architecture):

1. `youtube`: add `captions` (yt-dlp subs — free, no key) and, optionally,
   `transcribe` (external key → separate operation, flagged).
2. `reddit`: new site (search posts, read, comments) via the site's own data
   requests — api-anything's native approach, no third-party service.
3. `github`: new site (read repo/README, issues, PRs + comments) — structured,
   read-only.
4. Upstream-tool reference for each channel: Agent-Reach source (`agent_reach/`,
   `docs/README_en.md`).

Re-verification (fresh agent):

- Ours: MCP `list_operations` for youtube; `list_sites` for the full set.
- Theirs: README of https://github.com/Panniantong/Agent-Reach (channel table + install).

## Update (same day, afternoon): viral reel showcasing this exact gap

A widely shared Instagram reel (@jens.heitmann, verified; 56K likes; posted
2026-08-09, "Create any Claude Code Agent from YouTube") showcases
`bradautomates/claude-video` ("watch" skill, ~19.3k stars, MIT, ~2k forks).
Function: a video URL or local file becomes **timestamped frames**
(scene-change/keyframe selection, detail budgets efficient/balanced/token-burner,
16x16 near-duplicate removal, `--start/--end`, cue frames at `--timestamps`) +
**native captions readable without downloading the video** + optional
**transcription** (local WhisperX in a managed Python 3.12 venv, or cloud Groq
whisper-large-v3 / OpenAI whisper-1). Two engines: `local` (yt-dlp + ffmpeg +
ffprobe, fully offline; YouTube also needs a JS runtime — Deno/EJS/curl-cffi) and
`gemini` (whole video relayed to Google's agentic video model with a free AI
Studio key; timestamped answer returned; local files uploaded to Google's Files
API and deleted after the reply).

Implications:

- Confirms the `youtube` integration candidate above is the right one. The reel's
  value is a **ready reference design** for a `watch` operation (frame selection
  and detail-level taxonomy worth copying), not a new gap: its local engine is
  exactly the yt-dlp stack this plan already names.
- Environment check on this box (2026-10-26): `ffmpeg`, `ffprobe`, `yt-dlp`,
  `whisperx` all ABSENT. A captions-only `watch` needs `apt install ffmpeg` +
  `uv tool install yt-dlp`; GPU whisper is a later option (3x RTX 5090, see the
  torch-blackwell skill) — a head start over the upstream CPU-int8 reference.
- The reel's other two elements: Anthropic `skill-creator` duplicates our
  `learn-to-skill` skill (no action); the step "reconcile two model reads into
  confirmed / single-source / conflict labels, check only conflicts" is
  methodology for the future boss/coordinator architecture (multi-model
  consensus), not a tool to install.
- If the skill is ever imported as-is (it targets Agent Skills hosts, so OpenCode
  qualifies), it must pass the `skill-import-gate` scan first — it ships
  executable Python under `skills/watch/scripts/`. Preferred path stays: port the
  operation into this repo per the plan above.

Provenance: local agent (OpenCode, Qwen3.8-abliterated 27B, xhigh) evaluated both
stacks on 2026-10-26; overlap numbers measured live from the installed api-anything
MCP, not from marketing text. Same file extended later that day with the
bradautomates/claude-video reel evaluation (section above; reel read via browser
MCP — full caption extracted from the page).
