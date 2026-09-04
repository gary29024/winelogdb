-- Reported as: producer research often comes back with a meaningless
-- photograph. No rule can judge "meaningful", so the person looking at it gets
-- to say - and the rejection has to outlive the next research run, or refreshing
-- would put the same picture straight back.
--
-- The URL rather than a flag, so a site that changes its own picture is allowed
-- to offer the new one.
ALTER TABLE producers ADD COLUMN hero_image_rejected_url TEXT;
