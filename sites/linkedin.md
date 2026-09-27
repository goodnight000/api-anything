# linkedin

Verified live on 2026-09-27, signed in, by importing the session from the everyday Chrome:
`api-anything login linkedin` (one Keychain prompt), then `api-anything verify linkedin` passes.
Both ops are tier 1 (plain HTTP with the imported cookies), no browser. **Needs an account** — there
is no logged-out LinkedIn.

| op | args | returns | tier |
|---|---|---|---|
| `getMe` | — | your own `firstName`, `lastName`, `occupation` (headline), `publicIdentifier` | 1 (about 400 ms) |
| `getCompany` | `universalName` (example `microsoft`) | `name`, `universalName`, `tagline`, `description`, `staffCount`, `websiteUrl` | 1 (about 500 ms) |

```sh
api-anything login linkedin                      # imports li_at + JSESSIONID from Chrome
api-anything call linkedin getMe
api-anything call linkedin getCompany universalName=openai
```

## How it works

Both ops call LinkedIn's Voyager API directly. Auth is the imported `li_at` cookie plus a
`csrf-token` header that mirrors the `JSESSIONID` cookie with its surrounding quotes stripped
(`{ "ref": "cookie:JSESSIONID", "transform": "strip-quotes", "at": ["header:csrf-token"] }`), and
the constant `x-restli-protocol-version: 2.0.0`. The spec holds no credential — the cookie and the
csrf value come from the session at call time.

- **getMe** is `GET /voyager/api/me`; the mini profile is the first entry of `included`.
- **getCompany** is `GET /voyager/api/organization/companies?q=universalName&universalName=<name>`;
  the company is the entry of `included` that carries a `name` (the `pick` leaves the sibling logo
  entities as empty objects).

## Known limits

- **No `getProfile` by public id.** LinkedIn's current profile page is React Server Components
  (`flagship-web/rsc-action`, `application/octet-stream`), not a Voyager JSON call, so the capture
  loop can't learn it, and the older `GET /voyager/api/identity/dash/profiles?q=memberIdentity`
  returns only URN references unless a `decorationId` is supplied — and that id rotates per deploy
  and is no longer exposed to capture. Left out rather than bake a fragile id.
- **The imported session is your everyday Chrome's session.** If LinkedIn logs it out, your browser
  is logged out too. Keep automated traffic light; LinkedIn may revoke a session that looks like a
  bot. Use `api-anything login linkedin --window` for an independent session.
- Read-only. No posting, messaging, or connection requests.
- `getCompany` on an unknown universal name returns `input` (the example still answers), not a heal.
