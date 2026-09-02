import type { WineInput, WineRecord } from '../../lib/db/schema';
import type { TastingStructure } from '../../lib/wine/tastingStructure';
import type { PhotoMetadata } from '../uploads/photoMetadata';
import { authHeaders,clearSession } from '../../lib/auth/client';
// Every write below ends by saying so: the Passport, Insights and the
// collections each cache their summary, and none of them can tell on its own
// that what it summarises has changed.
import { summariesChanged } from '../../lib/cache/summaryCaches';

export type WinePhoto={file:File;metadata?:PhotoMetadata;width:number;height:number};
export type JournalWine={
  id:string;
  producer:string;
  wineName:string;
  vintage:number|null;
  country:string|null;
  region:string|null;
  appellation:string|null;
  grapes:string[];
  wineStyle:string|null;
  tastingName:string|null;
  venue:string|null;
  favorite:boolean;
  rating:number|null;
  tastingDate:string|null;
  imageIds:string[];
  createdAt:string;
};
export type GroupSourcePhoto={sessionId:string;createdAt:string;capturedAt:string|null};
export type WineDetail=WineRecord&{favorite:boolean;producerId:string|null;tastingStructure:TastingStructure|null;groupSourcePhotos:GroupSourcePhoto[]};
export type WineResearchStage='queued'|'researching'|'saving'|'complete'|'failed';
export type WineResearchRun={requestId:string;wineId:string;status:'running'|'complete'|'failed';stage:WineResearchStage;refresh:'none'|'vintage'|'all';attempt:number;message:string|null;startedAt:string;updatedAt:string;completedAt:string|null;durationMs:number|null};
export type JournalBatchPatch={tastingName?:string|null;venue?:string|null};
/**
 * holdingId names the cellar line this bottle came out of. It rides as a query
 * parameter rather than in the body because the create route takes JSON and
 * multipart alike, and the bottle is only taken once the wine is saved.
 */
export type SaveWineOptions={preferCuveePrimaryName?:boolean;holdingId?:string|null};
export type WineResearchCancelResult={ok:true;cancelled:boolean;alreadyTerminal:boolean;requestId:string;trackedBatches?:number;remoteCancellation?:Array<{name:string;ok:boolean;status:number;error?:string}>};

type ApiIssue={path?:Array<string|number>;message?:string};
async function requireOk(r:Response,message:string){
  if(r.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!r.ok){const body=await r.json().catch(()=>({})) as {error?:string;issues?:ApiIssue[];details?:string};const details=body.issues?.map(issue=>`${issue.path?.join('.')||'field'}: ${issue.message||'Invalid input'}`).join('; ');throw new Error([body.error||message,details||body.details].filter(Boolean).join(' — '))}
}
export async function listWines(params:URLSearchParams,options:{limit?:number;offset?:number;signal?:AbortSignal}={}):Promise<{items:JournalWine[];nextOffset:number|null;total:number}>{
  const query=new URLSearchParams(params);query.set('limit',String(options.limit??36));query.set('offset',String(options.offset??0));const r=await fetch(`/api/journal?${query}`,{headers:authHeaders(),signal:options.signal});await requireOk(r,'Could not load wines');return r.json();
}
export async function batchUpdateJournalExperience(ids:string[],patch:JournalBatchPatch){const r=await fetch('/api/journal/batch-experience',{method:'POST',headers:authHeaders(true),body:JSON.stringify({ids,...patch})});await requireOk(r,'Could not update selected wines');summariesChanged();return r.json() as Promise<{updated:number;tastingName?:string|null;venue?:string|null}>}
export async function getWine(id:string):Promise<WineDetail>{const r=await fetch(`/api/wines/${id}`,{headers:authHeaders()});await requireOk(r,'Wine not found');const wine=await r.json() as WineDetail;return {...wine,groupSourcePhotos:wine.groupSourcePhotos??[]}}
export async function saveWineTastingStructure(id:string,structure:TastingStructure|null){const r=await fetch(`/api/wines/${id}/tasting-structure`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({structure})});await requireOk(r,'Could not save tasting structure');summariesChanged();return r.json() as Promise<{ok:true}>}
export async function setWineFavorite(id:string,favorite:boolean){const r=await fetch(`/api/wines/${id}/favorite`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({favorite})});await requireOk(r,'Could not update favorite');summariesChanged();return r.json() as Promise<{id:string;favorite:boolean}>}
/**
 * Photographs for a wine that already exists.
 *
 * Same shape the create path sends - the original file, its dimensions and its
 * capture metadata - because the server stores the original and reads the EXIF
 * off it. A wine logged off a printed list can be given its bottle later.
 */
export async function addWineImages(id:string,photos:WinePhoto[]){
  const fd=new FormData();
  photos.forEach(photo=>fd.append('images',photo.file));
  fd.append('dimensions',JSON.stringify(photos.map(photo=>({width:photo.width,height:photo.height}))));
  fd.append('metadata',JSON.stringify(photos.map(photo=>photo.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));
  const r=await fetch(`/api/wines/${id}/images`,{method:'POST',headers:authHeaders(),body:fd});
  await requireOk(r,'Could not add the photos');
  summariesChanged();
  return r.json() as Promise<{imageIds:string[]}>;
}

export async function deleteWineImage(wineId:string,imageId:string){
  const r=await fetch(`/api/wines/${wineId}/images/${imageId}`,{method:'DELETE',headers:authHeaders()});
  await requireOk(r,'Could not remove that photo');
  summariesChanged();
  return r.json() as Promise<{ok:true}>;
}

export async function saveWine(input:WineInput,id?:string,photos:WinePhoto[]=[],options:SaveWineOptions={}):Promise<{id:string}|{ok:true}>{
  if(id){const body=options.preferCuveePrimaryName?{...input,preferCuveePrimaryName:true}:input;const r=await fetch(`/api/wines/${id}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(body)});await requireOk(r,'Could not save wine');summariesChanged();return r.json() as Promise<{ok:true}>}
  const create=options.holdingId?`/api/wines?holding=${encodeURIComponent(options.holdingId)}`:'/api/wines';
  if(photos.length){const fd=new FormData();fd.append('wine',JSON.stringify(input));photos.forEach(x=>fd.append('images',x.file));fd.append('dimensions',JSON.stringify(photos.map(x=>({width:x.width,height:x.height}))));fd.append('metadata',JSON.stringify(photos.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));const r=await fetch(create,{method:'POST',headers:authHeaders(),body:fd});await requireOk(r,'Could not save wine and photos');summariesChanged();return r.json() as Promise<{id:string}>}
  const r=await fetch(create,{method:'POST',headers:authHeaders(true),body:JSON.stringify(input)});await requireOk(r,'Could not save wine');summariesChanged();return r.json() as Promise<{id:string}>;
}
export async function deleteWine(id:string){const r=await fetch(`/api/wines/${id}`,{method:'DELETE',headers:authHeaders()});await requireOk(r,'Could not delete wine');summariesChanged()}
export async function startWineDeepSearch(id:string,refresh:'none'|'vintage'|'all',requestId=crypto.randomUUID()){const r=await fetch(`/api/wines/${id}/deep-search`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh,requestId})});await requireOk(r,'Could not queue Deep Search');return r.json() as Promise<{accepted:true;researchRequestId:string;existing:boolean}>}
export async function getWineDeepSearchStatus(id:string,requestId?:string){const suffix=requestId?`?requestId=${encodeURIComponent(requestId)}`:'';const r=await fetch(`/api/wines/${id}/deep-search-status${suffix}`,{headers:authHeaders()});if(r.status===404)return null;await requireOk(r,'Could not load Deep Search status');return r.json() as Promise<WineResearchRun>}
export async function cancelWineDeepSearch(id:string,requestId:string){const r=await fetch(`/api/wines/${id}/deep-search-cancel`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'CANCEL_DEEP_SEARCH',requestId})});await requireOk(r,'Could not cancel Deep Search');return r.json() as Promise<WineResearchCancelResult>}
