import { useCallback,useEffect,useMemo,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { pourFamily } from '../../lib/wine/pourFamily';
import { bottleLabel,listCellar,removeHolding,updateHolding,type CellarHolding } from './api';
import { AddToCellarSheet } from './AddToCellarSheet';

const PAGE_SIZE=36;
const SORTS:Array<[string,string]>=[['vintage','Vintage, newest'],['oldestVintage','Vintage, oldest'],['producer','Producer'],['bottles','Most bottles'],['added','Recently added'],['purchased','Recently bought']];

/**
 * Bottles you hold.
 *
 * A scope of the Journal rather than a page of its own, because it is the same
 * list of wine identities with the same search, filters and pagination - but it
 * is a different query over a different table, and the two sets never appear
 * together. A holding is not a wine you drank, and the tabs are the promise
 * that it will never be shown as though it were.
 *
 * What it does not inherit is everything about drinking: no month grouping, no
 * score filter, no "newest drinking date" sort. A holding has no drinking date
 * to sort on, so the default is the vintage.
 */
export function CellarScope(){
  const [params,setParams]=useSearchParams();
  const navigate=useNavigate();
  const [items,setItems]=useState<CellarHolding[]>([]);
  const [total,setTotal]=useState(0),[bottles,setBottles]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [adding,setAdding]=useState(false),[busyId,setBusyId]=useState('');
  const [reloadSeq,setReloadSeq]=useState(0);

  const offset=Math.max(Number(params.get('offset'))||0,0);
  const query=useMemo(()=>{
    const next=new URLSearchParams();
    for(const key of ['query','country','region','style','vintage','location','sort'])
      {const value=params.get(key);if(value)next.set(key,value)}
    return next;
  },[params]);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    listCellar(query,{limit:PAGE_SIZE,offset,signal:controller.signal})
      .then(page=>{setItems(page.items);setTotal(page.total);setBottles(page.bottles)})
      .catch(e=>{if((e as Error).name!=='AbortError')setError((e as Error).message||'Could not load your cellar')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[query,offset,reloadSeq]);

  const update=useCallback((key:string,value:string)=>{
    const next=new URLSearchParams(params);
    if(value)next.set(key,value);else next.delete(key);
    if(key!=='offset')next.delete('offset');
    setParams(next,{replace:true});
  },[params,setParams]);

  async function take(holding:CellarHolding){
    // Straight into the wine form, carrying the identity and the holding. The
    // bottle is only taken when that form is saved, so backing out costs
    // nothing - see the wine POST.
    const prefill=new URLSearchParams({holding:holding.id});
    navigate(`/wines/new?${prefill}`);
  }

  async function drop(holding:CellarHolding){
    if(!window.confirm(`Remove ${holding.bottles} bottle${holding.bottles===1?'':'s'} of ${holding.wineName} from your cellar? This does not log a tasting.`))return;
    setBusyId(holding.id);
    try{await removeHolding(holding.id);setReloadSeq(seq=>seq+1)}
    catch(e){setError((e as Error).message||'Could not remove those bottles')}
    finally{setBusyId('')}
  }

  async function adjust(holding:CellarHolding,delta:number){
    const next=holding.bottles+delta;
    if(next<0)return;
    setBusyId(holding.id);
    try{await updateHolding(holding.id,{bottles:next});setReloadSeq(seq=>seq+1)}
    catch(e){setError((e as Error).message||'Could not update those bottles')}
    finally{setBusyId('')}
  }

  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE)),page=Math.floor(offset/PAGE_SIZE)+1;
  return <>
    <form className="filters journal-filters cellar-filters" onSubmit={event=>event.preventDefault()}>
      <input className="cellar-search" type="search" value={params.get('query')??''} onChange={event=>update('query',event.target.value)} placeholder="Producer, wine or appellation" aria-label="Search your cellar"/>
      <div className="filter-pills">
        <label>Country<input value={params.get('country')??''} onChange={event=>update('country',event.target.value)} placeholder="Country"/></label>
        <label>Style<select value={params.get('style')??''} onChange={event=>update('style',event.target.value)}><option value="">Style</option>{['red','white','rose','sparkling','dessert','fortified','orange'].map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Vintage<input inputMode="numeric" value={params.get('vintage')??''} onChange={event=>update('vintage',event.target.value)} placeholder="Vintage"/></label>
        <label>Where<input value={params.get('location')??''} onChange={event=>update('location',event.target.value)} placeholder="Rack or case"/></label>
        <label>Sort<select value={params.get('sort')??'vintage'} onChange={event=>update('sort',event.target.value)}>{SORTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      </div>
    </form>

    <div className="journal-viewbar cellar-viewbar">
      <span>{loading&&!items.length?'Opening the cellar…':`${total} wine${total===1?'':'s'} · ${bottles} bottle${bottles===1?'':'s'}`}</span>
      <button type="button" className="primary cellar-add-trigger" onClick={()=>setAdding(true)}>Add bottles</button>
    </div>

    {error&&<p className="journal-page-error" role="alert">{error}</p>}

    {!loading&&!items.length&&!error
      ?<div className="empty cellar-empty">
        <h2>Nothing put away yet</h2>
        <p>Bottles you add here stay out of your journal, and out of every statistic, until you open one.</p>
        <button type="button" onClick={()=>setAdding(true)}>Add bottles</button>
      </div>
      :<div className="cellar-list">{items.map(holding=><article className="cellar-card" key={holding.id}>
        <div className={`bottle bottle-${pourFamily(holding.wineStyle)}`} aria-hidden="true">{holding.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>
        <div className="cellar-card-body">
          <div className="cellar-card-top"><h2>{holding.wineName}</h2><strong>{holding.vintage??'NV'}</strong></div>
          <p className="producer">{holding.producer}</p>
          <span className="cellar-meta">{[holding.appellation,holding.region,holding.country].filter(Boolean).join(' · ')}</span>
          <span className="cellar-bottles">{bottleLabel(holding)}</span>
          {holding.location&&<span className="cellar-location">{holding.location}</span>}
        </div>
        <div className="cellar-card-actions">
          <button type="button" className="primary" disabled={busyId===holding.id} onClick={()=>void take(holding)}>Open a bottle</button>
          <div className="cellar-count-actions">
            <button type="button" className="quiet" disabled={busyId===holding.id||holding.bottles<=1} onClick={()=>void adjust(holding,-1)} aria-label={`One fewer bottle of ${holding.wineName}`}>−</button>
            <button type="button" className="quiet" disabled={busyId===holding.id} onClick={()=>void adjust(holding,1)} aria-label={`One more bottle of ${holding.wineName}`}>+</button>
            <button type="button" className="quiet cellar-drop" disabled={busyId===holding.id} onClick={()=>void drop(holding)}>Remove</button>
          </div>
        </div>
      </article>)}</div>}

    {total>PAGE_SIZE&&<nav className="journal-pagination" aria-label="Cellar pages">
      <button type="button" disabled={offset<=0||loading} onClick={()=>update('offset',String(Math.max(0,offset-PAGE_SIZE)))}>← Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button type="button" disabled={offset+PAGE_SIZE>=total||loading} onClick={()=>update('offset',String(offset+PAGE_SIZE))}>Next →</button>
    </nav>}

    {adding&&<AddToCellarSheet onClose={()=>setAdding(false)} onAdded={()=>{setAdding(false);setReloadSeq(seq=>seq+1)}}/>}
  </>;
}
