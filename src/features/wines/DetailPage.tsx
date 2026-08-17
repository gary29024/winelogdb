import { useEffect,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import type { DeepSearchResult,WineRecord } from '../../lib/db/schema';
import { deleteWine,getWine } from './api';

const token=()=>`Bearer ${localStorage.getItem('session')??''}`;
export function DetailPage(){
 const {id=''}=useParams(),nav=useNavigate(),[wine,setWine]=useState<WineRecord>(),[confirmStep,setConfirmStep]=useState(0),[deepBusy,setDeepBusy]=useState(false),[deepError,setDeepError]=useState('');
 useEffect(()=>{getWine(id).then(setWine)},[id]);
 async function runDeepSearch(){
  setDeepBusy(true);setDeepError('');
  try{
   const r=await fetch(`/api/wines/${id}/deep-search`,{method:'POST',headers:{Authorization:token(),'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH'})});
   const body=await r.json() as DeepSearchResult|{error?:string};
   if(!r.ok)throw new Error('error' in body&&body.error?body.error:'Deep Search failed');
   setWine(w=>w?{...w,deepSearch:body as DeepSearchResult}:w);setConfirmStep(0);
  }catch(e){setDeepError((e as Error).message)}finally{setDeepBusy(false)}
 }
 if(!wine)return <p aria-live="polite">Loading wine…</p>;
 const blend=wine.grapeBlend.length?wine.grapeBlend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`):wine.grapes;
 const deep=wine.deepSearch;
 return <article className="detail wine-detail"><Link className="back-pill" to="/">← Journal</Link>
  <section className="wine-identity"><div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div><p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producer}</h2><div className="detail-pills">{wine.appellation&&<span>{wine.appellation}</span>}{blend.map(g=><span key={g}>{g}</span>)}{wine.rating!=null&&<strong>{wine.rating} / 100</strong>}</div></section>
  {wine.tastingNotes&&<section className="detail-section"><p className="section-label">SENSORY NOTES</p><blockquote>{wine.tastingNotes}</blockquote></section>}
  <section className="detail-section"><p className="section-label">WINE DETAILS</p><dl>{[['Region',[wine.region,wine.country].filter(Boolean).join(', ')],['Appellation',wine.appellation],['Grapes / blend',blend.join(', ')],['Alcohol',wine.alcoholPercentage&&`${wine.alcoholPercentage}%`]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  <section className="detail-section deep-search-panel"><p className="section-label">DEEP SEARCH</p>{deep?<><p>{deep.summary}</p><dl>{[['Vintage quality',deep.vintageQuality],['Producer',deep.producerDetails],['Winemaking',deep.winemakingTechniques],['Terroir',deep.terroir],['Drinking window',deep.drinkingWindow]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{deep.sources.length>0&&<div className="deep-sources"><strong>Sources</strong>{deep.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}<small>Researched with {deep.model} · {new Date(deep.researchedAt).toLocaleDateString()}</small></>:<p>Enrich this wine with grounded research on the producer, vintage quality, terroir, winemaking and drinking window.</p>}
   {confirmStep===0&&<button type="button" onClick={()=>setConfirmStep(1)}>{deep?'Refresh Deep Search':'Deep Search'}</button>}
   {confirmStep===1&&<div className="deep-confirm"><p>This uses Gemini 3.6 Flash with Google Search and may incur API usage. Continue?</p><button type="button" onClick={()=>setConfirmStep(2)}>Continue</button><button type="button" className="secondary-danger" onClick={()=>setConfirmStep(0)}>Cancel</button></div>}
   {confirmStep===2&&<div className="deep-confirm"><p>Final confirmation: run grounded Deep Search for this exact wine now?</p><button type="button" disabled={deepBusy} onClick={runDeepSearch}>{deepBusy?'Researching…':'Run Deep Search now'}</button><button type="button" className="secondary-danger" disabled={deepBusy} onClick={()=>setConfirmStep(0)}>Cancel</button></div>}
   {deepError&&<p role="alert">{deepError}</p>}
  </section>
  <section className="detail-section experience-panel"><p className="section-label">YOUR EXPERIENCE</p><dl>{[['Drinking date',wine.tastingDate],['Tasting / event',wine.tastingName],['Venue',wine.venue],['Location',wine.locationName]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section><p>{wine.tags.map(t=><span className="tag" key={t}>#{t}</span>)}</p><div className="actions"><Link className="button" to={`/wines/${id}/edit`}>Edit tasting</Link><button className="danger secondary-danger" onClick={async()=>{if(confirm('Delete this wine?')){await deleteWine(id);nav('/')}}}>Delete</button></div>
 </article>
}
