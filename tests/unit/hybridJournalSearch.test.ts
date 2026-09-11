import { describe,expect,it } from 'vitest';
import { listJournalPage } from '../../src/lib/journal/list';
import { createD1Stub } from './support/d1Stub';

describe('hybrid Journal search',()=>{
  it('unions semantic candidates with FTS and ranks semantic results first by default',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:2}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy'},['semantic-2','semantic-1']);
    const page=stub.calls.find(call=>/FROM wines w WHERE/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('wine_search MATCH ?');
    expect(page!.sql).toContain('w.id IN (?,?)');
    expect(page!.sql).toContain('CASE w.id WHEN ? THEN 0 WHEN ? THEN 1');
    expect(page!.args.filter(value=>value==='semantic-2')).toHaveLength(2);
    expect(page!.args.filter(value=>value==='semantic-1')).toHaveLength(2);
  });

  it('honours an explicit user sort instead of semantic ranking',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:1}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy',sort:'rating'},['semantic-1']);
    const page=stub.calls.find(call=>/FROM wines w WHERE/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('ORDER BY w.rating DESC');
    expect(page!.sql).not.toContain('CASE w.id');
  });
});
