-- Semantic Journal search keeps its vectors beside the owner's wine records.
-- This deliberately avoids requiring Vectorize for a single-user deployment:
-- D1 does exact cosine ranking in the Worker, while the embedding model remains
-- replaceable through model_key. A model change therefore rebuilds lazily
-- without corrupting or pretending that vectors from two models are comparable.
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
