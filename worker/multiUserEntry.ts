import legacy from './structureEntry';
import { SignJWT } from 'jose';
import { ApiError,json,stamp,type IdentityEnv } from './multiUser/common';
import { authenticate,authRoute,verifyOrigin } from './multiUser/auth';
import { socialRoute } from './multiUser/social';
import { adminRoute,deploymentAiCost } from './multiUser/admin';
import { aiRoute,creditRead,creditSummary,quote,reserve,saveOperationResponse,reconcileOperation,wineTargets,settle,type CreditOperation } from './multiUser/credits';
import { claimDelivery,durableQueue,finishDelivery,flushOutbox,maintainJobs,markUncertain,type JobEnvelope } from './multiUser/jobs';
import { meteredBucket } from './multiUser/storage';
import { assembleDeepSearch,loadResearchCache } from '../src/lib/research/cache';
import type { AiRateEnv } from '../src/lib/usage/rates';
import { rolloutRoute } from './multiUser/rollout';
import { reusableProducer } from '../src/lib/research/sharedProducer';
import { readVintageWindow,type VintageSubject } from '../src/lib/maturity/vintageWindow';

export type MultiUserEnv=Parameters<typeof legacy.fetch>[1]&IdentityEnv&AiRateEnv;
type Batch=Parameters<typeof legacy.queue>[0];
function revalidated(response:Response){const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie');headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers})}
async function internalRequest(request:Request,env:MultiUserEnv,user:string){
 const token=await new SignJWT({internal:true}).setProtectedHeader({alg:'HS256'}).setSubject(user).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(env.AUTH_SECRET));
 const headers=new Headers(request.headers);headers.set('Authorization',`Bearer ${token}`);headers.delete('Cookie');return new Request(request,{headers});
}
export default {
 async fetch(request:Request,env:MultiUserEnv,ctx:ExecutionContext):Promise<Response>{
  const path=new URL(request.url).pathname;if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
   const auth=await authRoute(request,env);if(auth)return auth;
   const member=await authenticate(request,env);verifyOrigin(request,env);
   if(request.headers.has('X-WineLog-Account')&&request.headers.get('X-WineLog-Account')!==member.id)throw new ApiError(409,'Account changed; reload this page');
   const scoped={...env,WINE_IMAGES:meteredBucket(env.WINE_IMAGES,env.DB,member.id),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB)};
   const direct=await creditRead(request,env,member)??await rolloutRoute(request,env,member)??await adminRoute(request,env,member)??await socialRoute(request,scoped,member);if(direct)return direct;
   if(path==='/api/credits/quotes'&&request.method==='POST'){
    const url=new URL(request.url),target=url.searchParams.get('path')||'';if(!target.startsWith('/api/')||target.includes('?')||!aiRoute(target,'POST'))throw new ApiError(400,'Invalid quote target');
    const original=new Request(new URL(target,env.APP_URL),request);return json(await quote(original,env,member));
   }
   const forwarded=await internalRequest(request,env,member.id);
   if(aiRoute(path,request.method)){
    const cost=await deploymentAiCost(env.DB,env);
    const {operation,existing}=await reserve(request,env,member,cost.usd);
    if(existing)return operation.response_json?json({...JSON.parse(operation.response_json),creditOperationId:operation.id,creditSettlement:creditSummary(operation)},operation.response_status??202):json({accepted:true,creditOperationId:operation.id,status:operation.status},202);
    const following=await env.DB.prepare('SELECT operation_id FROM research_followers WHERE operation_id=?').bind(operation.id).first();
    if(following){await env.DB.prepare("UPDATE credit_operations SET status='running',response_json=?,response_status=202,updated_at=? WHERE id=?").bind(JSON.stringify({accepted:true,waitingForFriend:true}),stamp(),operation.id).run();return json({accepted:true,waitingForFriend:true,creditOperationId:operation.id},202)}
    if(operation.reserved===0){
     if(path.endsWith('/deep-search')){await settle(env.DB,operation,0,{body:{cached:true},status:200});return json({cached:true,creditOperationId:operation.id})}
     const cachedProducer=path.match(/^\/api\/producers\/([^/]+)\/research$/);
     if(cachedProducer){const producer=await reusableProducer(env.DB,member.id,cachedProducer[1]);if(producer){const result={cached:true};await settle(env.DB,operation,0,{body:result,status:200});return json({...result,creditOperationId:operation.id})}}
     if(path==='/api/maturity/vintage'){const window=await readVintageWindow(env.DB,member.id,await request.clone().json() as VintageSubject,true);if(window){await settle(env.DB,operation,0,{body:{cached:true},status:200});return json({cached:true,window,creditOperationId:operation.id})}}
     if(cachedProducer||path==='/api/maturity/vintage'){await settle(env.DB,operation,0);throw new ApiError(409,'Research access changed; request a new quote')}
    }
    const executionEnv={...scoped,CREDIT_CONTEXT:{db:env.DB,operationId:operation.id,namespace:'http'},CREDIT_PRODUCER_IDS:JSON.parse(operation.units_json).flatMap((u:{action:string;targetId?:string})=>u.action==='producer_research'?[u.targetId]:[]),CREDIT_RESEARCH_SCOPES:JSON.parse(operation.units_json).flatMap((u:{scope?:string})=>u.scope?[u.scope]:[]),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB,operation.id)};
    try{
     const started=await env.DB.prepare("UPDATE credit_operations SET status='running',updated_at=? WHERE id=? AND status='reserved'").bind(stamp(),operation.id).run();
     if(!started.meta.changes)throw new ApiError(409,'Reservation is no longer available');
     const response=await legacy.fetch(forwarded,executionEnv,ctx),data=await saveOperationResponse(env.DB,operation,response);
     ctx.waitUntil(flushOutbox(env.DB,env.RESEARCH_QUEUE));
     return json({...data,creditOperationId:operation.id},response.status);
    }catch(error){await markUncertain(env.DB,operation.id);throw error}
   }
   const response=await legacy.fetch(forwarded,scoped,ctx);
   const producerMatch=path.match(/^\/api\/producers\/([^/]+)$/);
   if(response.ok&&request.method==='GET'&&producerMatch){const shared=await reusableProducer(env.DB,member.id,producerMatch[1]);if(shared)return json({...await response.json() as object,...shared})}
   if(response.ok&&request.method==='GET'&&path==='/api/maturity/vintage'){
    const params=Object.fromEntries(new URL(request.url).searchParams),subject={...params,vintage:Number(params.vintage)};
    const window=await readVintageWindow(env.DB,member.id,subject,true);return json({window});
   }
   const wineMatch=path.match(/^\/api\/wines\/([^/]+)$/);
   if(response.ok&&request.method==='GET'&&wineMatch){
    const row=await env.DB.prepare('SELECT * FROM wines WHERE owner_id=? AND id=?').bind(member.id,wineMatch[1]).first<Record<string,unknown>>();
    if(row){const targets=wineTargets(row),cache=await loadResearchCache(env.DB,member.id,targets,true);const data=await response.json() as Record<string,unknown>;return json({...data,deepSearch:cache.size?assembleDeepSearch(cache,targets):null})}
   }
   if(request.method!=='GET')ctx.waitUntil(flushOutbox(env.DB,env.RESEARCH_QUEUE));
   return revalidated(response);
  }catch(error){
   if(error instanceof ApiError)return json({error:error.message},error.status);
   console.error(JSON.stringify({event:'multi_user_request_failed',path,error:error instanceof Error?error.message:String(error)}));return json({error:'Request could not be completed'},500);
  }
 },
 async queue(batch:Batch,env:MultiUserEnv){
  for(const message of batch.messages){
   const job=message.body as typeof message.body&JobEnvelope,id=job._outboxId||message.id;
   if(!await claimDelivery(env.DB,id)){const done=await env.DB.prepare('SELECT done FROM queue_deliveries WHERE id=?').bind(id).first<{done:number}>();if(done?.done)message.ack();else message.retry({delaySeconds:60});continue}
   let retried=false;
   try{
    const member=await env.DB.prepare("SELECT id FROM app_users WHERE id=? AND status='active'").bind(job.owner||'').first();
    if(!member){message.retry({delaySeconds:300});retried=true;continue}
    const op=job._creditOperationId?await env.DB.prepare('SELECT * FROM credit_operations WHERE id=? AND user_id=?').bind(job._creditOperationId,job.owner!).first<CreditOperation>():null;
    if(job.kind!=='recognition_batch_cleanup'&&(!op||!['reserved','running','review'].includes(op.status))){message.ack();continue}
    const scoped={...env,CREDIT_CONTEXT:op?{db:env.DB,operationId:op.id,namespace:'queue'}:undefined,CREDIT_RESEARCH_SCOPES:op?JSON.parse(op.units_json).flatMap((u:{scope?:string})=>u.scope?[u.scope]:[]):[],WINE_IMAGES:meteredBucket(env.WINE_IMAGES,env.DB,job.owner!),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB,op?.id)};
    const wrapped={id:message.id,timestamp:message.timestamp,body:message.body,attempts:message.attempts,ack:()=>message.ack(),retry:(options?:QueueRetryOptions)=>{retried=true;message.retry(options)}};
    await legacy.queue({queue:batch.queue,metadata:batch.metadata,messages:[wrapped],ackAll:()=>message.ack(),retryAll:(options?:QueueRetryOptions)=>{retried=true;message.retry(options)}},scoped);
    if(op)await reconcileOperation(env.DB,op);
   }catch(error){retried=true;message.retry();console.error(JSON.stringify({event:'multi_user_queue_failed',id,error:String(error)}))}
   finally{await finishDelivery(env.DB,id,retried)}
  }
  await flushOutbox(env.DB,env.RESEARCH_QUEUE);
 },
 async scheduled(_event:ScheduledController,env:MultiUserEnv){await maintainJobs(env.DB,env.RESEARCH_QUEUE,env.WINE_IMAGES);await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('last_maintenance',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(stamp()).run()}
};
