-- Hot detail/producer queries select the latest experience by created_at.
-- The existing idx_wine_experiences_wine is ordered by consumed_at, so SQLite
-- may otherwise need an extra sort for each correlated latest-experience lookup.
CREATE INDEX IF NOT EXISTS idx_wine_experiences_owner_wine_created
  ON wine_experiences(owner_id, wine_id, created_at DESC);

-- Favorite Journal views filter by owner + favorite before applying their
-- chronological tie-breakers. Keep the common date columns in the same index
-- so D1 can narrow the working set cheaply as the Journal grows.
CREATE INDEX IF NOT EXISTS idx_wines_owner_favorite_dates
  ON wines(owner_id, favorite, tasting_date DESC, created_at DESC);
