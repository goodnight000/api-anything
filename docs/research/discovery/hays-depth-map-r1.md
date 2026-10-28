# Hays UK depth map r1

Research window: 2026-10-27 01:02:52Z to 01:04:38Z for source inspection, followed by this report within the eight-minute bound. SOURCE-ONLY background preparation. No new operation was qualified or counted.

The next useful addition is public job discovery that supplies exact posting links to the existing `getJob(job)`. Keyword/place search, linked profession listings and work-type filtering belong to that same workflow family until evidence establishes a distinct question. A public office directory is a separate useful read. Arbitrary search submission, continuation and filter correctness remain unproved.

## Scope and baseline

Read `bench/discovery/README.md` and the current state before website access, then `sites/hays.json`, `sites/hays.md`, `global-recruiters-source-prep-r1.md` and `hays-qualified-r2.md`. Also read DESIGN, CONTRIBUTING and the repository workflow instructions. Runbook SHA-256 matched the supplied value before and after inspection: `4a52052d2f19d03efda45af808b2db4349e8bf4845e7ba55db046d893a96eeaa`.

The Hays host-stop/alias lookup had no matching stop. Current depth coverage assigned Hays to this task. Other brands were not requested. Parent alone owns state changes.

The saved operation reads selected structured metadata for one exact UK posting route. It cannot discover postings, filter them, browse professions or find offices. Its existing qualification is retained evidence, not rerun here. Initial file hashes were:

- `sites/hays.json`: `c58172f6bfeea59d96a061ea970d9e9f6dc11a3c771f53f87fce89a8d795996e`
- `sites/hays.md`: `6817a0a9e4df609d4eea5f4f3a6c3b898c678f5bd3261147bc4da87d4b23c118`

## Tools and supported-interface screen

Discovered and used `mcp__codex_apps__search_service_web_run` for remote search, source opens and link following. It can retrieve text and follow exposed navigation. It has no documented form-fill/submission capability. No browser was used. Remote extracts do not expose origin headers/status, establish cookie-free origin access, or prove current interactive rendering. Crawl labels ranged from today to several days old; search leads included older results.

The retained official-interface screen covers [Hays app](https://www.hays.co.uk/jobs/hays-app), [recruitment technology](https://www.hays.co.uk/recruitment-services/recruitment-technology) and [corporate partners](https://www.haysplc.com/our-partners). These describe applicant features, employer ATS/VMS services and internal/partner tooling. They do not establish a readily usable anonymous catalogue API, MCP or feed contract. Those pages were not reopened. No API key, approval, subscription or credential requirements can be asserted from that evidence. If an official interface is later documented, establish its entitlement and coverage before duplicating it; no signup or private access is authorized here.

A fresh bounded search used `site:hays.co.uk ("API" OR "RSS" OR "MCP") "jobs" -inurl:job-detail -inurl:job-search`. It did not establish usable official documentation. A separate location-listing search used `site:hays.co.uk/job-search/ "jobs in" "London" "Software"`. Indexed job advertisements mentioning API technology are not access documentation. This is an unresolved interface screen, not an absence finding.

## Public job discovery, priority 1

Useful output would be a bounded list of title, separate public references, broad advertised locality and exact source-provided posting URL. The URL supplies `getJob`'s existing argument without guessing an ID or slug. Include displayed result range/total only as a snapshot. Do not add salary, personal contacts or workplace street addresses.

Observed primary navigation and differing examples:

| Case | Literal source URL and navigation | Observed safe evidence |
|---|---|---|
| A | [IT listing](https://www.hays.co.uk/job-search/it-jobs), followed from the home page's Tech / IT jobs link | Listing heading agrees with IT. First displayed card was Network Security Engineer (Island Enterprise Browser), Knutsford, `JOB_5420774`, `4838546`. Range was 1–10 with a larger displayed total. A posting-link handle was exposed, but its literal href was not returned; no detail was opened or URL invented. |
| B | [Construction listing](https://www.hays.co.uk/job-search/construction-jobs), followed from the home page's Construction jobs link | First displayed card was Senior Construction Manager, Liverpool, `JOB_5413951`, `4826829`. Its heading and first card differ from A. This grounds two public listing pages, not two successful form submissions or formal specialism-filter semantics. |
| Location example | [Software developer in Cambridge](https://www.hays.co.uk/job-search/software-developer-jobs-in-cambridge-uk), reopened from the retained source URL | Heading names Cambridge; first displayed posting was the previously qualified Software Engineer in Oxford, `JOB_5370351`, `4763934`. Location in the route is not proof of strict locality filtering, distance, ranking or freshness. |
| Heldout C | Free-text keyword `marine robotics assurance`, place `Bristol`, with no additional filters initially | Novel proposed input, never submitted, searched for, resolved to a generated URL or used to open a detail. No expected result is invented. Preserve it for a later authorized search qualification. |

The [home page](https://www.hays.co.uk/) exposes keyword/place inputs and distinct tenure choices. Its [job-search page](https://www.hays.co.uk/job-search) exposes a search action and filter entry. Form submission was unavailable in this tool, so no query-string names, request body or trigger template is proposed.

Retained source gives a more precise control inventory without another website request. `bench/explore/state/discovery/hays-qualified-r2/listing-C.html` has form `gtm_search_box`, keyword input `inlineFormInputName` with value `Technology`, place input `inlineFormInputGroupUsername` with an empty value, button `gtm_search_btn`, and filter button `filterOpen`. Input labels/placeholders indicate keyword and place entry; autocomplete, accepted location objects and submission behavior are unknown. Do not convert labels or IDs into request parameters.

That same retained document has sort control `gtm_sort_by`. Its observed options have values `default`, `RELEVANCE_DESC`, `PUBLISHED_DATE_DESC` and `TITLE`. These are actual source option values, not invented enums. No sort change was exercised, so request mapping and ordering correctness remain missing. The visible filter groups distinguish tenure, working pattern, distance and industry; pay controls exist but pay output is excluded. Their labels alone do not prove usable filter values, combinations or limits.

For the eventual search-to-detail chain, existing receipts already ground two exact links without reopening details:

- A from the general job listing: `https://www.hays.co.uk/job-detail/senior-quantity-surveyor--derbyshire_4840331?jobSource=HaysGCJ`.
- B from the Cambridge-named listing: `https://www.hays.co.uk/job-detail/software-engineer-(aws-python-c-c-cfd-fea)-oxford_4763934?jobSource=HaysGCJ`.

See `global-recruiters-source-prep-r1.md` for original navigation and the encoded-parenthesis redirect, and `hays-qualified-r2.md` for actual captured literal spelling. These are reused link/identity evidence. They do not prove new search requests. The old heldout Business Technology Lead was already consumed by r2 and is not a new C.

### SSR and continuation limits

The retained technology listing body has SHA-256 `6d7f4d165d9ad026aa8bda0354610c497d6ed92399739dea9c6b3677db9abc7e`. Its Angular `serverApp-state` contains nested result data and exact posting URLs associated with safe card metadata. A source-only re-read confirmed this association for multiple jobs. Job cards are buttons; those native navigation values must not be described as literal anchor hrefs. In particular, they are not fixed-ID heldouts grounded by actual hrefs under this assignment's rule.

This supports an SSR document candidate for initial results. It does not prove that arbitrary queries, filters, sorting or subsequent pages work without interactive requests. Remote listings also repeat cards, so extraction must avoid duplicated responsive markup and the selected-detail panel. No endpoint observed inside transfer state was called, reproduced or turned into a template.

No actionable next-page anchor/button was established. The retained body had no `pagination`, `next page` or `load more` marker; that bounded inspection is not proof that the live UI lacks continuation. A state key containing a page token is not UI-supported continuation. Do not invent a page parameter, token, page size or catalogue-completeness claim. Missing gates include real UI navigation for next/previous, identity changes between pages, duplicate handling and termination.

## Profession, place and tenure navigation

These are useful ways into job discovery, not separate field-only wrappers around the same answer.

- [Professions hub](https://www.hays.co.uk/jobs), reached through the home page's all-professions link, exposes profession links and links for remote/hybrid work and contract/permanent/temporary tenure. The IT/construction A/B above establish differing linked listings. Preserve novel query C for the search family. No arbitrary profession enum or taxonomy ID is proposed.
- [Location hub](https://www.hays.co.uk/jobs/local-jobs), followed from that hub, exposes actual city/region link labels including London, Manchester and Cambridge. Their raw targets were not resolved here; no city route was synthesized. The retained Cambridge listing remains the grounded location example, not evidence that every hub link behaves identically. A second location submission and a location-specific heldout remain qualification gaps.
- The actual Contract Jobs link resolved to `https://www.hays.co.uk/job-search?jobType=2`, but its fetch timed out. The actual Perm Jobs link resolved to `https://www.hays.co.uk/job-search?jobType=0` and returned listing text. These are two observed navigation destinations, not a learned enum or a successful filter A/B pair. No temporary value was inferred.

The Perm response showed a tenure chip together with an unexpected pay-range chip. Do not attribute the returned set solely to the tenure query. Its selected Accounts Clerk listing separated permanent tenure from a part-time/flexible working pattern. Keep tenure and working pattern separate in any future interface; FULL_TIME from `getJob` never establishes permanence. No filter-qualified result, live vacancy status or clean-session state is established.

## Public office directory, priority 2

[Find Us](https://www.hays.co.uk/contact/offices-near-me) was followed from the home page. It provides public business office records. A candidate read would return branch label, business address/postcode and source link. That answers where Hays operates, which is distinct from posting metadata. Exclude personal contacts, recruiter names and contact sections. No street address should enter job metadata; business branch addresses belong only to this explicit directory workflow.

Two grounded record examples from the same directory are Cambridge, Office 203, Mantle, 9 Hills Road, CB2 1GE, and Birmingham, 3rd Floor, One Colmore Square, B4 6HQ. Both have map-link controls. Those targets were not followed, so no external map URL, geocode, distance or route is claimed. This is an A/B record pair within one document, not differing request-input proof.

Likely SSR/static-directory candidate: office names and addresses appear directly in the remote document extract. No directory search input was exposed by the text tool. Do not invent a server-side city lookup or claim nearest-office ranking. Prefer a bounded directory read over a guessed parameterized lookup. A no-argument directory has no distinct query C; an untouched third source/link and independent fresh-response check were not secured here. This is an explicit qualification gap, not a fabricated heldout. The reserved job-search query C does not qualify offices.

## Retrieval stop and handoff

The last remote batch, completed by 2026-10-27 01:03:58Z, included the three hub links for contract, permanent and location browsing. Contract returned:

```text
Internal Error ()
Failed to fetch https://www.hays.co.uk/job-search?jobType=2: (400) Timeout fetching
```

This is one remote-tool retrieval failure. Origin HTTP status, headers and cause were not exposed; `(400)` is not established as an origin HTTP 400. No auth, rate, bot or challenge response was observed. Permanent and location responses came from the same already-issued batch, before its failure outcome was inspected. No subsequent Hays website request, alternate alias, route retry or transport switch followed.

Conservative worker stop for parent review: Hays consumer access on `hays.co.uk` and its subdomains, all routes/transports, after this timeout. It is broader than the observed failed URL and is a precaution, not evidence of a brand-wide outage or access-control block. No repeated-error claim is made. Parent must retain the receipt and decide ledger integration; this worker did not change shared state. Do not automatically retry the failed route on the strength of the successful same-batch extracts.

All new candidates still need genuine frontend/document capture, differing A/B parameter proof, safe extraction, credential scan, offline vet preflight, independent meaning checks, untouched C where applicable, admitted tier-1 replay, verification of every read in the exact modified export, initially empty-home first-request proof, final export/notes vet and the parent registry gate. Search additionally needs a real supported submission and pagination/filter proof. Offices need an uncontaminated validation plan. These are future gates, not work performed here.

Only this report was written. No local network commands, browser, captures, learning, replay, export, vet, dependency changes, spec/notes edits, runtime homes, persistent workload processes or locks were created. No nesting, account actions, commits, PRs or publication occurred. Lightweight read-only shell commands completed. Existing Hays JSON and notes remained byte-identical at the final hash check.
