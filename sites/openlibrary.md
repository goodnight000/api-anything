No account is needed.

- A work is a book across all its editions. Ids look like `OL59800W` (work) and `OL31353A` (author).
- `searchBooks` returns page 1 only (20 works), ranked by the site. Several works can share a
  title (study guides, other editions catalogued apart): pick by author and by `editions`, the
  largest usually being the main one. `authorId` is the first author only; `author` lists them all.
- `getWork` `description` is sometimes plain text and sometimes an object whose text is in
  `value`. It, `subjects`, `subjectPlaces` and `coverId` are missing when the catalog has none.
  `authorIds` are keys like `/authors/OL31353A`: the last part is the `getAuthor` arg.
- `getAuthor`: `bio` follows the same text-or-object rule. `birthDate` and `deathDate` are
  free text in whatever format the record has (`21 October 1929`, `January 4, 1976`), and each
  can be missing.
- A cover image is `https://covers.openlibrary.org/b/id/<coverId>-M.jpg` (`-S`, `-M` or `-L`).

## Maintainer notes

Verified 2026-10-31, logged out, from a clean `API_ANYTHING_HOME`: `api-anything verify
openlibrary` passed 5 of 5 cases (each op's example, an `empty` check for `searchBooks`, and an
`input` check for a work id that doesn't exist). Every call answered at tier 1 (plain HTTP).

| op | request | checked with (not an example) | tier |
|---|---|---|---|
| `searchBooks` | the server-rendered `/search?q=...&mode=everything` page, read with an HTML recipe; `workId` and `authorId` are cut out of the result links with a pick regex | `q="pride and prejudice"` (Jane Austen's work `OL66554W` first); `q=zzqqxxwvnothingmatch` gives `[]` | 1, about 1.5-2 s |
| `getWork` | `GET /works/<id>.json`, the site's own record | `workId=OL15093171W` (Pride and Prejudice and Zombies, whose description is a plain string) | 1, under 1 s |
| `getAuthor` | `GET /authors/<id>.json` | `authorId=OL3125727A` (Seth Grahame-Smith: no bio, no death date) | 1, under 1 s |

- The HTML work and author pages (`/works/OL59800W`) redirect to `/verify_human` both in a headless
  Chrome and over plain HTTP, so they were not used. The `.json` records of the same pages answer
  without it, and the search page did too.
- The header search box is drawn by script; filling it fired no autocomplete request, so search is
  learned from the results page.
- The `empty` element of the search recipe is `p.search-no-direct-match__message` ("No matching
  books or authors"), absent from a page with results.
- `firstPublished` was left out of `getWork` because the example work's record has no
  `first_publish_date` (a picked field missing on the example reads as drift); `searchBooks` has it.
