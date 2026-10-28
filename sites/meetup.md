Use the namespace and event ID together from a public Meetup event URL. Returns one event summary. The start includes its UTC offset; schedule is the page's local-time wording. This reads the advertised schedule, without confirming the event will happen. No search, attendance, cancellation status, recurrence expansion, organizer, location or contact data.

## Maintainer notes

Checked signed out on 2026-10-26 with genuine exact-document captures, public examples and tier-1 replay. Inline scripts may run while other requests are aborted; this does not prove a fully hydrated GUI. Official Meetup GraphQL also exposes event data with authenticated access; this operation covers the anonymous page summary only. See docs/research/discovery/community-broad-r6.md for provenance, exact arguments and qualification receipts.
