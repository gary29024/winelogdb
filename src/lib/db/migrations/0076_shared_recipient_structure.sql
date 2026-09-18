-- 0075 gave the recipient their own rating, date, event, venue, location, price
-- and notes, on the principle that the drinking experience belongs to whoever
-- drank it. Perceived structure is the same kind of thing and was the one part
-- of a tasting left out: a recipient could score a shared bottle 91 and write
-- notes about it, but had nowhere to record that they found it high-acid.
--
-- It lives beside the rest of that experience rather than in
-- wine_tasting_structures, whose primary key is (owner_id, wine_id) and which
-- therefore describes the wine's owner, not its viewer.
ALTER TABLE shared_wine_preferences ADD COLUMN structure_json TEXT;

-- The recipient's Passport and Insights caches key off this revision, so a
-- structure edit has to bump it the way every other experience field does.
DROP TRIGGER IF EXISTS shared_visible_rev_preference_update;
CREATE TRIGGER shared_visible_rev_preference_update
AFTER UPDATE OF favorite,tasting_notes,rating,tasting_date,tasting_name,venue,location_name,price,currency,structure_json ON shared_wine_preferences
WHEN OLD.favorite IS NOT NEW.favorite
  OR OLD.tasting_notes IS NOT NEW.tasting_notes
  OR OLD.rating IS NOT NEW.rating
  OR OLD.tasting_date IS NOT NEW.tasting_date
  OR OLD.tasting_name IS NOT NEW.tasting_name
  OR OLD.venue IS NOT NEW.venue
  OR OLD.location_name IS NOT NEW.location_name
  OR OLD.price IS NOT NEW.price
  OR OLD.currency IS NOT NEW.currency
  OR OLD.structure_json IS NOT NEW.structure_json
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.recipient_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
