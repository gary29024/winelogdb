import { mkdirSync,writeFileSync } from 'node:fs';
import { expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { listJournalPage } from '../../src/lib/journal/list';
import { buildResearchTargets,loadResearchCache } from '../../src/lib/research/cache';
import { semanticWineIds,warmSemanticWineIndex } from '../../src/lib/journal/semanticSearch';
import { socialRoute } from '../../worker/multiUser/social';
import { flushOutbox } from '../../worker/multiUser/jobs';
import { groupRecognitionSpec } from '../../worker/groupRecognitionHandler';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';

// Deterministic operation counts are the regression budget; timings are local
// SQLite/JS observations, never estimates of Cloudflare latency or billing.
it('profiles common reads, cached navigation, recognition and competing dispatchers',async()=>{
 const d=realD1(),metrics:Record<string,unknown>={};
 const measure=async(name:string,run:()=>Promise<unknown>)=>{
  const before=d.counts(),start=performance.now();const result=await run();
  metrics[name]={reads:d.counts().reads-before.reads,writes:d.counts().writes-before.writes,ms:Math.round((performance.now()-start)*100)/100};return result;
 };
 try{
  d.sql.exec(`INSERT OR IGNORE INTO app_users(id,email,display_name,role) VALUES ('owner','o@example.com','Owner','owner'),('viewer','v@example.com','Viewer','member');
   INSERT INTO friendships(user_id,friend_id) VALUES ('viewer','owner');
   INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES ('p','owner','Estate','estate','2026-01-01','2026-01-01');`);
  for(let i=0;i<72;i++){
   d.sql.prepare('INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(`w${i}`,'owner','Estate','p',`Wine ${i}`,2020,'2026-01-01','2026-01-01');
   d.sql.prepare('INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES(?,?,?)').run(`w${i}`,'owner','viewer');
  }
  d.sql.exec("INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,created_at) VALUES('photo','owner','w0','photo.jpg','image/jpeg',10,10,10,'uploaded','2026-01-01')");
  const journal=await measure('journal',()=>listJournalPage(d.db,'viewer',{},[],true));
  expect(journal).toMatchObject({total:72,items:expect.any(Array)});
  await measure('researchScopes',()=>loadResearchCache(d.db,'owner',buildResearchTargets({producer:'Estate',wineName:'Wine',vintage:2020})));
  const ai=vi.fn(async(_model:string,input:{text:string[]})=>({data:input.text.map(()=>[1,...Array(1023).fill(0)])}));
  const env={DB:d.db,AI:{run:ai}} as never;
  await warmSemanticWineIndex(env,'owner');
  await semanticWineIds(env,'owner','floral elegant Burgundy');ai.mockClear();
  await measure('semanticCached',()=>semanticWineIds(env,'owner','floral elegant Burgundy'));
  await measure('semanticWarmClean',()=>warmSemanticWineIndex(env,'viewer'));
  metrics.cachedAiCalls=ai.mock.calls.length;
  const get=vi.fn(async()=>({body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.close()}}),httpMetadata:{contentType:'image/jpeg'}}));
  await measure('sharedPhoto',async()=>{
   const response=await socialRoute(new Request('https://wine.example/api/shared/wines/w0/photos/photo'),{DB:d.db,AUTH_SECRET:'secret',APP_URL:'https://wine.example',WINE_IMAGES:{get} as unknown as R2Bucket},{id:'viewer',email:'v@example.com',display_name:'Viewer',role:'member',status:'active'});
   expect(response?.status).toBe(200);await response!.arrayBuffer();
  });metrics.sharedPhotoR2=get.mock.calls.length;
  const secret='profile-secret-with-enough-characters';
  await measure('producer',async()=>{
   const response=await app.fetch(new Request('https://wine.example/api/producers/p',{headers:{Authorization:`Bearer ${await createSession('owner',secret)}`}}),{DB:d.db,AUTH_SECRET:secret} as never,{waitUntil:()=>{},passThroughOnException:()=>{}} as never);
   expect(response.status).toBe(200);expect(await response.json()).toMatchObject({canonicalName:'Estate'});
  });
  const referenceGet=vi.fn(async(key:string)=>({text:async()=>JSON.stringify(key.endsWith('current.json')?{prefix:'reference/lwin/v1',shardCount:256}:[])}));
  await measure('groupReference',()=>groupRecognitionSpec.enrich!({get:referenceGet} as unknown as R2Bucket,{wines:Array.from({length:20},()=>({producer:'Estate',wineName:'Wine',vintage:2020,confidence:.95})),unresolvedCount:0} as never));
  metrics.groupReferenceR2=referenceGet.mock.calls.length;
  d.sql.exec("INSERT INTO queue_outbox(id,body_json,due_at) VALUES('outbox','{}',0)");
  const send=vi.fn(async()=>{await new Promise(resolve=>setTimeout(resolve,5))});
  await measure('outboxConcurrent',()=>Promise.all([flushOutbox(d.db,{send} as unknown as Queue),flushOutbox(d.db,{send} as unknown as Queue)]));
  metrics.queueSends=send.mock.calls.length;
  const baseline=process.env.PROFILE_EXPECT_BASELINE==='1';
  expect(metrics).toMatchObject(baseline?{
   journal:{reads:2,writes:0},researchScopes:{reads:4,writes:0},
   semanticCached:{reads:2,writes:0},semanticWarmClean:{reads:4,writes:0},cachedAiCalls:0,
   sharedPhoto:{reads:2,writes:0},sharedPhotoR2:1,producer:{reads:13,writes:0},groupReferenceR2:40,queueSends:2
  }:{
   journal:{reads:2,writes:0},researchScopes:{reads:1,writes:0},
   semanticCached:{reads:2,writes:0},semanticWarmClean:{reads:1,writes:0},cachedAiCalls:0,
   sharedPhoto:{reads:1,writes:0},sharedPhotoR2:1,producer:{reads:11,writes:0},
   groupReferenceR2:2,queueSends:1
  });
  mkdirSync('.cache',{recursive:true});writeFileSync(`.cache/backend-profile-${process.env.PROFILE_LABEL??'current'}.json`,JSON.stringify(metrics,null,2));
  console.log(JSON.stringify(metrics));
 }finally{d.close()}
});
