# Global recruiters source preparation r1

UTC date: 2026-10-26. Remote-only source preparation, not local qualification. Research began after the supplied 20:08:28.560382Z launch-only snapshot. Website access used only `mcp__codex_apps__search_service_web_run`. No local website traffic, browser, capture, runtime home, resource resample, account action, registry operation or counted operation.

Read `bench/discovery/README.md`, current `state.json`, `docs/DESIGN.md`, `CONTRIBUTING.md`, and `skills/api-anything/SKILL.md`. Before website queries, searched the entire ledger for Hays, Michael Page, punctuation variants and both UK domains. Matches were this assignment, claims and the parent's no-prior-match audit, with no prior stop for either site. Existing stops, including TUI, Makro, Home Depot aliases, Leroy Merlin/ADEO, Bunnings documentation, Screwfix and Rakuten documentation, and parked Takealot were honored. Parent alone updates the ledger.

## Official overlap and access

Screened API, MCP, feeds, consumer apps and recruitment integrations before opening job details. The bounded searches did not establish a readily usable anonymous official API, MCP or feed for either UK posting catalogue. This is unresolved access and coverage, not an API-absence finding. No endpoint was requested or inferred.

Opened primary sources:

- [Hays home](https://www.hays.co.uk/) linked [sitemap](https://www.hays.co.uk/sitemap), [job search](https://www.hays.co.uk/job-search) and [Hays app](https://www.hays.co.uk/jobs/hays-app). The app page advertises job search alongside applications, CV management and timesheets. It discusses account creation when applying. Anonymous app search access was not tested; this is a consumer app, not evidence of an agent-callable interface.
- Sitemap's recruitment-technology link opened [Hays recruitment technology](https://www.hays.co.uk/recruitment-services/recruitment-technology). It describes employer VMS/ATS integration and implementation services. It does not document an anonymous posting-read contract, onboarding entitlement or credential scheme. Do not equate employer integration with applicant catalogue access.
- [Hays corporate partners](https://www.haysplc.com/our-partners), found through search, opened successfully. Its Google/LinkedIn consultant tooling and Twilio-powered WhatsApp alerts concern Hays' own recruitment workflows. They do not establish public access to a Hays jobs API. No messaging service was invoked.
- [Michael Page home](https://www.michaelpage.co.uk/) linked [Technology jobs](https://www.michaelpage.co.uk/jobs/technology). The listing advertises a smart Job Match tool beside a CV-upload link. This is personalized matching requiring applicant data at least at the advertised entry, outside this task. It does not establish anonymous API/MCP/feed access. Employer/client/internal ATS integration access, OAuth, approval and credentials remain unknown. No CV route, assistant or account flow was opened.

These remote HTML/text source opens exposed content. The tool did not expose origin status/headers or prove current browser rendering, cookie-free origin access or live job availability. Some results explicitly carried older crawl labels. No personal/contact/profile data is retained below.

## Hays candidates

Two differing public posting details were opened through actual listing links.

| Candidate | Exact source chain and outcome | Grounded metadata |
|---|---|---|
| A | Home → `/job-search` → posting link 52 → [Senior Quantity Surveyor](https://www.hays.co.uk/job-detail/senior-quantity-surveyor--derbyshire_4840331?jobSource=HaysGCJ). Detail text opened and was inspected. | Public references `JOB_5421845` and `4840331`; Derbyshire; permanent; full-time; construction specialization/industry. Advertised pay text `£70,000 - £80,000`. Preserve currency symbol and text; do not invent pay period. |
| B | Search-index lead → opened [Software Developer jobs in Cambridge](https://www.hays.co.uk/job-search/software-developer-jobs-in-cambridge-uk) → actual posting link 52 → [Software Engineer](https://www.hays.co.uk/job-detail/software-engineer-%28aws-python-c-c-cfd-fea%29-oxford_4763934?jobSource=HaysGCJ). Tool reported a redirect to `https://www.hays.co.uk/job-detail/software-engineer-(aws-python-c-c-cfd-fea)-oxford_4763934?jobSource=HaysGCJ`; detail text opened. | Title includes AWS, Python, C#/C++ and CFD/FEA; references `JOB_5370351` and `4763934`; Oxford; permanent; full-time; software development; technology/internet industry. Advertised pay text `£45000 - £75000 + Package`. |
| Reserved C | Search-index lead → opened [Technology jobs](https://www.hays.co.uk/job-search/technology-jobs), which exposed an actual posting anchor 52 for Business Technology Lead, references `JOB_5416734` and `4831815`, Lisburn. Did not click/fetch its detail. | **Exact raw href unconfirmed.** The remote extract displays an anchor handle without its target URL. This is a distinct candidate label, not a confirmed held-out URL. No URL synthesized from title/reference. |

A exposes labels for employment type, location, working pattern, specialization, industry and pay. B exposes the same field categories and technical role labels. Plausible future output is title, public reference strings, broad location, employment type/pattern, role labels and advertised salary text. Keep references as strings and preserve separate reference forms until their semantics are verified. Exclude recruiter/contact sections and related-course people information.

The Cambridge-named listing showed jobs outside Cambridge and changed between remote extracts. It initially showed a different first posting; a subsequent extract exposed the actual B link above. A lookup for that initial reference returned no text match, not an origin error. Neither path wording nor search snippets prove location filtering, pagination, query semantics or freshness. No filter operation is proposed as qualified. C's listing itself includes descriptive text; its detail remains unrequested.

## Michael Page candidates and stop

Home → Technology jobs → actual link 90 opened [Head of IT Operations](https://www.michaelpage.co.uk/job-detail/head-it-operations/ref/jn-092026-7114178). The tool reported an HTML source with 322 lines. The opened listing supplied City of London, permanent employment and advertised `£70,000 - £80,000 per year`. The detail title and public reference `JN-092026-7114178` were exposed by the successful click outcome. Detail-body fields were not subsequently inspected.

B was actual listing link 92, an IT service-management leadership role in healthcare. The opened listing advertised City of London, temporary employment and `£650 - £800 per day`. Its click returned **`Internal Error ()`**, total lines 1, without exposing a destination URL, origin HTTP status, headers or cause. Do not treat B as an opened posting detail or turn the label into a guessed URL.

Reserved C is actual listing link 91 for the CTO role in SaaS EdTech, North Yorkshire, permanent. Its raw href was hidden and its detail was never fetched. **C URL unconfirmed.** Michael Page has one opened detail, not a grounded A/B pair.

Stop receipt: observed during **2026-10-26T20:09:10Z through 20:10:36Z**, the clock readings bracketing the relevant remote calls. Exact per-call timestamp was not exposed. Failed action was a click of link 92 on `https://www.michaelpage.co.uk/jobs/technology`; failed destination URL is unknown. Evidence layer is remote-tool retrieval failure, not website authentication, bot, robots, rate or origin HTTP failure proof. Conservatively stopped `michaelpage.co.uk` and subdomains across all routes/transports after this first failure, without retry, alternate host/country/copy or further consumer-page controls. No other newly stopped domain. Hays had no observed access-control stop.

## Tool outcomes and limits

Remote searches used the following queries. Indexed hits were leads only; facts above come from the identified opened primary sources.

```text
site:hays.co.uk API MCP job feed integration applicant
site:michaelpage.co.uk API MCP jobs feed integration applicant
site:hays.co.uk ("API" OR "MCP" OR "RSS" OR "feed") -inurl:job-detail -inurl:job-search
site:michaelpage.co.uk ("API" OR "MCP" OR "RSS" OR "feed") -inurl:job-detail -inurl:jobs
site:hays.co.uk recruitment technology integration employers chatbot assistant
site:michaelpage.co.uk chatbot assistant app recruitment integration employers
Hays recruitment official job API RSS feed developer integration portal
Michael Page official job API RSS feed developer integration portal ChatGPT app
site:pagegroup.com "API" recruitment
site:michaelpage.co.uk "app" "jobs" "mobile"
```

Queries returned much irrelevant job-ad content mentioning APIs/AI, which is not official access documentation. Only the primary pages enumerated above were opened. Michael Page navigation stopped at the error. Successful opens/finds/clicks yielded extracted HTML text, not frontend traffic. Hays B was opened by 20:11:06Z. This report was prepared within the eight-minute bound.

All runtime gates are missing: actual frontend/document captures with real exchanges; learned operation and parameter proof using differing A/B examples; safe extraction excluding people/contact data; credential scan; offline `vetShared` preflight; confirmed untouched C href; unseen tier-1 replay with identity/meaning checks; empty fresh-home and first-request Cookie/Authorization absence proof; verification checks on the exact exported version; final export/notes vet; integrated registry test. No reusable spec exists and no operation is counted. HTTP success, advertised dates and relative labels would not prove a posting remains open or a salary remains current.

Next bounded eligible action: retain the Michael Page stop for parent integration. For unstopped Hays, first resolve a distinct actual C href from listing source without fetching its detail, and refine official anonymous read-route coverage/access if primary documentation is available. Only a separately authorized and resource-admitted qualification task may perform local captures and the missing runtime gates. Do not infer a request template from these URLs or remote source text.
