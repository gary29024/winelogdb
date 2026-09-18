-- A shared bottle contributes wine facts to the recipient's journal, but the
-- drinking experience is personal. Do not copy the source owner's notes, score,
-- date, venue or price into the recipient's history.
ALTER TABLE shared_wine_preferences ADD COLUMN tasting_notes TEXT;
ALTER TABLE shared_wine_preferences ADD COLUMN rating REAL CHECK(rating IS NULL OR (rating>=0 AND rating<=100));
ALTER TABLE shared_wine_preferences ADD COLUMN tasting_date TEXT;
ALTER TABLE shared_wine_preferences ADD COLUMN tasting_name TEXT;
ALTER TABLE shared_wine_preferences ADD COLUMN venue TEXT;
ALTER TABLE shared_wine_preferences ADD COLUMN location_name TEXT;
ALTER TABLE shared_wine_preferences ADD COLUMN price REAL CHECK(price IS NULL OR price>=0);
ALTER TABLE shared_wine_preferences ADD COLUMN currency TEXT;

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
  w.owner_id AS owner_id,
  w.owner_id AS source_owner_id,
  0 AS is_shared,
  NULL AS shared_by,
  NULL AS shared_at,
  w.id,w.producer_id,w.cuvee_id,w.producer,w.wine_name,w.vintage,
  w.country,w.region,w.appellation,w.grapes_json,w.wine_style,
  w.tasting_notes,w.rating,w.tasting_date,w.venue,w.favorite,
  w.price,w.currency,w.classification,w.created_at,w.updated_at,w.photo_sort_at,
  NULL AS shared_tasting_name
FROM wines w
UNION ALL
SELECT
  g.recipient_id AS owner_id,
  w.owner_id AS source_owner_id,
  1 AS is_shared,
  u.display_name AS shared_by,
  g.shared_at,
  w.id,
  NULL AS producer_id,
  NULL AS cuvee_id,
  w.producer,w.wine_name,w.vintage,
  w.country,w.region,w.appellation,w.grapes_json,w.wine_style,
  COALESCE(pref.tasting_notes,''),pref.rating,pref.tasting_date,pref.venue,
  COALESCE(pref.favorite,0),
  pref.price,pref.currency,
  w.classification,
  g.shared_at AS created_at,
  w.updated_at,
  g.shared_at AS photo_sort_at,
  pref.tasting_name AS shared_tasting_name
FROM grants g
JOIN friendships f
  ON f.user_id=g.recipient_id AND f.friend_id=g.owner_id
JOIN app_users u
  ON u.id=g.owner_id AND u.status='active'
JOIN wines w
  ON w.id=g.wine_id AND w.owner_id=g.owner_id
LEFT JOIN shared_wine_preferences pref
  ON pref.recipient_id=g.recipient_id AND pref.owner_id=g.owner_id AND pref.wine_id=g.wine_id;

DROP TRIGGER IF EXISTS shared_visible_rev_preference_update;
CREATE TRIGGER shared_visible_rev_preference_update
AFTER UPDATE OF favorite,tasting_notes,rating,tasting_date,tasting_name,venue,location_name,price,currency ON shared_wine_preferences
WHEN OLD.favorite IS NOT NEW.favorite
  OR OLD.tasting_notes IS NOT NEW.tasting_notes
  OR OLD.rating IS NOT NEW.rating
  OR OLD.tasting_date IS NOT NEW.tasting_date
  OR OLD.tasting_name IS NOT NEW.tasting_name
  OR OLD.venue IS NOT NEW.venue
  OR OLD.location_name IS NOT NEW.location_name
  OR OLD.price IS NOT NEW.price
  OR OLD.currency IS NOT NEW.currency
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

-- Source identity still changes what the friend is looking at. Source-owner
-- tasting fields no longer invalidate recipients because recipients do not read
-- them after this migration.
DROP TRIGGER IF EXISTS shared_visible_rev_source_wine_update;
CREATE TRIGGER shared_visible_rev_source_wine_update
AFTER UPDATE OF producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,classification ON wines BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM wine_shares
      WHERE owner_id=NEW.owner_id AND wine_id=NEW.id
    UNION
    SELECT ts.recipient_id FROM tasting_shares ts
      JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
      WHERE ts.owner_id=NEW.owner_id AND we.wine_id=NEW.id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

-- Cached Passport/Insights payloads written under 0074 may contain the source
-- owner's date/rating. Force one rebuild for every existing recipient.
INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
  SELECT recipient_id FROM wine_shares
  UNION
  SELECT recipient_id FROM tasting_shares
) WHERE true
ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
