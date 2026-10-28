# Workday and iCIMS public job source preparation

Coordinator adjudication: iCIMS's observed 403 remains a stop. Workday's two zero-line
extractions establish a remote text-extraction limit; the report exposes no auth response,
challenge, 403/429 or error on the public hosted catalog/detail. Remote preparation ended,
but empty extracted text alone does not establish an access-control stop. The exact
first-party-linked Workday catalog may receive normal isolated-browser source inspection
after fresh CPU<65% / memory<88% admission. It has no understood document recipe and cannot
use the 89% document-only exception. Use the same grounded public tenant, preserve its
scope, and stop immediately if a real control or repeated browser error appears. No local
Workday request or browser inspection has yet occurred; all qualification gates below remain.

2026-10-26 UTC, `job-platforms-source-prep-r1`. **BLOCKED** for complete source
preparation. iCIMS returned a remote 403; Workday's hosted catalog and detail yielded
no readable text. Both were stopped. No reusable operation or frontend capture exists.

Only `mcp__codex_apps__search_service_web_run` accessed websites remotely. Local work
was inexpensive file reading and this report. No local browser/network, API replay,
login, cookie import, site write, nested agent, source/dependency edit or publication
ran. The parent's 12:27:50 UTC snapshot admitted lightweight work at CPU 15.14% and
policy memory 88.18%; this was not browser admission or continuous resource proof.
AGENTS.md, the discovery runbook, current coordinator state and the property/jobs and
maps/jobs reports were read. No earlier Workday/iCIMS attempt was found in the targeted
report search; current state records this worker's claim. Shared state was not edited.

## Evidence meanings

All sources below were consulted remotely on 2026-10-26, approximately 12:28–12:30 UTC.
“Fetched primary” means the tool opened a first-party page and returned extracted text;
it may use cached material and does not prove a fresh origin status or browser behavior.
“Indexed lead” means search output only, even when the URL belongs to the employer.
No third-party scraper, package or endpoint template was used as frontend evidence.

## Official access screen

**iCIMS, fetched primary.** [How do I make a call?](https://developer-community.icims.com/faq/how-do-i-make-call)
states that authentication must first be established with iCIMS and credentials supplied
for inbound access. [Job Portal API](https://developer-community.icims.com/applications/applicant-tracking/job-portal)
describes vendor integration with portal listings and demonstrates authenticated
requests. Its sample jobs are documentation fixtures, not current employer examples.
This is an official supported integration, but not evidence of a readily usable
anonymous job API. No API or test console was invoked and no credentials were sought.

**Workday, indexed official documentation.** [Workday REST APIs](https://developer.workday.com/documentation/GUID-86d66a6b-5d1a-40e4-af1b-ba4859f5df5a-enHYPHENus/WorkdayRESTAPIs)
describes Extend/integration transactions and links authentication/security guidance.
[Agent-Ready MCP Tools](https://developer.workday.com/documentation/GUID-949559e7-10c3-438a-abb2-e452c23d9da8-enHYPHENus/AgentReadyMCPTools)
search output states ASOR registration, granted tool access and OAuth 2.1 PKCE/ASU
security. It does not establish an anonymous employer-job equivalent.

Opening those documentation pages returned a JavaScript shell with an explicit link
to the public [documentation index](https://developer.workday.com/llms.txt). That index
was fetched and distinguished public documentation from account-required tooling. Its
linked [REST API authentication document](https://developer.workday.com/doc/GUID-6c598444-ce67-40d5-bd95-267ecfe439b8-enHYPHENus.md)
was inaccessible through this tool. No alternate documentation transport was tried.
REST authentication details therefore remain unverified here; MCP access conditions
above are indexed evidence. This bounded screen did not establish that no anonymous
official job API exists anywhere.

Public career-page discovery remains useful if no easy supported anonymous equivalent
is established: it can expose the employer's displayed jobs and their metadata without
entering an employer/recruiter integration. That is an inference about value, not proof
of browser accessibility or permission to access private systems.

## Workday employer candidate

Employer and tenant scope is **Workday itself only**.

Fetched primary [Workday careers](https://www.workday.com/en-us/company/careers/overview.html)
exposed the actual “Job Search”/“Explore Roles” link to
https://workday.wd5.myworkdayjobs.com/Workday/?source=Careers_Website . Following that
link returned a text/html result with zero extracted lines, not a usable catalog.
Generic account-navigation text on the corporate page does not establish signed-out
state or an authenticated session. No account action was taken.

One exact **indexed lead**, not a readable fetched detail, was available:

- https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/Account-Executive---Customer-Base-Major-Accounts_JR-0107547
  identifies Account Executive - Customer Base Major Accounts, requisition JR-0107547.
  The index showed multiple US locations, Flex, Full Time and a relative posting label.
  Opening this exact URL also returned zero extracted lines. These metadata were not
  independently verified. A relative label must not become an invented calendar date.

After the repeated empty extraction, Workday research stopped. No different employer,
host, endpoint, query encoding or transport was tried to obtain the missing content.
Two usable differing examples and a linked held-out third are **missing**.

## iCIMS employer leads and stop

Employer scope is **iCIMS itself only**. Before the stop, official search results
identified https://careers.icims.com/careers-home/jobs and displayed keyword/location
search plus employment-type/category filters. These are indexed leads, not fetched
current frontend behavior. Exact indexed detail URLs included:

| Proposed role | Indexed source URL | Metadata lead |
| --- | --- | --- |
| Example 1 | https://careers.icims.com/careers-home/jobs/6585 | Lead, Quality Engineer; Holmdel, New Jersey; Full Time; Remote |
| Example 2 | https://careers.icims.com/careers-home/jobs/6460?lang=en-gb | Principal Data Engineer; Rai Durg, Hyderabad, India; Full Time; Hybrid |
| Potential held-out | https://careers.icims.com/benefits/jobs/6384?lang=en-gb | Engineer, Quality; Rai Durg, Hyderabad, India; Full Time; Hybrid |

The different path prefix on the third URL was returned by search, not constructed.
Its relationship to a canonical detail/application URL and catalog navigation is
unverified. None is a linked, captured held-out example.

The first catalog open exposed **403 Forbidden** for
https://careers.icims.com/careers-home/jobs . iCIMS research stopped immediately after
that response. No detail was opened, no further iCIMS query ran, and no alternate
employer, route or transport was used. The response does not establish whether the
origin or remote retrieval system imposed the restriction. Keep the platform stopped;
do not retry it on a routine resource-admission tick.

## Proposed metadata contract and continuation

Unimplemented questions are “Which jobs match a public keyword/location selection?”
and “What metadata identifies this displayed job?” Prospective output is employer,
job/requisition identity, title, displayed locations, employment type, work arrangement,
displayed posting/closing dates when present, and the exact canonical application-page
link. Do not equate work arrangement with employment type, choose one location from a
multi-location role, infer a closing date from open-ended wording, or treat a job detail
URL as the canonical application URL without evidence. No descriptions need copying.

For Workday, retain the first-party careers-to-catalog link as the grounded continuation
page, but classify remote extraction as blocked. A changed condition and the parent's
admission/stop decision are needed before further access. For iCIMS, retain index-only
leads as stopped historical evidence; no automatic local-browser continuation is justified.

Missing for both: readable current frontend examples, actual frontend captures, two-example
learning, a linked unseen third with independent semantic/identity comparison, tier-1
replay, verify, export, empty-home cookie-free reuse, vetShared and integrated registry
checks. Query encodings, request methods, response schemas, pagination, date semantics
and canonical application links remain unproved. No sites/ file should be generated
from this report. Tenant evidence must never become a universal platform claim.

Only public job metadata is in scope. Applicant/recruiter records, resumes, accounts,
saved jobs, applications, uploads, messages and every write remain excluded. Parent
owns catalog/state integration and any later local validation. No raw evidence files
were saved.
