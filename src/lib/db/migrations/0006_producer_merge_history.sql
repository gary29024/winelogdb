CREATE TABLE IF NOT EXISTS producer_research_history (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  origin_producer_id TEXT NOT NULL,
  origin_name TEXT NOT NULL,
  research_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  researched_at TEXT,
  archived_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_producer_research_history_entity
  ON producer_research_history(owner_id, producer_id, researched_at DESC);
