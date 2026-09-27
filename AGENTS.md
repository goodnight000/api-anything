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
| `src/classify.ts` | response -> ok/drift/auth/rate/blocked/input/error; `judge` also extracts |
| `src/extract.ts` | parse, extract, pick, cap |
| `src/http.ts` | tier 1: fill the template, send with Node fetch |
| `src/browser.ts` | Chrome via playwright-core: trigger capture, tier 2 page fetch, login |
| `src/heal.ts` | add, rescan, recapture, tier-3 trigger runs, captures |
| `src/execute.ts` | `call()`: the tier ladder, classifier actions, heal guards, write rules |
| `src/session.ts`, `src/store.ts` | `~/.api-anything`: cookie jar, specs, heal log, state, export scan |
| `src/cli.ts`, `src/mcp.ts`, `src/index.ts` | entry points |

## Rules

- Keep modules small. Don't add speculative abstractions. Comment only a non-obvious why.
- Never put a credential in a spec: refs (`cookie:x`, `session:x`) only. Any change to learning
  must keep the "no credential in the serialized spec" tests passing.
- Writes: never perform one to learn or heal it (intercept and abort). Send it once per call and
  retry only on 400/401/403/404. Require `allowWrites` at every entry point.
- No site-specific code in `src/`. Add the pattern to `test/fixture/server.ts` instead.
- Healing is reactive: always send the stored template first.
- Tests use `node:test` and never touch the network beyond localhost.

## Commands

```sh
npm run check                                  # tsc, no emit
npm test                                       # all tests
node --import tsx --test test/<file>.test.ts   # one file
npm run cli -- <command>                       # run the CLI from source
```

Don't commit AI attribution trailers.
