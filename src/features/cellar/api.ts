import { authHeaders,clearSession } from '../../lib/auth/client';
import type { VintageWindow } from '../../lib/maturity/vintageWindow';

export type CellarHolding={
  id:string;producerId:string|null;cuveeId:string|null;
  producer:string;wineName:string;vintage:number|null;
  country:string|null;region:string|null;appellation:string|null;
  wineStyle:string|null;classification:string|null;
  bottles:number;bottleSizeMl:number;
  purchasePrice:number|null;currency:string|null;purchasedAt:string|null;
  merchant:string|null;location:string|null;notes:string;
  createdAt:string;updatedAt:string;
  /**
   * What the vintage lookup already knows about this year, where the list
   * carried it. Absent on the single-holding reads, which have no card to draw.
   */
  vintageWindow?:VintageWindow|null;
};
export type CellarInput={
  producer:string;wineName:string;vintage:number|null;
  country:string|null;region:string|null;appellation:string|null;
  wineStyle:string|null;bottles:number;bottleSizeMl:number;
  purchasePrice:number|null;currency:string|null;purchasedAt:string|null;
  merchant:string|null;location:string|null;notes:string;
};
export type CellarPage={items:CellarHolding[];total:number;bottles:number;nextOffset:number|null};

type ApiIssue={path?:Array<string|number>;message?:string};
async function requireOk(response:Response,message:string){
  if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {error?:string;issues?:ApiIssue[]};
    const details=body.issues?.map(issue=>`${issue.path?.join('.')||'field'}: ${issue.message||'Invalid input'}`).join('; ');
    throw new Error([body.error||message,details].filter(Boolean).join(' — '));
  }
}

export async function listCellar(params:URLSearchParams,options:{limit?:number;offset?:number;signal?:AbortSignal}={}):Promise<CellarPage>{
  const query=new URLSearchParams(params);
  query.set('limit',String(options.limit??36));query.set('offset',String(options.offset??0));
  const response=await fetch(`/api/cellar?${query}`,{headers:authHeaders(),signal:options.signal});
  await requireOk(response,'Could not load your cellar');
  return response.json() as Promise<CellarPage>;
}

export async function addToCellar(input:CellarInput){
  const response=await fetch('/api/cellar',{method:'POST',headers:authHeaders(true),body:JSON.stringify(input)});
  await requireOk(response,'Could not add those bottles');
  return (await response.json() as {holding:CellarHolding}).holding;
}

export async function updateHolding(id:string,patch:Partial<CellarInput>){
  const response=await fetch(`/api/cellar/${id}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(patch)});
  await requireOk(response,'Could not update those bottles');
  return (await response.json() as {holding:CellarHolding}).holding;
}

export async function removeHolding(id:string){
  const response=await fetch(`/api/cellar/${id}`,{method:'DELETE',headers:authHeaders()});
  await requireOk(response,'Could not remove those bottles');
}

export async function getHolding(id:string){
  const response=await fetch(`/api/cellar/${id}`,{headers:authHeaders()});
  if(response.status===404)return null;
  await requireOk(response,'Could not load that cellar entry');
  return (await response.json() as {holding:CellarHolding}).holding;
}

/**
 * Nothing in the cellar is the ordinary answer here, so this never throws and
 * never returns anything but a list: a wine page must render whether or not the
 * cellar has anything to say about the bottle.
 */
export async function holdingsForWine(wineId:string):Promise<CellarHolding[]>{
  const response=await fetch(`/api/wines/${wineId}/cellar`,{headers:authHeaders()}).catch(()=>null);
  if(!response?.ok)return [];
  const body=await response.json().catch(()=>null) as {holdings?:unknown}|null;
  return Array.isArray(body?.holdings)?body.holdings as CellarHolding[]:[];
}

/**
 * What the bottles cost, short enough for a list row.
 *
 * The price is per bottle, which is what the form asks for and what compares
 * between two lines. Where a line holds more than one, the lot follows it: the
 * per-bottle figure is the one you remember paying and the lot is the one that
 * says what is sitting on the rack.
 *
 * Falls back to the code and the number where the currency is not one the
 * browser knows - a typed three-letter code is not guaranteed to be real.
 */
export function priceLabel(holding:Pick<CellarHolding,'purchasePrice'|'currency'|'bottles'>){
  if(holding.purchasePrice==null)return null;
  const money=(value:number)=>{
    const rounded=Math.round(value*100)/100;
    if(!holding.currency)return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(rounded);
    try{return new Intl.NumberFormat(undefined,{style:'currency',currency:holding.currency,maximumFractionDigits:rounded<100?2:0}).format(rounded)}
    catch{return `${holding.currency} ${new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(rounded)}`}
  };
  const each=money(holding.purchasePrice);
  return holding.bottles>1?`${each} × ${holding.bottles} · ${money(holding.purchasePrice*holding.bottles)}`:each;
}

/** "6 bottles · 750ml", or the format when it is not an ordinary bottle. */
export function bottleLabel(holding:Pick<CellarHolding,'bottles'|'bottleSizeMl'>){
  const count=`${holding.bottles} bottle${holding.bottles===1?'':'s'}`;
  return holding.bottleSizeMl===750?count:`${count} · ${holding.bottleSizeMl>=1000?`${holding.bottleSizeMl/1000}L`:`${holding.bottleSizeMl}ml`}`;
}
