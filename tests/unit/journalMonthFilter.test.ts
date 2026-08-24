import { describe,expect,it } from 'vitest';
import { listJournalPage } from '../../src/lib/journal/list';
import { createD1Stub } from './support/d1Stub';

const listed=async(query:Record<string,string>)=>{
  const stub=createD1Stub();
  await listJournalPage(stub.db,'owner',query);
  const call=stub.calls.find(entry=>/FROM wines w/.test(entry.sql));
  return {sql:call?.sql??'',args:call?.args??[]};
};

describe('Journal month filter',()=>{
  it('filters on the same date the list is grouped by',async()=>{
    // The month headings use tastingDate||createdAt, so the filter has to read
    // an empty tasting_date the same way, or a wine lands under a heading the
    // filter would not have returned it for.
    const {sql,args}=await listed({month:'2026-08'});
    expect(sql).toContain("substr(coalesce(nullif(w.tasting_date,''),w.created_at),1,7)=?");
    expect(args).toContain('2026-08');
  });

  it('is left out entirely when no month is asked for',async()=>{
    const {sql}=await listed({});
    expect(sql).not.toContain('substr(coalesce(nullif(w.tasting_date');
  });

  it('combines with the other filters rather than replacing them',async()=>{
    const {sql,args}=await listed({month:'2026-08',country:'France',style:'red'});
    expect(sql).toContain('w.country=?');
    expect(sql).toContain('w.wine_style=?');
    expect(args).toEqual(expect.arrayContaining(['France','red','2026-08']));
  });

  it('binds the month rather than inlining it',async()=>{
    const {sql}=await listed({month:"2026-08' OR 1=1 --"});
    expect(sql).not.toContain('1=1');
  });
});
