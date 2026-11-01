-- Calls reported each UTC day, by outcome, for the public stats (GET /v1/stats): `reports` keeps only each
-- install's latest outcome per version, so it cannot count calls. Counts only: no key, no network.
CREATE TABLE calls (
  day TEXT NOT NULL,
  outcome TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (day, outcome)
);

-- the installs that reported lately, counted for the public stats
CREATE INDEX reports_at ON reports (at);
