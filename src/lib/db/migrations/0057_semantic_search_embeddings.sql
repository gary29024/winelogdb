-- Semantic Journal search keeps its vectors beside the owner's wine records.
-- This deliberately avoids requiring Vectorize for a single-user deployment:
-- the Worker ranks unit-normalized vectors by exact dot product (the same cosine
-- ordering), while the embedding model remains replaceable through model_key.
-- A model change therefore rebuilds lazily without comparing incompatible vectors.
CREATE TABLE wine_semantic_embeddings (
  owner_id TEXT NOT NULL,
  wine_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK(dimensions > 0),
  source_updated_at TEXT NOT NULL,
  embedding BLOB NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id,wine_id,model_key),
  FOREIGN KEY(wine_id) REFERENCES wines(id) ON DELETE CASCADE
);

CREATE INDEX idx_wine_semantic_embeddings_owner_model
  ON wine_semantic_embeddings(owner_id,model_key);
