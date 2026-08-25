-- Manual catalogue corrections for a producer's researched wine range.
--
-- Producer research rebuilds catalog_json from scratch on every run, so a
-- hand-edited catalogue would be silently discarded by the next run. These
-- rows record the decision instead of the result: they are keyed on a stable
-- cuvee identity signature and re-applied after each research run and on every
-- read, so a duplicate the owner has resolved never comes back.
--
-- decision='merge' folds source_key into target_key (the surviving wine).
-- decision='hide' drops source_key from the range entirely.
CREATE TABLE producer_catalog_decisions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('merge','hide')),
  source_key TEXT NOT NULL,
  source_name TEXT NOT NULL,
  target_key TEXT,
  target_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((decision='merge' AND target_key IS NOT NULL) OR (decision='hide' AND target_key IS NULL))
);

CREATE UNIQUE INDEX idx_producer_catalog_decisions_source
  ON producer_catalog_decisions(owner_id,producer_id,source_key);
CREATE INDEX idx_producer_catalog_decisions_owner_producer
  ON producer_catalog_decisions(owner_id,producer_id,created_at);
