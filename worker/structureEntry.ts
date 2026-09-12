import app from './researchQueueEntry';
import { tastingStructureStatement } from '../src/lib/db/wineSave';
import { requireSession } from '../src/lib/auth/session';
import { configureGeminiBatchGateway } from '../src/lib/research/geminiBatch';
import { hasTastingStructure,tastingStructureSchema,type TastingStructure } from '../src/lib/wine/tastingStructure';
import { groupSourcePhotosForWine,handleGroupRecognitionSessionRequest } from './groupRecognitionSessions';
import { resolveGeminiTransport,type GeminiTransportBindings } from './geminiTransport';
import { processVertexBatchPollJob,processVertexBatchSubmitJob } from './vertexBatchRecognition';
import { semanticWineIds,shouldUseSemanticQuery,warmSemanticWineIndex,type SemanticEmbeddingBindings } from '../src/lib/journal/semanticSearch';
import { tryDirectProducerRangeRefresh,type ProducerRangeAiBindings } from '../src/lib/producers/catalogDirectResearch';
import { addManualCatalogEntry,addMissingCandidate,captureGroundedCatalogAndOverlay,deleteManualCatalogEntry,ignoreMissingCandidate,listCatalogRangeCorrections } from '../src/lib/producers/catalogRangeOverlay';

type Bindings=Parameters<typeof app.fetch>[1]&GeminiTransportBindings&SemanticEmbeddingBindings&ProducerRangeAiBindings;
type QueueBatch=Parameters<typeof app.queue>[0];
type QueueJob={kind?:string;owner?:string;sessionId?:string;jobId?:string;pollCount?:number;producerId?:string;requestId?:string;refreshProfile?:boolean};

async function owner(request:Request,env:Bindings){return (await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}
function jsonResponse(body:unknown,status=200,headers?:Headers){const out=new Headers(headers);out.delete('Content-Length');out.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(body),{status,headers:out})}
function configureBatchGateway(env:Bindings){return configureGeminiBatchGateway(env.GEMINI_API_KEY,env)}

async function failBatchGatewayConfig(env:Bindings,job:QueueJob,error:string){
  const ownerId=String(job.owner||''),sessionId=String(job.sessionId||'');if(!ownerId||!sessionId)return;
  const stamp=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE batch_recognition_sessions SET status='failed',updated_at=? WHERE id=? AND owner_id=?").bind(stamp,sessionId,ownerId),
    env.DB.prepare("UPDATE batch_recognition_items SET status='failed',error=?,updated_at=? WHERE session_id=? AND owner_id=? AND status='submitted'").bind(error,stamp,sessionId,ownerId)
  ]).catch(e=>console.error(JSON.stringify({event:'vertex-batch-config-fail-save',sessionId,error:(e as Error).message})));
}

function exactWineId(pathname:string){const match=pathname.match(/^\/api\/wines\/([^/]+)$/);return match?decodeURIComponent(match[1]):null}
const pathId=(match:RegExpMatchArray,index:number)=>decodeURIComponent(match[index]||'');
const correctionStatus=(message:string)=>/not found/i.test(message)?404:400;

export default {
  async fetch(request:Request,env:Bindings,ctx:ExecutionContext){
    configureBatchGateway(env);
    const url=new URL(request.url),wineId=exactWineId(url.pathname);
    const groupSessionResponse=await handleGroupRecognitionSessionRequest(request,env);if(groupSessionResponse)return groupSessionResponse;

    // Range corrections live above the legacy producer route so they can evolve
    // independently without making the already-large layered router larger.
    const correctionList=url.pathname.match(/^\/api\/producers\/([^/]+)\/catalog-range-corrections$/);
    if(request.method==='GET'&&correctionList){let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}try{return jsonResponse(await listCatalogRangeCorrections(env.DB,ownerId,pathId(correctionList,1)))}catch(e){const message=(e as Error).message||'Could not load range corrections';return jsonResponse({error:message},correctionStatus(message))}}
    const manualCreate=url.pathname.match(/^\/api\/producers\/([^/]+)\/catalog-manual$/);
    if(request.method==='POST'&&manualCreate){let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}const body=await request.json().catch(()=>({})) as Record<string,unknown>;if(body.confirmation!=='ADD_MISSING_CATALOG_WINE')return jsonResponse({error:'Adding a missing wine requires explicit confirmation'},400);try{return jsonResponse(await addManualCatalogEntry(env.DB,ownerId,pathId(manualCreate,1),body),201)}catch(e){const message=(e as Error).message||'Could not add the missing wine';return jsonResponse({error:message},correctionStatus(message))}}
    const manualDelete=url.pathname.match(/^\/api\/producers\/([^/]+)\/catalog-manual\/([^/]+)$/);
    if(request.method==='DELETE'&&manualDelete){let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}const body=await request.json().catch(()=>({})) as {confirmation?:string};if(body.confirmation!=='REMOVE_MANUAL_CATALOG_WINE')return jsonResponse({error:'Removing a manual wine requires explicit confirmation'},400);try{return jsonResponse(await deleteManualCatalogEntry(env.DB,ownerId,pathId(manualDelete,1),pathId(manualDelete,2)))}catch(e){const message=(e as Error).message||'Could not remove the manual wine';return jsonResponse({error:message},correctionStatus(message))}}
    const missingAction=url.pathname.match(/^\/api\/producers\/([^/]+)\/catalog-missing\/([^/]+)\/(add|ignore)$/);
    if(request.method==='POST'&&missingAction){let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}const body=await request.json().catch(()=>({})) as {confirmation?:string},action=missingAction[3];const expected=action==='add'?'ADD_MISSING_CATALOG_WINE':'IGNORE_CATALOG_CANDIDATE';if(body.confirmation!==expected)return jsonResponse({error:'This range correction requires explicit confirmation'},400);try{return jsonResponse(action==='add'?await addMissingCandidate(env.DB,ownerId,pathId(missingAction,1),pathId(missingAction,2)):await ignoreMissingCandidate(env.DB,ownerId,pathId(missingAction,1),pathId(missingAction,2)))}catch(e){const message=(e as Error).message||'Could not update the missing-wine suggestion';return jsonResponse({error:message},correctionStatus(message))}}

    // Semantic retrieval is an input to the real Journal route, never a second
    // implementation of that route. Candidate IDs are internal-only: strip any
    // caller-supplied value first, then set it only on the forwarded request we
    // create after ranking. The canonical route still owns CORS, auth,
    // maintenance, filtering and pagination.
    if(request.method==='GET'&&url.pathname==='/api/journal'){
      url.searchParams.delete('__semanticIds');
      const journalRequest=new Request(url,request);
      const rawQuery=(url.searchParams.get('query')??'').trim(),semanticFlag=url.searchParams.get('semantic');
      const useSemantic=rawQuery&&semanticFlag!=='0'&&(semanticFlag==='1'||shouldUseSemanticQuery(rawQuery));
      if(useSemantic){
        let ownerId:string;try{ownerId=await owner(journalRequest,env)}catch{return jsonResponse({error:'Unauthorized'},401)}
        ctx.waitUntil(warmSemanticWineIndex(env,ownerId).catch(error=>console.error(JSON.stringify({event:'semantic-index-warm-failed',error:(error as Error).message}))));
        try{
          const semantic=await semanticWineIds(env,ownerId,rawQuery,72);
          if(semantic?.ids.length){
            const forwardedUrl=new URL(journalRequest.url);
            forwardedUrl.searchParams.set('__semanticIds',semantic.ids.join(','));
            return app.fetch(new Request(forwardedUrl,journalRequest),env,ctx);
          }
        }catch(error){console.error(JSON.stringify({event:'semantic-journal-search-failed',error:(error as Error).message}))}
      }
      return app.fetch(journalRequest,env,ctx);
    }

    if(request.method==='PUT'&&url.pathname.match(/^\/api\/wines\/[^/]+\/tasting-structure$/)){
      let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}
      const id=decodeURIComponent(url.pathname.split('/')[3]||'');const body=await request.json().catch(()=>null) as {structure?:unknown}|null;
      const parsed=tastingStructureSchema.nullable().safeParse(body?.structure??null);if(!parsed.success)return jsonResponse({error:'Invalid tasting structure',issues:parsed.error.issues},400);
      const exists=await env.DB.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(ownerId,id).first<{id:string}>();if(!exists)return jsonResponse({error:'Wine not found'},404);
      try{await tastingStructureStatement(env.DB,ownerId,id,parsed.data).run();return jsonResponse({ok:true})}
      catch(error){console.error('tasting-structure-save-failed',error);return jsonResponse({error:'Could not save tasting structure. Please retry.'},500)}
    }

    if(request.method==='GET'&&wineId){
      const response=await app.fetch(request,env,ctx);if(!response.ok)return response;
      let ownerId:string;try{ownerId=await owner(request,env)}catch{return response}
      try{
        const [body,row,groupSourcePhotos]=await Promise.all([response.clone().json() as Promise<Record<string,unknown>>,env.DB.prepare('SELECT structure_json FROM wine_tasting_structures WHERE owner_id=? AND wine_id=?').bind(ownerId,wineId).first<{structure_json:string}>(),groupSourcePhotosForWine(env.DB,ownerId,wineId)]);
        let structure:TastingStructure|null=null;if(row?.structure_json){const parsed=tastingStructureSchema.safeParse(JSON.parse(row.structure_json));if(parsed.success&&hasTastingStructure(parsed.data))structure=parsed.data}
        return jsonResponse({...body,tastingStructure:structure,groupSourcePhotos},response.status,new Headers(response.headers));
      }catch{return response}
    }

    if(request.method==='DELETE'&&wineId){
      let ownerId:string|null=null;try{ownerId=await owner(request,env)}catch{}
      const response=await app.fetch(request,env,ctx);if(response.ok&&ownerId)await env.DB.prepare('DELETE FROM wine_tasting_structures WHERE owner_id=? AND wine_id=?').bind(ownerId,wineId).run().catch(()=>undefined);return response;
    }

    return app.fetch(request,env,ctx);
  },
  async queue(batch:QueueBatch,env:Bindings){
    configureBatchGateway(env);
    if(batch.messages.length!==1)return app.queue(batch,env);
    const message=batch.messages[0],job=message.body as QueueJob;

    // Phase 2 is deliberately an intercept, not a replacement. Only range-only
    // refreshes with a fresh profile can finish here. Any weak evidence, model
    // error or missing official site falls through to the existing grounded
    // Gemini path with exactly the same retry/slice behaviour as before.
    if(job.kind==='producer'){
      const ownerId=String(job.owner||''),producerId=String(job.producerId||''),requestId=String(job.requestId||'');
      if(ownerId&&producerId&&requestId){try{const direct=await tryDirectProducerRangeRefresh(env,ownerId,producerId,requestId,job.refreshProfile===true);if(direct.handled){message.ack();return}}catch(e){console.warn(JSON.stringify({event:'producer_range_phase2',stage:'intercept_failed',producerId,requestId,error:(e as Error).message}))}}
      return app.queue(batch,env);
    }
    if(job.kind==='producer_batch_poll'){
      await app.queue(batch,env);
      const ownerId=String(job.owner||''),producerId=String(job.producerId||''),requestId=String(job.requestId||'');
      if(ownerId&&producerId&&requestId)await captureGroundedCatalogAndOverlay(env.DB,ownerId,producerId,requestId).catch(e=>console.error(JSON.stringify({event:'producer_catalog_overlay_failed',producerId,requestId,error:(e as Error).message})));
      return;
    }

    if(job.kind!=='recognition_batch_submit'&&job.kind!=='recognition_batch_poll')return app.queue(batch,env);
    let provider;
    try{provider=resolveGeminiTransport(env)}catch(e){const error=(e as Error).message||'AI Gateway configuration is invalid';await failBatchGatewayConfig(env,job,error);console.error(JSON.stringify({event:'vertex-batch-config-error',kind:job.kind,sessionId:job.sessionId,error}));message.ack();return}
    if(provider!=='vertex-ai-gateway')return app.queue(batch,env);
    try{
      const ownerId=String(job.owner||''),sessionId=String(job.sessionId||'');if(!ownerId||!sessionId)throw new Error('Batch recognition queue job is missing owner or session');
      if(job.kind==='recognition_batch_submit')await processVertexBatchSubmitJob(env,ownerId,sessionId);
      else{
        const jobId=String(job.jobId||'');if(!jobId)throw new Error('Batch recognition poll is missing job ID');
        const handled=await processVertexBatchPollJob(env,ownerId,sessionId,jobId,Math.max(0,Number(job.pollCount)||0));
        if(!handled)return app.queue(batch,env);
      }
      message.ack();
    }catch(e){console.error(JSON.stringify({event:'vertex-batch-queue-error',kind:job.kind,sessionId:job.sessionId,error:(e as Error).message||String(e)}));message.retry()}
  }
};
