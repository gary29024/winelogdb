-- Bulk external catalogues live in versioned R2 shards so a 200k+ snapshot
-- refresh does not consume the Workers Free D1 100k-row daily write allowance.
-- D1 only records one small operational sync marker plus IDs matched to user wines.
CREATE TABLE IF NOT EXISTS wine_reference_sync_state (
  source TEXT PRIMARY KEY,
  source_version TEXT,
  source_hash TEXT,
  source_updated_at TEXT,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_redirected INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0,
  rows_unresolved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE wines ADD COLUMN recognized_producer TEXT;
ALTER TABLE wines ADD COLUMN recognized_vintage_text TEXT;
ALTER TABLE wines ADD COLUMN vintage_kind TEXT CHECK(vintage_kind IN ('vintage','non_vintage','multi_vintage','unknown'));
ALTER TABLE wines ADD COLUMN release_designation TEXT;
ALTER TABLE wines ADD COLUMN colour TEXT;
ALTER TABLE wines ADD COLUMN product_type TEXT;
ALTER TABLE wines ADD COLUMN product_subtype TEXT;
ALTER TABLE wines ADD COLUMN reference_product_key TEXT;
ALTER TABLE wines ADD COLUMN lwin7 TEXT;
ALTER TABLE wines ADD COLUMN lwin11 TEXT;
ALTER TABLE wines ADD COLUMN elid TEXT;
ALTER TABLE wines ADD COLUMN identity_match_status TEXT CHECK(identity_match_status IN ('matched','suggested','ambiguous','unmatched','manual','conflict'));
ALTER TABLE wines ADD COLUMN identity_match_confidence REAL CHECK(identity_match_confidence IS NULL OR (identity_match_confidence>=0 AND identity_match_confidence<=1));
ALTER TABLE wines ADD COLUMN identity_matched_at TEXT;

UPDATE wines SET recognized_producer=producer
WHERE recognized_producer IS NULL AND trim(coalesce(producer,''))<>'';
UPDATE wines SET vintage_kind=CASE WHEN vintage IS NULL THEN 'unknown' ELSE 'vintage' END
WHERE vintage_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_wines_owner_lwin7 ON wines(owner_id,lwin7);
CREATE INDEX IF NOT EXISTS idx_wines_owner_elid ON wines(owner_id,elid);
CREATE INDEX IF NOT EXISTS idx_wines_owner_reference_product ON wines(owner_id,reference_product_key);
