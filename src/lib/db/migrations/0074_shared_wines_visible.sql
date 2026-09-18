-- Shared wines participate in the recipient's read-only Journal/Journey without
-- copying the source wine into the recipient's account. The recipient-facing
-- branch intentionally projects only fields already allowed by the sharing
-- contract; personal price, venue and owner entity IDs stay private.
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
  0 AS favorite,
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
  ON w.id=g.wine_id AND w.owner_id=g.owner_id;
