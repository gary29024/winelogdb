import { describe,expect,it } from 'vitest';
import { sliceJournalPage } from '../../src/lib/journal/list';

describe('Journal pagination',()=>{
  it('returns at most 36 visible wines and exposes the next offset only when another row exists',()=>{
    const rows=Array.from({length:37},(_,index)=>index+1);
    expect(sliceJournalPage(rows,36,0)).toEqual({items:rows.slice(0,36),nextOffset:36});
  });

  it('does not offer a false next page when the current page is exactly full',()=>{
    const rows=Array.from({length:36},(_,index)=>index+1);
    expect(sliceJournalPage(rows,36,72)).toEqual({items:rows,nextOffset:null});
  });
});
