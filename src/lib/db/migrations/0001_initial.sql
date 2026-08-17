CREATE TABLE wines (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, producer TEXT NOT NULL, wine_name TEXT NOT NULL, vintage INTEGER,
 country TEXT, region TEXT, appellation TEXT, grapes_json TEXT NOT NULL DEFAULT '[]', wine_style TEXT, alcohol_percentage REAL,
 tasting_notes TEXT NOT NULL DEFAULT '', rating REAL, tasting_date TEXT, event TEXT, venue TEXT, price REAL, currency TEXT,
 tags_json TEXT NOT NULL DEFAULT '[]', recognition_status TEXT NOT NULL DEFAULT 'pending', recognition_confidence REAL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE wine_images (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, wine_id TEXT REFERENCES wines(id) ON DELETE SET NULL, object_key TEXT NOT NULL UNIQUE,
 content_type TEXT NOT NULL, byte_size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 upload_status TEXT NOT NULL, recognition_status TEXT NOT NULL DEFAULT 'pending', error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_wines_owner_created ON wines(owner_id, created_at DESC);
CREATE INDEX idx_wines_owner_rating ON wines(owner_id, rating DESC);
CREATE INDEX idx_wines_owner_filters ON wines(owner_id, country, region, wine_style, vintage);
CREATE INDEX idx_wines_owner_tasting_date ON wines(owner_id, tasting_date DESC);
CREATE INDEX idx_wine_images_wine ON wine_images(wine_id);
CREATE VIRTUAL TABLE wine_search USING fts5(wine_id UNINDEXED, owner_id UNINDEXED, producer, wine_name, region, grapes, tasting_notes, event, tags);
CREATE TRIGGER wines_search_insert AFTER INSERT ON wines BEGIN
 INSERT INTO wine_search VALUES(new.id,new.owner_id,new.producer,new.wine_name,coalesce(new.region,''),new.grapes_json,new.tasting_notes,coalesce(new.event,''),new.tags_json);
END;
CREATE TRIGGER wines_search_update AFTER UPDATE ON wines BEGIN
 DELETE FROM wine_search WHERE wine_id=old.id;
 INSERT INTO wine_search VALUES(new.id,new.owner_id,new.producer,new.wine_name,coalesce(new.region,''),new.grapes_json,new.tasting_notes,coalesce(new.event,''),new.tags_json);
END;
CREATE TRIGGER wines_search_delete AFTER DELETE ON wines BEGIN
 DELETE FROM wine_search WHERE wine_id=old.id;
END;
