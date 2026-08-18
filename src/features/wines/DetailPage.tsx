import { useEffect,useState,type ReactNode } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import type { DeepSearchResult,WineRecord } from '../../lib/db/schema';
import { deleteWine,getWine } from './api';
import { WineImage } from './WineImage';
import '../../deepSearch.css';

const token=()=>`Bearer ${localStorage.getItem('session')??''}`;
type DeepState='idle'|'confirm-usage'|'confirm-final'|'running'|'error';

function ResearchText({text}:{text:string}){
 const nodes:ReactNode[]=[];
 const lines=text.trim().split(/\r?\n/);
 let paragraph:string[]=[],bullets:string[]=[];
 const flushParagraph=()=>{if(paragraph.length){nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(' ')}</p>);paragraph=[]}};
 const flushBullets=()=>{if(bullets.length){nodes.push(<ul key={`u-${nodes.length}`}>{bullets.map((item,index)=><li key={index}>{item}</li>)}</ul>);bullets=[]}};
 for(const raw of lines){
  const line=raw.trim();
  if(!line){flushParagraph();flushBullets();continue}
  const bullet=line.match(/^[-•]\s+(.*)$/);
  if(bullet){flushParagraph();bullets.push(bullet[1]);continue}
  flushBullets();paragraph.push(line);
 }
 flushParagraph();flushBullets();
 return <div className="research-text">{nodes}</div>;
}

export function DetailPage(){
 const {id=''}=useParams(),nav=useNavigate(),[wine,setWine]=useState<WineRecord>(),[deepState,setDeepState]=useState<DeepState>('idle'),[deepError,setDeepError]=useState(''),[selectedImage,setSelectedImage]=useState<string>();
 useEffect(()=>{getWine(id).then(setWine)},[id]);
 async function runDeepSearch(){
  setDeepState('running');setDeepError('');
  try{
   const r=await fetch(`/api/wines/${id}/deep-search`,{method:'POST',headers:{Authorization:token(),'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh:wine?.deepSearch?'vintage':'none'})});
   const text=await r.text();
   let body:DeepSearchResult|{error?:string};
   try{body=JSON.parse(text) as DeepSearchResult|{error?:string}}catch{throw new Error(r.ok?'Deep Search returned an unreadable response':`Deep Search failed (${r.status})`)}
   if(!r.ok)throw new Error('error' in body&&body.error?body.error:`Deep Search failed (${r.status})`);
   setWine(w=>w?{...w,deepSearch:body as DeepSearchResult}:w);setDeepState('idle');
  }catch(e){setDeepError((e as Error).message);setDeepState('error')}
 }
 if(!wine)return <p aria-live="polite">Loading wine…</p>;
 const blend=wine.grapeBlend.length?wine.grapeBlend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`):wine.grapes;
 const deep=wine.deepSearch;
 return <article className="detail wine-detail"><Link className="back-pill" to="/">← Journal</Link>
  <section className="wine-identity">
   {wine.imageIds.length?<div className="detail-gallery" aria-label={`${wine.wineName} photos`}>{wine.imageIds.map((imageId,index)=><button type="button" className="detail-photo-button" key={imageId} onClick={()=>setSelectedImage(imageId)} aria-label={`Open photo ${index+1} of ${wine.imageIds.length}`}><WineImage imageId={imageId} alt={`${wine.producer} ${wine.wineName} photo ${index+1}`} className="detail-photo"/></button>)}</div>:<div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producer}</h2><div className="detail-pills">{wine.appellation&&<span>{wine.appellation}</span>}{blend.map(g=><span key={g}>{g}</span>)}{wine.rating!=null&&<strong>{wine.rating} / 100</strong>}</div>
  </section>
  {wine.tastingNotes&&<section className="detail-section"><p className="section-label">SENSORY NOTES</p><blockquote>{wine.tastingNotes}</blockquote></section>}
  <section className="detail-section"><p className="section-label">WINE DETAILS</p><dl>{[['Region',[wine.region,wine.country].filter(Boolean).join(', ')],['Appellation',wine.appellation],['Grapes / blend',blend.join(', ')],['Alcohol',wine.alcoholPercentage&&`${wine.alcoholPercentage}%`]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  <section className="detail-section deep-search-panel"><p className="section-label">DEEP SEARCH</p>{deep?<><div className="deep-summary"><ResearchText text={deep.summary}/></div><div className="deep-research-sections">{[['Vintage quality',deep.vintageQuality],['Producer',deep.producerDetails],['Winemaking',deep.winemakingTechniques],['Terroir',deep.terroir],['Drinking window',deep.drinkingWindow]].filter(x=>x[1]).map(([k,v])=><section className="deep-research-section" key={String(k)}><h3>{k}</h3><ResearchText text={String(v)}/></section>)}</div>{deep.sources.length>0&&<div className="deep-sources"><strong>Sources</strong>{deep.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}<small>Latest research model: {deep.model} · {new Date(deep.researchedAt).toLocaleDateString()} · reusable research is stored permanently</small></>:<p>Enrich this wine with grounded research. WineLog reuses stored producer, terroir and vintage research whenever the scope matches.</p>}
   {deepState==='idle'&&<button type="button" onClick={()=>setDeepState('confirm-usage')}>{deep?'Refresh vintage research':'Deep Search'}</button>}
   {deepState==='confirm-usage'&&<div className="deep-confirm"><p>{deep?'This refresh keeps cached producer and stable terroir research, and re-runs only vintage-sensitive research for this wine.':'WineLog checks the permanent cache first and uses Gemini 3.7 Flash with Google Search only for research scopes that are still missing.'} API usage may be incurred. Continue?</p><button type="button" onClick={()=>setDeepState('confirm-final')}>Continue</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}
   {deepState==='confirm-final'&&<div className="deep-confirm"><p>{deep?'Final confirmation: refresh the vintage context and exact wine-vintage research with Gemini 3.7 Flash now?':'Final confirmation: build this wine report from cached research plus any missing grounded Gemini 3.7 Flash research now?'}</p><button type="button" onClick={runDeepSearch}>{deep?'Refresh vintage research now':'Run Deep Search now'}</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}
   {deepState==='running'&&<div className="deep-running" role="status"><span className="deep-spinner" aria-hidden="true"/><div><strong>{deep?'Refreshing vintage research…':'Researching this wine…'}</strong><p>WineLog is reusing matching cached scopes and searching only what is missing or explicitly refreshed. Keep this page open; the result will appear here automatically.</p></div></div>}
   {deepState==='error'&&<div className="deep-error" role="alert"><strong>Deep Search did not complete.</strong><p>{deepError||'The research request failed before a result was saved.'}</p><button type="button" onClick={runDeepSearch}>Retry Deep Search</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Close</button></div>}
  </section>
  <section className="detail-section experience-panel"><p className="section-label">YOUR EXPERIENCE</p><dl>{[['Drinking date',wine.tastingDate],['Tasting / event',wine.tastingName],['Venue',wine.venue],['Location',wine.locationName]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section><p>{wine.tags.map(t=><span className="tag" key={t}>#{t}</span>)}</p><div className="actions"><Link className="button" to={`/wines/${id}/edit`}>Edit tasting</Link><button className="danger secondary-danger" onClick={async()=>{if(confirm('Delete this wine?')){await deleteWine(id);nav('/')}}}>Delete</button></div>
  {selectedImage&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Wine photo viewer" onClick={()=>setSelectedImage(undefined)}><button type="button" className="lightbox-close" aria-label="Close photo" onClick={()=>setSelectedImage(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><WineImage imageId={selectedImage} alt={`${wine.producer} ${wine.wineName} full-resolution photo`} className="lightbox-image"/></div></div>}
 </article>
}
