No account is needed. toscrape.com is a sandbox built for scraping practice: the books and prices
are fake (prices in GBP), and the quotes and author bios are a fixed set.

- First page only: `listCategoryBooks` gives up to 20 books, `quotesByTag` up to 10 quotes.
- `rating` is a word, `One` to `Five`. `inStock` (`getBook`) is the count in the availability text,
  as a string.
- `bookId` and `category` are the slug with its number from the URL (`sharp-objects_997`,
  `mystery_3`); `authorId` is case-sensitive (`Albert-Einstein`).
- An unknown `bookId` or `category` answers `input` (the site's 404). A tag no quote has answers
  `[]`.

## Maintainer notes

Verified 2026-10-31, logged out, from a US IP. `api-anything verify toscrape` passed all 6 cases
(4 examples, 2 checks) at tier 1.

| op | learned with | unseen call | tier |
|---|---|---|---|
| `listCategoryBooks` | `mystery_3`, `travel_2` | `poetry_23`: 19 books | 1 (~0.6 s) |
| `getBook` | `sharp-objects_997`, `a-light-in-the-attic_1000` | `tipping-the-velvet_999`: Historical Fiction, 20 in stock | 1 (~0.5 s) |
| `quotesByTag` | `love`, `humor` | `inspirational`: 10 quotes | 1 (~0.7 s) |
| `getAuthor` | `Albert-Einstein`, `Jane-Austen` | `Mark-Twain` | 1 (~1 s) |

All four are plain GETs of server-rendered pages with `--html` recipes; no rotating ids, nothing to
heal but the selectors. `bookId` and `authorId` are cut from the item's link with a `pick` regex.
Later pages exist (`/catalogue/category/books/<category>/page-2.html`, `/tag/<tag>/page/2/`) but
are not learned: page 1 has no page number in its URL. quotes.toscrape.com's JavaScript, scroll
and login variants (`/js/`, `/scroll`, `/login`) are not covered.
