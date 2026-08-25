import { describe,expect,it } from 'vitest';
import { mergeSessionIntoHistory,type BatchRecognitionSession,type BatchSessionSummary } from '../../src/features/uploads/batchApi';

const summary=(over:Partial<BatchSessionSummary>&{id:string}):BatchSessionSummary=>({
  status:'complete',totalItems:13,expectedItems:13,confirmedItems:0,
  createdAt:'2026-08-25T19:00:00.000Z',updatedAt:'2026-08-25T19:00:44.000Z',expiresAt:'2026-09-01T19:00:00.000Z',
  ...over
});
const session=(over:Partial<BatchRecognitionSession>&{id:string}):BatchRecognitionSession=>({
  ...summary(over),items:[],...over
});

describe('Recent batches after saving a wine',()=>{
  it('carries the new confirmed count into the list',()=>{
    // The reported bug: every wine in a batch saved, then the list still read
    // "0 confirmed" because it had not been fetched since the page opened.
    const history=[summary({id:'b1',confirmedItems:0})];
    const merged=mergeSessionIntoHistory(history,session({id:'b1',confirmedItems:13}));
    expect(merged[0].confirmedItems).toBe(13);
  });

  it('carries a status change too, not just the count',()=>{
    const history=[summary({id:'b1',status:'queued',confirmedItems:0})];
    const merged=mergeSessionIntoHistory(history,session({id:'b1',status:'complete',confirmedItems:18,totalItems:18,expectedItems:18}));
    expect(merged[0]).toMatchObject({status:'complete',confirmedItems:18,totalItems:18});
  });

  it('leaves every other batch alone',()=>{
    const other=summary({id:'b2',confirmedItems:4});
    const history=[summary({id:'b1',confirmedItems:0}),other];
    const merged=mergeSessionIntoHistory(history,session({id:'b1',confirmedItems:13}));
    expect(merged[1]).toBe(other);
    expect(merged[1].confirmedItems).toBe(4);
  });

  it('does not reorder the list under the reader',()=>{
    // The fetch sorts newest-first; re-sorting here would move rows while
    // someone is working through them.
    const history=[summary({id:'b1',updatedAt:'2026-08-25T19:15:00.000Z'}),summary({id:'b2',updatedAt:'2026-08-25T19:00:00.000Z'})];
    const merged=mergeSessionIntoHistory(history,session({id:'b2',confirmedItems:9,updatedAt:'2026-08-25T20:00:00.000Z'}));
    expect(merged.map(entry=>entry.id)).toEqual(['b1','b2']);
  });

  it('returns the same list when a poll finds no news',()=>{
    // A queued batch polls every ten seconds; an unchanged answer must not
    // create a new array and re-render the page for nothing.
    const history=[summary({id:'b1',status:'queued',confirmedItems:0})];
    expect(mergeSessionIntoHistory(history,session({id:'b1',status:'queued',confirmedItems:0}))).toBe(history);
  });

  it('ignores a session that is not in the list',()=>{
    const history=[summary({id:'b1'})];
    expect(mergeSessionIntoHistory(history,session({id:'unknown',confirmedItems:3}))).toBe(history);
  });

  it('copes with an empty list',()=>{
    expect(mergeSessionIntoHistory([],session({id:'b1'}))).toEqual([]);
  });

  it('does not copy the session items into the summary',()=>{
    // The list row renders counts only; carrying the items would bloat state
    // that nothing reads.
    const merged=mergeSessionIntoHistory([summary({id:'b1'})],session({
      id:'b1',confirmedItems:2,
      items:[{id:'i1',position:0,status:'confirmed',recognition:null,error:null,confirmedWineId:'w1',imageIds:['img1']}]
    }));
    expect(merged[0]).not.toHaveProperty('items');
  });
});
