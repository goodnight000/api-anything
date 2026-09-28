I've built five operations for the `goodreads` site. All of them returned correct data for inputs I didn't use as examples, and `api-anything verify goodreads` passes. Everything runs as direct HTTP with no browser and no login, and each call takes about 0.4–1.7 s.

| op | inputs | returns | checked with |
|---|---|---|---|
| `searchBooks` | `q` (title or author) | bookId, title, author, authorId, avgRating, ratingsCount | `q=earthsea` → 5 Le Guin books, e.g. A Wizard of Earthsea (13642), author 874602, 4.01, 377,695 ratings |
| `getBook` | `bookId` | title, author, authorUrl, avgRating, ratingsCount, pages, firstPublished, genres[], description | `bookId=13642` → 183 pages, "First published January 1, 1968", genres Fantasy/Fiction/Young Adult/…, full description |
| `authorBooks` | `authorId` | bookId, title, avgRating, ratingsCount (30 books) | `authorId=874602` → Wizard of Earthsea, Left Hand of Darkness, The Dispossessed, … |
| `getWorkId` | `bookId` | workId, legacyWorkId | `bookId=13642` → `kca://work/amzn1.gr.work.v1.GxrQvIxdiGIW-OF1X3MPlQ` |
| `getReviews` | `workId` | reviewer, rating (1–5), text | that workId → Earthsea reviews (e.g. Nataliya, 4★, a review about Ged) |

**Reviews take two calls.** The star ratings only exist in the site's reviews request (the page HTML has placeholder stars). That request is keyed by Goodreads' internal work id, not the book id. So the flow is:
1. `getWorkId bookId=…`
2. `getReviews workId=…`

There's a side effect: the browser fallback for `getReviews` always loads the Hyperion example page. So if the direct request stops working, repair won't work either; the operation will fail with an error rather than return the wrong book's reviews. Re-learning it would then be a manual job.

**Things to know about the data:**
- **Review text** is the raw HTML as Goodreads stores it (`<b>`, `<br>`, images), not plain text.
- **Reviews get cut short:** each review is long, so a call returns about the first 6 of Goodreads' top 30 before hitting the output size limit. The result is marked `truncated`.
- **Formatting:**
  - Numbers are strings in some ops. `avgRating` is always a string, e.g. `"4.01"`.
  - `ratingsCount` is a plain number in `searchBooks`, but text in the other two: `"377,680"` in `authorBooks` and `"377,695 ratings"` in `getBook`.
  - `pages` includes the format ("183 pages, Paperback").
  - `firstPublished` is the page's own wording ("First published January 1, 1968").
  - `getBook` has no author id field; the id is inside `authorUrl`.
- **Search** uses Goodreads' autocomplete, so it returns only the top 5 matches.
- **Genres** are the ones the page lists, up to 7.

**Not covered:**
- Further pages of search results, author books (first 30 only) or reviews (first 30).
- Review filters or sorting.
- Anything that needs an account, such as shelves or your own ratings.
