import { useEffect,useRef,useState,type ReactNode } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { deleteWine,getWine,getWineDeepSearchStatus,setWineFavorite,startWineDeepSearch,type WineDetail,type WineResearchRun } from './api';
import { WineImage } from './WineImage';
import '../../deepSearch.css';
import '../../favorites.css';

type DeepState='idle'|'confirm-usage'|'confirm-final'|'running'|'error';
const deepStage:Record<WineResearchRun['stage'],string>={queued:'Queued for background research',researching:'Researching with Gemini 3.7 Flash',saving:'Saving Deep Search result',complete:'Research complete',failed:'Research failed'};

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
 const {id=''}=useParams(),nav=useNavigate(),[wine,setWine]=useState<WineDetail>(),[favoriteBusy,setFavoriteBusy]=useState(false),[deepState,setDeepState]=useState<DeepState>('idle'),[deepError,setDeepError]=useState(''),[deepRun,setDeepRun]=useState<WineResearchRun|null>(null),[deepElapsed,setDeepElapsed]=useState(0),[deepNotice,setDeepNotice]=useState(''),[selectedImage,setSelectedImage]=useState<string>();
 const pollRef=useRef<number|undefined>(undefined),clockRef=useRef<number|undefined>(undefined);
 function stopDeepTimers(){if(pollRef.current)window.clearInterval(pollRef.current);if(clockRef.current)window.clearInterval(clockRef.current);pollRef.current=undefined;clockRef.current=undefined}
 async function reloadWine(){const next=await getWine(id);setWine(next);return next}
 function watchDeepSearch(run:WineResearchRun){
  stopDeepTimers();setDeepRun(run);setDeepState(run.status==='running'?'running':run.status==='failed'?'error':'idle');
  const started=Date.parse(run.startedAt);setDeepElapsed(Number.isFinite(started)?Math.max(0,Math.floor((Date.now()-started)/1000)):0);
  if(run.status!=='running')return;
  clockRef.current=window.setInterval(()=>setDeepElapsed(Number.isFinite(started)?Math.max(0,Math.floor((Date.now()-started)/1000)):0),1000);
  const poll=async()=>{
   const next=await getWineDeepSearchStatus(id,run.requestId).catch(()=>null);if(!next)return;setDeepRun(next);
   if(next.status==='running')return;
   stopDeepTimers();setDeepElapsed(next.durationMs!=null?Math.floor(next.durationMs/1000):deepElapsed);
   if(next.status==='complete'){await reloadWine().catch(()=>undefined);setDeepState('idle');setDeepError('');setDeepNotice(`Deep Search completed${next.durationMs!=null?` in ${(next.durationMs/1000).toFixed(1)}s`:''}.`)}
   else{setDeepError(`${next.message||'The background Deep Search failed.'} · Request ${next.requestId}`);setDeepState('error')}
  };
  pollRef.current=window.setInterval(()=>void poll(),2000);void poll();
 }
 useEffect(()=>{
  let active=true;
  Promise.all([getWine(id),getWineDeepSearchStatus(id).catch(()=>null)]).then(([next,run])=>{if(!active)return;setWine(next);if(run?.status==='running')watchDeepSearch(run)}).catch(()=>undefined);
  return()=>{active=false;stopDeepTimers()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 async function runDeepSearch(){
  setDeepState('running');setDeepError('');setDeepNotice('');
  try{
   const accepted=await startWineDeepSearch(id,wine?.deepSearch?'vintage':'none');const run=await getWineDeepSearchStatus(id,accepted.researchRequestId);
   if(run)watchDeepSearch(run);else setDeepNotice('Deep Search has been queued in the background. You can leave this page safely.');
  }catch(e){setDeepError((e as Error).message);setDeepState('error')}
 }
 async function toggleFavorite(){
  if(!wine||favoriteBusy)return;const next=!wine.favorite;setFavoriteBusy(true);setWine({...wine,favorite:next});
  try{await setWineFavorite(id,next)}catch(e){setWine(current=>current?{...current,favorite:!next}:current);setDeepNotice((e as Error).message)}finally{setFavoriteBusy(false)}
 }
 if(!wine)return <p aria-live="polite">Loading wine…</p>;
 const blend=wine.grapeBlend.length?wine.grapeBlend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`):wine.grapes;
 const deep=wine.deepSearch;
 return <article className="detail wine-detail"><Link className="back-pill" to="/">← Journal</Link>
  <section className="wine-identity">
   {wine.imageIds.length?<div className="detail-gallery" aria-label={`${wine.wineName} photos`}>{wine.imageIds.map((imageId,index)=><button type="button" className="detail-photo-button" key={imageId} onClick={()=>setSelectedImage(imageId)} aria-label={`Open photo ${index+1} of ${wine.imageIds.length}`}><WineImage imageId={imageId} alt={`${wine.producer} ${wine.wineName} photo ${index+1}`} className="detail-photo"/></button>)}</div>:<div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producerId?<Link className="detail-producer-link" to={`/producers/${wine.producerId}`}>{wine.producer}</Link>:wine.producer}</h2><div className="detail-favorite-row"><button type="button" className={`detail-favorite-button${wine.favorite?' active':''}`} aria-pressed={wine.favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><span className="heart" aria-hidden="true">{wine.favorite?'♥':'♡'}</span>{wine.favorite?'Favorite':'Add to favorites'}</button></div><div className="detail-pills">{wine.appellation&&<span>{wine.appellation}</span>}{blend.map(g=><span key={g}>{g}</span>)}{wine.rating!=null&&<strong>{wine.rating} / 100</strong>}</div>
  </section>
  {wine.tastingNotes&&<section className="detail-section"><p className="section-label">SENSORY NOTES</p><blockquote>{wine.tastingNotes}</blockquote></section>}
  <section className="detail-section"><p className="section-label">WINE DETAILS</p><dl>{[['Region',[wine.region,wine.country].filter(Boolean).join(', ')],['Appellation',wine.appellation],['Grapes / blend',blend.join(', ')],['Alcohol',wine.alcoholPercentage&&`${wine.alcoholPercentage}%`]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  <section className="detail-section deep-search-panel"><p className="section-label">DEEP SEARCH</p>{deep?<><div className="deep-summary"><ResearchText text={deep.summary}/></div><div className="deep-research-sections">{[['Vintage quality',deep.vintageQuality],['Producer',deep.producerDetails],['Producer-wide practices',deep.producerWinemakingPractices],['This wine / vintage winemaking',deep.winemakingTechniques],['Terroir',deep.terroir],['Drinking window',deep.drinkingWindow]].filter(x=>x[1]).map(([k,v])=><section className="deep-research-section" key={String(k)}><h3>{k}</h3><ResearchText text={String(v)}/>{k==='Producer-wide practices'&&<small>General domaine context; not automatically treated as verified for this exact vintage.</small>}</section>)}</div>{deep.sources.length>0&&<div className="deep-sources"><strong>Sources</strong>{deep.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}<small>Latest research model: {deep.model} · {new Date(deep.researchedAt).toLocaleDateString()} · reusable research is stored permanently</small></>:<p>Enrich this wine with grounded research. WineLog reuses stored producer practices, terroir and vintage research whenever the scope matches.</p>}
   {deepNotice&&<p className="producer-notice" role="status">{deepNotice}</p>}
   {deepState==='idle'&&<button type="button" onClick={()=>setDeepState('confirm-usage')}>{deep?'Refresh vintage research':'Deep Search'}</button>}
   {deepState==='confirm-usage'&&<div className="deep-confirm"><p>{deep?'This refresh keeps cached producer-wide practices and stable terroir research, and re-runs only vintage-sensitive research for this wine.':'WineLog checks permanent caches first and queues Gemini 3.7 Flash with Google Search only for missing research scopes.'} The background job continues even if you close WineLog. API usage may be incurred. Continue?</p><button type="button" onClick={()=>setDeepState('confirm-final')}>Continue</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}
   {deepState==='confirm-final'&&<div className="deep-confirm"><p>{deep?'Final confirmation: queue refreshed vintage context and exact wine-vintage research now?':'Final confirmation: queue this wine’s grounded Deep Search now?'}</p><button type="button" onClick={runDeepSearch}>{deep?'Queue vintage refresh':'Queue Deep Search'}</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}
   {deepState==='running'&&<div className="deep-running" role="status"><span className="deep-spinner" aria-hidden="true"/><div><strong>{deepRun?deepStage[deepRun.stage]:'Queueing Deep Search…'}</strong><p>{deepRun?.message||'Preparing the background job.'}</p><small>{deepElapsed}s{deepRun?` · Request ${deepRun.requestId}`:''}</small><p>You can leave this page or close WineLog. The Queue continues independently and the saved result will appear when you return.</p></div></div>}
   {deepState==='error'&&<div className="deep-error" role="alert"><strong>Deep Search did not complete.</strong><p>{deepError||deepRun?.message||'The background research job failed before a result was saved.'}</p><button type="button" onClick={runDeepSearch}>Retry Deep Search</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Close</button></div>}
  </section>
  <section className="detail-section experience-panel"><p className="section-label">YOUR EXPERIENCE</p><dl>{[['Drinking date',wine.tastingDate],['Tasting / event',wine.tastingName],['Venue',wine.venue],['Location',wine.locationName]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section><p>{wine.tags.map(t=><span className="tag" key={t}>#{t}</span>)}</p><div className="actions"><Link className="button" to={`/wines/${id}/edit`}>Edit tasting</Link><button className="danger secondary-danger" onClick={async()=>{if(confirm('Delete this wine?')){await deleteWine(id);nav('/')}}}>Delete</button></div>
  {selectedImage&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Wine photo viewer" onClick={()=>setSelectedImage(undefined)}><button type="button" className="lightbox-close" aria-label="Close photo" onClick={()=>setSelectedImage(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><WineImage imageId={selectedImage} alt={`${wine.producer} ${wine.wineName} full-resolution photo`} className="lightbox-image"/></div></div>}
 </article>
}
