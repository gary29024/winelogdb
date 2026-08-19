CREATE TABLE IF NOT EXISTS cuvee_catalog_links (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  source_cuvee_id TEXT NOT NULL,
  catalog_cuvee_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  unlinked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cuvee_catalog_links_active_source
  ON cuvee_catalog_links(owner_id, source_cuvee_id)
  WHERE unlinked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cuvee_catalog_links_active_catalog
  ON cuvee_catalog_links(owner_id, producer_id, catalog_cuvee_id)
  WHERE unlinked_at IS NULL;
