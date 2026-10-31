# Benchmark: an agent with a browser vs the same agent with API Anything

## Offline engine latency

`node --import tsx bench/engine.mjs` measures response judging, picking, capping, outlining,
request filling, localhost calls, and cold compiled CLI calls. Build first. `--repo <snapshot>`
compares another checkout or an archived baseline; pass `--revision <commit>` for an archive
without Git metadata. `--only cli-cold-localhost` isolates startup. Results include the source
hash and median batch latency; `p95BatchMeanMs` is not an individual-call tail percentile.

`node --import tsx bench/import.mjs` measures a pinned import from disposable synthetic browser
databases. Both scripts assert their results and use no real accounts or live websites. See
[the audit](../docs/PERFORMANCE-AUDIT.md) for the before/after protocol and measured limits.

## Popular-site results, 2026-10-31

Median of five trials per task per arm; ranges are in parentheses. All 20 answers
passed the frozen rendered-page graders. The model was `claude-opus-5-5` through
Claude Code 2.1.316, authenticated through a local CLI proxy, with the same prompt
and settings in both arms. The proxy did not change the requested model.

| task | setup | correct | time | cost | tokens to the model |
|---|---|---|---|---|---|
| Netflix: 3 episode titles and runtimes, 1 lookup | browser | 5/5 | 22.3 s (15.7–31.5) | $0.0433 (0.0420–0.0761) | 43,800 (32,711–43,890) |
| Netflix: 3 episode titles and runtimes, 1 lookup | API Anything | 5/5 | 9.6 s (7.7–12.4) | $0.0402 (0.0399–0.0697) | 31,132 (31,124–31,140) |
| IKEA: addresses of 5 stores | browser | 5/5 | 31.4 s (29.1–32.4) | $0.0747 (0.0460–0.0811) | 52,521 (42,665–56,327) |
| IKEA: addresses of 5 stores | API Anything | 5/5 | 18.1 s (14.8–34.1) | $0.0713 (0.0709–0.0713) | 49,861 (49,855–49,863) |

API Anything had a lower median time on both tasks. Netflix's time ranges did not
overlap. IKEA's did: API trial 4 took 34.1 s against the browser's 29.1 s, with
19.2 s inside the five-read batch. IKEA browser trials 3 and 5 also cost less and
used fewer input tokens than the corresponding API trials. Cost ranges overlap
on both tasks; this does not establish a broad cost advantage.

![Time and model cost on Netflix and IKEA](../docs/media/popular-benchmark-light.svg)

The grading rules were written in [the frozen protocol](results/popular-2026-10-31/protocol.md)
before the runs. Immediately after each trial, fresh signed-out headless Chrome
read the rendered page's visible DOM text, independently of API Anything's extraction.

- **Netflix:** check the first three episode cards displayed by default on the public
  [Stranger Things page](https://www.netflix.com/title/80057281), without changing
  season. All three titles and integer runtimes must match, in order. Only case,
  punctuation, whitespace and leading episode numbers are ignored.
- **IKEA:** check the Address sections for Emeryville, East Palo Alto, West Sacramento,
  Costa Mesa and San Diego. All five complete street/city/state/ZIP addresses must
  match the correct store. Store order, case, punctuation, whitespace, an optional
  leading IKEA store name and the explicitly listed address abbreviations in the
  protocol are ignored. A duplicate cannot replace a missing store.

The runner alternated browser then API for each task, five times, sequentially.
Every trial started in a fresh temporary directory; API Anything started with an
empty home and the bundled specs, without a seed or imported session. Playwright
MCP was pinned to 0.0.82, using headless Chrome 156 at 1280×800. The browser agent
used scripts and in-page `fetch` for some IKEA lookups; it was not restricted to
clicking or reading full-page snapshots. Every recorded run made real tool calls
and reported the requested model. No website write operations were called.

Time is Claude spawn to exit. Cost is `total_cost_usd` at API list prices, including
prompt caching. This table's tokens are **input only**, including cache-read and
cache-creation input. The historical chart script's `tokens` field includes output
too; `inputTokens` is the new, separately named field used here. Raw trials retain both.

The 20 trials cost **$1.1635208** in reported model usage. The lowest sampled
`memory_pressure` free percentage was 14%, or 86% used. Checks ran every five seconds
during trials. Other work shared this Mac, including video rendering, so this was
not an idle-machine test. Each comparison is **one site, one model, a few runs**.
These two tasks read public HTML; they do not establish performance on logged-in
sites, personalized feeds, arbitrary shopping searches, or the web as a whole.

YouTube was excluded in preflight because two fresh top-five rendered searches
shared only three videos, below the proposed four-of-five rule. Reddit's independent
headless truth browser showed a human challenge. Neither was scored with a weaker
rule. The selected prompts and graders were not tuned between arms or trials.

[Raw trial records](results/popular-2026-10-31/trials.jsonl),
[summary](results/popular-2026-10-31/summary.json),
[source hashes and environment](results/popular-2026-10-31/manifest.json), and
[model/tool audit](results/popular-2026-10-31/audit.json) are committed.
Full stream logs, rendered text and screenshots stay in the ignored
`bench/results/popular-2026-10-31/raw/` directory.

The single Netflix recording also passed both grades: browser **28.4 s / $0.0439586**,
API Anything **11.3 s / $0.040809**. It cost $0.0847676, bringing total reported model
spend to **$1.2482884**. Netflix was selected because its benchmark timing ranges did
not overlap; the recording was not rerolled. It is a **sequential replay race**, not
simultaneous execution, to respect the shared-machine limit. Those two extra runs
are not included in the five-trial table.

The unstyled 1280×800 VP8 WebM, full event logs, per-arm truth and timeline are kept
in `bench/video/raw-popular-2026-10-31/`; [the recording receipt](results/popular-2026-10-31/recording.json)
includes the filename, SHA-256 and probe. The 17.64-second WebM excludes some agent
startup and answer-writing time. Use the event timestamps for the race clock, not
clip length. The browser agent read DOM snapshots without scrolling to the episode
cards, so the raw footage mainly shows the Netflix landing page; its exact tool
results and episode answers are in the logs. A separate team can style the edit.

To repeat the two tasks, authenticate `claude`, build this checkout, then use a new
results directory. The runner stops on provider failures, unknown spend, time or
memory limits; it does not change models.

```sh
mkdir -p bench/results/popular-rerun
node bench/run-agents.mjs --tasks netflix-1,ikea-5 --trials 5 \
  --out bench/results/popular-rerun > bench/results/popular-rerun/trials.jsonl
node bench/charts.mjs popular-rerun
```

## Historical Google Flights comparison

One Claude Code agent gets the same prompt twice. In one run it has only a browser (Playwright
MCP on headless Chrome). In the other it has only API Anything's MCP server with the bundled
`google-flights` operations. The same model, settings and prompt are used in both, with fresh
state for every trial. Runs alternate between the two setups and were measured on 2026-09-28
on one Mac.

| | |
|---|---|
| Model | `claude-opus-5-5` through `claude -p`. Your hooks, CLAUDE.md and other MCP servers are not loaded (`--setting-sources project --strict-mcp-config`), and built-in tools are off (`--tools ""`). |
| Browser setup | `@playwright/mcp@0.0.82 --isolated`, headless Google Chrome, 1280×800 |
| API Anything setup | `api-anything mcp` from this checkout, empty `API_ANYTHING_HOME`, bundled specs only |
| Task `flights-1` | "On Google Flights, find the cheapest nonstop one-way flight from SFO to JFK departing 2026-10-20. Reply with one line: airline, departure time, price in USD." |
| Task `flights-5` | The same for each departure date from 2026-10-20 through 2026-10-24, one line per date |
| Time | Wall time from starting `claude` until it exits |
| Cost | `total_cost_usd` as reported by Claude Code, at API list prices including prompt caching |
| Correct | Right after each trial, a snapshot of Google's top and other flight lists is taken. Each date's quoted price must equal the cheapest nonstop fare in that snapshot. Several flights often tie on price, so the airline isn't graded. |

## Results

Median of 5 trials each. Ranges are in brackets.

| task | setup | correct | time | cost | tokens to the model |
|---|---|---|---|---|---|
| 1 date | browser | 5/5 | 12.9 s (12.2–14.3) | $0.166 (0.102–0.239) | 46.7k |
| 1 date | API Anything | 5/5 | 8.4 s (8.1–11.3) | $0.074 (0.073–0.077) | 21.3k |
| 5 dates | browser | 5/5 | 41.6 s (38.7–52.9) | $0.154 (0.111–0.254) | 55.6k |
| 5 dates | API Anything | 5/5 | 21.1 s (20.5–24.3) | $0.152 (0.151–0.154) | 28.6k |

With API Anything the agent answered in half to two-thirds of the time and read about half as
many tokens. Its time and cost barely varied between trials. On the single-date task it cost 55%
less. On the five-date task the cost was the same: the browser agent wrote one Playwright script
that visited all five dates, while the API agent made ten small calls.

Without an agent, getting the flight list took a median of 1.42 s with a script driving
headless Chrome (about 37 requests) and 1.17 s with `api-anything call` (10 runs each,
[`transport.mjs`](transport.mjs)). Google Flights renders its results on the server, so the
operation fetches the same page the browser loads. On this site, the difference is structured
JSON, not transport speed.

![Scripted Chrome page load vs api-anything call](../docs/media/transport-light.svg)

## Before and after 0.1.0's output changes

The first batch, run the same day with 0.1.0's output, showed API Anything costing **more** on
the five-date task: a median of $0.209 against $0.139. Its tool results were verbose. Each
flight carried Google's full stop tuples (airport names, cities), and every result repeated its
field names in every item. Two changes followed, and every trial was run again:

- `google-flights` `search` and `top` return `via` (stop airport codes) instead of the raw stop
  tuples, and drop `departureDate`, which always equals the requested date.
- MCP `call_operation` sends a list of records as `{columns, rows}`, so each field name appears
  once. On a real search result this halved the JSON (3,247 → 1,517 characters).

| task | setup | 0.1.0 time | 0.1.0 cost | now time | now cost |
|---|---|---|---|---|---|
| 1 date | API Anything | 8.6 s | $0.087 | 8.4 s | $0.074 |
| 5 dates | API Anything | 20.8 s | $0.209 | 21.1 s | $0.152 |
| 1 date | browser | 14.8 s | $0.164 | 12.9 s | $0.166 |
| 5 dates | browser | 42.5 s (one run 140 s) | $0.139 | 41.6 s | $0.154 |

The 0.1.0 batch wasn't graded for correctness. Its truth snapshots were taken only before and
after the batch, and the Oct 22 fare changed from $309 to $315 during it. Raw summaries:
[v0.1.0/summary.json](results/v0.1.0/summary.json).

## The recorded race

[`docs/media/agent-race.mp4`](../docs/media/agent-race.mp4) shows both agents started at the
same moment on `flights-5`, played at 3× speed. Its timers show real elapsed time. The browser footage is Playwright's own recording of that agent's
page, and everything else is drawn from the two runs' event logs
([`video/timeline.json`](video/timeline.json)). An earlier attempt failed before the browser
opened, because Playwright's ffmpeg wasn't installed. After that, three races were recorded,
with browser times of 88.7 s, 51.5 s and 51.1 s. The video uses the one closest to the benchmark median, which is the
third. In that race, API Anything finished in 23.0 s for $0.150 and the browser agent in 51.1 s
for $0.135. Both got every date right. Running both agents at once shares one machine and
network, so the benchmark numbers come from runs made one at a time. The footage starts when the
browser agent's first tool call does. Playwright stops adding frames once the page goes idle, so
the last frame is held while the agent writes its answer.

## Reproduce

Requires the `claude` CLI (signed in), Google Chrome, ffmpeg, and `npm ci && npm run build`.
It costs roughly $3 in model usage at API rates.

```sh
node bench/run-agents.mjs --trials 5 > bench/results/trials.jsonl   # about 15 min
node bench/transport.mjs --trials 10 > bench/results/transport.jsonl
node bench/charts.mjs                                             # summary.json and docs/media/*.svg
node bench/video/record-race.mjs && mv bench/video/raw bench/video/raw-run1
node bench/video/render.mjs raw-run1                              # docs/media/agent-race.*
```

Raw event logs (`bench/results/raw`, `bench/video/raw-*`) stay local. They hold full tool
results and page text.

## Limits of this benchmark

- One site, one model, one browser tool, a few dozen runs, on one day. Google Flights is a
  server-rendered page. On sites where the browser must run a heavy client-side app before the
  data appears, the gap in time without an agent would differ, but this benchmark didn't
  measure that.
- The browser agent was capable. It used `browser_evaluate` and wrote Playwright scripts
  instead of reading full page snapshots. A weaker model or a snapshot-only browser tool would
  cost more, and that wasn't measured either.
- Cost covers model usage only. Running Chrome costs memory and CPU; API Anything's tier-1 call
  doesn't start a browser.
- Prices are live. Grading uses a snapshot taken seconds after each trial, not during it.
