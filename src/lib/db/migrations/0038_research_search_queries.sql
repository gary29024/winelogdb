-- How many Google searches each research submission actually ran.
--
-- Grounding on Gemini 3 is billed per search the model decides to run, not per
-- request, and a single grounded request was averaging seven. Without this the
-- only visible number was the request count, which is not what the bill counts.
ALTER TABLE research_batch_jobs ADD COLUMN search_queries INTEGER NOT NULL DEFAULT 0;
