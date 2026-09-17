import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { mapVintageWindow,readVintageWindow,readVintageWindows,vintageCacheKey,vintageWindowSchema,writeVintageWindow } from '../../src/lib/maturity/vintageWindow';
import { researchVintageWindow } from '../../worker/vintageWindowHandler';
import { migratedSqliteD1 } from './support/sqliteD1';

const subject={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',vintage:2019,wineStyle:'red'};
const quality={score:93,confidence:'medium',consensus:'A structured regional vintage.',strengths:['Freshness'],cautions:['Uneven yields']};
const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/report';
const answer={drinkFrom:null,drinkTo:null,note:'No precise window supported.',quality,
  sources:[{title:'Report',url:redirect}]};
const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
const database=()=>{const db=migratedSqliteD1();databases.push(db);return db};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const {sqlite} of databases.splice(0))sqlite.close()});

function reply(sources=answer.sources,chunks?:unknown[],overrides:Record<string,unknown>={}){
  const fetch=vi.fn(async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({...answer,sources,...overrides})}]},
    ...(chunks?{groundingMetadata:{groundingChunks:chunks,webSearchQueries:['Burgundy 2019']}}:{})}],
    usageMetadata:{promptTokenCount:100,candidatesTokenCount:200}}));
  vi.stubGlobal('fetch',fetch);
  return fetch;
}

describe('vintage quality storage and evidence',()=>{
  it('upgrades an existing cached row without losing its window or inventing quality',()=>{
    const sqlite=new DatabaseSync(':memory:');
    try{
      sqlite.exec(readFileSync('src/lib/db/migrations/0046_vintage_windows.sql','utf8'));
      sqlite.exec("INSERT INTO vintage_windows(id,owner_id,cache_key,vintage,shift_from,shift_to,researched_at,created_at,updated_at) VALUES('legacy','owner','key',2019,2,3,'then','then','then')");
      sqlite.exec(readFileSync('src/lib/db/migrations/0054_vintage_intelligence.sql','utf8'));
      expect(mapVintageWindow(sqlite.prepare('SELECT * FROM vintage_windows').get()!))
        .toMatchObject({vintage:2019,shiftFrom:2,shiftTo:3,quality:null});
    }finally{sqlite.close()}
  });

  it('retains grounded quality through the worker, single and batch reads, and explicit refresh',async()=>{
    reply();
    const {db,sqlite}=database();
    const env={DB:db,GEMINI_API_KEY:'test'};
    expect(await researchVintageWindow(env,'owner',subject,'run'))
      .toMatchObject({quality,shiftFrom:null,shiftTo:null});
    expect((await readVintageWindows(db,'owner',[subject])).get(vintageCacheKey(subject))?.quality).toEqual(quality);
    expect(await readVintageWindow(db,'other-owner',subject)).toBeNull();
    const refreshed=vintageWindowSchema.parse({...answer,quality:{...quality,score:null,confidence:'low'}});
    expect(await writeVintageWindow(db,'owner',subject,refreshed,null,'model')).toMatchObject({quality:refreshed.quality});
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM vintage_windows').get()?.count).toBe(1);
    sqlite.exec("UPDATE vintage_windows SET quality_json='malformed'");
    expect((await readVintageWindow(db,'owner',subject))?.quality).toBeNull();
  });

  it.each([
    'https://vertexaisearch.cloud.google.com.evil.test/grounding-api-redirect/report',
    'https://evil.test/?source=vertexaisearch.cloud.google.com',
    'https://vertexaisearch.cloud.google.com@evil.test/grounding-api-redirect/report',
    'javascript:alert("vertexaisearch.cloud.google.com")',
    'http://vertexaisearch.cloud.google.com/grounding-api-redirect/report',
    'https://vertexaisearch.cloud.google.com/not-a-grounding-redirect'
  ])('rejects a false grounding receipt: %s',async url=>{
    const fetch=reply([{title:'Invented',url}]);
    const {db,sqlite}=database();
    await expect(researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run')).rejects.toThrow(/Nothing was retrieved/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM vintage_windows').get()?.count).toBe(0);
  });

  it('keeps only redirect citations when no provider source metadata is available',async()=>{
    reply([...answer.sources,{title:'Invented',url:'https://example.test/invented'},
      {title:'Unsafe',url:'javascript:alert(1)'}]);
    const {db}=database();
    const stored=await researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run');
    expect(stored?.sources).toEqual(answer.sources);
  });

  it('prefers usable provider web citations over the model source list',async()=>{
    reply(answer.sources,[{web:{title:'Regional report',uri:'https://example.test/region'}},
      {web:{title:'Unsafe',uri:'data:text/html,untrusted'}}]);
    const {db}=database();
    expect((await researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run'))?.sources)
      .toEqual([{title:'Regional report',url:'https://example.test/region'}]);
  });

  it('does not count empty provider chunks as evidence for an invented citation',async()=>{
    reply([{title:'Invented',url:'https://example.test/invented'}],[{}]);
    const {db}=database();
    await expect(researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run')).rejects.toThrow(/Nothing was retrieved/);
  });
});


describe('optional quality never invalidates a grounded window',()=>{
  it.each([
    {...quality,confidence:undefined}, {...quality,score:65},
    {...quality,confidence:'very high'}, {...quality,strengths:Array(6).fill('Freshness')},
    {...quality,consensus:'x'.repeat(700)}
  ])('stores the window without escalating malformed quality %j',async invalid=>{
    const fetch=reply(answer.sources,undefined,{drinkFrom:2025,drinkTo:2035,quality:invalid});
    const log=vi.spyOn(console,'log').mockImplementation(()=>{});
    const {db}=database();
    const stored=await researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run');
    expect(stored?.quality).toBeNull();
    expect((await readVintageWindow(db,'owner',subject))?.note).toBe(answer.note);
    expect(stored?.shiftFrom).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.map(([line])=>JSON.parse(line)).find(x=>x.event==='vintage-window-answered'))
      .toMatchObject({qualityDiscarded:true,replySources:1,sources:1});
  });

  it('still refuses inverted windows after both attempts',async()=>{
    const fetch=reply(answer.sources,undefined,{drinkFrom:2040,drinkTo:2020,quality:{score:65}});
    const {db,sqlite}=database();
    await expect(researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run')).rejects.toThrow(/wrong shape/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM vintage_windows').get()?.count).toBe(0);
  });

  it.each([0,5])('logs %i model citations separately from accepted grounding',async count=>{
    reply(Array.from({length:count},(_,i)=>({title:'Unverified',url:`https://example.test/${i}`})));
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const {db}=database();
    await expect(researchVintageWindow({DB:db,GEMINI_API_KEY:'test'},'owner',subject,'run')).rejects.toThrow(/Nothing was retrieved/);
    expect(warn.mock.calls.map(([line])=>JSON.parse(line)).find(x=>x.event==='vintage-window-escalation'))
      .toMatchObject({replySources:count,metadataSources:0,sources:0,redirects:0});
  });
});
