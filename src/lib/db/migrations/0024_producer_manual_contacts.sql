CREATE TABLE producer_manual_contacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  contact_type TEXT NOT NULL CHECK(contact_type IN ('email','phone','website','instagram','other')),
  label TEXT,
  value TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_producer_manual_contacts_owner_producer
  ON producer_manual_contacts(owner_id,producer_id,created_at);
