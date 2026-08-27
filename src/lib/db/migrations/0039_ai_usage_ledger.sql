-- What each Gemini call actually cost, per run.
--
-- The bill has two halves and Cloudflare can see neither: tokens are priced by
-- the model, and Grounding with Google Search is priced by Google per search
-- query the model decides to run - which is the larger half by an order of
-- magnitude. Nothing in Workers Analytics or the AI Gateway prices a search
-- query, so the only way to know what a producer or wine run costs is to
-- record it here as it happens.
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  -- producer_research | wine_research | scan_single | scan_batch | scan_group
  kind TEXT NOT NULL,
  -- Groups the requests of one run: a producer research request id, a batch
  -- session, or a single scan's request id.
  run_id TEXT NOT NULL,
  target_id TEXT,
  model TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  search_queries INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_time ON ai_usage_events(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_owner_kind ON ai_usage_events(owner_id, kind, created_at DESC);

-- Raw events are pruned; this is the permanent record. Grounding's free
-- allowance resets monthly, so the month is the unit that matters for
-- knowing when the next search starts costing money.
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  owner_id TEXT NOT NULL,
  month TEXT NOT NULL,
  kind TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  search_queries INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, month, kind)
);
