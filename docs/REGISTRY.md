# The shared registry — design

Agents share one catalog of website operations, and the same agents fill it, verify it and repair
it as a side effect of using it. The registry is a small service (`registry/`, a Cloudflare Worker
with D1) that stores operations and counts reports. Every expensive step — learning, verifying,
repairing — runs on users' machines, which already have the browser, the sessions and home
connections that sites do not block. The wire contract is `src/registry-api.ts`.

## The rule

Nobody does anything only to share or verify. Uploading, verifying and repairing happen as part of
using the tool; a person is asked only to share an operation that needed a login or that writes.

## Setup

`npx api-anything setup` finds the user's agents (Claude Code, Codex, Cursor, Claude Desktop),
connects the MCP server to each (and the skill where the agent takes skills), checks for a Chromium
browser (needed only to learn sites), makes the install's key (`identity.ts`: an Ed25519 pair in
`~/.api-anything/key.json`, 0600) and asks one question:

> Help build the shared catalog? Your agent will share operations it learns from public pages (never
> your cookies or logins), report under this install's anonymous key whether calls work, and test a few
> new operations a day from your network. Site searches go to the catalog either way.

The answer is `settings.json` `share: true|false` (default yes). No account. An install that never ran
setup (the plugin, `claude mcp add`, `npm -g`) shares nothing until the question is answered: `learn_site`
asks it once, the first time it has something to share (MCP elicitation, or the CLI's prompt), and when
the client cannot ask, its `next` has the agent ask the user and run `api-anything setup --yes
--share-only` or `--no-share --share-only`, which records the answer alone. What it does not change:
`find_sites` sends its words, domain or URL to `GET /v1/search` whether sharing is on or off (the
local specs are searched too, and answer alone when the registry cannot be reached), and so does a
call of a site this machine lacks, which fetches it. The registry sees the request's IP address, as any
web server does, and does not store it. Of a domain or URL search that finds nothing, it keeps the
registrable domain and the hashed network that asked (demand, below), never the words of a search.

## Using an operation that exists

1. The agent calls MCP `find_sites` (words, a domain or a URL). The registry's `GET /v1/search`
   answers with each match's operations, their params and status, so the agent can call one next. Every
   match, local or the registry's, shows its `domain`, and the tool's description, its `next` and the
   skill tell the agent to check that domain is the site the user means: a site's name and description
   are the uploader's words, and can imitate another site.
   Anyone can upload a site that calls itself Amazon, so search trusts only what other installs
   confirmed:
   - a site with a live op always ranks above a site with only candidates, whatever the score;
   - words never find a site with no live op. A domain or URL query finds it when it names the site's
     own domain;
   - `GET /v1/index`, the home page list and the sitemap leave such a site out. Its page
     (`/sites/:name`) still renders, marked `noindex`.
2. `call_operation` on a site that is not installed fetches it (`GET /v1/sites/:name`) first. Of a
   site fetched this way only the reads run until a human runs `api-anything pull` (the `by: "agent"`
   mark, as before). An op of a fetched or pulled site that is still a `candidate` is called with none of
   the user's cookies or session values, at plain HTTP and in the browser's page fetch: by the review
   rules a candidate is a public read and needs none, and a GET with the user's cookies can still act on
   their account. The call runs on the user's machine: plain HTTP first, the browser if it must.
3. After the call, a report (`POST /v1/reports`): version hash, outcome, tier, ms. No args, no data.
   Reports are batched, sent in the background, and dropped when the registry cannot be reached. Each
   is signed by the install's key and stored with it and the time it arrived: the key is anonymous, but
   it ties together every report and upload this install makes.

## Learning an operation that does not exist

1. `find_sites` finds nothing, or the site lacks the op. Its `nextCall` is `learn_site`.
2. `learn_site {page URL template, args, args2, args3, intent}` (MCP; CLI `learn`) runs the page with the
   user's own args, picks the request and the fields from the outline (the agent can override), runs
   it again with a second example, and returns the data of the user's own request with the op saved.
3. The client proves it before sharing (`learnsite.ts`):
   - the two-run diff and run 2's data (add's existing rules);
   - a holdout call, with args used as neither example, answers with data;
   - a clean replay: the op called with no cookies and no session values. Ok means it is public; so does
     a bot wall answering (Anubis, Cloudflare): the data is public behind it, and each caller's browser
     tier passes it.
   Before the holdout call sends anything, `learn_site` refuses a request that is no read: a method other
   than GET or HEAD unless it is a GraphQL query sent as POST, a GraphQL mutation, a GraphQL POST that
   carries no query document (a persisted query, named by a hash or an id), or a param that is the whole
   body or the document. Over MCP the trigger must be an https page on a public host.
4. `shareOps` uploads it (`POST /v1/versions`, signed). A public read goes automatically when
   `share` is on (unanswered, the question is asked first: Setup). A login op is claimed by its
   fingerprint ("Ops learned signed in"). A login op or a write is uploaded with its body only with
   the user's yes (CLI prompt, or MCP
   elicitation where the client supports it); the prompt lists what in the upload may be the user's own
   (an email, an id, a literal typed into the page). The published examples are the agent's chosen second
   example and holdout, never the user's own request. An automatic upload carries no checks but
   learn_site's holdout and none of the user's own `<site>.md` notes: a check recorded with
   `api-anything check`, or notes the user wrote, go only with their yes (`publish --yes`). A pulled
   site's notes came from the registry and go back with its heal.
5. A new site's name is its registrable domain with dots as dashes (`crates-io` for crates.io,
   `lobste-rs` for lobste.rs); a site the registry already holds keeps its name (a seed's: goodreads.com
   is `goodreads`), and a new op uploaded under another name on that domain goes to review. So
   `learn_site` names a new site after a site this machine has on that host, else the name the registry
   serves the domain under (`sharedName`: `GET /v1/search?q=<domain>`, a match whose `domain` is it;
   not asked for a trigger on this machine or the network), else the slug. `shareOps` uploads a site
   under its own name when it is pulled or bundled or the registry serves its domain under that name,
   and otherwise under the slug, which the outcome's `as` names (`publish.ts` `registryName`,
   `uploadName`).

## Demand

What agents looked for and nobody shared is the list of what to learn next. A `GET /v1/search` for a
domain or a URL that matches no site records that query's registrable domain with the hashed network
that asked; words are never recorded, since they are a person's and the list is public. `GET /v1/demand`
(cached 60 s) and the home page list the domains asked for in the last 30 days that no site covers yet,
by how many distinct networks asked, so one network asking a thousand times counts once. A domain
leaves the list once a site for it is shared; the daily job deletes records older than 90 days.

## Sites' own interfaces

Some sites ship their own agent interface: an MCP server or an OpenAPI document. `api-anything interface
mcp|openapi <url>` reports one (`POST /v1/interfaces`, signed): https on a public host, keyed by its
registrable domain. Once installs on as many distinct networks as promote a version (`PROMOTE_KEYS`,
`PROMOTE_NETWORKS`) reported it, `GET /v1/sites/:name` and search list it as `interfaces` beside that
domain's operations. A domain search finds a domain that has only an interface, as a match with no
operations, and records no demand for it. A site already installed keeps its own operations in the
answer and gains its domain's interfaces. At most ten are served per domain, the best confirmed first;
the client drops any more, or any malformed one, never the match. The agent tells the user; nothing in
the client calls an interface.

## Ops learned signed in

A login op's body can encode the person who learned it: an account id in a path, an intranet host, a
literal they typed. Asking every user before each such upload means almost none go up. So when sharing
is on, an op learned signed in that no rule refuses, that stays on its own site, and that shows nothing
personal in its `anonymous` form (no description, param descriptions, hints, examples or checks) is
**claimed** instead (`POST /v1/claims`, signed): the site's name and domain, the op's fingerprint
(sha256 of `fingerprintText`: the site, then the anonymous op without its name) and a hash of its name.
Nothing else leaves the machine.

Once installs on `CLAIM_KEYS` (3) distinct networks claimed the same fingerprint, the registry answers
each of them, on their next claim or `GET /v1/claims`, with the fingerprints it wants. An idle MCP server
asks at most every 6 hours. A holder then uploads the anonymous op with `claim` set; the site goes up by
its name, domain and address alone. The registry accepts it only from an install that claimed that
fingerprint, only in anonymous form, only if it hashes to the fingerprint, and keeps the op's name only
if as many installs gave it that name. Each wanted fingerprint says so (`named`), and when it is false
the client sends the op as `op_<fingerprint>`: a name only its learner chose never leaves the machine,
not even for the registry to replace. A claim is answered under the name the site went up under. The client sends a body only for a
fingerprint it claimed itself and its op still hashes to: that k installs agree is the registry's claim,
and a registry that asks for anything else gets nothing.

Identical bytes from strangers on different networks cannot hold one person's own value, since a
personal literal differs per person and its fingerprint never converges. This settles privacy, not
safety. The version still goes to `review` ("learned while signed in"), with the number of installs that
hold it among its reasons, because a login op runs with every caller's credentials. The user can still
say yes and share it at once, as before.

## Verification by the crowd

A new version is a **candidate**. It is served to others while no live version of that op exists,
marked as such. It becomes **live** once installs other than its uploader report it ok:

| rule | value (env var on the worker) |
|---|---|
| distinct installs reporting ok, uploader excluded | `PROMOTE_KEYS` = 2 |
| of which distinct networks (ASN, else /24 or IPv6 /32, stored hashed) | `PROMOTE_NETWORKS` = 2 |
| a heal (below) | `PROMOTE_HEAL_KEYS` = 1 installs, still `PROMOTE_NETWORKS` networks |
| `wrong` reports | each outweighs two oks |

A version that claims `evidence.healedFrom` is a heal only when the version it names is of the same op
and either `degraded`, or live with a `fail` report from the uploader's own key in the last 7 days.
Otherwise anyone could name a live hash and take its op over with one friend. A heal never needs fewer
networks than a new op, so with the defaults it needs as many installs as one too. It needs fewer only
where `PROMOTE_KEYS` is set above `PROMOTE_NETWORKS`.

Promotion does not decide what is served. Of the live versions of an op, the **incumbent** (the one live
the longest) is served while it is not degraded, whatever the success rates and confirmations. A newer
live version, a heal included, is served only once the incumbent degrades. A few keys on two networks
can promote a version, but they cannot replace one callers already rely on.

Background verification makes the long tail move: an MCP server idle for a minute asks
`GET /v1/verify-jobs` for candidates and calls each with its published examples, plain HTTP only, no
cookies, at most 20 a day, and reports the outcome. The calls go from the user's machine and IP address,
only over https to a host under a public suffix that resolves to no private, loopback, link-local, CGNAT
or unique-local address, every redirect hop included. A job is a candidate that:

- this key neither uploaded nor reported;
- is served: no live version of its op name shadows it;
- runs at `minTier` 1, over plain HTTP;
- has published examples for every required param;
- belongs to a site that already has a live op, or has ok reports from installs on 2 distinct networks
  other than the uploader's. Those installs found it by themselves, through a domain search or a
  re-learn with the same hash. A stranger's fresh site never sends every verifying install to a host it
  watches, which would harvest their IP addresses. With the default thresholds such a candidate is
  usually promoted by those same reports, so in practice a new site's ops are checked by the installs
  that find it, not by background jobs.

Only public reads are promoted by reports. A version is `review`, served to its uploader only until a
maintainer sets its status (`POST /v1/admin/versions/:hash`), when it:

- was learned while signed in, or its clean replay was neither ok nor a bot wall;
- writes, or is a read sent with a method other than GET or HEAD. The one exception is a POST that
  carries only GraphQL query documents. A persisted query names no document and could be a mutation;
- has a slot with a `cookie:` or `session:` ref: every caller's client would send its own credentials;
- is a new op name on a site that lists `loginCookies` or has an op learned while signed in;
- is a new op name on an established site: some site on its domain has a live or seeded op. Callers
  trust an established site, so a maintainer approves what it newly does (an x.com `follow`). The check
  is by domain, so a second name for the same domain gets around nothing. A new version of an op the
  site already has is no new op;
- on such a site, has a match (method, host, path, GraphQL operationName) other than the op's
  incumbent's: of its live and degraded versions, the one live the longest. A real heal keeps its match,
  since the match is built only from the request's stable identity. A version that turns linkedin
  `search` into a GET of `/psettings/close-account` is never served without a maintainer. Degrading
  the incumbent first changes nothing, since a degraded version still counts;
- sends to or opens a host off its site, or lists `public` names;
- holds something the export secret scan flags.

## Maintenance by the crowd

- Every call is a health check. A live version is **degraded** when, among the last 10 reports from
  distinct installs (`DEGRADE_WINDOW`), more than half are `fail` or `wrong`, at least 3 installs
  failed (`DEGRADE_MIN_FAILED`), those failures come from at least 3 distinct networks
  (`DEGRADE_MIN_NETWORKS`), and the failing networks outnumber the networks whose latest report on it in
  the last 7 days is ok. Fresh keys on one network are cheap, and a handful of VPSes cannot degrade an op
  with real traffic. Then the next best version is served. `auth`, `rate`, `blocked` and `input` say
  nothing about the op.
- The client already heals an op that drifted. A healed public op uploads automatically as a new
  version with `parent` and `evidence.healedFrom`. Its own failed call of the old version makes it a
  heal (above), so the client sends that `fail` report before the upload.
- Identical repairs from many installs hash the same: each upload of an existing version counts as
  its uploader's confirmation.
- A repair reaches everyone once it is live. A drifted call of a registry version first asks the
  registry (`GET /v1/sites/:name`, by the name the registry holds the site under, at most 3 s) for the
  version it serves for that op now. A different version that is live, keeps the op's match and passes
  the shared rules is tried before any heal of the client's own, at the tier it asks for if the caller
  allows it: one request in place of a browser run. Only if it answers does it replace the op where
  this machine reads it (the rest of the spec untouched). The old version is reported `fail`, the new one `ok`, and
  nothing is uploaded, since the version is the registry's already.
- Versions of one op are grouped by its site and op name; each version also stores its match (method,
  host, path, GraphQL operationName). The match alone would merge distinct ops that share an endpoint
  (goodreads `getBook` and `getWorkId` both match `/book/show/*`). The best is served: live over
  candidate over degraded; of two live versions the incumbent; otherwise by success rate, then by
  confirmations.
- Each version keeps its report counts beside it (installs confirming it, oks, failures, installs that
  reported it), so a search, a site or the index reads versions only, never reports. A report recounts
  its version and moves its status, except that a version `STATS_LIVE_UP_TO` (100) or more installs
  reported is recounted at most every `STATS_SECONDS` (60): a count reads all of its reports, and each
  report would otherwise cost as many reads as the version has installs. A report in between marks the
  version pending, and a job every minute recounts and re-judges what is pending, so degrading or
  promoting such a version waits a minute or two, never on another report coming. The daily job
  recounts every version, as reports age out of the last 30 days.
- A daily job archives a candidate or degraded version with no ok report in 30 days, and a degraded
  version older than a live version of the same op, which replaced it. It never archives a live
  version: a newer live one may be a takeover. A live version leaves live only by degrading. The job
  deletes versions archived over 30 days ago, with their reports.

## Trust

- A site's name is bound to its domain by its first upload; another domain under that name is refused.
- A new site's name must be exactly its registrable domain (`siteOf`) with dots turned into dashes:
  `crates-io` for crates.io, `lobste-rs` for lobste.rs, `git-xyz` for git.xyz. Otherwise the upload is
  refused with 422 and the reason. A name is unique by construction and cannot take another site's
  brand. A maintainer's seed is exempt (`goodreads`, `dominos-au`).
- An uploaded `displayName` is ignored: a site nobody seeded is titled by its domain.
- The server runs `vetShared` and the export secret scan on every upload, and refuses a spec over 256 KB.
  It checks the declared length first, then reads the body as a stream that stops at the cap. A request
  missing a signature header or with a stale timestamp is refused before any of its body is read.
- A signature covers the method, the path with its query exactly as sent, the timestamp and the body's
  hash. A signature over the bare path does not cover a query.
- The `review` reasons above are never promoted by reports.
- Keys are cheap, so a key counts once per version and promotion needs distinct networks. Uploads and
  reports are rate-limited each hour per key and per network (an IPv4 /24 or an IPv6 /32: one
  subscriber holds a /48 or more). A key first seen less than an hour ago uploads at most 5 versions
  (`NEW_KEY_UPLOADS`). A circuit breaker caps uploads at 300 an hour across all keys
  (`UPLOADS_PER_HOUR_ALL`). Every limit answers 429 with Retry-After.
- Public reads (`/v1/search`, `/v1/sites/:name`, `/v1/index`, `/`, `/sites/:name`, `/sitemap.xml`) are
  cached for 60 s at the edge, keyed by URL. A signed read skips the cache, since it may include the
  signer's own `review` versions.
- A maintainer can block a version or a site.

What these rules leave open:

- A lookalike domain is its own site. Whoever registers github-xyz.com can share `github-xyz-com`, and
  ok reports from installs on 2 networks promote it. Its title is only its domain, but its description
  is the uploader's own. Once it is live, that description ranks for words like any other site's
  ("amazon prices" finds amazon-deals.net next to amazon). No registry rule tells a lookalike from a
  real site. The defence is the agent's: every match carries `domain`, and the agent checks it against
  the site the user meant before calling.
- An op with no ok report from any network in the last 7 days (a seed nobody calls) can be degraded by
  failures from 3 networks. A version with the same match, promoted by 2 networks, is then served. A
  version with a different match still goes to review.
- The edge cache holds a public read for up to 60 s, so a maintainer's block takes up to a minute to
  disappear from search, site and index answers.
- An uploaded site `description` and op descriptions are the uploader's words, shown on its page and
  read by agents as data, never as instructions.

## What the registry stores

D1 tables: `sites` (name, domain, display fields, notes, first uploader), `versions` (hash, site,
op name, match signature, operation JSON, parent, status, uploader and its network hash, evidence,
timestamps including when it first went live, its report counts), `reports`
(hash, key, network hash, outcome, tier, at), `keys` (public key, first seen, counts), `rates` (hourly
counters, kept for a day), `claims` (fingerprint, site, key, network hash, name hash, at), `demand`
(registrable domain, network hash, at; deleted after 90 days), `interfaces` and `interface_reports`
(url, domain, kind; key, network hash, at). No args, no response data, no IP addresses.

About the caller, the registry keeps its reports, keyed by install key and time, and nothing else:
no account, no IP address (a network is a salted hash, used to count distinct networks and for rate
limits), no search words. Workers observability logs are off (`registry/wrangler.jsonc`), so request
URLs, and the queries in them, are not stored.
