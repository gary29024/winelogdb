-- The Wine Journey / Passport view is the application landing page, and every
-- visit ran twelve aggregate scans over the owner's wines. Cache the rendered
-- payload against the same owner revision the achievement cache already uses so
-- an unchanged journal costs a single indexed lookup instead of a full re-scan.
CREATE TABLE IF NOT EXISTS journey_summary_cache (
  owner_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  payload_version INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- achievement_cache_state is now the shared owner revision. It already tracks
-- wines, producers, cuvees and their aliases; the Journey payload additionally
-- reads tasting structures and the first photo of each wine, so those two tables
-- have to bump the revision too or a cached payload could go stale. Nothing cached
-- reads wine_experiences, and every save that touches one also writes its wine row,
-- so that table deliberately stays out of the revision rather than paying for a
-- trigger write on each bulk experience edit.
CREATE TRIGGER IF NOT EXISTS owner_rev_structures_insert AFTER INSERT ON wine_tasting_structures BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS owner_rev_structures_update AFTER UPDATE ON wine_tasting_structures BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS owner_rev_structures_delete AFTER DELETE ON wine_tasting_structures BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS owner_rev_wine_images_insert AFTER INSERT ON wine_images BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS owner_rev_wine_images_delete AFTER DELETE ON wine_images BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

-- Journal, detail and Passport all resolve "the photos of this wine" and "the
-- earliest capture timestamp of this wine". idx_wine_images_wine indexes only
-- wine_id, so each of those lookups had to visit the table. These two indexes
-- carry the projected columns and keep the lookups index-only.
CREATE INDEX IF NOT EXISTS idx_wine_images_owner_wine_id
  ON wine_images(owner_id, wine_id, id);
CREATE INDEX IF NOT EXISTS idx_wine_images_owner_wine_captured
  ON wine_images(owner_id, wine_id, captured_at, metadata_source);
