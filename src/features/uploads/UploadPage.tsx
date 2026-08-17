import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WineForm } from '../wines/WineForm';
import { recognitionSchema, type RecognitionResult } from '../recognition/schema';
import { extractPhotoMetadata, type PhotoMetadata } from './photoMetadata';

type Item={file:File;preview:string;status:string;progress:number;id?:string;error?:string;result?:RecognitionResult;metadata?:PhotoMetadata};
type UploadResult={id?:string;status:string;error?:string};
type UploadResponse={results:UploadResult[]};
const readError=(value:unknown)=>typeof value==='object'&&value!==null&&'error' in value&&typeof value.error==='string'?value.error:'Recognition failed';
const token=()=>`Bearer ${localStorage.getItem('session')??''}`;
async function dimensions(file:File){return new Promise<{width:number;height:number}>((resolve,reject)=>{const img=new Image();img.onload=()=>{resolve({width:img.naturalWidth,height:img.naturalHeight});URL.revokeObjectURL(img.src)};img.onerror=reject;img.src=URL.createObjectURL(file)})}

const textKeys=['producer','wineName','country','region','appellation','style','locationName'] as const;
const metadataRank:Record<RecognitionResult['metadataSource'],number>={none:0,file_fallback:1,exif:2};
function mergeRecognition(results:RecognitionResult[]):RecognitionResult{
  const ranked=[...results].sort((a,b)=>b.confidence-a.confidence);
  const metadataSource=ranked.reduce<RecognitionResult['metadataSource']>((best,x)=>metadataRank[x.metadataSource]>metadataRank[best]?x.metadataSource:best,'none');
  const merged:RecognitionResult={grapes:[],grapeBlend:[],confidence:ranked[0]?.confidence??0,metadataSource};
  for(const key of textKeys){const value=ranked.find(x=>x[key])?.[key];if(value)Object.assign(merged,{[key]:value})}
  merged.vintage=ranked.find(x=>x.vintage!=null)?.vintage??null;
  merged.alcoholPercentage=ranked.find(x=>x.alcoholPercentage!=null)?.alcoholPercentage??null;
  merged.tastingDate=ranked.find(x=>x.tastingDate)?.tastingDate??null;
  merged.latitude=ranked.find(x=>x.latitude!=null)?.latitude??null;
  merged.longitude=ranked.find(x=>x.longitude!=null)?.longitude??null;
  const blend=new Map<string,{grape:string;percentage?:number|null}>();
  for(const result of ranked)for(const entry of result.grapeBlend){const key=entry.grape.toLowerCase();const existing=blend.get(key);if(!existing||existing.percentage==null&&entry.percentage!=null)blend.set(key,entry)}
  merged.grapeBlend=[...blend.values()];
  merged.grapes=[...new Set([...ranked.flatMap(x=>x.grapes),...merged.grapeBlend.map(x=>x.grape)])];
  return recognitionSchema.parse(merged);
}

export function UploadPage(){
  const [items,setItems]=useState<Item[]>([]),[review,setReview]=useState<RecognitionResult>();
  const input=useRef<HTMLInputElement>(null);
  const location=useLocation(),navigate=useNavigate();
  function patch(i:number,p:Partial<Item>){setItems(xs=>xs.map((x,n)=>n===i?{...x,...p}:x))}

  async function choose(files:File[]){
    if(!files.length)return;
    const selected=files.map(file=>({file,preview:URL.createObjectURL(file),status:'reading metadata',progress:5} as Item));
    setReview(undefined);setItems(selected);
    const metadata=await Promise.all(selected.map(x=>extractPhotoMetadata(x.file)));
    setItems(xs=>xs.map((x,i)=>({...x,metadata:metadata[i],status:'queued',progress:10})));
  }

  useEffect(()=>{
    const incoming=(location.state as {scanFiles?:File[]}|null)?.scanFiles;
    if(incoming?.length){void choose(incoming);navigate(location.pathname,{replace:true,state:null})}
  // The route state is consumed once on entry from the bottom-sheet picker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function upload(){
    const fd=new FormData();
    items.forEach(x=>fd.append('images',x.file));
    fd.append('dimensions',JSON.stringify(await Promise.all(items.map(x=>dimensions(x.file)))));
    fd.append('metadata',JSON.stringify(items.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null})));
    items.forEach((_,i)=>patch(i,{status:'uploading',progress:30}));
    const r=await fetch('/api/uploads',{method:'POST',headers:{Authorization:token()},body:fd}),body=await r.json() as UploadResponse;
    body.results.forEach((x,i)=>patch(i,{...x,progress:x.status==='uploaded'?60:0}));
    const recognized:RecognitionResult[]=[];
    for(let i=0;i<body.results.length;i++){
      const x=body.results[i];if(!x.id)continue;
      patch(i,{status:'recognizing',progress:75});
      const rr=await fetch(`/api/recognition/${x.id}`,{method:'POST',headers:{Authorization:token()}});
      const response:unknown=await rr.json();
      if(rr.ok){const result=recognitionSchema.parse(response);recognized.push(result);patch(i,{status:'ready',progress:100,result})}
      else patch(i,{status:'failed',error:readError(response),progress:60});
    }
    if(recognized.length)setReview(mergeRecognition(recognized));
  }

  return <section className="scan-page">
    <div className="hero compact"><p className="eyebrow">SCAN WINE</p><h1>One wine, every useful label.</h1><p>Select the front, back, neck or additional labels together. WineLog treats the whole selection as one bottle and combines complementary recognition results.</p></div>
    {items.length===0&&<div className="photo-source-card">
      <div className="scan-mark">＋</div>
      <h2>Scan a wine</h2>
      <p>Choose one or more photos of the same bottle. Your device chooser can use the camera, photo library or files.</p>
      <button type="button" className="scan-button" onClick={()=>input.current?.click()}>Scan Wine</button>
      <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/>
    </div>}
    {items.length>0&&<><div className="scan-summary"><strong>{items.length} photo{items.length===1?'':'s'} selected</strong><span>All photos will be interpreted as the same wine.</span></div><ul className="upload-list" aria-live="polite">{items.map((x,i)=><li key={x.preview}><img src={x.preview} alt={`Wine label ${i+1}`}/><div><strong>{i===0?'Primary label':`Additional label ${i+1}`}</strong><span>{x.status}{x.error&&`: ${x.error}`}</span>{x.metadata?.capturedAt&&<small>Photo date: {new Date(x.metadata.capturedAt).toLocaleString()}</small>}<progress value={x.progress} max="100">{x.progress}%</progress></div></li>)}</ul><button className="wide-action" onClick={upload} disabled={items.some(x=>x.status==='uploading'||x.status==='reading metadata')}>Identify this wine</button><button type="button" className="rescan-link" onClick={()=>input.current?.click()}>Choose different photos</button><input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/></>}
    {review&&<div className="review"><p className="eyebrow">REVIEW</p><h2>Combined identification</h2><p>WineLog merged the strongest details across all selected labels. Correct anything before saving.</p><WineForm initial={{producer:review.producer??'',wineName:review.wineName??'',vintage:review.vintage,country:review.country,region:review.region,appellation:review.appellation,grapes:review.grapes,grapeBlend:review.grapeBlend,wineStyle:review.style,alcoholPercentage:review.alcoholPercentage,tastingDate:review.tastingDate,locationName:review.locationName,latitude:review.latitude,longitude:review.longitude,recognitionConfidence:review.confidence,recognitionStatus:'review'}}/></div>}
  </section>
}
