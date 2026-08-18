import { useEffect,useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import type { WineRecord } from '../../lib/db/schema';
import { listWines } from './api';
import { WineImage } from './WineImage';
import '../../journalMonths.css';

const PAGE_SIZE=36;
type ViewMode='grid'|'list';
const journalDate=(wine:WineRecord)=>wine.tastingDate||wine.createdAt;
const monthKey=(wine:WineRecord)=>journalDate(wine).slice(0,7);
const monthLabel=(key:string)=>{
  const [year,month]=key.split('-').map(Number);
  return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
};
const initialView=():ViewMode=>{
  if(typeof window==='undefined')return 'grid';
  const saved=window.localStorage.getItem('winelog-journal-view');
  return saved==='list'||saved==='grid'?saved:'grid';
};

function WineCard({wine:w,view}:{wine:WineRecord;view:ViewMode}){
  const image=w.imageIds[0]?<WineImage imageId={w.imageIds[0]} alt={`${w.producer} ${w.wineName} front label`} className="journal-wine-thumb"/>:<div className="bottle">{w.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>;
  if(view==='grid')return <Link className="wine-card journal-card journal-grid-card" to={`/wines/${w.id}`}>
    <div className="journal-grid-media">{image}<strong className="journal-grid-vintage">{w.vintage??'NV'}</strong>{w.rating!=null&&<span className="journal-grid-score">{w.rating}</span>}</div>
    <div className="wine-card-body"><h2 title={w.wineName}>{w.wineName}</h2><p className="producer" title={w.producer}>{w.producer}</p></div>
  </Link>;
  return <Link className="wine-card journal-card" to={`/wines/${w.id}`}>{image}<div className="wine-card-body"><div className="wine-card-top"><h2>{w.wineName}</h2><strong>{w.vintage??'NV'}</strong></div><p className="producer">{w.producer}</p><span>{[w.appellation,w.region,w.country].filter(Boolean).join(' · ')}</span>{w.grapes.length>0&&<span className="grapes">{w.grapes.join(' · ')}</span>}{w.tastingName&&<span className="tasting-chip">{w.tastingName}</span>}{w.rating!=null&&<span className="score-chip">{w.rating}</span>}</div></Link>;
}

export function LibraryPage(){
  const [params,setParams]=useSearchParams();
  const [data,setData]=useState<WineRecord[]>([]),[nextOffset,setNextOffset]=useState<number|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false);
  const [view,setViewState]=useState<ViewMode>(initialView),[queryDraft,setQueryDraft]=useState(()=>params.get('query')??'');
  const queryKey=params.toString(),queryKeyRef=useRef(queryKey);
  queryKeyRef.current=queryKey;

  function update(k:string,v:string,replace=true){
    setParams(previous=>{const n=new URLSearchParams(previous);v?n.set(k,v):n.delete(k);n.delete('offset');return n},{replace});
  }
  function setView(next:ViewMode){setViewState(next);try{window.localStorage.setItem('winelog-journal-view',next)}catch{}}

  useEffect(()=>{
    const timer=window.setTimeout(()=>{if((params.get('query')??'')!==queryDraft)update('query',queryDraft)},350);
    return()=>window.clearTimeout(timer);
  },[queryDraft]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setLoadingMore(false);setError('');setData([]);setNextOffset(null);
    listWines(params,{limit:PAGE_SIZE,offset:0,signal:controller.signal})
      .then(result=>{setData(result.items);setNextOffset(result.nextOffset)})
      .catch(e=>{if(e?.name!=='AbortError')setError(e.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[queryKey]);

  async function loadMore(){
    if(nextOffset==null||loadingMore)return;
    const key=queryKey;setLoadingMore(true);setError('');
    try{
      const result=await listWines(params,{limit:PAGE_SIZE,offset:nextOffset});
      if(queryKeyRef.current!==key)return;
      setData(previous=>{const seen=new Set(previous.map(w=>w.id));return [...previous,...result.items.filter(w=>!seen.has(w.id))]});
      setNextOffset(result.nextOffset);
    }catch(e){if(queryKeyRef.current===key)setError((e as Error).message)}finally{if(queryKeyRef.current===key)setLoadingMore(false)}
  }

  const sort=params.get('sort')??'newest';
  const chronological=sort==='newest'||sort==='oldest';
  const ordered=chronological?[...data].sort((a,b)=>sort==='oldest'?journalDate(a).localeCompare(journalDate(b)):journalDate(b).localeCompare(journalDate(a))):data;
  const groups=chronological?ordered.reduce<Array<{key:string;items:WineRecord[]}>>((acc,wine)=>{const key=monthKey(wine),last=acc[acc.length-1];if(last?.key===key)last.items.push(wine);else acc.push({key,items:[wine]});return acc},[]):[];
  const collectionClass=`wine-grid journal-list ${view==='grid'?'journal-gallery':'journal-list-view'}`;
  const renderItems=(items:WineRecord[])=><div className={collectionClass}>{items.map(w=><WineCard wine={w} view={view} key={w.id}/>)}</div>;

  return <section className="journal-page">
    <div className="hero journal-hero"><p className="eyebrow">YOUR JOURNAL</p><h1>Wines worth remembering.</h1><p>Search by bottle, place or tasting and keep every drinking experience together.</p></div>
    <form className="filters journal-filters" onSubmit={e=>e.preventDefault()}><label className="search">Search<input aria-label="Search wines" type="search" value={queryDraft} onChange={e=>setQueryDraft(e.target.value)} placeholder="Search wines, makers, regions…"/></label><div className="filter-pills"><label>Tasting<input value={params.get('tasting')??''} onChange={e=>update('tasting',e.target.value)} placeholder="Tasting / event"/></label><label>Country<input value={params.get('country')??''} onChange={e=>update('country',e.target.value)} placeholder="Country"/></label><label>Style<select value={params.get('style')??''} onChange={e=>update('style',e.target.value)}><option value="">Style</option>{['red','white','rose','sparkling','dessert','fortified','orange'].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<input type="number" min="0" max="100" value={params.get('rating')??''} onChange={e=>update('rating',e.target.value)} placeholder="Score"/></label><label>Sort<select value={sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest drinking date</option><option value="oldest">Oldest drinking date</option><option value="rating">Rating</option><option value="producer">Producer</option><option value="vintage">Vintage</option></select></label></div></form>
    <div className="journal-viewbar"><span>{data.length?`${data.length} loaded`:'Journal'}</span><div className="journal-view-toggle" role="group" aria-label="Journal layout"><button type="button" className={view==='list'?'active':''} aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button><button type="button" className={view==='grid'?'active':''} aria-pressed={view==='grid'} onClick={()=>setView('grid')}>Grid</button></div></div>
    {loading?<p aria-live="polite">Pouring your collection…</p>:error&&!data.length?<p role="alert">{error}</p>:data.length?(chronological?<div className="journal-months">{groups.map(group=><section className="journal-month" key={group.key}><h2 className="journal-month-heading">{monthLabel(group.key)}</h2>{renderItems(group.items)}</section>)}</div>:renderItems(data)):<div className="empty"><span>⌁</span><h2>Your journal is empty</h2><p>Scan a bottle label to add your first wine.</p><Link className="button" to="/upload">Scan Wine</Link></div>}
    {error&&data.length>0&&<p className="journal-page-error" role="alert">{error}</p>}
    {nextOffset!=null&&<div className="journal-load-more"><button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Loading…':`Load ${PAGE_SIZE} more`}</button></div>}
  </section>
}
