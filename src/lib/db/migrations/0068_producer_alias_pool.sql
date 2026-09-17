-- Producer-name equivalences confirmed inside one account.
--
-- Reuse matched on the exact normalized producer name, so a user who logged
-- "Ch. Margaux" and later confirmed it was "Château Margaux" should be able to
-- find a friend's research filed under the canonical spelling. That correction
-- is personal account data, though: another member must not inherit it merely
-- because the same deployment stores both journals.
--
-- producer_aliases.normalized_alias, producers.match_key and
-- producer_merges.source_match_key are all produced by normalizeProducerAlias,
-- so the seeds below need no further normalization.
--
-- Deliberately NOT fuzzy: only equivalences this owner confirmed get in. A wrong
-- match should affect at most that owner's lookup, never unrelated accounts.
CREATE TABLE IF NOT EXISTS producer_alias_pool (
  owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  normalized_alias TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_id, normalized_alias, producer_key)
);
CREATE INDEX IF NOT EXISTS idx_producer_alias_pool_key ON producer_alias_pool(owner_id,producer_key);

-- Existing explicit aliases. Producer tables predate app_users and can contain a
-- stale legacy owner id, so seed only owners that actually exist in app_users;
-- INSERT OR IGNORE does not suppress foreign-key violations.
INSERT OR IGNORE INTO producer_alias_pool(owner_id,normalized_alias,producer_key)
SELECT a.owner_id,a.normalized_alias,p.match_key
FROM producer_aliases a
JOIN producers p ON p.owner_id=a.owner_id AND p.id=a.producer_id
JOIN app_users u ON u.id=a.owner_id
WHERE a.normalized_alias<>p.match_key AND trim(a.normalized_alias)<>'' AND trim(p.match_key)<>'';

-- Existing confirmed merges. The source producer row may already be gone, but
-- producer_merges preserves its normalized match key and the destination id.
-- Apply the same app_users guard for legacy/stale owner ids.
INSERT OR IGNORE INTO producer_alias_pool(owner_id,normalized_alias,producer_key)
SELECT m.owner_id,m.source_match_key,p.match_key
FROM producer_merges m
JOIN producers p ON p.owner_id=m.owner_id AND p.id=m.destination_producer_id
JOIN app_users u ON u.id=m.owner_id
WHERE m.undone_at IS NULL AND m.source_match_key<>p.match_key
  AND trim(m.source_match_key)<>'' AND trim(p.match_key)<>'';
