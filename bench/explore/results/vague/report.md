Goodreads isn't set up in api-anything yet, so I'll build it from scratch. Before I capture anything, I need to know what you want it to do.

1. **Which questions will you ask it?** For example: search for books, get one book's details, a book's reviews, an author's books, or your own shelves ("want to read", "read", your ratings).
2. **Which fields do you need back?** For example: title, author, average rating, number of ratings, pages, genres, description, publication year, ISBN.
3. **Is it read-only and public, or does it need your account?** Your shelves would need your Goodreads login, which I'd import from your browser. Actions like shelving a book or rating it would be write operations. Also, roughly how often will this run?

If you'd rather not decide, here's what I'd build by default (public data, read-only, no login):

| op | inputs | returns | page |
|---|---|---|---|
| `searchBooks(query)` | search text | bookId, title, author, avgRating, ratingsCount, year | `goodreads.com/search?q=…` |
| `getBook(bookId)` | id from `searchBooks` | title, author, avgRating, ratingsCount, pages, genres, description, published, isbn | `goodreads.com/book/show/{bookId}` |
| `getAuthorBooks(authorId)` | author id | bookId, title, avgRating, year | `goodreads.com/author/list/{authorId}` |

**Not included by default:** results past the first page, full review text, your shelves, and any writes.

Reply "go" to build these three, or edit the list.
