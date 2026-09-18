-- Shared wines participate in the recipient's read-only Journal/Journey without
-- copying the source wine into the recipient's account. The recipient-facing
-- branch intentionally projects only fields already allowed by the sharing
-- contract; personal price, venue and owner entity IDs stay private.
--
-- A favorite on a shared wine belongs to the recipient. It must not mutate the
-- source owner's favorite flag, so it lives in a small recipient preference row.
CREATE TABLE IF NOT EXISTS shared_wine_preferences (
  recipient_id TEXT NOT NULL REFERENCES app_users(id),
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  wine_id TEXT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(recipient_id,owner_id,wine_id),
  CHECK(owner_id<>recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_wine_preferences_favorite
  ON shared_wine_preferences(recipient_id,favorite,wine_id);
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
  w.price,w.currency,w.classification,w.created_at,w.updated_at,w.photo_sort_at
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
  w.tasting_notes,w.rating,w.tasting_date,
  NULL AS venue,
  coalesce(pref.favorite,0) AS favorite,
  NULL AS price,
  NULL AS currency,
  w.classification,
  g.shared_at AS created_at,
  w.updated_at,
  g.shared_at AS photo_sort_at
FROM grants g
JOIN friendships f
  ON f.user_id=g.recipient_id AND f.friend_id=g.owner_id
JOIN app_users u
  ON u.id=g.owner_id AND u.status='active'
JOIN wines w
  ON w.id=g.wine_id AND w.owner_id=g.owner_id
LEFT JOIN shared_wine_preferences pref
  ON pref.recipient_id=g.recipient_id AND pref.owner_id=g.owner_id AND pref.wine_id=g.wine_id;


-- Journey and Wine Collection caches are keyed by the viewer's existing
-- achievement_cache_state revision. A shared source lives under somebody else's
-- owner_id, so its writes would otherwise leave the recipient's cached Passport,
-- Insights and collection progress stale. These triggers propagate only the
-- invalidation signal; no source wine data is copied.

CREATE TRIGGER shared_visible_rev_wine_share_insert AFTER INSERT ON wine_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_wine_share_delete AFTER DELETE ON wine_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_wine_share_update AFTER UPDATE ON wine_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (SELECT OLD.recipient_id recipient_id UNION SELECT NEW.recipient_id) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_tasting_share_insert AFTER INSERT ON tasting_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_tasting_share_delete AFTER DELETE ON tasting_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_preference_insert AFTER INSERT ON shared_wine_preferences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_preference_update AFTER UPDATE OF favorite ON shared_wine_preferences
WHEN OLD.favorite IS NOT NEW.favorite
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_preference_delete AFTER DELETE ON shared_wine_preferences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_tasting_share_update AFTER UPDATE ON tasting_shares BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (SELECT OLD.recipient_id recipient_id UNION SELECT NEW.recipient_id) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_experience_insert AFTER INSERT ON wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM tasting_shares
  WHERE owner_id=NEW.owner_id AND tasting_id=NEW.tasting_id
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_experience_delete AFTER DELETE ON wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM tasting_shares
  WHERE owner_id=OLD.owner_id AND tasting_id=OLD.tasting_id
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_experience_update AFTER UPDATE ON wine_experiences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM tasting_shares WHERE owner_id=OLD.owner_id AND tasting_id=OLD.tasting_id
    UNION
    SELECT recipient_id FROM tasting_shares WHERE owner_id=NEW.owner_id AND tasting_id=NEW.tasting_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_source_wine_update
AFTER UPDATE OF producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,tasting_notes,rating,tasting_date,classification ON wines BEGIN
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

CREATE TRIGGER shared_visible_rev_photo_insert AFTER INSERT ON shared_photos BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT s.recipient_id
      FROM wine_images i JOIN wine_shares s ON s.owner_id=i.owner_id AND s.wine_id=i.wine_id
      WHERE i.id=NEW.image_id
    UNION
    SELECT ts.recipient_id
      FROM wine_images i
      JOIN wine_experiences we ON we.owner_id=i.owner_id AND we.wine_id=i.wine_id
      JOIN tasting_shares ts ON ts.owner_id=we.owner_id AND ts.tasting_id=we.tasting_id
      WHERE i.id=NEW.image_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_photo_update AFTER UPDATE ON shared_photos BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT s.recipient_id
      FROM wine_images i JOIN wine_shares s ON s.owner_id=i.owner_id AND s.wine_id=i.wine_id
      WHERE i.id=NEW.image_id
    UNION
    SELECT ts.recipient_id
      FROM wine_images i
      JOIN wine_experiences we ON we.owner_id=i.owner_id AND we.wine_id=i.wine_id
      JOIN tasting_shares ts ON ts.owner_id=we.owner_id AND ts.tasting_id=we.tasting_id
      WHERE i.id=NEW.image_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_photo_delete AFTER DELETE ON shared_photos BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT s.recipient_id
      FROM wine_images i JOIN wine_shares s ON s.owner_id=i.owner_id AND s.wine_id=i.wine_id
      WHERE i.id=OLD.image_id
    UNION
    SELECT ts.recipient_id
      FROM wine_images i
      JOIN wine_experiences we ON we.owner_id=i.owner_id AND we.wine_id=i.wine_id
      JOIN tasting_shares ts ON ts.owner_id=we.owner_id AND ts.tasting_id=we.tasting_id
      WHERE i.id=OLD.image_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_friendship_insert AFTER INSERT ON friendships BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.user_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER shared_visible_rev_friendship_delete AFTER DELETE ON friendships BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.user_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_source_status AFTER UPDATE OF status ON app_users
WHEN OLD.status IS NOT NEW.status
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM wine_shares WHERE owner_id=NEW.id
    UNION
    SELECT recipient_id FROM tasting_shares WHERE owner_id=NEW.id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
