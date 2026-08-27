-- How many wines a call covered.
--
-- "Cost per run" means different things for the five kinds. A producer Deep
-- Search is one producer, but a batch scan run is a whole session of a dozen
-- bottles and a group photo is one request covering every wine on the table -
-- so a per-run figure for those reads as a bargain or a disaster depending on
-- how many wines happened to be in it. Recognition is quoted per wine instead,
-- and that needs the count recorded at the time.
ALTER TABLE ai_usage_events ADD COLUMN units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage_monthly ADD COLUMN units INTEGER NOT NULL DEFAULT 0;
