CREATE TABLE IF NOT EXISTS batch_recognition_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploading','queued','running','ready','partial','failed','complete','expired')),
  total_items INTEGER NOT NULL DEFAULT 0,
  confirmed_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_recognition_sessions_owner
  ON batch_recognition_sessions(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS batch_recognition_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES batch_recognition_sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('staged','submitted','ready','failed','confirmed','rejected','expired')),
  metadata_json TEXT NOT NULL DEFAULT '[]',
  recognition_json TEXT,
  error TEXT,
  confirmed_wine_id TEXT REFERENCES wines(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id, session_id, position)
);

CREATE INDEX IF NOT EXISTS idx_batch_recognition_items_session
  ON batch_recognition_items(owner_id, session_id, position);

CREATE TABLE IF NOT EXISTS batch_recognition_images (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL REFERENCES batch_recognition_items(id) ON DELETE CASCADE,
  original_object_key TEXT NOT NULL UNIQUE,
  recognition_object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  recognition_byte_size INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_recognition_images_item
  ON batch_recognition_images(owner_id, item_id);

CREATE TABLE IF NOT EXISTS batch_recognition_jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES batch_recognition_sessions(id) ON DELETE CASCADE,
  google_batch_name TEXT,
  item_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('queued','running','complete','failed')),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_recognition_jobs_session
  ON batch_recognition_jobs(owner_id, session_id, updated_at DESC);
