-- Recipient-owned tasting fields for a wine somebody else shared.
-- The source wine remains read-only; this row is the viewer's own experience.
CREATE TABLE IF NOT EXISTS shared_wine_experiences (
  recipient_id TEXT NOT NULL REFERENCES app_users(id),
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  tasting_notes TEXT NOT NULL DEFAULT '',
  rating REAL,
  tasting_date TEXT,
  tasting_name TEXT,
  venue TEXT,
  location_name TEXT,
  price REAL,
  currency TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(recipient_id,owner_id,wine_id),
  CHECK(owner_id<>recipient_id),
  CHECK(rating IS NULL OR (rating>=0 AND rating<=100)),
  CHECK(price IS NULL OR price>=0)
);

DROP VIEW IF EXISTS member_visible_wines;
CREATE VIEW member_visible_wines AS
WITH accessible AS (
  SELECT s.wine_id,s.owner_id,s.recipient_id,s.created_at AS shared_at
  FROM wine_shares s
  UNION ALL
  SELECT we.wine_id,ts.owner_id,ts.recipient_id,ts.created_at AS shared_at
  FROM tasting_shares ts
  JOIN wine_experiences we
    ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
), grants AS (
  SELECT wine_id,owner_id,recipient_id,MAX(shared_at) AS shared_at
  FROM accessible
  GROUP BY wine_id,owner_id,recipient_id
)
SELECT
  w.owner_id AS owner_id,w.owner_id AS source_owner_id,0 AS is_shared,
  NULL AS shared_by,NULL AS shared_at,
  w.id,w.producer_id,w.cuvee_id,w.producer,w.wine_name,w.vintage,
  w.country,w.region,w.appellation,w.grapes_json,w.wine_style,
  w.tasting_notes,w.rating,w.tasting_date,w.venue,w.favorite,
  w.price,w.currency,w.classification,w.created_at,w.updated_at,w.photo_sort_at
FROM wines w
UNION ALL
SELECT
  g.recipient_id AS owner_id,w.owner_id AS source_owner_id,1 AS is_shared,
  u.display_name AS shared_by,g.shared_at,
  w.id,NULL AS producer_id,NULL AS cuvee_id,w.producer,w.wine_name,w.vintage,
  w.country,w.region,w.appellation,w.grapes_json,w.wine_style,
  coalesce(x.tasting_notes,'') AS tasting_notes,x.rating,x.tasting_date,x.venue,
  coalesce(pref.favorite,0) AS favorite,x.price,x.currency,w.classification,
  g.shared_at AS created_at,w.updated_at,g.shared_at AS photo_sort_at
FROM grants g
JOIN friendships f ON f.user_id=g.recipient_id AND f.friend_id=g.owner_id
JOIN app_users u ON u.id=g.owner_id AND u.status='active'
JOIN wines w ON w.id=g.wine_id AND w.owner_id=g.owner_id
LEFT JOIN shared_wine_preferences pref
  ON pref.recipient_id=g.recipient_id AND pref.owner_id=g.owner_id AND pref.wine_id=g.wine_id
LEFT JOIN shared_wine_experiences x
  ON x.recipient_id=g.recipient_id AND x.owner_id=g.owner_id AND x.wine_id=g.wine_id;

CREATE TRIGGER shared_visible_rev_experience_insert AFTER INSERT ON shared_wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_experience_update AFTER UPDATE ON shared_wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_experience_delete AFTER DELETE ON shared_wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
