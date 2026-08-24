import { useEffect,useMemo,useRef,useState } from 'react';
import { ImageLightbox } from '../../components/ImageLightbox';
import { WineForm } from '../wines/WineForm';
import type { WineInput } from '../../lib/db/schema';
import type { RecognitionResult } from '../recognition/schema';
import { authHeaders } from '../../lib/auth/client';
import { extractPhotoMetadata,type PhotoMetadata } from './photoMetadata';
import { prepareRecognitionImage } from './prepareImage';
import { batchImageUrl,confirmBatchWine,createBatchSession,getBatchSession,listBatchSessions,rejectBatchWine,removeBatchSession,stageBatchWine,submitBatchSession,type BatchRecognitionItem,type BatchRecognitionSession,type BatchSessionSummary } from './batchApi';
import { clearPendingBatchSession,listPendingBatchWines,removePendingBatchWine,savePendingBatchWines,type PendingBatchPhoto,type PendingBatchWine } from './batchUploadStore';
import '../../batchScan.css';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';

type PreparedPhoto=PendingBatchPhoto&{metadata:PhotoMetadata;preview:string};
type DraftWine={key:string;photos:PreparedPhoto[];preparing:boolean;error:string};
type UploadProgress={sessionId:string;uploaded:number;total:number;phase:'persisting'|'uploading'|'queueing';resumable:boolean};
type LightboxPhoto={src:string;alt:string};
const RECOVERY_STALE_MS=90_000;
const RETRY_LOCK_MS=90_000;
const emptyWine=():DraftWine=>({key:crypto.randomUUID(),photos:[],preparing:false,error:''});
function suggestedTags(result:RecognitionResult){const seen=new Set<string>();return [result.country,result.region,result.appellation,...result.grapes,result.style].filter((x):x is string=>Boolean(x)).map(x=>x.trim()).filter(x=>{const k=x.toLowerCase();if(!x||seen.has(k))return false;seen.add(k);return true}).slice(0,8)}
function recognitionInitial(r:RecognitionResult):Partial<WineInput>{return {producer:r.producer??'',wineName:r.wineName??'',vintage:r.vintage,country:r.country,region:r.region,appellation:r.appellation,grapes:r.grapes,grapeBlend:r.grapeBlend,wineStyle:r.style,alcoholPercentage:r.alcoholPercentage,tastingDate:r.tastingDate,locationName:r.locationName,latitude:r.latitude,longitude:r.longitude,tags:suggestedTags(r),recognitionConfidence:r.confidence,recognitionStatus:'review'}}

function BatchImage({id,alt,onOpen}:{id:string;alt:string;onOpen?:(src:string)=>void}){
  const [src,setSrc]=useState(''),[state,setState]=useState<'loading'|'ready'|'error'>('loading'),[retryKey,setRetryKey]=useState(0);
  useEffect(()=>{
    let active=true,url='',timer:number|undefined;const controller=new AbortController();setSrc('');setState('loading');
    async function load(attempt:number){
      try{
        const response=await fetch(batchImageUrl(id),{headers:authHeaders(),cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(`Preview failed (${response.status})`);
        const blob=await response.blob();if(!active)return;url=URL.createObjectURL(blob);setSrc(url);setState('ready');
      }catch{
        if(!active||controller.signal.aborted)return;
        if(attempt<2){timer=window.setTimeout(()=>void load(attempt+1),600*(attempt+1));return}
        setState('error');
      }
    }
    void load(0);
    return()=>{active=false;controller.abort();if(timer)window.clearTimeout(timer);if(url)URL.revokeObjectURL(url)};
  },[id,retryKey]);
  if(state==='ready'&&src){
    if(onOpen)return <button type="button" className="photo-lightbox-trigger" onClick={()=>onOpen(src)} aria-label={`Enlarge ${alt}`}><img src={src} alt={alt}/></button>;
    return <img src={src} alt={alt}/>;
  }
  if(state==='error')return <button type="button" className="batch-image-placeholder batch-image-retry" onClick={()=>setRetryKey(x=>x+1)} aria-label={`Retry ${alt} preview`}><span>Preview unavailable</span><small>Retry</small></button>;
  return <div className="batch-image-placeholder batch-image-loading" role="status" aria-label={`${alt} loading`}>Loading…</div>;
}

export function BatchScanPage(){
  const [drafts,setDrafts]=useState<DraftWine[]>([emptyWine(),emptyWine()]),[session,setSession]=useState<BatchRecognitionSession|null>(null),[submitting,setSubmitting]=useState(false),[cancelling,setCancelling]=useState(false),[recovering,setRecovering]=useState(false),[retryLockedSessionId,setRetryLockedSessionId]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reviewId,setReviewId]=useState<string|null>(null),[history,setHistory]=useState<BatchSessionSummary[]>([]),[uploadProgress,setUploadProgress]=useState<UploadProgress|null>(null),[pendingLocal,setPendingLocal]=useState(0),[checkingPending,setCheckingPending]=useState(false),[lightbox,setLightbox]=useState<LightboxPhoto|null>(null);
  const poll=useRef<Poller|undefined>(undefined),uploadAbort=useRef<AbortController|null>(null),cancelledSessions=useRef(new Set<string>()),recoveringSessions=useRef(new Set<string>()),recoveryAttemptedSessions=useRef(new Set<string>()),retryUnlockTimer=useRef<number|undefined>(undefined);
  const populated=drafts.filter(x=>x.photos.length),readyToSubmit=populated.length>=2&&!drafts.some(x=>x.preparing||x.error);
  const reviewItem=session?.items.find(x=>x.id===reviewId)??null;
  const readyItems=useMemo(()=>session?.items.filter(x=>x.status==='ready')??[],[session]);
  const waitingItems=useMemo(()=>session?.items.filter(x=>x.status==='submitted')??[],[session]);
  function stopPoll(){poll.current?.stop();poll.current=undefined}
  async function refreshPendingState(id:string){setCheckingPending(true);try{setPendingLocal((await listPendingBatchWines(id)).length)}catch{setPendingLocal(0)}finally{setCheckingPending(false)}}
  async function recoverWaitingRecognition(next:BatchRecognitionSession,force=false){
    const waiting=next.items.filter(item=>item.status==='submitted').length,recoverable=['queued','running','ready','partial','failed'].includes(next.status),age=Date.now()-Date.parse(next.updatedAt),stale=!Number.isFinite(age)||age>=RECOVERY_STALE_MS;
    if(!waiting||!recoverable||recoveringSessions.current.has(next.id))return next;
    if(!force&&['queued','running'].includes(next.status)&&!stale)return next;
    if(!force&&recoveryAttemptedSessions.current.has(next.id))return next;
    recoveryAttemptedSessions.current.add(next.id);recoveringSessions.current.add(next.id);setRecovering(true);
    try{
      await submitBatchSession(next.id);
      setNotice(`Recovery queued for ${waiting} waiting wine${waiting===1?'':'s'}. WineLog is checking existing Gemini jobs now and will submit only items that are not already attached to an active job.`);
      return await getBatchSession(next.id);
    }catch(e){
      const latest=await getBatchSession(next.id).catch(()=>null);
      setError(`Could not restart ${waiting} waiting recognition${waiting===1?'':'s'}: ${(e as Error).message}`);
      return latest??next;
    }finally{recoveringSessions.current.delete(next.id);setRecovering(false)}
  }
  async function refreshSession(id:string){let next=await getBatchSession(id);next=await recoverWaitingRecognition(next);setSession(next);if(next.status==='uploading')void refreshPendingState(id);else{setPendingLocal(0);setCheckingPending(false)}if(['queued','running'].includes(next.status)&&!poll.current)poll.current=startBackoffPoll(()=>refreshSession(id).then(()=>undefined).catch(()=>undefined),{initialMs:10000,maxMs:30000});if(!['queued','running'].includes(next.status))stopPoll();return next}
  async function retryWaitingRecognition(){
    if(!session||recovering||retryLockedSessionId===session.id)return;
    const id=session.id;setRetryLockedSessionId(id);if(retryUnlockTimer.current)window.clearTimeout(retryUnlockTimer.current);retryUnlockTimer.current=window.setTimeout(()=>{setRetryLockedSessionId(current=>current===id?null:current);retryUnlockTimer.current=undefined},RETRY_LOCK_MS);
    setError('');const next=await recoverWaitingRecognition(session,true);setSession(next);if(['queued','running'].includes(next.status)&&!poll.current)poll.current=startBackoffPoll(()=>refreshSession(next.id).then(()=>undefined).catch(()=>undefined),{initialMs:10000,maxMs:30000});
  }
  useEffect(()=>{let active=true;listBatchSessions().then(async result=>{if(!active)return;setHistory(result.items);const resumable=result.items.find(x=>['uploading','queued','running','ready','partial'].includes(x.status));if(resumable)await refreshSession(resumable.id)}).catch(()=>undefined);return()=>{active=false;stopPoll();uploadAbort.current?.abort();if(retryUnlockTimer.current)window.clearTimeout(retryUnlockTimer.current)}},[]);

  async function choose(index:number,files:File[]){if(!files.length)return;setError('');setDrafts(xs=>xs.map((x,i)=>i===index?{...x,preparing:true,error:''}:x));try{const prepared=await Promise.all(files.map(async file=>{const [metadata,image]=await Promise.all([extractPhotoMetadata(file),prepareRecognitionImage(file,1600,0.80)]);return {original:file,recognition:image.file,metadata,width:image.width,height:image.height,preview:URL.createObjectURL(file)}}));setDrafts(xs=>xs.map((x,i)=>i===index?{...x,photos:prepared,preparing:false,error:''}:x))}catch(e){setDrafts(xs=>xs.map((x,i)=>i===index?{...x,preparing:false,error:(e as Error).message}:x))}}
  function removeDraft(index:number){setDrafts(xs=>xs.length<=2?xs.map((x,i)=>i===index?emptyWine():x):xs.filter((_,i)=>i!==index))}
  function pendingFromDrafts(sessionId:string):PendingBatchWine[]{return populated.map((wine,position)=>({sessionId,position,photos:wine.photos.map(({original,recognition,metadata,width,height})=>({original,recognition,metadata,width,height}))}))}

  async function uploadPendingItems(sessionId:string,wines:PendingBatchWine[],existingPositions:Set<number>,total:number,signal:AbortSignal){
    const uploaded=new Set(existingPositions);let cursor=0;
    const worker=async()=>{while(true){const index=cursor++;if(index>=wines.length)return;const wine=wines[index];await stageBatchWine(sessionId,wine.position,wine.photos,signal);uploaded.add(wine.position);await removePendingBatchWine(sessionId,wine.position).catch(()=>undefined);setUploadProgress(current=>current?.sessionId===sessionId?{...current,uploaded:Math.min(total,uploaded.size)}:current)}};
    await Promise.all(Array.from({length:Math.min(3,wines.length)},()=>worker()));
  }

  async function submit(){if(!readyToSubmit)return;setSubmitting(true);setError('');setNotice('');let createdId='';try{
    const created=await createBatchSession(populated.length);createdId=created.id;const pending=pendingFromDrafts(created.id);let resumable=true;
    setUploadProgress({sessionId:created.id,uploaded:0,total:pending.length,phase:'persisting',resumable:true});
    try{await savePendingBatchWines(created.id,pending)}catch{resumable=false;setNotice('This browser could not store a resumable copy. Keep WineLog open until all uploads finish.')}
    setUploadProgress({sessionId:created.id,uploaded:0,total:pending.length,phase:'uploading',resumable});
    const controller=new AbortController();uploadAbort.current=controller;await uploadPendingItems(created.id,pending,new Set(),pending.length,controller.signal);
    setUploadProgress(current=>current?{...current,uploaded:pending.length,phase:'queueing'}:current);await submitBatchSession(created.id);await clearPendingBatchSession(created.id).catch(()=>undefined);setUploadProgress(null);
    setNotice(`${pending.length} wines uploaded and queued with Gemini Batch API. You can now close WineLog; recognition continues in the background.`);await refreshSession(created.id);setHistory((await listBatchSessions()).items);
  }catch(e){if((e as DOMException).name!=='AbortError'&&!cancelledSessions.current.has(createdId)){setError((e as Error).message);if(createdId){const staged=await getBatchSession(createdId).catch(()=>null);if(staged?.status==='uploading'){setSession(staged);await refreshPendingState(createdId)}}}}finally{uploadAbort.current=null;setSubmitting(false)}}

  async function resumeUpload(){if(!session||session.status!=='uploading')return;setSubmitting(true);setError('');setNotice('');try{
    const pending=await listPendingBatchWines(session.id),total=session.expectedItems||Math.max(session.totalItems,session.totalItems+pending.length),existing=new Set(session.items.map(item=>item.position));
    if(!pending.length&&!(session.expectedItems>0&&session.totalItems===session.expectedItems))throw new Error('The remaining upload files are not available on this device. Cancel this incomplete batch and start again.');
    setUploadProgress({sessionId:session.id,uploaded:existing.size,total,phase:pending.length?'uploading':'queueing',resumable:true});
    if(pending.length){const controller=new AbortController();uploadAbort.current=controller;await uploadPendingItems(session.id,pending,existing,total,controller.signal)}
    setUploadProgress(current=>current?{...current,phase:'queueing'}:current);await submitBatchSession(session.id);await clearPendingBatchSession(session.id).catch(()=>undefined);setPendingLocal(0);setUploadProgress(null);setNotice('Upload completed and the batch is queued. You can now close WineLog safely.');await refreshSession(session.id);setHistory((await listBatchSessions()).items);
  }catch(e){if((e as DOMException).name!=='AbortError'&&!cancelledSessions.current.has(session.id))setError((e as Error).message)}finally{uploadAbort.current=null;setSubmitting(false)}}

  async function removeBatch(id:string,status:string,confirmedItems=0){if(status==='queued'||status==='running'){setError('This batch is already processing with Gemini. It can be removed after processing finishes.');return}const wording=status==='uploading'?'Cancel this incomplete batch and delete its staged photos?':`Remove this batch record and discard any unsaved staged photos?${confirmedItems?' Already saved wines will be kept.':''}`;if(!confirm(wording))return;setCancelling(true);setError('');cancelledSessions.current.add(id);uploadAbort.current?.abort();try{await removeBatchSession(id);await clearPendingBatchSession(id).catch(()=>undefined);stopPoll();if(session?.id===id)setSession(null);if(uploadProgress?.sessionId===id)setUploadProgress(null);setPendingLocal(0);setReviewId(null);setLightbox(null);setDrafts([emptyWine(),emptyWine()]);setHistory((await listBatchSessions()).items);setNotice(status==='uploading'?'Incomplete batch cancelled and staged photos removed.':'Batch removed. Already saved wines were kept.')}catch(e){cancelledSessions.current.delete(id);setError((e as Error).message)}finally{setCancelling(false)}}
  async function discard(item:BatchRecognitionItem){if(!session||!confirm('Discard this pending identification and its staged photos?'))return;await rejectBatchWine(session.id,item.id);setReviewId(null);setLightbox(null);await refreshSession(session.id)}
  async function afterSaved(){if(!session)return;setReviewId(null);setLightbox(null);const next=await refreshSession(session.id),nextReady=next.items.find(x=>x.status==='ready');if(nextReady)setReviewId(nextReady.id);setNotice('Wine confirmed and saved. Staged recognition copy deleted; the original photo is now attached to the wine.')}

  if(session?.status==='uploading'){
    const expected=session.expectedItems||0,complete=expected>0&&session.totalItems===expected,canResume=pendingLocal>0||complete;
    return <section className="batch-scan-page"><div className="hero compact"><p className="eyebrow">BATCH SCAN</p><h1>{expected?`${session.totalItems} of ${expected} wines uploaded.`:`${session.totalItems} wines uploaded.`}</h1><p>{checkingPending?'Checking this device for the remaining photos…':pendingLocal>0?`${pendingLocal} wine${pendingLocal===1?' is':'s are'} still stored on this device. Resume to finish the upload before Gemini processing starts.`:complete?'All wines reached the server, but the batch was not queued. You can finish submission now.':expected?'The upload was interrupted and the remaining files are no longer available in this browser. Cancel this batch and start again.':'This older incomplete batch was never submitted. Its missing original files cannot be recovered automatically; cancel it and start again.'}</p></div>
      <div className="batch-upload-panel"><div className="batch-upload-progress"><strong>UPLOAD INCOMPLETE</strong><span>{expected?`${session.totalItems} / ${expected}`:`${session.totalItems} staged`}</span></div>{expected>0&&<div className="batch-progress-track"><span style={{width:`${Math.min(100,(session.totalItems/expected)*100)}%`}}/></div>}<small>Gemini has not started yet. WineLog is only safe to leave after this status changes to QUEUED or RUNNING.</small><div className="batch-upload-actions">{canResume&&<button type="button" disabled={submitting||cancelling} onClick={()=>void resumeUpload()}>{submitting?'Resuming…':pendingLocal>0?'Resume upload':'Finish & queue'}</button>}<button type="button" className="secondary-danger" disabled={cancelling} onClick={()=>void removeBatch(session.id,session.status,session.confirmedItems)}>{cancelling?'Cancelling…':'Cancel batch'}</button></div></div>
      {error&&<p className="scan-error">{error}</p>}{notice&&<p className="producer-notice">{notice}</p>}
    </section>;
  }

  if(session)return <section className="batch-scan-page"><div className="hero compact"><p className="eyebrow">BATCH SCAN</p><h1>{session.totalItems} wines in this batch.</h1><p>{waitingItems.length?`${waitingItems.length} waiting for recognition · ${readyItems.length} ready for review · ${session.confirmedItems} confirmed.`:session.status==='queued'||session.status==='running'?'Gemini is processing these independent wine requests in the background. You can close WineLog safely.':`${readyItems.length} ready for review · ${session.confirmedItems} confirmed.`}</p></div>
    <div className={`batch-session-status ${session.status}`}><strong>{session.status.toUpperCase()}</strong><span>Batch {session.id.slice(0,8)} · expires {new Date(session.expiresAt).toLocaleDateString()}</span></div>{notice&&<p className="producer-notice">{notice}</p>}{error&&<p className="scan-error">{error}</p>}
    {waitingItems.length>0&&['queued','running','ready','partial','failed'].includes(session.status)&&<div className="batch-upload-panel"><div className="batch-upload-progress"><strong>WAITING FOR RECOGNITION</strong><span>{waitingItems.length} waiting</span></div><small>If gateway activity has stopped, retry is safe: WineLog first checks existing recognition work and only requeues a stale request after its active-request safety lease has expired.</small><div className="batch-upload-actions"><button type="button" disabled={recovering||retryLockedSessionId===session.id} onClick={()=>void retryWaitingRecognition()}>{recovering?'Retrying…':retryLockedSessionId===session.id?'Retry queued…':'Retry waiting recognition'}</button></div></div>}
    <div className="batch-result-grid">{session.items.map((item,index)=>{const alt=item.recognition?.wineName?`${item.recognition.wineName} label`:`Wine ${index+1}`;return <article className={`batch-result-card ${item.status}`} key={item.id}>{item.imageIds[0]?<BatchImage id={item.imageIds[0]} alt={alt} onOpen={item.recognition?src=>setLightbox({src,alt}):undefined}/>:<div className="batch-image-placeholder">Wine {index+1}</div>}<div><span className="batch-item-state">{item.status}</span><h2>{item.recognition?.wineName||`Wine ${index+1}`}</h2><p>{item.recognition?.producer||item.error||'Waiting for recognition'}</p>{item.recognition&&<small>{item.recognition.vintage?`${item.recognition.vintage} · `:''}{Math.round(item.recognition.confidence*100)}% confidence</small>}{item.status==='ready'&&<button type="button" onClick={()=>setReviewId(item.id)}>Review & save</button>}{item.status==='failed'&&<button type="button" className="secondary-danger" onClick={()=>void discard(item)}>Discard</button>}{item.status==='confirmed'&&item.confirmedWineId&&<a href={`/wines/${item.confirmedWineId}`}>View saved wine</a>}</div></article>})}</div>
    {reviewItem?.recognition&&<div className="batch-review"><div className="batch-review-heading"><div><p className="eyebrow">REVIEW IDENTIFICATION</p><h2>{reviewItem.recognition.wineName||'Review wine'}</h2></div><button type="button" onClick={()=>{setReviewId(null);setLightbox(null)}}>Close</button></div><div className="batch-review-images">{reviewItem.imageIds.map((id,i)=>{const alt=`${reviewItem.recognition?.wineName||'Wine'} label ${i+1}`;return <BatchImage key={id} id={id} alt={alt} onOpen={src=>setLightbox({src,alt})}/>})}</div><small>Tap a label photo to enlarge it and verify the identification against the original.</small><WineForm initial={recognitionInitial(reviewItem.recognition)} onSave={wine=>confirmBatchWine(session.id,reviewItem.id,wine)} onSaved={()=>void afterSaved()} submitLabel="Confirm & save wine"/><button type="button" className="secondary-danger batch-discard" onClick={()=>void discard(reviewItem)}>Discard this identification</button></div>}
    <div className="batch-footer-actions"><button type="button" onClick={()=>{stopPoll();setSession(null);setReviewId(null);setLightbox(null);setDrafts([emptyWine(),emptyWine()]);setNotice('')}}>Start another batch</button>{!['queued','running'].includes(session.status)&&<button type="button" className="secondary-danger" disabled={cancelling} onClick={()=>void removeBatch(session.id,session.status,session.confirmedItems)}>{cancelling?'Removing…':'Remove batch'}</button>}</div>
    {lightbox&&<ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={()=>setLightbox(null)}/>} 
  </section>;

  const phaseLabel=uploadProgress?.phase==='persisting'?'Preparing resumable upload':uploadProgress?.phase==='queueing'?'Queueing with Gemini':'Uploading photos';
  return <section className="batch-scan-page"><div className="hero compact"><p className="eyebrow">BATCH SCAN</p><h1>Scan several wines for less.</h1><p>Each section is one bottle. Add front, back, neck or other labels inside that bottle’s section. WineLog sends each bottle as an independent Gemini Batch request, while keeping all of its labels together.</p></div>{error&&<p className="scan-error">{error}</p>}{notice&&<p className="producer-notice">{notice}</p>}
    <div className="batch-draft-list">{drafts.map((wine,index)=><section className="batch-draft" key={wine.key}><div className="batch-draft-title"><div><span>WINE {index+1}</span><strong>{wine.photos.length?`${wine.photos.length} label photo${wine.photos.length===1?'':'s'}`:'Add this bottle’s labels'}</strong></div><button type="button" onClick={()=>removeDraft(index)}>Remove</button></div>{wine.photos.length?<div className="batch-draft-photos">{wine.photos.map(photo=><img src={photo.preview} alt={`Wine ${index+1} label`} key={photo.preview}/>)}</div>:<div className="batch-empty-photo">Front · back · neck · additional labels</div>}<label className="batch-photo-picker">{wine.preparing?'Preparing recognition copies…':wine.photos.length?'Replace photos':'Choose photos'}<input className="visually-hidden" type="file" accept="image/*" multiple disabled={wine.preparing||submitting} onChange={e=>void choose(index,Array.from(e.target.files??[]))}/></label>{wine.error&&<small className="scan-error">{wine.error}</small>}{wine.photos.length>0&&<small>{(wine.photos.reduce((s,p)=>s+p.recognition.size,0)/1024/1024).toFixed(1)} MB prepared for recognition · originals kept separately for final save</small>}</section>)}</div>
    <button type="button" className="batch-add-wine" disabled={submitting} onClick={()=>setDrafts(xs=>[...xs,emptyWine()])}>＋ Add another wine</button><div className="batch-submit-panel"><p>Batch Scan uses 1600px JPEG recognition copies at 80% quality. WineLog automatically splits the Gemini payload before it approaches the 20 MB inline Batch API limit.</p>{uploadProgress&&<div className="batch-upload-progress-card"><div><strong>{phaseLabel}</strong><span>{uploadProgress.uploaded} / {uploadProgress.total} wines uploaded</span></div><div className="batch-progress-track"><span style={{width:`${uploadProgress.total?Math.min(100,(uploadProgress.uploaded/uploadProgress.total)*100):0}%`}}/></div><small>{uploadProgress.phase==='queueing'?'All files reached WineLog. Queueing the background Gemini job now…':uploadProgress.resumable?'Keep WineLog open for the fastest upload. If you leave this page, you can resume the remaining wines on this device.':'Keep WineLog open until uploading completes; resumable browser storage is unavailable.'}</small></div>}<div className="batch-submit-actions"><button type="button" className="wide-action" disabled={!readyToSubmit||submitting} onClick={()=>void submit()}>{submitting?phaseLabel:`Identify ${populated.length||0} wines in batch`}</button>{uploadProgress&&<button type="button" className="secondary-danger" disabled={cancelling} onClick={()=>void removeBatch(uploadProgress.sessionId,'uploading')}>{cancelling?'Cancelling…':'Cancel batch'}</button>}</div></div>
    {history.length>0&&<section className="batch-history"><h2>Recent batches</h2>{history.slice(0,5).map(h=><button key={h.id} type="button" onClick={()=>void refreshSession(h.id)}><span>{new Date(h.updatedAt).toLocaleString()}</span><strong>{h.expectedItems?`${h.totalItems}/${h.expectedItems}`:`${h.totalItems}`} wines · {h.status}</strong><small>{h.confirmedItems} confirmed</small></button>)}</section>}
  </section>
}