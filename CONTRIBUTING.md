# Contributing

## Adding a site spec

Bundled specs live in `sites/<site>.json`, one file per site. A user's own copy in
`~/.site2api/sites/` always wins over the bundled one, and a heal writes a user copy. So a
bundled spec is a starting point that each user's machine keeps healing.

1. Learn the ops locally:
   ```sh
   site2api login <site>          # only if the data needs an account
   site2api capture <url> --example k=v
   site2api add <site> <op> --trigger <url-template> --example k=v --example2 k=v2
   site2api call <site> <op> k=v3
   ```
   Use two different example sets, so nonces are told apart from params. Set `--extract` and
   `--pick` so a call returns only what an agent needs.
2. Check it: `site2api verify <site>` must pass for every read op.
3. Export it: `site2api export <site> --keep-examples --out sites/<site>.json`. Export strips
   response shapes (and your example values, without `--keep-examples`), and refuses if any live
   cookie or session value from your machine is still in the spec. Don't use `--force` for a PR:
   a header that is a public constant (a web app's shared bearer) is learned with
   `add --public <header>` instead. Read the heuristic warnings it prints: a long hex or base64
   string must be a public constant (a queryId, a public app id), never a token.
4. Edit by hand:
   - set `displayName` and `description`;
   - add a `description` to each op and param;
   - add `loginCookies` (the cookie names that mean "signed in") if the site needs an account;
   - check that the kept `example` values are public and harmless (a well-known account, not
     yours), so `verify` works for others.
5. In the PR description, say what you verified, on what date, and whether you were logged in.

Rules for bundled specs:

- Read ops first. A write (`"readOnly": false`) must have been learned with `--write`, which
  learns from intercepted requests. It must never be exercised against someone else's account.
- No credentials, no personal data, no response samples.
- Don't hand-write a queryId or hash into `match`: match on method, host, a wildcarded path,
  and operationName only. Otherwise rotation can't be healed.

## Spec format

See `src/spec.ts` (zod schemas) and `docs/DESIGN.md`. An operation stores the captured request
verbatim, plus these fields:

- `slots` say where each param or credential reference goes. They are paths through decoded
  layers, for example `["query:variables", "json:/screen_name"]`.
- `volatile` lists rotating ids, each with its shape and an anchor, used for the cheap
  browserless heal.
- `trigger` and `match` say how to make the frontend fire the request again and how to recognize it.
- `response` holds `extract`, `pick`, and the `html` or `embedded` recipes.

## Code

```sh
npm install
npm run check   # typecheck
npm test        # unit + offline e2e (the Chrome parts skip when Chrome is missing)
```

Tests never touch real websites. `test/fixture/server.ts` imitates the patterns that matter:
rotating GraphQL ids, layered form encoding, login walls, rate limits, signatures, and HTML
lists. When you fix a site-specific failure, add the pattern to the fixture instead of
special-casing the site in `src/`.
