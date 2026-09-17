-- Replace pilot credit charging with the launch policy the owner actually wants:
-- scans are sponsored by the deployment and member research is limited by a
-- non-rollover weekly allowance. Keep the existing quote/operation machinery
-- for idempotency, budget holds and auditability, but make the internal tariffs
-- zero so members are never charged WineLog credits during the pilot.

DROP INDEX IF EXISTS idx_credit_prices_action;
ALTER TABLE credit_prices RENAME TO credit_prices_legacy;
CREATE TABLE credit_prices (
 id TEXT PRIMARY KEY, action TEXT NOT NULL, credits INTEGER NOT NULL CHECK(credits>=0),
 created_at TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES app_users(id)
);
CREATE INDEX idx_credit_prices_action ON credit_prices(action,created_at DESC,id);

INSERT INTO credit_prices(id,action,credits,created_at,created_by) VALUES
 ('pilot-free-scan-single','scan_single',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-scan-batch','scan_batch',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-scan-group','scan_group',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-scan-sheet','scan_sheet',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-producer-research','producer_research',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-producer-profile','producer_profile',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-wine-producer','wine_producer',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-wine-terroir','wine_terroir',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-wine-vintage-context','wine_vintage_context',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-wine-wine-vintage','wine_wine_vintage',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
 ('pilot-free-vintage-window','vintage_window',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner');
DROP TABLE credit_prices_legacy;

CREATE TABLE research_allowance_claims (
 operation_id TEXT PRIMARY KEY REFERENCES credit_operations(id),
 user_id TEXT NOT NULL REFERENCES app_users(id),
 week_start TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_research_allowance_user_week ON research_allowance_claims(user_id,week_start,created_at);

UPDATE pilot_settings
SET value_json=json_set(value_json,'$.researchRunsPerWeek',coalesce(json_extract(value_json,'$.researchRunsPerWeek'),2)),
    updated_at=CURRENT_TIMESTAMP
WHERE id=1;
