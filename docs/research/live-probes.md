# Live feasibility probes (2026-09-27)

Setup: macOS (Darwin 25.2.0), Node v25.1.0, `playwright-core@1.63.0`, installed Google Chrome
153.0.8010.53 via `chromium.launch({ channel: 'chrome' })`. No browser download. Logged out,
fresh context per run, read-only GETs and the site's own read queries, 1 to 8 requests per replay
script. Probe scripts live in `/tmp/site2api-probe/` (`probe.mjs`, `x-*.mjs`, `ig-*.mjs`, `gf-replay.mjs`,
`fidelity.mjs`, `sw.mjs`, `reddit2.mjs`). They are scratch files and are not part of the repo.

## Summary for the design

| Site | Where the on-screen data comes from on a hard load | Example value in that request? | Tier 1 (Node fetch) | Tier 2 (page fetch) |
|---|---|---|---|---|
| x.com/nasa | **SSR HTML document**, not an XHR. GraphQL `UserByScreenName` + `UserOriginalsTimeline` run server-side and are streamed into the HTML | yes, in the document URL and in the embedded query keys | document GET: works, no cookies needed. Direct `UserByScreenName` GraphQL: works with the bearer only. `UserOriginalsTimeline`: **404, empty body** | same as tier 1 (timeline also 404) |
| instagram.com/nasa | **SSR HTML document** (Relay preloaded queries). The only data XHR on a hard load is keyed by numeric id, not the handle | not in any XHR on a hard load. In XHRs after a **soft navigation** | `/api/graphql` POST: works, and substituting `username` works | works |
| news.ycombinator.com | HTML document, no JSON API | n/a (the URL itself) | works (200, 227 ms, 30 `athing` rows) | not needed |
| Google Flights | HTML document (`AF_initDataCallback`) **and** XHR `GetShoppingResults` (JSPB, chunked) | yes: `"SFO"`, `"JFK"`, `"2026-11-12"` as strings inside `f.req` | works, and substituting JFK with LAX works. Without the BotGuard header it works **sometimes** | works |
| reddit.com/search?q=mcp | could not observe: "Reddit - Prove your humanity" reCAPTCHA wall (headless, headed, and without automation flags). `old.reddit.com/search` redirects to login | unverified | Node fetch gets a JS challenge page. `search.json` returns 403 | not reached |

Main result: on three of the four sites that worked, **the hard-load request that carries the example value is
the HTML document**, not a JSON XHR. The draft design says "pick the request that carries the example values
and returns JSON". On a cold `page.goto` that request does not exist on X or Instagram. See "Design implications".

## 1. playwright-core + channel chrome: headless and headed

Both work. `fidelity.mjs` launched each mode 3 times in sequence:

| Mode | `launch()` | launch + newPage + about:blank |
|---|---|---|
| headless | 1336 / 333 / 283 ms (first launch is cold) | 1946 / 726 / 650 ms |
| headed | 290 / 304 / 272 ms | 910 / 708 / 675 ms |
| `launchPersistentContext` (fresh dir, headless) | 786 ms | n/a |

In the per-site probes, launch took 400 to 1800 ms. Time to load a page and wait a fixed 8 s settle window was
8.2 to 9.5 s. Most of that is the fixed wait.

Default headless is detectable, and x.com blocks it. The default headless UA is
`... HeadlessChrome/153.0.0.0 ...`, and `x.com/nasa` answers the document with **403**
(`net::ERR_HTTP_RESPONSE_CODE_FAILURE`). Setting `newContext({ userAgent })` to the same string with `Chrome/153.0.0.0`
fixes it (200, title "NASA (@NASA) / X"). With the override, `sec-ch-ua` on requests was already
`"Google Chrome";v="153", ...`, so only the UA string needs fixing. Use the reduced version
(`<major>.0.0.0`), not `browser.version()`, because real Chrome sends the reduced form.

## 2. Capture fidelity (`page.on('response')` + `request.allHeaders()` + `response.body()`)

Verified:
- `request.allHeaders()` returns the headers that went on the wire, including HTTP/2 pseudo-headers
  (`:authority`, `:path`, ...), `cookie`, `sec-fetch-dest/mode/site`, `sec-ch-ua*`, `origin`, `referer`, and
  app headers (`authorization`, `x-guest-token`, `x-client-transaction-id`, `x-csrftoken`, `x-fb-lsd`,
  `x-ig-app-id`, `x-goog-batchexecute-bgr`, `x-browser-validation`). Example: X's
  `api.x.com/1.1/graphql/viewer_context.json` request had all of these. When replaying, drop the `:`-prefixed
  pseudo-headers, `content-length`, and `accept-encoding`.
- `request.postData()` returns form-encoded and JSON bodies (Instagram `/api/graphql`, Google `f.req`).
- `response.body()` works for fetch/XHR and document responses, including Google's chunked `rt=c` stream.
  The full body is returned once the response completes.

Gaps observed:
- **Body is gone after navigation.** Keep a `Response` object, navigate away, then call `.body()`, and you get
  `Protocol error (Network.getResponseBody): No resource with given identifier found`. Read the body
  **inside** the response handler, before any further navigation, as `probe.mjs` does.
- Redirect responses have no body (`Response body is unavailable for redirect responses`, old.reddit 302).
- 204s and beacon/keepalive POSTs (`w3-reporting.reddit.com`, `pi.reddit.com`, recaptcha `clr`) give
  `No data found for resource with given identifier`. This is harmless because those requests are noise.
- `page.content()` (DOM serialization) **does not contain** X's SSR stream scripts after hydration. A regex that
  matched the raw document body did not match `page.content()`. Use the raw document response body
  (`(await page.goto(...)).text()`).
- Service workers: none registered on x.com or instagram.com across two loads in a persistent profile
  (`ctx.serviceWorkers()` was empty, and no `fromServiceWorker()` or `request.serviceWorker()` events fired).
  The SW-interception gap was not triggered, so it is **unverified**.
- SSE, WebSocket, and never-ending streaming bodies were not tested (**unverified**).

## 3. Per-trigger findings

### x.com/nasa (logged out)
- Logged-out still works when headed, or headless with the UA fix. Cookies set: `guest_id*`, `gt`
  (guest token), `personalization_id`, `__cf_bm`, `__cuid`, `g_state`.
- X now serves a new "x-web" frontend (`abs.twimg.com/x-web/x-web/entry-client-logged-out-*.js`) with streaming
  SSR (`data-tsr-stream-part` scripts, seroval-style `$R[n]=` serialization). **No client-side
  `UserByScreenName` or `UserTweets` XHR fires.** The document body contains
  `{kind:"GraphQLRequestStream.Started", key:"6tXRska4Vx-MZLENLErFmg{\"__relay_internal__pv__appviewerisloggedinprovider\":false,\"screenName\":\"nasa\"}", name:"UserByScreenName"}`
  followed by the full result, plus `UserOriginalsTimeline` (queryId `LpkpphcOWljdki66nzocrg`, variables
  `{count:20,cursor:null,screenName:"nasa",sortByMostLiked:null}`) with 5 tweets (`full_text` x5).
  `UserTweets` does not appear anywhere.
- The embedded payload is a **JS literal, not JSON** (`$R[17]={__typename:"User",...,can_view_expanded_profile:!1}`).
  Extracting it needs a seroval-aware parser or a JS evaluator, not `JSON.parse`.
- Scrolling 3 x 4000 px fired no further GraphQL calls. The logged-out timeline does not paginate.
- XHRs observed: `POST api.x.com/1.1/graphql/viewer_context.json`, `POST api.x.com/1.1/flow/viewer.json`,
  and Sentry. None carries profile data.

### instagram.com/nasa/ (logged out)
- Title "NASA (@nasa) • Instagram photos and videos". The document (742 KB) embeds Relay preloads in
  `ScheduledServerJS` → `RelayPrefetchedStreamCache` as real JSON, and embeds a manifest:
  `expectedPreloaders:[{queryID:"27981003384861049",variables:{username:"nasa"},queryName:"PolarisLoggedOutDesktopWWWProfileRootContentQuery"},{queryID:"27553725110923321",variables:{first:12,username:"nasa"},queryName:"PolarisLoggedOutDesktopWWWProfilePostsTabContentQuery"}]`.
  `follower_count:104335161` is in the document.
- Hard-load XHRs (`POST /api/graphql`, form body, `content-type: text/javascript` response): the only one with
  profile-adjacent data is `PolarisLoggedOutDesktopWWWAYMLQuery` (doc_id `26631739266527266`) with variables
  `{"id":"528817151"}`. That is the numeric user id, so **the handle is not in any XHR**.
- **A soft navigation fixes this.** `ig-softnav.mjs` loaded /nasa/, then JS-clicked a suggested-profile link
  (`page.click` timed out because the logged-out overlay intercepts pointer events). The SPA then fired
  `PolarisLoggedOutDesktopWWWProfileRootContentQuery doc_id=27981003384861049 vars={"username":"sciencechannel"}`
  and `...PostsTabContentQuery doc_id=27553725110923321 vars={"first":12,"username":"sciencechannel"}` as XHRs.
- Request body params: `av,__d,__user,__a,__req,__hs,dpr,__ccg,__rev,__s,__hsi,__dyn,__csr,__hsdp,__hblp,__sjsp,__comet_req,lsd,jazoest,__spin_r,__spin_b,__spin_t,__crn,fb_api_caller_class,fb_api_req_friendly_name,server_timestamps,variables,doc_id`.
  Headers: `x-asbd-id, x-csrftoken, x-fb-friendly-name, x-fb-lsd, x-ig-app-id, x-ig-max-touch-points`.

### news.ycombinator.com
- Only the document (text/html, 34,975 B) and `y18.svg`. No JSON API. Node `fetch` returns the same page
  (200, 227 ms, 30 `class="athing"` rows) with no cookies. An operation here needs an HTML extractor
  (CSS selectors), not a JSON path. The official `hacker-news.firebaseio.com` API is never called by the page.

### Google Flights (SFO→JFK 2026-11-12)
- Results come from two places. (a) The document (3.18 MB, 8 `AF_initDataCallback` blocks, "United" x71).
  Node fetch of the document also works (200, 1.57 s, 4.4 MB, "United" x179, no consent redirect from this
  US IP; EU consent wall **unverified**). (b) XHR
  `POST https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults?f.sid=<n>&bl=boq_travel-frontend-flights-ui_20260922.02_p0&hl=en-US&soc-app=162&soc-platform=1&soc-device=1&_reqid=<n>&rt=c`.
- Request format: form body with one key `f.req`, whose value is JSPB (a positional protobuf-as-JSON array) nested
  as a JSON string:
  `[null,"[[null,null,null,\"HKUJcc...\"],[null,null,1,null,[],1,[1,0,0,0],...,[[[[[\"SFO\",0]]],[[[\"JFK\",0]]],null,0,null,null,\"2026-11-12\",...,3],[[[[\"JFK\",0]]],[[[\"SFO\",0]]],null,0,null,null,\"2026-11-16\",...,1]],...]"]`.
  The query values appear literally, but inside three encoding layers: form-urlencoding, a JSON string, and a JSON array.
  The site added a default return leg (2026-11-16, JFK→SFO), so "JFK" appears twice in different roles.
- Response: `)]}'` XSSI prefix, then length-prefixed chunks (`51929\n[["wrb.fr",null,"<JSON string>"]]`),
  84.9 KB. The payload is JSPB again (positional arrays, no field names).
- Headers include `x-goog-batchexecute-bgr` (a BotGuard token, starting `[";u6W4pcHQ...`), `x-browser-validation`
  (added by Chrome itself), `x-goog-ext-259736195-jspb: ["en-US","US","USD",...]`, and `x-same-domain: 1`.

### reddit.com/search/?q=mcp
- Blocked. Title "Reddit - Prove your humanity" with a reCAPTCHA iframe. This happened headless, headed, and headed
  with `ignoreDefaultArgs:['--enable-automation']` + `--disable-blink-features=AutomationControlled`
  (`navigator.webdriver === false`). The likely cause is IP or fresh-profile reputation, not the automation flag. A warmed or logged-in profile
  was **not tried** (out of scope: no login).
- Plain Node fetch of the same URL returns 200 with an 8 KB JS-challenge page. `search.json` returns 403.
- `old.reddit.com/search?q=mcp` redirects with a 302 to `/login/?reason=lor2`.
- The format of search results is **unverified**. Evidence of format from the login flow: shreddit fetches HTML fragments with
  `content-type: text/vnd.reddit.partial+html` from `/svc/shreddit/partial/<id>/<name>?query=<urlencoded JSON>`,
  plus `POST /svc/shreddit/graphql` (JSON). Search results are probably partial-HTML too (**unverified**).

## 4. Replay tests (tier 1 = Node `fetch`, tier 2 = `page.evaluate(fetch)` on the site origin)

### x.com
- **Captured client GraphQL request:** none exists for the profile data (see §3), so it cannot be replayed verbatim.
- **Document GET** (`x-replay.mjs`): tier 1 → 200, 1013 ms, contains `user_result_by_screen_name` and 5 `full_text`.
  It also works **with no cookies**.
- **Synthesized GraphQL from the queryId mined out of the SSR stream** (`x-gql.mjs`, `x-ablate.mjs`):
  `GET https://api.x.com/graphql/6tXRska4Vx-MZLENLErFmg/UserByScreenName?variables={"screenName":"spacex","__relay_internal__pv__appviewerisloggedinprovider":false}`
  (no `features` param). `x.com/i/api/graphql/...` behaves the same.

  | Headers | Result |
  |---|---|
  | bearer + x-guest-token + cookies + browser UA | 200, 304 ms, 1475 B, SpaceX user |
  | bearer + x-guest-token, no cookie | 200, 92 ms |
  | bearer only + browser UA | 200, 88 ms |
  | no authorization | 400 `{"errors":[{"message":"Bad Authentication data","code":215}]}` |
  | bearer + guest token, **Node default UA** | **404, empty body** |
  | tier 2, same URL | 200 |
  | wrong queryId (`undefined`) | 404 `{"message":"Query not found"}` |

  The bearer (`AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D...`) is the public web-app
  constant. It came from the captured `viewer_context` request.
- `UserOriginalsTimeline` (queryId and variables mined the same way) returned **404 with an empty body** in every case we tried:
  tier 1 with full headers, tier 1 with a borrowed `x-client-transaction-id` from another request, via `x.com/i/api`, and
  **tier 2**. An empty 404 differs from the "Query not found" JSON 404. Inference (**unverified**): this op needs a valid
  per-request `x-client-transaction-id`, which the site's JS computes per method+path. A raw `fetch()` in the page
  does not add it, so tier 2 does not help. The only thing that got the timeline was the document (tier-1 GET) or tier 3.

### Instagram (`ig-replay.mjs`)
| Request | Tier 1 | Tier 2 |
|---|---|---|
| captured AYML POST, verbatim (headers + cookies + body) | 200, 387 ms, 31,401 B | 200, 187 ms |
| same body with `doc_id`=ProfileRoot, `variables={"username":"spacex"}` | 200, 72 ms, SpaceX `pk:20311520` | 200, 65 ms |
| PostsTab doc_id, `{"first":12,"username":"spacex"}` | 200, 238 ms, 14,428 B of timeline edges | not run |
| minimal body `doc_id,variables,lsd` + captured headers + cookies | 200, 142 ms | not run |
| minimal body, no cookie, no `x-*` headers | 200 **but HTML** (636 KB login page) | not run |

Instagram does not need tier 2 in this probe. That contradicts the design's example "Instagram always needs tier 2"
for logged-out reads. Logged-in behavior is **unverified**. Failure shows up as HTTP 200 with HTML, not as an error status.

### Google Flights (`gf-replay.mjs`, 3 runs)
- Verbatim tier 1: 200 in all 3 runs, about 85 KB, 5 airlines. A body with `JFK` replaced by `LAX` (replacement applied to the
  urlencoded form `%5C%22JFK%5C%22`): 200, about 136 KB, "Los Angeles International" present. Tier 2 behaves the same.
- **BotGuard enforcement is soft and depends on state.** Without `x-goog-batchexecute-bgr`, or with minimal headers:
  run 1, calls 4 and 5 → OK. Run 2, calls 4 and 5 → error. Run 3, call 1 → OK, calls 4 to 6 → error. Across all 3 runs, requests that
  carried the captured bgr token always succeeded, including with a modified body. So the token is not bound to the body, and it
  was reused within about 3 s. Its lifetime is **unverified**.
- The error is **HTTP 200** with
  `[["wrb.fr",null,null,null,null,[13,null,[["type.googleapis.com/travel.frontend.flights.ErrorResponse",...]]]]]`.
  A status-code-based drift detector would miss it.

## 5. What breaks "replace the example value with `{param}`"

1. **The data request is the document, not an XHR** (X, Instagram, Google Flights, HN). The example value is in the page URL,
   and the payload is embedded in HTML in a framework-specific form: X uses a seroval JS literal, Meta uses `ScheduledServerJS` JSON,
   Google uses `AF_initDataCallback` JSPB, and HN uses plain HTML. A "request carrying the value and returning JSON" matcher
   finds nothing on a hard load.
2. **Derived ids instead of the example value.** Instagram's hard-load XHR uses `{"id":"528817151"}`, not `nasa`.
   The learner would need a chain: resolve handle → id from one response, then use it in the next request. A plain
   substitution cannot express that.
3. **Nested encodings.** Google's value sits in form-urlencoding ⊃ JSON string ⊃ JSON array. X's value sits in URL-encoded
   JSON in the query string. Substitution must decode each layer, replace, and re-encode. A byte-level replace only
   worked because we replaced the exact encoded form.
4. **One example value in several roles.** "JFK" was both the destination and the return-leg origin. The fix is to require
   distinct example values per param and to reject ambiguous matches.
5. **Case and normalization.** The on-screen value is "NASA", while the request variable is "nasa" (the value as typed in the URL).
   Matching must be case-insensitive and should also check normalized forms (IATA codes, dates).
6. **Positional/protobuf payloads (JSPB).** There are no field names, so `response.extract` dot-paths turn into
   index paths like `[1][0][2]`. These are more brittle and not self-describing.
7. **Per-request signatures.** X's `x-client-transaction-id` appears to be required for some ops (timeline, unverified) and is
   computed by site JS. Neither tier 1 nor tier 2 can reproduce it. Only tier 3 (drive the UI) works.
8. **Anti-bot tokens with soft enforcement.** Google's `x-goog-batchexecute-bgr` is sometimes optional and sometimes required.
   A template learned without it passes at first and then fails later. Treat such headers as `{session:x}` refreshed by captures,
   not as droppable.
9. **Failure disguised as success.** Instagram returns 200 + HTML login page, and Google returns 200 + `ErrorResponse` code 13. Drift
   detection must validate content type and extract path, not status alone.
10. **Build-bound params** (`bl=boq_..._20260922.02_p0`, Instagram `__rev`, `__spin_r`, `__hs`, `__dyn`, `__csr`, `jazoest`, `lsd`).
    These rotate with deploys. Instagram accepted a minimal body without most of them. Google was not ablated on `bl`
    (**unverified** whether stale `bl` breaks).
11. **Gates before any traffic.** Reddit showed reCAPTCHA to a fresh profile. Nothing can be learned without a warmed or logged-in
    profile, and that happens before tier 3 even starts.

## Design implications (evidence-based)

- The trigger should support **soft navigation**: load a neutral page, then navigate client-side (click a link or
  `history.pushState` + route) to the target. On Instagram this turned a document-only load into clean XHRs carrying the
  example value. This is untested on X (logged-out X has no in-app link to other profiles to click).
- Mine **embedded query manifests** from the raw document: X's `key:"<queryId>{vars}",name:"<Op>"` and Meta's
  `expectedPreloaders[{queryID,variables,queryName}]`. They give (op, id, variables) without any XHR. X
  `UserByScreenName` and Instagram ProfileRoot/PostsTab were callable at tier 1 this way.
- Keep a **document operation kind** (GET HTML + extractor) as a first-class transport. It was the only tier-1 path for X
  tweets logged out, and the only path at all for HN.
- Fix the headless UA in the default context (`Chrome/<major>.0.0.0`). Read response bodies inside the handler.
  Use the raw document body, not `page.content()`.
- Drift detection: check status, content type, and extract-path presence. Treat 200 + HTML-when-JSON-expected and
  Google `ErrorResponse` as drift or auth failure.

## Probe script (`/tmp/site2api-probe/probe.mjs`, final version)

Run: `node probe.mjs <url> <exampleValue> [--headed] [--fixua] [--out file.json]`. Each line prints
`status | resourceType | method | content-type | bodyLen | BODYERR | SW | exampleIn{url,post,body} | gqlOp@queryId | url`.

```js
// usage: node probe.mjs <url> <exampleValue> [--headed] [--fixua] [--out file.json]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const [url, example] = process.argv.slice(2);
const headed = process.argv.includes('--headed');
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;

const t0 = Date.now();
const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
const tLaunch = Date.now() - t0;
// --fixua: strip "HeadlessChrome" from the UA (x.com 403s the default headless UA)
const ua = process.argv.includes('--fixua')
  ? `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split('.')[0]}.0.0.0 Safari/537.36` : undefined;
const ctx = await browser.newContext(ua ? { userAgent: ua } : {});
const page = await ctx.newPage();

const rows = [];
const pending = [];
page.on('response', (res) => pending.push((async () => {
  const req = res.request();
  const type = req.resourceType();
  if (!['fetch', 'xhr', 'document', 'other'].includes(type)) return;
  const row = {
    type, method: req.method(), url: req.url(), status: res.status(),
    ct: res.headers()['content-type'] || '',
    reqHeaders: await req.allHeaders().catch((e) => ({ _err: String(e) })),
    postData: req.postData(),
    sw: res.fromServiceWorker(),
  };
  try { row.body = (await res.body()).toString('utf8'); } catch (e) { row.bodyErr = String(e).slice(0, 200); }
  const hay = (s) => (s || '').toLowerCase().includes(example.toLowerCase());
  row.exampleIn = { url: hay(decodeURIComponent(row.url)), post: hay(row.postData), body: hay(row.body) };
  const m = row.url.match(/graphql\/([^/]+)\/([^?]+)/);
  if (m) row.gql = { queryId: m[1], op: m[2] };
  rows.push(row);
})()));

const t1 = Date.now();
let gotoErr = null;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e) => { gotoErr = String(e).split('\n')[0]; });
await page.waitForTimeout(8000); // fixed settle window; simpler than guessing when the SPA is done
await Promise.allSettled(pending);
const tLoad = Date.now() - t1;
const title = await page.title();
const cookies = await ctx.cookies();

console.log(JSON.stringify({ url, headed, tLaunchMs: tLaunch, tLoadMs: tLoad, gotoErr, ua: await page.evaluate(() => navigator.userAgent), title, cookieNames: cookies.map((c) => c.name) }));
for (const r of rows) {
  console.log([r.status, r.type, r.method, r.ct.split(';')[0], (r.body || '').length, r.bodyErr ? 'BODYERR' : '',
    r.sw ? 'SW' : '', JSON.stringify(r.exampleIn), r.gql ? r.gql.op + '@' + r.gql.queryId : '', r.url.slice(0, 160)].join(' | '));
}
if (out) writeFileSync(out, JSON.stringify({ url, rows, cookies }, null, 1));
await browser.close();
```

Caveats: `probe.mjs` matches the example by substring (case-insensitive), so short values give false positives.
The GraphQL regex only recognizes X-style `/graphql/<id>/<Op>` URLs. Meta's `/api/graphql` carries its op in the body
(`fb_api_req_friendly_name`, `doc_id`). Instagram soft-nav (`ig-softnav.mjs`) and X header ablation (`x-ablate.mjs`)
are separate scripts in the same directory. Results reflect one US IP on 2026-09-27. Queryids and doc_ids will rotate.
