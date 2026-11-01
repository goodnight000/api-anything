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
- `write` says what happened, and only `applied` proves the write landed. After `accepted` or
  `may_have_applied`, never send it again: tell the user to check the site.
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
