import {requireSession} from '../src/lib/auth/session';
import {ApiError,boundedBytes} from '../src/lib/credits/primitives';
import {parseSharedProducerId,sharedProducerId} from '../src/lib/producers/sharedRef';
import type {ParcelProducerLink} from '../src/lib/places/parcelProducerLinks';
import manifest from '../src/lib/places/echezeauxParcelManifest.json';
import holders from '../src/lib/places/echezeauxParcelHolderIndex.json';

type Env={DB:D1Database;AUTH_SECRET:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
// Same visibility condition as the producer detail route. Rechecked on every read/write.
const visible=`(p.owner_id=? OR EXISTS (
 SELECT 1 FROM member_visible_wines v JOIN wines w ON w.owner_id=v.source_owner_id AND w.id=v.id
 WHERE v.owner_id=? AND v.is_shared=1 AND w.owner_id=p.owner_id AND w.producer_id=p.id))`;

export async function parcelProducerLinksRoute(request:Request,env:Env):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname!=='/api/parcel-producer-links')return null;
 let owner:string;
 try{owner=(await requireSession(request.headers.get('Authorization')??undefined,env.AUTH_SECRET)).userId}
 catch{return json({error:'Unauthorized'},401)}
 try{
  const parent=url.searchParams.get('parent')??'',snapshot=url.searchParams.get('snapshot')??'';
  if(!manifest.parentFeatureIds.includes(parent)||snapshot!==manifest.rightsAsOf)throw new ApiError(400,'Unsupported parcel rights snapshot');
  if(request.method==='GET'){
   const result=await env.DB.prepare(`SELECT l.holder_id,p.owner_id AS producer_owner_id,p.id AS producer_id,p.canonical_name,l.updated_at
    FROM parcel_producer_links l JOIN producers p ON p.owner_id=l.producer_owner_id AND p.id=l.producer_id
    WHERE l.owner_id=? AND l.parent_feature_id=? AND l.rights_snapshot=? AND ${visible}`)
    .bind(owner,parent,snapshot,owner,owner).all<{holder_id:string;producer_owner_id:string;producer_id:string;canonical_name:string;updated_at:string}>();
   const items:ParcelProducerLink[]=result.results.map(r=>({holderId:r.holder_id,
    producerId:r.producer_owner_id===owner?r.producer_id:sharedProducerId(r.producer_owner_id,r.producer_id),
    producerName:r.canonical_name,updatedAt:r.updated_at,status:'manual'}));
   return json({items});
  }
  if(!['PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
  const bytes=await boundedBytes(request.body,4096);
  let input:Record<string,unknown>;
  try{const value:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();input=value as Record<string,unknown>}
  catch{throw new ApiError(400,'Expected a JSON object')}
  const holder=typeof input.holderId==='string'?input.holderId:'';
  if(!(holders as Record<string,string[]>)[parent]?.includes(holder))throw new ApiError(400,'Right holder is not in this cru snapshot');
  if(request.method==='DELETE'){
   await env.DB.prepare('DELETE FROM parcel_producer_links WHERE owner_id=? AND parent_feature_id=? AND rights_snapshot=? AND holder_id=?')
    .bind(owner,parent,snapshot,holder).run();
   return json({deleted:true});
  }
  // No client-supplied status, operator or date can promote an identity association.
  if(Object.keys(input).some(key=>!['holderId','producerId'].includes(key)))throw new ApiError(400,'Only catalogue identity links can be saved here');
  const reference=typeof input.producerId==='string'?input.producerId:'';
  if(!reference||reference.length>500)throw new ApiError(400,'Choose a producer');
  const shared=parseSharedProducerId(reference),producerOwner=shared?.sourceOwner??owner,producerId=shared?.producerId??reference;
  const producer=await env.DB.prepare(`SELECT p.canonical_name FROM producers p WHERE p.owner_id=? AND p.id=? AND ${visible}`)
   .bind(producerOwner,producerId,owner,owner).first<{canonical_name:string}>();
  if(!producer)throw new ApiError(404,'Producer not found or no longer shared with you');
  const now=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO parcel_producer_links(owner_id,parent_feature_id,rights_snapshot,holder_id,producer_owner_id,producer_id,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,parent_feature_id,rights_snapshot,holder_id)
   DO UPDATE SET producer_owner_id=excluded.producer_owner_id,producer_id=excluded.producer_id,updated_at=excluded.updated_at`)
   .bind(owner,parent,snapshot,holder,producerOwner,producerId,now,now).run();
  return json({holderId:holder,producerId:reference,producerName:producer.canonical_name,updatedAt:now,status:'manual'} satisfies ParcelProducerLink);
 }catch(error){
  if(error instanceof ApiError)return json({error:error.message},error.status);
  console.error('parcel-producer-link-failed');
  return json({error:'Could not save or load producer links. Please retry.'},500);
 }
}
