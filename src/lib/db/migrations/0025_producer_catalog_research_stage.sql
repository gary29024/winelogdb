CREATE TABLE IF NOT EXISTS producer_catalog_research_stage (
  owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  slice_key TEXT NOT NULL,
  range_json TEXT NOT NULL DEFAULT '[]',
  sources_json TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, request_id, slice_key)
);

CREATE INDEX IF NOT EXISTS idx_producer_catalog_stage_target
  ON producer_catalog_research_stage(owner_id, producer_id, request_id);

CREATE INDEX IF NOT EXISTS idx_producer_catalog_stage_updated
  ON producer_catalog_research_stage(updated_at);
