ALTER TABLE wines ADD COLUMN grape_blend_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE wines ADD COLUMN deep_research_json TEXT;
ALTER TABLE wines ADD COLUMN deep_researched_at TEXT;
