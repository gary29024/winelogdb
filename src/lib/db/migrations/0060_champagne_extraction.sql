CREATE TABLE wine_champagne_extractions (
  owner_id TEXT NOT NULL,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('queued','running','submitted','complete','failed')),
  request_key TEXT NOT NULL,
  image_ids_json TEXT NOT NULL,
  batch_name TEXT,
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,wine_id)
);
