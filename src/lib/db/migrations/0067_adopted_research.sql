-- Research a friend contributed, once it has actually been shown to a reader,
-- becomes the reader's own row.
--
-- Before this, a friend's scopes were assembled on every view and never stored,
-- so unfriending silently removed Deep Search text from wines already read, and
-- each view paid for a friendship join. Adoption makes the text durable and the
-- repeat read a plain indexed lookup.
--
-- source_user_id records who paid for the research. It is provenance only: an
-- adopted row is never republished to reusable_research, so attribution cannot
-- drift and a copy cannot spread on the original contributor's behalf.
ALTER TABLE research_cache ADD COLUMN source_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_research_cache_source ON research_cache(source_user_id) WHERE source_user_id IS NOT NULL;
