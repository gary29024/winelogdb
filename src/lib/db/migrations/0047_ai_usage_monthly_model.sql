-- What the permanent month record was billed on.
--
-- ai_usage_monthly was keyed on (owner, month, kind) alone, so the two fields
-- that decide what a call cost - the model and the service tier - were thrown
-- away at rollup. The month figure was therefore priced at the fallback rate
-- for everything, while the per-kind cards beside it priced each call at its
-- own model, tier and day. The same runs, costed two ways, and the month was
-- the wrong one: it read low on the models that bill above the fallback and
-- high on the batch scans that queue on flex.
--
-- This is the same defect 0042 fixed for ai_usage_events, in the table that
-- outlives them. Raw events are pruned at ninety days; past that the rollup is
-- the only record there is, and a record with no model in it can never be
-- priced at all.
--
-- SQLite cannot widen a primary key in place, so the table is rebuilt. Rows
-- written before this carry 'unknown' and 'standard': what they were billed on
-- is genuinely not recorded anywhere for a month whose events have gone, and
-- 'unknown' prices at the fallback rate - exactly what those rows cost today,
-- rather than a precision they do not have. Their counts come across intact,
-- so the search allowance, which is the number that must be exact, is
-- untouched.
CREATE TABLE ai_usage_monthly_rebuilt (
  owner_id TEXT NOT NULL,
  month TEXT NOT NULL,
  kind TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'unknown',
  tier TEXT NOT NULL DEFAULT 'standard',
  requests INTEGER NOT NULL DEFAULT 0,
  search_queries INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, month, kind, model, tier)
);

INSERT INTO ai_usage_monthly_rebuilt
  (owner_id, month, kind, model, tier, requests, search_queries, prompt_tokens, output_tokens, units, updated_at)
  SELECT owner_id, month, kind, 'unknown', 'standard',
         requests, search_queries, prompt_tokens, output_tokens, units, updated_at
  FROM ai_usage_monthly;

DROP TABLE ai_usage_monthly;
ALTER TABLE ai_usage_monthly_rebuilt RENAME TO ai_usage_monthly;
