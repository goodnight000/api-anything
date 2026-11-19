-- Sites by domain: a domain's site names on upload and demand's "nobody shared it" anti-join read sites by
-- domain, which otherwise scans the whole table. Not unique: one domain may carry several names.
CREATE INDEX sites_domain ON sites (domain);
