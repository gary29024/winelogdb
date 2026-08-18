ALTER TABLE producers ADD COLUMN instagram_url TEXT;
ALTER TABLE producers ADD COLUMN contact_email TEXT;
ALTER TABLE producers ADD COLUMN contact_phone TEXT;
ALTER TABLE producers ADD COLUMN contact_sources_json TEXT NOT NULL DEFAULT '[]';
