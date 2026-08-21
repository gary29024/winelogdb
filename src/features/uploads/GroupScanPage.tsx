import { useMemo,useRef,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WineForm } from '../wines/WineForm';
import type { WineInput } from '../../lib/db/schema';
import type { WinePhoto } from '../wines/api';
import { groupRecognitionSchema,type GroupRecognitionWine } from '../recognition/groupSchema';
import { authHeaders,clearSession } from '../../lib/auth/client';
import { extractPhotoMetadata,type PhotoMetadata } from './photoMetadata';
import { prepareRecognitionImageWithinBytes } from './prepareImage';
import { cropGroupPhoto } from './cropGroupPhoto';
import '../../groupScan.css';

const GROUP_RECOGNITION_TARGET_BYTES=Math.floor(2.5*1024*1024);
type SourcePhoto={file:File;recognitionFile:File;metadata:PhotoMetadata;preview:string;width:number;height:number};
type ReviewItem={key:string;recognition:GroupRecognitionWine|null;crop:WinePhoto|null;cropPreview:string|null;savedId:string|null;removed:boolean;manual:boolean};
type ErrorBody={error?:unknown;requestId?:unknown};

function readError(value:unknown){const body=typeof value==='object'&&value!==null?value as ErrorBody:{};const message=typeof body.error==='string'?body.error:'Request failed';return typeof body.requestId==='string'?`${message} · Request ${body.requestId}`:message}
async function readResponse(response:Response){
  const requestId=response.headers.get('X-WineLog-Request-Id')??undefined,text=await response.text();
  if(!text)return {error:`Group recognition failed (${response.status})`,requestId};
  try{return JSON.parse(text) as unknown}catch{return {error:text.slice(0,700),requestId}}
}
function suggestedTags(result:GroupRecognitionWine){const seen=new Set<string>();return [result.country,result.region,result.appellation,...result.grapes,result.style].filter((x):x is string=>Boolean(x)).map(x=>x.trim()).filter(x=>{const key=x.toLowerCase();if(!x||seen.has(key))return false;seen.add(key);return true}).slice(0,8)}
function asDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??''));reader.onerror=()=>reject(new Error('Could not preview detected crop'));reader.readAsDataURL(file)})}

export function GroupScanPage(){
  const [photo,setPhoto]=useState<SourcePhoto|null>(null),[items,setItems]=useState<ReviewItem[]>([]),[activeKey,setActiveKey]=useState<string|null>(null),[unresolvedCount,setUnresolvedCount]=useState(0),[identifying,setIdentifying]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const input=useRef<HTMLInputElement>(null),navigate=useNavigate();
  const visibleItems=items.filter(item=>!item.removed),savedCount=visibleItems.filter(item=>item.savedId).length,pendingCount=visibleItems.filter(item=>!item.savedId).length;
  const active=items.find(item=>item.key===activeKey&&!item.removed)??null;
  const allFinished=visibleItems.length>0&&pendingCount===0;

  async function choose(file:File|undefined){
    if(!file)return;setError('');setNotice('');setItems([]);setActiveKey(null);setUnresolvedCount(0);
    try{
      const [metadata,prepared]=await Promise.all([extractPhotoMetadata(file),prepareRecognitionImageWithinBytes(file,GROUP_RECOGNITION_TARGET_BYTES)]);
      const preview=URL.createObjectURL(file);setPhoto(current=>{if(current?.preview)URL.revokeObjectURL(current.preview);return {file,recognitionFile:prepared.file,metadata,preview,width:prepared.width,height:prepared.height}});
      setNotice(`Recognition copy prepared at ${(prepared.file.size/1048576).toFixed(1)} MB. The original photo stays local for bottle crops.`);
    }catch(e){setError((e as Error).message||'Could not prepare this group photo')}
  }

  async function identify(){
    if(!photo||identifying)return;setIdentifying(true);setError('');setNotice('');setItems([]);setActiveKey(null);setUnresolvedCount(0);
    try{
      if(photo.recognitionFile.size>GROUP_RECOGNITION_TARGET_BYTES)throw new Error(`Recognition copy is still too large (${(photo.recognitionFile.size/1048576).toFixed(1)} MB). Choose the photo again so WineLog can recompress it.`);
      const fd=new FormData();fd.append('images',photo.recognitionFile);fd.append('metadata',JSON.stringify([photo.metadata]));
      const response=await fetch('/api/recognition',{method:'POST',headers:{...authHeaders(),'X-WineLog-Recognition-Mode':'group'},body:fd});
      const payload=await readResponse(response);
      if(response.status===401){clearSession();navigate('/login',{replace:true});return}
      if(!response.ok)throw new Error(readError(payload));
      const result=groupRecognitionSchema.parse(payload);
      const reviewed=await Promise.all(result.wines.map(async wine=>{
        const crop=await cropGroupPhoto(photo.file,wine.boundingBox,photo.metadata),cropPreview=await asDataUrl(crop.file);
        return {key:crypto.randomUUID(),recognition:wine,crop,cropPreview,savedId:null,removed:false,manual:false} satisfies ReviewItem;
      }));
      setItems(reviewed);setUnresolvedCount(result.unresolvedCount);setActiveKey(reviewed[0]?.key??null);
      const duration=result.recognitionDurationMs!=null?` in ${(result.recognitionDurationMs/1000).toFixed(1)}s`:'';
      setNotice(`${reviewed.length} distinct wine${reviewed.length===1?'':'s'} identified${duration}. Review each result before saving.`);
      if(!reviewed.length)setError('No wine could be identified confidently from this group photo. You can add missed wines manually or choose a clearer photo.');
    }catch(e){setError((e as Error).message||'Group recognition failed unexpectedly')}
    finally{setIdentifying(false)}
  }

  function removeItem(key:string){setItems(current=>current.map(item=>item.key===key?{...item,removed:true}:item));if(activeKey===key)setActiveKey(null)}
  function addMissedWine(){const item:ReviewItem={key:crypto.randomUUID(),recognition:null,crop:null,cropPreview:null,savedId:null,removed:false,manual:true};setItems(current=>[...current,item]);setActiveKey(item.key)}
  function markSaved(key:string,id:string){setItems(current=>current.map(item=>item.key===key?{...item,savedId:id}:item));setActiveKey(null)}

  const initial=useMemo<Partial<WineInput>>(()=>{
    if(!active)return {};
    const r=active.recognition,m=photo?.metadata;
    if(!r)return {tastingDate:m?.capturedAt?.slice(0,10)??null,latitude:m?.latitude??null,longitude:m?.longitude??null,recognitionStatus:'review'};
    return {producer:r.producer,wineName:r.wineName,vintage:r.vintage??null,country:r.country??null,region:r.region??null,appellation:r.appellation??null,grapes:r.grapes,grapeBlend:r.grapeBlend,wineStyle:r.style??null,alcoholPercentage:r.alcoholPercentage??null,tastingDate:m?.capturedAt?.slice(0,10)??null,locationName:r.locationName??null,latitude:m?.latitude??null,longitude:m?.longitude??null,tags:suggestedTags(r),recognitionConfidence:r.confidence,recognitionStatus:'review'};
  },[active,photo]);

  return <section className="group-scan-page">
    <div className="hero compact"><p className="eyebrow">GROUP PHOTO</p><h1>One photo, several wines.</h1><p>Use this when a single table or lineup photo contains multiple different wines. WineLog detects distinct bottles, creates a crop for each wine, and keeps every result separate for review and logging.</p></div>

    {!photo?<div className="photo-source-card group-photo-source"><div className="scan-mark">▦</div><h2>Choose one group photo</h2><p>Best results come from a clear lineup where labels are reasonably visible. Duplicate bottles of the same wine are logged once.</p><button type="button" className="scan-button" onClick={()=>input.current?.click()}>Choose group photo</button><input ref={input} className="visually-hidden" type="file" accept="image/*" onChange={e=>void choose(e.target.files?.[0])}/></div>:
    <><div className="group-photo-stage"><img src={photo.preview} alt="Group of wines to identify"/>{items.filter(item=>!item.removed&&item.recognition).map((item,index)=>{const box=item.recognition!.boundingBox;return <button key={item.key} type="button" className={`group-photo-box${item.savedId?' saved':''}${activeKey===item.key?' active':''}`} style={{left:`${box.xMin/10}%`,top:`${box.yMin/10}%`,width:`${(box.xMax-box.xMin)/10}%`,height:`${(box.yMax-box.yMin)/10}%`}} onClick={()=>setActiveKey(item.key)} aria-label={`Review detected wine ${index+1}`}><span>{index+1}</span></button>})}</div>
      <div className="group-scan-actions"><button type="button" className="wide-action" disabled={identifying} onClick={()=>void identify()}>{identifying?'Identifying distinct wines…':items.length?'Run recognition again':'Identify wines in this photo'}</button><button type="button" className="rescan-link" disabled={identifying} onClick={()=>input.current?.click()}>Choose different group photo</button><input ref={input} className="visually-hidden" type="file" accept="image/*" onChange={e=>void choose(e.target.files?.[0])}/></div></>}

    {notice&&<p className="producer-notice" role="status">{notice}</p>}{error&&<p className="scan-error" role="alert">{error}</p>}
    {unresolvedCount>0&&<p className="group-unresolved">Gemini saw {unresolvedCount} additional bottle{unresolvedCount===1?'':'s'} it could not identify confidently. Do not guess — use <strong>Add missed wine</strong> below if you can identify them yourself.</p>}

    {items.length>0&&<section className="group-review"><div className="group-review-head"><div><p className="eyebrow">REVIEW</p><h2>{visibleItems.length} wine{visibleItems.length===1?'':'s'} · {savedCount} saved</h2></div><button type="button" className="secondary-button" onClick={addMissedWine}>+ Add missed wine</button></div>
      <div className="group-result-list">{items.map((item,index)=>item.removed?null:<article className={`group-result-card${item.savedId?' saved':''}${activeKey===item.key?' active':''}`} key={item.key}>{item.cropPreview?<img src={item.cropPreview} alt={item.recognition?`${item.recognition.wineName} crop`:'Detected wine crop'}/>:<div className="group-manual-thumb">＋</div>}<div className="group-result-copy"><span>{item.manual?'Manual addition':`Wine ${index+1}`}{item.recognition?` · ${Math.round(item.recognition.confidence*100)}% confidence`:''}</span><strong>{item.recognition?.wineName||'Missed wine'}</strong><small>{item.recognition?.producer||'Enter the producer and wine name yourself'}</small></div><div className="group-result-actions">{item.savedId?<><span className="group-saved-mark">Saved ✓</span><button type="button" onClick={()=>navigate(`/wines/${item.savedId}`)}>Open</button></>:<><button type="button" onClick={()=>setActiveKey(activeKey===item.key?null:item.key)}>{activeKey===item.key?'Close':'Review'}</button><button type="button" className="secondary-danger" onClick={()=>removeItem(item.key)}>Remove</button></>}</div></article>)}</div>
    </section>}

    {active&&!active.savedId&&!active.removed&&<section className="group-edit-panel"><div className="group-edit-head"><div><p className="eyebrow">{active.manual?'MANUAL ADDITION':'CHECK DETECTION'}</p><h2>{active.recognition?.wineName||'Add missed wine'}</h2></div>{active.cropPreview&&<img src={active.cropPreview} alt="Crop used for this wine"/>}</div><p>Review this wine independently. Saving it creates one normal WineLog record. For detected wines, only this bottle crop is attached — the full group photo is not duplicated across every record.</p><WineForm key={active.key} initial={initial} photos={active.crop?[active.crop]:[]} submitLabel="Save this wine" onSaved={id=>markSaved(active.key,id)}/></section>}

    {allFinished&&<div className="producer-notice group-complete"><strong>Group photo complete.</strong><span>{savedCount} wine{savedCount===1?'':'s'} saved as separate tasting records.</span><button type="button" onClick={()=>navigate('/journal')}>Open Journal</button></div>}
  </section>;
}
