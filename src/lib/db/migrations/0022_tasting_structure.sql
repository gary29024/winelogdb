CREATE TABLE IF NOT EXISTS wine_tasting_structures (
  owner_id TEXT NOT NULL,
  wine_id TEXT NOT NULL,
  structure_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, wine_id)
);

CREATE INDEX IF NOT EXISTS idx_wine_tasting_structures_wine
  ON wine_tasting_structures(owner_id, wine_id);
