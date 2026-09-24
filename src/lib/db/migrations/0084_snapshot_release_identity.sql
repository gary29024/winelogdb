-- A Deep Search snapshot records the non-vintage release it was researched for
-- (deep_search_json.release). Snapshots saved before that record nothing, and
-- editing a bottle keeps its snapshot. When a bottle's release identity (its
-- edition, base year, disgorgement or vintage) changes, stamp such a snapshot
-- with the identity it had before the change, so it can never be taken for
-- research on the new release. Every writer is covered: the wine form, LWIN
-- enrichment, reference review and the sparkling details.
-- The identity matches researchEditionOfRow: null for a vintage wine or one
-- with nothing recorded, else {releaseDesignation, baseVintage, disgorgement}.

CREATE TRIGGER wines_release_identity_marks_snapshot
AFTER UPDATE OF release_designation,vintage ON wines
WHEN OLD.release_designation IS NOT NEW.release_designation OR OLD.vintage IS NOT NEW.vintage
BEGIN
  UPDATE wines SET deep_search_json=json_set(deep_search_json,'$.release',
    json(CASE WHEN OLD.vintage IS NOT NULL THEN NULL
      WHEN nullif(trim(coalesce(OLD.release_designation,'')),'') IS NULL AND (CASE WHEN json_type((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.baseVintage') IN ('integer','real') THEN json_extract((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.baseVintage') END) IS NULL AND nullif(trim(CASE WHEN json_type((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.disgorgement')='text' THEN json_extract((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.disgorgement') END),'') IS NULL THEN NULL
      ELSE json_object('releaseDesignation',nullif(trim(coalesce(OLD.release_designation,'')),''),'baseVintage',CASE WHEN json_type((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.baseVintage') IN ('integer','real') THEN json_extract((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.baseVintage') END,'disgorgement',nullif(trim(CASE WHEN json_type((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.disgorgement')='text' THEN json_extract((SELECT sd.details_json FROM wine_sparkling_details sd WHERE sd.owner_id=NEW.owner_id AND sd.wine_id=NEW.id),'$.disgorgement') END),'')) END))
  WHERE owner_id=NEW.owner_id AND id=NEW.id AND deep_search_json IS NOT NULL AND json_valid(deep_search_json) AND json_type(deep_search_json,'$.release') IS NULL;
END;

CREATE TRIGGER sparkling_insert_marks_snapshot
AFTER INSERT ON wine_sparkling_details
WHEN json_type(NEW.details_json,'$.baseVintage') IN ('integer','real') OR nullif(trim(CASE WHEN json_type(NEW.details_json,'$.disgorgement')='text' THEN json_extract(NEW.details_json,'$.disgorgement') END),'') IS NOT NULL
BEGIN
  UPDATE wines SET deep_search_json=json_set(deep_search_json,'$.release',
    json(CASE WHEN (SELECT vintage FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id) IS NOT NULL THEN NULL
      WHEN nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id),'')),'') IS NULL AND (CASE WHEN json_type(NULL,'$.baseVintage') IN ('integer','real') THEN json_extract(NULL,'$.baseVintage') END) IS NULL AND nullif(trim(CASE WHEN json_type(NULL,'$.disgorgement')='text' THEN json_extract(NULL,'$.disgorgement') END),'') IS NULL THEN NULL
      ELSE json_object('releaseDesignation',nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id),'')),''),'baseVintage',CASE WHEN json_type(NULL,'$.baseVintage') IN ('integer','real') THEN json_extract(NULL,'$.baseVintage') END,'disgorgement',nullif(trim(CASE WHEN json_type(NULL,'$.disgorgement')='text' THEN json_extract(NULL,'$.disgorgement') END),'')) END))
  WHERE owner_id=NEW.owner_id AND id=NEW.wine_id AND deep_search_json IS NOT NULL AND json_valid(deep_search_json) AND json_type(deep_search_json,'$.release') IS NULL;
END;

CREATE TRIGGER sparkling_update_marks_snapshot
AFTER UPDATE OF details_json ON wine_sparkling_details
WHEN json_extract(OLD.details_json,'$.baseVintage') IS NOT json_extract(NEW.details_json,'$.baseVintage')
  OR json_extract(OLD.details_json,'$.disgorgement') IS NOT json_extract(NEW.details_json,'$.disgorgement')
BEGIN
  UPDATE wines SET deep_search_json=json_set(deep_search_json,'$.release',
    json(CASE WHEN (SELECT vintage FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id) IS NOT NULL THEN NULL
      WHEN nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id),'')),'') IS NULL AND (CASE WHEN json_type(OLD.details_json,'$.baseVintage') IN ('integer','real') THEN json_extract(OLD.details_json,'$.baseVintage') END) IS NULL AND nullif(trim(CASE WHEN json_type(OLD.details_json,'$.disgorgement')='text' THEN json_extract(OLD.details_json,'$.disgorgement') END),'') IS NULL THEN NULL
      ELSE json_object('releaseDesignation',nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=NEW.owner_id AND id=NEW.wine_id),'')),''),'baseVintage',CASE WHEN json_type(OLD.details_json,'$.baseVintage') IN ('integer','real') THEN json_extract(OLD.details_json,'$.baseVintage') END,'disgorgement',nullif(trim(CASE WHEN json_type(OLD.details_json,'$.disgorgement')='text' THEN json_extract(OLD.details_json,'$.disgorgement') END),'')) END))
  WHERE owner_id=NEW.owner_id AND id=NEW.wine_id AND deep_search_json IS NOT NULL AND json_valid(deep_search_json) AND json_type(deep_search_json,'$.release') IS NULL;
END;

CREATE TRIGGER sparkling_delete_marks_snapshot
AFTER DELETE ON wine_sparkling_details
BEGIN
  UPDATE wines SET deep_search_json=json_set(deep_search_json,'$.release',
    json(CASE WHEN (SELECT vintage FROM wines WHERE owner_id=OLD.owner_id AND id=OLD.wine_id) IS NOT NULL THEN NULL
      WHEN nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=OLD.owner_id AND id=OLD.wine_id),'')),'') IS NULL AND (CASE WHEN json_type(OLD.details_json,'$.baseVintage') IN ('integer','real') THEN json_extract(OLD.details_json,'$.baseVintage') END) IS NULL AND nullif(trim(CASE WHEN json_type(OLD.details_json,'$.disgorgement')='text' THEN json_extract(OLD.details_json,'$.disgorgement') END),'') IS NULL THEN NULL
      ELSE json_object('releaseDesignation',nullif(trim(coalesce((SELECT release_designation FROM wines WHERE owner_id=OLD.owner_id AND id=OLD.wine_id),'')),''),'baseVintage',CASE WHEN json_type(OLD.details_json,'$.baseVintage') IN ('integer','real') THEN json_extract(OLD.details_json,'$.baseVintage') END,'disgorgement',nullif(trim(CASE WHEN json_type(OLD.details_json,'$.disgorgement')='text' THEN json_extract(OLD.details_json,'$.disgorgement') END),'')) END))
  WHERE owner_id=OLD.owner_id AND id=OLD.wine_id AND deep_search_json IS NOT NULL AND json_valid(deep_search_json) AND json_type(deep_search_json,'$.release') IS NULL;
END;
