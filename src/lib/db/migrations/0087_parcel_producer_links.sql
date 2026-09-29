-- Personal catalogue associations, never evidence of ownership or operation.
-- Snapshot scoping prevents a refreshed rights file silently inheriting a link.
CREATE TABLE parcel_producer_links (
  owner_id TEXT NOT NULL,
  parent_feature_id TEXT NOT NULL,
  rights_snapshot TEXT NOT NULL,
  holder_id TEXT NOT NULL,
  producer_owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, parent_feature_id, rights_snapshot, holder_id),
  FOREIGN KEY (producer_owner_id, producer_id) REFERENCES producers(owner_id,id) ON DELETE CASCADE
);
