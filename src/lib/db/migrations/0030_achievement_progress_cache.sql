CREATE TABLE IF NOT EXISTS achievement_cache_state (
  owner_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievement_progress_cache (
  owner_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  definition_version INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievement_collection_preferences (
  owner_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'exact' CHECK(match_mode IN ('exact','cuvee','producer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,collection_id)
);

CREATE TRIGGER IF NOT EXISTS achievement_rev_wines_insert AFTER INSERT ON wines BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_wines_update AFTER UPDATE ON wines BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_wines_delete AFTER DELETE ON wines BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_producers_insert AFTER INSERT ON producers BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_producers_update AFTER UPDATE ON producers BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_producers_delete AFTER DELETE ON producers BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_producer_aliases_insert AFTER INSERT ON producer_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_producer_aliases_update AFTER UPDATE ON producer_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_producer_aliases_delete AFTER DELETE ON producer_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvees_insert AFTER INSERT ON cuvees BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvees_update AFTER UPDATE ON cuvees BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvees_delete AFTER DELETE ON cuvees BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvee_aliases_insert AFTER INSERT ON cuvee_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvee_aliases_update AFTER UPDATE ON cuvee_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_cuvee_aliases_delete AFTER DELETE ON cuvee_aliases BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_custom_insert AFTER INSERT ON achievement_custom_collections BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_custom_update AFTER UPDATE ON achievement_custom_collections BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_custom_delete AFTER DELETE ON achievement_custom_collections BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS achievement_rev_preferences_insert AFTER INSERT ON achievement_collection_preferences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_preferences_update AFTER UPDATE ON achievement_collection_preferences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(NEW.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TRIGGER IF NOT EXISTS achievement_rev_preferences_delete AFTER DELETE ON achievement_collection_preferences BEGIN
  INSERT INTO achievement_cache_state(owner_id,revision,updated_at) VALUES(OLD.owner_id,1,CURRENT_TIMESTAMP)
  ON CONFLICT(owner_id) DO UPDATE SET revision=achievement_cache_state.revision+1,updated_at=CURRENT_TIMESTAMP;
END;
