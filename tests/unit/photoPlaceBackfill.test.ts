import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { placesBucket } from './support/placesFixture';
import { processRolloutJob,rolloutRoute,rolloutStatus,type RolloutQueueJob } from '../../worker/multiUser/rollout';
import type { Member } from '../../worker/multiUser/common';
import { placeCellKey } from '../../src/lib/places/photoPlace';
import { referenceShardId } from '../../src/lib/wine/referenceCatalog';

const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{for(const database of databases.splice(0))database.close();vi.restoreAllMocks()});

// Where the reported Tokyo batch was photographed, a Hong Kong table, and open sea.
const JIYUGAOKA=[35.608,139.672],CHUO=[35.67,139.773],TIN_HAU=[22.28,114.192],SEA=[30,150];

function setup(bucket:R2Bucket=placesBucket().bucket){
  const database=realD1();databases.push(database);
  const sent:RolloutQueueJob[]=[];
  const env={
    DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',
    WINE_IMAGES:{} as R2Bucket,REFERENCE_DATA:bucket,
    RESEARCH_QUEUE:{send:vi.fn(async(job:RolloutQueueJob)=>{sent.push(job)})} as unknown as Queue<unknown>
  };
  const sql=database.sql;
  sql.exec(`INSERT OR IGNORE INTO app_users(id,email,display_name,role) VALUES('owner','owner@example.com','Owner','owner'),('friend','friend@example.com','Friend','member');
    INSERT INTO batch_recognition_sessions(id,owner_id,status,created_at,updated_at,expires_at) VALUES('batch','owner','ready','now','now','later'),('friend-batch','friend','complete','now','now','later');
    INSERT INTO group_recognition_sessions(id,owner_id,original_object_key,preview_object_key,original_content_type,created_at,updated_at) VALUES('group','owner','group.jpg','group-preview.jpg','image/jpeg','now','now')`);
  let position=0;
  /** A saved wine whose tasting, and one photo, were placed at `at` and named `name`. */
  function wine(id:string,at:number[],name:string|null,{who='owner',photoName=name}:{who?:string;photoName?:string|null}={}){
    sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,'Producer','Wine','now','now')").run(id,who);
    sql.prepare("INSERT INTO wine_experiences(id,owner_id,wine_id,latitude,longitude,location_name,created_at,updated_at) VALUES(?,?,?,?,?,?,'now','now')").run(`${id}-tasting`,who,id,at[0],at[1],name);
    sql.prepare("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,latitude,longitude,location_name,metadata_source,created_at) VALUES(?,?,?,?,'image/jpeg',1,1,1,'uploaded',?,?,?,'exif','now')").run(`${id}-photo`,who,id,`${id}.jpg`,at[0],at[1],photoName);
  }
  /** The batch result the wine was confirmed from, or an unreviewed one. */
  function batchScan(wineId:string|null,at:number[],locationName:string|null,{who='owner',status=wineId?'confirmed':'ready'}={}){
    const id=`scan-${++position}`;
    sql.prepare("INSERT INTO batch_recognition_items(id,owner_id,session_id,position,status,recognition_json,confirmed_wine_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'now','now')")
      .run(id,who,who==='owner'?'batch':'friend-batch',position,status,JSON.stringify({producer:'Producer',wineName:'Wine',locationName,latitude:at[0],longitude:at[1]}),wineId);
    return id;
  }
  function groupScan(wineId:string,recognition:Record<string,unknown>|null,manual=false){
    sql.prepare("INSERT INTO group_recognition_items(id,owner_id,session_id,client_key,position,recognition_json,saved_wine_id,manual,created_at,updated_at) VALUES(?,'owner','group',?,?,?,?,?,'now','now')")
      .run(`group-${++position}`,`key-${position}`,position,recognition&&JSON.stringify(recognition),wineId,manual?1:0);
  }
  /** A single scan's reply: it records the photo's coordinates, not the wine it became. */
  function singleScan(at:number[],locationName:string|null){
    const id=`single-${++position}`;
    sql.prepare("INSERT INTO credit_quotes(id,user_id,path,fingerprint,units_json,total,expires_at) VALUES(?,'owner','/api/recognition','f','[]',0,0)").run(id);
    sql.prepare("INSERT INTO credit_operations(id,user_id,request_key,quote_id,path,fingerprint,units_json,reserved,status,response_json,created_at,updated_at) VALUES(?,'owner',?,?,'/api/recognition','f','[]',0,'complete',?,'now','now')")
      .run(id,id,id,JSON.stringify({producer:'Producer',wineName:'Wine',locationName,latitude:at[0],longitude:at[1]}));
  }
  const tasting=(id:string)=>sql.prepare('SELECT location_name FROM wine_experiences WHERE id=?').get(`${id}-tasting`)!.location_name;
  const photo=(id:string)=>sql.prepare('SELECT location_name FROM wine_images WHERE id=?').get(`${id}-photo`)!.location_name;
  return {database,env,sent,wine,batchScan,groupScan,singleScan,tasting,photo};
}

async function runToCompletion(env:ReturnType<typeof setup>['env']){
  await rolloutRoute(new Request('https://wine.example/api/admin/rollout/places',{method:'POST'}),env,owner);
  for(let chunk=0;chunk<10;chunk++)if((await processRolloutJob(env,'places')).complete)return;
  throw new Error('The place correction did not finish');
}

describe('correcting places the label model guessed',()=>{
  it('renames only places that are still what a scan proposed',async()=>{
    const t=setup();
    t.wine('guessed',JIYUGAOKA,'Yoichi, Hokkaido');t.batchScan('guessed',JIYUGAOKA,'Yoichi, Hokkaido');
    // A member's own words stay. The photo still holds the guess, so it is renamed.
    t.wine('typed',CHUO,'Mum’s flat',{photoName:'Courmas'});t.batchScan('typed',CHUO,'Courmas');
    // The model named nothing and nobody typed anything: named like a new scan.
    t.wine('unnamed',TIN_HAU,null);t.batchScan('unnamed',TIN_HAU,null);
    // A guess the member cleared stays cleared.
    t.wine('cleared',JIYUGAOKA,'',{photoName:'Hokkaido'});t.batchScan('cleared',JIYUGAOKA,'Hokkaido');
    // With no place proposed, the form saved the venue as the place.
    t.wine('venue',JIYUGAOKA,'The China Club',{photoName:null});t.batchScan('venue',JIYUGAOKA,null);
    t.wine('single',CHUO,'Meursault');t.singleScan(CHUO,'Meursault');
    t.wine('group',TIN_HAU,'Sonoma County, California');t.groupScan('group',{producer:'Producer',wineName:'Wine',locationName:'Sonoma County, California'});
    // A wine the member added by hand to a group review has no scan behind it, whatever its item records.
    t.wine('added',TIN_HAU,null);t.groupScan('added',{producer:'Producer',wineName:'Wine',locationName:null},true);
    // Saved before scan records were kept: nothing tells a guess from typing.
    t.wine('unrecorded',JIYUGAOKA,'Epernay');
    t.wine('right',JIYUGAOKA,'Jiyūgaoka, Tokyo');t.batchScan('right',JIYUGAOKA,'Yoichi, Hokkaido');
    t.wine('sea',SEA,'Champagne');t.batchScan('sea',SEA,'Champagne');
    t.wine('friend',CHUO,'Hokkaido',{who:'friend'});t.batchScan('friend',CHUO,'Hokkaido',{who:'friend'});
    const unreviewed=t.batchScan(null,JIYUGAOKA,'Yoichi, Hokkaido');

    await runToCompletion(t.env);

    expect(Object.fromEntries(['guessed','typed','unnamed','cleared','venue','single','group','added','unrecorded','right','sea','friend'].map(id=>[id,[t.tasting(id),t.photo(id)]]))).toEqual({
      guessed:['Jiyūgaoka, Tokyo','Jiyūgaoka, Tokyo'],
      typed:['Mum’s flat','Chūō, Tokyo'],
      unnamed:['Tin Hau, Hong Kong','Tin Hau, Hong Kong'],
      cleared:['','Jiyūgaoka, Tokyo'],
      venue:['The China Club','Jiyūgaoka, Tokyo'],
      single:['Chūō, Tokyo','Chūō, Tokyo'],
      group:['Tin Hau, Hong Kong','Tin Hau, Hong Kong'],
      added:[null,null],
      unrecorded:['Epernay','Epernay'],
      right:['Jiyūgaoka, Tokyo','Jiyūgaoka, Tokyo'],
      sea:[null,null],
      friend:['Chūō, Tokyo','Chūō, Tokyo']
    });
    const review=t.database.sql.prepare('SELECT recognition_json FROM batch_recognition_items WHERE id=?').get(unreviewed)!;
    expect(JSON.parse(String(review.recognition_json))).toMatchObject({locationName:'Jiyūgaoka, Tokyo',latitude:JIYUGAOKA[0]});
    // Tastings renamed: guessed, unnamed, single, group, sea and friend, plus the unreviewed result.
    expect((await rolloutStatus(t.database.db)).places).toEqual({state:'complete',processed:12,total:12,corrected:7,kept:3,unrecorded:2,error:null});
  });

  it('works through the wines in chunks, chained on the queue',async()=>{
    const t=setup();
    for(let i=0;i<30;i++){const id=`wine-${String(i).padStart(2,'0')}`;t.wine(id,JIYUGAOKA,'Yoichi, Hokkaido');t.batchScan(id,JIYUGAOKA,'Yoichi, Hokkaido')}
    await rolloutRoute(new Request('https://wine.example/api/admin/rollout/places',{method:'POST'}),t.env,owner);
    // Unreviewed results, then two chunks of wines.
    expect((await processRolloutJob(t.env,'places')).complete).toBe(false);
    expect((await processRolloutJob(t.env,'places')).complete).toBe(false);
    expect((await rolloutStatus(t.database.db)).places).toMatchObject({state:'running',processed:25,total:30,corrected:25});
    expect(t.tasting('wine-24')).toBe('Jiyūgaoka, Tokyo');expect(t.tasting('wine-25')).toBe('Yoichi, Hokkaido');
    expect((await processRolloutJob(t.env,'places')).complete).toBe(true);
    expect((await rolloutStatus(t.database.db)).places).toMatchObject({state:'complete',processed:30,corrected:30});
    expect(t.sent.map(job=>job.rollout)).toEqual(['places','places','places']);
  });

  it('leaves a place a member edits while the job is looking it up',async()=>{
    const {bucket}=placesBucket(),member={edit:()=>{}};
    const t=setup({get:async(key:string)=>{if(key.includes('/shard-'))member.edit();return bucket.get(key)}} as unknown as R2Bucket);
    member.edit=()=>t.database.sql.prepare("UPDATE wine_experiences SET location_name='Typed meanwhile' WHERE id='guessed-tasting'").run();
    t.wine('guessed',JIYUGAOKA,'Yoichi, Hokkaido');t.batchScan('guessed',JIYUGAOKA,'Yoichi, Hokkaido');
    await runToCompletion(t.env);
    expect(t.tasting('guessed')).toBe('Typed meanwhile');
    expect((await rolloutStatus(t.database.db)).places).toMatchObject({state:'complete',corrected:0});
  });

  it('will not start before the place list is imported',async()=>{
    const t=setup({get:async()=>null} as unknown as R2Bucket);
    await expect(rolloutRoute(new Request('https://wine.example/api/admin/rollout/places',{method:'POST'}),t.env,owner)).rejects.toMatchObject({status:409,message:'Import the photo place list first: run npm run places:import.'});
    expect((await rolloutStatus(t.database.db)).places.state).toBe('not_started');
  });

  it('pauses on a missing shard instead of erasing the name',async()=>{
    const {bucket}=placesBucket(),missing=`shard-${referenceShardId(placeCellKey(JIYUGAOKA[0],JIYUGAOKA[1]))}.json`;
    const t=setup({get:async(key:string)=>key.endsWith(missing)?null:bucket.get(key)} as unknown as R2Bucket);
    t.wine('guessed',JIYUGAOKA,'Yoichi, Hokkaido');t.batchScan('guessed',JIYUGAOKA,'Yoichi, Hokkaido');
    await rolloutRoute(new Request('https://wine.example/api/admin/rollout/places',{method:'POST'}),t.env,owner);
    await processRolloutJob(t.env,'places');
    await expect(processRolloutJob(t.env,'places')).rejects.toThrow('Photo place list shard unavailable');
    expect(t.tasting('guessed')).toBe('Yoichi, Hokkaido');
    expect((await rolloutStatus(t.database.db)).places).toMatchObject({state:'paused',processed:0,error:expect.stringContaining('shard unavailable')});
  });
});
