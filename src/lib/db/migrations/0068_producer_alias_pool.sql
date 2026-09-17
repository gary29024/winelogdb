-- Names the app already knows are the same producer.
--
-- Reuse matched on the exact normalized producer name, so a friend who logged
-- "Ch. Margaux" and a friend who logged "Château Margaux" never met, and the
-- second one paid again. The equivalences were already in the database and
-- unused: producer_aliases holds every spelling an account has confirmed, and
-- producer_merges holds a person saying two producers are one.
--
-- Both sides are normalized by the same function - producer_aliases.normalized_alias
-- and producers.match_key are both normalizeProducerAlias output - so the seed
-- below is a plain join and needs no re-normalization.
--
-- Deliberately NOT fuzzy: only equivalences a person confirmed get in. In a
-- shared pool a wrong match serves another producer's research to everyone who
-- ever logs that name, which is worse than a miss.
CREATE TABLE IF NOT EXISTS producer_alias_pool (
  normalized_alias TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  confirmed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (normalized_alias, producer_key)
);
CREATE INDEX IF NOT EXISTS idx_producer_alias_pool_key ON producer_alias_pool(producer_key);

INSERT OR IGNORE INTO producer_alias_pool(normalized_alias,producer_key,confirmed_by)
SELECT a.normalized_alias,p.match_key,a.owner_id
FROM producer_aliases a JOIN producers p ON p.owner_id=a.owner_id AND p.id=a.producer_id
WHERE a.normalized_alias<>p.match_key AND trim(a.normalized_alias)<>'' AND trim(p.match_key)<>'';
