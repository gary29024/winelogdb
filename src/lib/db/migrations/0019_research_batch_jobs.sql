CREATE TABLE IF NOT EXISTS research_batch_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('producer','wine')),
  target_id TEXT NOT NULL,
  google_batch_name TEXT NOT NULL,
  model TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  keys_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id, request_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_research_batch_jobs_request
  ON research_batch_jobs(owner_id, request_id, attempt DESC);

CREATE INDEX IF NOT EXISTS idx_research_batch_jobs_status
  ON research_batch_jobs(owner_id, status, updated_at DESC);
