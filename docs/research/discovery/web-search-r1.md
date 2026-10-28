# Public web search discovery, round 1

Outcome: ISSUES overall. Bing PASS, DuckDuckGo BLOCKED. Work completed 2026-10-26 09:44 UTC, within the 20-minute limit. Sites investigated in the assigned order. No other domain was probed as a candidate. Google Search and Trends were not retried.

## Files and operation

- `sites/bing.json`: `search(q)` returns organic title, Bing result click URL, and an optional snippet.
- `sites/bing.md`: caller limits and maintainer evidence.
- This report.
- Ignored evidence directory: `bench/explore/state/discovery/web-search-r1/`.

No DuckDuckGo spec was saved. Existing ready specs, core, dependencies, catalog, runbook, and coordinator state were left untouched. No commits, pushes, PRs, or publication.

## Bing: PASS

Signed-out public source and request: `https://www.bing.com/search?q={q}`, GET document. Separate new home: `bing/home` under the ignored evidence directory. No personal cookies or login were imported. The captured request needs no cookie or session reference.

| Evidence | Arguments | Receipt |
| --- | --- | --- |
| First genuine frontend capture | q=python programming | `cmvp2e5d0`, request 1, HTTP 200, 9 organic cards |
| Second genuine frontend capture | q=rust programming | `cmvp2evqu`, request 1, HTTP 200, 10 organic cards |
| Learn from both captures | Python and Rust | `bing-add.stdout`: minTier 1, warnings [] |
| Unseen tier-1 replay | q=javascript programming | `bing-replay.stdout`: ok, tier 1, 10 cards |
| Third genuine frontend capture | q=javascript programming | `cmvp2fwnb`, request 1, HTTP 200, 10 cards |
| Identity and meaning comparison | JavaScript replay versus third frontend document | `bing-comparison.json`: all 10 destination identities and titles match; 9 snippets match after whitespace normalization; 1 absent in both |
| Public checks | q=rust programming; q=javascript programming | `bing-check1.stdout`, `bing-check2.stdout` |
| Browser-free verify | Python example plus both checks | `bing-verify.stdout`: 3/3 pass at tier 1, no heal |
| Public export | --keep-examples | `bing-export.stdout`: sites/bing.json, warnings 0 |
| Initially empty fresh-home reuse | q=javascript programming | `bing-fresh-before.json`, `bing-fresh.stdout`: home initially nonexistent, zero cookies/sessions, ok tier 1, 10 cards |
| Fresh reuse comparison | Same public JavaScript query | `bing-fresh-comparison.json`: all 10 destination identities match frontend, all rows have title and URL |
| Direct vetShared with final notes | Exported JSON and sites/bing.md | `bing-vet.stdout`: errors [], warnings [] |

The organic selector is `#b_results li.b_algo`; fields are `h2 a`, `h2 a@href`, and `.b_caption p`. Both learned examples differ in subject and answer. Python results included W3Schools and Python.org; Rust results included rust-lang.org and the Rust book. The JavaScript third input is separate from learning. Bing redirect destinations were decoded locally only to compare identities; no destination link was fetched and the spec returns Bing's original click URL.

Limits: first page only, organic cards only, no locale or pagination claim. The URL may be a Bing tracking redirect rather than a canonical destination URL. Snippets can be absent. The recorded public checks assert nonempty results; manual and saved third-input comparisons establish subject and identity more strongly. No empty-result behavior was established. An initial `red pandas` HTTP scout returned weakly relevant results, including Reddit and a general Red page; no biological relevance claim is made. Its status/URL receipt remains in `bing-http.stdout`.

## DuckDuckGo: BLOCKED

Cookie-free HTTP GET `https://duckduckgo.com/?q=python%20programming` returned HTTP 200 at 09:42:06 UTC. It was a JavaScript shell, not a results document. Its own noscript markup linked `/html/?q=python%20programming` and announced redirection to the non-JavaScript site. This established the source for the next public read before any control had been encountered.

At 09:42:46 UTC, GET `https://duckduckgo.com/html/?q=python%20programming` redirected normally to `https://html.duckduckgo.com/html/?q=python%20programming` and returned HTTP 202 with `challenge-form` and `anomaly.js` markers. No organic cards were present. Stopped the entire DuckDuckGo domain immediately. No form submission, CAPTCHA interaction, JS execution, proxy, alternate endpoint, or browser retry followed the challenge.

Receipts: `duckduckgo-http.stdout`, `duckduckgo-html-http.stdout`; source main-page HTML and metadata in `duckduckgo/http-main.html` and `http-main.json`; challenged response and metadata in `duckduckgo/http.html` and `http.json`. Raw content stays ignored. A prior browser command was declined by the global browser lock and sent no request. The isolated `duckduckgo/home` remains empty. No genuine DuckDuckGo browser capture, learn, third-input replay, verify, export, fresh reuse, or vet was completed. There is no reusable DuckDuckGo operation from this run.

## Resources and cleanup

All expensive HTTP, browser, learn, verify, export, and vet commands ran through `resource_gate.py`. Browser commands used the default CPU65/memory88 admission and CPU85/memory90 stop. Browser-free tier-1 work used the permitted memory89 admission and memory90 stop with CPU65/85. No resource exit 75 occurred, so no 30-second resample was needed. Two browser-lock-busy attempts returned without starting browser work; HTTP research continued while busy.

31 saved resource samples: peak CPU 41.88% at 09:40:14 UTC; peak policy memory 88.69% at 09:42:48 UTC. Both stayed below stop thresholds. Raw occupied RAM, including file-backed cache, peaked at 99.69%; the runbook's policy memory metric excludes that cache. These are sampled observations and do not establish the absence of transient spikes. Full sample locations and timestamps: `resource-summary.json` and `*.resources`.

Each browser command acquired the global lock through atomic mkdir and released only its own owner token after command exit. All three Bing capture commands exited normally. No owned browser lock or running worker command remained at cleanup; unrelated processes were not stopped. Captures remain private mode 0600 inside the ignored directory, and failed/busy/challenge receipts are retained. Parent owns integrated registry, typecheck, and lint validation.
