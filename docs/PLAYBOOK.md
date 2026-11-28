# Fast agent playbook

This is the measured protocol for a task that is already understood: get from the user's words to
the smallest correct tool call, with as few model turns and as little tool output as possible. It is
written for weak models first, because a weak model pays for every extra tool result and every
decision it has to make.

The numbers below come from one real draft-invoice task on 2026-11-28 (Windows x64, Node v24.16.0).
The site was not the slow part. No site, domain, or operation name is part of this protocol: the
table names each layer by its role, and the same steps apply to any installed spec.

## Where the time went

| Layer | Observed | Time |
| --- | --- | --- |
| First read | customer lookup | 1,829 ms |
| Write | draft create | 1,504 ms |
| Verification read | list read | 1,036 ms |
| Network work | the three calls above | 4,369 ms |
| End to end | first read to verified record | 43,833 ms |

About **90% of the wall clock was not the website**. The 39.5 seconds around the network calls were
catalog lookups, model/tool turns, and the approval round-trip. The approval wait is the user's time
and must stay; the catalog lookups and split turns are avoidable.

The avoidable work in that run:

- Five catalog lookups before and after the read.
- One `search` response of **35,734 bytes**, capped at 32,768 bytes, because a broad site query
  returned full tool signatures.
- A `list_operations` call that returned **40,485 characters** in 66 ms. The same discovery through
  `context` was **342 characters**, with 20 ms load and 52 ms query time.
- The write and its verification read were separate model turns. They do not have to be.

The running MCP server also predated `find_context`, so the one-call discovery tool was unavailable
and the fallback was the large catalog. After changing server code, restart or reload the server
before measuring the protocol again.

## Slow layers, ranked

1. **Tool discovery.** Broad catalog searches return full signatures and dominate context. This is
   the first layer to remove.
2. **Model turns.** Every separate read, write, and verification is another full turn with the whole
   recent context attached.
3. **Full schema dumps.** `list_operations` is useful when the site's notes or a complete schema is
   needed, but it is a bad first move for a task the skill already knows.
4. **Network calls.** One to two seconds each, but only a small fraction of the task.
5. **Approval.** Required for a write, and worth one clear question. It should not be repeated.
6. **A stale server.** A tool added in source is invisible until the MCP server is restarted or
   reloaded; the agent then pays for the fallback.

## The fast path

1. **Use the known path.** If a loaded skill or a prior result names the exact tool, call it
   directly. Do not search the catalog to rediscover it.
2. **Discover once, if needed.** For an unknown task, call `find_context` once. Use
   `list_operations` only for the site's notes or a full schema. Do not call `list_sites`,
   `find_sites`, and `list_operations` in sequence for a task one call can answer.
3. **Read in one script.** Put independent reads in one Code Mode `execute` with `Promise.all`.
   Filter in the script and return only the matching rows and fields, never the whole table.
4. **Ask once.** For a write, state the exact customer, item, amount, dates, and status in one
   question. Wait for a clear yes.
5. **Write and verify in one script.** After approval, call the write once with a fresh
   `idempotencyKey`, read the created id or number from its response, then make one verification
   read in the same `execute`. Never resend a write that was accepted, applied, or may have applied.
6. **Report the result.** Give the id, number, status, and amount. Stop.

That is three model turns for a write task: read, approval, write-and-verify. It is two turns for a
read-only task: discover-or-read, then answer.

## Rules

- A broad tool search is a last resort. If a skill names the tool, call it.
- One search maximum for an unknown tool; query the exact name with `limit: 1`.
- Prefer `find_context` over `list_operations` for discovery.
- `list_operations` is for notes and full schemas, not for "what can this site do?".
- Batch independent reads; filter large results inside `execute`.
- Do the write and its one verification read in one script, after approval.
- Never dump a catalog, a full table, or a full schema into the model's context.
- Optimize the orchestration loop before the network: a 1-second API call is not the bottleneck when
  discovery adds 30 seconds.
- Reload the MCP server after changing its tools, then verify the new tool is actually listed.

## Anti-patterns seen in the baseline

- `search` with a site name: 35 KB of signatures for five useful tool names.
- Searching again for a tool that the skill already named.
- `list_operations` for a site whose operation and args were already known.
- Reading customers, then reading items, then reading invoices when the skill says the item is fixed.
- Sending the write in one turn and checking the result in the next.
- Reporting `accepted` as if it were unverified; one read is enough to verify.

## What to measure next

- Model turns and tool-output bytes per task, not only API latency.
- Discovery payload size: `find_context` text versus `list_operations` JSON.
- Wall clock from first tool call to verified result, split into network and non-network time.
- Whether the running MCP server actually exposes the tools the source defines.

The context-layer benchmark in `bench/context.mjs` already measures discovery payload and local
latency. This playbook adds the missing end-to-end view: where the seconds actually go.
