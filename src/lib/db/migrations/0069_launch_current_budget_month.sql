-- A newly migrated deployment should not block the existing owner from their
-- first AI action merely because the monthly observation month did not exist
-- before multi-user controls. Seed only a blank value. Future month rollovers
-- still require the owner to refresh the observed Cloudflare cost as designed.
UPDATE pilot_settings
SET value_json=json_set(value_json,'$.cloudflareObservedMonth',strftime('%Y-%m','now')),
    updated_at=CURRENT_TIMESTAMP
WHERE id=1
  AND coalesce(json_extract(value_json,'$.cloudflareObservedMonth'),'')='';
