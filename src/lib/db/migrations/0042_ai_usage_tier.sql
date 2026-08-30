-- Which service tier the call was billed on.
--
-- Batch recognition queues every call on Vertex's flex tier, which bills about
-- half of standard; single, group and sheet scans run on standard. The ledger
-- priced everything by the model alone, so the tier was invisible and every
-- batch scan was recorded at roughly twice what Google charged for it - which
-- read on the spend panel as batch costing more per wine than scanning one
-- bottle at a time, the opposite of what it does.
ALTER TABLE ai_usage_events ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard';

-- Backfilling the history is safe here, and only here.
--
-- Flex landed on the batch path on 23 August; the usage ledger did not start
-- recording anything until the 27th. So every scan_batch row that exists was
-- billed on flex, and leaving them at the default would keep the panel showing
-- double for the whole ninety-day retention window - a wrong number that
-- corrects itself only by ageing out.
--
-- Nothing else is backfilled: every other kind has always gone out on the
-- standard tier, which is what the column already defaults to.
UPDATE ai_usage_events SET tier='flex' WHERE kind='scan_batch';
