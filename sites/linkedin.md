# linkedin

Verified live on 2026-09-27, signed in, from a clean `API_ANYTHING_HOME`:
`api-anything login linkedin --profile "Chrome/Profile 2"`, then `api-anything verify linkedin` passes
(all four ops at tier 1). All ops are plain HTTP with the imported cookies, no browser. **Needs an
account**: there is no logged-out LinkedIn.

| op | args | returns | tier |
|---|---|---|---|
| `getMe` | none | your own `firstName`, `lastName`, `occupation` (headline), `publicIdentifier` | 1 (about 300 ms) |
| `getProfile` | `publicId` (example `williamhgates`) | `firstName`, `lastName`, `headline`, `summary` (the About text), `publicIdentifier`, `countryCode`, `websites`, `influencer`, `creator`, `entityUrn` | 1 (about 250 ms) |
| `getCompany` | `universalName` (example `microsoft`) | `name`, `universalName`, `tagline` (when set), `description`, `industry`, `staffCount`, `website`, `headquarters` (`{country, geographicArea, city, ...}`), `url` | 1 (about 500 ms) |
| `searchPeople` | `keywords` (example `reid hoffman`) | the first 10 people results: `name`, `headline`, `location`, `url` (profile URL), `distance` (`DISTANCE_2`, `DISTANCE_3`, ...) | 1 (about 1 s) |

```sh
api-anything login linkedin --profile "Chrome/Profile 2"   # see "Several signed-in profiles" below
api-anything call linkedin getMe                           # check WHO you are signed in as
api-anything call linkedin getProfile publicId=satyanadella
api-anything call linkedin getCompany universalName=openai
api-anything call linkedin searchPeople "keywords=rust engineer zurich"
```

`getProfile` returned correct data for `williamhgates`, `satyanadella` and `reidhoffman`.
`searchPeople` returned the right people for `satya nadella`, `reid hoffman` and
`rust engineer, zurich` (the comma is escaped correctly).

## Several signed-in profiles

`login linkedin` without `--profile` imports from the browser profile whose cookie store changed most
recently. If two Chrome profiles are signed into two different LinkedIn members, that choice can
flip between runs, and you would silently act as the other member. Always pass
`--profile "<Browser>/<Profile>"`, then run `getMe` and check the name before anything else.

## How it works

Every op calls LinkedIn's Voyager REST API directly. Auth is the imported `li_at` cookie plus a
`csrf-token` header that mirrors the `JSESSIONID` cookie with its quotes stripped
(`{ "ref": "cookie:JSESSIONID", "transform": "strip-quotes", "at": ["header:csrf-token"] }`), and
the constant `x-restli-protocol-version: 2.0.0`. The spec holds no credential. No op carries a
`decorationId` or GraphQL `queryId`, so nothing in them rotates per deploy.

- **getMe** is `GET /voyager/api/me` (normalized JSON); the mini profile is `included[0]`.
- **getProfile** is `GET /voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=<publicId>`
  with `accept: application/json`. With the normalized accept header this endpoint returns only a URN
  reference. With plain JSON it returns the full default projection inline, as `elements[0]`.
- **getCompany** is `GET /voyager/api/organization/companies?q=universalName&universalName=<name>`
  with `accept: application/json`. The company is `elements[0]`; the normalized form mixed it with
  logo entities that came back as empty `{}` items. The website field is `companyPageUrl`, returned
  as `website`.
- **searchPeople** is `GET /voyager/api/search/dash/clusters?q=all&query=(keywords:<k>,flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)),includeFiltersInResponse:false)&start=0&count=10`
  with `accept: application/json`. The keywords are filled URL-escaped inside the Rest.li `query`
  (`escape: "url"`), so commas and parentheses stay inside the value.

## Known limits

- **searchPeople reads cluster 1.** The response is a list of clusters. For this (non-Premium)
  account, cluster 0 is always a Premium upsell card, cluster 1 holds the people and cluster 2 is a
  feedback card. The spec extracts `elements[1].items` and carries a hand-set `response.shape` for
  those items. If an account gets no upsell card, the people move to cluster 0. The shape check then
  classifies the call as `drift` rather than returning the feedback card as a result. Premium
  accounts were not tested. Normalized JSON was not an option: its `included` list loses the ranking
  and adds a feedback entity.
- **An unknown or restricted `publicId` is slow to fail.** LinkedIn answers
  `403 {"message":"This profile can't be accessed"}`. The classifier reads a 403 without login
  markers as a bot wall, so it climbs to the browser (about 40 s), finds nothing to heal and marks the
  op stale for 30 minutes (calls with good ids still work). Until that is fixed in the classifier, pass `--max-tier 1` when the id might
  be wrong, or find the id with `searchPeople` first. `getCompany` on an unknown name returns `input`.
- **No location name or follower count in `getProfile`.** The default projection has only
  `location.countryCode` and a `geoLocation.geoUrn`. It has no experience list (only a card URN).
- **No `searchJobs`.** `/voyager/api/voyagerJobsDashJobCards` answers 500 without a `decorationId`,
  and a baked `decorationId` would break on the next deploy.
- **Healing doesn't apply.** LinkedIn's profile and search pages are now React Server Components.
  The ops' trigger pages don't call these Voyager endpoints, so a heal finds no matching request. A
  real change surfaces as `drift` with a hint to re-add.
- **The imported session is your everyday Chrome's session.** If LinkedIn logs it out, your browser
  is logged out too. Keep automated traffic light; LinkedIn may revoke a session that looks like a
  bot. Use `api-anything login linkedin --window` for an independent session.
- Read-only. No posting, messaging, or connection requests.
- `universalName=anthropic` is an unrelated investment fund; the AI company's slug differs.
