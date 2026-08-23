CREATE TABLE IF NOT EXISTS vertex_batch_emulation_jobs (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  display_name TEXT NOT NULL,
  requests_json TEXT NOT NULL DEFAULT '[]',
  result_json TEXT,
  state TEXT NOT NULL CHECK (state IN ('JOB_STATE_PENDING','JOB_STATE_RUNNING','JOB_STATE_SUCCEEDED','JOB_STATE_FAILED','JOB_STATE_CANCELLED')),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vertex_batch_emulation_expiry
  ON vertex_batch_emulation_jobs(expires_at);
