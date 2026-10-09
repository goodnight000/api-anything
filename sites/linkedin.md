Needs an account: there is no logged-out LinkedIn. Read-only: no posting, messaging, or connection
requests.

- The imported session is your everyday Chrome's session. If LinkedIn logs it out, your browser is
  logged out too. Keep automated traffic light; LinkedIn may revoke a session that looks like a bot.
  Use `api-anything login linkedin --window` for an independent session.
- If more than one browser profile is signed in to LinkedIn, `login linkedin` without `--profile`
  refuses and lists the candidates (profile, display name, the Chrome profile's Google email, which
  is not the LinkedIn account's). Those can be two different LinkedIn members: ask the user which
  one, pass `--profile "<Browser>/<Profile>"`, then run `getMe` and check the name before anything
  else.
- Search first when you only know a name: a company's universal name often differs from its brand
  (`anthropic` is an unrelated investment fund; the AI company is `anthropicresearch`; Boston
  Dynamics is `boston-dynamics`).
- In `keywords`, apostrophes and non-ASCII letters work. A search with no matches returns `ok` with
  `[]`.
- An unknown or restricted `publicId` is `input`, and so is an unknown name in `getCompany`.
- `getProfile` has no location name (only `countryCode`), follower count or experience list. Its
  `summary` is the About text; `getMe`'s `occupation` is the headline.
- `getCompany` returns `name`, `universalName`, `tagline` (when set), `description`, `industry`,
  `staffCount`, `website`, `headquarters` (`{country, geographicArea, city, ...}`) and `url`.
- `searchPeople`'s `distance` is `DISTANCE_2`, `DISTANCE_3`, ...

## Maintainer notes

Verified live on 2026-09-27, signed in, from a clean `API_ANYTHING_HOME`:
`api-anything login linkedin --profile "Chrome/Profile 1"`, then `api-anything verify linkedin` passes
(all five ops at tier 1). All ops are plain HTTP with the imported cookies, no browser.

| op | args | returns | tier |
|---|---|---|---|
| `getMe` | none | your own `firstName`, `lastName`, `occupation` (headline), `publicIdentifier` | 1 (about 300 ms) |
| `getProfile` | `publicId` (example `williamhgates`) | `firstName`, `lastName`, `headline`, `summary` (the About text), `publicIdentifier`, `countryCode`, `websites`, `influencer`, `creator`, `entityUrn` | 1 (about 250 ms) |
| `getCompany` | `universalName` (example `microsoft`) | `name`, `universalName`, `tagline` (when set), `description`, `industry`, `staffCount`, `website`, `headquarters` (`{country, geographicArea, city, ...}`), `url` | 1 (about 500 ms) |
| `searchPeople` | `keywords` (example `reid hoffman`) | the first 10 people results: `name`, `headline`, `location`, `url` (`https://www.linkedin.com/in/<publicId>?miniProfileUrn=...`), `publicId`, `distance` (`DISTANCE_2`, `DISTANCE_3`, ...) | 1 (about 1 s) |
| `searchCompanies` | `keywords` (example `anthropic`) | the first 10 company results: `name`, `subtitle` (industry, plus location when set), `followers`, `description`, `url` (`https://www.linkedin.com/company/<universalName>/`), `universalName` | 1 (about 0.6 s) |

```sh
api-anything login linkedin --profile "Chrome/Profile 1"   # several signed-in profiles: see the top of this file
api-anything call linkedin getMe                           # check WHO you are signed in as
api-anything call linkedin getProfile publicId=satyanadella
api-anything call linkedin getCompany universalName=openai
api-anything call linkedin searchPeople "keywords=rust engineer zurich"
api-anything call linkedin searchCompanies "keywords=boston dynamics"
```

### Chaining search into get

LinkedIn's search API returns only the profile or company URL, so the ops cut the id out of it
(`pick` with `publicId=navigationUrl~/in/([^/?]+)`):

- `searchPeople` `publicId` `satyanadella` -> `getProfile publicId=satyanadella`.
- `searchCompanies` `universalName` `anthropicresearch` -> `getCompany universalName=anthropicresearch`.

Verified 2026-09-27 with the chain: `searchPeople` for `satya nadella`, `patrick collison`,
`rust engineer zurich` and `conan o'brien`, then `getProfile` for `satyanadella`,
`patrickcollison` and `conanobrien`; `searchCompanies` for `anthropic`, `stripe`, `openai` and
`boston dynamics`, then `getCompany` for `anthropicresearch`, `openai` and `boston-dynamics`. Every
call was tier 1.

### How it works

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
  with `accept: application/json`. **searchCompanies** is the same with `List(COMPANIES)`.
- The response is a list of clusters: for this account a Premium upsell (people) or a result-count
  line (companies), the results, then a feedback card. Both ops extract
  `elements[*].items[*].itemUnion.entityResult`, which collects the results from whichever cluster
  holds them and skips the cards. If no cluster holds an `entityResult` any more, the extract path
  is missing and the call is `drift`, not an empty answer.
- LinkedIn parses the Rest.li `query` before it percent-decodes the value, once. The keywords are
  filled as a plain query value, so a space goes out as `%20`. The previous `escape: "url"` sent
  `%2520`: people search still matched loosely, but company search found nothing for any multi-word
  name (`boston dynamics` gave 0 results).

### Known limits

- **No commas, colons or parentheses in `keywords`.** They are Rest.li syntax, and the value can't
  be encoded so LinkedIn reads them as text (see above). The param's `pattern` refuses them; use
  spaces (`rust engineer zurich`).
- Premium accounts were not tested; the cluster-independent extract should cover them.
- A search with no matches answers `{"elements":[]}`.
- **An unknown or restricted `publicId` is `input`.** LinkedIn answers
  `403 {"message":"This profile can't be accessed"}`. A read's bare 403 replays the example args
  once; they answer, so the call returns `input` at tier 1 with no browser run and no stale mark
  (not verified live against LinkedIn).
- `getProfile`'s default projection has only `location.countryCode` and a `geoLocation.geoUrn` for
  the location, and only a card URN for the experience list.
- **No `searchJobs`.** `/voyager/api/voyagerJobsDashJobCards` answers 500 without a `decorationId`,
  and a baked `decorationId` would break on the next deploy.
- **Healing doesn't apply.** LinkedIn's profile and search pages are now React Server Components.
  The ops' trigger pages don't call these Voyager endpoints, so a heal finds no matching request. A
  real change surfaces as `drift` with a hint to re-add.
