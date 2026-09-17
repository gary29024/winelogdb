-- Reuse ranked Smart-search results while the underlying semantic index is unchanged.
-- The revision row makes cache validation O(1) and prevents background index refreshes
-- from racing with a query that is still ranking an older candidate snapshot.
CREATE TABLE wine_semantic_index_state (
  owner_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,model_key)
);

-- Existing deployments can already have vectors from migration 0057. Seed one
-- revision for every populated model so a cache written after this migration has
-- an explicit index generation to bind to.
INSERT INTO wine_semantic_index_state(owner_id,model_key,revision,updated_at)
SELECT owner_id,model_key,1,MAX(updated_at)
FROM wine_semantic_embeddings
GROUP BY owner_id,model_key;

CREATE TABLE wine_semantic_query_cache (
  owner_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  query_key TEXT NOT NULL,
  index_revision INTEGER NOT NULL CHECK(index_revision >= 0),
  max_results INTEGER NOT NULL CHECK(max_results > 0),
  result_ids_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,model_key,query_key)
);

CREATE INDEX idx_wine_semantic_query_cache_owner_updated
  ON wine_semantic_query_cache(owner_id,model_key,updated_at);

-- Wine deletion cascades into wine_semantic_embeddings outside semanticSearch.ts.
-- Bump the model revision here so a cached ranking that still contains the deleted
-- wine is never considered current. Inserts/updates are revisioned once per refresh
-- batch in semanticSearch.ts to avoid one extra state write for every embedded wine.
CREATE TRIGGER wine_semantic_embeddings_delete_revision
AFTER DELETE ON wine_semantic_embeddings
BEGIN
  INSERT OR IGNORE INTO wine_semantic_index_state(owner_id,model_key,revision,updated_at)
  VALUES(OLD.owner_id,OLD.model_key,0,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

  UPDATE wine_semantic_index_state
  SET revision=revision+1,
      updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE owner_id=OLD.owner_id AND model_key=OLD.model_key;
END;
