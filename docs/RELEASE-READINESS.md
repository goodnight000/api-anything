# Release readiness — 2026-09-27

Ready for an early developer release of the local framework and its documented read workflows.
This is not a claim that every website, every operation, or unattended account action works.

## Verified

- `npm run check` and `npm test`: 416 tests passed, zero skipped, including real Chrome against
  localhost fixtures. Tests do not make external requests.
- `npm audit --omit=dev`: zero reported vulnerabilities at release time.
- Fresh GitHub clone → `npm ci` → pack → global install passed. Direct GitHub `npx` also passed.
  Global `npm install -g github:...` failed under npm 11.6.2; the documented pack-first route avoids it.
- A packed production-only install exposes all eight sites and 17 operations. A real stdio MCP
  client discovers all four tools, calls Hacker News, and receives structured failures.
- All 17 bundled read operations returned successful direct-HTTP responses in live checks.
  LinkedIn used an existing authorized session; the other sites were logged out. Flight calendar
  dates were checked against the requested interval. These are point-in-time checks on macOS,
  not a continuous availability guarantee or cross-platform acceptance run.
- The quickstart learned a new Hacker News domain-filter operation with github.com/github.io,
  then returned 30 arxiv.org links through tier 1 using a third input.
- `examples/research.mjs anthropic --linkedin` returned five stories and enriched three companies
  by passing company IDs from search into detail calls. It performs only reads.
- A local messaging fixture proves that one learned operation accepts different recipients and
  content, sends nothing during learning, refuses writes by default, and sends each authorized
  call once. No real LinkedIn message was sent or claimed delivered.
- A forced live Google Flights browser fallback refused the datepicker's unrelated date range.
  Direct calendar replay works; automatic repair of arbitrary datepicker ranges is not promised.

## Launch demos, later on 2026-09-27

The three README demos were run again and recorded, each against a fresh `API_ANYTHING_HOME`.
First, a fresh GitHub clone went through `npm ci` and the pack install with an empty npm cache,
then made a Hacker News call at tier 1. Second, `hn-demo.links` was learned from two domains and
returned 30 of 30 arxiv.org links at tier 1. Third, the research workflow ran five reads, all at
tier 1, using a copied LinkedIn session. After the example scripts changed, `npm run check` and
all 416 tests passed again. Commands, recordings and captured output are in
[demos](demos/README.md).

## Release fixes

- Keep distinct session tokens separate by operation and request position. Preserve and refresh
  every credential in compound fields; do not forward secondary credentials across origins.
- Strip discovered credential copies and refuse saving a spec if a detected secret remains.
- Return captured browser data only when established parameter slots match the caller's args.
  Healing may move a parameter but cannot invent a new prefix/suffix to make wrong data fit.
- Recognize explicit JSON write rejection even when the learned response recipe is HTML or
  embedded data. A changed receipt shape does not turn an accepted write into a retry.
- Package the research example and add CLI, Codex/MCP, skill, and demo setup instructions.

Independent standards and spec reviews reproduced the release blockers. Their fixes have
focused regressions, and the final candidate passed the full suite before landing.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run demo -- 'agent memory'
```

Follow [Setup and demos](QUICKSTART.md) for a clean global install, MCP setup, teaching a new
operation, and LinkedIn session import/enrichment. Browser tests require Google Chrome; a run
that skips them is not the release gate. Raw captures and account data stay out of the repository.

## Public claim boundary

The framework learns reusable, parameterized operations from browser traffic and calls them via
CLI, library or MCP. An agent chooses the requests, examples and extraction fields. Recovery is
bounded and can fail explicitly. It is not a hosted REST service or automatic coverage of a whole
website. LinkedIn messaging is not bundled. Real write workflows need their own authorized
recipient, delivery/read-back check and site-specific operation before being advertised.
