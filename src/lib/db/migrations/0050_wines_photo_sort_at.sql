-- Journal chronology within a day is the photograph's own capture time, and it
-- was a correlated subquery in the ORDER BY. A subquery cannot be indexed, so
-- SQLite abandoned idx_wines_owner_journal_date, sorted every one of an owner's
-- wines in a temp B-tree and evaluated all three per-row subqueries before the
-- LIMIT applied. Measured on a 2,055-wine fixture: one page of the Journal read
-- the whole library four times over.
--
-- Materialised here, maintained by the triggers below, so the page is an index
-- walk that stops at the rows it returns. Nullable: a wine with no dated
-- photograph falls back to its own created_at, exactly as the subquery did.
ALTER TABLE wines ADD COLUMN photo_sort_at TEXT;

UPDATE wines SET photo_sort_at=(
  SELECT wi.captured_at FROM wine_images wi
  WHERE wi.owner_id=wines.owner_id AND wi.wine_id=wines.id AND wi.captured_at IS NOT NULL
  ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1);

-- The whole sort key, in the order the Journal asks for it, so newest and oldest
-- are both an index walk. The tiebreakers are in it too: without them SQLite
-- dropped the index entirely and sorted the lot, which is why the index added
-- for this in 0044 never once got used.
CREATE INDEX IF NOT EXISTS idx_wines_owner_journal_order
  ON wines(owner_id, coalesce(tasting_date,created_at) DESC, coalesce(photo_sort_at,created_at) DESC, created_at DESC, id DESC);

-- 0044's index is a strict prefix of the one above, so anything that could have
-- used it can use this instead - and it never actually got used, because the
-- tiebreakers it lacks were enough to make SQLite sort the lot anyway. Dropping
-- it takes one index off every write to the busiest table in the database.
DROP INDEX IF EXISTS idx_wines_owner_journal_date;

-- Kept in step with the photographs. Each guarded on the value actually
-- changing, so adding a second picture to a wine that already had a dated one
-- writes nothing and bumps no revision.
DROP TRIGGER IF EXISTS wine_images_photo_sort_insert;
CREATE TRIGGER wine_images_photo_sort_insert AFTER INSERT ON wine_images BEGIN
  UPDATE wines SET photo_sort_at=(
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=new.owner_id AND wi.wine_id=new.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1)
  WHERE owner_id=new.owner_id AND id=new.wine_id AND photo_sort_at IS NOT (
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=new.owner_id AND wi.wine_id=new.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1);
END;

DROP TRIGGER IF EXISTS wine_images_photo_sort_delete;
CREATE TRIGGER wine_images_photo_sort_delete AFTER DELETE ON wine_images BEGIN
  UPDATE wines SET photo_sort_at=(
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=old.owner_id AND wi.wine_id=old.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1)
  WHERE owner_id=old.owner_id AND id=old.wine_id AND photo_sort_at IS NOT (
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=old.owner_id AND wi.wine_id=old.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1);
END;

-- Only the columns the answer is made of. A photo re-pointed at another wine
-- has to settle both, so the wine it left is handled by its own trigger.
DROP TRIGGER IF EXISTS wine_images_photo_sort_update;
CREATE TRIGGER wine_images_photo_sort_update AFTER UPDATE ON wine_images
WHEN old.captured_at IS NOT new.captured_at
  OR old.metadata_source IS NOT new.metadata_source
  OR old.wine_id IS NOT new.wine_id
  OR old.owner_id IS NOT new.owner_id
BEGIN
  UPDATE wines SET photo_sort_at=(
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=new.owner_id AND wi.wine_id=new.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1)
  WHERE owner_id=new.owner_id AND id=new.wine_id AND photo_sort_at IS NOT (
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=new.owner_id AND wi.wine_id=new.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1);
END;

DROP TRIGGER IF EXISTS wine_images_photo_sort_moved;
CREATE TRIGGER wine_images_photo_sort_moved AFTER UPDATE ON wine_images
WHEN old.wine_id IS NOT new.wine_id OR old.owner_id IS NOT new.owner_id
BEGIN
  UPDATE wines SET photo_sort_at=(
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=old.owner_id AND wi.wine_id=old.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1)
  WHERE owner_id=old.owner_id AND id=old.wine_id AND photo_sort_at IS NOT (
    SELECT wi.captured_at FROM wine_images wi
    WHERE wi.owner_id=old.owner_id AND wi.wine_id=old.wine_id AND wi.captured_at IS NOT NULL
    ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1);
END;
