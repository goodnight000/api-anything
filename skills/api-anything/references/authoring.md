# Turning a site into an API

This needs the CLI. `api-anything <command> --help` documents every flag and recipe format; this
file is the order of work and the judgment calls.

## 1. Agree on the operations

Know which questions the user will ask the site, which inputs change between calls, which fields
they need back, and whether it needs their login. Ask what is open in one message, three questions
at most.

Then propose one op per kind of question, as `name(inputs) -> fields` with the page that shows it
(`searchBooks(query) -> bookId, title, rating`), plus what you won't cover. Wait for the user's OK;
their edits count as one.

## 2. Capture

```
api-anything capture "https://site.com/search?q=kittens" --example q=kittens --outline
```

Pick the candidate that `carries` the example and whose URL or operationName matches the data. Its
`outline` hands you ready `--extract`/`--pick`, `--embedded` or `--html` recipes. Use `inspect` only
when the outline leaves a question open.

The data lives elsewhere when:

- `list.count` is below what the page shows: script fills the list in, so take the JSON request.
- the page has a search box: its autocomplete endpoint is often the cleanest source. Capture with
  `--steps` that fill it.
- a single-page app fires its request only on in-app navigation: add `--soft-from <another page>`.

Prefer the `document` for server-rendered data, and schema.org JSON-LD on a detail page: both
survive redesigns.

## 3. Add

```
api-anything add site search --trigger "https://site.com/search?q={q}" \
  --example q=kittens --example2 q=puppies --pick title,url
```

- Give a second example whose answer must differ. A warning that it got the first one's data
  (`unproven`) means the server may ignore that param: try an example that should differ more, then
  tell the user.
- For a picker or radio group, `--enum` lists the site's whole set, never only the example's.
- When `add` took the wrong request, `add --from <captureId> --pick-request <id>`. To fix a recipe,
  add again `--from` the same capture with new recipe flags: no browser.
- Read `warnings` and check `preview`: it is what a call returns.
- Learn paging only when the user needs more than one page.

## 4. Check

1. Call the op with a value you didn't use as an example, and compare `data` with the site's page.
2. Record `check`s with public values (they are shared): one `result` check setting every optional
   param, each value chosen so some row of the example fails it, and one `empty` check. A check
   that excludes nothing can't catch a param the server ignores.
3. `api-anything verify site`. A failure means the op or the check is wrong; change the check only
   when the site's own page answers those args the other way. Follow an `inconclusive` case's
   `next`, then verify again.

## 5. Report

A table of `op | inputs | returns | checked with`, and what isn't covered. `api-anything publish
<site> <op>` previews what sharing would send; send it with `--yes` only on the user's yes.
