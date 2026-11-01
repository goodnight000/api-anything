No account is needed. Reads public repositories only.

- `searchModels` and `searchDatasets` match words in the repository id (`owner/name`), not in the
  model card, sorted by trending, first page (30) only.
- `getModel` takes the id split in two: `openai/whisper-large-v3` is `author=openai`,
  `name=whisper-large-v3` (both come back from `searchModels`). The case of the id matters
  (`Qwen`, not `qwen`).
- A model id that doesn't exist, or a private one, answers `class: "auth"` (Hugging Face sends
  HTTP 401 rather than 404 for both). Check the id with `searchModels` before anything else: a
  login does not help with a public model.
- `gated` is `false`, `"auto"` or `"manual"`: a gated model's record is public, but its files need
  an account that accepted its terms.
- `task` (the pipeline tag), `license`, `library` and `parameters` are missing when the repository
  doesn't declare them; `parameters` is counted only from safetensors weights.
- In `searchDatasets`, `rows` and `modalities` come from the dataset viewer and are missing for a
  dataset it can't read.

## Maintainer notes

Verified 2026-10-31, logged out, from a clean `API_ANYTHING_HOME`: `api-anything verify
huggingface` passed 5 of 5 cases (each op's example, plus an `empty` check for each search).
Every call answered at tier 1 (plain HTTP).

| op | request | checked with (not an example) | tier |
|---|---|---|---|
| `searchModels` | typing into "Filter by name" on `/models` fires `GET /models-json?sort=trending&search=...&withCount=true` | `q=qwen` (Qwen models); `q=zzqqxxwvnothingmatch` gives `[]` | 1, about 0.3-0.8 s |
| `getModel` | `GET /api/models/<author>/<name>`, the Hub's public JSON; the trigger opens it directly | `author=Qwen name=Qwen3.8-27B` | 1, about 0.6 s |
| `searchDatasets` | the same filter box on `/datasets` fires `GET /datasets-json?...` | `q=gsm8k` (`openai/gsm8k` first) | 1, about 0.5 s |

- The search triggers wait 3 s before filling the box: filled any earlier, before the page's
  script is ready, the box fires no request.
- `add` flagged `x-request-id` (a per-request trace id) as changing between runs, then found the
  template replays fine. The header was removed from both search requests before `verify` and in
  this file; the calls work without it.
- Loading `/models?search=...` directly renders the list into the HTML (inside a `data-props`
  attribute) and fires no JSON request, so the trigger loads `/models` and types instead.
- `getModel` was not given an `input` check, because a missing id answers 401 (`class: "auth"`).
- The pages also load an AWS WAF script (`edge.sdk.awswaf.com`); its beacons are stopped during
  learning, and plain HTTP calls were never challenged.
