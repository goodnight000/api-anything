---
name: api-anything
description: Turn a website that only has a GUI into operations you can call directly, and call them. Use when the user says "turn <site> into an API", "call <site>", "get X from <site> without the browser", "automate <website>", or asks for data or an action on a site that has no public API. Learns requests from the site's own frontend, replays them fast, and attempts repairs when requests drift.
---

# api-anything

api-anything learns operations from browser captures of the site's own frontend. Calls try direct
HTTP first, with Chrome fallback when needed. Results report the transport tier and elapsed time.
When a request drifts, the runtime tries to repair it; failure is reported. Everything is
local, under `~/.api-anything` (`API_ANYTHING_HOME` overrides it).

Run the CLI as `api-anything` (or `npx -y github:goodnight000/api-anything`). Its output is one line of JSON. A failure also
prints a `next:` line on stderr. If the MCP server is connected, `list_sites`, `list_operations`
and `call_operation` do the same as `sites`, `ops` and `call`, and `login` refreshes a session.
`call_operation` sends a list of two or more records as `data: {columns, rows}`, one row per item. MCP
cannot create operations: `capture` and `add` are CLI only. Over MCP, `next` names the tools to
use. Run CLI-only commands yourself when you have shell access; otherwise give the command to the user.

## Using an existing operation

1. `api-anything sites`, then `api-anything ops <site>` to see the operations, their params (with
   the format a param expects, when the spec says), and the site's `notes`. Read the notes: they
   hold caveats such as "airport codes only".
2. `api-anything call <site> <op> name=value ...`. An arg that doesn't fit the param's declared
   format comes back `class: "input"` with that format, and nothing was sent: fix the arg.
3. Check `ok` before using `data`, and check the output's identity/range against the task. Treat a
   `truncated` result as partial. `tier` shows which transport answered. `healed: true` means the template was
   repaired and saved during this call. You don't need to do anything about it.
4. No results look like this:
   - `ok: true` with `data: []` when the page shows it's empty: a JSON op's list at the extract
     path is empty, an `--embedded` op's extract resolves to `[]`, or an `--html` op whose items
     selector is `"<container> <item>"` finds the container with no element of the item's tag in it.
   - Otherwise (the list or selector is simply missing) api-anything replays the op's example
     args once: if those still return data, the answer is `ok: false`, `class: "input"`, "no
     results for these args ... the operation works". Treat that as "nothing found" for these
     args, not as a broken op.

## Turning a site into an API: intent first

Use this when the user wants a site "as an API", or several operations, rather than one call.

1. **Pin down the intent.** Before capturing anything, you need to know:
   - which questions the user will ask the site;
   - which inputs change between calls, and which stay fixed;
   - which fields they need back;
   - whether the operations only read, whether they need the user's login, and how often they'll run.

   If the request doesn't answer these, ask all your questions in one message, three at most. If it
   does answer them, don't ask.
2. **Propose operations, then wait for approval.** Propose one operation per kind of question, as
   `name(inputs) -> fields`, with the page that shows that data. Also list what you won't cover, such
   as pagination or writes. Example: `searchBooks(query) -> bookId, title, author, rating`,
   `getBook(bookId) -> pages, genres, description`. The user's edits count as approval of the
   edited list.
3. **Outline first; inspect only when needed.** For each approved operation, run
   `api-anything capture <page> --example k=v --outline`. Each of the top candidates then carries
   an `outline`:
   - `json.at` is where the example value sits. `json.extract` and `json.fields` (with sample values)
     become `--extract` and `--pick`.
   - `embedded[].regex` is a ready `--embedded` regex for JSON inside the page, with that JSON's
     `extract` and `fields`. On a detail page, prefer schema.org JSON-LD (`application/ld+json`): it
     stays stable when the site redesigns.
   - `list` is a ready `--html` recipe (`items`, `fields`, `sample`) for a repeated list that holds
     the example.
   - `labels` lists selectors with sample text on a detail page, for `--html '{"items":"body",...}'`.
     A key starting with `all:` is a field that returns every match as a list (genres, tags).
   - `varyingKeys` warns that the path runs through an id that changes with the input: don't extract
     through it, and use another source.

   Use `inspect` only when the outline doesn't answer your question.
4. **Find where the data really comes from.**
   - If `list.count` is lower than the number of results the page shows, or the samples come from
     only the first item, the rest of the list is filled in by script. Look for the JSON request
     instead.
   - A site's own search box often calls a JSON autocomplete endpoint. Capture with
     `--steps '[{"action":"fill","selector":"<search input>","value":"<example>"},{"action":"wait","ms":2000}]'`
     and look for the request that `carries` the value.
   - Ids chain between operations. If `getBook` needs a `bookId`, take the example ids from
     `searchBooks` output. Don't guess them.
5. **Teach and verify each operation** with the loop below. Call each one with an input you didn't
   use as an example, and check that the data matches what the page shows for that input.
6. **Report.** Give a table of `op | inputs | returns | checked with`, plus what isn't covered (other
   pages of results, fields the site doesn't expose, anything that needs login).

Keep exploration cheap. Capture each page type once, read outlines rather than full responses, and
don't capture pages the user didn't ask for.

## Creating an operation: capture, add, call, verify

1. **Capture.** Load the page that shows the data and see which requests it makes:
   ```
   api-anything capture "https://site.com/some/page?q=kittens" --example q=kittens
   ```
   The candidates are ranked, and `carries` lists the example values each request contains. Pick
   the request whose URL or operationName matches the data you want. Add `--outline` to get a
   summary of each top candidate's response (see above) instead of inspecting them one by one. `kind` is the resource type:
   `document` is the page itself. If the output has `blocked`, the site served a bot challenge:
   follow `next` (the user logs in and clears it) instead of picking a request. Do the same when
   `next` says the page is a sign-in page (the user logs in) or answered an HTTP error (check the URL).
   "Sign-in page" is said when the page landed on a login path, or shows a sign-in form and no
   answer holds your `--example` values: check the values before asking for a login. When `next`
   only adds that the page also shows a sign-in form, go on: a login is needed only if the data is
   missing. `pageStatus` is the page's own HTTP error when a request it loaded is still usable.
   - `api-anything inspect <captureId> <id> [--extract a.b] [--pick x,y]` prints a candidate's
     response, with no browser. JSON inside strings (Google's batchexecute payloads, a form's
     `f.req`) is shown decoded. A path or selector that finds nothing fails; `[]` is a real empty
     list (with a `note` when an `--html` items container is on the page and empty).
   - If the page is a single-page app and the data request only fires on in-app navigation, add
     `--soft-from <another page on the site>`: it loads that page first and navigates in-app.
   - If the data is server-rendered, prefer the `document` itself over hunting for an XHR: it has
     no rotating ids. Use `--html` for a list in the markup, or `--embedded '<regex>'` for JSON inside
     a `<script>` (group 1 of the regex marks where the JSON starts). Try recipes with
     `inspect <captureId> <id> --html '...'` before `add`.
2. **Add.** Describe how to make the frontend fire that request. The trigger is a URL template.
   `--steps` adds UI actions after the page loads.
   ```
   api-anything add site search --trigger "https://site.com/search?q={q}" \
     --example q=kittens --example2 q=puppies --pick title,url
   ```
   - Give two different example sets whenever you can. The second run separates params from
     nonces and signatures.
   - Example values must be at least 3 characters and distinct from each other, and they must
     appear in the request. `add` fails if an example is not in the chosen request: pick another
     request rather than dropping the param.
   - An op with no args (a feed, a list) needs `--match path=/api/feed` to say which request.
   - If `add` warns that the match is ambiguous, or picks the wrong request, run `capture` again
     and use `add --from <captureId> --pick-request <id>`. A capture holds one run, so a second
     example needs its own: capture the page with those values, then add `--from2 <captureId2>
     --example2 k=v`.
   - A copy of the page's own URL in a request (analytics `page.url`, `?src=`) is not evidence
     that the request reads the arg, so `add` won't learn from it on its own. If the data request
     really takes the page path (a route resolver posting `{"path":"/facebook/react"}`), pick it
     with `--pick-request <id>`: an explicitly picked request counts.
   - `add` refuses to learn a read whose chosen answer carries no data (`{"success":true}`, an
     empty 2xx): that is an analytics beacon. Pick the data request, or learn the page itself
     with `--html`/`--embedded`.
   - For a server-rendered page, use
     `--html '{"items":"ul.results li.result","fields":{"title":"a","url":"a@href"}}'` or
     `--embedded '<regex>'`. Write `items` as `"<container> <item>"` when the results sit in a
     stable container: a results page with the container and no items then reads as `[]`.
   - A header that carries a public constant (a web app's shared bearer, the same for every
     visitor) can stay literal with `--public authorization`. Only do this when it is not the user's.
   - Check `preview` in the output: it is what a call returns, judged on the captured response. If
     it is wrong, or a warning says the op fails on the captured response, repair the recipe: run
     `add <site> <op> --from <captureId>` (ids are in `captures`) with only the recipe flags
     (`--extract`, `--pick`, `--html`, `--embedded`). That needs no browser and changes only what
     the op returns (`repaired`): its request, params and trigger stay. With `--example`, `add`
     learns the whole op again and replaces it (`replaced: true`).
   - If a warning says the captured response is `blocked` or `auth`, or `add` fails because the
     trigger landed on a sign-in page, the recipe is not the problem: ask the user to run
     `api-anything login <site>`, then add again.
3. **Call** it with a new value: `api-anything call site search q=otters`. Check that `data` is what
   the user wanted.
4. **Verify.** `api-anything verify site` calls every read op with its example args.

The `add` output lists `warnings`. Read them. A warning such as "minTier 3" means every call runs
the browser. Verify new arguments there too; the runtime refuses captures whose parameter
positions do not match the requested values. A spec with a detected leftover credential is not saved. `--pick name=path` renames a field, so positional keys
such as `[1][0][1]` become `price`.

## Logging in

Some sites need an account. `api-anything login <site>` (a site name, a domain such as
`linkedin.com`, or a URL) by default **imports** the site's cookies from the user's everyday
browser — no password, no re-doing 2FA. It prints the profile it used (with its display name and
Google account) and cookie names, never values.

- If several browser profiles are signed in to the site, `login` returns `ok: false` with
  `candidates` (profile, name, email). They may be different people's accounts: **ask the user which
  one**, then run `api-anything login <site> --profile "<Browser/Profile>"` with the profile they
  named. Never pick for them, and never copy a profile from an example.
- If you have the `login` MCP tool, call it (mode `import`) when a result is `class: "auth"`, then
  retry the call once. It only refreshes a session the user already imported with the CLI; if it says
  so, ask the user to run `api-anything login <site>`. api-anything also re-imports from the chosen
  profile on its own before it ever returns `auth`, so a bare `auth` usually means the user is signed
  out in their browser too.
- Only ask the user to act when import cannot: tell them to run `api-anything login <site> --window`
  (a visible window to sign in and clear any 2FA/captcha by hand) or `--cookies <file>` on a server.
  You cannot complete a `--window` sign-in for them, and you must never ask for their password.
- An imported session is the same one as the user's browser: if the site logs it out, both go. Keep
  traffic on it light.
- `api-anything logout <site>` clears the session.

Use the signed-in session only within the user's authorized task and account. Reuse existing
permission; ask only for missing access or an account choice.

## The failure loop

This loop is strict, because every retry costs the user's quota and may look like abuse to the
site.

1. The call fails. Read `class`, `reason` and `next`.
2. Follow `next` **once**, if it is something you can do yourself (for example `api-anything heal`,
   or fixing an arg).
3. If it fails again, or `next` needs the user, **stop**. Report `class`, `reason` and the hint
   to the user, and don't try other approaches on your own.

| class | meaning | what to do |
|---|---|---|
| `auth` | not logged in, or the session expired | ask the user to run `api-anything login <site>` |
| `rate` | the site is throttling | stop; tell the user; do not retry now |
| `blocked` | bot challenge, even after escalating to the browser | ask the user to log in and clear the challenge |
| `drift` | the site changed and healing failed | follow `next` once (`api-anything heal <site> <op>`, or re-`add` with a new `--extract` when the response changed); then stop |
| `input` | bad, unknown or missing args, or the thing does not exist / has no results (the op's example still answers) | fix the args per `api-anything ops <site>`; never heal or re-add for this |
| `refused` | a write without permission | see the write rules below |
| `error` | anything else | retry once at most, then report |

## Write safety

- Writes (posting, liking, sending, buying) are ops added with `--write`. While api-anything learns
  one, it aborts the request in the browser, so learning never performs the action. Learning an
  existing write again, or a request a `--write` capture aborted, needs `--write`: `add` refuses to
  save either as a read.
- Calling a write needs `--allow-writes` (or an MCP server started with `--allow-writes`). Add
  it only when the user asked for **that specific action with that content**. Confirm the exact
  text or target with the user first if there is any doubt.
- A successful response is a service acknowledgement; confirm the receipt or read back the
  resulting object before claiming delivery. An explicit `ok: false` or `success: false` in a
  write response is a failure even with HTTP 200. If the result says "the write may have gone through", don't retry, whatever
  the class. Tell the user to check the site.
- Before the first real write, run `api-anything call <site> <op> ... --dry`. It prints the exact
  request with the credentials redacted, so you can check that the ids and text are the ones
  intended, byte for byte.
- Use only the user's own accounts, and stay within what the site allows a person to do by hand.
  Never put passwords or cookies in a spec, args, or chat.

## Token efficiency

- Set `--extract` to the part of the response you need, and `--pick` to the fields you need per
  item. `add` suggests an extract path. When results are split across sections, `[*]` joins them
  (`contents[*].items`). Output over about 20k characters is cut, and the result
  carries a `truncated` note.
- Prefer `ops` over reading spec files, and a single `call` over capture runs. A capture is for
  learning, not for fetching data.
- Don't loop `call` over hundreds of values without asking. api-anything spaces requests to one site
  at least 1 s apart.

## Sharing

`api-anything export <site> --out site.json` writes a copy without examples (`--keep-examples` keeps
public ones, so `verify` works for others). It refuses if a live cookie or session value is still
inside the spec. To contribute a spec, see CONTRIBUTING.md in the repo.
