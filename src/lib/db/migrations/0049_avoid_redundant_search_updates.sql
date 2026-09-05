-- Favorites, ratings, photos and research metadata do not change search text.
-- Avoid an FTS delete/insert (and its internal index writes) on those updates.
-- Compare the values actually indexed, including their NULL normalization.
DROP TRIGGER IF EXISTS wines_search_update;
CREATE TRIGGER wines_search_update AFTER UPDATE ON wines
WHEN old.id IS NOT new.id
  OR old.owner_id IS NOT new.owner_id
  OR old.producer IS NOT new.producer
  OR old.wine_name IS NOT new.wine_name
  OR coalesce(old.region,'') IS NOT coalesce(new.region,'')
  OR old.grapes_json IS NOT new.grapes_json
  OR old.tasting_notes IS NOT new.tasting_notes
  OR coalesce(old.event,'') IS NOT coalesce(new.event,'')
  OR old.tags_json IS NOT new.tags_json
BEGIN
  DELETE FROM wine_search WHERE wine_id=old.id;
  INSERT INTO wine_search VALUES(new.id,new.owner_id,new.producer,new.wine_name,coalesce(new.region,''),new.grapes_json,new.tasting_notes,coalesce(new.event,''),new.tags_json);
END;
