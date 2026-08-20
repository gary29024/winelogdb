import { authHeaders,clearSession } from '../../lib/auth/client';
import type { JourneySummary,StructureSample } from './model';

export type CountryStat={country:string;wines:number;producers:number;appellations:number;averageRating:number|null};
export type RegionStat={country:string|null;region:string;wines:number;producers:number;appellations:number;averageRating:number|null};
export type AppellationStat={country:string|null;region:string|null;appellation:string;wines:number;averageRating:number|null};
export type StyleStat={style:string;wines:number;ratedWines:number;averageRating:number|null};
export type ProducerInsight={producer:string;wines:number;ratedWines:number;averageRating:number|null;favorites:number};
export type CurrencyInsight={currency:string;wines:number;averagePrice:number|null;averageRating:number|null};
export type YearInsight={year:string;wines:number;ratedWines:number;averageRating:number|null};
export type JourneyData={
  summary:JourneySummary;
  countries:CountryStat[];
  regions:RegionStat[];
  appellations:AppellationStat[];
  styles:StyleStat[];
  producers:ProducerInsight[];
  currencies:CurrencyInsight[];
  years:YearInsight[];
  structures:StructureSample[];
};

let cached:{expires:number;data:JourneyData}|null=null;
let pending:Promise<JourneyData>|null=null;

export function getJourneyData():Promise<JourneyData>{
  if(cached&&cached.expires>Date.now())return Promise.resolve(cached.data);
  if(pending)return pending;
  pending=(async()=>{
    const response=await fetch('/api/journey',{headers:authHeaders()});
    if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
    if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error||'Could not load Wine Journey')}
    const data=await response.json() as JourneyData;
    cached={data,expires:Date.now()+30_000};
    return data;
  })().finally(()=>{pending=null});
  return pending;
}
