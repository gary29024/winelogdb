CREATE TABLE IF NOT EXISTS achievement_custom_collections (
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('manual','catalogue')),
  items_json TEXT NOT NULL DEFAULT '[]',
  rule_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id,id)
);

CREATE INDEX IF NOT EXISTS achievement_custom_collections_owner_updated_idx
  ON achievement_custom_collections(owner_id,updated_at DESC);
