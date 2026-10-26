No account is needed. Searches UK place names, postcode areas and stations. Returns at most ten
suggestions and excludes streets. Select by both the displayed place and its type; similarly
named places can appear together.

The location identifier is meaningful together with its type. For property searches, Rightmove
combines them as `TYPE^id`, for example `REGION^116` for Bath. Property search and detail
operations are not included yet.

## Maintainer notes

Verified signed out on 2026-10-26 UTC with a fresh isolated browser profile. Learned from real
homepage typeahead captures for Cambridge and Oxford, using
`GET https://los.rightmove.co.uk/typeahead?query=...&limit=10&exclude=STREET`.
The parameter followed both inputs. The matcher pins method, host and path only.

An unseen `location=Bath` call returned Bath, Somerset, region 116 over tier 1 in 579 ms,
distinct from Cambridge region 274 and Oxford region 1036. Verification passed all three
cases over plain HTTP: Cambridge returned results, Bath returned results, and the nonsense
place `zzqxwyvpr` returned an empty list. The recorded checks assert result versus empty;
the place names and identifiers were also inspected manually in the discovery run.

The exported spec also replayed `location=Bristol` from a separate fresh home with no captured
or imported cookies. It returned Bristol region 219 at tier 1 in 332 ms.

Healing opens the homepage, waits five seconds for hydration, fills the public for-sale
search input, and waits two seconds. An initial capture filled too early and produced no
typeahead request. No user browser cookies were imported and no site writes were selected.

Capture and replay evidence is recorded in
[the discovery report](../docs/research/discovery/property-jobs.md). Raw exchanges remain local
and are not included in this shared spec. Coverage is location suggestions only, with the
captured limit and exclusions fixed. No nationwide property listings or current property
prices are supplied by this operation.
