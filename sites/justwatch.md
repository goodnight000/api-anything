`listOffers(slug)` reads the regular provider offer rows on a public US movie page. Use an
exact US slug from a JustWatch link. Slugs may differ by country, and a year in the slug need
not be the release year. This operation fixes the viewing country to the United States.

Provider plan and channel names stay distinct. `monetization` preserves the displayed label,
including trial durations such as "30 Days Free". A trial is conditional; its following charge
can appear in `priceText`. Subscription charges are plan prices, while rental, purchase,
bundle, cinema and physical-media offers have different meanings. Amounts remain display
strings. Missing prices are omitted. Quality labels describe the advertised offer.

Only ordinary offer rows are returned. Promoted cards and offers for similar films are
excluded. Rows can represent multiple formats from one provider. No login is needed for the
verified reads. These are advertised offers, with no playback, account eligibility, current
inventory or checkout-price guarantee. Country switching, TV titles, pagination and dated
availability queries were not verified.

## Maintainer notes

Verified signed out on 2026-10-26 UTC using fresh isolated profiles and no personal imports.
Actual GET document captures: `cmvp59rfe9cdd8a` for
`https://www.justwatch.com/us/movie/dune-part-two-2023`, and `cmvp5bh8t283c54` for
`https://www.justwatch.com/us/movie/memento`, document request 1 in each. The document-only
helper aborted other requests; this does not establish a fully hydrated GUI.

Learning used both differing examples without warnings. Held-out `slug=oppenheimer` came
from a real link in the Dune response. Its one cookie-free tier-1 request returned 17 rows;
an independent HTTP document and Python HTMLParser matched every returned field for all 17,
and independently checked film identity and United States context. Current-version verify
passed Dune, Memento and Oppenheimer at tier 1. See `justwatch-coordinator.md` in discovery
research for export, fresh-home reuse, vetting and integrated-check receipts.

The recipe keeps direct regular buybox rows, excludes transparent placeholder price elements,
and preserves free-trial labels as well as ordinary monetization labels. Broad `a.offer`
would include similar-film promotions. No valid empty-search or unavailable-film expectation
was established. Prices and provider catalogues can change. No provider playback or purchase
link was opened. Raw documents, captures and operational receipts stay ignored under
`bench/explore/state/discovery/coordinator-justwatch/`.
