CREATE TABLE IF NOT EXISTS research_model_health (
  owner_id TEXT NOT NULL,
  model TEXT NOT NULL,
  unavailable_until TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TEXT,
  last_reason TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, model)
);

CREATE INDEX IF NOT EXISTS idx_research_model_health_unavailable
  ON research_model_health(owner_id, unavailable_until);
