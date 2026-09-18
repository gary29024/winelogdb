-- Shared journal thumbnails are persisted beside the full sharing copy.
-- The original cleanup trigger predates them and therefore queued only
-- shared/<owner>/<image>.jpg when a wine image disappeared, leaving the
-- -thumb.jpg object in R2 and in storage accounting indefinitely.
DROP TRIGGER IF EXISTS shared_photo_cleanup;
CREATE TRIGGER shared_photo_cleanup AFTER DELETE ON shared_photos BEGIN
  INSERT OR IGNORE INTO storage_deletions(object_key,owner_id)
    VALUES(old.object_key,old.owner_id);
  INSERT OR IGNORE INTO storage_deletions(object_key,owner_id)
    VALUES('shared/' || old.owner_id || '/' || old.image_id || '-thumb.jpg',old.owner_id);
END;
