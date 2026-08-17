ALTER TABLE wines ADD COLUMN grape_blend_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE wines ADD COLUMN deep_search_json TEXT;
ALTER TABLE wines ADD COLUMN deep_search_model TEXT;
ALTER TABLE wines ADD COLUMN deep_search_updated_at TEXT;
