-- Global wine-reference identity. Reference data has no owner_id: one LWIN/ELID
-- catalogue is shared by every account while journal rows remain tenant scoped.
CREATE TABLE IF NOT EXISTS wine_reference_products (
  product_key TEXT PRIMARY KEY,
  lwin7 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('Live','Combined','Deleted')),
  reference_lwin7 TEXT,
  display_name TEXT NOT NULL,
  producer_title TEXT,
  producer_name TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  wine_key TEXT NOT NULL,
  country TEXT,
  country_key TEXT NOT NULL DEFAULT '',
  region TEXT,
  region_key TEXT NOT NULL DEFAULT '',
  sub_region TEXT,
  site TEXT,
  parcel TEXT,
  colour TEXT,
  colour_key TEXT NOT NULL DEFAULT '',
  product_type TEXT,
  product_subtype TEXT,
  designation TEXT,
  classification TEXT,
  vintage_config TEXT,
  first_vintage INTEGER,
  final_vintage INTEGER,
  source_added_at TEXT,
  source_updated_at TEXT,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wine_reference_identity
  ON wine_reference_products(status,producer_key,wine_key,country_key,region_key,colour_key);
CREATE INDEX IF NOT EXISTS idx_wine_reference_redirect
  ON wine_reference_products(reference_lwin7);
CREATE INDEX IF NOT EXISTS idx_wine_reference_updated
  ON wine_reference_products(source_updated_at);

CREATE TABLE IF NOT EXISTS wine_reference_external_ids (
  provider TEXT NOT NULL CHECK(provider IN ('lwin7','lwin11','elid')),
  external_id TEXT NOT NULL,
  product_key TEXT NOT NULL REFERENCES wine_reference_products(product_key) ON DELETE CASCADE,
  vintage_code TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(provider,external_id)
);
CREATE INDEX IF NOT EXISTS idx_wine_reference_external_product
  ON wine_reference_external_ids(provider,product_key,vintage_code);

CREATE TABLE IF NOT EXISTS wine_reference_sync_state (
  source TEXT PRIMARY KEY,
  source_version TEXT,
  source_hash TEXT,
  source_updated_at TEXT,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_redirected INTEGER NOT NULL DEFAULT 0,
  rows_rejected INTEGER NOT NULL DEFAULT 0,
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
