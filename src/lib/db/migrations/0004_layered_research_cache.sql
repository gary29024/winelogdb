CREATE TABLE IF NOT EXISTS research_cache (
  owner_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('producer','terroir','vintage_context','wine_vintage')),
  cache_key TEXT NOT NULL,
  subject_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  model TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, scope, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_research_cache_owner_scope
  ON research_cache(owner_id, scope, updated_at DESC);
