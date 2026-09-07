import { describe,expect,it } from 'vitest';
import app from '../../worker/entry';
import journalApp from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';
import { revisionETag } from '../../src/lib/db/ownerRevision';
import { JOURNEY_PAYLOAD_VERSION,loadJourneySummary } from '../../worker/journeyHandler';
import { ACHIEVEMENT_DEFINITION_VERSION,loadAchievementProgress } from '../../worker/achievementHandler';
import { createD1Stub } from './support/d1Stub';

const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
const endpoints=[
  {path:'journey',version:JOURNEY_PAYLOAD_VERSION,table:'journey_summary_cache',versionKey:'payload_version',payload:{summary:{totalWines:2}}},
  {path:'achievements',version:ACHIEVEMENT_DEFINITION_VERSION,table:'achievement_progress_cache',versionKey:'definition_version',payload:[]}
];
async function read(db:D1Database,path:string,etag?:string,anonymous=false){
  const headers=new Headers();
  if(!anonymous)headers.set('Authorization',`Bearer ${await createSession('owner',AUTH_SECRET)}`);
  if(etag)headers.set('If-None-Match',etag);
  return app.fetch(new Request(`https://x/api/${path}`,{headers}),{DB:db,AUTH_SECRET} as never);
}

describe.each(endpoints)('$path conditional reads',({path,version,table,versionKey,payload})=>{
  it('answers an unchanged client with one revision lookup and no payload read/write',async()=>{
    const stub=createD1Stub(sql=>/achievement_cache_state/.test(sql)?{first:{revision:8}}:undefined);
    const response=await read(stub.db,path,revisionETag(path,version,8));
    expect(response.status).toBe(304);expect(await response.text()).toBe('');
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(stub.calls).toHaveLength(1);expect(stub.writes()).toHaveLength(0);
  });

  it('returns a changed payload without rereading the initial revision',async()=>{
    const stub=createD1Stub(sql=>{
      if(/achievement_cache_state/.test(sql))return {first:{revision:9}};
      if(sql.includes(table))return {first:{revision:9,[versionKey]:version,result_json:JSON.stringify(payload)}};
    });
    const response=await read(stub.db,path,revisionETag(path,version,8));
    expect(response.status).toBe(200);expect(await response.json()).toEqual(payload);
    expect(response.headers.get('ETag')).toBe(revisionETag(path,version,9));
    expect(stub.calls).toHaveLength(2);expect(stub.writes()).toHaveLength(0);
  });

  it('requires authentication before answering an ETag',async()=>{
    const stub=createD1Stub();
    expect((await read(stub.db,path,revisionETag(path,version,0),true)).status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });

  it('returns a fresh untagged response if the cache schema is unavailable',async()=>{
    const stub=createD1Stub(sql=>{
      if(/achievement_cache_state/.test(sql))throw new Error('no such table: achievement_cache_state');
      return undefined;
    });
    const response=await read(stub.db,path,revisionETag(path,version,0));
    expect(response.status).toBe(200);expect(response.headers.get('ETag')).toBeNull();
  });
});

it('does not write or ETag an achievement rebuild when both attempts race writes',async()=>{
  let revision=0;
  const stub=createD1Stub(sql=>/FROM achievement_cache_state/.test(sql)?{first:{revision:++revision}}:undefined);
  const result=await loadAchievementProgress(stub.db,'owner');
  expect(result.revision).toBeNull();
  expect(stub.matching(/INSERT INTO achievement_progress_cache/)).toHaveLength(0);
  // Three, not four: the retry carries the revision it just read rather than
  // reading it again, and the last look before giving up is at the cache, not
  // at the counter.
  expect(revision).toBe(3);
});

describe('a summary rebuilt while the journal is being written to',()=>{
  /**
   * Reported as a spike in D1 row reads. A rebuild that raced a write returned
   * uncached and untagged, so under a stream of writes - a batch scan, a sheet
   * being read in, a producer research run - every visit scanned every wine,
   * producer and cuvee again, and the browser could not even revalidate.
   *
   * Correctness is unchanged: an old result is still never stored under a new
   * revision. What changes is that the request looks at where the counter
   * actually landed before giving the cache up.
   */
  const racing=(settledAt:number|null,payload:unknown)=>{
    let revision=0;
    return createD1Stub(sql=>{
      // Every look at the counter finds a newer one: writes keep arriving.
      if(/achievement_cache_state/.test(sql))return {first:{revision:++revision}};
      if(/achievement_progress_cache/.test(sql))
        return {first:settledAt===null?null:{revision:settledAt,definition_version:ACHIEVEMENT_DEFINITION_VERSION,result_json:JSON.stringify(payload)}};
      return undefined;
    });
  };

  it('takes the payload whoever settled that revision first has already paid for',async()=>{
    // The stub answers the cache at whatever revision is asked for, which is
    // another request having stored one between this one's two attempts.
    const stub=racing(2,[{id:'settled'}]);
    const result=await loadAchievementProgress(stub.db,'owner');
    expect(result.progress,'served from the cache, not from a third scan').toEqual([{id:'settled'}]);
    expect(result.revision,'and tagged, so the browser can revalidate next time').toBe(2);
    expect(stub.writes(),'nothing is stored under a revision it does not belong to').toHaveLength(0);
  });

  it('looks once more at the cache before giving it up, and takes what it finds',async()=>{
    // The branch that only fires when the retry raced too: by then another
    // request may have settled the revision this one ended on.
    let revision=0,lookups=0;
    const stub=createD1Stub(sql=>{
      if(/achievement_cache_state/.test(sql))return {first:{revision:++revision}};
      if(/achievement_progress_cache/.test(sql))return {first:++lookups<3?null
        :{revision:3,definition_version:ACHIEVEMENT_DEFINITION_VERSION,result_json:JSON.stringify([{id:'late'}])}};
      return undefined;
    });
    const result=await loadAchievementProgress(stub.db,'owner');
    expect(result).toEqual({revision:3,progress:[{id:'late'}]});
    expect(lookups,'two misses and the last look').toBe(3);
    expect(stub.writes()).toHaveLength(0);
  });

  it('does the same for the Passport summary, which is rebuilt the same way',async()=>{
    let revision=0;
    const stub=createD1Stub(sql=>{
      if(/achievement_cache_state/.test(sql))return {first:{revision:++revision}};
      if(/journey_summary_cache/.test(sql))
        return {first:{revision:2,payload_version:JOURNEY_PAYLOAD_VERSION,result_json:JSON.stringify({summary:{totalWines:7}})}};
      return {all:[]};
    });
    const result=await loadJourneySummary(stub.db,'owner');
    expect(result).toEqual({revision:2,payload:{summary:{totalWines:7}}});
    expect(stub.writes()).toHaveLength(0);
  });

  it('still refuses to store its own result when the revision keeps moving',async()=>{
    const stub=racing(null,null);
    const result=await loadAchievementProgress(stub.db,'owner');
    expect(result.revision).toBeNull();
    expect(stub.matching(/INSERT INTO achievement_progress_cache/)).toHaveLength(0);
  });

  it('reads the counter no more times than it has attempts',async()=>{
    // Two rebuilds at most, and the last look is at the cache rather than at
    // the counter again.
    const stub=racing(null,null);
    await loadAchievementProgress(stub.db,'owner');
    expect(stub.matching(/FROM achievement_cache_state/)).toHaveLength(3);
  });
});

it('returns the journal while maintenance claim checks are still pending',async()=>{
  let release!:(value:unknown)=>void;
  const blocked=new Promise(resolve=>{release=resolve});
  const background:Promise<unknown>[]=[];
  const stub=createD1Stub(sql=>/count\(\*\)/.test(sql)?{all:[{total:0}]}:undefined);
  const db={...stub.db,prepare:(sql:string)=>/maintenance_state/.test(sql)
    ?{bind:()=>({run:()=>blocked,first:()=>blocked})}:stub.db.prepare(sql)} as D1Database;
  const response=await journalApp.fetch(new Request('https://x/api/journal',{
    headers:{Authorization:`Bearer ${await createSession('owner',AUTH_SECRET)}`}
  }),{DB:db,AUTH_SECRET} as never,{
    waitUntil:(task:Promise<unknown>)=>background.push(task),passThroughOnException:()=>undefined
  } as never);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({items:[],total:0,nextOffset:null});
  expect(background).toHaveLength(2);
  release({meta:{changes:0},last_run_at:new Date().toISOString()});
  await Promise.all(background);
});
