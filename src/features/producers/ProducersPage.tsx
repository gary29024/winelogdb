import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducers,type ProducerSummary } from './api';
import '../../producer.css';

export function ProducersPage(){
 const [items,setItems]=useState<ProducerSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{listProducers().then(x=>setItems(x.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[]);
 const groups=useMemo(()=>{
  const map=new Map<string,Map<string,ProducerSummary[]>>();
  for(const p of items){const country=p.homeCountry||'Location not researched',region=p.homeRegion||'Region not researched';if(!map.has(country))map.set(country,new Map());const regions=map.get(country)!;if(!regions.has(region))regions.set(region,[]);regions.get(region)!.push(p)}
  return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([country,regions])=>({country,regions:[...regions.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([region,producers])=>({region,producers:producers.sort((a,b)=>a.canonicalName.localeCompare(b.canonicalName))}))}));
 },[items]);
 return <section className="producer-page"><div className="hero compact"><p className="eyebrow">PRODUCERS</p><h1>Your producer library.</h1><p>Browse domaines by where they are based, not by the regions represented in their wines.</p></div>
  {loading?<p>Loading producers…</p>:error?<p role="alert">{error}</p>:groups.length?<div className="producer-countries">{groups.map(group=><section className="producer-country" key={group.country}><h2>{group.country}</h2>{group.regions.map(region=><div className="producer-region" key={region.region}><h3>{region.region}</h3><div className="producer-list">{region.producers.map(p=><Link to={`/producers/${p.id}`} className="producer-row" key={p.id}><div><strong>{p.canonicalName}</strong>{p.homeLocality&&<span>{p.homeLocality}</span>}</div><div className="producer-counts"><span>{p.tastedCount} tasted</span>{p.catalogCount>0&&<span>{p.catalogCount} wines in range</span>}</div></Link>)}</div></div>)}</section>)}</div>:<div className="empty"><h2>No producers yet</h2><p>Add a wine and WineLog will create its stable producer identity automatically.</p></div>}
 </section>
}
