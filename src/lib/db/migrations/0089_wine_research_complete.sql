-- Whether a wine has complete Deep Search, so the journal can mark it and
-- filter by it without assembling every wine's research on each page.
-- Same rule as isDeepSearchComplete: every core section present, plus the
-- vintage section for a vintage wine. Partial research, including a report
-- assembled from other wines' cached scopes, counts as not researched.
-- Kept current when research is saved and whenever a wine's report is shown.
ALTER TABLE wines ADD COLUMN research_complete INTEGER NOT NULL DEFAULT 0;
UPDATE wines SET research_complete=1 WHERE deep_search_json IS NOT NULL AND json_valid(deep_search_json)
  AND trim(coalesce(json_extract(deep_search_json,'$.summary'),''))<>''
  AND trim(coalesce(json_extract(deep_search_json,'$.producerDetails'),''))<>''
  AND trim(coalesce(json_extract(deep_search_json,'$.producerWinemakingPractices'),''))<>''
  AND trim(coalesce(json_extract(deep_search_json,'$.terroir'),''))<>''
  AND trim(coalesce(json_extract(deep_search_json,'$.winemakingTechniques'),''))<>''
  AND trim(coalesce(json_extract(deep_search_json,'$.drinkingWindow'),''))<>''
  AND (vintage IS NULL OR trim(coalesce(json_extract(deep_search_json,'$.vintageQuality'),''))<>'');
