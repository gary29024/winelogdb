-- A tasting you are at, rather than a name typed onto each wine.
--
-- The tastings table has existed since 0002 and is written on every wine save,
-- but only ever implicitly: resolveTasting find-or-creates a row from the event
-- name and date on the form. Those implicit rows must never be mistaken for a
-- live session, which is why "open" needs started_at as well as ended_at - a
-- nullable ended_at alone would make every historical row, and every row a
-- typed event name creates from now on, read as open.
ALTER TABLE tastings ADD COLUMN started_at TEXT;
ALTER TABLE tastings ADD COLUMN ended_at TEXT;
-- When the last wine joined. Stored rather than derived: idx_wine_experiences_tasting
-- orders by consumed_at, so MAX(created_at) over a tasting would scan.
ALTER TABLE tastings ADD COLUMN last_wine_at TEXT;

-- One open tasting per owner, as an invariant rather than a convention. Also
-- makes "is anything open" a near-empty indexed probe on every app load.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tastings_open_owner
  ON tastings(owner_id) WHERE ended_at IS NULL AND started_at IS NOT NULL;

-- The printed wine list handed out at the tasting. It carries what the parsed
-- wines never will - prices, importer, flight order - so it is kept as a record
-- of the evening whether or not anything is ever read off it. Unlike batch
-- recognition images these have no TTL: they are the artefact, not a working
-- file, and go only when their tasting goes.
CREATE TABLE IF NOT EXISTS tasting_documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  tasting_id TEXT NOT NULL REFERENCES tastings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasting_documents_tasting
  ON tasting_documents(owner_id, tasting_id, created_at ASC);
