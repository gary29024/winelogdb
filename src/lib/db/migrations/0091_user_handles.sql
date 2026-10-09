-- A unique @handle per account, so two members with the same display name can
-- be told apart and found by typing it. Stored lowercase without the "@".
-- Everything that links people (friendships, shares, tastings) uses app_users.id,
-- so changing a handle never touches those links. Existing accounts get a handle
-- from their name the next time the worker sees one without (see handles.ts);
-- NULL is allowed until then and the unique index ignores NULLs.
ALTER TABLE app_users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_app_users_handle ON app_users(handle);
