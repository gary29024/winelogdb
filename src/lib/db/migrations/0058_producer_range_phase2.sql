-- Phase 2 producer range research separates the machine-researched base from
-- durable user corrections. The visible catalog_json remains the one read by
-- all existing screens, while catalog_researched_json can be replaced safely
-- without losing a wine the owner explicitly added.
ALTER TABLE producers ADD COLUMN catalog_researched_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE producers ADD COLUMN catalog_sources_json TEXT NOT NULL DEFAULT '[]';

UPDATE producers
SET catalog_researched_json=CASE WHEN json_valid(catalog_json) THEN catalog_json ELSE '[]' END;

CREATE TABLE producer_catalog_manual_entries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  appellation TEXT,
  classification TEXT,
  style TEXT,
  notes TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id,producer_id,entry_key),
  FOREIGN KEY(owner_id,producer_id) REFERENCES producers(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_producer_catalog_manual_owner_producer
  ON producer_catalog_manual_entries(owner_id,producer_id,created_at);

-- A cheap direct-source pass can discover useful wines while still being too
-- incomplete to replace the whole catalogue. Keep those as suggestions instead
-- of throwing the evidence away or silently inserting it.
CREATE TABLE producer_catalog_missing_candidates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  candidate_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  appellation TEXT,
  classification TEXT,
  style TEXT,
  notes TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','ignored','added')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(owner_id,producer_id,candidate_key),
  FOREIGN KEY(owner_id,producer_id) REFERENCES producers(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_producer_catalog_missing_owner_status
  ON producer_catalog_missing_candidates(owner_id,producer_id,status,last_seen_at DESC);
