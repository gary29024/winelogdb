import { useCallback,useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducers,type ProducerSummary } from './api';
import '../../producer.css';
import './search.css';
import { AppIcon } from '../../components/AppIcons';
import { ResearchCampaignLink } from './ResearchCampaignLink';

const unknownLast=(a:string,b:string)=>{
 const aUnknown=/not researched$/i.test(a),bUnknown=/not researched$/i.test(b);
 if(aUnknown!==bUnknown)return aUnknown?1:-1;
 return a.localeCompare(b);
};
const searchKey=(value:string|null)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();


const COUNTRY_OPEN_KEY='winelog.producers.expandedCountries';
/**
 * Which countries are open. Countries collapse by default once there is more
 * than one, so the page opens as an index rather than as the whole library -
 * which is the thing that stops scaling as producers are added. Expanded
 * countries are what gets stored, so a country added later starts closed like
 * the rest.
 */
function readExpandedCountries():Set<string>{
  try{
    const raw=window.localStorage.getItem(COUNTRY_OPEN_KEY);if(!raw)return new Set();
    const parsed=JSON.parse(raw);return new Set(Array.isArray(parsed)?parsed.filter((x):x is string=>typeof x==='string'):[]);
  }catch{return new Set()}
}
function writeExpandedCountries(next:Set<string>){try{window.localStorage.setItem(COUNTRY_OPEN_KEY,JSON.stringify([...next]))}catch{/* storage unavailable */}}
const countryPanelId=(country:string)=>`producer-country-${country.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;

export function ProducersPage(){
 const [items,setItems]=useState<ProducerSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[expandedCountries,setExpandedCountries]=useState<Set<string>>(readExpandedCountries);
 const load=useCallback(()=>listProducers().then(x=>setItems(x.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false)),[]);
 useEffect(()=>{void load()},[load]);
 const filteredItems=useMemo(()=>{
  const needle=searchKey(query);if(!needle)return items;
  const tokens=needle.split(/\s+/).filter(Boolean);
  return items.filter(p=>{
   const haystack=searchKey([p.canonicalName,p.homeLocality,p.homeRegion,p.homeCountry].filter(Boolean).join(' '));
   return tokens.every(token=>haystack.includes(token));
  });
 },[items,query]);
 const groups=useMemo(()=>{
  const map=new Map<string,Map<string,Map<string,ProducerSummary[]>>>();
  for(const p of filteredItems){
   const country=p.homeCountry||'Location not researched',region=p.homeRegion||'Broad region not researched',commune=p.homeLocality||'Commune not researched';
   if(!map.has(country))map.set(country,new Map());
   const regions=map.get(country)!;if(!regions.has(region))regions.set(region,new Map());
   const communes=regions.get(region)!;if(!communes.has(commune))communes.set(commune,[]);communes.get(commune)!.push(p);
  }
  return [...map.entries()].sort(([a],[b])=>unknownLast(a,b)).map(([country,regions])=>({country,regions:[...regions.entries()].sort(([a],[b])=>unknownLast(a,b)).map(([region,communes])=>({region,communes:[...communes.entries()].sort(([a],[b])=>unknownLast(a,b)).map(([commune,producers])=>({commune,producers:producers.sort((a,b)=>a.canonicalName.localeCompare(b.canonicalName))}))}))}));
 },[filteredItems]);
 const hasQuery=Boolean(query.trim());
 // A search that hid its own results inside a collapsed country would be a
 // trap, so searching opens everything for as long as the query lasts.
 const collapsible=!hasQuery&&groups.length>1;
 const isOpen=(country:string)=>!collapsible||expandedCountries.has(country);
 const countryCount=(group:typeof groups[number])=>group.regions.reduce((total,region)=>total+region.communes.reduce((sum,commune)=>sum+commune.producers.length,0),0);
 const allOpen=groups.length>0&&groups.every(group=>expandedCountries.has(group.country));
 function toggleCountry(country:string){
  setExpandedCountries(current=>{
   const next=new Set(current);
   if(next.has(country))next.delete(country);else next.add(country);
   writeExpandedCountries(next);return next;
  });
 }
 function toggleAllCountries(){
  setExpandedCountries(()=>{
   const next=allOpen?new Set<string>():new Set(groups.map(group=>group.country));
   writeExpandedCountries(next);return next;
  });
 }
 return <section className="producer-page"><div className="hero compact"><p className="eyebrow">PRODUCERS</p><h1>Your producer library.</h1><p>Browse domaines by where they are physically based: country, broad wine region, then commune — not by the appellations represented in their wines.</p></div>
  <div className="producer-search"><div className="producer-search-field"><span aria-hidden="true"><AppIcon kind="search"/></span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search producers…" aria-label="Search producers"/>{hasQuery&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear producer search">Clear</button>}</div></div>
  {!loading&&!error&&<ResearchCampaignLink unresearched={items.filter(item=>!item.researchedAt).length}/>}
  {loading?<p>Loading producers…</p>:error?<p role="alert">{error}</p>:groups.length?<>
  <div className="producer-range-head producer-countries-head"><strong>{groups.length} {groups.length===1?'country':'countries'} · {hasQuery?`${filteredItems.length} of ${items.length}`:filteredItems.length} producer{(hasQuery?items.length:filteredItems.length)===1?'':'s'}</strong>{collapsible&&<button type="button" className="range-toggle-all" onClick={toggleAllCountries}>{allOpen?'Collapse all':'Expand all'}</button>}</div>
  <div className="producer-countries">{groups.map(group=><section className={`producer-country${isOpen(group.country)?'':' is-collapsed'}`} key={group.country}><h2>{collapsible?<button type="button" className="country-group-toggle" aria-expanded={isOpen(group.country)} aria-controls={countryPanelId(group.country)} onClick={()=>toggleCountry(group.country)}><span className="country-group-name">{group.country}</span><span className="catalog-group-count">{countryCount(group)}</span><span className="catalog-chevron" aria-hidden="true"/></button>:group.country}</h2><div className="producer-country-body" id={countryPanelId(group.country)} hidden={!isOpen(group.country)}>{group.regions.map(region=><div className="producer-region" key={region.region}><h3>{region.region}</h3>{region.communes.map(commune=><div className="producer-commune" key={commune.commune}><h4>{commune.commune}</h4><div className="producer-list">{commune.producers.map(p=><Link to={`/producers/${p.id}`} className="producer-row" key={p.id}><div><strong>{p.canonicalName}</strong></div><div className="producer-counts"><span>{p.tastedCount} tasted</span>{p.catalogCount>0&&<span>{p.catalogCount} wines in range</span>}</div></Link>)}</div></div>)}</div>)}</div></section>)}</div></>:hasQuery?<div className="empty producer-search-empty"><h2>No matching producers</h2><p>Try a producer name, commune, region or country.</p><button type="button" onClick={()=>setQuery('')}>Clear search</button></div>:<div className="empty"><h2>No producers yet</h2><p>Add a wine and WineLog will create its stable producer identity automatically.</p></div>}
 </section>
}
