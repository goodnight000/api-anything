# Instructions for coding agents

`docs/DESIGN.md` is the authoritative spec. Read it before changing behavior. `docs/research/`
holds the evidence behind it, including the api-anything bugs that must not come back.

## Layout

| file | job |
|---|---|
| `src/types.ts` | contract between the browser layer and the core; add optional fields only |
| `src/spec.ts` | zod schema of a site spec |
| `src/codec.ts` | read and write values through decoded request layers; untouched bytes stay identical |
| `src/learn.ts` | exchanges + example args -> Operation |
| `src/confirm.ts` | a write's recorded `confirm()` dialogs: the digest, and which ones a tier-3 run accepts |
| `src/secrets.ts` | what counts as a credential, the scan that finds one in a spec, and `redact` for messages |
| `src/outline.ts` | a compact summary of a captured response, for choosing a request and a recipe |
| `src/classify.ts` | response -> ok/drift/auth/rate/blocked/input/error; `judge` also extracts |
| `src/extract.ts` | parse, extract, pick, cap |
| `src/http.ts` | tier 1: fill the template, send with Node fetch |
| `src/browser.ts` | Chrome via playwright-core: trigger capture, tier 2 page fetch, login |
| `src/heal.ts` | add, rescan, recapture, tier-3 trigger runs, captures |
| `src/execute.ts` | `call()`: the tier ladder, classifier actions, heal guards, write rules |
| `src/session.ts`, `src/store.ts` | `~/.api-anything`: cookie jar, specs, heal log, state, write ledger, export |
| `src/checks.ts` | `verify`: run each read's example and checks, judge pass/fail/inconclusive, keep the record `publish` gates on |
| `src/vet.ts` | the shared rules a spec someone else wrote must pass: on pull, publish, load and in CI |
| `src/registry.ts`, `src/publish.ts` | pull a shared spec from the registry (`sites/` on GitHub); publish one as a pull request via `gh` |
| `src/login.ts`, `src/import.ts` | sign in by importing the everyday browser's cookies; re-import on `auth` |
| `src/cli.ts`, `src/mcp.ts`, `src/index.ts` | entry points |

## Rules

- Keep modules small. Don't add speculative abstractions. Comment only a non-obvious why.
- Never put a credential in a spec: refs (`cookie:x`, `session:x`) only. Any change to learning
  must keep the "no credential in the serialized spec" tests passing.
- Writes: never perform one to learn or heal it (intercept and abort). Send it once per call and
  retry only on 400/401/403/404. Require `allowWrites` at every entry point.
- No site-specific code in `src/`. Add the pattern to `test/fixture/server.ts` instead.
- Healing is reactive: always send the stored template first.
- A spec in `sites/` must pass `vetShared` (`test/registry.test.ts` checks every one): pulled specs
  run with other people's sessions.
- Tests use `node:test` and never touch the network beyond localhost.

## Commands

```sh
npm run check                                  # tsc over src and test, no emit
npm run lint                                   # Biome: format and lint, no changes
npm run format                                 # Biome: apply formatting and safe fixes
npm test                                       # all tests
node --import tsx --test test/<file>.test.ts   # one file
npm run cli -- <command>                       # run the CLI from source
```

Don't commit AI attribution trailers.
