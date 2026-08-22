import app from './researchQueueEntry';
import { requireSession } from '../src/lib/auth/session';
import { hasTastingStructure,tastingStructureSchema,type TastingStructure } from '../src/lib/wine/tastingStructure';
import { groupSourcePhotosForWine,handleGroupRecognitionSessionRequest } from './groupRecognitionSessions';

type Bindings=Parameters<typeof app.fetch>[1];
type QueueBatch=Parameters<typeof app.queue>[0];

type StructurePayload={present:boolean;structure:TastingStructure|null;error?:string};

async function owner(request:Request,env:Bindings){return (await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}
function jsonResponse(body:unknown,status=200,headers?:Headers){const out=new Headers(headers);out.delete('Content-Length');out.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(body),{status,headers:out})}

async function extractStructure(request:Request):Promise<StructurePayload>{
  try{
    const type=request.headers.get('Content-Type')||'';
    let raw:unknown,record:Record<string,unknown>|null=null;
    if(type.includes('multipart/form-data')){
      const form=await request.clone().formData();const wine=form.get('wine');
      if(typeof wine!=='string')return {present:false,structure:null};
      record=JSON.parse(wine) as Record<string,unknown>;
    }else record=await request.clone().json() as Record<string,unknown>;
    if(!record||typeof record!=='object'||!Object.prototype.hasOwnProperty.call(record,'tastingStructure'))return {present:false,structure:null};
    raw=record.tastingStructure;
    if(raw==null)return {present:true,structure:null};
    const parsed=tastingStructureSchema.safeParse(raw);if(!parsed.success)return {present:true,structure:null,error:parsed.error.issues.map(issue=>`${issue.path.join('.')||'structure'}: ${issue.message}`).join('; ')};
    return {present:true,structure:hasTastingStructure(parsed.data)?parsed.data:null};
  }catch{return {present:false,structure:null}}
}

async function persistStructure(db:D1Database,ownerId:string,wineId:string,structure:TastingStructure|null){
  if(!structure||!hasTastingStructure(structure)){await db.prepare('DELETE FROM wine_tasting_structures WHERE owner_id=? AND wine_id=?').bind(ownerId,wineId).run();return}
  const stamp=new Date().toISOString();
  await db.prepare(`INSERT INTO wine_tasting_structures(owner_id,wine_id,structure_json,created_at,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(owner_id,wine_id) DO UPDATE SET structure_json=excluded.structure_json,updated_at=excluded.updated_at`)
    .bind(ownerId,wineId,JSON.stringify(structure),stamp,stamp).run();
}

function exactWineId(pathname:string){const match=pathname.match(/^\/api\/wines\/([^/]+)$/);return match?decodeURIComponent(match[1]):null}

export default {
  async fetch(request:Request,env:Bindings,ctx:ExecutionContext){
    const url=new URL(request.url),wineId=exactWineId(url.pathname);
    const groupSessionResponse=await handleGroupRecognitionSessionRequest(request,env);if(groupSessionResponse)return groupSessionResponse;

    if(request.method==='PUT'&&url.pathname.match(/^\/api\/wines\/[^/]+\/tasting-structure$/)){
      let ownerId:string;try{ownerId=await owner(request,env)}catch{return jsonResponse({error:'Unauthorized'},401)}
      const id=decodeURIComponent(url.pathname.split('/')[3]||'');const body=await request.json().catch(()=>null) as {structure?:unknown}|null;
      const parsed=tastingStructureSchema.nullable().safeParse(body?.structure??null);if(!parsed.success)return jsonResponse({error:'Invalid tasting structure',issues:parsed.error.issues},400);
      const exists=await env.DB.prepare('SELECT id FROM wines WHERE owner_id=? AND id=?').bind(ownerId,id).first<{id:string}>();if(!exists)return jsonResponse({error:'Wine not found'},404);
      await persistStructure(env.DB,ownerId,id,parsed.data&&hasTastingStructure(parsed.data)?parsed.data:null);return jsonResponse({ok:true});
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

    if((request.method==='POST'&&url.pathname==='/api/wines')||(request.method==='PUT'&&wineId)){
      const structure=await extractStructure(request);if(structure.error)return jsonResponse({error:'Invalid tasting structure',details:structure.error},400);
      const response=await app.fetch(request,env,ctx);if(!response.ok||!structure.present)return response;
      let ownerId:string;try{ownerId=await owner(request,env)}catch{return response}
      try{const id=wineId??String((await response.clone().json() as {id?:unknown}).id??'');if(id)await persistStructure(env.DB,ownerId,id,structure.structure)}catch(e){console.error(JSON.stringify({event:'tasting-structure-save-failed',wineId,error:(e as Error).message}))}
      return response;
    }

    if(request.method==='DELETE'&&wineId){
      let ownerId:string|null=null;try{ownerId=await owner(request,env)}catch{}
      const response=await app.fetch(request,env,ctx);if(response.ok&&ownerId)await env.DB.prepare('DELETE FROM wine_tasting_structures WHERE owner_id=? AND wine_id=?').bind(ownerId,wineId).run().catch(()=>undefined);return response;
    }

    return app.fetch(request,env,ctx);
  },
  queue(batch:QueueBatch,env:Bindings){return app.queue(batch,env)}
};
