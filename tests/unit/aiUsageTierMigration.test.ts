import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('the AI usage tier migration',()=>{
  it('records the tier and defaults it to the one that cannot understate a bill',()=>{
    const sql=readFileSync('src/lib/db/migrations/0042_ai_usage_tier.sql','utf8');
    expect(sql).toContain("ALTER TABLE ai_usage_events ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard'");
  });

  it('backfills the batch scans, which were all billed on flex',()=>{
    // Flex reached the batch path four days before the ledger recorded its
    // first event, so every scan_batch row that exists was billed at it.
    // Without this the panel keeps showing double for the whole ninety-day
    // retention window and corrects itself only by ageing out.
    const sql=readFileSync('src/lib/db/migrations/0042_ai_usage_tier.sql','utf8');
    expect(sql).toContain("UPDATE ai_usage_events SET tier='flex' WHERE kind='scan_batch'");
    // and nothing else is moved off the standard default
    expect(sql.match(/UPDATE ai_usage_events/g)).toHaveLength(1);
  });
});
