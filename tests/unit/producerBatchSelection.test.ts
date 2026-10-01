import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import queueEntry from '../../worker/researchQueueEntry';
import { createSession } from '../../src/lib/auth/session';
import { advanceCampaign,CAMPAIGN_CONCURRENCY } from '../../src/lib/producers/researchCampaign';
import { quote,reserve } from '../../worker/multiUser/credits';
import { stamp,type Member } from '../../worker/multiUser/common';
import { realD1 } from './support/realD1';

const secret='batch-selection-test-secret',total=105;
const owner:Member={id:'owner',role:'owner',email:'owner@example.com',display_name:'Owner',status:'active'};
const ctx={waitUntil:()=>undefined,passThroughOnException:()=>undefined} as unknown as ExecutionContext;
let database:ReturnType<typeof realD1>;
function seedProducers(from:number,to:number){
 const insert=database.sql.prepare('INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,created_at,updated_at) VALUES(?,?,?,?,?,?,?)');
 for(let i=from;i<to;i++){
  const name=`Estate ${String(i).padStart(3,'0')}`;
  insert.run(`producer-${i}`,'owner',name,name.toLowerCase(),'France',stamp(),stamp());
 }
}
beforeEach(()=>{database=realD1();seedProducers(0,total)});
afterEach(()=>database.close());

describe('producer batch selection through planning, admission and queuing',()=>{
 it('reserves All for a large private library without one query or lock statement per producer',async()=>{
  const size=1000;seedProducers(total,size);
  const request=new Request('https://wine.example/api/producers/research-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH_BATCH',limit:size})});
  const quoted=await quote(request,{DB:database.db},owner);expect(quoted.units).toHaveLength(size);
  request.headers.set('X-WineLog-Quote',quoted.id);request.headers.set('Idempotency-Key',crypto.randomUUID());
  const {operation}=await reserve(request,{DB:database.db},owner);
  expect(JSON.parse(operation.units_json)).toHaveLength(size);
  expect(database.sql.prepare('SELECT count(*) AS n FROM research_work WHERE operation_id=?').get(operation.id)!.n).toBe(size);
  expect(database.counts().reads).toBeLessThan(60);expect(database.counts().writes).toBeLessThan(30);
 });
 it.each([10,25,50,100,total])('queues the selected %i producers with only two in flight',async(limit)=>{
  const headers={Authorization:`Bearer ${await createSession('owner',secret)}`,'Content-Type':'application/json'},send=vi.fn(async()=>{});
  const env={DB:database.db,AUTH_SECRET:secret,RESEARCH_QUEUE:{send} as unknown as Queue<unknown>};
  const plan=await queueEntry.fetch(new Request(`https://wine.example/api/producers/research-batch/plan?limit=${limit}`,{headers}),env as never,ctx);
  expect(plan.status).toBe(200);
  expect(await plan.json()).toMatchObject({unresearched:total,willRun:limit,maxPerRun:total,concurrency:CAMPAIGN_CONCURRENCY});
  const request=new Request('https://wine.example/api/producers/research-batch',{method:'POST',headers,body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH_BATCH',limit})});
  const quoted=await quote(request,env,owner);expect(quoted.units).toHaveLength(limit);
  request.headers.set('X-WineLog-Quote',quoted.id);request.headers.set('Idempotency-Key',crypto.randomUUID());
  const {operation}=await reserve(request,env,owner);
  expect(JSON.parse(operation.units_json)).toHaveLength(limit);
  const response=await queueEntry.fetch(request,{...env,CREDIT_PRODUCER_IDS:quoted.units.map(unit=>unit.targetId!)} as never,ctx);
  expect(response.status).toBe(202);
  const body=await response.json() as {campaign:{id:string;requested:number;items:unknown[]}};
  expect(body.campaign.requested).toBe(limit);expect(body.campaign.items).toHaveLength(limit);
  expect(send).toHaveBeenCalledTimes(1);
  await advanceCampaign(env,'owner',body.campaign.id);
  const counts=database.sql.prepare('SELECT status,count(*) AS n FROM producer_research_campaign_items WHERE campaign_id=? GROUP BY status').all(body.campaign.id);
  expect(counts).toEqual(expect.arrayContaining([{status:'running',n:CAMPAIGN_CONCURRENCY},{status:'pending',n:limit-CAMPAIGN_CONCURRENCY}]));
  expect(send.mock.calls).toHaveLength(1+CAMPAIGN_CONCURRENCY);
 });
});
