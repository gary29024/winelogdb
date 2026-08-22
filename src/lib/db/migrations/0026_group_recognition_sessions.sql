CREATE TABLE IF NOT EXISTS group_recognition_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  original_object_key TEXT NOT NULL,
  preview_object_key TEXT NOT NULL,
  original_content_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,
  unresolved_count INTEGER NOT NULL DEFAULT 0,
  retained INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_group_recognition_sessions_owner_updated
  ON group_recognition_sessions(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_recognition_sessions_expiry
  ON group_recognition_sessions(owner_id, retained, expires_at);

CREATE TABLE IF NOT EXISTS group_recognition_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  client_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  recognition_json TEXT,
  crop_object_key TEXT,
  crop_content_type TEXT,
  crop_width INTEGER,
  crop_height INTEGER,
  saved_wine_id TEXT,
  removed INTEGER NOT NULL DEFAULT 0,
  manual INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id, session_id, client_key)
);

CREATE INDEX IF NOT EXISTS idx_group_recognition_items_session
  ON group_recognition_items(owner_id, session_id, position);
CREATE INDEX IF NOT EXISTS idx_group_recognition_items_saved_wine
  ON group_recognition_items(owner_id, saved_wine_id);
