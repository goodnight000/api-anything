I built three of the four operations on the `goodreads` site, and none of the three fully meets your spec. Search returns only the top match, not a list. Reviews come without star ratings. The author book list isn't saved because Goodreads served a reCAPTCHA.

| op | inputs | returns | checked with |
|---|---|---|---|
| `searchBooks` | `q` | bookId, title, author, authorId, avgRating, ratingsCount (**top match only**) | `q=circe` → Circe, Madeline Miller (176372), 4.22, 1,481,183 |
| `getBook` | `bookId` | title, author, avgRating, ratingsCount, pages, firstPublished, genre1…genre7, description | `bookId=5907` → The Hobbit, 4.30, 366 pages, first published Sept 21, 1937, Fantasy/Classics/… (matches the page) |
| `getBookReviews` | `bookId` | reviewer, date, status, text (**no star rating**) | `bookId=5907` → top review is by Will Byrnes, with full text |
| `getAuthorBooks` | `authorId` | — | **not built** |

All three read in about 0.25–1.3 s over direct HTTP, with no browser needed.

**What's missing and why:**

1. **Search returns only one result.** Goodreads' autocomplete endpoint (`/book/auto_complete?format=json&q=`) has all six fields for about 10 results. But its response is a bare top-level list, and extracting the whole list fails: `--extract '[*]'` passes `inspect --path '[*]'` but fails the drift check on the captured response ("under half of the learned key paths remain"). Calls then return `drift`, and heal fails the same way. This looks like a bug in api-anything's shape check for lists at the top level. I went back to `[0]`, the top match. The regular search page doesn't help either: it only renders the first result on the server, and the rest load later by script.
2. **Reviews have no star ratings.** The page's HTML contains no per-review stars. The request that does return reviewer, rating and text together (`getReviews` on GraphQL) is looked up by Goodreads' internal work id, not the book id, so `add` refuses to learn it. The page's embedded data only links to the reviews rather than containing them. `status` is usually empty; it fills in for things like "Did Not Finish". Thirty full reviews can go past the 20k-character output limit, so expect a `truncated` note.
3. **`getAuthorBooks` isn't saved.** The recipe works on the page I captured from `/author/list/58`. It found each book's id, title, average rating and ratings count (for example, Dune Messiah: 3.90 from 446,718 ratings). But `add` stopped with "the page served a bot challenge (reCAPTCHA)", even when learning from that saved capture without a browser. I stopped there rather than keep hitting the site. To finish it, run `api-anything login goodreads` (add `--window` if you need to clear the captcha by hand), then:
   ```
   api-anything add goodreads getAuthorBooks --trigger "https://www.goodreads.com/author/list/{authorId}" \
     --example authorId=58 --example2 authorId=656983 \
     --html '{"items":"table.tableList tr","fields":{"url":"a.bookTitle@href","title":"a.bookTitle span","rating":"span.minirating"}}' \
     --pick 'bookId=url~show/(\d+),title,avgRating=rating~(\d\.\d+),ratingsCount=rating~—\s(\S+)'
   ```

**Also not covered:**
- Only the first page of an author's books (about 30) and the first 30 reviews.
- Genres come as separate fields (`genre1`…`genre7`), because an HTML field can only hold one value.
- `getBook`'s `ratingsCount` is text with commas ("4,639,210"), while search's is a number.

**Tool issues I ran into:**
- A comma inside a `--pick` regex (such as `[0-9,]`) splits the field list, and `add` fails with an empty "invalid site spec:" error.
- An `--embedded` regex on the page's Apollo data (`apolloState`) reports "embedded data not found".

Fixing the top-level `[*]` extract is the change that would give `searchBooks` its full list.
