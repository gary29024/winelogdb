-- What a vintage actually did to a region's drinking window.
--
-- The ageing table answers from the place and the style alone, which is most of
-- the answer and costs nothing. What it cannot know is the year: a cold vintage
-- shortens the window and a great one lengthens it, and only a source can say
-- which this was.
--
-- Keyed on the region and the vintage rather than on the wine, because that is
-- what the answer is about. One search covers every bottle you own from that
-- cell, now and in the future, and a growing season does not change - so a row
-- here is written once and read forever.
--
-- It never replaces the calculated window. Both are shown, and the row records
-- where its own figures came from so the difference stays visible.
CREATE TABLE IF NOT EXISTS vintage_windows (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  -- Normalised country/region/appellation/vintage/style, so two wines from one
  -- cell share the row rather than each paying for a search.
  cache_key TEXT NOT NULL,
  country TEXT,
  region TEXT,
  appellation TEXT,
  vintage INTEGER NOT NULL,
  wine_style TEXT,
  -- The shift, in years, not the window itself.
  --
  -- A cell holds a whole region: Piedmont red 2019 is Barolo and Dolcetto
  -- d'Alba alike, and their usual windows are eight-to-twenty-five and
  -- two-to-ten. Storing the years a source gave for one of them and showing
  -- them against the other would be badly wrong. What a vintage report actually
  -- tells you is how the year went - two years later, five years longer - and
  -- that transfers: it is applied to each wine's own calculated window.
  shift_from INTEGER,
  shift_to INTEGER,
  vintage_note TEXT NOT NULL DEFAULT '',
  sources_json TEXT NOT NULL DEFAULT '[]',
  model TEXT,
  researched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vintage_windows_key ON vintage_windows(owner_id, cache_key);
