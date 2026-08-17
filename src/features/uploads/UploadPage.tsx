import { useState } from 'react';
import { WineForm } from '../wines/WineForm';
import { recognitionSchema, type RecognitionResult } from '../recognition/schema';
import { extractPhotoMetadata, type PhotoMetadata } from './photoMetadata';

type Item={file:File;preview:string;status:string;progress:number;id?:string;error?:string;result?:RecognitionResult;metadata?:PhotoMetadata};
type UploadResult={id?:string;status:string;error?:string};
type UploadResponse={results:UploadResult[]};
const readError=(value:unknown)=>typeof value==='object'&&value!==null&&'error' in value&&typeof value.error==='string'?value.error:'Recognition failed';
const token=()=>`Bearer ${localStorage.getItem('session')??''}`;
async function dimensions(file:File){return new Promise<{width:number;height:number}>((resolve,reject)=>{const img=new Image();img.onload=()=>{resolve({width:img.naturalWidth,height:img.naturalHeight});URL.revokeObjectURL(img.src)};img.onerror=reject;img.src=URL.createObjectURL(file)})}

export function UploadPage(){
  const [items,setItems]=useState<Item[]>([]),[review,setReview]=useState<RecognitionResult>();
  function patch(i:number,p:Partial<Item>){setItems(xs=>xs.map((x,n)=>n===i?{...x,...p}:x))}

  async function choose(files:FileList|null){
    if(!files)return;
    const selected=[...files].map(file=>({file,preview:URL.createObjectURL(file),status:'reading metadata',progress:5} as Item));
    setItems(selected);
    const metadata=await Promise.all(selected.map(x=>extractPhotoMetadata(x.file)));
    setItems(xs=>xs.map((x,i)=>({...x,metadata:metadata[i],status:'queued',progress:10})));
  }

  async function upload(){
    const fd=new FormData();
    items.forEach(x=>fd.append('images',x.file));
    fd.append('dimensions',JSON.stringify(await Promise.all(items.map(x=>dimensions(x.file)))));
    fd.append('metadata',JSON.stringify(items.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null})));
    items.forEach((_,i)=>patch(i,{status:'uploading',progress:30}));
    const r=await fetch('/api/uploads',{method:'POST',headers:{Authorization:token()},body:fd}),body=await r.json() as UploadResponse;
    body.results.forEach((x,i)=>patch(i,{...x,progress:x.status==='uploaded'?60:0}));
    for(let i=0;i<body.results.length;i++){
      const x=body.results[i];if(!x.id)continue;
      patch(i,{status:'recognizing',progress:75});
      const rr=await fetch(`/api/recognition/${x.id}`,{method:'POST',headers:{Authorization:token()}});
      const response:unknown=await rr.json();
      if(rr.ok){const result=recognitionSchema.parse(response);patch(i,{status:'ready',progress:100,result});setReview(current=>current??result)}
      else patch(i,{status:'failed',error:readError(response),progress:60});
    }
  }

  return <section>
    <div className="hero compact"><p className="eyebrow">LABEL RECOGNITION</p><h1>Add a tasting, from label to library.</h1><p>Photo date and GPS are read first, then Gemini uses them as context for the drinking date and location suggestion.</p></div>
    <label className="dropzone"><strong>Choose label photos</strong><span>JPEG, PNG, WebP or HEIC · 10 MB max each</span><input type="file" accept="image/*" capture="environment" multiple onChange={e=>void choose(e.target.files)}/></label>
    {items.length>0&&<><ul className="upload-list" aria-live="polite">{items.map((x,i)=><li key={x.preview}><img src={x.preview} alt="Selected wine label preview"/><div><strong>{x.file.name}</strong><span>{x.status}{x.error&&`: ${x.error}`}</span>{x.metadata?.capturedAt&&<small>Photo date: {new Date(x.metadata.capturedAt).toLocaleString()}</small>}{x.metadata?.latitude!=null&&x.metadata?.longitude!=null&&<small>GPS: {x.metadata.latitude.toFixed(4)}, {x.metadata.longitude.toFixed(4)}</small>}<progress value={x.progress} max="100">{x.progress}%</progress></div>{x.status==='failed'&&<button onClick={upload}>Retry</button>}{x.result&&<button onClick={()=>setReview(x.result)}>Review</button>}</li>)}</ul><button onClick={upload} disabled={items.some(x=>x.status==='uploading'||x.status==='reading metadata')}>Upload & recognize</button></>}
    {review&&<div className="review"><h2>Review recognized details</h2><p>Photo metadata is deterministic when available; Gemini's label and place interpretation remains a suggestion. Correct anything before saving.</p><WineForm initial={{producer:review.producer??'',wineName:review.wineName??'',vintage:review.vintage,country:review.country,region:review.region,appellation:review.appellation,grapes:review.grapes,wineStyle:review.style,alcoholPercentage:review.alcoholPercentage,tastingDate:review.tastingDate,locationName:review.locationName,latitude:review.latitude,longitude:review.longitude,recognitionConfidence:review.confidence,recognitionStatus:'review'}}/></div>}
  </section>
}
