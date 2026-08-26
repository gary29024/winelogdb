import { useEffect,useMemo,useState } from 'react';
import { pourFamily } from '../../lib/wine/pourFamily';
import { Link,Navigate,useSearchParams } from 'react-router-dom';
import { batchUpdateJournalExperience,listWines,setWineFavorite,type JournalWine } from './api';
import { WineImage } from './WineImage';
import '../../journalMonths.css';
import '../../journalBatch.css';
import '../../journalPagination.css';
import '../../favorites.css';
import { AppIcon } from '../../components/AppIcons';

const PAGE_SIZE=36;
const MAX_BATCH_SELECTION=500;
type ViewMode='grid'|'list';
const journalDate=(wine:JournalWine)=>wine.tastingDate||wine.createdAt;
const monthKey=(wine:JournalWine)=>journalDate(wine).slice(0,7);
const monthLabel=(key:string)=>{
  const [year,month]=key.split('-').map(Number);
  return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
};
/**
 * The filters you left the journal with, so returning from a wine lands back on
 * the list you were reading rather than a reset one. Session-scoped on purpose:
 * a filter from last week reappearing would be a surprise, not a convenience.
 */
const JOURNAL_FILTER_KEY='winelog-journal-filters';
const savedJournalFilters=()=>{
  if(typeof window==='undefined')return '';
  try{return window.sessionStorage.getItem(JOURNAL_FILTER_KEY)??''}catch{return ''}
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

function WineCard({wine:w,view,selecting,selected,onToggle,onFavorite,favoriteBusy}:{wine:JournalWine;view:ViewMode;selecting:boolean;selected:boolean;onToggle:()=>void;onFavorite:(next:boolean)=>void;favoriteBusy:boolean}){
  const image=w.imageIds[0]?<WineImage imageId={w.imageIds[0]} alt={`${w.producer} ${w.wineName} front label`} className="journal-wine-thumb"/>:<div className={`bottle bottle-${pourFamily(w.wineStyle)}`}>{w.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>;
  const className=`wine-card journal-card ${view==='grid'?'journal-grid-card':''}${selecting?' journal-selectable-card':''}${selected?' selected':''}`;
  const selectionMark=selecting?<span className="journal-select-mark" aria-hidden="true">{selected?'✓':''}</span>:null;
  const content=view==='grid'?<>{selectionMark}<div className="journal-grid-media">{image}<strong className="journal-grid-vintage">{w.vintage??'NV'}</strong>{w.rating!=null&&<span className="journal-grid-score">{w.rating}</span>}</div><div className="wine-card-body"><h2 title={w.wineName}>{w.wineName}</h2><p className="producer" title={w.producer}>{w.producer}</p></div></>:<>{selectionMark}{image}<div className="wine-card-body"><div className="wine-card-top"><h2>{w.wineName}</h2><strong>{w.vintage??'NV'}</strong></div><p className="producer">{w.producer}</p><span className="journal-meta">{[[w.appellation,w.region,w.country].filter(Boolean).join(' · '),w.grapes.join(' · ')].filter(Boolean).join(' · ')}</span>{w.tastingName&&<span className="tasting-chip">{w.tastingName}</span>}{w.venue&&<span className="journal-venue">{w.venue}</span>}{w.rating!=null&&<span className="score-chip">{w.rating}</span>}</div></>;
  if(selecting)return <button type="button" className={className} aria-pressed={selected} aria-label={`${selected?'Deselect':'Select'} ${w.producer} ${w.wineName}`} onClick={onToggle}>{content}</button>;
  return <div className={`journal-card-shell ${view==='grid'?'grid':'list'}`}><Link className={className} to={`/wines/${w.id}`}>{content}</Link><button type="button" className={`journal-favorite-button${w.favorite?' active':''}`} aria-pressed={w.favorite} aria-label={`${w.favorite?'Remove':'Add'} ${w.producer} ${w.wineName} ${w.favorite?'from':'to'} favorites`} disabled={favoriteBusy} onClick={()=>onFavorite(!w.favorite)}><AppIcon kind={w.favorite?'heart-filled':'heart'}/></button></div>;
}

export function LibraryPage(){
  const [params,setParams]=useSearchParams();
  const [data,setData]=useState<JournalWine[]>([]),[nextOffset,setNextOffset]=useState<number|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  // A URL that carries its own filters always wins, so a deep link or a link in
  // from Insights is never overridden by what was stored.
  const [restoreFilters]=useState(()=>params.toString()?'':savedJournalFilters());
  const restoring=Boolean(restoreFilters)&&!params.toString();
  const [view,setViewState]=useState<ViewMode>(initialView),[queryDraft,setQueryDraft]=useState(()=>params.get('query')??''),[refreshSeq,setRefreshSeq]=useState(0);
  const [selecting,setSelecting]=useState(false),[selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());
  const [favoriteBusy,setFavoriteBusy]=useState<Set<string>>(()=>new Set());
  const [batchOpen,setBatchOpen]=useState(false),[batchBusy,setBatchBusy]=useState(false),[batchError,setBatchError]=useState(''),[batchNotice,setBatchNotice]=useState('');
  const [changeEvent,setChangeEvent]=useState(false),[changeVenue,setChangeVenue]=useState(false),[eventValue,setEventValue]=useState(''),[venueValue,setVenueValue]=useState(''),[eventMixed,setEventMixed]=useState(false),[venueMixed,setVenueMixed]=useState(false);
  const rawOffset=Number(params.get('offset'))||0,currentOffset=Math.max(0,Math.floor(rawOffset/PAGE_SIZE)*PAGE_SIZE),currentPage=currentOffset/PAGE_SIZE+1;
  const queryKey=params.toString();
  const favoriteOnly=params.get('favorite')==='1';
  const selectedWines=useMemo(()=>data.filter(wine=>selectedIds.has(wine.id)),[data,selectedIds]);

  function update(k:string,v:string,replace=true){
    setParams(previous=>{const n=new URLSearchParams(previous);v?n.set(k,v):n.delete(k);n.delete('offset');return n},{replace});
  }
  function goToOffset(offset:number){
    const next=Math.max(0,Math.floor(offset/PAGE_SIZE)*PAGE_SIZE);
    setParams(previous=>{const n=new URLSearchParams(previous);next?n.set('offset',String(next)):n.delete('offset');return n},{replace:false});
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function setView(next:ViewMode){setViewState(next);try{window.localStorage.setItem('winelog-journal-view',next)}catch{}}
  function stopSelecting(){setSelecting(false);setSelectedIds(new Set());setBatchOpen(false);setBatchError('')}
  function toggleSelection(id:string){
    if(!selectedIds.has(id)&&selectedIds.size>=MAX_BATCH_SELECTION){setBatchError(`A single batch can update up to ${MAX_BATCH_SELECTION} wines.`);return}
    setBatchError('');setSelectedIds(previous=>{const next=new Set(previous);next.has(id)?next.delete(id):next.add(id);return next});
  }
  function selectAllOnPage(){
    const ids=data.slice(0,MAX_BATCH_SELECTION).map(w=>w.id);setSelectedIds(new Set(ids));
    setBatchError(data.length>MAX_BATCH_SELECTION?`Selected the first ${MAX_BATCH_SELECTION} wines on this page, which is the maximum for one batch.`:'');
  }
  function openBatchEditor(){
    if(!selectedWines.length)return;
    const event=sharedText(selectedWines.map(w=>w.tastingName)),venue=sharedText(selectedWines.map(w=>w.venue));
    setEventValue(event.mixed?'':event.value);setVenueValue(venue.mixed?'':venue.value);setEventMixed(event.mixed);setVenueMixed(venue.mixed);
    setChangeEvent(false);setChangeVenue(false);setBatchError('');setBatchOpen(true);
  }
  async function toggleFavorite(wine:JournalWine,next:boolean){
    if(favoriteBusy.has(wine.id))return;
    setError('');setFavoriteBusy(previous=>new Set(previous).add(wine.id));
    setData(previous=>previous.map(item=>item.id===wine.id?{...item,favorite:next}:item));
    try{
      await setWineFavorite(wine.id,next);
      if(favoriteOnly&&!next)setRefreshSeq(value=>value+1);
    }catch(e){
      setData(previous=>previous.map(item=>item.id===wine.id?{...item,favorite:wine.favorite}:item));setError((e as Error).message);
    }finally{setFavoriteBusy(previous=>{const copy=new Set(previous);copy.delete(wine.id);return copy})}
  }

  useEffect(()=>{
    if(restoring)return;
    try{window.sessionStorage.setItem(JOURNAL_FILTER_KEY,queryKey)}catch{}
  },[queryKey,restoring]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>{if((params.get('query')??'')!==queryDraft)update('query',queryDraft)},350);
    return()=>window.clearTimeout(timer);
  },[queryDraft]);

  useEffect(()=>{
    if(restoring)return;
    const controller=new AbortController();
    setLoading(true);setError('');setData([]);setNextOffset(null);setSelectedIds(new Set());setSelecting(false);setBatchOpen(false);
    listWines(params,{limit:PAGE_SIZE,offset:currentOffset,signal:controller.signal})
      .then(result=>{setData(result.items);setNextOffset(result.nextOffset)})
      .catch(e=>{if(e?.name!=='AbortError')setError(e.message)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[queryKey,refreshSeq,restoring]);

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
  const renderItems=(items:JournalWine[])=><div className={collectionClass}>{items.map(w=><WineCard wine={w} view={view} selecting={selecting} selected={selectedIds.has(w.id)} onToggle={()=>toggleSelection(w.id)} onFavorite={next=>void toggleFavorite(w,next)} favoriteBusy={favoriteBusy.has(w.id)} key={w.id}/>)}</div>;
  const hasPrevious=currentOffset>0,hasNext=nextOffset!=null;

  if(restoring)return <Navigate to={{pathname:'/journal',search:restoreFilters}} replace/>;

  return <section className="journal-page">
    <div className="hero journal-hero"><p className="eyebrow">YOUR JOURNAL</p><h1>Wines worth remembering.</h1><p>Search by bottle, place or tasting and keep every drinking experience together.</p></div>
    <div className="journal-scope-tabs" role="tablist" aria-label="Journal scope"><button type="button" role="tab" aria-selected={!favoriteOnly} className={!favoriteOnly?'active':''} onClick={()=>update('favorite','')}>All wines</button><button type="button" role="tab" aria-selected={favoriteOnly} className={favoriteOnly?'active':''} onClick={()=>update('favorite','1')}>♥ Favorites</button></div>
    <form className="filters journal-filters" onSubmit={e=>e.preventDefault()}><label className="search">Search<input aria-label="Search wines" type="search" value={queryDraft} onChange={e=>setQueryDraft(e.target.value)} placeholder="Search wines, makers, regions…"/></label><div className="filter-pills"><label className="filter-month">Month<input type="month" aria-label="Drinking month" value={params.get('month')??''} onChange={e=>update('month',e.target.value)}/></label><label>Tasting<input value={params.get('tasting')??''} onChange={e=>update('tasting',e.target.value)} placeholder="Tasting / event"/></label><label>Country<input value={params.get('country')??''} onChange={e=>update('country',e.target.value)} placeholder="Country"/></label><label>Style<select value={params.get('style')??''} onChange={e=>update('style',e.target.value)}><option value="">Style</option>{['red','white','rose','sparkling','dessert','fortified','orange'].map(x=><option key={x}>{x}</option>)}</select></label><label>Score<input type="number" min="0" max="100" value={params.get('rating')??''} onChange={e=>update('rating',e.target.value)} placeholder="Score"/></label><label>Sort<select value={sort} onChange={e=>update('sort',e.target.value)}><option value="newest">Newest drinking date</option><option value="oldest">Oldest drinking date</option><option value="rating">Rating</option><option value="producer">Producer</option><option value="vintage">Vintage</option></select></label></div></form>
    {batchNotice&&<p className="journal-batch-notice" role="status">{batchNotice}</p>}
    {batchError&&!batchOpen&&<p className="journal-page-error" role="alert">{batchError}</p>}
    <div className={`journal-viewbar${selecting?' selecting':''}`}><span>{selecting?`${selectedIds.size} selected`:data.length?`Page ${currentPage} · ${data.length} wine${data.length===1?'':'s'}`:(favoriteOnly?'Favorites':'Journal')}</span>{selecting?<div className="journal-selection-actions"><button type="button" onClick={selectAllOnPage} disabled={!data.length}>Select all on page</button><button type="button" onClick={()=>setSelectedIds(new Set())} disabled={!selectedIds.size}>Clear</button><button type="button" className="primary" onClick={openBatchEditor} disabled={!selectedIds.size}>Edit event / venue</button><button type="button" onClick={stopSelecting} className="quiet">Done</button></div>:<div className="journal-view-actions"><button type="button" className="journal-select-toggle" onClick={()=>{setSelecting(true);setBatchNotice('')}} disabled={!data.length}>Select</button><div className="journal-view-toggle" role="group" aria-label="Journal layout"><button type="button" className={view==='list'?'active':''} aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button><button type="button" className={view==='grid'?'active':''} aria-pressed={view==='grid'} onClick={()=>setView('grid')}>Grid</button></div></div>}</div>
    {loading?<p aria-live="polite">Pouring your collection…</p>:error&&!data.length?<p role="alert">{error}</p>:data.length?(chronological?<div className="journal-months">{groups.map(group=><section className="journal-month" key={group.key}><h2 className="journal-month-heading">{monthLabel(group.key)}</h2>{renderItems(group.items)}</section>)}</div>:renderItems(data)):favoriteOnly?<div className="empty favorite-empty"><span><AppIcon kind="heart"/></span><h2>No favorite wines yet</h2><p>Tap the heart on a Journal card or wine page to keep special bottles here.</p><button type="button" onClick={()=>update('favorite','')}>Show all wines</button></div>:<div className="empty"><span><AppIcon kind="journal"/></span><h2>Your journal is empty</h2><p>Scan a bottle label to add your first wine.</p><Link className="button" to="/upload">Scan Wine</Link></div>}
    {error&&data.length>0&&<p className="journal-page-error" role="alert">{error}</p>}
    {(hasPrevious||hasNext)&&<nav className="journal-pagination" aria-label="Journal pages"><button type="button" disabled={!hasPrevious||loading} onClick={()=>goToOffset(currentOffset-PAGE_SIZE)}>← Previous</button><div><strong>Page {currentPage}</strong><span>{PAGE_SIZE} wines per page</span></div><button type="button" disabled={!hasNext||loading} onClick={()=>goToOffset(nextOffset??currentOffset+PAGE_SIZE)}>Next →</button></nav>}
    {batchOpen&&<div className="journal-batch-backdrop" role="presentation" onClick={()=>{if(!batchBusy)setBatchOpen(false)}}><div className="journal-batch-sheet" role="dialog" aria-modal="true" aria-labelledby="journal-batch-title" onClick={e=>e.stopPropagation()}><div className="journal-batch-heading"><div><p className="eyebrow">BATCH UPDATE</p><h2 id="journal-batch-title">{selectedIds.size} wine{selectedIds.size===1?'':'s'} selected</h2></div><button type="button" className="journal-batch-close" onClick={()=>setBatchOpen(false)} disabled={batchBusy} aria-label="Close batch editor">×</button></div><p>Enable only the fields you want to change. An enabled blank field clears that value; unchecked fields stay untouched.</p><label className="journal-batch-toggle"><input type="checkbox" checked={changeEvent} onChange={e=>setChangeEvent(e.target.checked)}/><span>Change tasting / event group</span></label><input className="journal-batch-input" type="text" value={eventValue} onChange={e=>setEventValue(e.target.value)} disabled={!changeEvent} placeholder={eventMixed?'Mixed events — enter replacement':'Event name; blank clears'}/><label className="journal-batch-toggle"><input type="checkbox" checked={changeVenue} onChange={e=>setChangeVenue(e.target.checked)}/><span>Change venue</span></label><input className="journal-batch-input" type="text" value={venueValue} onChange={e=>setVenueValue(e.target.value)} disabled={!changeVenue} placeholder={venueMixed?'Mixed venues — enter replacement':'Venue; blank clears'}/>{batchError&&<p className="journal-page-error" role="alert">{batchError}</p>}<div className="journal-batch-actions"><button type="button" onClick={()=>setBatchOpen(false)} disabled={batchBusy}>Cancel</button><button type="button" className="primary" onClick={submitBatch} disabled={batchBusy||(!changeEvent&&!changeVenue)}>{batchBusy?'Updating…':`Update ${selectedIds.size} wine${selectedIds.size===1?'':'s'}`}</button></div></div></div>}
  </section>
}
