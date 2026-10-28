# Workday employer careers metadata

`getJob(job)` reads a public job on Workday's own employer careers tenant at `workday.wd5.myworkdayjobs.com`. This spec covers that employer only. Other employers using Workday have different tenants and are not supported by this operation.

Copy the complete last job segment, including its `JR-` requisition suffix, from a public Workday employer job link. Example: `Technical-Consultant_JR-0110821`. A historical slug need not match the current displayed title.

The result contains displayed `title`, primary `location`, optional `additionalLocations`, frontend `timeType` and `remoteType` labels, `jobReqId`, `jobPostingId` and `externalUrl`. Additional locations may be absent. Labels are preserved as supplied; `Flex` is not a guarantee of fully remote work, and `Full Time` is not inferred from schema.org employmentType. The public listing does not prove the position remains open or that an application will be accepted. This operation does not search jobs, paginate a catalog, apply, upload files, access accounts or return the full job description.

## Maintainer notes

Qualified signed out on 2026-10-26 UTC. Two genuine frontend captures, `cmvpad1mq` and `cmvpadmig`, supplied the actual public CXS detail requests. Learning examples were the Warsaw technical-support manager role, requisition `JR-0110529`, and the London channel/reseller sales director role, requisition `JR-0110793`. They differ in title, location and requisition. Current saved verification examples are `Technical-Consultant_JR-0110821`, `Web-Designer_JR-0110973` and `Digital-Project-Consultant_JR-0110941`, all linked by the genuine public catalog capture.

Held-out `Technical-Consultant_JR-0110821` returned Integration Consultant in Hong Kong. Ten identity and meaning comparisons matched the independently captured catalog and independently parsed public detail document. Public detail URL: `https://workday.wd5.myworkdayjobs.com/Workday/job/Hong-Kong/Technical-Consultant_JR-0110821`. Current-version verification passed all three cases at tier 1. Public-example export, fresh reuse from an initially empty home and final JSON-plus-notes shared vetting passed. The first requests from the verification and reuse homes sent no Cookie, Authorization or CSRF header. No private browser session was imported. The spec retains only a cookie reference for the optional captured CSRF header.

Source SEO `employmentType: OTHER` and `jobLocationType: TELECOMMUTE` do not replace the frontend's `timeType: Full Time` and `remoteType: Flex`. Frontend labels ground the returned fields. Authentication status was false in the public catalog, and the learning profile was initially empty with no login/import; anonymous cookies alone are not a signed-in user.

See `docs/research/discovery/workday-qualified-r1.md` and `workday-coordinator-finalize-r2.md` for capture IDs, exact requests, comparisons, qualification receipts and limits. Raw captures, response bodies and session state remain ignored. Third-party routes and field availability may change.
