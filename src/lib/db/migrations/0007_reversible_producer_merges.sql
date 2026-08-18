CREATE TABLE IF NOT EXISTS producer_merges (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  destination_producer_id TEXT NOT NULL,
  source_producer_id TEXT NOT NULL,
  source_canonical_name TEXT NOT NULL,
  source_match_key TEXT NOT NULL,
  destination_snapshot_json TEXT NOT NULL,
  source_snapshot_json TEXT NOT NULL,
  source_aliases_json TEXT NOT NULL DEFAULT '[]',
  source_wine_ids_json TEXT NOT NULL DEFAULT '[]',
  merged_at TEXT NOT NULL,
  undone_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_producer_merges_destination
  ON producer_merges(owner_id, destination_producer_id, undone_at, merged_at DESC);

ALTER TABLE producer_research_history ADD COLUMN merge_id TEXT;

CREATE INDEX IF NOT EXISTS idx_producer_research_history_merge
  ON producer_research_history(owner_id, merge_id, origin_producer_id, research_type);
