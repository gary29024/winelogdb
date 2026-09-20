import { apiJson } from '../../lib/auth/api';
import { LwinLinkEditor,type LwinLinkPreview } from './LwinLinkEditor';
import { summariesChanged } from '../../lib/cache/summaryCaches';
import { FriendResearchStatus } from '../auth/FriendResearchStatus';
import { getAccount } from '../../lib/auth/client';
import { WineSharing } from './WineSharing';
import { SparklingDetailsCard } from './SparklingDetailsCard';
import { isChampagne } from '../../lib/wine/champagneExtraction';
import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useLocation,useNavigate,useParams } from 'react-router-dom';
import type { DeepSearchResult } from '../../lib/db/schema';
import { addWineImages,applyWineReferenceSuggestion,cancelWineDeepSearch,deleteWine,deleteWineImage,getWine,getWineDeepSearchStatus,setWineFavorite,startWineDeepSearch,type WineDetail,type WineResearchRun } from './api';
import { extractPhotoMetadata } from '../uploads/photoMetadata';
import { imageSize } from '../uploads/prepareImage';
import { WineImage } from './WineImage';
import { CellarStrip } from '../cellar/CellarStrip';
import { VintageCheck } from '../maturity/VintageCheck';
import { VINTAGE_WINDOW_SURFACES } from '../maturity/surfaces';
import { backTargetFromState,JOURNAL_BACK,readBackTarget,rememberBackTarget } from './backTarget';
import { GroupSourceImage } from '../uploads/GroupSourceImage';
import { structureValueLabel } from '../../lib/wine/tastingStructure';
import { DeepSources,ResearchText } from './ResearchPresentation';
import { readOpenDeepFields,researchSections,type DeepField,writeOpenDeepFields } from './researchSections';
import { experienceRows as buildExperienceRows } from '../../lib/wine/detailFields';
import { FactList,WineDetailsSection,WineFactPills } from './WineFacts';
import { isResearchStale } from '../../lib/research/freshness';
import '../../deepSearch.css';
import '../../favorites.css';
import '../../wineFormCompact.css';
import '../../groupSource.css';
import '../../wineClassification.css';
import '../../referenceSuggestions.css';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { AppIcon } from '../../components/AppIcons';
import { ElapsedSeconds } from '../../components/ElapsedSeconds';

type DeepState='idle'|'confirm-usage'|'running'|'error';
const deepStage:Record<WineResearchRun['stage'],string>={queued:'Queued for background research',researching:'Researching in the background',saving:'Saving Deep Search result',complete:'Research complete',failed:'Research failed'};
const claimStatusLabel={supported:'Direct support',partial:'Partial support',unsupported:'No direct citation',uncertainty:'Explicit uncertainty',conflicting:'Conflicting sources'} as const;
function wineSearcherUrl(producer:string,wineName:string,vintage:number|null|undefined){const query=[producer,wineName,vintage!=null?String(vintage):''].map(x=>String(x).trim()).filter(Boolean).join(' ');return `https://www.wine-searcher.com/find/${encodeURIComponent(query).replace(/%20/g,'+')}`}
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
  {quality.scoreNote&&!quality.warnings.length&&<p>{quality.scoreNote}</p>}
  {quality.warnings.length>0&&<ul>{quality.warnings.map(warning=><li key={warning}>{qualityWarningLabel[warning]??warning}</li>)}</ul>}
 </div>;
}

function ClaimEvidence({deep,field}:{deep:DeepSearchResult;field:DeepField}){
 const evidence=deep.provenance?.fields[field];if(!evidence?.claims.length)return null;
 return <details className="claim-evidence"><summary>Evidence · {evidence.supportedCount} direct{evidence.conflictingCount?` · ${evidence.conflictingCount} disputed`:''}{evidence.partialCount?` · ${evidence.partialCount} partial`:''}{evidence.unsupportedCount?` · ${evidence.unsupportedCount} unsupported`:''}{evidence.uncertaintyCount?` · ${evidence.uncertaintyCount} uncertain`:''}</summary><ol>{evidence.claims.map((item,index)=><li key={`${field}-${index}`}><div className="claim-evidence-head"><span className={`claim-status ${item.supportStatus}`}>{claimStatusLabel[item.supportStatus]}</span>{item.sourceTier!=='none'&&<span className="claim-tier">{item.sourceTier}</span>}</div><p>{item.claim}</p>{item.sources.length>0&&<div className="claim-links">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</li>)}</ol><small>Direct evidence means WineLog linked that claim to a cited source. “No direct citation” means the research may still be sourced overall, but that statement could not be tied to one specific citation. “Conflicting sources” means independent sources disagree, so WineLog preserves the dispute instead of choosing one figure.</small></details>;
}


export function DetailPage(){
 const {id=''}=useParams(),nav=useNavigate(),{state}=useLocation(),[wine,setWine]=useState<WineDetail>(),[favoriteBusy,setFavoriteBusy]=useState(false),[referenceBusy,setReferenceBusy]=useState<string>(''),[referenceError,setReferenceError]=useState(''),[deepState,setDeepState]=useState<DeepState>('idle'),[deepError,setDeepError]=useState(''),[deepRun,setDeepRun]=useState<WineResearchRun|null>(null),[deepNotice,setDeepNotice]=useState(''),[deepCancelling,setDeepCancelling]=useState(false),[selectedImage,setSelectedImage]=useState<string>(),[selectedGroupSource,setSelectedGroupSource]=useState<string>(),[openDeepFields,setOpenDeepFields]=useState<Set<DeepField>>(readOpenDeepFields),[photoBusy,setPhotoBusy]=useState(false),[photoError,setPhotoError]=useState(''),[friendOperation,setFriendOperation]=useState('');
 const technicalView=getAccount()?.role==='owner';
 const photoInput=useRef<HTMLInputElement|null>(null);
 const pollRef=useRef<Poller|undefined>(undefined);
 function stopDeepTimers(){pollRef.current?.stop();pollRef.current=undefined}
 async function reloadWine(){const next=await getWine(id);setWine(next);return next}
 function watchDeepSearch(run:WineResearchRun){
  stopDeepTimers();setDeepRun(run);setDeepState(run.status==='running'?'running':run.status==='failed'?'error':'idle');if(run.status!=='running')return;
  const poll=async()=>{const next=await getWineDeepSearchStatus(id,run.requestId).catch(()=>null);if(!next)return;setDeepRun(next);if(next.status==='running')return;stopDeepTimers();if(next.status==='complete'){await reloadWine().catch(()=>undefined);setDeepState('idle');setDeepError('');setDeepNotice(`Deep Search completed${next.durationMs!=null?` in ${(next.durationMs/1000).toFixed(1)}s`:''}.`)}else{setDeepError(technicalView?`${next.message||'The background Deep Search failed.'} · Request ${next.requestId}`:`The background Deep Search failed. · Support ID ${next.requestId}`);setDeepState('error')}};
  pollRef.current=startBackoffPoll(poll);void poll();
 }
 useEffect(()=>{let active=true;Promise.all([getWine(id),getWineDeepSearchStatus(id).catch(()=>null)]).then(([next,run])=>{if(!active)return;setWine(next);if(run?.status==='running')watchDeepSearch(run)}).catch(()=>undefined);return()=>{active=false;stopDeepTimers()}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 async function runDeepSearch(){setDeepState('running');setDeepError('');setDeepNotice('');try{const accepted=await startWineDeepSearch(id,wine?.deepSearch?'vintage':'none');if(accepted.cached){await reloadWine();setDeepState('idle');return}if(accepted.waitingForFriend){setFriendOperation(accepted.creditOperationId??'');setDeepState('idle');return}const run=await getWineDeepSearchStatus(id,accepted.researchRequestId);if(run)watchDeepSearch(run);else setDeepNotice('Deep Search has been queued in the background. You can leave this page safely.')}catch(e){setDeepError((e as Error).message);setDeepState('error')}}
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

 async function applyReferenceSuggestion(field:WineDetail['referenceSuggestions'][number]['field'],action:'apply'|'keep'='apply'){if(!wine||referenceBusy)return;setReferenceBusy(field);setReferenceError('');try{await applyWineReferenceSuggestion(id,field,action);await reloadWine()}catch(e){setReferenceError((e as Error).message)}finally{setReferenceBusy('')}}
 async function recheckReference(){if(referenceBusy)return;setReferenceBusy('recheck');setReferenceError('');try{await apiJson(`/api/wines/${id}/reference-review`,'POST',{action:'recheck'});await reloadWine()}catch(e){setReferenceError((e as Error).message)}finally{setReferenceBusy('')}}
 async function linkReference(preview:LwinLinkPreview){if(referenceBusy)return;setReferenceBusy('link');setReferenceError('');try{await apiJson(`/api/wines/${id}/reference-review`,'POST',{action:'link',lwin7:preview.requestedLwin7,previewToken:preview.previewToken});summariesChanged();await reloadWine()}catch(e){setReferenceError((e as Error).message)}finally{setReferenceBusy('')}}
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
 // Both pages derive it, and the rows around it, from lib/wine/detailFields.
 const deep=wine.deepSearch,structure=wine.tastingStructure;
 const structureItems=structure?[[ 'Flavour intensity',structure.flavourIntensity],['Acidity',structure.acidity],['Tannin',structure.tannin],['Body',structure.body],['Finish',structure.finish],['Perceived alcohol',structure.alcohol]].filter((item):item is [string,string]=>Boolean(item[1])):[];
 const experienceRows=buildExperienceRows(wine);
 const sections=researchSections(deep);
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
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producerId?<Link className="detail-producer-link" to={`/producers/${wine.producerId}`}>{wine.producer}</Link>:wine.producer}</h2><div className="detail-favorite-row"><button type="button" className={`detail-favorite-button${wine.favorite?' active':''}`} aria-pressed={wine.favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><span className="heart" aria-hidden="true"><AppIcon kind={wine.favorite?'heart-filled':'heart'}/></span>{wine.favorite?'Favorite':'Add to favorites'}</button><a className="detail-wine-searcher-link" href={wineSearcherUrl(wine.producer,wine.wineName,wine.vintage)} target="_blank" rel="noopener noreferrer">Find on Wine-Searcher <span aria-hidden="true">↗</span></a><WineSharing wineId={id}/></div><WineFactPills wine={wine}/>{VINTAGE_WINDOW_SURFACES.wineDetail&&<VintageCheck wine={wine}/>}<CellarStrip wineId={wine.id}/>
  </section>
  <SparklingDetailsCard details={wine.sparklingDetails}/>
  {isChampagne(wine)&&<Link className="champagne-backfill-link" to={`/wines/${wine.id}/edit#champagne-photos`}>Fill Champagne details from photos</Link>}
  <WineDetailsSection wine={wine}/>
  <section className="detail-section"><LwinLinkEditor key={wine.id} wine={wine} disabled={Boolean(referenceBusy)} onLink={linkReference}/>{referenceError&&<p role="alert" className="detail-photo-error">{referenceError}</p>}</section>
  {(wine.referenceSuggestions??[]).length>0&&<section className="detail-section lwin-suggestion-panel">
   <p className="section-label">LWIN suggested updates</p><div className="lwin-review-toolbar"><button disabled={Boolean(referenceBusy)} onClick={()=>void recheckReference()}>Recheck LWIN</button>{technicalView&&<Link to={`/admin/lwin-review?wine=${id}`}>Review all pending wines</Link>}</div>
   <p className="lwin-suggestion-intro">WineLog found a canonical LWIN match but kept your existing populated fields unchanged. Review each difference before using the LWIN value.</p>
   <div className="lwin-suggestion-list">{(wine.referenceSuggestions??[]).map(item=><article className="lwin-suggestion-row" key={item.field}>
    <div><strong>{item.label}</strong><span><small>Current</small>{item.current||'—'}</span><span><small>LWIN</small>{item.suggested}</span></div>
    <button type="button" className="quiet" disabled={Boolean(referenceBusy)} onClick={()=>void applyReferenceSuggestion(item.field)}>{referenceBusy===item.field?'Saving…':'Use LWIN value'}</button><button type="button" className="quiet" disabled={Boolean(referenceBusy)} onClick={()=>void applyReferenceSuggestion(item.field,'keep')}>Keep current</button>
   </article>)}</div>
  </section>}
  <section className="detail-section experience-panel"><p className="section-label">Your experience</p><FactList rows={experienceRows}/>{wine.tastingNotes&&<blockquote className="detail-experience-notes">{wine.tastingNotes}</blockquote>}{!experienceRows.length&&!wine.tastingNotes&&<p className="detail-experience-empty">No tasting logged for this bottle yet.</p>}</section>
  {structureItems.length>0&&<section className="detail-section structure-detail-section"><p className="section-label">Structure</p><dl className="tasting-structure-summary">{structureItems.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{structureValueLabel[value]??value}</dd></div>)}</dl><p className="structure-section-note">Perceived structure; label ABV appears in Wine details.</p></section>}
  <section className="detail-section deep-search-panel">
   <div className="deep-panel-head"><p className="section-label">Deep Search</p>{deep?.quality&&<span className={`deep-quality-pill ${deep.quality.status}`}>{qualityStatusLabel[deep.quality.status]??deep.quality.status} · {deep.quality.score}/100</span>}</div>
   {deep?<>
    {deep.quality&&(deep.quality.warnings.length>0||deep.quality.scoreNote)&&<ResearchQuality deep={deep}/>}
    <div className="deep-summary"><ResearchText text={deep.summary}/><ClaimEvidence deep={deep} field="summary"/></div>
    {sections.length>0&&<div className="deep-research-sections">
     <div className="deep-sections-head"><span>{sections.length} research section{sections.length===1?'':'s'}</span><button type="button" className="deep-toggle-all" onClick={()=>toggleAllDeepFields(sections.map(([,field])=>field))}>{sections.every(([,field])=>openDeepFields.has(field))?'Collapse all':'Expand all'}</button></div>
     {sections.map(([label,field,value])=>{
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
    <small>{technicalView?<>Latest research model: {deep.model} · </>:<>Research updated </>}{new Date(deep.researchedAt).toLocaleDateString()} · reusable research is stored permanently{isResearchStale(deep.oldestResearchedAt??deep.researchedAt)&&<> · ⚠ may be outdated</>}</small>
   </>:<p>Enrich this wine with grounded research. WineLog reuses stored producer practices, terroir and vintage research whenever the scope matches.</p>}
   {friendOperation&&<FriendResearchStatus operationId={friendOperation} onComplete={()=>void reloadWine()}/>}{deepNotice&&<p className="producer-notice" role="status">{deepNotice}</p>}{deepState==='idle'&&<button type="button" className="primary" onClick={()=>setDeepState('confirm-usage')}>{deep?'Refresh vintage research':'Deep Search'}</button>}{deepState==='confirm-usage'&&<div className="deep-confirm"><p>{deep?'This refresh keeps reusable producer and terroir research, and refreshes only the vintage-sensitive parts for this wine.':technicalView?'WineLog checks permanent caches first and queues grounded research only for missing research scopes.':'WineLog reuses saved research first and researches only what is missing.'} The background job continues even if you close WineLog. Continue?</p><button type="button" className="primary" onClick={runDeepSearch}>{deep?'Queue vintage refresh':'Queue Deep Search'}</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Cancel</button></div>}{deepState==='running'&&<div className="deep-running" role="status"><span className="deep-spinner" aria-hidden="true"/><div><strong>{deepRun?deepStage[deepRun.stage]:'Queueing Deep Search…'}</strong><p>{technicalView?(deepRun?.message||'Preparing the background job.'):'WineLog is researching this wine in the background.'}</p><small>{deepRun?<><ElapsedSeconds startedAt={deepRun.startedAt}/> · {technicalView?'Request':'Support ID'} {deepRun.requestId}</>:'0s'}</small><p>You can leave this page or close WineLog. The background research continues and the saved result will appear when you return.</p><button type="button" className="secondary-danger" disabled={!deepRun||deepCancelling} onClick={cancelDeepSearch}>{deepCancelling?'Cancelling…':'Cancel Deep Search'}</button></div></div>}{deepState==='error'&&<div className="deep-error" role="alert"><strong>Deep Search did not complete.</strong><p>{deepError||(technicalView?deepRun?.message:null)||`The background research job failed before a result was saved.${deepRun?.requestId?` · Support ID ${deepRun.requestId}`:''}`}</p><button type="button" onClick={runDeepSearch}>Retry Deep Search</button><button type="button" className="secondary-danger" onClick={()=>setDeepState('idle')}>Close</button></div>}
  </section>
<p className="detail-tags">{wine.tags.map(t=><span className="tag" key={t}>#{t}</span>)}</p><div className="actions"><Link className="button" to={`/wines/${id}/edit`}>Edit tasting</Link><button className="danger secondary-danger" onClick={async()=>{if(confirm('Delete this wine?')){await deleteWine(id);nav('/')}}}>Delete</button></div>
  {selectedImage&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Wine photo viewer" onClick={()=>setSelectedImage(undefined)}><button type="button" className="lightbox-close" aria-label="Close photo" onClick={()=>setSelectedImage(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><WineImage variant="original" imageId={selectedImage} alt={`${wine.producer} ${wine.wineName} full-resolution photo`} className="lightbox-image"/></div></div>}
  {selectedGroupSource&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Source Group Photo viewer" onClick={()=>setSelectedGroupSource(undefined)}><button type="button" className="lightbox-close" aria-label="Close Group Photo" onClick={()=>setSelectedGroupSource(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><GroupSourceImage sessionId={selectedGroupSource} alt={`${wine.producer} ${wine.wineName} source Group Photo`} className="lightbox-image"/></div></div>}
 </article>
}
