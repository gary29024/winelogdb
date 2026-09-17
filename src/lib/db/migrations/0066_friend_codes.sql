-- Codes are permanent account identifiers, not admission invitations or credentials.
CREATE TABLE friend_codes (
 user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
 code TEXT NOT NULL UNIQUE DEFAULT (upper(hex(randomblob(6))))
 CHECK(length(code)=12 AND code NOT GLOB '*[^0-9A-F]*')
);
INSERT INTO friend_codes(user_id) SELECT id FROM app_users;
CREATE TRIGGER assign_friend_code AFTER INSERT ON app_users BEGIN
 INSERT INTO friend_codes(user_id) VALUES(new.id);
END;
CREATE TABLE friend_requests (
 id TEXT PRIMARY KEY,
 sender_id TEXT NOT NULL REFERENCES app_users(id),
 recipient_id TEXT NOT NULL REFERENCES app_users(id),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(sender_id<>recipient_id)
);
CREATE UNIQUE INDEX idx_friend_requests_pending_pair
 ON friend_requests(min(sender_id,recipient_id),max(sender_id,recipient_id)) WHERE status='pending';
CREATE INDEX idx_friend_requests_incoming ON friend_requests(recipient_id,status,created_at);
CREATE INDEX idx_friend_requests_outgoing ON friend_requests(sender_id,status,created_at);
-- Old links must not bypass the new request/acceptance flow.
DELETE FROM friend_links;
