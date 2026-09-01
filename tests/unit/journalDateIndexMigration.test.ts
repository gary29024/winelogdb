import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const migration=readFileSync('src/lib/db/migrations/0044_journal_date_index.sql','utf8');
const journalList=readFileSync('src/lib/journal/list.ts','utf8');

describe('Journal chronology index migration',()=>{
  it('indexes the same date expression used by the Journal chronology',()=>{
    expect(journalList).toContain('coalesce(w.tasting_date,w.created_at) AS journal_date');
    expect(migration).toMatch(/ON wines\(owner_id, coalesce\(tasting_date, created_at\) DESC\)/);
  });

  it('is safe to re-run during deployment',()=>{
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_wines_owner_journal_date');
  });
});
