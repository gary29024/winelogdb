import { authHeaders } from '../../lib/auth/client';
import type { ProducerEntity } from '../../lib/producers/entities';

export type ProducerSummary={id:string;canonicalName:string;homeCountry:string|null;homeRegion:string|null;homeLocality:string|null;tastedCount:number;catalogCount:number;researchedAt:string|null};
export type TastedWine={id:string;wineName:string;vintage:number|null;appellation:string|null;region:string|null;country:string|null;tastingDate:string|null;rating:number|null};
export type LinkedProducer={mergeId:string;producerId:string;name:string;mergedAt:string};
export type ProducerDetail=ProducerEntity&{aliases:string[];tastedWines:TastedWine[];researchHistoryCount:number;linkedProducers:LinkedProducer[]};
export type ProducerResolution={matched:boolean;inputName:string;producer?:{id:string;canonicalName:string;matchedName:string;matchType:'canonical'|'alias'|'normalized';researchedAt:string|null;catalogCount:number;tastedCount:number}};

async function json<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw new Error(body.error||message);return body}
export const listProducers=()=>fetch('/api/producers',{headers:authHeaders()}).then(r=>json<{items:ProducerSummary[]}>(r,'Could not load producers'));
export const resolveProducer=(name:string)=>fetch(`/api/producers/resolve?name=${encodeURIComponent(name)}`,{headers:authHeaders()}).then(r=>json<ProducerResolution>(r,'Could not resolve producer'));
export const getProducer=(id:string)=>fetch(`/api/producers/${id}`,{headers:authHeaders()}).then(r=>json<ProducerDetail>(r,'Producer not found'));
export const setPrimaryProducerName=(id:string,name:string)=>fetch(`/api/producers/${id}/primary-name`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({name})}).then(r=>json<{id:string;canonicalName:string}>(r,'Could not change primary name'));
export const researchProducer=(id:string)=>fetch(`/api/producers/${id}/research`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH'})}).then(r=>json<ProducerEntity>(r,'Producer research failed'));
export const mergeProducer=(destinationId:string,sourceProducerId:string)=>fetch(`/api/producers/${destinationId}/merge`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'MERGE_PRODUCER',sourceProducerId})}).then(r=>json<{mergeId:string;destinationId:string;canonicalName:string;mergedName:string}>(r,'Could not link producer'));
export const unlinkProducer=(destinationId:string,mergeId:string)=>fetch(`/api/producers/${destinationId}/unlink`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNLINK_PRODUCER',mergeId})}).then(r=>json<{destinationId:string;restoredProducerId:string;canonicalName:string;unlinkedName:string}>(r,'Could not unlink producer'));
