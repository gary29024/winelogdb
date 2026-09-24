import legacy from './structureEntry';
import { SignJWT } from 'jose';
import { ApiError,json,stamp,type IdentityEnv } from './multiUser/common';
import { authenticate,authRoute,verifyOrigin } from './multiUser/auth';
import { socialRoute } from './multiUser/social';
import { adminRoute,deploymentAiCost } from './multiUser/admin';
import { aiRoute,creditRead,publicAiResponse,quote,reserve,saveOperationResponse,reconcileOperation,wineTargets,settle,type CreditOperation } from './multiUser/credits';
import { memberActionForRequest,memberAiAccess,memberAiActionAccess,reserveMemberAiAllowance } from './multiUser/memberAccess';
import { providerAuthorization } from './multiUser/provider';
import { claimDelivery,durableQueue,finishDelivery,flushOutbox,isQueueCleanup,maintainJobs,markUncertain,type JobEnvelope } from './multiUser/jobs';
import { meteredBucket } from './multiUser/storage';
import { adoptFriendResearch,assembleDeepSearch,loadWineResearchCache,RESEARCH_EDITION_COLUMNS } from '../src/lib/research/cache';
import type { AiRateEnv } from '../src/lib/usage/rates';
import { processRolloutJob,recoverRollouts,rolloutRoute,type RolloutQueueJob } from './multiUser/rollout';
import { LWIN_AI_LEASE_SECONDS } from './multiUser/lwinRepair';
import { reusableProducer } from '../src/lib/research/sharedProducer';
import { readVintageWindow,type VintageSubject } from '../src/lib/maturity/vintageWindow';
import { champagneExtractionRoute } from '../src/lib/ai/reservedRoutes';

export type MultiUserEnv=Parameters<typeof legacy.fetch>[1]&IdentityEnv&AiRateEnv;
type Batch=Parameters<typeof legacy.queue>[0];
function revalidated(response:Response){const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie');headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers})}
async function internalRequest(request:Request,env:MultiUserEnv,user:string){
 const token=await new SignJWT({internal:true}).setProtectedHeader({alg:'HS256'}).setSubject(user).setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode(env.AUTH_SECRET));
 const headers=new Headers(request.headers);headers.set('Authorization',`Bearer ${token}`);headers.delete('Cookie');return new Request(request,{headers});
}
function allowanceMessage(label:string,resetsAt:string){return `${label} has no free runs remaining this week. The allowance resets ${new Date(resetsAt).toISOString()}.`}
export default {
 async fetch(request:Request,env:MultiUserEnv,ctx:ExecutionContext):Promise<Response>{
  const path=new URL(request.url).pathname;if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
   const auth=await authRoute(request,env);if(auth)return auth;
   const member=await authenticate(request,env);verifyOrigin(request,env);
   if(member.role!=='owner'&&/^\/api\/wines\/[^/]+\/(reference-preview|reference-review|reference-suggestion|producer-name-review)$/.test(path))throw new ApiError(403,'Owner access required');
   if(request.headers.has('X-WineLog-Account')&&request.headers.get('X-WineLog-Account')!==member.id)throw new ApiError(409,'Account changed; reload this page');
   // Every provider request still carries an operation context for idempotency,
   // cost accounting and budget holds. During the pilot members are not charged
   // WineLog credits: each user-facing action is either included for everyone or
   // consumes a successful-run allowance configured by the owner.
   const unpriced=providerAuthorization(member.role,`${path} has no member AI policy, so it cannot reach a provider.`);
   const scoped={...env,CREDIT_CONTEXT:unpriced,WINE_IMAGES:meteredBucket(env.WINE_IMAGES,env.DB,member.id,{skipMemberLimit:member.role==='owner'}),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB)};
   if(path==='/api/credits'&&request.method==='GET'){
    const wallet=await env.DB.prepare('SELECT balance,reserved,balance-reserved AS available FROM credit_wallets WHERE user_id=?').bind(member.id).first()??{balance:0,reserved:0,available:0};
    if(member.role==='owner')return json({...wallet,actionAccess:null,sponsoredAi:true});
    return json({...wallet,actionAccess:await memberAiAccess(env.DB,member.id),sponsoredAi:true});
   }
   const direct=await creditRead(request,env,member)??await rolloutRoute(request,env,member)??await adminRoute(request,env,member)??await socialRoute(request,env,member,ctx);if(direct)return direct;
   if(path==='/api/credits/quotes'&&request.method==='POST'){
    const url=new URL(request.url),target=url.searchParams.get('path')||'';if(!target.startsWith('/api/')||target.includes('?')||!aiRoute(target,'POST'))throw new ApiError(400,'Invalid quote target');
    const original=new Request(new URL(target,env.APP_URL),request),quoted=await quote(original,env,member);
    if(member.role==='member'&&quoted.units.length){
     const action=memberActionForRequest(original);if(!action)throw new ApiError(503,'This AI action has no member access policy');
     const access=await memberAiActionAccess(env.DB,member.id,action);
     if(access.accessMode==='allowance'&&!access.remaining)throw new ApiError(429,allowanceMessage(access.label,access.resetsAt));
     return json({...quoted,access:access.accessMode==='included'?'included':'action_allowance',actionAccess:access});
    }
    return json({...quoted,access:member.role==='owner'?'owner':'reused'});
   }
   if(aiRoute(path,request.method)){
    const cost=await deploymentAiCost(env.DB,env);
    const {operation,existing}=await reserve(request,env,member,cost.usd),operationUnits=JSON.parse(operation.units_json) as Array<{action:string;targetId?:string;scope?:string;parentOperationId?:string}>;
    if(member.role==='member'&&operationUnits.length){
     const action=memberActionForRequest(request);if(!action){if(!existing)await settle(env.DB,operation,0,{body:{error:'This AI action has no member access policy'},status:503},false);throw new ApiError(503,'This AI action has no member access policy')}
     // A tasting-sheet continuation is part of the same successful user-facing
     // run as its parent page, just as it was zero-credit before this policy.
     const continuation=action==='scan_sheet'&&operationUnits.every(unit=>Boolean(unit.parentOperationId));
     if(!continuation){
      const claim=await reserveMemberAiAllowance(env.DB,member.id,operation.id,action);
      if(!claim.allowed){const message=allowanceMessage(claim.access.label,claim.access.resetsAt);if(!existing)await settle(env.DB,operation,0,{body:{error:message},status:429},false);throw new ApiError(429,message)}
     }
    }
    if(existing)return operation.response_json?json(publicAiResponse(path,JSON.parse(operation.response_json) as Record<string,unknown>,operation),operation.response_status??202):json({accepted:true,creditOperationId:operation.id,status:operation.status},202);
    const following=await env.DB.prepare('SELECT operation_id FROM research_followers WHERE operation_id=?').bind(operation.id).first();
    if(following){await env.DB.prepare("UPDATE credit_operations SET status='running',response_json=?,response_status=202,updated_at=? WHERE id=?").bind(JSON.stringify({accepted:true,waitingForFriend:true}),stamp(),operation.id).run();return json({accepted:true,waitingForFriend:true,creditOperationId:operation.id},202)}
    // Zero reserved credits no longer means "cached": included/allowed work is
    // deliberately zero-credit too. Only an operation with no units represents
    // work that became reusable/cached between quote and execution.
    if(operationUnits.length===0){
     if(path.endsWith('/deep-search')){await settle(env.DB,operation,0,{body:{cached:true},status:200});return json({cached:true,creditOperationId:operation.id})}
     const cachedProducer=path.match(/^\/api\/producers\/([^/]+)\/research$/);
     if(cachedProducer){const producer=await reusableProducer(env.DB,member.id,cachedProducer[1]);if(producer){const result={cached:true};await settle(env.DB,operation,0,{body:result,status:200});return json({...result,creditOperationId:operation.id})}}
     if(path==='/api/maturity/vintage'){const window=await readVintageWindow(env.DB,member.id,await request.clone().json() as VintageSubject,true);if(window){await settle(env.DB,operation,0,{body:{cached:true},status:200});return json({cached:true,window,creditOperationId:operation.id})}}
     if(cachedProducer||path==='/api/maturity/vintage'){await settle(env.DB,operation,0);throw new ApiError(409,'Research access changed; request a new quote')}
    }
    const executionEnv={...scoped,CREDIT_CONTEXT:{db:env.DB,operationId:operation.id,namespace:'http'},CREDIT_PRODUCER_IDS:operationUnits.flatMap(u=>(u.action==='producer_research'||u.action==='producer_profile')&&u.targetId?[u.targetId]:[]),CREDIT_RESEARCH_SCOPES:operationUnits.flatMap(u=>u.scope?[u.scope]:[]),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB,operation.id)};
    try{
     const started=await env.DB.prepare("UPDATE credit_operations SET status='running',updated_at=? WHERE id=? AND status='reserved'").bind(stamp(),operation.id).run();
     if(!started.meta.changes)throw new ApiError(409,'Reservation is no longer available');
     // Build the internal request only after quote validation, fingerprinting,
     // unit planning and allowance reservation have finished reading clones of
     // the public request body. In Cloudflare Workers, constructing Request from
     // the original first can lock its ReadableStream and make those later
     // request.clone() calls throw.
     const forwarded=await internalRequest(request,env,member.id);
     const response=await legacy.fetch(forwarded,executionEnv,ctx),data=await saveOperationResponse(env.DB,operation,response);
     ctx.waitUntil(flushOutbox(env.DB,env.RESEARCH_QUEUE));
     return json(publicAiResponse(path,data,operation),response.status);
    }catch(error){await markUncertain(env.DB,operation.id);throw error}
   }
   const forwarded=await internalRequest(request,env,member.id);
   if(request.method==='GET'&&champagneExtractionRoute(path)){
    const op=await env.DB.prepare("SELECT * FROM credit_operations WHERE user_id=? AND path=? AND status IN ('reserved','running','review') LIMIT 1").bind(member.id,path).first<CreditOperation>();
    if(op)await reconcileOperation(env.DB,op);
   }
   const response=await legacy.fetch(forwarded,scoped,ctx);
   if(response.ok&&request.method==='GET'&&/^\/api\/wines\/[^/]+\/deep-search-status$/.test(path)){
    const run=await response.json() as {status:string;requestId:string};
    // Read the live hold rather than inferring it from an old error message.
    // A resolved operation must become retryable on the next status check.
    const held=run.status==='failed'?await env.DB.prepare(`SELECT id FROM credit_operations
     WHERE user_id=? AND run_id=? AND status IN ('reserved','running','review') LIMIT 1`).bind(member.id,run.requestId).first():null;
    return json({...run,retryBlocked:Boolean(held)});
   }
   const producerMatch=path.match(/^\/api\/producers\/([^/]+)$/);
   if(response.ok&&request.method==='GET'&&producerMatch){const shared=await reusableProducer(env.DB,member.id,producerMatch[1]);if(shared)return json({...await response.json() as object,...shared})}
   if(response.ok&&request.method==='GET'&&path==='/api/maturity/vintage'){
    const params=Object.fromEntries(new URL(request.url).searchParams),subject={...params,vintage:Number(params.vintage)};
    const window=await readVintageWindow(env.DB,member.id,subject,true);return json({window});
   }
   const wineMatch=path.match(/^\/api\/wines\/([^/]+)$/);
   if(response.ok&&request.method==='GET'&&wineMatch){
    // Only the columns that build a cache key. SELECT * pulled deep_search_json
    // - a multi-kilobyte snapshot - on every wine view, to read nine fields.
    const row=await env.DB.prepare(`SELECT producer,producer_id,cuvee_id,wine_name,vintage,country,region,appellation,wine_style,${RESEARCH_EDITION_COLUMNS} FROM wines w WHERE w.owner_id=? AND w.id=?`).bind(member.id,wineMatch[1]).first<Record<string,unknown>>();
    if(row){const data=await response.json() as Record<string,unknown>,targets=wineTargets(row),cache=await loadWineResearchCache(env.DB,member.id,targets,true,data.deepSearch);
     // Showing a friend's research is what makes it the reader's own, so the
     // next view is an indexed lookup and unfriending cannot take it back.
     ctx.waitUntil(adoptFriendResearch(env.DB,member.id,cache));
     return json({...data,deepSearch:cache.size?assembleDeepSearch(cache,targets):null})}
   }
   // A Champagne status read may safely revive polling of an existing native
   // batch. Dispatch that outbox message too, without reserving another action.
   if(request.method!=='GET'||champagneExtractionRoute(path))ctx.waitUntil(flushOutbox(env.DB,env.RESEARCH_QUEUE));
   return revalidated(response);
  }catch(error){
   if(error instanceof ApiError)return json({error:error.message},error.status);
   console.error(JSON.stringify({event:'multi_user_request_failed',path,error:error instanceof Error?error.message:String(error)}));return json({error:'Request could not be completed'},500);
  }
 },
 async queue(batch:Batch,env:MultiUserEnv){
  for(const message of batch.messages){
   const raw=message.body as (typeof message.body&JobEnvelope)|RolloutQueueJob,id=('_outboxId' in raw&&raw._outboxId)||message.id;
   if(!await claimDelivery(env.DB,id,raw.kind==='admin_rollout'&&raw.rollout==='lwin_ai'?LWIN_AI_LEASE_SECONDS:undefined)){const done=await env.DB.prepare('SELECT done FROM queue_deliveries WHERE id=?').bind(id).first<{done:number}>();if(done?.done)message.ack();else message.retry({delaySeconds:60});continue}
   let retried=false;
   try{
    const cleanup=isQueueCleanup(raw as JobEnvelope);
    // Disabling an account prevents AI work, but must not strand its temporary photos.
    const member=await env.DB.prepare("SELECT id,role FROM app_users WHERE id=? AND (status='active' OR ?=1)").bind(raw.owner||'',cleanup?1:0).first<{id:string;role:string}>();
    if(!member){message.retry({delaySeconds:300});retried=true;continue}
    if(raw.kind==='admin_rollout'){
     if(member.role!=='owner'){message.ack();continue}
     const rolloutEnv={...env,CREDIT_CONTEXT:providerAuthorization('owner',`Admin ${raw.rollout} rollout`)};
     const result=await processRolloutJob(rolloutEnv,raw.rollout,raw);
     if(result.busy||('retryAfterSeconds' in result&&result.retryAfterSeconds)){retried=true;message.retry({delaySeconds:'retryAfterSeconds' in result?result.retryAfterSeconds:60})}else message.ack();continue;
    }
    const job=raw as typeof message.body&JobEnvelope;
    const op=job._creditOperationId?await env.DB.prepare('SELECT * FROM credit_operations WHERE id=? AND user_id=?').bind(job._creditOperationId,job.owner!).first<CreditOperation>():null;
    if(!cleanup&&(!op||!['reserved','running','review'].includes(op.status))){message.ack();continue}
    const scoped={...env,CREDIT_CONTEXT:cleanup?{deny:true as const,reason:'Cleanup jobs cannot invoke AI providers.'}:op?{db:env.DB,operationId:op.id,namespace:'queue'}:providerAuthorization(member.role,`${job.kind??'This job'} reached the provider without a credit operation.`),CREDIT_RESEARCH_SCOPES:op?JSON.parse(op.units_json).flatMap((u:{scope?:string})=>u.scope?[u.scope]:[]):[],WINE_IMAGES:meteredBucket(env.WINE_IMAGES,env.DB,job.owner!,{skipMemberLimit:member.role==='owner'}),RESEARCH_QUEUE:durableQueue(env.RESEARCH_QUEUE,env.DB,op?.id)};
    const wrapped={id:message.id,timestamp:message.timestamp,body:message.body,attempts:message.attempts,ack:()=>message.ack(),retry:(options?:QueueRetryOptions)=>{retried=true;message.retry(options)}};
    await legacy.queue({queue:batch.queue,metadata:batch.metadata,messages:[wrapped],ackAll:()=>message.ack(),retryAll:(options?:QueueRetryOptions)=>{retried=true;message.retry(options)}},scoped);
    if(op)await reconcileOperation(env.DB,op);
   }catch(error){retried=true;message.retry();console.error(JSON.stringify({event:'multi_user_queue_failed',id,error:String(error)}))}
   finally{await finishDelivery(env.DB,id,retried)}
  }
  await flushOutbox(env.DB,env.RESEARCH_QUEUE);
 },
 async scheduled(_event:ScheduledController,env:MultiUserEnv){await maintainJobs(env.DB,env.RESEARCH_QUEUE,env.WINE_IMAGES);await recoverRollouts(env);await env.DB.prepare("INSERT INTO rollout_state(name,value) VALUES('last_maintenance',?) ON CONFLICT(name) DO UPDATE SET value=excluded.value").bind(stamp()).run()}
};
