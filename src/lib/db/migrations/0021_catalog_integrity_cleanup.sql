-- Repair producer catalog entries where a model returned valid outer JSON but
-- swallowed part of a neighbouring record into a string field. Keep reliable
-- core identity fields; clear contaminated optional metadata rather than
-- inventing replacement text. Entries whose name itself is structurally
-- corrupted are omitted from the repaired catalog.
UPDATE producers
SET catalog_json = COALESCE((
  SELECT json_group_array(json_object(
    'name', trim(json_extract(j.value,'$.name')),
    'category', CASE
      WHEN lower(trim(COALESCE(json_extract(j.value,'$.category'),''))) IN ('red','white','rose','sparkling','dessert','fortified','orange','other')
      THEN lower(trim(json_extract(j.value,'$.category')))
      ELSE 'other'
    END,
    'appellation', CASE
      WHEN json_type(j.value,'$.appellation')='text'
       AND instr(json_extract(j.value,'$.appellation'),'},{')=0
       AND instr(json_extract(j.value,'$.appellation'),'],[')=0
       AND instr(lower(json_extract(j.value,'$.appellation')),'notes null')=0
       AND instr(lower(json_extract(j.value,'$.appellation')),'"notes":')=0
      THEN trim(json_extract(j.value,'$.appellation')) ELSE NULL END,
    'classification', CASE
      WHEN json_type(j.value,'$.classification')='text'
       AND instr(json_extract(j.value,'$.classification'),'},{')=0
       AND instr(json_extract(j.value,'$.classification'),'],[')=0
       AND instr(lower(json_extract(j.value,'$.classification')),'notes null')=0
       AND instr(lower(json_extract(j.value,'$.classification')),'"notes":')=0
      THEN trim(json_extract(j.value,'$.classification')) ELSE NULL END,
    'style', CASE
      WHEN json_type(j.value,'$.style')='text'
       AND instr(json_extract(j.value,'$.style'),'},{')=0
       AND instr(json_extract(j.value,'$.style'),'],[')=0
       AND instr(lower(json_extract(j.value,'$.style')),'notes null')=0
       AND instr(lower(json_extract(j.value,'$.style')),'"notes":')=0
      THEN trim(json_extract(j.value,'$.style')) ELSE NULL END,
    'notes', CASE
      WHEN json_type(j.value,'$.notes')='text'
       AND instr(json_extract(j.value,'$.notes'),'},{')=0
       AND instr(json_extract(j.value,'$.notes'),'],[')=0
       AND instr(lower(json_extract(j.value,'$.notes')),'name null')=0
       AND instr(lower(json_extract(j.value,'$.notes')),'"name":')=0
      THEN trim(json_extract(j.value,'$.notes')) ELSE NULL END
  ))
  FROM json_each(producers.catalog_json) AS j
  WHERE json_type(j.value,'$.name')='text'
    AND trim(json_extract(j.value,'$.name'))<>''
    AND instr(json_extract(j.value,'$.name'),'},{')=0
    AND instr(json_extract(j.value,'$.name'),'],[')=0
), '[]'),
updated_at=datetime('now')
WHERE json_valid(catalog_json)
  AND json_type(catalog_json)='array'
  AND EXISTS (
    SELECT 1 FROM json_each(producers.catalog_json) AS bad
    WHERE instr(COALESCE(json_extract(bad.value,'$.name'),''),'},{')>0
       OR instr(COALESCE(json_extract(bad.value,'$.name'),''),'],[')>0
       OR instr(COALESCE(json_extract(bad.value,'$.appellation'),''),'},{')>0
       OR instr(COALESCE(json_extract(bad.value,'$.classification'),''),'},{')>0
       OR instr(COALESCE(json_extract(bad.value,'$.style'),''),'},{')>0
       OR instr(COALESCE(json_extract(bad.value,'$.notes'),''),'},{')>0
       OR instr(lower(COALESCE(json_extract(bad.value,'$.style'),'')),'notes null')>0
       OR instr(lower(COALESCE(json_extract(bad.value,'$.style'),'')),'"notes":')>0
       OR instr(lower(COALESCE(json_extract(bad.value,'$.notes'),'')),'"name":')>0
  );
