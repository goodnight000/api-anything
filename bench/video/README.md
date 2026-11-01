# Raw race recordings

`record-race.mjs` keeps Claude Code stream events, Playwright's browser WebM and a
timeline for an editor. It does not style or render a finished video.

```sh
node bench/video/record-race.mjs --task netflix-1 --sequential \
  --out bench/video/raw-popular-2026-10-31
```

Use an unused output directory. Existing recordings are never deleted. The default
without `--sequential` retains the old simultaneous behavior; use sequential mode
when another job is rendering video or the machine cannot support two agents.

A sequential recording runs the browser arm, takes its rendered-page truth, then
runs the API arm and takes its truth. Each event time starts at that arm's spawn.
The timeline explicitly says **sequential replay**. An editor may align those clocks
to compare progress, but must not call it simultaneous footage. Never present the
recording's timings as the five-trial benchmark medians.

For the popular tasks, `browser-result.json` and `api-result.json` retain full result
usage, truth and grades. `browser.jsonl` and `api.jsonl` retain every raw stream
event. `footage/*.webm` is the unstyled browser recording. The timeline contains
tool names, arguments, timings, token totals and final answers. Its historical
`usage.tokens` includes both input and output; the benchmark table's input-only
metric is computed separately from Claude Code's final usage fields.

Keep raw directories local, as `.gitignore` specifies. Link the absolute recording
directory in the handoff to the video team. Do not run `render.mjs` to overwrite
the historical Flights assets when the request is only for raw footage.
