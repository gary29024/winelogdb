-- Bottles you hold, as opposed to bottles you drank.
--
-- Every other table in the journal records an encounter: a wines row is a wine
-- you opened, a wine_experiences row is one of the times you opened it. A
-- cellar holding is the thing that has not happened yet, and it must stay out
-- of every count until it does - so it is its own table rather than a state
-- column on wines. A flag would need every aggregate in the app amended to
-- exclude it, and the one that was missed would be a wrong number nobody sees.
--
-- Deliberately NOT given achievement_cache_state triggers. Cellar writes change
-- no statistic, so they must not invalidate the caches that serve them.
CREATE TABLE IF NOT EXISTS cellar_holdings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  -- Resolved against producers and cuvees that already exist, and left null
  -- otherwise: creating an entity here would put a producer you have never
  -- drunk into the producer library at nought tasted, which is a statistic.
  -- ensureWineIdentity creates them the usual way when the bottle is opened.
  producer_id TEXT,
  cuvee_id TEXT,
  producer TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  vintage INTEGER,
  -- Enough place for the list to group and sort, and for a drinking window to
  -- be read later, without a wines row to borrow it from.
  country TEXT,
  region TEXT,
  appellation TEXT,
  wine_style TEXT,
  classification TEXT,
  bottles INTEGER NOT NULL,
  bottle_size_ml INTEGER NOT NULL DEFAULT 750,
  purchase_price REAL,
  currency TEXT,
  purchased_at TEXT,
  merchant TEXT,
  location TEXT,
  notes TEXT NOT NULL DEFAULT '',
  -- Normalised identity, so buying six more of a wine you already hold adds to
  -- the line instead of opening a second one. Bottle size is part of it: a
  -- magnum is not three more of the same bottle.
  match_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cellar_identity ON cellar_holdings(owner_id, match_key);
CREATE INDEX IF NOT EXISTS idx_cellar_owner_vintage ON cellar_holdings(owner_id, vintage DESC);
CREATE INDEX IF NOT EXISTS idx_cellar_owner_producer ON cellar_holdings(owner_id, producer COLLATE NOCASE);
