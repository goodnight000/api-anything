-- Other registrable domains a site is known by (docs/REGISTRY.md "Aliases"): search keys only, never a host
-- an op may call. Set by a maintainer's seed or the admin route, never by an upload. A domain is the alias
-- of one site at most.
CREATE TABLE aliases (
  domain TEXT PRIMARY KEY,
  site TEXT NOT NULL REFERENCES sites (name)
);
CREATE INDEX aliases_site ON aliases (site);
