ALTER TABLE wines ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_wines_owner_favorite ON wines(owner_id, favorite);
