-- Sharing 36 wines at once put all 36 at the same instant in the recipient's
-- journal. 0074/0075 gave a shared row g.shared_at for created_at and for
-- photo_sort_at, and its tasting_date came only from the recipient's own
-- preference row, which is empty until they log something. The newest order is
-- journal_date DESC, photo_sort DESC, created_at DESC, id DESC, so with a bulk
-- share the first three keys tied for every wine and the visible order fell
-- through to wine id - arbitrary to a reader - with all of them bucketed into
-- the month they were received rather than the month they were drunk.
--
-- A shared bottle now sorts on the dates the wine itself carries, so a friend's
-- journal reads in the same order as the owner's and as their own logging. The
-- recipient's own date still wins the moment they record one: it is their entry.
--
-- This is a deliberate narrowing of 0075. That migration kept the source
-- owner's tasting_date away from recipients along with their notes, score,
-- venue and price. The date now reaches a recipient, because ordering and month
-- grouping are unusable without it, and a reader can infer roughly when a
-- friend drank a bottle they were shown. The notes, score, venue, location and
-- price stay exactly as private as they were.
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
  COALESCE(pref.tasting_notes,''),pref.rating,
  -- The recipient's own drinking date when they have logged one, otherwise the
  -- date the wine carries, so the bottle lands in the month it was drunk.
  COALESCE(pref.tasting_date,w.tasting_date),
  pref.venue,
  COALESCE(pref.favorite,0),
  pref.price,pref.currency,
  w.classification,
  g.shared_at AS created_at,
  w.updated_at,
  -- tasting_date is a day, so a bulk share of bottles drunk on the same day
  -- would still tie. This carries the wine's own timestamp as the next key,
  -- which is what orders the owner's journal too.
  COALESCE(w.photo_sort_at,w.created_at) AS photo_sort_at,
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

-- 0075 dropped tasting_date and photo_sort_at from this trigger because
-- recipients no longer read them. They do again, so a correction to either on
-- the source wine has to rebuild the recipients' cached Passport and Insights -
-- otherwise a re-dated bottle keeps its old position in a friend's journal.
DROP TRIGGER IF EXISTS shared_visible_rev_source_wine_update;
CREATE TRIGGER shared_visible_rev_source_wine_update
AFTER UPDATE OF producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,classification,tasting_date,photo_sort_at ON wines BEGIN
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

-- Every recipient's cached payload was built while a shared bottle sorted on
-- the moment it was received, so force one rebuild for each of them.
INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
  SELECT recipient_id FROM wine_shares
  UNION
  SELECT recipient_id FROM tasting_shares
) WHERE true
ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
