# UNIQLO discovery qualification r1

Status: **BLOCKED**, zero new operations. The first source-grounded category document
was an Akamai behavioral challenge. No alternate route, transport, second capture,
unseen call, cold operation call or live verification followed. The existing
`getProduct` operation and its three cases remain byte-for-byte unchanged in the
saved JSON. Its earlier qualification is historical evidence, not a fresh pass.

The worker ran on 2026-10-28 UTC under the exclusive
`uniqlo-discovery-qualified-r1-20261028` claim, deadline 08:49:44.257162 UTC.
The first retained start receipt is 08:30:51.334121 UTC. Capture completed at
08:31:55.917 UTC, the persistent stop was written at 08:31:56.006 UTC, and the
final offline vet and cleanup audit ran at 08:33:38 UTC. This attempt stayed
within the twenty-minute bound. No memory lookup, CPU/memory snapshot, resource
wrapper, recovery pair, resource wait, nested delegation or watcher was used.

## Scope and source grounding

Read the discovery runbook, current focus and exclusive claim, full host-stop and
alias ledger, previous outcomes, authoritative design, contribution rules, repo
api-anything skill, existing UNIQLO JSON/notes and the previous finalize-r2 report.
Before the sole request, the retained state snapshot covered 134 host stops,
134 aliases and 262 previous outcomes. No UNIQLO or Fast Retailing stop matched.
JustWatch and all other brands remained untouched. State and shared checks belong
to the parent and were not edited or run here.

The intended workflow was Denmark English category discovery feeding the existing
product route operation, with distinct child-category navigation allowed if the
actual documents supported it. No category ID, route, query or endpoint was guessed.
The literal breadcrumb `T-Shirts, Sweats & Fleece` in the retained product document
linked to `/dk/en/men/tops`; `T-Shirts` linked to `/dk/en/men/tops/t-shirts`.
Only the first of these was requested. Those links are grounding, not qualified
catalog or child-category operations.

Both genuine old raw capture files were hashed before extracting their links:

- `home-apparel-qualified-r1/uniqlo-home/captures/cmvp5inuvb11ebe.json`:
  `d248202e8176eb566289573fd1e7f3cc249052e617558a73d93eaa30ef586370`.
- `home-apparel-qualified-r1/uniqlo-home/captures/cmvp5j75n11a298.json`:
  `d942e1fd4e2ce75300eb6b2d309cd2f14457714bcbc42ae245d74ca7145df30b`.

These matched the hashes in `uniqlo-finalize-r2.md`. They remain genuine frontend
captures, not exchanges reconstructed from HTTP source reads. Their product examples
were not reused as unseen content holdouts. All paths above are relative to
`bench/explore/state/discovery/`.

## Sole request and access stop

Exact GET and source page: `https://www.uniqlo.com/dk/en/men/tops`.
New frontend capture `cmvruvojxf24683`, embedded capture timestamp
`2026-10-28T08:31:55.917Z`, document exchange 1, HTTP 200, final URL unchanged.
There were three recorded exchanges: the document succeeded and both scripts were
aborted. The unchanged `capture-document.mjs` used an absolute isolated home,
exact GET interception and a fifteen-second request timeout. Inline scripts could
execute. This does not prove a fully hydrated GUI.

The response was 2,741 bytes and contained `sec-if-cpt-container`,
`scf-akamai-logo-sec-abc`, `Powered and protected by`, an Akamai logo, challenge
scripts and an `/akam/13/pixel_` noscript marker. It contained no title or useful
category data. This is a concrete challenge, not merely an unsupported catalog
extraction or a proved account-login requirement.

The helper receipt said `ok: true`: its HTTP status and existing `botWall` check
missed this HTTP 200 challenge shape. A separate real core `judge` over a generic
document title recipe returned `drift`, `missing: true`, because the title field
was absent. The wrapper immediately persisted `STOP.json` for that non-ok judgment,
before another qualification send could occur. Raw offline inspection then marked
the response `blocked` and documented the Akamai evidence in the same receipt.
No source/helper change was made. Parent should retain a UNIQLO consumer-brand
stop across aliases, subdomains, routes and transports; no automatic retry.

Capture SHA-256:
`0c0cbf0045fefac96026d887bb2b3a73a57cf7c4d5f48f268ac3a61b0a92a401`.
Document-body SHA-256:
`6882a1c89ef4925867959bec07a3c88065a25c8e62db12c0efb8d95abcf90287`.
Raw challenge bytes and challenge-cookie material remain only in ignored evidence.

A subsequent local control invoked the private wrapper with the stop already
present. It threw `persistent stop` before acquiring a browser lock or spawning
capture. No new capture receipt was created. This proves a local guard refusal;
it is not a second frontend response or a mock success counted toward qualification.

## Operation count, headers and missing gates

The saved export still contains exactly one operation and three public cases:

- `getProduct(E489013-000, 00)`, the original example.
- `getProduct(E422992-000, 02)`, original check 1.
- `getProduct(E465185-000, 00)`, original check 2.

No new argument effect or returned discovery field is claimed. No paired A/B
learning, warning-free learner result, new candidate export, genuinely unseen
identity/meaning/order comparison, discovery-to-detail handoff, initially empty
final-export operation call, all-read re-verification or new public-example export
was completed. These gates were stopped by the challenge, not waived. The existing
export already retains all three public examples/cases and was not regenerated.
No price, variant, stock, delivery, search, country expansion or source-map coverage
was added. Every-field unseen comparison is unavailable because no new operation
returned discovery fields.

The captured document request headers contain neither Cookie nor Authorization.
The isolated browser then held six site-issued challenge/guest cookie names:
`_abck`, `ak_bmsc`, `bm_s`, `bm_sc`, `bm_so`, `bm_sz`, all for `.uniqlo.com`.
No cookie values appear in this report or notes, no private profile was imported,
and these cookies were not used for a later send. This is the first browser-document
header audit, not the required cold call of a final new-operation export.

## Saved files and offline checks

Only `sites/uniqlo.md`, this report and this worker's ignored evidence were written.
The notes now distinguish the historical product pass from the current category
stop. Caller notes are 1,286 UTF-16 code units before the exact
`## Maintainer notes` heading.

At `2026-10-28T08:33:38.255Z`, `SiteSchema.parse` and direct `vetShared` over the exact
saved JSON plus final notes returned zero errors and zero warnings. This offline
vet proves shared-spec rules only. It does not replace the missing live gates or
the parent's integrated registry/lint/types checks.

Exact saved JSON SHA-256, unchanged:
`d9ec5eebc3e6e5772b9429abc83c5b5d98b4ee23d02872d49aa57c3e4382d8ad`.
Exact final notes SHA-256:
`7f55b0b0f45d21a02421b663ae065375c75906286ecbf3837b9f910b71acd335`.
Schema-parsed exported `getProduct` operation hash: `99a1d981f127010f`;
full SHA-256 of that operation's JSON serialization:
`99a1d981f127010fe350177bd8e286965043351be78c3b8c076a6ee4aafdb445`.
This exported hash is not the old local captured-template verification hash.

All eight frozen publication files and their approved manifest match the initial
byte hashes. `preservation.json` contains the exact per-file results. No source,
dependency, existing helper, shared state, commit, push, PR, publication, website
write or private cookie access occurred. An initial offline navigation-inspection
command attempted to import unavailable `cheerio`; it sent nothing. Inspection
used Python's existing standard-library HTML parser afterward, without installing
anything. That failure is not frontend evidence.

## Receipts and owned cleanup

Ignored evidence root:
`bench/explore/state/discovery/uniqlo-discovery-qualified-r1-20261028/`.
`manifest.json` pins the final files and receipts. Important receipts are
`baseline.json`, `start.json`, `stop-screen.json`, `stop-screen-summary.json`,
`retained-navigation.json`, `category-a-exit.json`, `category-a-judgment.json`,
`STOP.json`, `capture-header-audit.json`, `local-stop-control.json`,
`vet-final.json`, `preservation.json`, `processes.jsonl` and `cleanup.json`.
Schemas and field names were inspected before asserting results.

The capture wrapper PID was 44404, helper PID 44406, exec session ID 15386.
The helper PID and session ID were recorded while it ran. The wrapper acquired the
atomic global `browser.lock`, wrote its owner token and removed only its own lock
in `finally` after the helper exited. The helper calls its existing `closeBrowser`
in `finally`. The cleanup audit found no process whose command referenced this
worker's isolated browser profile and no global browser mutex. Browser child PIDs
were not exposed by the unchanged helper and were not individually recorded;
cleanup evidence is its completed helper plus the exact-profile process census.
No process was killed and no unrelated program was stopped. The private evidence
and isolated profile were retained. Return control to the parent with the brand
stop and zero additions.
