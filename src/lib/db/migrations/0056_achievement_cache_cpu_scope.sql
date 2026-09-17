-- Achievement progress depends on identity and tasting fields, not on producer
-- research prose, contacts, images, source lists or timestamps. The original
-- broad UPDATE triggers invalidated the expensive progress cache for every such
-- write, turning routine Deep Search/profile updates into a full achievement
-- rebuild on the next page load.
--
-- Narrow the update triggers to the columns the achievement context actually
-- reads, and only bump the revision when their values changed.

DROP TRIGGER IF EXISTS achievement_rev_wines_update;
CREATE TRIGGER achievement_rev_wines_update
AFTER UPDATE OF producer_id,cuvee_id,producer,wine_name,vintage,appellation,tasting_date ON wines
WHEN OLD.producer_id IS NOT NEW.producer_id
  OR OLD.cuvee_id IS NOT NEW.cuvee_id
  OR OLD.producer IS NOT NEW.producer
  OR OLD.wine_name IS NOT NEW.wine_name
  OR OLD.vintage IS NOT NEW.vintage
  OR OLD.appellation IS NOT NEW.appellation
  OR OLD.tasting_date IS NOT NEW.tasting_date
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

DROP TRIGGER IF EXISTS achievement_rev_producers_update;
CREATE TRIGGER achievement_rev_producers_update
AFTER UPDATE OF canonical_name,home_country,home_region ON producers
WHEN OLD.canonical_name IS NOT NEW.canonical_name
  OR OLD.home_country IS NOT NEW.home_country
  OR OLD.home_region IS NOT NEW.home_region
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

DROP TRIGGER IF EXISTS achievement_rev_producer_aliases_update;
CREATE TRIGGER achievement_rev_producer_aliases_update
AFTER UPDATE OF producer_id,normalized_alias,display_alias ON producer_aliases
WHEN OLD.producer_id IS NOT NEW.producer_id
  OR OLD.normalized_alias IS NOT NEW.normalized_alias
  OR OLD.display_alias IS NOT NEW.display_alias
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

DROP TRIGGER IF EXISTS achievement_rev_cuvees_update;
CREATE TRIGGER achievement_rev_cuvees_update
AFTER UPDATE OF producer_id,canonical_name,appellation,wine_style,catalog_backed ON cuvees
WHEN OLD.producer_id IS NOT NEW.producer_id
  OR OLD.canonical_name IS NOT NEW.canonical_name
  OR OLD.appellation IS NOT NEW.appellation
  OR OLD.wine_style IS NOT NEW.wine_style
  OR OLD.catalog_backed IS NOT NEW.catalog_backed
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

DROP TRIGGER IF EXISTS achievement_rev_cuvee_aliases_update;
CREATE TRIGGER achievement_rev_cuvee_aliases_update
AFTER UPDATE OF producer_id,normalized_alias,appellation_key,cuvee_id,display_alias ON cuvee_aliases
WHEN OLD.producer_id IS NOT NEW.producer_id
  OR OLD.normalized_alias IS NOT NEW.normalized_alias
  OR OLD.appellation_key IS NOT NEW.appellation_key
  OR OLD.cuvee_id IS NOT NEW.cuvee_id
  OR OLD.display_alias IS NOT NEW.display_alias
BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
