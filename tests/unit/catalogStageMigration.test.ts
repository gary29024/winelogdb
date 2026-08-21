import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('producer catalog staging migration',()=>{
  it('creates request-scoped staging without rewriting producer catalog data',()=>{
    const sql=readFileSync('src/lib/db/migrations/0025_producer_catalog_research_stage.sql','utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS producer_catalog_research_stage');
    expect(sql).toContain('PRIMARY KEY(owner_id, request_id, slice_key)');
    expect(sql).not.toMatch(/UPDATE\s+producers/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+producers/i);
  });
});
