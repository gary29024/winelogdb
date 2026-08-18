import { authHeaders } from '../../lib/auth/client';
import type { ProducerEntity } from '../../lib/producers/entities';

export type ProducerSummary={id:string;canonicalName:string;homeCountry:string|null;homeRegion:string|null;homeLocality:string|null;tastedCount:number;catalogCount:number;researchedAt:string|null};
export type TastedWine={id:string;wineName:string;vintage:number|null;appellation:string|null;region:string|null;country:string|null;tastingDate:string|null;rating:number|null};
export type ProducerDetail=ProducerEntity&{aliases:string[];tastedWines:TastedWine[]};

async function json<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw new Error(body.error||message);return body}
export const listProducers=()=>fetch('/api/producers',{headers:authHeaders()}).then(r=>json<{items:ProducerSummary[]}>(r,'Could not load producers'));
export const getProducer=(id:string)=>fetch(`/api/producers/${id}`,{headers:authHeaders()}).then(r=>json<ProducerDetail>(r,'Producer not found'));
export const researchProducer=(id:string)=>fetch(`/api/producers/${id}/research`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH'})}).then(r=>json<ProducerEntity>(r,'Producer research failed'));
