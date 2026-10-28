# Electronics discovery round 1

2026-10-26 UTC. Research finished within the 20-minute batch. Site order was Apple, Samsung, then Dell. Apple validation continued while independent Dell public reads ran. No nested delegation, source/dependency edits, commits, pushes, PRs, publication, browser imports, login, site writes, or access-control bypass. Shared state, runbook, catalog, and other site files were left to the parent.

## Outcome

| Site | Status | Saved operations | Limit |
|---|---|---|---|
| Apple | PASS | `getTechSpecs(product)` in `sites/apple.json`; caller/maintainer notes in `sites/apple.md` | US iPhone technical-specification documents only; server-rendered content, not a hydrated GUI |
| Samsung | BLOCKED | None | First public homepage GET returned HTTP 403; stopped immediately |
| Dell | BLOCKED | None | First model browser capture succeeded; second model browser capture returned HTTP 403; stopped immediately |

Overall: ISSUES, with one proven reusable operation and two blocked domains. No failed or inconclusive operation was added to the registry. The parent owns integrated repository checks.

## Apple

`getTechSpecs(product)` accepts one iPhone model-family URL segment, with local pattern `iphone-[a-z0-9-]+`. It returns a one-item list containing the page identity and grouped specifications. `name` is the page heading. `models` lists the table column headings where present. `capacity`, `chip`, `display`, `dimensions`, and `battery` preserve each matching specification column as text in document order. Columns can name one model, both models, inner/outer displays, or open/closed dimensions. Units and footnote numbers remain in the text. These are Apple's published claims, not independently measured hardware or battery results. No offer, inventory, checkout, or personal context is returned.

Routes came from actual frontend links: the public homepage linked `/iphone/`, `/iphone-18-pro/`, and `/iphone-duo/`; the iPhone catalog linked `/iphone-16/specs/`; each other model overview linked its own `/specs/` page. No product ID or endpoint route was guessed.

| Stage | Exact input | Evidence |
|---|---|---|
| Example 1 browser capture | `product=iphone-18-pro` | `cmvp3hk4s0a130f`, document request 1, HTTP 200; 17 other requests aborted |
| Example 2 browser capture | `product=iphone-16` | `cmvp3hz3f395ae4`, document request 1, HTTP 200; 14 other requests aborted |
| Learning | Both captures through CLI `add --from/--from2 --pick-request 1` | `apple-add.out`, minimum tier 1, zero warnings, signed out |
| Unseen replay | `product=iphone-duo --max-tier 1` | `apple-unseen.out`, `ok: true`, tier 1 |
| Independent meaning comparison | Public iPhone Duo document read before replay | `apple-proof.py`, `apple-meaning.json`; exact equality of every returned field |
| Verification | Example; `iphone-16`; `iphone-duo`; `invalid/path` | `verifySite("apple", {maxTier: 1})`, `apple-verify.out`; four passes, no failures or inconclusive cases |
| Export | Public examples retained | `apple-export.out`, zero warnings; `sites/apple.json` |
| Fresh cookie-free replay | `product=iphone-duo --max-tier 1` | `apple-fresh.out`, `apple-fresh-evidence.json`; tier 1, exact same data |
| Direct shared-spec validation | Parsed exported JSON and complete notes | `apple-vet.out`: `errors: []`, `warnings: []` |

The unseen comparison used a separate public HTTP document and Python HTMLParser, independently of the runtime's HTML extraction. It checked the exact page identity, capacity, chip, three display columns, two dimension/state columns, and battery text. It also asserted inner versus outer display meaning, the named chip, and open versus closed dimensions. The site's observed iPhone names and specification claims are retained as returned content on this date.

The fresh home initially contained only a copied exported spec under `sites/apple.json`, with no session, cookies, or browser profile. The tier-1 replay required no existing state. Afterwards the runtime saved one newly received server cookie in `sessions/apple.json`, with no session values; no browser profile was created. This is a cookie-free initial replay, not a claim that the server sets no cookies.

Source and request URLs:

- `https://www.apple.com/`
- `https://www.apple.com/iphone/`
- `https://www.apple.com/iphone-18-pro/`
- `https://www.apple.com/iphone-duo/`
- `https://www.apple.com/iphone-18-pro/specs/`
- `https://www.apple.com/iphone-16/specs/`
- `https://www.apple.com/iphone-duo/specs/`

The experimental `capture-document.mjs` helper captured real browser traffic and aborted all requests except the requested GET document. Inline scripts may run, but this is not a fully hydrated GUI capture. No response was converted into fabricated browser evidence. The spec has one path parameter slot, no credential refs, no volatile anchors, and `learnedLoggedIn: false`.

Limitations: no product search/category operation, other Apple product families, numerical normalization, footnote resolution, prices, stock, configurators, accounts, or purchases were verified. `models` is empty on the third page because it has no matching table column headings; other columns retain their own labels. An empty array on another layout would not establish that a hardware feature is absent. The invalid-path check is local argument validation; no site-level empty case was invented.

## Samsung stop

The first signed-out public GET, `https://www.samsung.com/us/`, returned HTTP 403 at `2026-10-26T10:09:58.839187+00:00`, 374 bytes, with title `Access Denied`. The domain was stopped immediately. No browser capture, alternate host or route, login, or operation was attempted. Evidence: `samsung-home.meta.json`, `samsung-home.html`, `samsung-home.out`, and `samsung-home.resources.jsonl`.

## Dell stop

The public homepage `https://www.dell.com/en-us` and its actual laptop-catalog link `https://www.dell.com/en-us/shop/laptop-computers/scr/laptop` loaded with HTTP 200. Real catalog product links supplied these model-family documents:

- `https://www.dell.com/en-us/shop/laptop-computers/spd/dell15laptopdc15250`
- `https://www.dell.com/en-us/shop/laptop-computers/spd/dell16laptopdc16250`
- `https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260`

All three initial cookie-free HTTP documents answered 200. The first browser document capture, `cmvp3m1o61e4ddd`, also answered 200 for Dell 15, request 1, with 59 other requests aborted. Local `inspect` established that the SSR cards contain offer IDs, advertised USD price strings, product URLs, and labeled processor/OS/graphics/memory/storage/display/color text. Those cards were read without clicking or selecting a configuration. No account, cart, warranty, trade-in, address, store, or customer data was requested.

The second browser document capture, `cmvp3mnq87883b1`, returned HTTP 403 for Dell 16 at about `2026-10-26T10:13:33Z`, request 1, with one other request aborted. This domain was then stopped immediately. There was no third-input replay, further host/route exploration, learning, verification, export, or saved Dell spec. Earlier HTTP success does not override this stop. Raw successful reads and the failed capture remain available as evidence, not as reusable operations.

## Evidence and resources

All paths in the stage table are relative to ignored `bench/explore/state/discovery/electronics-r1/`. Each executed command has `<label>.command.json`, `<label>.out`, `<label>.exit`, and `<label>.resources.jsonl`. Raw documents have `.html` and `.meta.json` files. Browser captures are under `apple-home/captures/` and `dell-home/captures/`. Isolated absolute homes are `apple-home/`, `samsung-home/`, `dell-home/`, and `apple-fresh-home/` beneath the evidence root. Samsung's isolated home stayed empty.

All network/browser commands and operational CLI checks ran through `resource_gate.py`. Browsers used default CPU admission 65%, memory admission 88%, CPU stop 85%, memory stop 90%. Bounded browser-free reads and tier-1 operations used the permitted memory admission 89%, hard stop 90%, retaining the CPU thresholds. Two memory admission denials sent no site request; each command was retried once after at least 30 seconds and then succeeded. No watchdog terminated an admitted command.

`resources-summary.json` retains 45 resource samples. Sampled CPU peaked at 57.43%; gate-defined memory peaked at 89.77%, on a denied admission. Raw occupied RAM peaked at 99.73%. The gate excludes file-backed cache but retains anonymous inactive and compressed memory. This does not establish that raw occupied RAM or unsampled transients remained below 95%.

Four browser commands acquired the atomic global mutex with an `electronics-r1-` owner token and released only their own lock after the owned command exited. Five lock-busy attempts sent no browser command. Final cleanup at `2026-10-26T10:14:02Z` found no batch-owned browser process and no global browser lock. No unrelated process was stopped; ignored raw evidence was retained. See `cleanup.json`.
