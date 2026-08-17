ALTER TABLE wine_images ADD COLUMN captured_at TEXT;
ALTER TABLE wine_images ADD COLUMN latitude REAL;
ALTER TABLE wine_images ADD COLUMN longitude REAL;
ALTER TABLE wine_images ADD COLUMN location_name TEXT;

CREATE TABLE tastings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tasting_date TEXT,
  venue TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_tastings_owner_name_date
  ON tastings(owner_id, name, coalesce(tasting_date, ''));
CREATE INDEX idx_tastings_owner_date
  ON tastings(owner_id, tasting_date DESC);

CREATE TABLE wine_experiences (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  tasting_id TEXT REFERENCES tastings(id) ON DELETE SET NULL,
  consumed_at TEXT,
  latitude REAL,
  longitude REAL,
  location_name TEXT,
  rating REAL,
  tasting_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_wine_experiences_wine
  ON wine_experiences(owner_id, wine_id, consumed_at DESC);
CREATE INDEX idx_wine_experiences_tasting
  ON wine_experiences(owner_id, tasting_id, consumed_at ASC);
