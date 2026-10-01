-- Whether a reader's view of a shared wine has complete Deep Search.
-- The journal marked a shared bottle from the owner's wines.research_complete
-- only, so a reader who ran Deep Search on a friend's bottle saw no mark: the
-- research is filed under the reader, and the owner's row never changes for it.
-- Kept current whenever the reader is shown the shared wine's report, with the
-- same isDeepSearchComplete rule the owner's column uses.
ALTER TABLE shared_wine_preferences ADD COLUMN research_complete INTEGER NOT NULL DEFAULT 0;
