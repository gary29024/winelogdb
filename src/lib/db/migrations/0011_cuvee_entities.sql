CREATE TABLE IF NOT EXISTS cuvees (
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  signature_key TEXT NOT NULL,
  appellation TEXT,
  wine_style TEXT,
  catalog_backed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, producer_id, signature_key)
);

CREATE TABLE IF NOT EXISTS cuvee_aliases (
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  appellation_key TEXT NOT NULL DEFAULT '',
  cuvee_id TEXT NOT NULL,
  display_alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, producer_id, normalized_alias, appellation_key)
);

ALTER TABLE wines ADD COLUMN cuvee_id TEXT;
ALTER TABLE wines ADD COLUMN recognized_wine_name TEXT;

UPDATE wines
SET recognized_wine_name=wine_name
WHERE recognized_wine_name IS NULL AND trim(wine_name)<>'';

CREATE INDEX IF NOT EXISTS idx_cuvees_owner_producer
  ON cuvees(owner_id, producer_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_cuvee_aliases_entity
  ON cuvee_aliases(owner_id, producer_id, cuvee_id);
CREATE INDEX IF NOT EXISTS idx_wines_owner_cuvee
  ON wines(owner_id, cuvee_id);
