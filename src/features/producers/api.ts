import { authHeaders } from '../../lib/auth/client';
import type { ProducerEntity } from '../../lib/producers/entities';
import type { CatalogCuveeSummary,CuveeCatalogLink } from '../../lib/cuvees/catalogLinks';

export type ProducerSummary={id:string;canonicalName:string;homeCountry:string|null;homeRegion:string|null;homeLocality:string|null;tastedCount:number;catalogCount:number;researchedAt:string|null};
export type TastedWine={id:string;wineName:string;vintage:number|null;appellation:string|null;region:string|null;country:string|null;wineStyle:string|null;grapes:string[];imageId:string|null;tastingDate:string|null;rating:number|null;cuveeId:string|null;catalogCuveeId:string|null};
export type LinkedProducer={mergeId:string;producerId:string;name:string;mergedAt:string};
export type ProducerDetail=ProducerEntity&{aliases:string[];tastedWines:TastedWine[];researchHistoryCount:number;linkedProducers:LinkedProducer[];catalogCuvees:CatalogCuveeSummary[];cuveeCatalogLinks:CuveeCatalogLink[]};
export type ProducerResolution={matched:boolean;inputName:string;producer?:{id:string;canonicalName:string;matchedName:string;matchType:'canonical'|'alias'|'normalized';researchedAt:string|null;catalogCount:number;tastedCount:number}};
export type ProducerResearchStage='preparing'|'searching'|'retrying'|'parsing'|'saving'|'image'|'complete'|'failed';
export type ProducerResearchRun={requestId:string;producerId:string;status:'running'|'complete'|'failed';stage:ProducerResearchStage;attempt:number;message:string|null;startedAt:string;updatedAt:string;completedAt:string|null;durationMs:number|null};
export type ResearchCancelResult={ok:true;cancelled:boolean;alreadyTerminal:boolean;requestId:string;trackedBatches?:number;remoteCancellation?:Array<{name:string;ok:boolean;status:number;error?:string}>};

async function json<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw new Error(body.error||message);return body}
export const listProducers=()=>fetch('/api/producers',{headers:authHeaders()}).then(r=>json<{items:ProducerSummary[]}>(r,'Could not load producers'));
export const resolveProducer=(name:string)=>fetch(`/api/producers/resolve?name=${encodeURIComponent(name)}`,{headers:authHeaders()}).then(r=>json<ProducerResolution>(r,'Could not resolve producer'));
export const getProducer=(id:string)=>fetch(`/api/producers/${id}`,{headers:authHeaders()}).then(r=>json<ProducerDetail>(r,'Producer not found'));
export const setPrimaryProducerName=(id:string,name:string)=>fetch(`/api/producers/${id}/primary-name`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({name})}).then(r=>json<{id:string;canonicalName:string}>(r,'Could not change primary name'));
export const getProducerResearchStatus=(id:string,requestId?:string)=>{
  const suffix=requestId?`?requestId=${encodeURIComponent(requestId)}`:'';
  return fetch(`/api/producers/${id}/research-status${suffix}`,{headers:authHeaders()}).then(async r=>r.status===404?null:json<ProducerResearchRun>(r,'Could not load producer research status'));
};
export const researchProducer=(id:string,requestId=crypto.randomUUID())=>fetch(`/api/producers/${id}/research`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH',requestId})}).then(r=>json<{accepted:true;researchRequestId:string;existing:boolean}>(r,'Producer research could not be queued'));
export const cancelProducerResearch=(id:string,requestId:string)=>fetch(`/api/producers/${id}/research-cancel`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'CANCEL_PRODUCER_RESEARCH',requestId})}).then(r=>json<ResearchCancelResult>(r,'Could not cancel producer research'));
export const mergeProducer=(destinationId:string,sourceProducerId:string)=>fetch(`/api/producers/${destinationId}/merge`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'MERGE_PRODUCER',sourceProducerId})}).then(r=>json<{mergeId:string;destinationId:string;canonicalName:string;mergedName:string}>(r,'Could not link producer'));
export const unlinkProducer=(destinationId:string,mergeId:string)=>fetch(`/api/producers/${destinationId}/unlink`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNLINK_PRODUCER',mergeId})}).then(r=>json<{destinationId:string;restoredProducerId:string;canonicalName:string;unlinkedName:string}>(r,'Could not unlink producer'));
export const linkTastedCuveeToCatalog=(producerId:string,sourceCuveeId:string,catalogCuveeId:string)=>fetch(`/api/producers/${producerId}/cuvee-links`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'LINK_CUVEE_TO_CATALOG',sourceCuveeId,catalogCuveeId})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;existing:boolean}>(r,'Could not link tasted cuvée to catalog'));
export const changeTastedCuveeCatalogLink=(producerId:string,linkId:string,catalogCuveeId:string)=>fetch(`/api/producers/${producerId}/cuvee-links/${linkId}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({confirmation:'CHANGE_CUVEE_CATALOG_LINK',catalogCuveeId})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;changed:boolean}>(r,'Could not change catalog link'));
export const unlinkTastedCuveeFromCatalog=(producerId:string,linkId:string)=>fetch(`/api/producers/${producerId}/cuvee-links/${linkId}/unlink`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNLINK_CUVEE_FROM_CATALOG'})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;unlinked:boolean}>(r,'Could not unlink tasted cuvée from catalog'));
