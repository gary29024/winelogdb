import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducers,type ProducerSummary } from './api';
import '../../producer.css';

const unknownLast=(a:string,b:string)=>{
 const aUnknown=/not researched$/i.test(a),bUnknown=/not researched$/i.test(b);
 if(aUnknown!==bUnknown)return aUnknown?1:-1;
 return a.localeCompare(b);
};
const searchKey=(value:string|null)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function ProducersPage(){
 const [items,setItems]=useState<ProducerSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{listProducers().then(x=>setItems(x.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
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
 return <section className="producer-page"><div className="hero compact"><p className="eyebrow">PRODUCERS</p><h1>Your producer library.</h1><p>Browse domaines by where they are physically based: country, broad wine region, then commune — not by the appellations represented in their wines.</p></div>
  <div className="producer-search"><div className="producer-search-field"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search producers…" aria-label="Search producers"/>{hasQuery&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear producer search">Clear</button>}</div>{!loading&&!error&&<small>{hasQuery?`${filteredItems.length} of ${items.length} producers`:`${items.length} producer${items.length===1?'':'s'}`}</small>}</div>
  {loading?<p>Loading producers…</p>:error?<p role="alert">{error}</p>:groups.length?<div className="producer-countries">{groups.map(group=><section className="producer-country" key={group.country}><h2>{group.country}</h2>{group.regions.map(region=><div className="producer-region" key={region.region}><h3>{region.region}</h3>{region.communes.map(commune=><div className="producer-commune" key={commune.commune}><h4>{commune.commune}</h4><div className="producer-list">{commune.producers.map(p=><Link to={`/producers/${p.id}`} className="producer-row" key={p.id}><div><strong>{p.canonicalName}</strong></div><div className="producer-counts"><span>{p.tastedCount} tasted</span>{p.catalogCount>0&&<span>{p.catalogCount} wines in range</span>}</div></Link>)}</div></div>)}</div>)}</section>)}</div>:hasQuery?<div className="empty producer-search-empty"><h2>No matching producers</h2><p>Try a producer name, commune, region or country.</p><button type="button" onClick={()=>setQuery('')}>Clear search</button></div>:<div className="empty"><h2>No producers yet</h2><p>Add a wine and WineLog will create its stable producer identity automatically.</p></div>}
 </section>
}
