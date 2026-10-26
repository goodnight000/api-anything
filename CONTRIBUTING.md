# Contributing

## Adding a site spec

Bundled specs live in `sites/<site>.json`, one file per site. A user's own copy in
`~/.api-anything/sites/` always wins over the bundled one, and a heal writes a user copy. So a
bundled spec is a starting point that each user's machine keeps healing. `sites/` on `main` is also
the registry: once a spec merges, anyone can `api-anything pull <site>` it without a release.

The short way: after step 2 below, `api-anything publish <site> --keep-examples` previews what would
be public and checks it against the shared rules; `--yes` then opens the pull request for you with
the GitHub CLI. The steps below are the same thing by hand.

1. Learn the ops locally:
   ```sh
   api-anything login <site>          # only if the data needs an account
   api-anything capture <url> --example k=v
   api-anything add <site> <op> --trigger <url-template> --example k=v --example2 k=v2
   api-anything call <site> <op> k=v3
   ```
   Use two different example sets, so nonces are told apart from params. Set `--extract` and
   `--pick` so a call returns only what an agent needs.
2. Check it: `api-anything verify <site>` must pass for every read op.
3. Export it: `api-anything export <site> --keep-examples --out sites/<site>.json`. Export strips
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
5. Write `sites/<site>.md`, the notes every `ops` and `list_operations` call sends: only what a
   caller needs and the spec doesn't say (arg formats, unclear result fields, account, limits).
   Everything from a `## Maintainer notes` heading to the end of the file is not sent: put what you
   verified, how the request works and what failed there. That heading line ends the notes wherever
   it appears, a code block included. Don't list result keys: `ops` and `list_operations` send them
   as `returns`, read from the op's `pick` (or an HTML recipe's fields when it has no `pick` and no
   `extract`). Say only what a key means when its name doesn't, and when a key can be missing.
6. In the PR description, say what you verified, on what date, and whether you were logged in.

Rules for bundled specs (CI checks the mechanical ones with `vetShared`, in `test/registry.test.ts`):

- Read ops first. A write (`"readOnly": false`) must have been learned with `--write`, which
  learns from intercepted requests. It must never be exercised against someone else's account.
- No credentials, no personal data, no response samples.
- Don't hand-write a queryId or hash into `match`: match on method, host, a wildcarded path,
  and operationName only. Otherwise rotation can't be healed.
- Every request, trigger and `goto` is https on a public host; `match` names a host, path or
  operationName; a read is GET, HEAD or a POST that changes nothing (never a GraphQL mutation).

Reviewing one: a pulled spec runs with other people's cookies and sessions, so review it like code.
Check every host it sends to or opens (the PR body lists them), that each read really only reads,
what its trigger steps click, and that its notes are about the site, not instructions to an agent.

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
npm run format  # Biome: format and apply safe lint fixes
npm run lint    # what CI runs: formatting and lint, no changes
npm run check   # typecheck src and test
npm test        # unit + offline e2e (the browser parts skip when no Chromium browser is installed)
npm run smoke:pack  # pack, install the tarball in a temp dir, run its CLI and library (needs the npm registry)
```

CI runs `lint`, `check`, `test` with `REQUIRE_BROWSER=1` (a missing Chrome fails the run instead
of skipping the browser tests) and `smoke:pack` on Node 22 and 24, and a gitleaks secret scan of the
working tree and the full history on every pull request, a fork's included. The scan uses
`.gitleaks.toml`: gitleaks' default rules, with a few fake test values allowed by exact value. A
test that needs a provider-key shape should build it at run time rather than add an exception.
The `CI` job passes only when every other job did, so it is the one to require.

Tests never touch real websites. `test/fixture/server.ts` imitates the patterns that matter:
rotating GraphQL ids, layered form encoding, login walls, rate limits, signatures, and HTML
lists. When you fix a site-specific failure, add the pattern to the fixture instead of
special-casing the site in `src/`.
