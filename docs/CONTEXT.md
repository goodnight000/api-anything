# Context layer

`find_context` (MCP) and `api-anything context` (CLI) turn a task-shaped question into the small set
of local operations that could answer it. They are the first step for a model that would otherwise
call `list_sites`, then `find_sites`, then `list_operations`, and carry all of those results in its
context before it can call anything. This document describes the context layer, how it adapts ideas
from graph-first context systems, and what was measured on this machine.

## What is in the graph

`src/graph.ts` builds a deterministic, dependency-free graph from installed specs only. It makes no
network request, calls no model, and contains no site or domain by name. Ranking comes from the spec
files the user actually has installed; a site added, pulled or healed changes the graph on the next
fingerprint check.

| Kind | Node | Edges |
| --- | --- | --- |
| `site` | a spec's name, title and short description | `has_op`, `at_domain`, `alias_of`, `mentions` |
| `domain` | a registrable domain a spec's ops call or open | reached from a site or an exact domain query |
| `op` | an operation's name and short description | `takes`, `returns`, `links_to`, `mentions` |
| `param` | an op's arg, with type and required flag | reached from its op |
| `field` | a returned field named by a recipe or learned shape | reached from ops that return it |
| `topic` | a word shared by a few sites, not by almost all | `mentions` from sites and ops |

Generic fields (`id`, `url`, `name`, `status`, `date`, …) and structural words (`list`, `get`,
`result`, `json`, …) are not made into hubs. A topic is kept only when two to roughly six percent of
sites mention it, so common words do not connect the whole catalog.

Every edge has a `confidence` that says **where the edge came from**, not how trustworthy the site
is:

- `declared`: the spec states it (a site owns an op, an op takes an arg, a recipe names a field).
- `observed`: a learned response shape showed the field.
- `lexical`: a word in a name or description made the connection.
- `inferred`: traversal through other nodes; no graph edge is labelled this way, but a match reached
  only by traversal is reported as `inferred` so the model knows to check it.

A match's own label is `exact` (the query is its domain or its whole name), `lexical` (its own text
matched), or `inferred` (only shared nodes led to it). These labels are prompts to verify, not
endorsements of a stranger's spec. The site text itself remains data; a name or description can
imitate another site, so `next` tells the model to check the domain.

## How a question becomes an answer

1. **Seed.** Query words are lower-cased, stopwords and short words dropped, plural `s` removed,
   and camelCase op names split. A domain or URL becomes an exact domain seed. Whole matches score
   higher than substrings; action words such as `list` and `find` are downweighted. Two capability
   words in a site's own description can expose its operations even when the op names are generic.
2. **Traverse.** Two weighted hops pass score along edges in both directions (backward at 0.7),
   splitting a hub's share by its degree. This lets a question about a returned field or an arg reach
   the op that carries it. A query-coverage bonus favours a site whose own ops cover more of the
   question.
3. **Rank and render.** Sites and their ops are sorted by score. Other sites reached by the same
   capability words appear in `also`, with a `via <node> (<kind>, <confidence>)` reason. The rendered
   text is one line per site, one per op with its required args and returned fields, then up to three
   `also` lines. A character budget removes tail ops, then tail sites, then `also`; `truncated` says
   it happened. Defaults are 1600 characters, four sites and three ops per site; MCP and CLI accept
   200–4000 characters.

`src/context.ts` caches the graph at `~/.api-anything/graph.json` (version 1). The key is a hash of
every spec file's path, size and modification time across the user, registry and bundled spec
directories; a stat per file is cheap enough for a one-second memo, and a changed or corrupt cache
is rebuilt, never trusted. A read-only home still works with an in-memory graph.

## Relation to Graphify

The graph borrows **concepts only**: typed nodes and edges, hierarchy by kind, retrieval by traversal
rather than a catalog dump, and a budgeted slice for a small model. Nothing is installed, imported
or copied from Graphify; there is no embedding service, LLM extraction step, server or new dependency.
The build is ordinary TypeScript over data already on disk, so it stays deterministic, offline and
testable.

For weak models, the important adaptation is not the graph itself but the answer shape: one call,
plain ranked lines, explicit arg names, a confidence label and a `next` string that already names the
tool to run. The model does not have to compare several site lists or infer which of 388 operations
is relevant.

## Use in one call

MCP:

```text
find_context {"query":"book ratings","budget":1200}
```

CLI:

```sh
api-anything context "book ratings" --budget 1200
```

The answer carries `text`, `sites` (with `ops`, `args`, `returns`, `confidence` and `why`), `also`,
`truncated`, and stats (`nodes`, `edges`, `loadMs`, `queryMs`, `cached`, `chars`). Follow `next`:
for a single clear op, call it with the named args; when the query named a site but no particular
op, call `list_operations` to choose; when nothing matched, use `find_sites` and then `learn_site`.
Use `site` to confine a question to a site the user already named; other sites then move to `also`
instead of disappearing.

For the measured end-to-end protocol around this layer, including where a real task spent its
seconds, see [PLAYBOOK.md](PLAYBOOK.md).

## Measured evidence

`node --import tsx bench/context.mjs` runs offline against the installed catalog and writes
`bench/results/context.json`. The numbers below are from the 2026-11-28 run on Windows x64, Node
v24.16.0, with 115 sites and 388 operations.

| Measurement | Result |
| --- | --- |
| Labeled retrieval (10 synthetic task/domain queries) | site top-1 10/10, top-3 10/10, MRR 1.0; op top-1 10/10, top-3 10/10, MRR 1.0 |
| Installed graph | 2297 nodes, 4548 edges (1644 declared, 1042 observed, 1862 lexical edges) |
| Context text over 24 installed-catalog questions | p50 808 chars, p95 1277, max 1331, mean 773 |
| `find_sites`-shaped local payload for the same questions | p50 3552 chars, p95 5214, max 5300, mean 3477 |
| Full installed catalog JSON | 914193 chars |
| Discovery calls before / after | `find_sites` + `list_operations` (2) → `find_context` (1) |
| Pure graph build | p50 34.53 ms, p95 50.41 ms (12 runs) |
| Query on a loaded graph | p50 10.70 ms, p95 15.05 ms (60 runs) |
| `contextOf` end to end, cached in memory | p50 9.75 ms, p95 11.80 ms (60 runs) |
| Cached graph read from disk | p50 17.44 ms, p95 19.32 ms (12 runs) |

The context text is about 4.4× smaller at the median and 4.1× smaller at p95 than the local
`find_sites`-shaped payload, about 1100× smaller than the full catalog, and needs one discovery call
instead of two. Retrieval labels use synthetic specs so the ground truth is true by construction and
no real site is hardcoded in business logic; payload and latency numbers use the real installed
catalog. Timings are machine-specific and include no browser or network work.

## Tests

`test/graph.test.ts` covers determinism, node and edge kinds, confidence labels, exact domains,
field and topic traversal, cross-site `also` reasons, site confinement, budget truncation, the
on-disk cache, and description-only task matching. `test/mcp.test.ts` covers the MCP tool's hints,
budget, text and `next` step.
