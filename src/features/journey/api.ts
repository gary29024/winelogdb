import { authHeaders,clearSession } from '../../lib/auth/client';
import type { JourneySummary,StructureSample } from './model';

export type CountryStat={country:string;wines:number;producers:number;appellations:number;averageRating:number|null};
export type RegionStat={country:string|null;region:string;wines:number;producers:number;appellations:number;averageRating:number|null;favorites:number};
export type AppellationStat={country:string|null;region:string|null;appellation:string;wines:number;averageRating:number|null};
export type StyleStat={style:string;wines:number;ratedWines:number;averageRating:number|null;favorites:number};
export type ProducerInsight={producer:string;wines:number;ratedWines:number;averageRating:number|null;favorites:number;lastTasted:string|null};
export type CurrencyInsight={currency:string;wines:number;averagePrice:number|null;averageRating:number|null};
export type YearInsight={year:string;wines:number;ratedWines:number;averageRating:number|null};
export type GrapeStat={grape:string;wines:number;favorites:number};
/** How many of the most recent tastings were a first from that producer, region or country. */
export type DiscoveryStat={tastings:number;newProducers:number;newRegions:number;newCountries:number};
export type MonthStat={month:string;wines:number;favorites:number};
/** How many wines sit at each cru tier, where the wine's country has one. */
export type ClassificationStat={classification:string;wines:number;favorites:number};
/** One bucket of the "how old was the bottle when it was opened" histogram. */
export type DrinkingAgeStat={age:number;wines:number};
export type RecentTasting={
  id:string;
  producer:string;
  wineName:string;
  vintage:number|null;
  country:string|null;
  region:string|null;
  appellation:string|null;
  rating:number|null;
  tastingDate:string|null;
  createdAt:string;
  imageId:string|null;
};
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
  grapes:GrapeStat[];
  discovery:DiscoveryStat;
  months:MonthStat[];
  classifications:ClassificationStat[];
  drinkingAges:DrinkingAgeStat[];
  recentTastings:RecentTasting[];
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

export type KindSpend={kind:string;label:string;runs:number;requests:number;searchQueries:number;promptTokens:number;outputTokens:number;units:number;unit:'run'|'wine';unitCount:number;costPerUnit:number;cost:number;costPerRun:number;searchesPerRun:number};
export type UsageSummary={
  currency:string;days:number;kinds:KindSpend[];empty:boolean;
  month:{month:string;searchQueries:number;freeRemaining:number;billableSearches:number;cost:number;resetsAt:string;timeZone:string};
};

export async function getAiSpend(days=30):Promise<UsageSummary>{
  const response=await fetch(`/api/usage/spend?days=${days}`,{headers:authHeaders()});
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error||'Could not load AI spend')}
  return response.json() as Promise<UsageSummary>;
}
