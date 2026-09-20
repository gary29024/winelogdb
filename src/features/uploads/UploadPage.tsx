import { PageHeader } from '../../components/PageHeader';
import { apiFetch } from '../../lib/auth/client';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageLightbox } from '../../components/ImageLightbox';
import { WineForm } from '../wines/WineForm';
import { recognitionSchema, type RecognitionResult } from '../recognition/schema';
import { extractPhotoMetadata, type PhotoMetadata } from './photoMetadata';
import { derivedTags } from '../wines/wineTags';
import { prepareRecognitionImage } from './prepareImage';
import { authHeaders,clearSession } from '../../lib/auth/client';
import { AppIcon } from '../../components/AppIcons';
import { stripAiTransportMetadata } from '../../lib/credits/response';

type Item={file:File;recognitionFile?:File;preview:string;status:string;progress:number;error?:string;metadata?:PhotoMetadata;width?:number;height?:number};
type RecognitionErrorBody={error?:unknown;requestId?:unknown};
type LightboxPhoto={src:string;alt:string};
const readError=(value:unknown)=>{
  const body=typeof value==='object'&&value!==null?value as RecognitionErrorBody:{};
  const message=typeof body.error==='string'?body.error:'Request failed';
  return typeof body.requestId==='string'?`${message} · Support ID ${body.requestId}`:message;
};
async function readResponse(response:Response){
  const requestId=response.headers.get('X-WineLog-Request-Id')??undefined,text=await response.text();
  if(!text)return {error:`Recognition failed (${response.status})`,requestId};
  try{return JSON.parse(text) as unknown}catch{return {error:text.slice(0,700),requestId}}
}

export function UploadPage(){
  const [items,setItems]=useState<Item[]>([]),[review,setReview]=useState<RecognitionResult>(),[scanError,setScanError]=useState(''),[identifying,setIdentifying]=useState(false),[lightbox,setLightbox]=useState<LightboxPhoto|null>(null);
  const input=useRef<HTMLInputElement>(null);
  const navigate=useNavigate();
  function failAll(message:string){setItems(xs=>xs.map(x=>({...x,status:'failed',progress:0,error:message})));setScanError(message);setIdentifying(false)}

  async function choose(files:File[]){
    if(!files.length)return;
    const selected=files.map(file=>({file,preview:URL.createObjectURL(file),status:'preparing',progress:10} as Item));
    setScanError('');setReview(undefined);setLightbox(null);setItems(selected);
    try{
      const [metadata,prepared]=await Promise.all([
        Promise.all(selected.map(x=>extractPhotoMetadata(x.file))),
        Promise.all(selected.map(x=>prepareRecognitionImage(x.file)))
      ]);
      setItems(xs=>xs.map((x,i)=>({...x,metadata:metadata[i],recognitionFile:prepared[i].file,width:prepared[i].width,height:prepared[i].height,status:'ready to identify',progress:25,error:undefined})));
    }catch(e){failAll((e as Error).message||'Could not prepare the selected photos')}
  }

  async function identify(){
    let slowTimer:number|undefined;
    try{
      setScanError('');setReview(undefined);setLightbox(null);
      if(items.some(x=>!x.recognitionFile||!x.width||!x.height)){failAll('One or more photos are not ready. Choose the photos again.');return}
      setIdentifying(true);
      setItems(xs=>xs.map(x=>({...x,status:'recognizing together',progress:60,error:undefined})));
      slowTimer=window.setTimeout(()=>setItems(xs=>xs.map(x=>({...x,status:'still identifying — taking longer than usual',progress:75}))),30_000);
      const fd=new FormData();
      items.forEach(x=>fd.append('images',x.recognitionFile!));
      fd.append('metadata',JSON.stringify(items.map(x=>x.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));
      const rr=await apiFetch('/api/recognition',{method:'POST',headers:authHeaders(),body:fd});
      const response=await readResponse(rr);
      if(rr.status===401){clearSession();navigate('/login',{replace:true});return}
      if(!rr.ok){failAll(readError(response));return}
      const result=recognitionSchema.parse(stripAiTransportMetadata(response));
      const duration=result.recognitionDurationMs!=null?` in ${(result.recognitionDurationMs/1000).toFixed(1)}s`:'';
      setItems(xs=>xs.map(x=>({...x,status:`identified${duration}`,progress:100,error:undefined})));
      setReview(result);
    }catch(e){failAll((e as Error).message||'Recognition failed unexpectedly')}
    finally{if(slowTimer!==undefined)window.clearTimeout(slowTimer);setIdentifying(false)}
  }

  const photos=items.filter(x=>x.width&&x.height).map(x=>({file:x.file,metadata:x.metadata,width:x.width!,height:x.height!}));

  return <section className="scan-page">
    <PageHeader title="Scan a wine" subtitle="Select the front, back, neck or additional labels together. WineLog reads them as one bottle, then lets you review everything before saving."/>
    {items.length===0&&<div className="photo-source-card">
      <div className="scan-mark"><AppIcon kind="scan"/></div>
      <h2>Scan a wine</h2>
      <p>Choose one or more photos of the same bottle. Your device chooser can use the camera, photo library or files.</p>
      <button type="button" className="scan-button primary" onClick={()=>input.current?.click()}>Scan Wine</button>
      <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/>
    </div>}
    {items.length>0&&<><div className="scan-summary"><strong>{items.length} photo{items.length===1?'':'s'} selected</strong><span>{review?'Identification complete · tap a photo to enlarge it':'Ready to identify · nothing is saved until you confirm the wine.'}</span></div><ul className="upload-list" aria-live="polite">{items.map((x,i)=>{const alt=`Wine label ${i+1}`;return <li key={x.preview}>{review?<button type="button" className="photo-lightbox-trigger" onClick={()=>setLightbox({src:x.preview,alt})} aria-label={`Enlarge ${alt}`}><img src={x.preview} alt={alt}/></button>:<img src={x.preview} alt={alt}/>}<div><strong>{i===0?'Primary label':`Additional label ${i+1}`}</strong><span>{x.status}{x.error&&`: ${x.error}`}</span>{x.metadata?.capturedAt&&<small>Photo date: {new Date(x.metadata.capturedAt).toLocaleString()}</small>}{x.metadata?.latitude!=null&&x.metadata?.longitude!=null&&<small>Photo GPS: {x.metadata.latitude.toFixed(6)}, {x.metadata.longitude.toFixed(6)}</small>}<progress value={x.progress} max="100">{x.progress}%</progress></div></li>})}</ul>{scanError&&<p role="alert" className="scan-error">{scanError}</p>}<button className="wide-action primary" onClick={identify} disabled={identifying||items.some(x=>x.status==='preparing')}>{identifying?'Identifying…':'Identify this wine'}</button><button type="button" className="rescan-link" disabled={identifying} onClick={()=>input.current?.click()}>Choose different photos</button><input ref={input} className="visually-hidden" type="file" accept="image/*" multiple onChange={e=>void choose(Array.from(e.target.files??[]))}/></>}
    {review&&<div className="review"><p className="eyebrow">REVIEW</p><h2>Combined identification</h2><p>WineLog interpreted all selected labels together. Tap any label thumbnail above to inspect the original at a larger size, then correct anything before saving. If the photo contains location data, WineLog may suggest an approximate place that you can verify or edit.</p>{review.requestId&&<small>Support ID {review.requestId}</small>}<WineForm photos={photos} initial={{producer:review.producer??'',wineName:review.wineName??'',vintage:review.vintage,recognizedProducer:review.recognizedProducer,recognizedWineName:review.recognizedWineName,recognizedVintageText:review.recognizedVintageText,vintageKind:review.vintageKind,releaseDesignation:review.releaseDesignation,country:review.country,region:review.region,appellation:review.appellation,recognizedRegion:review.recognizedRegion,recognizedAppellation:review.recognizedAppellation,grapes:review.grapes,grapeBlend:review.grapeBlend,wineStyle:review.style,alcoholPercentage:review.alcoholPercentage,sparklingDetails:review.sparklingDetails,tastingDate:review.tastingDate,locationName:review.locationName,latitude:review.latitude,longitude:review.longitude,tags:derivedTags({country:review.country,region:review.region,appellation:review.appellation,grapes:review.grapes,style:review.style}),recognitionConfidence:review.confidence,recognitionStatus:'review'}}/></div>}
    {lightbox&&<ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={()=>setLightbox(null)}/>} 
  </section>;
}