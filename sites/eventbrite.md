Signed-out public reads. `listFeaturedEvents` returns only the first featured shelf on a city's browse page, currently four cards. It is a curated shelf, not a full search, distance filter, or complete event inventory. The city slug comes from an Eventbrite `/d/<city>/events/` link, for example `ca--san-francisco`, `ny--new-york`, or `ca--los-angeles`.

For `getEvent`, use the whole final `/e/` path segment from a returned event URL, including its title slug and numeric ticket ID. Remove query parameters. `when` is the site's relative display label; detail dates include time-zone offsets. Offers are advertised ranges, not a booking quote or a guarantee of availability. No pagination, keyword filtering, ticket purchase, booking, or account actions are covered.

## Maintainer notes

Verified 2026-10-26 UTC while signed out, with isolated `API_ANYTHING_HOME` directories and no personal cookie import or login. Actual frontend documents were captured using the repository's `bench/discovery/capture-document.mjs`. It permits only the requested GET document and aborts other requests. Raw evidence is ignored under `bench/explore/state/discovery/events-activities-r1/`.

Source homepage: https://www.eventbrite.com/ . Its city links supplied every browse route. The San Francisco page supplied all three event links below. Source and captured request URLs:

- https://www.eventbrite.com/d/ca--san-francisco/events/ , capture `cmvp2lkv0ec53fb`.
- https://www.eventbrite.com/d/ny--new-york/events/ , capture `cmvp2mi11f58f4d`.
- https://www.eventbrite.com/d/ca--los-angeles/events/ , independent third-input capture `cmvp2mx5cd464e3`.
- https://www.eventbrite.com/e/san-frans-largest-tech-startup-business-entrepreneur-networking-soiree-tickets-1976644210042?aff=ebdssbneighborhoodbrowse , capture `cmvp2n83ce723f7`.
- https://www.eventbrite.com/e/rb-and-ribs-sf-halloween-tickets-2001891472283?aff=ebdssbneighborhoodbrowse , capture `cmvp2nlj33a65c9`.
- https://www.eventbrite.com/e/fairmont-hotel-san-francisco-mega-halloween-party-tickets-1998382597143?aff=ebdssbneighborhoodbrowse , independent third-input capture `cmvp2oggr83686e`.

`listFeaturedEvents(city)` learned from San Francisco and New York, then replayed Los Angeles at tier 1. All four ordered event identities and all six fields matched its frontend capture after collapsing HTML display whitespace. `getEvent(slug)` learned from the first two event slugs above, then replayed the Fairmont slug at tier 1. All ten returned fields, including identity, dates, address, and offers, matched its independent frontend document exactly. Public checks cover the second and third inputs for each operation. The six example/check cases passed at tier 1 using the real `verifySite` harness with `maxTier: 1`.

Each exported operation also replayed its third input at tier 1 in its own initially empty home, without cookies or session refs. Export used the CLI with public examples retained. Direct `vetShared` with these notes returned zero errors and warnings. Shared registry checks are left to the coordinator.

A broader JSON-LD city listing was discarded: its online-event recommendations changed with client locale, so 28 of 32 Los Angeles identities matched while four differed. The exported recipe reads only the first desktop featured shelf. It does not claim the broader listing was reproduced.
