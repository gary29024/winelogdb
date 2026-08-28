import { describe,expect,it } from 'vitest';
import { listJournalPage,sliceJournalPage } from '../../src/lib/journal/list';
import { createD1Stub } from './support/d1Stub';

describe('Journal pagination',()=>{
  it('returns at most 36 visible wines and exposes the next offset only when another row exists',()=>{
    const rows=Array.from({length:37},(_,index)=>index+1);
    expect(sliceJournalPage(rows,36,0)).toEqual({items:rows.slice(0,36),nextOffset:36});
  });

  it('does not offer a false next page when the current page is exactly full',()=>{
    const rows=Array.from({length:36},(_,index)=>index+1);
    expect(sliceJournalPage(rows,36,72)).toEqual({items:rows,nextOffset:null});
  });

  it('returns the exact filtered total and derives the next page from it',async()=>{
    const stub=createD1Stub(sql=>{
      if(/SELECT count\(\*\) AS total/.test(sql))return {all:[{total:73}]};
      if(/SELECT w\.id/.test(sql))return {all:[]};
      return undefined;
    });
    const result=await listJournalPage(stub.db,'owner',{query:'Burgundy',limit:'36',offset:'36'});
    expect(result).toEqual({items:[],nextOffset:72,total:73});
    const reads=stub.matching(/FROM wines w/);
    expect(reads).toHaveLength(2);
    expect(reads.every(read=>read.sql.includes('wine_search MATCH ?'))).toBe(true);
  });
});
