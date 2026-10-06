-- Translations are now filed per section of English rather than per whole
-- research result (see src/lib/research/translation.ts): a wine's Deep Search
-- is assembled at read time from sections shared with other wines, so a
-- whole-result key rarely matched what was on screen. Rows written under the
-- old shape cannot be split, and any translation can be remade, so the table
-- is recreated rather than migrated.
DROP TABLE IF EXISTS research_translations;
CREATE TABLE research_translations (
  source_hash TEXT NOT NULL,
  lang TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source_hash, lang)
);
