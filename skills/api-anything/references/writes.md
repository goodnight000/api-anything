# Writes

A write (post, like, send, buy) changes the user's account: use only their own accounts.

## Learning one

- Learn it with `capture` and `add --write` ([authoring.md](authoring.md)). The request is aborted in
  the browser, so learning never performs the action.
- `--match method=POST` pins a request as a read, and a pinned request is sent for real on every
  learning run: pinning an order places orders. Pin only a request that certainly changes nothing
  (a search sent as POST). When unsure, use `--write`.
- Checkout: learn the steps up to the payment. The card form is the user's to fill in their own
  browser; never ask for a card number.

## Sending one

- Over MCP, `call_write_operation` on a server started with `--allow-writes`; with the CLI,
  `call ... --allow-writes`. Confirm the exact text or target first if there is any doubt.
- Before the first real send, `call ... --dry` prints the exact request: check the ids and text.
- Deriving a write from an existing read op (for example a DELETE from a GET path): clear `learnedLoggedIn`
  unless the site pins `loginCookies`. A signed-in write with no live login cookie is refused before it
  is sent; `--dry` now reports that as `preflight` and `vetShared` warns about the shape.
- If the user rules out browser use, add `--max-tier 1` to a CLI write so a failed request cannot open
  a browser. For a delete, verify with a read: a `get` that answers 404 or a list without the id. `accepted`
  with a success response is proof for that send; never send the same delete twice.
- `write` says what happened. `applied` means a readback found it; a 2xx whose data carries the created
  record or delete confirmation is proof the site took it, even when no readback can match an auto-assigned
  value. After `accepted`, `may_have_applied` or a 2xx, never send it again: verify with a read if needed.
- A repeat within 10 minutes is refused as `duplicate`. Pass `again` (CLI `--again`) only when the
  user checked the site, the write isn't there, and they want it sent.
- When `reason` names other requests the page tried and api-anything stopped, show the user before
  learning the write again.

## Proving one landed

```
api-anything readback <site> <write-op> <read-op> [k={param}] --find title={title}
```

Find by a value only this write makes (the title the user chose, an id), not a status every item
shares.
