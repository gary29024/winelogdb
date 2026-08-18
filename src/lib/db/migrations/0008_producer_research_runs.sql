CREATE TABLE IF NOT EXISTS producer_research_runs (
  owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  PRIMARY KEY (owner_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_producer_research_runs_producer
  ON producer_research_runs(owner_id, producer_id, updated_at DESC);
