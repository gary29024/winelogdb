-- Saved-photo extraction is one user-facing action, not one action per photo.
-- It is owner-funded and included by default, like the other scan actions.
-- Owner controls can switch it to an independent weekly successful-run allowance.
INSERT OR IGNORE INTO member_ai_action_policies(action,access_mode,weekly_limit,updated_at,updated_by)
VALUES('champagne_extraction','included',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner');

-- Keep the ordinary quote/reservation/budget/idempotency pipeline at zero credits.
-- Do not alter any existing prices, allowances, grants, balances or wine data.
INSERT OR IGNORE INTO credit_prices(id,action,credits,created_at,created_by)
VALUES('pilot-champagne-extraction-v1','champagne_extraction',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner');
