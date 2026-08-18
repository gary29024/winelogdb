import { useEffect,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import type { WineRecord } from '../../lib/db/schema';
import { listWines } from './api';
import { WineImage } from './WineImage';

const journalDate=(wine:WineRecord)=>wine.tastingDate||wine.createdAt;
const monthKey=(wine:WineRecord)=>journalDate(wine).slice(0,7);
const monthLabel=(key:string)=>{
  const [year,month]=key.split('-').map(Number);
  return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
};

function WineCard({wine:w}:{wine:WineRecord}){
  return <Link className="wine-card journal-card" to={`/wines/${w.id}`}>{w.imageIds[0]?<WineImage imageId={w.imageIds[0]} alt={`${w.producer} ${w.wineName} front label`} className="journal-wine-thumb"/>:<div className="bottle">{w.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}<div className="wine-card-body"><div className="wine-card-top"><h2>{w.wineName}</h2><strong>{w.vintage??'NV'}</strong></div><p className="producer">{w.producer}</p><span>{[w.appellation,w.region,w.country].filter(Boolean).join(' · ')}</span>{w.grapes.length>0&&<span className="grapes">{w.grapes.join(' · ')}</span>}{w.tastingName&&<span className="tasting-chip">{w.tastingName}</span>}{w.rating!=null&&<span className="score-chip">{w.rating}</span>}</div></Link>;
}

export function LibraryPage(){
  const [params,setParams]=useSearchParams(),[data,setData]=useState<WineRecord[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{setLoading(true);listWines(params).then(x=>setData(x.items)).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[params]);
  function update(k:string,v:string){const n=new URLSearchParams(params);v?n.set(k,v):n.delete(k);n.delete('offset');setParams(n)}
  const sort=params.get('sort')??'newest';
  const chronological=sort==='newest'||sort==='oldest';
  const ordered=chronological?[...data].sort((a,b)=>sort==='oldest'?journalDate(a).localeCompare(journalDate(b)):journalDate(b).localeCompare(journalDate(a))):data;
  const groups=chronological?ordered.reduce<Array<{key:string;items:WineRecord[]}>>((acc,wine)=>{const key=monthKey(wine),last=acc[acc.length-1];if(last?.key===key)last.items.push(wine);else acc.push({key,items:[wine]});return acc},[]):[];
  return <section className="journal-page">
    <div className="hero journal-hero"><p className="eyebrow">YOUR JOURNAL</p><h1>Wines worth remembering.</h1><p>Search by bottle, place or tasting and keep every drinking experience together.</p></div>
    <form className="filters journal-filters" onSubmit={e=>e.preventDefault()}><label className="search">Search<input aria-label="Search wines" type="search" value={params.get('query')??''} onChange={e=>update('query',e.target.value)} placeholder="Search wines, makers, regions…"/></label><div className="filter-pills"><label>Tasting<input value={params.get('tasting')??''} onChange={e=>update('tasting',e.target.value)} placeholder="Tasting / event"/></label><label>Country<input value={params.get('country')??''} onChange={e=>update('country',e.target.value)} placeholder="Country"/></label><label>Style<select value={params.get('style')??''} onChange={e=>update('style',e.target.value)}><option value="">Style</option>{['red','white','rose','sparkling','dessert','fortified','orange'].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<input type="number" min="0" max="100" value={params.get('rating')??''} onChange={e=>update('rating',e.target.value)} placeholder="Score"/></label><label>Sort<select value={sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest drinking date</option><option value="oldest">Oldest drinking date</option><option value="rating">Rating</option><option value="producer">Producer</option><option value="vintage">Vintage</option></select></label></div></form>
    {loading?<p aria-live="polite">Pouring your collection…</p>:error?<p role="alert">{error}</p>:data.length?(chronological?<div className="journal-months">{groups.map(group=><section className="journal-month" key={group.key}><h2 className="journal-month-heading">{monthLabel(group.key)}</h2><div className="wine-grid journal-list">{group.items.map(w=><WineCard wine={w} key={w.id}/>)}</div></section>)}</div>:<div className="wine-grid journal-list">{data.map(w=><WineCard wine={w} key={w.id}/>)}</div>):<div className="empty"><span>⌁</span><h2>Your journal is empty</h2><p>Scan a bottle label to add your first wine.</p><Link className="button" to="/upload">Scan Wine</Link></div>}
  </section>
}
