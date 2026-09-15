-- Champagne label-detail extraction was originally metered as a generic batch
-- scan even though it is a separate user action and has its own request/run ID.
-- Reclassify retained raw events so the Insights card and run drill-down show
-- the extraction cost where the user expects it. The monthly rollup is left as
-- written: the billing-month tile sums every kind, so moving historical monthly
-- rows would add complexity without changing the total bill. New events are
-- rolled up under champagne_extraction directly.
UPDATE ai_usage_events
SET kind='champagne_extraction'
WHERE kind='scan_batch' AND id LIKE 'champagne:%';

-- Early Vintage Window usage rows predate target_id, even though their queue job
-- already persisted the cache key that says which place/year/style was searched.
-- Recover that key while the raw event is still retained so run history can show
-- Burgundy · 2019 · Red instead of the same generic title for every lookup.
UPDATE ai_usage_events
SET target_id=(
  SELECT j.cache_key FROM vintage_research_jobs j
  WHERE j.owner_id=ai_usage_events.owner_id AND j.id=ai_usage_events.run_id
  LIMIT 1
)
WHERE kind='vintage_window' AND (target_id IS NULL OR trim(target_id)='')
  AND EXISTS (
    SELECT 1 FROM vintage_research_jobs j
    WHERE j.owner_id=ai_usage_events.owner_id AND j.id=ai_usage_events.run_id
  );
