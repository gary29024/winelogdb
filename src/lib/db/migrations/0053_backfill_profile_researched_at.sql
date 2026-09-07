-- Recovers the profile dates that can be recovered, so that every producer
-- does not pay for one more profile research than it needs.
--
-- 0052 left every row undated on the grounds that researched_at may describe a
-- catalog refresh rather than the profile. True in general - but not for the
-- rows whose last research write was the profile save itself, and those say so:
-- a profile save stamps research_model '... (batch profile)' while a catalog
-- refresh stamps '... (atomic bounded catalog)'. Where the profile wrote last,
-- researched_at IS the profile's date.
--
-- Deliberately one-directional. A row whose model names the catalog stays
-- undated and is researched once more, which is the harmless direction; a row
-- claimed here can only be a profile save's own timestamp.
UPDATE producers
   SET profile_researched_at=researched_at
 WHERE profile_researched_at IS NULL
   AND researched_at IS NOT NULL
   AND research_model LIKE '%(batch profile)'
   AND trim(coalesce(profile,''))<>'';
