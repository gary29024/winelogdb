CREATE TABLE provider_operations (
 id TEXT PRIMARY KEY,operation_id TEXT NOT NULL REFERENCES credit_operations(id),
 state TEXT NOT NULL CHECK(state IN ('submitted','saved','uncertain')),
 response_status INTEGER,response_headers TEXT,response_body TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE INDEX idx_provider_operation_state ON provider_operations(operation_id,state);
CREATE INDEX idx_vertex_batch_display ON vertex_batch_emulation_jobs(display_name);
CREATE TABLE sheet_continuations(parent_operation_id TEXT PRIMARY KEY REFERENCES credit_operations(id),operation_id TEXT NOT NULL UNIQUE REFERENCES credit_operations(id));
CREATE TABLE storage_deletions(object_key TEXT PRIMARY KEY,owner_id TEXT NOT NULL);
CREATE TRIGGER shared_photo_cleanup AFTER DELETE ON shared_photos BEGIN
 INSERT OR IGNORE INTO storage_deletions(object_key,owner_id) VALUES(old.object_key,old.owner_id);
END;
