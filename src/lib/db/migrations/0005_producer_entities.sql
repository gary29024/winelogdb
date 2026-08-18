CREATE TABLE IF NOT EXISTS producers (
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  match_key TEXT NOT NULL,
  home_country TEXT,
  home_region TEXT,
  home_locality TEXT,
  profile TEXT NOT NULL DEFAULT '',
  catalog_json TEXT NOT NULL DEFAULT '[]',
  sources_json TEXT NOT NULL DEFAULT '[]',
  research_model TEXT,
  researched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, match_key)
);

CREATE TABLE IF NOT EXISTS producer_aliases (
  owner_id TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  display_alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, normalized_alias)
);

ALTER TABLE wines ADD COLUMN producer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_producers_owner_location
  ON producers(owner_id, home_country, home_region, canonical_name);
CREATE INDEX IF NOT EXISTS idx_producer_aliases_entity
  ON producer_aliases(owner_id, producer_id);
CREATE INDEX IF NOT EXISTS idx_wines_owner_producer_entity
  ON wines(owner_id, producer_id);

-- Backfill existing wines conservatively by their current producer spelling.
INSERT OR IGNORE INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at)
SELECT lower(hex(randomblob(16))), owner_id, trim(producer), lower(trim(producer)), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM wines
WHERE trim(producer)<>''
GROUP BY owner_id, lower(trim(producer));

INSERT OR IGNORE INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at)
SELECT p.owner_id, lower(trim(p.canonical_name)), p.id, p.canonical_name, CURRENT_TIMESTAMP
FROM producers p;

UPDATE wines
SET producer_id=(
  SELECT p.id FROM producers p
  WHERE p.owner_id=wines.owner_id AND p.match_key=lower(trim(wines.producer))
  LIMIT 1
)
WHERE producer_id IS NULL AND trim(producer)<>'';
