import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { AI_USAGE_KINDS,kindLabels,unitOf } from '../../src/lib/usage/aiUsage';

describe('Smart search usage registration',()=>{
  it('is a first-class ledger kind with the unit the UI quotes',()=>{
    expect(AI_USAGE_KINDS).toContain('search_embedding');
    expect(kindLabels.search_embedding).toBe('Smart search');
    expect(unitOf.search_embedding).toBe('wine');
  });

  it('keeps the embedding call site covered by the spending-path canary',()=>{
    const source=readFileSync('src/lib/journal/semanticSearch.ts','utf8');
    expect(source).toContain("kind:'search_embedding'");
    expect(source).toContain("units:kind==='document'?texts.length:0");
  });
});
