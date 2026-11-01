No account is needed. Results are in Russian, as hh.ru shows them.

- `area` is hh.ru's numeric region id. Leave it out to search all of Russia (113). Without a region,
  hh.ru also returns vacancies from other countries it serves (Belarus, Uzbekistan, Kazakhstan).
- `searchVacancies` returns the first page only (up to 20 vacancies; the page loads the rest by
  script).
- `salary` is the page's text (`"60 000 – 100 000 ₽ за месяц, на руки"`), in the vacancy's currency.
  It is missing when the employer gives no salary. `experience` is the page's label
  (`"Опыт 1-3 года"`, `"Без опыта"`).
- In `getVacancy`, `employment` keeps its label glued to the value (`"Тип занятостиПолная занятость"`).
  A salary or address the vacancy doesn't give is missing, and a vacancy with no skills listed has
  `skills: []`.

## Maintainer notes

Verified on 2026-10-31 (US Pacific; 2026-11-01 UTC), logged out, from a US network, with an isolated
`API_ANYTHING_HOME` and no imported cookies. hh.ru served the search and vacancy pages to both Chrome
and plain HTTP with no challenge.

- `searchVacancies` was learned from the server-rendered `https://hh.ru/search/vacancy?text={text}&area={area}`
  document, examples `python`/`1` and `бухгалтер`/`2`. The recipe reads `data-qa` attributes, which
  are stable across hh.ru's hashed CSS-module class names. The salary is the `span` holding the
  `<data>` elements. The page also embeds the full result set (50 items, structured salary) in
  `<template id="HH-Lux-InitialState">`, but as entity-escaped JSON that `--embedded` can't read.
- `getVacancy` reads `data-qa` fields of `https://hh.ru/vacancy/{id}`. The page also has a
  schema.org `JobPosting` JSON-LD whose description is HTML; the HTML recipe gives plain text.
- Unseen calls at tier 1: `text=дизайнер area=88` (Kazan vacancies only), `text=сварщик` with the
  default area (Russia-wide), `getVacancy vacancyId=138996235` (salary "до 60 000 ₽", 15 skills).
- `verify hh` passed 4/4 at tier 1, in the learning home and in a second empty home given only the
  exported spec: both examples, `повар`/`2`, and an empty search (`empty-vacancy-search-block`).
- hh.ru has an official public API (`api.hh.ru`), not used here.
