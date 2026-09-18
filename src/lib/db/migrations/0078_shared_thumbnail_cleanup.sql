-- Sharing now reuses the owner's canonical original and thumb/v1 thumbnail
-- instead of storing a second copy under shared/. Queue every legacy duplicate
-- for the existing durable R2 cleanup, then retire the sharing-copy state.
INSERT OR IGNORE INTO storage_deletions(object_key,owner_id)
SELECT object_key,owner_id FROM stored_objects WHERE object_key LIKE 'shared/%';

DELETE FROM shared_photo_attempts;
DELETE FROM shared_photos;

DROP TRIGGER IF EXISTS shared_photo_cleanup;
DROP TRIGGER IF EXISTS shared_visible_rev_photo_insert;
DROP TRIGGER IF EXISTS shared_visible_rev_photo_update;
DROP TRIGGER IF EXISTS shared_visible_rev_photo_delete;

-- Recipient Journey/Passport/Insights still need to refresh when the canonical
-- photo set changes. Move that signal to wine_images, which is now the one source
-- of truth for both owner and recipient image delivery.
CREATE TRIGGER shared_visible_rev_photo_insert
AFTER INSERT ON wine_images
WHEN NEW.wine_id IS NOT NULL
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM wine_shares
      WHERE owner_id=NEW.owner_id AND wine_id=NEW.wine_id
    UNION
    SELECT ts.recipient_id FROM tasting_shares ts
      JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
      WHERE ts.owner_id=NEW.owner_id AND we.wine_id=NEW.wine_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE
    SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_photo_delete
AFTER DELETE ON wine_images
WHEN OLD.wine_id IS NOT NULL
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM wine_shares
      WHERE owner_id=OLD.owner_id AND wine_id=OLD.wine_id
    UNION
    SELECT ts.recipient_id FROM tasting_shares ts
      JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
      WHERE ts.owner_id=OLD.owner_id AND we.wine_id=OLD.wine_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE
    SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER shared_visible_rev_photo_update
AFTER UPDATE OF owner_id,wine_id,object_key ON wine_images
WHEN OLD.owner_id IS NOT NEW.owner_id
  OR OLD.wine_id IS NOT NEW.wine_id
  OR OLD.object_key IS NOT NEW.object_key
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at)
  SELECT recipient_id,1,CURRENT_TIMESTAMP FROM (
    SELECT recipient_id FROM wine_shares
      WHERE owner_id=OLD.owner_id AND wine_id=OLD.wine_id
    UNION
    SELECT ts.recipient_id FROM tasting_shares ts
      JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
      WHERE ts.owner_id=OLD.owner_id AND we.wine_id=OLD.wine_id
    UNION
    SELECT recipient_id FROM wine_shares
      WHERE owner_id=NEW.owner_id AND wine_id=NEW.wine_id
    UNION
    SELECT ts.recipient_id FROM tasting_shares ts
      JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
      WHERE ts.owner_id=NEW.owner_id AND we.wine_id=NEW.wine_id
  ) WHERE true
  ON CONFLICT(owner_id) DO UPDATE
    SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
