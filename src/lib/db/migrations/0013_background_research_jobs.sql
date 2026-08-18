ALTER TABLE producers ADD COLUMN winemaking_practices TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS wine_research_runs (
  owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  wine_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','complete','failed')),
  stage TEXT NOT NULL,
  refresh_mode TEXT NOT NULL DEFAULT 'none',
  attempt INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  PRIMARY KEY (owner_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_wine_research_runs_target
  ON wine_research_runs(owner_id, wine_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_wine_research_runs_status
  ON wine_research_runs(owner_id, status, updated_at DESC);
