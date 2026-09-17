-- Pilot member access is configured at the user-facing action level.
-- "included" actions are free to every member subject only to deployment-wide
-- safeguards. "allowance" actions receive a per-account weekly free-run limit;
-- owners can add one-off extra runs for a particular member/action/week.
-- Usage is reserved while work is in flight but only successful operations are
-- retained as consumed runs.

CREATE TABLE member_ai_action_policies (
  action TEXT PRIMARY KEY,
  access_mode TEXT NOT NULL CHECK(access_mode IN ('included','allowance')),
  weekly_limit INTEGER NOT NULL DEFAULT 0 CHECK(weekly_limit>=0),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES app_users(id)
);

INSERT INTO member_ai_action_policies(action,access_mode,weekly_limit,updated_at,updated_by) VALUES
  ('scan_single','included',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('scan_group','included',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('scan_batch','included',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('scan_sheet','included',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('wine_deep_search','allowance',2,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('producer_research','allowance',2,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('producer_batch_research','allowance',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner'),
  ('vintage_window','allowance',2,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'owner');

CREATE TABLE member_ai_action_usage (
  operation_id TEXT PRIMARY KEY REFERENCES credit_operations(id),
  user_id TEXT NOT NULL REFERENCES app_users(id),
  action TEXT NOT NULL REFERENCES member_ai_action_policies(action),
  week_start TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','success')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX idx_member_ai_action_usage_week
  ON member_ai_action_usage(user_id,action,week_start,status);

CREATE TABLE member_ai_action_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  action TEXT NOT NULL REFERENCES member_ai_action_policies(action),
  week_start TEXT NOT NULL,
  runs INTEGER NOT NULL CHECK(runs>0),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id),
  reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_member_ai_action_grants_week
  ON member_ai_action_grants(user_id,action,week_start,created_at);

-- Pending allowance slots protect against concurrent oversubscription. The
-- credit operation is WineLog's durable source of truth for whether provider
-- work succeeded: successful work consumes the slot; failed work releases it.
CREATE TRIGGER member_ai_action_usage_complete
AFTER UPDATE OF status ON credit_operations
WHEN new.status='complete'
BEGIN
  UPDATE member_ai_action_usage
  SET status='success',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE operation_id=new.id AND status='pending';
END;

CREATE TRIGGER member_ai_action_usage_failed
AFTER UPDATE OF status ON credit_operations
WHEN new.status='failed'
BEGIN
  DELETE FROM member_ai_action_usage WHERE operation_id=new.id AND status='pending';
END;

-- Preserve any successful usage already recorded by the short-lived shared
-- research allowance. Failed/in-flight claims are intentionally not migrated,
-- because the new policy counts successful runs only.
INSERT OR IGNORE INTO member_ai_action_usage(operation_id,user_id,action,week_start,status,created_at,completed_at)
SELECT c.operation_id,c.user_id,
  CASE
    WHEN o.path LIKE '/api/wines/%/deep-search' THEN 'wine_deep_search'
    WHEN o.path LIKE '/api/producers/%/research' THEN 'producer_research'
    WHEN o.path='/api/maturity/vintage' THEN 'vintage_window'
  END,
  c.week_start,'success',c.created_at,o.updated_at
FROM research_allowance_claims c
JOIN credit_operations o ON o.id=c.operation_id
WHERE o.status='complete'
  AND (o.response_status IS NULL OR o.response_status<400)
  AND (o.path LIKE '/api/wines/%/deep-search' OR o.path LIKE '/api/producers/%/research' OR o.path='/api/maturity/vintage');
