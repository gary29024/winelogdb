import { useEffect,useMemo,useRef,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { WineForm,type SavedWineIdentity } from '../wines/WineForm';
import type { WineInput } from '../../lib/db/schema';
import { derivedTags } from '../wines/wineTags';
import type { WinePhoto } from '../wines/api';
import { groupRecognitionSchema,type GroupRecognitionWine } from '../recognition/groupSchema';
import { resolveProducer } from '../producers/api';
import { resolveCuvee } from '../cuvees/api';
import { authHeaders,clearSession } from '../../lib/auth/client';
import { extractPhotoMetadata,type PhotoMetadata } from './photoMetadata';
import { prepareRecognitionImageWithinBytes } from './prepareImage';
import { cropGroupPhoto } from './cropGroupPhoto';
import { nextPendingKey,savedRecognition } from './groupReviewQueue';
import { deleteGroupScanSession,getGroupScanSession,linkGroupScanWine,listGroupScanSessions,saveGroupScanSession,type GroupScanHistoryItem } from './groupScanStore';
import '../../groupScan.css';
import { AppIcon } from '../../components/AppIcons';
import { linkFrom } from '../wines/backTarget';

const GROUP_RECOGNITION_TARGET_BYTES=Math.floor(2.5*1024*1024);
type SourcePhoto={file:File;recognitionFile:File;metadata:PhotoMetadata;preview:string;width:number;height:number};
/**
 * `saved` is who the wine turned out to be once the form was submitted.
 *
 * A detected bottle carries the correction in its recognition, which the server
 * keeps; a wine added by hand has no recognition to write into, so this holds
 * its name for the rest of the visit - which is when this list is read.
 */
type ReviewItem={key:string;recognition:GroupRecognitionWine|null;crop:WinePhoto|null;cropPreview:string|null;savedId:string|null;removed:boolean;manual:boolean;saved:SavedWineIdentity|null};
type ErrorBody={error?:unknown;requestId?:unknown};

function readError(value:unknown){const body=typeof value==='object'&&value!==null?value as ErrorBody:{};const message=typeof body.error==='string'?body.error:'Request failed';return typeof body.requestId==='string'?`${message} · Request ${body.requestId}`:message}
async function readResponse(response:Response){const requestId=response.headers.get('X-WineLog-Request-Id')??undefined,text=await response.text();if(!text)return {error:`Group recognition failed (${response.status})`,requestId};try{return JSON.parse(text) as unknown}catch{return {error:text.slice(0,700),requestId}}}
function asDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??''));reader.onerror=()=>reject(new Error('Could not preview detected crop'));reader.readAsDataURL(file)})}
async function alignToExistingCuvee(result:GroupRecognitionWine){
  try{
    const producer=await resolveProducer(result.producer);if(!producer.matched||!producer.producer)return result;
    const cuvee=await resolveCuvee(producer.producer.id,result.wineName,null,result.style??null);
    if(!cuvee.matched||!cuvee.cuvee)return {...result,producer:producer.producer.canonicalName};
    return {...result,producer:producer.producer.canonicalName,wineName:cuvee.cuvee.canonicalName,appellation:cuvee.cuvee.appellation??result.appellation};
  }catch{return result}
}

export function GroupScanPage(){
  const [photo,setPhoto]=useState<SourcePhoto|null>(null),[items,setItems]=useState<ReviewItem[]>([]),[activeKey,setActiveKey]=useState<string|null>(null),[unresolvedCount,setUnresolvedCount]=useState(0),[identifying,setIdentifying]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [sessionId,setSessionId]=useState<string|null>(null),[sessionCreatedAt,setSessionCreatedAt]=useState<string|null>(null),[history,setHistory]=useState<GroupScanHistoryItem[]>([]);
  const input=useRef<HTMLInputElement>(null),navigate=useNavigate();
  const visibleItems=items.filter(item=>!item.removed),savedCount=visibleItems.filter(item=>item.savedId).length,pendingCount=visibleItems.filter(item=>!item.savedId).length;
  const active=items.find(item=>item.key===activeKey&&!item.removed)??null,allFinished=visibleItems.length>0&&pendingCount===0;
  const editPanel=useRef<HTMLElement|null>(null);
  /**
   * The panel is below the photograph, so an automatic move to the next bottle
   * would otherwise happen off-screen. Only for a move the reader did not make
   * themselves - tapping a box already scrolls them to it.
   */
  useEffect(()=>{
    if(!activeKey||!editPanel.current)return;
    editPanel.current.scrollIntoView({behavior:'smooth',block:'nearest'});
  },[activeKey]);

  async function refreshHistory(){try{setHistory(await listGroupScanSessions())}catch{/* Recognition still works if history cannot be loaded. */}}
  // A wine saved from a group photo links back to /group-scan?session=<id>, so
  // the review it came from is restored rather than an empty page. Read once:
  // resuming again on a later render would pull the reader back to a session
  // they had moved on from.
  const [searchParams]=useSearchParams();
  const requestedSession=useRef(searchParams.get('session')).current;
  useEffect(()=>{
    void refreshHistory();
    if(requestedSession)void resumeStored(requestedSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{
    if(!sessionId||!sessionCreatedAt||!photo||!items.length)return;
    const timer=window.setTimeout(()=>{void saveGroupScanSession({id:sessionId,createdAt:sessionCreatedAt,updatedAt:new Date().toISOString(),photo:photo.file,recognitionPhoto:photo.recognitionFile,metadata:photo.metadata,width:photo.width,height:photo.height,unresolvedCount,items:items.map(item=>({key:item.key,recognition:item.recognition,crop:item.crop,savedId:item.savedId,removed:item.removed,manual:item.manual}))}).then(refreshHistory).catch(e=>setError((e as Error).message||'Could not save Group Photo history'))},180);
    return()=>window.clearTimeout(timer);
  },[sessionId,sessionCreatedAt,photo,items,unresolvedCount]);

  async function choose(file:File|undefined){
    if(!file)return;setError('');setNotice('');setItems([]);setActiveKey(null);setUnresolvedCount(0);setSessionId(null);setSessionCreatedAt(null);
    try{
      const [metadata,prepared]=await Promise.all([extractPhotoMetadata(file),prepareRecognitionImageWithinBytes(file,GROUP_RECOGNITION_TARGET_BYTES)]),preview=URL.createObjectURL(file);
      setPhoto(current=>{if(current?.preview)URL.revokeObjectURL(current.preview);return {file,recognitionFile:prepared.file,metadata,preview,width:prepared.width,height:prepared.height}});
      setNotice(`Recognition copy prepared at ${(prepared.file.size/1048576).toFixed(1)} MB. After identification, WineLog stores one server-side Group Photo session so you can resume it on another device.`);
    }catch(e){setError((e as Error).message||'Could not prepare this group photo')}
  }

  async function identify(){
    if(!photo||identifying)return;setIdentifying(true);setError('');setNotice('');setItems([]);setActiveKey(null);setUnresolvedCount(0);
    try{
      if(photo.recognitionFile.size>GROUP_RECOGNITION_TARGET_BYTES)throw new Error(`Recognition copy is still too large (${(photo.recognitionFile.size/1048576).toFixed(1)} MB). Choose the photo again so WineLog can recompress it.`);
      const fd=new FormData();fd.append('images',photo.recognitionFile);fd.append('metadata',JSON.stringify([photo.metadata]));
      const response=await fetch('/api/recognition',{method:'POST',headers:{...authHeaders(),'X-WineLog-Recognition-Mode':'group'},body:fd}),payload=await readResponse(response);
      if(response.status===401){clearSession();navigate('/login',{replace:true});return}if(!response.ok)throw new Error(readError(payload));
      const result=groupRecognitionSchema.parse(payload),aligned=await Promise.all(result.wines.map(alignToExistingCuvee));
      const reviewed=await Promise.all(aligned.map(async wine=>{const crop=await cropGroupPhoto(photo.file,wine.boundingBox,photo.metadata),cropPreview=await asDataUrl(crop.file);return {key:crypto.randomUUID(),recognition:wine,crop,cropPreview,savedId:null,removed:false,manual:false,saved:null} satisfies ReviewItem}));
      const id=crypto.randomUUID(),createdAt=new Date().toISOString();setSessionId(id);setSessionCreatedAt(createdAt);setItems(reviewed);setUnresolvedCount(result.unresolvedCount);setActiveKey(reviewed[0]?.key??null);
      const duration=result.recognitionDurationMs!=null?` in ${(result.recognitionDurationMs/1000).toFixed(1)}s`:'';setNotice(`${reviewed.length} distinct wine${reviewed.length===1?'':'s'} identified${duration}. The source group photo and review state are being saved to server history.`);
      if(!reviewed.length)setError('No wine could be identified confidently from this group photo. You can add missed wines manually or choose a clearer photo.');
    }catch(e){setError((e as Error).message||'Group recognition failed unexpectedly')}finally{setIdentifying(false)}
  }

  async function resumeStored(id:string){
    setError('');setNotice('');
    try{
      const stored=await getGroupScanSession(id);if(!stored)throw new Error('This Group Photo session is no longer available.');
      const preview=URL.createObjectURL(stored.recognitionPhoto),restored=await Promise.all(stored.items.map(async item=>({...item,saved:null,cropPreview:item.crop?await asDataUrl(item.crop.file):null} satisfies ReviewItem)));
      setPhoto(current=>{if(current?.preview)URL.revokeObjectURL(current.preview);return {file:stored.photo,recognitionFile:stored.recognitionPhoto,metadata:stored.metadata,preview,width:stored.width,height:stored.height}});setSessionId(stored.id);setSessionCreatedAt(stored.createdAt);setItems(restored);setUnresolvedCount(stored.unresolvedCount);setActiveKey(restored.find(item=>!item.removed&&!item.savedId)?.key??null);
      setNotice(`Restored ${restored.filter(item=>!item.removed).length} wine${restored.filter(item=>!item.removed).length===1?'':'s'} from server history. Saved and pending review states were preserved.`);
    }catch(e){setError((e as Error).message||'Could not restore this group scan')}
  }
  async function removeStored(id:string){
    if(!confirm('Remove this unsaved Group Photo history entry from the server? Saved wines are never deleted.'))return;
    try{await deleteGroupScanSession(id);if(sessionId===id){setSessionId(null);setSessionCreatedAt(null);setItems([]);setActiveKey(null);setUnresolvedCount(0)}await refreshHistory()}catch(e){setError((e as Error).message||'Could not remove group scan history')}
  }
  function removeItem(key:string){setItems(current=>current.map(item=>item.key===key?{...item,removed:true}:item));if(activeKey===key)setActiveKey(null)}
  function addMissedWine(){const item:ReviewItem={key:crypto.randomUUID(),recognition:null,crop:null,cropPreview:null,savedId:null,removed:false,manual:true,saved:null};setItems(current=>[...current,item]);setActiveKey(item.key)}
  async function markSaved(key:string,id:string,saved?:SavedWineIdentity){
    /**
     * Straight on to the next bottle rather than back to nothing.
     *
     * Saving cleared the selection, so the panel closed and the next wine meant
     * scrolling back up the photograph to find its Review button - eight times
     * for a lineup of eight. The order is the order they are listed in, wrapping
     * once, so a bottle skipped earlier is come back to rather than stranded.
     */
    setItems(current=>{
      const next=current.map(item=>item.key===key
        ?{...item,savedId:id,saved:saved??item.saved,recognition:savedRecognition(item.recognition,saved)}
        :item);
      setActiveKey(nextPendingKey(next,key));
      return next;
    });
    if(!sessionId)return;
    try{await linkGroupScanWine(sessionId,key,id);setNotice('Wine saved. Its bottle crop is the primary wine photo and the original Group Photo is retained as secondary source context.');await refreshHistory()}catch(e){setError((e as Error).message||'Wine saved, but its Group Photo source could not be linked')}
  }

  const initial=useMemo<Partial<WineInput>>(()=>{
    if(!active)return {};const r=active.recognition,m=photo?.metadata;
    if(!r)return {tastingDate:m?.capturedAt?.slice(0,10)??null,latitude:m?.latitude??null,longitude:m?.longitude??null,recognitionStatus:'review'};
    return {producer:r.producer,wineName:r.wineName,vintage:r.vintage??null,country:r.country??null,region:r.region??null,appellation:r.appellation??null,recognizedRegion:r.recognizedRegion??null,recognizedAppellation:r.recognizedAppellation??null,grapes:r.grapes,grapeBlend:r.grapeBlend,wineStyle:r.style??null,alcoholPercentage:r.alcoholPercentage??null,tastingDate:m?.capturedAt?.slice(0,10)??null,locationName:r.locationName??null,latitude:m?.latitude??null,longitude:m?.longitude??null,tags:derivedTags({country:r.country,region:r.region,appellation:r.appellation,grapes:r.grapes,style:r.style}),recognitionConfidence:r.confidence,recognitionStatus:'review'};
  },[active,photo]);

  return <section className="group-scan-page">
    <div className="hero compact"><p className="eyebrow">GROUP PHOTO</p><h1>One photo, several wines.</h1><p>Use this when a single table or lineup photo contains multiple different wines. WineLog detects distinct bottles, creates a crop for each wine, and keeps every result separate for review and logging.</p></div>
    {!photo?<div className="photo-source-card group-photo-source"><div className="scan-mark"><AppIcon kind="group-photo"/></div><h2>Choose one group photo</h2><p>Best results come from a clear lineup where labels are reasonably visible. Duplicate bottles of the same wine are logged once.</p><button type="button" className="scan-button primary" onClick={()=>input.current?.click()}>Choose group photo</button><input ref={input} className="visually-hidden" type="file" accept="image/*" onChange={e=>void choose(e.target.files?.[0])}/></div>:
    <><div className="group-photo-stage"><img src={photo.preview} alt="Group of wines to identify"/>{items.filter(item=>!item.removed&&item.recognition).map((item,index)=>{const box=item.recognition!.boundingBox;return <button key={item.key} type="button" className={`group-photo-box${item.savedId?' saved':''}${activeKey===item.key?' active':''}`} style={{left:`${box.xMin/10}%`,top:`${box.yMin/10}%`,width:`${(box.xMax-box.xMin)/10}%`,height:`${(box.yMax-box.yMin)/10}%`}} onClick={()=>setActiveKey(item.key)} aria-label={`Review detected wine ${index+1}`}><span>{index+1}</span></button>})}</div><div className="group-scan-actions"><button type="button" className="wide-action primary" disabled={identifying} onClick={()=>void identify()}>{identifying?'Identifying distinct wines…':items.length?'Run recognition again':'Identify wines in this photo'}</button><button type="button" className="rescan-link" disabled={identifying} onClick={()=>input.current?.click()}>Choose different group photo</button><input ref={input} className="visually-hidden" type="file" accept="image/*" onChange={e=>void choose(e.target.files?.[0])}/></div></>}
    {notice&&<p className="producer-notice" role="status">{notice}</p>}{error&&<p className="scan-error" role="alert">{error}</p>}
    {unresolvedCount>0&&<p className="group-unresolved">Gemini saw {unresolvedCount} additional bottle{unresolvedCount===1?'':'s'} it could not identify confidently. Do not guess — use <strong>Add missed wine</strong> below if you can identify them yourself.</p>}
    {items.length>0&&<section className="group-review"><div className="group-review-head"><div><p className="eyebrow">REVIEW</p><h2>{visibleItems.length} wine{visibleItems.length===1?'':'s'} · {savedCount} saved</h2></div><button type="button" className="secondary-button" onClick={addMissedWine}>+ Add missed wine</button></div><div className="group-result-list">{items.map((item,index)=>item.removed?null:<article className={`group-result-card${item.savedId?' saved':''}${activeKey===item.key?' active':''}`} key={item.key}>{item.cropPreview?<img src={item.cropPreview} alt={item.recognition?`${item.recognition.wineName} crop`:'Detected wine crop'}/>:<div className="group-manual-thumb">＋</div>}<div className="group-result-copy"><span>{item.manual?'Manual addition':`Wine ${index+1}`}{item.recognition&&!item.savedId?` · ${Math.round(item.recognition.confidence*100)}% confidence`:''}</span><strong>{item.saved?.wineName||item.recognition?.wineName||'Missed wine'}</strong><small>{item.saved?.producer||item.recognition?.producer||'Enter the producer and wine name yourself'}</small></div><div className="group-result-actions">{item.savedId?<><span className="group-saved-mark">Saved ✓</span><button type="button" onClick={()=>navigate(`/wines/${item.savedId}`,{state:linkFrom({to:sessionId?`/group-scan?session=${sessionId}`:'/group-scan',label:'Group photo'})})}>Open</button></>:<><button type="button" onClick={()=>setActiveKey(activeKey===item.key?null:item.key)}>{activeKey===item.key?'Close':'Review'}</button><button type="button" className="secondary-danger" onClick={()=>removeItem(item.key)}>Remove</button></>}</div></article>)}</div></section>}
    {active&&!active.savedId&&!active.removed&&<section className="group-edit-panel" ref={editPanel}><div className="group-edit-head"><div><p className="eyebrow">{active.manual?'MANUAL ADDITION':'CHECK DETECTION'}</p><h2>{active.recognition?.wineName||'Add missed wine'}</h2></div>{active.cropPreview&&<img src={active.cropPreview} alt="Crop used for this wine"/>}</div><p>Review this wine independently. The bottle crop becomes the primary wine photo. The full Group Photo is stored once and, after save, remains linked on the wine detail page as secondary source context.</p><WineForm key={active.key} initial={initial} photos={active.crop?[active.crop]:[]} submitLabel="Save this wine" onSaved={(id,saved)=>{void markSaved(active.key,id,saved)}}/></section>}
    {allFinished&&<div className="producer-notice group-complete"><strong>Group photo complete.</strong><span>{savedCount} wine{savedCount===1?'':'s'} saved. The source Group Photo is retained and linked to those wine records.</span><button type="button" className="primary" onClick={()=>navigate('/journal')}>Open Journal</button></div>}
    {history.length>0&&<section className="group-history"><div className="group-history-head"><div><p className="eyebrow">RECENT GROUP SCANS</p><h2>Resume without scanning again.</h2></div><small>Server history · available across devices</small></div><div className="group-history-list">{history.map(entry=><article key={entry.id} className={`group-history-card${sessionId===entry.id?' current':''}`}><div><strong>{entry.firstWineName||`${entry.totalItems} detected wines`}</strong><span>{new Date(entry.updatedAt).toLocaleString()} · {entry.savedItems} saved · {entry.pendingItems} pending{entry.retained?' · source retained':''}</span></div><div><button type="button" onClick={()=>void resumeStored(entry.id)}>{sessionId===entry.id?'Reload':'Resume'}</button>{!entry.retained&&<button type="button" className="secondary-danger" onClick={()=>void removeStored(entry.id)}>Remove</button>}</div></article>)}</div></section>}
  </section>;
}
