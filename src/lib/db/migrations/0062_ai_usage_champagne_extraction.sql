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
