// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const root=process.cwd();
const source=(path:string)=>readFileSync(join(root,path),'utf8');

describe('a summary stops being true the moment a wine changes',()=>{
  beforeEach(()=>{vi.resetModules();vi.unstubAllGlobals()});

  it('drops the Passport answer when told something changed',async()=>{
    const payload={summary:{totalWines:2},countries:[],regions:[]};
    const fetcher=vi.fn(async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetcher);
    const journey=await import('../../src/features/journey/api');
    const {summariesChanged}=await import('../../src/lib/cache/summaryCaches');

    await journey.getJourneyData();
    await journey.getJourneyData();
    expect(fetcher,'served from cache while nothing changed').toHaveBeenCalledTimes(1);

    summariesChanged();
    await journey.getJourneyData();
    expect(fetcher,'and asked again once it had').toHaveBeenCalledTimes(2);
  });

  it('drops the collections answer too, from the same call',async()=>{
    const fetcher=vi.fn(async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetcher);
    const achievements=await import('../../src/features/achievements/api');
    const {summariesChanged}=await import('../../src/lib/cache/summaryCaches');

    await achievements.getAchievementProgress();
    await achievements.getAchievementProgress();
    expect(fetcher).toHaveBeenCalledTimes(1);
    summariesChanged();
    await achievements.getAchievementProgress();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('reaches a cache that only loaded after the last change',async()=>{
    // The pages are lazily loaded, so a cache can register itself long after
    // the app started. It must still be reset by the next write.
    const {summariesChanged}=await import('../../src/lib/cache/summaryCaches');
    summariesChanged();
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({summary:{}}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetcher);
    const journey=await import('../../src/features/journey/api');
    await journey.getJourneyData();
    summariesChanged();
    await journey.getJourneyData();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([false,true,undefined])('invalidates after favorite changes, including older Workers (changed: %s)',async changed=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(
      String(input).includes('/favorite')?{id:'w1',favorite:true,changed}:{summary:{totalWines:2}}
    ),{status:200}));
    vi.stubGlobal('fetch',fetcher);
    const journey=await import('../../src/features/journey/api');
    const {setWineFavorite}=await import('../../src/features/wines/api');
    await journey.getJourneyData();
    await setWineFavorite('w1',true);
    await journey.getJourneyData();
    expect(fetcher).toHaveBeenCalledTimes(changed===false?2:3);
  });
});

describe('every write says so',()=>{
  /**
   * The guard. Deleting a wine and walking to the Passport showed the count
   * from before the delete, because nothing told the cache. A write added later
   * that forgets to say so would be the same bug again, silently.
   */
  const mutating=(file:string)=>{
    const text=source(file);
    return [...text.matchAll(/export (?:async function|const) (\w+)[^\n]*/g)]
      .map(match=>({name:match[1],start:match.index??0}))
      .map((entry,index,all)=>({...entry,
        body:text.slice(entry.start,index+1<all.length?all[index+1].start:text.length)}))
      .filter(entry=>/method:'(POST|PUT|DELETE|PATCH)'/.test(entry.body));
  };

  it('is true of every wine write',()=>{
    const silent=mutating('src/features/wines/api.ts').filter(entry=>!/summariesChanged\(\)/.test(entry.body));
    expect(silent.map(entry=>entry.name)).toEqual([
      // Deep Search queues and cancels a background run; it changes no count
      // until the research lands, and the wine row it writes is not one.
      'startWineDeepSearch','cancelWineDeepSearch'
    ]);
  });

  it('is true of every tasting write that moves what a wine belongs to',()=>{
    const silent=mutating('src/features/tastings/api.ts').filter(entry=>!/summariesChanged\(\)/.test(entry.body));
    expect(silent.map(entry=>entry.name)).toEqual([
      // A tasting's own name, dates and paperwork. None of them is a wine.
      'startTasting','updateTasting','endTasting','reopenTasting',
      'uploadTastingDocuments','parseTastingSheetPage','deleteTastingDocument'
    ]);
  });

  it('says nothing for a cellar write, because a holding is in no summary',()=>{
    // The isolation rule, seen from the other side: bottles you hold change no
    // count, so they must not throw away an answer that is still true.
    expect(source('src/features/cellar/api.ts')).not.toMatch(/summariesChanged/);
  });
});
