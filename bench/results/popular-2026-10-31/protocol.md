# Frozen protocol, 2026-10-31

Recorded before any paid agent trial. The question is whether the same agent answers
these public-site tasks correctly with less time, model cost, or input context when
given API Anything instead of Playwright MCP. No speedup is assumed.

- `netflix-1`: first three episode titles and runtimes displayed by default on the
  public Stranger Things page, https://www.netflix.com/title/80057281. One lookup.
- `ikea-5`: street, city, state and ZIP for IKEA Emeryville, East Palo Alto, West
  Sacramento, Costa Mesa and San Diego. Five store-detail lookups.
- Exact shared prompts are in `bench/run-agents.mjs`. Five trials per task per arm,
  in this fixed order per repetition: Netflix browser, Netflix API, IKEA browser,
  IKEA API. No prompt or spec changes after trials start, and no retries to improve
  results. All attempts, refusals, errors and missing snapshots count in the report.
- Model `claude-opus-5-5` through `claude -p`, existing harness settings, no built-in
  tools, only the arm's MCP server, fresh temporary working directory and initially
  empty API Anything home per trial. No seed. Same default model effort in both arms.
- Playwright MCP 0.0.82, isolated headless Google Chrome, 1280 by 800. Dependencies
  are installed before timing. No everyday browser session or cookies are imported.
- Truth is taken immediately after each agent exits, in a new signed-out headless
  Chrome context. It reads visible DOM text, independently of the operation's
  response extraction. Keep its text, screenshot and observation timestamps.
- Netflix passes only if all three titles and integer runtimes match the rendered
  cards, in order. Case, punctuation, whitespace and leading episode numbers do not
  matter. No missing or extra episodes; optional JSON code fences are accepted.
- IKEA passes only if all five complete addresses match the corresponding rendered
  Address sections. Store order is irrelevant. Case, punctuation, whitespace,
  an optional leading IKEA store name, and Street/St, Avenue/Ave, Boulevard/Blvd,
  Drive/Dr, Road/Rd and California/CA are equivalent. Street numbers, city and ZIP
  must match. A duplicate store cannot replace a missing store.
- A missing truth snapshot is ungraded, not correct. A failed agent is a failure.
  Every published timing includes failures. Correctness is reported beside speed.
- Time is spawn-to-exit wall time. Cost is Claude Code `total_cost_usd`, API list
  prices including caching. Tokens to the model are `input_tokens` plus cache-read
  and cache-creation input tokens; output tokens are saved separately. Report median
  and min/max for all three metrics. Do not replace missing metrics with zero.
- Model limits: $1 requested cap per trial, $25 batch limit, $30 whole-session
  limit including the recording. Stop if cost is unavailable or a trial is interrupted.
  Batch ceiling 120 minutes, four minutes per agent, whole task under three hours.
- Sequential trials only. Check `memory_pressure` before each trial and every five
  seconds during it. Do not start, or terminate this run's own process group, at
  10% or less system-wide free memory. Leave other agents and processes alone.
- Record one additional pair on a task with full correctness and a clear measured
  difference, if one exists. Run it sequentially too; label the aligned edit as a
  replay race, not a simultaneous race. Preserve its full logs and browser WebM.
  Do not reroll for a better outcome. Its timings are separate from the 20 trials.

Preflight excluded YouTube before any paid trial: two fresh top-five rendered lists
shared only three videos, below the proposed four-of-five rule. No weaker rule was
adopted. Reddit's default headless page showed a human challenge, so it cannot supply
this independent rendered truth. IKEA's guessed `sacramento` URL redirected to the
directory; the official directory supplied `west-sacramento`. Preflight receipts
are retained. No Google Flights, Goodreads, Amazon or other paid task was run.

Limits: each comparison is one site, one model, a few runs, on one shared Mac and
network. Both selected sites serve these public facts in HTML. This is not a general
web-agent benchmark, a transport-only benchmark, or a test of logged-in browsing.
The known task set and pre-existing bundled specs are a capability check, not an
unseen-task evaluation. Another agent may render video on the machine during runs.
