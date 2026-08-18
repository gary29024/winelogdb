UPDATE producers
SET home_country=(
      SELECT min(trim(w.country))
      FROM wines w
      WHERE w.owner_id=producers.owner_id
        AND w.producer_id=producers.id
        AND trim(coalesce(w.country,''))<>''
    ),
    updated_at=datetime('now')
WHERE researched_at IS NULL
  AND trim(coalesce(home_country,''))=''
  AND (
    SELECT count(DISTINCT lower(trim(w.country)))
    FROM wines w
    WHERE w.owner_id=producers.owner_id
      AND w.producer_id=producers.id
      AND trim(coalesce(w.country,''))<>''
  )=1;
