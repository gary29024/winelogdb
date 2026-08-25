import { describe,expect,it } from 'vitest';
import { VERTEX_BATCH_CONCURRENCY,mapLimit } from '../../src/lib/research/geminiBatch';
import { catalogDefaultChunkKeys } from '../../src/lib/producers/batchResearch';

/** Runs `count` tasks through mapLimit and reports the peak overlap reached. */
async function peakConcurrency(count:number,limit:number){
  let running=0,peak=0;
  const release:Array<()=>void>=[];
  const result=mapLimit(Array.from({length:count},(_,i)=>i),limit,async index=>{
    running+=1;peak=Math.max(peak,running);
    await new Promise<void>(resolve=>{release.push(resolve)});
    running-=1;return index;
  });
  // Let every task that mapLimit is willing to start actually start.
  for(let tick=0;tick<count+2;tick++)await Promise.resolve();
  const order=[...release];release.length=0;
  for(const resolve of order)resolve();
  for(let tick=0;tick<count*3+8;tick++){
    await Promise.resolve();
    const pending=[...release];release.length=0;
    for(const resolve of pending)resolve();
  }
  await result;
  return peak;
}

describe('how many research calls run at once',()=>{
  it('runs a producer research submission in a single wave',()=>{
    // A run submits the profile plus every alphabetical catalogue slice. At the
    // previous limit of three that was two waves and about twice the wall time.
    const producerEntries=['profile',...catalogDefaultChunkKeys].length;
    expect(producerEntries).toBe(6);
    expect(producerEntries).toBeLessThanOrEqual(VERTEX_BATCH_CONCURRENCY);
  });

  it('stays inside the six connections a Worker may have awaiting headers',()=>{
    // A seventh would queue inside the runtime, so a higher number here would
    // describe something the platform will not actually do.
    expect(VERTEX_BATCH_CONCURRENCY).toBeLessThanOrEqual(6);
  });

  it('actually overlaps work up to the limit',async()=>{
    expect(await peakConcurrency(6,VERTEX_BATCH_CONCURRENCY)).toBe(6);
  });

  it('never exceeds the limit when there is more work than slots',async()=>{
    // A recovery attempt can split slices further and submit more than six.
    expect(await peakConcurrency(10,VERTEX_BATCH_CONCURRENCY)).toBe(6);
  });

  it('does not spawn more workers than there is work',async()=>{
    // Wine research submits a single entry, so nothing changes for it.
    expect(await peakConcurrency(1,VERTEX_BATCH_CONCURRENCY)).toBe(1);
  });

  it('keeps results in the order the entries were given',async()=>{
    const out=await mapLimit([10,20,30,40,50,60,70],VERTEX_BATCH_CONCURRENCY,async(value,index)=>{
      await new Promise(resolve=>setTimeout(resolve,(7-index)%3));
      return value;
    });
    // Responses are matched back to their batch key by position downstream, so
    // finishing out of order must not reorder the array.
    expect(out).toEqual([10,20,30,40,50,60,70]);
  });
});
