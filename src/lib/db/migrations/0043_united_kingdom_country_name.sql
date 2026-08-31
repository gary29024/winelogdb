-- One name for the country, and it is the sovereign state.
--
-- The place tree filed English wine under England with the United Kingdom as an
-- alias, so a wine saved before the tree carried the node at all kept whatever
-- the label or the model said. The result was one producer under United Kingdom
-- and its neighbours under England, in two panels that could not be brought
-- together by any edit.
--
-- The tree now names the country United Kingdom, matching the Passport map,
-- which has always anchored England, Wales, Scotland and Great Britain to it.
-- Migration 0032 has already run and cannot be rewritten to follow a later
-- rename, so the rows it wrote are re-pointed here instead.
UPDATE wines SET country='United Kingdom'
  WHERE trim(COALESCE(country,'')) IN ('England','UK','Great Britain','Wales','Scotland');

-- A wine that named only its country got the country's name in the region
-- column too, there being nothing narrower to put there, so that copy is
-- re-pointed with it. recognized_region is left exactly as it is: it is the
-- record of what the label actually said, which a rename must not touch.
UPDATE wines SET region='United Kingdom'
  WHERE trim(COALESCE(region,'')) IN ('England','UK','Great Britain','Wales','Scotland');

-- The producers page groups on this column, which is where the split showed.
-- Researched producers included: research answers with a country name too, and
-- one spelling per country is the point.
UPDATE producers SET home_country='United Kingdom'
  WHERE trim(COALESCE(home_country,'')) IN ('England','UK','Great Britain','Wales','Scotland');
