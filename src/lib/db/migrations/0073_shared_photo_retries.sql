-- A sharing derivative is generated once per photo and cached in shared_photos,
-- so the cost is one transform per photo for all friends and all views. What was
-- missing is a record of attempts that did NOT produce a row: a photo whose
-- original is gone, whose transform errors, or that arrives when the deployment
-- storage cap is full was retried on every friend view, and every retry billed an
-- image transform. This table leases one attempt at a time, so two friends opening
-- the same wine cannot both transform the same photo, and backs a failing photo off
-- instead of retrying it forever. A successful derivative deletes its row.
CREATE TABLE IF NOT EXISTS shared_photo_attempts (
  image_id TEXT PRIMARY KEY REFERENCES wine_images(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES app_users(id),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  error TEXT,
  retry_after TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- image_id is the primary key and is the lookup key on the shared-wine read
-- path, so no secondary index is needed here. Avoid extra index maintenance on
-- this short-lived lease table.
