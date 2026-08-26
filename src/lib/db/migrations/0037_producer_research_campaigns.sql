-- Batch producer research: one campaign over many producers.
--
-- A single producer's research already runs as a queued job that submits a
-- Gemini batch and polls it. Researching a library one producer at a time is
-- the part that does not scale, so a campaign holds the list and a queue tick
-- keeps a small number of them in flight - never the whole list at once, which
-- would submit hundreds of grounded batch jobs in one go.
--
-- Items carry their own status because a campaign has to survive the tab being
-- closed: the tick reconciles each item against producer_research_runs, so
-- progress and failures are readable long after the run finished.
CREATE TABLE producer_research_campaigns (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running','complete','cancelled')),
  requested INTEGER NOT NULL,
  concurrency INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  -- Set when the owner has seen the outcome. A campaign that finished with no
  -- failures dismisses itself; one with failures waits to be acknowledged.
  dismissed_at TEXT
);
CREATE INDEX idx_producer_research_campaigns_owner ON producer_research_campaigns(owner_id, created_at DESC);

CREATE TABLE producer_research_campaign_items (
  campaign_id TEXT NOT NULL,
  producer_id TEXT NOT NULL,
  producer_name TEXT NOT NULL,
  request_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','running','complete','failed','skipped')),
  message TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, producer_id)
);
CREATE INDEX idx_producer_research_campaign_items_status ON producer_research_campaign_items(campaign_id, status);
