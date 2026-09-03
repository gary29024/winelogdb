import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { buildJourneyPayload,JOURNEY_PAYLOAD_VERSION,loadJourneySummary } from '../../worker/journeyHandler';
import { etagMatches,revisionETag } from '../../src/lib/db/ownerRevision';
import { createD1Stub } from './support/d1Stub';

const aggregateSql=/FROM wines WHERE owner_id=\?/;

function cachedStub(revision:number,cachedRevision:number|null,payloadVersion=JOURNEY_PAYLOAD_VERSION){
  return createD1Stub(sql=>{
    if(/FROM achievement_cache_state/.test(sql))return {first:{revision}};
    if(/FROM journey_summary_cache/.test(sql))return {first:cachedRevision===null?null:{revision:cachedRevision,payload_version:payloadVersion,result_json:JSON.stringify({summary:{totalWines:7}})}};
    return undefined;
  });
}

describe('Wine Journey summary cache',()=>{
  it('serves a matching revision without re-running the aggregate scans',async()=>{
    const stub=cachedStub(12,12);
    const {revision,payload}=await loadJourneySummary(stub.db,'owner');
    expect(revision).toBe(12);
    expect(payload).toEqual({summary:{totalWines:7}});
    expect(stub.matching(aggregateSql)).toHaveLength(0);
    expect(stub.writes()).toHaveLength(0);
  });

  it('rebuilds and stores the payload when the owner revision moved on',async()=>{
    const stub=cachedStub(13,12);
    const {revision}=await loadJourneySummary(stub.db,'owner');
    expect(revision).toBe(13);
    expect(stub.matching(aggregateSql).length).toBeGreaterThan(0);
    expect(stub.matching(/^insert into journey_summary_cache/i)).toHaveLength(1);
  });

  it('rebuilds when the cached payload was written by an older payload version',async()=>{
    const stub=cachedStub(12,12,JOURNEY_PAYLOAD_VERSION-1);
    await loadJourneySummary(stub.db,'owner');
    expect(stub.matching(aggregateSql).length).toBeGreaterThan(0);
  });

  it('does not cache or tag a rebuild that raced a concurrent write',async()=>{
    let revision=12;
    const stub=createD1Stub(sql=>{
      if(/FROM achievement_cache_state/.test(sql))return {first:{revision:revision++}};
      if(/FROM journey_summary_cache/.test(sql))return {first:null};
      return undefined;
    });
    const {revision:tagged}=await loadJourneySummary(stub.db,'owner');
    expect(tagged).toBeNull();
    expect(stub.matching(/^insert into journey_summary_cache/i)).toHaveLength(0);
  });

  it('still answers when the cache tables are not migrated yet',async()=>{
    const stub=createD1Stub(sql=>{
      if(/achievement_cache_state|journey_summary_cache/.test(sql))throw new Error('D1_ERROR: no such table: journey_summary_cache');
      return undefined;
    });
    const {revision,payload}=await loadJourneySummary(stub.db,'owner');
    expect(revision).toBeNull();
    expect(payload).toHaveProperty('summary');
  });
});

describe('the country breakdown behind the Passport map',()=>{
  it('reads every country, because a truncated list pins the map at the limit',async()=>{
    const countries=Array.from({length:26},(_,index)=>({country:`Country ${index}`,wines:26-index}));
    const stub=createD1Stub(sql=>/GROUP BY trim\(country\)/.test(sql)?{all:countries}:undefined);
    const payload=await buildJourneyPayload(stub.db,'owner') as {countries:unknown[]};
    const statement=stub.matching(/GROUP BY trim\(country\)/)[0];
    expect(statement.sql).not.toMatch(/limit/i);
    expect(payload.countries).toHaveLength(26);
  });
});

describe('revision ETags',()=>{
  it('changes with the revision and with the payload version',()=>{
    expect(revisionETag('journey',1,4)).toBe('"journey-v1-r4"');
    expect(revisionETag('journey',1,4)).not.toBe(revisionETag('journey',2,4));
    expect(revisionETag('journey',1,4)).not.toBe(revisionETag('journey',1,5));
  });

  it('matches strong, weak and list forms of If-None-Match',()=>{
    const etag=revisionETag('journey',1,4);
    expect(etagMatches(etag,etag)).toBe(true);
    expect(etagMatches(`W/${etag}`,etag)).toBe(true);
    expect(etagMatches(`"other", ${etag}`,etag)).toBe(true);
    expect(etagMatches('*',etag)).toBe(true);
    expect(etagMatches('"journey-v1-r3"',etag)).toBe(false);
    expect(etagMatches(undefined,etag)).toBe(false);
  });
});

describe('what the Passport map is told about',()=>{
  const handler=readFileSync('worker/journeyHandler.ts','utf8');
  /** The SELECT that groups by a column, without the comments around it. */
  const query=(groupBy:string)=>handler.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'')
    .split('db.prepare(`').find(part=>part.includes(groupBy))!.split('`)')[0];

  it('lists every country, because a truncated list pins the stamp count at the limit',()=>{
    expect(query('GROUP BY trim(country)')).not.toMatch(/LIMIT/);
  });

  it('lists the regions the map can draw, not a top slice of them',()=>{
    // Reported as: Margaret River is logged and the map does not light it. It
    // could not - the regions list stopped at twenty, and twenty of a journal
    // that is mostly French never reaches Western Australia. Regions became map
    // data when the spread countries started drawing them, and inherited the
    // bug the countries query had already been fixed for.
    const regions=query("GROUP BY NULLIF(trim(country),''),trim(region)");
    const limit=Number(regions.match(/LIMIT (\d+)/)![1]);
    // Generous enough that no real journal is cut - the place tree carries 211
    // regions in all - and a cap only so a journal full of typos cannot run the
    // payload away.
    expect(limit).toBeGreaterThanOrEqual(400);
  });

  it('recomputes what is already cached, since the shape it holds has changed',()=>{
    // A cached payload carries the old twenty regions; without a version bump
    // the map would keep reading them until the next wine was saved.
    expect(JOURNEY_PAYLOAD_VERSION).toBeGreaterThanOrEqual(5);
  });
});
