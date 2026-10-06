-- Translations of Deep Search and producer research, filed under a hash of the
-- exact English they were made from (see src/lib/research/translation.ts). A
-- re-run that rewrites the English no longer matches its old translation, so
-- nothing stale is ever shown. One row serves everyone who can read that
-- English, which is why the key is the text and not a wine or an owner.
CREATE TABLE IF NOT EXISTS research_translations (
  source_hash TEXT NOT NULL,
  lang TEXT NOT NULL,
  content_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source_hash, lang)
);
