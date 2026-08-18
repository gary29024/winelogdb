import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { batchUpdateJournalExperience,listWines,type JournalWine } from './api';
import { WineImage } from './WineImage';
import '../../journalMonths.css';
import '../../journalBatch.css';

const PAGE_SIZE=36;
const MAX_BATCH_SELECTION=500;
type ViewMode='grid'|'list';
const journalDate=(wine:JournalWine)=>wine.tastingDate||wine.createdAt;
const monthKey=(wine:JournalWine)=>journalDate(wine).slice(0,7);
const monthLabel=(key:string)=>{
  const [year,month]=key.split('-').map(Number);
  return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
};
const initialView=():ViewMode=>{
  if(typeof window==='undefined')return 'grid';
  const saved=window.localStorage.getItem('winelog-journal-view');
  return saved==='list'||saved==='grid'?saved:'grid';
};
const sharedText=(values:Array<string|null>)=>{
  if(!values.length)return {value:'',mixed:false};
  const first=values[0]??'';
  return {value:first,mixed:values.some(value=>(value??'')!==first)};
};

function WineCard({wine:w,view,selecting,selected,onToggle}:{wine:JournalWine;view:ViewMode;selecting:boolean;selected:boolean;onToggle:()=>void}){
  const image=w.imageIds[0]?<WineImage imageId={w.imageIds[0]} alt={`${w.producer} ${w.wineName} front label`} className="journal-wine-thumb"/>:<div className="bottle">{w.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>;
  const className=`wine-card journal-card ${view==='grid'?'journal-grid-card':''}${selecting?' journal-selectable-card':''}${selected?' selected':''}`;
  const selectionMark=selecting?<span className="journal-select-mark" aria-hidden="true">{selected?'✓':''}</span>:null;
  const content=view==='grid'?<>{selectionMark}<div className="journal-grid-media">{image}<strong className="journal-grid-vintage">{w.vintage??'NV'}</strong>{w.rating!=null&&<span className="journal-grid-score">{w.rating}</span>}</div><div className="wine-card-body"><h2 title={w.wineName}>{w.wineName}</h2><p className="producer" title={w.producer}>{w.producer}</p></div></>:<>{selectionMark}{image}<div className="wine-card-body"><div className="wine-card-top"><h2>{w.wineName}</h2><strong>{w.vintage??'NV'}</strong></div><p className="producer">{w.producer}</p><span>{[w.appellation,w.region,w.country].filter(Boolean).join(' · ')}</span>{w.grapes.length>0&&<span className="grapes">{w.grapes.join(' · ')}</span>}{w.tastingName&&<span className="tasting-chip">{w.tastingName}</span>}{w.venue&&<span className="journal-venue">{w.venue}</span>}{w.rating!=null&&<span className="score-chip">{w.rating}</span>}</div></>;
  if(selecting)return <button type="button" className={className} aria-pressed={selected} aria-label={`${selected?'Deselect':'Select'} ${w.producer} ${w.wineName}`} onClick={onToggle}>{content}</button>;
  return <Link className={className} to={`/wines/${w.id}`}>{content}</Link>;
}

export function LibraryPage(){
  const [params,setParams]=useSearchParams();
  const [data,setData]=useState<JournalWine[]>([]),[nextOffset,setNextOffset]=useState<number|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[loadingMore,setLoadingMore]=useState(false);
  const [view,setViewState]=useState<ViewMode>(initialView),[queryDraft,setQueryDraft]=useState(()=>params.get('query')??''),[refreshSeq,setRefreshSeq]=useState(0);
  const [selecting,setSelecting]=useState(false),[selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());
  const [batchOpen,setBatchOpen]=useState(false),[batchBusy,setBatchBusy]=useState(false),[batchError,setBatchError]=useState(''),[batchNotice,setBatchNotice]=useState('');
  const [changeEvent,setChangeEvent]=useState(false),[changeVenue,setChangeVenue]=useState(false),[eventValue,setEventValue]=useState(''),[venueValue,setVenueValue]=useState(''),[eventMixed,setEventMixed]=useState(false),[venueMixed,setVenueMixed]=useState(false);
  const queryKey=params.toString(),queryKeyRef=useRef(queryKey);
  queryKeyRef.current=queryKey;
  const selectedWines=useMemo(()=>data.filter(wine=>selectedIds.has(wine.id)),[data,selectedIds]);

  function update(k:string,v:string,replace=true){
    setParams(previous=>{const n=new URLSearchParams(previous);v?n.set(k,v):n.delete(k);n.delete('offset');return n},{replace});
  }
  function setView(next:ViewMode){setViewState(next);try{window.localStorage.setItem('winelog-journal-view',next)}catch{}}
  function stopSelecting(){setSelecting(false);setSelectedIds(new Set());setBatchOpen(false);setBatchError('')}
  function toggleSelection(id:string){
    if(!selectedIds.has(id)&&selectedIds.size>=MAX_BATCH_SELECTION){setBatchError(`A single batch can update up to ${MAX_BATCH_SELECTION} wines.`);return}
    setBatchError('');setSelectedIds(previous=>{const next=new Set(previous);next.has(id)?next.delete(id):next.add(id);return next});
  }
  function selectAllLoaded(){
    const ids=data.slice(0,MAX_BATCH_SELECTION).map(w=>w.id);setSelectedIds(new Set(ids));
    setBatchError(data.length>MAX_BATCH_SELECTION?`Selected the first ${MAX_BATCH_SELECTION} loaded wines, which is the maximum for one batch.`:'');
  }
  function openBatchEditor(){
    if(!selectedWines.length)return;
    const event=sharedText(selectedWines.map(w=>w.tastingName)),venue=sharedText(selectedWines.map(w=>w.venue));
    setEventValue(event.mixed?'':event.value);setVenueValue(venue.mixed?'':venue.value);setEventMixed(event.mixed);setVenueMixed(venue.mixed);
    setChangeEvent(false);setChangeVenue(false);setBatchError('');setBatchOpen(true);
  }

  useEffect(()=>{
    const timer=window.setTimeout(()=>{if((params.get('query')??'')!==queryDraft)update('query',queryDraft)},350);
    return()=>window.clearTimeout(timer);
  },[queryDraft]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setLoadingMore(false);setError('');setData([]);setNextOffset(null);setSelectedIds(new Set());setSelecting(false);setBatchOpen(false);
    listWines(params,{limit:PAGE_SIZE,offset:0,signal:controller.signal})
      .then(result=>{setData(result.items);setNextOffset(result.nextOffset)})
      .catch(e=>{if(e?.name!=='AbortError')setError(e.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[queryKey,refreshSeq]);

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

  async function submitBatch(){
    if(!selectedIds.size)return;
    if(!changeEvent&&!changeVenue){setBatchError('Choose event and/or venue to update.');return}
    const patch:{tastingName?:string|null;venue?:string|null}={};
    if(changeEvent)patch.tastingName=eventValue.trim()||null;
    if(changeVenue)patch.venue=venueValue.trim()||null;
    const descriptions=[changeEvent?`Tasting / event: ${patch.tastingName||'clear'}`:'',changeVenue?`Venue: ${patch.venue||'clear'}`:''].filter(Boolean);
    if(!confirm(`Update ${selectedIds.size} selected wine${selectedIds.size===1?'':'s'}?\n\n${descriptions.join('\n')}`))return;
    setBatchBusy(true);setBatchError('');setBatchNotice('');
    try{
      const result=await batchUpdateJournalExperience([...selectedIds],patch);
      setBatchNotice(`Updated ${result.updated} wine${result.updated===1?'':'s'}.`);setBatchOpen(false);setSelecting(false);setSelectedIds(new Set());setRefreshSeq(value=>value+1);
    }catch(e){setBatchError((e as Error).message)}finally{setBatchBusy(false)}
  }

  const sort=params.get('sort')??'newest';
  const chronological=sort==='newest'||sort==='oldest';
  const ordered=chronological?[...data].sort((a,b)=>sort==='oldest'?journalDate(a).localeCompare(journalDate(b)):journalDate(b).localeCompare(journalDate(a))):data;
  const groups=chronological?ordered.reduce<Array<{key:string;items:JournalWine[]}>>((acc,wine)=>{const key=monthKey(wine),last=acc[acc.length-1];if(last?.key===key)last.items.push(wine);else acc.push({key,items:[wine]});return acc},[]):[];
  const collectionClass=`wine-grid journal-list ${view==='grid'?'journal-gallery':'journal-list-view'}`;
  const renderItems=(items:JournalWine[])=><div className={collectionClass}>{items.map(w=><WineCard wine={w} view={view} selecting={selecting} selected={selectedIds.has(w.id)} onToggle={()=>toggleSelection(w.id)} key={w.id}/>)}</div>;

  return <section className="journal-page">
    <div className="hero journal-hero"><p className="eyebrow">YOUR JOURNAL</p><h1>Wines worth remembering.</h1><p>Search by bottle, place or tasting and keep every drinking experience together.</p></div>
    <form className="filters journal-filters" onSubmit={e=>e.preventDefault()}><label className="search">Search<input aria-label="Search wines" type="search" value={queryDraft} onChange={e=>setQueryDraft(e.target.value)} placeholder="Search wines, makers, regions…"/></label><div className="filter-pills"><label>Tasting<input value={params.get('tasting')??''} onChange={e=>update('tasting',e.target.value)} placeholder="Tasting / event"/></label><label>Country<input value={params.get('country')??''} onChange={e=>update('country',e.target.value)} placeholder="Country"/></label><label>Style<select value={params.get('style')??''} onChange={e=>update('style',e.target.value)}><option value="">Style</option>{['red','white','rose','sparkling','dessert','fortified','orange'].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<input type="number" min="0" max="100" value={params.get('rating')??''} onChange={e=>update('rating',e.target.value)} placeholder="Score"/></label><label>Sort<select value={sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest drinking date</option><option value="oldest">Oldest drinking date</option><option value="rating">Rating</option><option value="producer">Producer</option><option value="vintage">Vintage</option></select></label></div></form>
    {batchNotice&&<p className="journal-batch-notice" role="status">{batchNotice}</p>}
    {batchError&&!batchOpen&&<p className="journal-page-error" role="alert">{batchError}</p>}
    <div className={`journal-viewbar${selecting?' selecting':''}`}><span>{selecting?`${selectedIds.size} selected`:data.length?`${data.length} loaded`:'Journal'}</span>{selecting?<div className="journal-selection-actions"><button type="button" onClick={selectAllLoaded} disabled={!data.length}>Select all loaded</button><button type="button" onClick={()=>setSelectedIds(new Set())} disabled={!selectedIds.size}>Clear</button><button type="button" className="primary" onClick={openBatchEditor} disabled={!selectedIds.size}>Edit event / venue</button><button type="button" onClick={stopSelecting}>Done</button></div>:<div className="journal-view-actions"><button type="button" className="journal-select-toggle" onClick={()=>{setSelecting(true);setBatchNotice('')}} disabled={!data.length}>Select</button><div className="journal-view-toggle" role="group" aria-label="Journal layout"><button type="button" className={view==='list'?'active':''} aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button><button type="button" className={view==='grid'?'active':''} aria-pressed={view==='grid'} onClick={()=>setView('grid')}>Grid</button></div></div>}</div>
    {loading?<p aria-live="polite">Pouring your collection…</p>:error&&!data.length?<p role="alert">{error}</p>:data.length?(chronological?<div className="journal-months">{groups.map(group=><section className="journal-month" key={group.key}><h2 className="journal-month-heading">{monthLabel(group.key)}</h2>{renderItems(group.items)}</section>)}</div>:renderItems(data)):<div className="empty"><span>⌁</span><h2>Your journal is empty</h2><p>Scan a bottle label to add your first wine.</p><Link className="button" to="/upload">Scan Wine</Link></div>}
    {error&&data.length>0&&<p className="journal-page-error" role="alert">{error}</p>}
    {nextOffset!=null&&<div className="journal-load-more"><button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore?'Loading…':`Load ${PAGE_SIZE} more`}</button></div>}
    {batchOpen&&<div className="journal-batch-backdrop" role="presentation" onClick={()=>{if(!batchBusy)setBatchOpen(false)}}><div className="journal-batch-sheet" role="dialog" aria-modal="true" aria-labelledby="journal-batch-title" onClick={e=>e.stopPropagation()}><div className="journal-batch-heading"><div><p className="eyebrow">BATCH UPDATE</p><h2 id="journal-batch-title">{selectedIds.size} wine{selectedIds.size===1?'':'s'} selected</h2></div><button type="button" className="journal-batch-close" onClick={()=>setBatchOpen(false)} disabled={batchBusy} aria-label="Close batch editor">×</button></div><p>Enable only the fields you want to change. An enabled blank field clears that value; unchecked fields stay untouched.</p><label className="journal-batch-toggle"><input type="checkbox" checked={changeEvent} onChange={e=>setChangeEvent(e.target.checked)}/><span>Change tasting / event group</span></label><input className="journal-batch-input" type="text" value={eventValue} onChange={e=>setEventValue(e.target.value)} disabled={!changeEvent} placeholder={eventMixed?'Mixed events — enter replacement':'Event name; blank clears'}/><label className="journal-batch-toggle"><input type="checkbox" checked={changeVenue} onChange={e=>setChangeVenue(e.target.checked)}/><span>Change venue</span></label><input className="journal-batch-input" type="text" value={venueValue} onChange={e=>setVenueValue(e.target.value)} disabled={!changeVenue} placeholder={venueMixed?'Mixed venues — enter replacement':'Venue; blank clears'}/>{batchError&&<p className="journal-page-error" role="alert">{batchError}</p>}<div className="journal-batch-actions"><button type="button" onClick={()=>setBatchOpen(false)} disabled={batchBusy}>Cancel</button><button type="button" className="primary" onClick={submitBatch} disabled={batchBusy||(!changeEvent&&!changeVenue)}>{batchBusy?'Updating…':`Update ${selectedIds.size} wine${selectedIds.size===1?'':'s'}`}</button></div></div></div>}
  </section>
}
