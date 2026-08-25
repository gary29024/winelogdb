-- Barossa is a zone GI holding two region GIs, Barossa Valley and Eden Valley.
-- The tree carried it as an alias of Barossa Valley, so 0032 rewrote every wine
-- labelled "Barossa" - usually a blend across both valleys - as a Barossa Valley
-- wine, and counted it as one on the Passport.
--
-- The reading is recoverable because 0032 preserved the original in
-- recognized_region and recognized_appellation before rewriting anything. A row
-- moves only where the label said Barossa and did not say Barossa Valley.

UPDATE wines SET region='Barossa'
  WHERE region='Barossa Valley' AND trim(COALESCE(appellation,''))=''
  AND lower(trim(COALESCE(recognized_region,'')))='barossa'
  AND lower(trim(COALESCE(recognized_appellation,''))) NOT LIKE '%barossa valley%';

UPDATE wines SET region='Barossa'
  WHERE region='Barossa Valley' AND trim(COALESCE(appellation,''))=''
  AND lower(trim(COALESCE(recognized_appellation,'')))='barossa'
  AND lower(trim(COALESCE(recognized_region,''))) NOT LIKE '%barossa valley%';

-- Frankland River is a subregion of Great Southern rather than a sibling of it,
-- so it belongs in the appellation column under its parent region - which also
-- lets it roll up into Great Southern on the Passport.
--
-- Two shapes to move, in this order: a row with nothing narrower takes Frankland
-- River as its appellation, and one that already names a vineyard 0032 could not
-- resolve keeps that name. Either way the region column becomes Great Southern.
UPDATE wines SET appellation='Frankland River'
  WHERE region='Frankland River' AND trim(COALESCE(appellation,''))='';
UPDATE wines SET region='Great Southern' WHERE region='Frankland River';
