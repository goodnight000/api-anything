---
name: site2api
description: Turn a website that only has a GUI into operations you can call directly, and call them. Use when the user says "turn <site> into an API", "call <site>", "get X from <site> without the browser", "automate <website>", or asks for data or an action on a site that has no public API. Learns requests from the site's own frontend, replays them fast, and heals itself when the site changes.
---

# site2api

site2api learns an operation from one browser run of the site's own frontend. After that, every
call is a direct HTTP request that takes about 100 ms. When the site changes, the call heals
itself. Everything is local, under `~/.site2api`.

Run the CLI as `site2api` (or `npx -y site2api`). Its output is one line of JSON. A failure also
prints a `next:` line on stderr. If the MCP server is connected, `list_sites`, `list_operations`
and `call_operation` do the same as `sites`, `ops` and `call`.

## Using an existing operation

1. `site2api sites`, then `site2api ops <site>` to see the operations and their params.
2. `site2api call <site> <op> name=value ...`
3. Read `data`. `tier` shows which transport answered. `healed: true` means the template was repaired
   and saved during this call. You don't need to do anything about it.

## Creating an operation: capture, add, call, verify

1. **Capture.** Load the page that shows the data and see which requests it makes:
   ```
   site2api capture "https://site.com/some/page?q=kittens" --example q=kittens
   ```
   The candidates are ranked, and `carries` lists the example values each request contains. Pick
   the request whose URL or operationName matches the data you want.
2. **Add.** Describe how to make the frontend fire that request. The trigger is a URL template.
   `--steps` adds UI actions after the page loads.
   ```
   site2api add site search --trigger "https://site.com/search?q={q}" \
     --example q=kittens --example2 q=puppies --pick title,url
   ```
   - Give two different example sets whenever you can. The second run separates params from
     nonces and signatures.
   - Example values must be at least 3 characters and distinct from each other, and they must
     appear in the request.
   - An op with no args (a feed, a list) needs `--match path=/api/feed` to say which request.
   - If `add` warns that the match is ambiguous, or picks the wrong request, run `capture` again
     and use `add --from <captureId> --pick-request <id>`.
   - For a server-rendered page, use
     `--html '{"items":"li.result","fields":{"title":"a","url":"a@href"}}'`.
3. **Call** it with a new value: `site2api call site search q=otters`. Check that `data` is what
   the user wanted.
4. **Verify.** `site2api verify site` calls every read op with its example args.

The `add` output lists `warnings`. Read them. A warning such as "minTier 3" means every call runs
the browser, which is slow but correct.

## When to ask the user to log in

Ask the user to run `site2api login <site>` (or `site2api login https://site.com`) when either
of these happens:

- A result has `class: "auth"`.
- The data you need is only visible when signed in, before you capture.

The command opens a visible Chrome window. You cannot complete it for them, and you must never
ask for their password. Wait until they say they are done.

## The failure loop

This loop is strict, because every retry costs the user's quota and may look like abuse to the
site.

1. The call fails. Read `class`, `reason` and `next`.
2. Follow `next` **once**, if it is something you can do yourself (for example `site2api heal`,
   or fixing an arg).
3. If it fails again, or `next` needs the user, **stop**. Report `class`, `reason` and the hint
   to the user, and don't try other approaches on your own.

| class | meaning | what to do |
|---|---|---|
| `auth` | not logged in, or the session expired | ask the user to run `site2api login <site>` |
| `rate` | the site is throttling | stop; tell the user; do not retry now |
| `blocked` | bot challenge, even after escalating to the browser | ask the user to log in and clear the challenge |
| `drift` | the site changed and healing failed | `site2api heal <site> <op>` once; then re-`add` |
| `input` | bad or missing args, or the thing does not exist | fix the args per `site2api ops <site>` |
| `refused` | a write without permission | see the write rules below |
| `error` | anything else | retry once at most, then report |

## Write safety

- Writes (posting, liking, sending, buying) are ops added with `--write`. While site2api learns
  one, it aborts the request in the browser, so learning never performs the action.
- Calling a write needs `--allow-writes` (or an MCP server started with `--allow-writes`). Add
  it only when the user asked for **that specific action with that content**. Confirm the exact
  text or target with the user first if there is any doubt.
- A write is sent once. If the result says "the write may have gone through", don't retry.
  Tell the user to check the site.
- Before the first real write, run `site2api call <site> <op> ... --dry`. It prints the exact
  request with the credentials redacted, so you can check that the ids and text are the ones
  intended, byte for byte.
- Use only the user's own accounts, and stay within what the site allows a person to do by hand.
  Never put passwords or cookies in a spec, args, or chat.

## Token efficiency

- Set `--extract` to the part of the response you need, and `--pick` to the fields you need per
  item. `add` suggests an extract path. Output over about 20k characters is cut, and the result
  carries a `truncated` note.
- Prefer `ops` over reading spec files, and a single `call` over capture runs. A capture is for
  learning, not for fetching data.
- Don't loop `call` over hundreds of values without asking. site2api spaces requests to one site
  at least 1 s apart.

## Sharing

`site2api export <site> --out site.json` writes a copy without examples. It refuses if a live
cookie or session value is still inside the spec. To contribute a spec, see CONTRIBUTING.md in
the repo.
