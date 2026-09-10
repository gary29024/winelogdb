-- Vintage Intelligence extends the existing one-search-per-vintage-cell cache.
--
-- Kept as JSON so the quality model can evolve without adding a column for every
-- qualitative observation. Existing rows remain valid and simply have no score
-- until the user explicitly refreshes that vintage research.
ALTER TABLE vintage_windows ADD COLUMN quality_json TEXT;
