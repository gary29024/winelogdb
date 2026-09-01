-- Journal chronology is coalesce(tasting_date, created_at), not tasting_date
-- alone. Index the expression the list actually orders by so D1 can walk each
-- owner's wines in Journal-date order and avoid sorting the full candidate set
-- before applying the page limit.
CREATE INDEX IF NOT EXISTS idx_wines_owner_journal_date
  ON wines(owner_id, coalesce(tasting_date, created_at) DESC);
