-- The registry's own clean replay of a version held for review only because its uploader's client ran
-- none (registry/src/replay.ts): the attempts made, when the last one was, and what it met: a class, `ok`,
-- or `unreplayable` for a version no replay can run on (no example, no plain GET, another reason the
-- rules now give), which is never tried again and counts as no attempt.
ALTER TABLE versions ADD COLUMN replays INTEGER NOT NULL DEFAULT 0;
ALTER TABLE versions ADD COLUMN replayed_at TEXT;
ALTER TABLE versions ADD COLUMN replay_outcome TEXT;
-- the queue, read every minute: review versions by their reasons
CREATE INDEX versions_review_reasons ON versions (reasons, replays, created_at) WHERE status = 'review';
