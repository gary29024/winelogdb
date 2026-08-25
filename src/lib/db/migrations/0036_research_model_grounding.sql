-- Which models actually ground, learned rather than assumed.
--
-- Deep Search asks for Google Search grounding, and a model that answers
-- without it cannot satisfy the research quality gate however well it writes.
-- Which of the configured models grounds has turned out to vary by model and by
-- serving mode, so routing records what each one did rather than hardcoding an
-- answer that would be wrong the moment the provider changed.
--
-- grounding_ok_at is the last time a model returned grounding chunks;
-- grounding_failed_at the last time it returned none. A model whose most recent
-- observation is a failure inside the cooldown is routed around.
ALTER TABLE research_model_health ADD COLUMN grounding_ok_at TEXT;
ALTER TABLE research_model_health ADD COLUMN grounding_failed_at TEXT;
ALTER TABLE research_model_health ADD COLUMN grounding_failures INTEGER NOT NULL DEFAULT 0;
