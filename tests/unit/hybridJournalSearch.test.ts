import { describe,expect,it } from 'vitest';
import { listJournalPage } from '../../src/lib/journal/list';
import { createD1Stub } from './support/d1Stub';

describe('hybrid Journal search',()=>{
  it('unions semantic candidates with FTS and ranks semantic results first by default',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:2}]}:{all:[]});
    const ids=['semantic-2','semantic-1'];
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy'},ids);
    const page=stub.calls.find(call=>/FROM wines w WHERE/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('wine_search MATCH ?');
    expect(page!.sql).toContain('w.id IN (SELECT CAST(value AS TEXT) FROM json_each(?))');
    expect(page!.sql).toContain('COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE CAST(value AS TEXT)=w.id), 2)');
    const packed=JSON.stringify(ids);
    expect(page!.args.filter(value=>value===packed)).toHaveLength(2);
    expect(page!.args).not.toContain('semantic-2');
    expect(page!.args).not.toContain('semantic-1');
  });

  it('keeps the full 72 semantic candidates below the D1 100-variable ceiling',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:72}]}:{all:[]});
    const ids=Array.from({length:72},(_,index)=>`semantic-${index}`);
    await listJournalPage(stub.db,'owner',{query:'elegant pinot noir',limit:'36',offset:'0'},ids);
    const page=stub.calls.find(call=>/FROM wines w WHERE/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.args.length).toBeLessThan(100);
    expect(page!.args.filter(value=>value===JSON.stringify(ids))).toHaveLength(2);
  });

  it('honours an explicit user sort instead of semantic ranking',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:1}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy',sort:'rating'},['semantic-1']);
    const page=stub.calls.find(call=>/FROM wines w WHERE/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('ORDER BY w.rating DESC');
    expect(page!.sql).not.toContain('SELECT CAST(key AS INTEGER) FROM json_each(?)');
  });
});
