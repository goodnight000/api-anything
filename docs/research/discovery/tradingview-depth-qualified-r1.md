# TradingView depth qualification r1

PASS. One distinct public read added on 2026-10-28 UTC:
`listSectorInstruments(sector)`. It discovers stock overview path identifiers, tickers and
company names from the first server-rendered rows of a U.S. sector page. A returned
`NASDAQ-AMGN` identifier successfully fed the unchanged `getInstrument` operation.

Worker: `tradingview-depth-qualified-r1-20261028`, sole worker, no nesting.
Reservation began at 11:27:22.372472 UTC. Source cutoff was 11:35:22.372472 UTC;
qualification deadline was 11:47:22.372472 UTC. The useful A/B contract, paired learning and
notes preflight were established by 11:31:39 UTC. Functional qualification completed at
11:33:46.753 UTC, and site files were saved at 11:34:50 UTC. No further origin work followed.

## Saved contract and limits

- Input is an exact U.S. sector slug from TradingView navigation. Checked values are
  `electronic-technology`, `technology-services` and `health-technology`.
- Output is `instrument`, `symbol`, `name`, in the document's row order. `instrument` is the
  hyphenated overview path identifier, suitable as the existing detail operation's input.
  The existing detail output continues using the colon-qualified identity.
- Each checked sector document contained 100 rows. This is a partial discovery collection,
  without pagination, full-sector coverage, hydrated sort or stable ranking guarantees.
  Other sector slugs remain unqualified. Other exchanges occur in the lists; the detail
  operation remains validated only for NASDAQ common stocks.
- No financial columns, prices, ratings, recommendations, licensed news bodies, broker
  actions or market-availability promises are included. Currency and timeZone retain their
  original metadata meanings. timeZone is not an event timestamp.
- These are signed-out SSR document reads, not full GUI verification or an official feed.
  The prior official widget FAQ screen says TradingView has no data API. No new supported
  linked data interface was established; no scanner endpoint was guessed or contacted.

## Literal source chain and frontend evidence

The actual old envelopes at
`bench/explore/state/discovery/finance-qualification-r4/home/captures/cmvpbihy1269444.json`
and `cmvpbjtvu19de74.json` were inspected as capture objects with `exchanges`, request 1,
and `response.body`. Their AAPL/MSFT navigation linked respectively to the electronic-technology
and technology-services sector pages. They grounded navigation only, not fresh health.
Extracted old navigation and body copies are retained in this worker's ignored directory.

Fresh captures used the unchanged `bench/discovery/capture-document.mjs`, exact GET only,
with its 15-second trigger bound and a separate 60-second outer startup/cleanup allowance.
Every run held an atomic owned `browser.lock`, and released it after the helper exited.
Captured documents and independently decoded body files are distinct artifacts.

- A, `cmvs18obofbff31`, request 1, HTTP 200:
  `https://www.tradingview.com/markets/stocks-usa/sectorandindustry-sector/electronic-technology/`.
  236 exchanges, 235 aborted. First row NVIDIA; second Apple.
- B, `cmvs19jhyb7bf67`, request 1, HTTP 200:
  `https://www.tradingview.com/markets/stocks-usa/sectorandindustry-sector/technology-services/`.
  237 exchanges, 236 aborted. First row Microsoft; second Alphabet.
- D, `cmvs1b6dsebd643`, request 1, HTTP 200:
  `https://www.tradingview.com/markets/stocks-usa/sectorandindustry-sector/health-technology/`.
  238 exchanges, 237 aborted. First rows Eli Lilly, Johnson & Johnson and AbbVie.
- Independent detail, `cmvs1c7dac528e3`, request 1, HTTP 200:
  `https://www.tradingview.com/symbols/NASDAQ-AMGN/`.
  253 exchanges, 252 aborted.

A's literal sector-index link grounded one cookie-free direct HTTP source read of
`https://www.tradingview.com/markets/stocks-usa/sectorandindustry-sector/`.
Its actual navigation supplied the health-technology URL. `heldout-selection.json` records
that literal source, its hash, the chosen D argument, and the candidate hash before D output.
This HTTP source read is not represented as a frontend capture. D's actual table supplied
the literal Amgen detail link. No domains other than TradingView were contacted.

## Qualification gates

1. `paired-add.json` records actual A/B `addOperation` learning with both saved capture
   envelopes and request 1. Learning was offline, with a fetch implementation that refuses
   network. Warnings were empty and there was no `unproven` mark. Both 100-row collections
   differed meaningfully. The new recipe reads `tbody[data-testid="selectable-rows-table-body"] tr`
   and the row's symbol/company links, rather than the existing `symbolInfo` object.
2. Exact public-example candidate JSON plus complete draft notes passed `vetShared` with
   zero errors and warnings before D capture, cold replay or live qualification.
   `preflight-vet.json` records 1,214 caller UTF-16 units before exact `## Maintainer notes`.
3. `independent.py` uses Python's stdlib HTMLParser, without runtime selectors, extract or
   pick. It reads all D rows, both literal links, text and `data-rowkey`, checks both links
   agree and every path identity agrees with its row key, and preserves source order.
   The cold tier-1 result matched all three claimed fields in every one of 100 rows, in
   exact order. `independent-D.json` and `heldout-comparison.json` retain this comparison.
4. `cold-listSectorInstruments/` began with zero entries. Only the exact candidate JSON and
   draft notes were installed before its first call, D at tier 1. `cold-input.json` records
   empty-home state and input hashes; `send-1-launch.json` and `send-1-receipt.json` record
   Cookie and Authorization absence at the actual first send. All eight qualification
   sends were cookie-free and authorization-free. No guest cookies were issued or reused.
5. `verifySite` at `maxTier: 1` passed all six cases: original AAPL/MSFT/NVDA and new
   electronic-technology/technology-services/health-technology. Each response was judged
   against its actual operation before any later send. A fixed eight-URL sequence rejected
   retries, redirects and unexpected sends before fetch. No healing or fallback occurred.
   Every request had a 15-second timeout and one-second pacing.
6. The eighth request passed the returned `NASDAQ-AMGN` identifier to unchanged
   `getInstrument`. Python HTMLParser independently read the visible title/h1 and separate
   FinancialProduct JSON-LD in the captured detail document, without reading symbolInfo.
   Identity, ticker, company, stock type, currency, ISIN and NASDAQ exchange matched.
   The unchanged timeZone field was retained as metadata without a new timestamp claim.
7. Current passing records exist for every stored case. Original opHash remains
   `4a1ea337cd6d63e4`; new opHash is `996e19cc45d2cba1`. Each has three passing current
   records in `cold-listSectorInstruments/checks/tradingview.json`.
8. Final public-example export, tested candidate, cold input and saved site JSON are
   byte-identical. Final exact JSON plus notes passed `vetShared` with zero errors/warnings.
   Secret/export warning lists were empty. No bundled site files were written before the
   functional gates passed. `saved-files-audit.json` records the final comparison.

## Hashes and preservation

- Original JSON: `880cd3d961a60aaa0445426caa957e3a04b4170b41ca15011a78f11061607d95`.
- Final JSON: `a510e9e18ed74dcb2674dbb7a157298c02755567959d219f51604f21bc0c9e85`.
- Final notes: `d6544f3e69234e2896d8551719719ded14165cf5a89e35e0cb82c078eb597ec5`.

The whole original getInstrument operation, including example, checks, descriptions, request,
headers, slots, trigger, matcher and response recipe, compares identically to the separate
baseline copy. `parent-baseline.json` was kept intact. All eight frozen Pinterest,
Rotten Tomatoes, Rightmove and Steam JSON/notes hashes still matched that parent baseline.
The approved publication manifest was not written; its observed path/hash is recorded in
`publication-manifest-observation.json`. No pre-run independent hash of that manifest was
recorded, so that receipt does not claim a before/after hash comparison.

## Stops, execution and cleanup

Current full state snapshots, including completed tasks, stops, aliases, claim and expired
provider cooldown, were retained before origin commands and each qualification send.
TradingView had no applicable prior stop, and the sole active task was this worker.
All 13 responded website reads were HTTP 200 and core `ok`: four exact-document browser
reads, one direct HTTP navigation source read, and eight tier-1 qualification reads.
No auth, rate, challenge, origin error, redirect or request failure occurred. Thus no
`STOP.json` was created. Qualification probes persist a sticky stop before returning an
actual operation failure and refuse later fetches when it exists. No workaround was used.

`capture.py` logs wrapper and child PIDs plus live Chrome descendants, command, home, times
and exits to each `*-process.json`, with stdout/stderr redirected from launch. All four
browser commands exited 0, without outer timeout. `terminal-sessions.jsonl` records their
terminal sessions and the other asynchronous sessions. Qualification PID and start time
are in `cold-input.json`; completion is in `qualification.json`, exit 0. The offline learning
session ID was retained, but its live PID was not recorded. No ownership claim relies on it.

`cleanup.json` checked the 54 PIDs observed alive during browser runs and found zero surviving
matching owned processes. The browser lock was absent; no cleanup signals were necessary.
Only owned lock directories were removed after helper exit. No unrelated processes were
stopped. No CPU/memory snapshots, resource admission wrappers, watchdogs or recovery waits
were used. Existing helper defaults and source stayed unchanged.

All raw evidence, executable probes, isolated homes, profiles and guest jars remain ignored
under `bench/explore/state/discovery/tradingview-depth-qualified-r1-20261028/`.
`manifest.json` enumerates retained paths, bytes and SHA-256, with capture envelopes separated
from decoded bodies, plus probes, baselines, final files and home artifacts.
`capture-provenance.json` gives capture-specific request IDs, statuses and body/envelope hashes.
Shared registry, lint, type and operation-count checks remain parent-owned and were not run
by this worker. No state/runbook/shared-check/runtime/dependency/other-site/old-evidence edits,
commits, pushes, PRs or publication occurred.
