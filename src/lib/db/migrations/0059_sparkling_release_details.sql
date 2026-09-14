CREATE TABLE wine_sparkling_details (
  owner_id TEXT NOT NULL,
  wine_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,wine_id),
  FOREIGN KEY(wine_id) REFERENCES wines(id) ON DELETE CASCADE
);
