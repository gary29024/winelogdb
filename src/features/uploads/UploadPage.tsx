import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WineForm } from '../wines/WineForm';
import { recognitionSchema, type RecognitionResult } from '../recognition/schema';
import { extractPhotoMetadata, type PhotoMetadata } from './photoMetadata';
import { prepareRecognitionImage } from './prepareImage';
import { authHeaders,clearSession } from '../../lib/auth/client';

type Item={file:File;recognitionFile?:File;preview:string;status:string;progress:number;error?:string;metadata?:PhotoMetadata;width?:number;height?:number};
const readError=(value:unknown)=>typeof value==='object'&&value!==null&&'error' in value&&typeof value.error==='string'?value.error:'Request failed';
function suggestedTags(result:RecognitionResult){
  const candidates=[result.country,result.region,result.appellation,...result.grapes,result.style];
  const seen=new Set<string>();
  return candidates.filter((x):x is string=>Boolean(x)).map(x=>x.trim()).filter(x=>{const k=x.toLocaleLowerCase();if(!x||seen.has(k))return false;seen.add(k);return true}).slice(0,8);
}

export function UploadPage(){
  const [items,setItems]=useState<Item[]>([]),[review,setReview]=useState<RecognitionResult>(),[scanError,setScanError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const location=useLocation(),navigate=useNavigate();
  function failAll(message:string){setItems(xs=>xs.map(x=>({...x,status:'failed',progress:0,error:message})));setScanError(message)}

  async function choose(files:File[]){
    if(!files.length)return;
    const selected=files.map(file=>({file,preview:URL.createObjectURL(file),status:'preparing',progress:10} as Item));
    setScanError('');setReview(undefined);setItems(selected);
    try{
      const [metadata,prepared]=await Promise.all([
        Promise.all(selected.map(x=>extractPhotoMetadata(x.file))),
        Promise.all(selected.map(x=>prepareRecognitionImage(x.file)))
      ]);
      setItems(xs=>xs.map((x,i)=>({...x,metadata:metadata[i],recognitionFile:prepared[i].file,width:prepared[i].width,height:prepared[i].height,status:'ready to identify',progress:25,error:undefined})));
    }catch(e){failAll((e as Error).message||'Could not prepare the selected photos')}
  }

  useEffect(()=>{
    const incoming=(location.state as {scanFiles?:File[]}|null)?.scanFiles;
    if(incoming?.length){void choose(incoming);navigate(location.pathname,{replace:true,state:null})}
  // The route state is consumed once on entry from the bottom-sheet picker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  async function identify(){
    try{
      setScanError('');setReview(undefined);
      if(items.some(x=>!x.recognitionFile||!x.width||!x.height)){failAll('One or more photos are not ready. Choose the photos again.');return}
      setItems(xs=>xs.map(x=>({...x,status:'recognizing together',progress:60,error:undefined})));
      const fd=new FormData();
      items.forEach(x=>fd.append('images',x.recognitionFile!));
      fd.append('metadata',JSON.stringify(items.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));
      const rr=await fetch('/api/recognition',{method:'POST',headers:authHeaders(),body:fd});
      const response:unknown=await rr.json().catch(()=>({error:`Recognition failed (${rr.status})`}));
      if(rr.status===401){clearSession();navigate('/login',{replace:true});return}
      if(!rr.ok){failAll(readError(response));return}
      const result=recognitionSchema.parse(response);
      setItems(xs=>xs.map(x=>({...x,status:'identified',progress:100,error:undefined})));
      setReview(result);
    }catch(e){failAll((e as Error).message||'Recognition failed unexpectedly')}
  }

  const photos=items.filter(x=>x.width&&x.height).map(x=>({file:x.file,metadata:x.metadata,width:x.width!,height:x.height!}));

  return <section className="scan-page">
    <div className="hero compact"><p className="eyebrow">SCAN WINE</p><h1>One wine, every useful label.</h1><p>Select the front, back, neck or additional labels together. WineLog sends the set to Gemini as one bottle, while the original photos stay on your device until you save the wine.</p></div>
    {items.length===0&&<div className="photo-source-card">
      <div className="scan-mark">＋</div>
      <h2>Scan a wine</h2>
      <p>Choose one or more photos of the same bottle. Your device chooser can use the camera, photo library or files.</p>
      <button type="button" className="scan-button" onClick={()=>input.current?.click()}>Scan Wine</button>
      <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/>
    </div>}
    {items.length>0&&<><div className="scan-summary"><strong>{items.length} photo{items.length===1?'':'s'} selected</strong><span>Recognition uses resized copies in one API call. Nothing is stored in R2 yet.</span></div><ul className="upload-list" aria-live="polite">{items.map((x,i)=><li key={x.preview}><img src={x.preview} alt={`Wine label ${i+1}`}/><div><strong>{i===0?'Primary label':`Additional label ${i+1}`}</strong><span>{x.status}{x.error&&`: ${x.error}`}</span>{x.metadata?.capturedAt&&<small>Photo date: {new Date(x.metadata.capturedAt).toLocaleString()}</small>}<progress value={x.progress} max="100">{x.progress}%</progress></div></li>)}</ul>{scanError&&<p role="alert" className="scan-error">{scanError}</p>}<button className="wide-action" onClick={identify} disabled={items.some(x=>x.status==='preparing'||x.status==='recognizing together')}>Identify this wine</button><button type="button" className="rescan-link" onClick={()=>input.current?.click()}>Choose different photos</button><input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/></>}
    {review&&<div className="review"><p className="eyebrow">REVIEW</p><h2>Combined identification</h2><p>Gemini interpreted all selected labels together. Correct anything before saving. The original photos are written to R2 only after the wine is successfully logged.</p><WineForm photos={photos} initial={{producer:review.producer??'',wineName:review.wineName??'',vintage:review.vintage,country:review.country,region:review.region,appellation:review.appellation,grapes:review.grapes,grapeBlend:review.grapeBlend,wineStyle:review.style,alcoholPercentage:review.alcoholPercentage,tastingDate:review.tastingDate,locationName:review.locationName,latitude:review.latitude,longitude:review.longitude,tags:suggestedTags(review),recognitionConfidence:review.confidence,recognitionStatus:'review'}}/></div>}
  </section>
}
