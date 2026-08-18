CREATE TABLE IF NOT EXISTS maintenance_state (
  owner_id TEXT NOT NULL,
  maintenance_key TEXT NOT NULL,
  last_run_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, maintenance_key)
);
