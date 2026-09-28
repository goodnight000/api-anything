I'm building a reading assistant, and Goodreads has no public API anymore. Use api-anything to turn
Goodreads into operations I can call. Name the site `goodreads`. Everything is read-only, and it needs no login.

The questions I'll ask it:
1. Search for books by title or author. For each result I need its Goodreads book id, title, author name, author id, average rating and ratings count.
2. Given a book id, get the book's details: title, author, average rating, ratings count, page count, first publication date, genres and description.
3. Given an author id, list that author's books with each book's id, title, average rating and ratings count.
4. Given a book id, get the book's top community reviews: reviewer name, their star rating and the review text.

That list is approved, so you don't need to ask me about it. Build the operations, check each one with an input you
didn't use as an example, and finish with the report the skill describes.
