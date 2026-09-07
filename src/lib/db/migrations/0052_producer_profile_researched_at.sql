-- Catalog research also updates researched_at, so it cannot date the profile.
-- Leave existing profiles undated: the next requested research run refreshes
-- them once rather than trusting a possibly newer catalog timestamp.
ALTER TABLE producers ADD COLUMN profile_researched_at TEXT;
