import { useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { Link,useLocation,useNavigate,useParams } from 'react-router-dom';
import type { DeepSearchResult } from '../../lib/db/schema';
import { addWineImages,cancelWineDeepSearch,deleteWine,deleteWineImage,getWine,getWineDeepSearchStatus,setWineFavorite,startWineDeepSearch,type WineDetail,type WineResearchRun } from './api';
import { extractPhotoMetadata } from '../uploads/photoMetadata';
import { imageSize } from '../uploads/prepareImage';
import { WineImage } from './WineImage';
import { CellarStrip } from '../cellar/CellarStrip';
import { DrinkingWindow } from '../maturity/DrinkingWindow';
import { backTargetFromState,JOURNAL_BACK,readBackTarget,rememberBackTarget } from './backTarget';
import { GroupSourceImage } from '../uploads/GroupSourceImage';
import { structureValueLabel } from '../../lib/wine/tastingStructure';
import { resolvePlace } from '../../lib/places/resolve';
import '../../deepSearch.css';
import '../../favorites.css';
import '../../wineFormCompact.css';
import '../../groupSource.css';
import '../../wineClassification.css';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { AppIcon } from '../../components/AppIcons';
import { ElapsedSeconds } from '../../components/ElapsedSeconds';

type DeepState='idle'|'confirm-usage'|'running'|'error';
type DeepField='summary'|'vintageQuality'|'producerDetails'|'producerWinemakingPractices'|'winemakingTechniques'|'terroir'|'drinkingWindow';
const deepStage:Record<WineResearchRun['stage'],string>={queued:'Queued for background research',researching:'Researching with Gemini 3.7 Flash',saving:'Saving Deep Search result',complete:'Research complete',failed:'Research failed'};
const claimStatusLabel={supported:'Direct support',partial:'Partial support',unsupported:'No direct citation',uncertainty:'Explicit uncertainty',conflicting:'Conflicting sources'} as const;
const DEEP_FIELDS:DeepField[]=['summary','vintageQuality','producerDetails','producerWinemakingPractices','winemakingTechniques','terroir','drinkingWindow'];
const DEEP_OPEN_FIELDS_KEY='winelog.deepSearch.openFields';
function readOpenDeepFields():Set<DeepField>{
 try{
  const raw=window.localStorage.getItem(DEEP_OPEN_FIELDS_KEY);if(!raw)return new Set();
  const parsed=JSON.parse(raw) as unknown;
  return new Set(Array.isArray(parsed)?parsed.filter((x):x is DeepField=>DEEP_FIELDS.includes(x as DeepField)):[]);
 }catch{return new Set()}
}
function writeOpenDeepFields(next:Set<DeepField>){try{window.localStorage.setItem(DEEP_OPEN_FIELDS_KEY,JSON.stringify([...next]))}catch{/* storage unavailable */}}

function sourceHost(url:string){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}
/** Gemini grounding often gives no page title, so several links on one host all
 * render as the bare hostname. Falling back to the last path segment turns
 * "wine.com / wine.com / wine.com" into three links a reader can tell apart. */
function sourceLinkLabel(source:{title:string;url:string},host:string){
 const title=source.title?.trim();
 if(title&&title.toLowerCase().replace(/^www\./,'')!==host)return title;
 try{
  const segments=new URL(source.url).pathname.split('/').filter(Boolean),last=segments[segments.length-1];
  const decoded=last?decodeURIComponent(last).replace(/\.(?:html?|php|aspx?)$/i,'').replace(/[-_]+/g,' ').trim():'';
  if(decoded)return decoded;
 }catch{/* fall through to host */}
 return host||title||source.url;
}


function wineSearcherUrl(producer:string,wineName:string,vintage:number|null|undefined){const query=[producer,wineName,vintage!=null?String(vintage):''].map(x=>String(x).trim()).filter(Boolean).join(' ');return `https://www.wine-searcher.com/find/${encodeURIComponent(query).replace(/%20/g,'+')}`}
function formatPrice(price:number|null|undefined,currency:string|null|undefined){if(price==null)return null;const amount=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(price);return currency?`${currency} ${amount}`:amount}
function ResearchText({text}:{text:string}){
 const nodes:ReactNode[]=[],lines=text.trim().split(/\r?\n/);let paragraph:string[]=[],bullets:string[]=[];
 const flushParagraph=()=>{if(paragraph.length){nodes.push(<p key={`p-${nodes.length}`}>{paragraph.join(' ')}</p>);paragraph=[]}},flushBullets=()=>{if(bullets.length){nodes.push(<ul key={`u-${nodes.length}`}>{bullets.map((item,index)=><li key={index}>{item}</li>)}</ul>);bullets=[]}};
 for(const raw of lines){const line=raw.trim();if(!line){flushParagraph();flushBullets();continue}const bullet=line.match(/^[-•]\s+(.*)$/);if(bullet){flushParagraph();bullets.push(bullet[1]);continue}flushBullets();paragraph.push(line)}flushParagraph();flushBullets();return <div className="research-text">{nodes}</div>;
}
const qualityWarningLabel:Record<string,string>={
 'missing-field':'a research field came back empty',
 'no-grounding-source':'no web source backed part of this research',
 'wrong-vintage-reference':'a year other than this vintage was asserted',
 'general-practice-presented-as-exact-vintage':'a general domaine habit was read as exact-vintage technique',
 'vintage-specific-detail-in-producer-scope':'a vintage-specific detail appeared in producer-wide practices',
 'cross-source-technical-conflict':'sources disagree on an exact technical value'
};
const qualityStatusLabel:Record<string,string>={verified:'Verified',mixed:'Mixed confidence',limited:'Limited confidence'};

function ResearchQuality({deep}:{deep:DeepSearchResult}){
 const quality=deep.quality;if(!quality)return null;
 return <div className={`deep-quality ${quality.status}`}>
  <div className="deep-quality-head"><strong>{qualityStatusLabel[quality.status]??quality.status}</strong><span>{quality.score}/100 · best source tier: {quality.sourceTier}</span></div>
  {quality.warnings.length>0&&<ul>{quality.warnings.map(warning=><li key={warning}>{qualityWarningLabel[warning]??warning}</li>)}</ul>}
 </div>;
}

function DeepSources({sources}:{sources:DeepSearchResult['sources']}){
 const groups=useMemo(()=>{
  const map=new Map<string,typeof sources>();
  for(const source of sources){const host=sourceHost(source.url)||'other sources',list=map.get(host)??[];list.push(source);map.set(host,list)}
  return [...map.entries()].sort(([,a],[,b])=>b.length-a.length);
 },[sources]);
 if(!sources.length)return null;
 return <details className="deep-sources"><summary>{sources.length} source{sources.length===1?'':'s'} · {groups.length} site{groups.length===1?'':'s'}</summary>
  <div className="deep-sources-list">{groups.map(([host,items])=><div className="deep-source-group" key={host}><strong>{host}</strong>{items.map(item=><a key={item.url} href={item.url} target="_blank" rel="noreferrer">{sourceLinkLabel(item,host)}</a>)}</div>)}</div>
 </details>;
}

function ClaimEvidence({deep,field}:{deep:DeepSearchResult;field:DeepField}){
 const evidence=deep.provenance?.fields[field];if(!evidence?.claims.length)return null;
 return <details className="claim-evidence"><summary>Evidence · {evidence.supportedCount} direct{evidence.conflictingCount?` · ${evidence.conflictingCount} disputed`:''}{evidence.partialCount?` · ${evidence.partialCount} partial`:''}{evidence.unsupportedCount?` · ${evidence.unsupportedCount} unsupported`:''}{evidence.uncertaintyCount?` · ${evidence.uncertaintyCount} uncertain`:''}</summary><ol>{evidence.claims.map((item,index)=><li key={`${field}-${index}`}><div className="claim-evidence-head"><span className={`claim-status ${item.supportStatus}`}>{claimStatusLabel[item.supportStatus]}</span>{item.sourceTier!=='none'&&<span className="claim-tier">{item.sourceTier}</span>}</div><p>{item.claim}</p>{item.sources.length>0&&<div className="claim-links">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</li>)}</ol><small>Direct evidence uses Gemini grounding segments mapped to the individual claim. “No direct citation” means the overall research may be grounded, but WineLog could not deterministically tie that statement to a specific grounding segment. “Conflicting sources” means independently grounded source-specific values disagree, so WineLog preserves the dispute instead of choosing one figure.</small></details>;
}

const classificationLabel:Record<string,string>={grand_cru:'Grand Cru',premier_cru:'Premier Cru',village:'Village'};

export function DetailPage(){
 const {id=''}=useParams(),nav=useNavigate(),{state}=useLocation(),[wine,setWine]=useState<WineDetail>(),[favoriteBusy,setFavoriteBusy]=useState(false),[deepState,setDeepState]=useState<DeepState>('idle'),[deepError,setDeepError]=useState(''),[deepRun,setDeepRun]=useState<WineResearchRun|null>(null),[deepNotice,setDeepNotice]=useState(''),[deepCancelling,setDeepCancelling]=useState(false),[selectedImage,setSelectedImage]=useState<string>(),[selectedGroupSource,setSelectedGroupSource]=useState<string>(),[openDeepFields,setOpenDeepFields]=useState<Set<DeepField>>(readOpenDeepFields),[photoBusy,setPhotoBusy]=useState(false),[photoError,setPhotoError]=useState('');
 const photoInput=useRef<HTMLInputElement|null>(null);
 const pollRef=useRef<Poller|undefined>(undefined);
 function stopDeepTimers(){pollRef.current?.stop();pollRef.current=undefined}
 async function reloadWine(){const next=await getWine(id);setWine(next);return next}
 function watchDeepSearch(run:WineResearchRun){
  stopDeepTimers();setDeepRun(run);setDeepState(run.status==='running'?'running':run.status==='failed'?'error':'idle');if(run.status!=='running')return;
  const poll=async()=>{const next=await getWineDeepSearchStatus(id,run.requestId).catch(()=>null);if(!next)return;setDeepRun(next);if(next.status==='running')return;stopDeepTimers();if(next.status==='complete'){await reloadWine().catch(()=>undefined);setDeepState('idle');setDeepError('');setDeepNotice(`Deep Search completed${next.durationMs!=null?` in ${(next.durationMs/1000).toFixed(1)}s`:''}.`)}else{setDeepError(`${next.message||'The background Deep Search failed.'} · Request ${next.requestId}`);setDeepState('error')}};
  pollRef.current=startBackoffPoll(poll);void poll();
 }
 useEffect(()=>{let active=true;Promise.all([getWine(id),getWineDeepSearchStatus(id).catch(()=>null)]).then(([next,run])=>{if(!active)return;setWine(next);if(run?.status==='running')watchDeepSearch(run)}).catch(()=>undefined);return()=>{active=false;stopDeepTimers()}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 async function runDeepSearch(){setDeepState('running');setDeepError('');setDeepNotice('');try{const accepted=await startWineDeepSearch(id,wine?.deepSearch?'vintage':'none'),run=await getWineDeepSearchStatus(id,accepted.researchRequestId);if(run)watchDeepSearch(run);else setDeepNotice('Deep Search has been queued in the background. You can leave this page safely.')}catch(e){setDeepError((e as Error).message);setDeepState('error')}}
 async function cancelDeepSearch(){if(!deepRun||deepRun.status!=='running'||deepCancelling)return;if(!confirm('Cancel this Deep Search? Any producer, terroir, vintage or wine research already saved will be kept.'))return;setDeepCancelling(true);setDeepError('');try{const result=await cancelWineDeepSearch(id,deepRun.requestId);stopDeepTimers();await reloadWine().catch(()=>undefined);setDeepRun(null);setDeepState('idle');setDeepNotice(result.alreadyTerminal?'Deep Search had already reached a terminal state.':'Deep Search cancelled. Any research already saved was kept.')}catch(e){setDeepError((e as Error).message);setDeepState('running')}finally{setDeepCancelling(false)}}
 /**
  * Photographs added to a wine that already exists.
  *
  * A wine read off a printed list, or typed in by hand, could never have a
  * picture: photos only ever arrived with the wine itself. Getting one meant
  * deleting the wine and scanning the bottle, which threw away the price and
  * the evening it was attached to.
  *
  * The original is sent, not a resized copy - this is the record, and the
  * server reads the capture time and place off the file it stores.
  */
 async function addPhotos(files:File[]){
  if(!files.length||photoBusy)return;
  setPhotoBusy(true);setPhotoError('');
  try{
   const photos=await Promise.all(files.map(async file=>{
    const [metadata,size]=await Promise.all([extractPhotoMetadata(file),imageSize(file)]);
    return {file,metadata,width:size.width,height:size.height};
   }));
   await addWineImages(id,photos);
   await reloadWine();
  }catch(e){setPhotoError((e as Error).message||'Could not add the photos')}
  finally{setPhotoBusy(false);if(photoInput.current)photoInput.current.value=''}
 }

 /** One frame dropped. Easy to add a photo now means easy to add the wrong one. */
 async function removePhoto(imageId:string){
  if(photoBusy||!confirm('Remove this photo? The wine and everything else about it stay.'))return;
  setPhotoBusy(true);setPhotoError('');
  try{await deleteWineImage(id,imageId);await reloadWine()}
  catch(e){setPhotoError((e as Error).message||'Could not remove that photo')}
  finally{setPhotoBusy(false)}
 }

 async function toggleFavorite(){if(!wine||favoriteBusy)return;const next=!wine.favorite;setFavoriteBusy(true);setWine({...wine,favorite:next});try{await setWineFavorite(id,next)}catch(e){setWine(current=>current?{...current,favorite:!next}:current);setDeepNotice((e as Error).message)}finally{setFavoriteBusy(false)}}
 function toggleDeepField(field:DeepField){setOpenDeepFields(current=>{const next=new Set(current);if(next.has(field))next.delete(field);else next.add(field);writeOpenDeepFields(next);return next})}
 function toggleAllDeepFields(fields:DeepField[]){setOpenDeepFields(current=>{const allOpen=fields.every(field=>current.has(field)),next=new Set(current);for(const field of fields){if(allOpen)next.delete(field);else next.add(field)}writeOpenDeepFields(next);return next})}
 // Whoever linked here says where back goes; the stored copy carries it through
 // a reload or a trip out to the edit page, and the journal is the fallback for
 // a wine opened from a bookmark or a shared link.
 const back=useMemo(()=>{
  const handed=backTargetFromState(state);
  if(handed){rememberBackTarget(id,handed);return handed}
  return readBackTarget(id)??JOURNAL_BACK;
 },[state,id]);
 if(!wine)return <p aria-live="polite">Loading wine…</p>;
 // Derived rather than stored: the denomination is a fact about the appellation,
 // so reading it from the tree at display time keeps every wine current with the
 // tree instead of frozen at whatever it said on the day the wine was saved.
 const denomination=resolvePlace({country:wine.country,region:wine.region,appellation:wine.appellation}).denomination;
 // The denomination belongs to the narrowest place named, which is the region
 // for a wine logged as plain Rioja and the appellation for everything else.
 const denominatedAppellation=wine.appellation?[wine.appellation,denomination].filter(Boolean).join(' '):null;
 const denominatedRegion=[wine.appellation?wine.region:[wine.region,denomination].filter(Boolean).join(' '),wine.country].filter(Boolean).join(', ');
 // Region and appellation are shown as one pair, because normalisation moves
 // names between the two: "California / Napa Valley" becoming "Napa Valley /
 // Oakville" is one change, and either field alone would read as a mistake.
 const recorded=[wine.recognizedRegion,wine.recognizedAppellation].filter(Boolean).join(' / ');
 const asRecorded=recorded&&recorded!==[wine.region,wine.appellation].filter(Boolean).join(' / ')?recorded:null;
 const blend=wine.grapeBlend.length?wine.grapeBlend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`):wine.grapes,deep=wine.deepSearch,structure=wine.tastingStructure,price=formatPrice(wine.price,wine.currency);
 const structureItems=structure?[[ 'Flavour intensity',structure.flavourIntensity],['Acidity',structure.acidity],['Tannin',structure.tannin],['Body',structure.body],['Finish',structure.finish],['Perceived alcohol',structure.alcohol]].filter((item):item is [string,string]=>Boolean(item[1])):[];
 const researchSections=deep?([
  ['Vintage quality','vintageQuality',deep.vintageQuality],['Producer','producerDetails',deep.producerDetails],['Producer-wide practices','producerWinemakingPractices',deep.producerWinemakingPractices],['This wine / vintage winemaking','winemakingTechniques',deep.winemakingTechniques],['Terroir','terroir',deep.terroir],['Drinking window','drinkingWindow',deep.drinkingWindow]
 ] as Array<[string,DeepField,string]>).filter(([, ,value])=>Boolean(value)):[];
 return <article className="detail wine-detail"><Link className="back-pill" to={back.to}>← {back.label}</Link>
  <section className="wine-identity">
   {wine.imageIds.length?<div className="detail-gallery" aria-label={`${wine.wineName} photos`}>{wine.imageIds.map((imageId,index)=><span className="detail-photo-slot" key={imageId}><button type="button" className="detail-photo-button" onClick={()=>setSelectedImage(imageId)} aria-label={`Open photo ${index+1} of ${wine.imageIds.length}`}><WineImage imageId={imageId} alt={`${wine.producer} ${wine.wineName} photo ${index+1}`} className="detail-photo"/></button><button type="button" className="detail-photo-remove" disabled={photoBusy} onClick={()=>void removePhoto(imageId)} aria-label={`Remove photo ${index+1}`}>×</button></span>)}</div>:<div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}
   <div className="detail-photo-add">
    <button type="button" className="quiet" disabled={photoBusy} onClick={()=>photoInput.current?.click()}>
     {photoBusy?'Adding…':wine.imageIds.length?'Add another photo':'Add a photo'}
    </button>
    <input ref={photoInput} className="visually-hidden" type="file" accept="image/*" multiple
     onChange={event=>void addPhotos(Array.from(event.target.files??[]))}/>
   </div>
   {photoError&&<p className="detail-photo-error" role="alert">{photoError}</p>}
   {wine.groupSourcePhotos.length>0&&<div className="group-source-context"><div className="group-source-heading"><span>GROUP PHOTO</span><small>Source context · bottle crop shown above</small></div><div className="group-source-gallery">{wine.groupSourcePhotos.map(source=><button type="button" key={source.sessionId} className="group-source-button" onClick={()=>setSelectedGroupSource(source.sessionId)} aria-label="Open source Group Photo"><GroupSourceImage sessionId={source.sessionId} alt={`${wine.producer} ${wine.wineName} source group photo`} className="group-source-photo"/><span>{new Date(source.capturedAt??source.createdAt).toLocaleDateString()}</span></button>)}</div></div>}
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producerId?<Link className="detail-producer-link" to={`/producers/${wine.producerId}`}>{wine.producer}</Link>:wine.producer}</h2><div className="detail-favorite-row"><button type="button" className={`detail-favorite-button${wine.favorite?' active':''}`} aria-pressed={wine.favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><span className="heart" aria-hidden="true"><AppIcon kind={wine.favorite?'heart-filled':'heart'}/></span>{wine.favorite?'Favorite':'Add to favorites'}</button><a className="detail-wine-searcher-link" href={wineSearcherUrl(wine.producer,wine.wineName,wine.vintage)} target="_blank" rel="noopener noreferrer">Find on Wine-Searcher <span aria-hidden="true">↗</span></a></div><div className="detail-pills">{wine.appellation&&<span>{wine.appellation}{denomination&&<small className="detail-denomination">{denomination}</small>}</span>}{!wine.appellation&&wine.region&&denomination&&<span>{wine.region}<small className="detail-denomination">{denomination}</small></span>}{wine.classification&&<span className={`detail-classification detail-classification-${wine.classification}`}>{classificationLabel[wine.classification]}</span>}{blend.map(g=><span key={g}>{g}</span>)}{wine.rating!=null&&<strong>{wine.rating} / 100</strong>}</div><DrinkingWindow wine={wine}/><CellarStrip wineId={wine.id}/>
  </section>
  {wine.tastingNotes&&<section className="detail-section"><p className="section-label">Sensory notes</p><blockquote>{wine.tastingNotes}</blockquote></section>}
  <section className="detail-section"><p className="section-label">Wine details</p><dl>{[['Region',denominatedRegion],['Appellation',denominatedAppellation],['As recorded',asRecorded],['Grapes / blend',blend.join(', ')],['Alcohol',wine.alcoholPercentage&&`${wine.alcoholPercentage}%`]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
  {structureItems.length>0&&<section className="detail-section structure-detail-section"><p className="section-label">Structure</p><dl className="tasting-structure-summary">{structureItems.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{structureValueLabel[value]??value}</dd></div>)}</dl><p className="structure-section-note">Perceived structure; label ABV appears in Wine details.</p></section>}
  <section className="detail-section deep-search-panel">
   <div className="deep-panel-head"><p className="section-label">Deep Search</p>{deep?.quality&&<span className={`deep-quality-pill ${deep.quality.status}`}>{qualityStatusLabel[deep.quality.status]??deep.quality.status} · {deep.quality.score}/100</span>}</div>
   {deep?<>
    {deep.quality&&deep.quality.warnings.length>0&&<ResearchQuality deep={deep}/>}
    <div className="deep-summary"><ResearchText text={deep.summary}/><ClaimEvidence deep={deep} field="summary"/></div>
    {researchSections.length>0&&<div className="deep-research-sections">
     <div className="deep-sections-head"><span>{researchSections.length} research section{researchSections.length===1?'':'s'}</span><button type="button" className="deep-toggle-all" onClick={()=>toggleAllDeepFields(researchSections.map(([,field])=>field))}>{researchSections.every(([,field])=>openDeepFields.has(field))?'Collapse all':'Expand all'}</button></div>
     {researchSections.map(([label,field,value])=>{
      const open=openDeepFields.has(field),evidence=deep.provenance?.fields[field],panelId=`deep-section-${field}`;
      return <section className={`deep-research-section${open?'':' is-collapsed'}`} key={field}>
       <h3><button type="button" className="deep-section-toggle" aria-expanded={open} aria-controls={panelId} onClick={()=>toggleDeepField(field)}>
        <span className="deep-section-name">{label}</span>
        {Boolean(evidence?.claimCount)&&<span className="deep-section-meta">{evidence!.supportedCount} direct{evidence!.conflictingCount?` · ${evidence!.conflictingCount} disputed`:''}</span>}
        <span className="deep-chevron" aria-hidden="true"/>
       </button></h3>
       <div className="deep-section-body" id={panelId} hidden={!open}>
        <ResearchText text={value}/>
        {field==='producerWinemakingPractices'&&<small>General domaine context; not automatically treated as verified for this exact vintage.</small>}
        <ClaimEvidence deep={deep} field={field}/>
       </div>
      </section>;
     })}
    </div>}
    <DeepSources sources={deep.sources}/>
    <small>Latest research model: {deep.model} · {new Date(deep.researchedAt).toLocaleDateString()} · reusable research is stored permanently</small>
   </>:<p>Enrich this wine with grounded research. WineLog reuses stored producer practices, terroir and vintage research whenever the scope matches.</p>}
   {deepNotice&&<p className="producer-notice" role="status">{deepNotice}</p>}{deepState==='idle'&&<button type="button" className="primary" onClick={()=>setDeepState('confirm-usage')}>{deep?'Refresh vintage research':'Deep Search'}</button>}{deepState==='confirm-usage'&&<div className="deep-confirm"><p>{deep?'This refresh keeps cached producer-wide practices and stable terroir research, and re-runs only vintage-sensitive research for this wine.':'WineLog checks permanent caches first and queues Gemini 3.7 Flash with Google Search only for missing research scopes.'} The background job continues even if you close WineLog. API usage may be incurred. Continue?</p><button type="button" className="primary" onClick={runDeepSearch}>{deep?'Queue vintage refresh':'Queue Deep Search'}</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}{deepState==='running'&&<div className="deep-running" role="status"><span className="deep-spinner" aria-hidden="true"/><div><strong>{deepRun?deepStage[deepRun.stage]:'Queueing Deep Search…'}</strong><p>{deepRun?.message||'Preparing the background job.'}</p><small>{deepRun?<><ElapsedSeconds startedAt={deepRun.startedAt}/> · Request {deepRun.requestId}</>:'0s'}</small><p>You can leave this page or close WineLog. The Queue continues independently and the saved result will appear when you return.</p><button type="button" className="secondary-danger" disabled={!deepRun||deepCancelling} onClick={cancelDeepSearch}>{deepCancelling?'Cancelling…':'Cancel Deep Search'}</button></div></div>}{deepState==='error'&&<div className="deep-error" role="alert"><strong>Deep Search did not complete.</strong><p>{deepError||deepRun?.message||'The background research job failed before a result was saved.'}</p><button type="button" onClick={runDeepSearch}>Retry Deep Search</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Close</button></div>}
  </section>
  <section className="detail-section experience-panel"><p className="section-label">Your experience</p><dl>{[['Drinking date',wine.tastingDate],['Tasting / event',wine.tastingName],['Venue',wine.venue],['Location',wine.locationName],['Price',price]].filter(x=>x[1]).map(([k,v])=><div key={String(k)}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section><p className="detail-tags">{wine.tags.map(t=><span className="tag" key={t}>#{t}</span>)}</p><div className="actions"><Link className="button" to={`/wines/${id}/edit`}>Edit tasting</Link><button className="danger secondary-danger" onClick={async()=>{if(confirm('Delete this wine?')){await deleteWine(id);nav('/')}}}>Delete</button></div>
  {selectedImage&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Wine photo viewer" onClick={()=>setSelectedImage(undefined)}><button type="button" className="lightbox-close" aria-label="Close photo" onClick={()=>setSelectedImage(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><WineImage imageId={selectedImage} alt={`${wine.producer} ${wine.wineName} full-resolution photo`} className="lightbox-image"/></div></div>}
  {selectedGroupSource&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Source Group Photo viewer" onClick={()=>setSelectedGroupSource(undefined)}><button type="button" className="lightbox-close" aria-label="Close Group Photo" onClick={()=>setSelectedGroupSource(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><GroupSourceImage sessionId={selectedGroupSource} alt={`${wine.producer} ${wine.wineName} source Group Photo`} className="lightbox-image"/></div></div>}
 </article>
}
