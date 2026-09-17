import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import { processRolloutJob,rolloutRoute,rolloutStatus,type RolloutQueueJob } from '../../worker/multiUser/rollout';
import type { Member } from '../../worker/multiUser/common';

const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const databases:Array<ReturnType<typeof realD1>>=[];

afterEach(()=>{for(const database of databases.splice(0))database.close();vi.restoreAllMocks()});

function setup(objects:Array<{key:string;size:number}>=[]){
 const database=realD1();databases.push(database);
 const sent:RolloutQueueJob[]=[];
 const list=vi.fn(async({cursor}:{cursor?:string}={})=>{
  if(cursor)return {objects:[],truncated:false,cursor:undefined};
  return {objects:objects.map(object=>({...object,uploaded:new Date(),etag:'etag',httpEtag:'etag',checksums:{toJSON:()=>({})},storageClass:'Standard'})),truncated:false,cursor:undefined};
 });
 const env={
  DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',
  WINE_IMAGES:{list} as unknown as R2Bucket,
  RESEARCH_QUEUE:{send:vi.fn(async(job:RolloutQueueJob)=>{sent.push(job)})} as unknown as Queue<unknown>
 };
 return {database,env,sent,list};
}

describe('background launch preparation',()=>{
 it('returns immediately, then inventories R2 from the queue without the page staying open',async()=>{
  const {database,env,sent,list}=setup([{key:'legacy/a.jpg',size:123},{key:'owners/owner/b.jpg',size:456}]);
  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/storage',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(list).not.toHaveBeenCalled();expect(sent).toEqual([{kind:'admin_rollout',owner:'owner',rollout:'storage'}]);

  const result=await processRolloutJob(env,'storage');
  expect(result).toMatchObject({complete:true,processed:2,busy:false});
  expect(database.sql.prepare('SELECT count(*) AS n FROM stored_objects').get()!.n).toBe(2);
  expect((await rolloutStatus(database.db)).storage).toMatchObject({state:'complete',objects:2,error:null});
 });

 it('indexes research in bounded queue chunks and exposes resumable progress',async()=>{
  const {database,env,sent}=setup();
  for(let i=0;i<12;i++)database.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(`w${String(i).padStart(2,'0')}`,'owner','Producer',`Wine ${i}`,'now','now');

  const response=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/research',{method:'POST'}),env,owner);
  expect(response?.status).toBe(202);expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'research'});

  const first=await processRolloutJob(env,'research');
  expect(first).toMatchObject({complete:false,processed:10,busy:false});
  let status=await rolloutStatus(database.db);
  expect(status.research).toMatchObject({state:'running',wines:{processed:10,total:12},producers:{processed:0,total:0}});
  expect(sent.at(-1)).toEqual({kind:'admin_rollout',owner:'owner',rollout:'research'});

  const second=await processRolloutJob(env,'research');
  expect(second).toMatchObject({complete:true,processed:2,busy:false});
  status=await rolloutStatus(database.db);
  expect(status.research).toMatchObject({state:'complete',wines:{processed:12,total:12},producers:{processed:0,total:0},error:null});
 });
});
