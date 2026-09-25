import { afterEach,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { flushOutbox,claimDelivery,finishDelivery } from '../../worker/multiUser/jobs';
import { ReferenceReadScope,referenceRowsByShard } from '../../src/lib/wine/referenceCatalog';
import { warmSemanticWineIndex } from '../../src/lib/journal/semanticSearch';
import { buildResearchTargets,loadResearchCache } from '../../src/lib/research/cache';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks()});

it('recovers an expired dispatch lease, delays send failures and rejects completed deliveries',async()=>{
 const d=realD1();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
 try{
  const now=Math.floor(Date.now()/1000);
  d.sql.prepare("INSERT INTO queue_outbox(id,body_json,due_at) VALUES('leased','{}',?)").run(now+60);
  const send=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),queue={send} as unknown as Queue;
  await flushOutbox(d.db,queue);expect(send).not.toHaveBeenCalled();
  vi.setSystemTime(Date.now()+61_000);await flushOutbox(d.db,queue);
  expect(d.sql.prepare('SELECT sent_at,attempts FROM queue_outbox').get()).toEqual({sent_at:null,attempts:1});
  await flushOutbox(d.db,queue);expect(send).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now()+61_000);await flushOutbox(d.db,queue);await flushOutbox(d.db,queue);expect(send).toHaveBeenCalledTimes(2);
  const lease=await claimDelivery(d.db,'leased');expect(lease).toBeGreaterThan(0);expect(await claimDelivery(d.db,'leased')).toBe(false);
  await finishDelivery(d.db,'leased',false,lease);expect(await claimDelivery(d.db,'leased')).toBe(false);
 }finally{d.close()}
});

it('shares reference reads only within a request and preserves manifest expiry',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
 let version='v1';
 const get=vi.fn(async(key:string)=>({text:async()=>JSON.stringify(key.endsWith('current.json')?{prefix:version,shardCount:256}:[{key}])}));
 const bucket={get} as unknown as R2Bucket,scope=new ReferenceReadScope(bucket);
 expect(await Promise.all(Array.from({length:20},()=>referenceRowsByShard(scope,'lwin','001')))).toEqual(Array.from({length:20},()=>[{key:'v1/shard-001.json'}]));
 expect(get).toHaveBeenCalledTimes(2);expect(scope.pending.size).toBe(0);
 await referenceRowsByShard(new ReferenceReadScope(bucket),'lwin','001');expect(get).toHaveBeenCalledTimes(2);
 version='v2';vi.setSystemTime(Date.now()+61_000);
 expect(await referenceRowsByShard(new ReferenceReadScope(bucket),'lwin','001')).toEqual([{key:'v2/shard-001.json'}]);expect(get).toHaveBeenCalledTimes(4);
 const separate={get:vi.fn(async()=>null)} as unknown as R2Bucket;
 expect(await referenceRowsByShard(new ReferenceReadScope(separate),'lwin','001')).toEqual([]);
});

it('does not retain rejected reference reads or await another request I/O',async()=>{
 const get=vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(async()=>null);
 const bucket={get} as unknown as R2Bucket,scope=new ReferenceReadScope(bucket);
 const failures=await Promise.allSettled([referenceRowsByShard(scope,'lwin','001'),referenceRowsByShard(scope,'lwin','001')]);
 expect(failures.every(result=>result.status==='rejected')).toBe(true);expect(get).toHaveBeenCalledTimes(1);
 expect(await referenceRowsByShard(scope,'lwin','001')).toEqual([]);expect(get).toHaveBeenCalledTimes(2);
 const otherGet=vi.fn(async()=>null),other={get:otherGet} as unknown as R2Bucket;
 await Promise.all([referenceRowsByShard(new ReferenceReadScope(other),'lwin','001'),referenceRowsByShard(new ReferenceReadScope(other),'lwin','001')]);
 expect(otherGet).toHaveBeenCalledTimes(2);
});

it('still checks the current embedding budget before every AI batch',async()=>{
 const d=realD1();try{
  d.sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('member','m@example.com','Member','member'); INSERT INTO pilot_settings(id,value_json) VALUES(1,'{\"aiDailyEmbeddingRequests\":1}') ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json");
  for(let i=0;i<25;i++)d.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(`w${i}`,'member','Estate','Wine','2026-01-01','2026-01-01');
  const run=vi.fn(async(_model:string,input:{text:string[]})=>({data:input.text.map(()=>[1,...Array(1023).fill(0)])}));
  await warmSemanticWineIndex({DB:d.db,AI:{run}} as never,'member');expect(run).toHaveBeenCalledTimes(1);
  expect(d.sql.prepare('SELECT count(*) AS n FROM wine_semantic_embeddings').get()!.n).toBe(24);
  await warmSemanticWineIndex({DB:d.db,AI:{run}} as never,'member');expect(run).toHaveBeenCalledTimes(1);
 }finally{d.close()}
});

it('uses one owner-scoped research lookup for many targets and none for an empty request',async()=>{
 const d=realD1();try{
  const targets=Array.from({length:40},(_,i)=>buildResearchTargets({producer:`P${i}`,wineName:`Wine${i}`,vintage:2020})).flat();
  const before=d.counts().reads;
  expect((await loadResearchCache(d.db,'owner',targets)).size).toBe(0);
  expect(d.counts().reads-before).toBe(1);
  await loadResearchCache(d.db,'owner',[],true);expect(d.counts().reads-before).toBe(1);
 }finally{d.close()}
});
