-- Friend tagging preferences and tasting-level sharing.
-- Direct wine_shares remains the explicit per-wine override. A tasting share is
-- evaluated dynamically through wine_experiences, so adding/removing a wine
-- from a tasting immediately changes inherited access without copying grants.
CREATE TABLE IF NOT EXISTS member_share_defaults (
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  recipient_id TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, recipient_id),
  CHECK(owner_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_member_share_defaults_recipient
  ON member_share_defaults(recipient_id, owner_id);

CREATE TABLE IF NOT EXISTS tasting_shares (
  tasting_id TEXT NOT NULL REFERENCES tastings(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  recipient_id TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(tasting_id, recipient_id),
  CHECK(owner_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_tasting_shares_recipient
  ON tasting_shares(recipient_id, created_at DESC, tasting_id);
