-- A lookup belongs to the queue, not to the browser connection that requested it.
CREATE TABLE vintage_research_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  subject_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','complete','failed')),
  result_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX vintage_research_active_cell ON vintage_research_jobs(owner_id,cache_key)
  WHERE status IN ('queued','running');
