import { useEffect,useId,useRef,useState,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CHAMPAGNE_PHOTO_LIMIT,missingChampagneDetails,type ChampagneExtractionStatus } from '../../lib/wine/champagneExtraction';
import { hasSparklingDetails,type SparklingDetails } from '../../lib/wine/sparklingDetails';
import { getChampagneExtraction,startChampagneExtraction } from './champagneExtractionApi';
import { SparklingDetailsCard } from './SparklingDetailsCard';
import { WineImage } from './WineImage';
import { authHeaders } from '../../lib/auth/client';
import '../../sparklingDetails.css';

type Props={wineId:string;imageIds:string[];details:SparklingDetails;onApply:(suggestions:SparklingDetails)=>void};
const pending=(run:ChampagneExtractionStatus|null)=>Boolean(run&&['queued','running','submitted'].includes(run.status));

function ExtractionDialog({children,onClose}:{children:ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),titleId=useId();
  useEffect(()=>{
    const dialog=ref.current!,previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,previousOverflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return()=>{dialog.close();document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus()};
  },[]);
  return createPortal(<dialog ref={ref} className="champagne-extraction-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="champagne-dialog-body"><div className="champagne-dialog-heading"><h2 id={titleId}>Champagne label details</h2><button type="button" className="quiet" onClick={onClose} aria-label="Close Champagne extraction">Close</button></div>{children}</div>
  </dialog>,document.body);
}

export function ChampagnePhotoBackfill({wineId,imageIds,details,onApply}:Props){
  const [open,setOpen]=useState(()=>window.location.hash==='#champagne-photos');
  const [selected,setSelected]=useState(()=>imageIds.slice(0,CHAMPAGNE_PHOTO_LIMIT)),[run,setRun]=useState<ChampagneExtractionStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lightbox,setLightbox]=useState<string>();
  const controller=useRef<AbortController|null>(null),previewController=useRef<AbortController|null>(null),previewUrl=useRef<string|undefined>(undefined);
  const waiting=pending(run),missing=missingChampagneDetails(details,run?.details),hasMissing=hasSparklingDetails(missing),imageIdsKey=imageIds.join('\u0000');
  useEffect(()=>{
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=async()=>{
      try{const result=await getChampagneExtraction(wineId,abort.signal);if(!abort.signal.aborted){
        setRun(result.run);setError('');
        // A queued extraction owns its photo set. Rehydrate that exact set when
        // the user leaves and comes back instead of falling back to "first six".
        // Removed photos stay out of the selectable set but remain identified in
        // Result source photos after completion.
        if(result.run?.imageIds.length)setSelected(result.run.imageIds.filter(id=>imageIds.includes(id)).slice(0,CHAMPAGNE_PHOTO_LIMIT));
        if(pending(result.run))timer=setTimeout(()=>void refresh(),30_000);
      }}
      catch(e){if(!abort.signal.aborted){setError((e as Error).message);timer=setTimeout(()=>void refresh(),30_000)}}
    };
    void refresh();
    return()=>{abort.abort();clearTimeout(timer)};
  },[wineId,waiting,imageIdsKey]);
  useEffect(()=>()=>{controller.current?.abort();previewController.current?.abort();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current)},[]);
  async function start(){
    if(busy||waiting)return;
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setNotice('');
    try{const result=await startChampagneExtraction(wineId,selected,abort.signal);if(!abort.signal.aborted)setRun(result.run)}
    catch(e){if(!abort.signal.aborted)setError((e as Error).message)}
    finally{if(!abort.signal.aborted)setBusy(false)}
  }
  async function preview(id:string){
    previewController.current?.abort();const abort=new AbortController();previewController.current=abort;
    try{
      const response=await fetch(`/api/images/${encodeURIComponent(id)}`,{headers:authHeaders(),signal:abort.signal});
      if(!response.ok)throw new Error('Could not open the saved photo.');
      const blob=await response.blob();if(abort.signal.aborted)return;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);
      previewUrl.current=URL.createObjectURL(blob);setLightbox(previewUrl.current);
    }catch(e){if(!abort.signal.aborted)setError((e as Error).message)}
  }
  function close(){setOpen(false);setLightbox(undefined);previewController.current?.abort()}
  return <div className="champagne-backfill" id="champagne-photos">
    <button type="button" className="quiet champagne-backfill-trigger" aria-haspopup="dialog" onClick={()=>setOpen(true)}>{waiting?'Extraction status':run?.status==='complete'&&hasMissing?'Review extracted details':'Extract from photos'}</button>
    {notice&&<small role="status">{notice}</small>}
    {open&&<ExtractionDialog onClose={close}>
    {lightbox?<div className="champagne-photo-preview"><button type="button" className="quiet" onClick={()=>setLightbox(undefined)}>Back to photo selection</button><img src={lightbox} alt="Saved Champagne label"/></div>:<>
    <p>Choose up to {CHAMPAGNE_PHOTO_LIMIT} labels from this bottle. Include the back and neck where possible, then confirm the photos to scan.</p>
    {imageIds.length===0?<p><Link to={`/wines/${wineId}`}>Add bottle photos on the wine page</Link> to extract its release details.</p>:<div className="champagne-photo-picker">{imageIds.map((id,index)=><div key={id}>
      <button type="button" onClick={()=>void preview(id)} aria-label={`Enlarge saved photo ${index+1}`}><WineImage imageId={id} alt={`Saved label ${index+1}`}/></button>
      <label><input type="checkbox" checked={selected.includes(id)} disabled={busy||waiting||(!selected.includes(id)&&selected.length>=CHAMPAGNE_PHOTO_LIMIT)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,id]:ids.filter(value=>value!==id))}/>Photo {index+1}</label>
    </div>)}</div>}
    <button type="button" className="primary" disabled={busy||waiting||!selected.length} onClick={()=>void start()}>{busy?'Preparing photos…':waiting?'Extraction queued…':`Confirm ${selected.length} photo${selected.length===1?'':'s'} & extract`}</button>
    {waiting&&<p role="status">Processing in the background. Batch processing can take up to 24 hours. Nothing is saved to the wine automatically.</p>}
    {run?.status==='failed'&&<p role="alert">{run.error||'Extraction failed. Please try again.'}</p>}
    {run?.status==='complete'&&<div className="champagne-suggestions">
      <p>Result source photos: {run.imageIds.map((id,index)=>imageIds.includes(id)?<button type="button" key={id} onClick={()=>void preview(id)}>Photo {imageIds.indexOf(id)+1}</button>:<span key={id}>Photo {index+1} (removed)</span>)}</p>
      {hasMissing?<><p>Review these missing-field suggestions against the photos before adding them. Existing values are preserved.</p><SparklingDetailsCard details={missing}/><button type="button" onClick={()=>{onApply(missing);setNotice('Details added — Save wine to keep them.');close()}}>Add suggestions to form</button></>:<p role="status">{hasSparklingDetails(run.details)?'No additional missing fields were found.':'No release details were readable. Try clearer back or neck label photos.'}</p>}
    </div>}
    {error&&<p role="alert">{error}</p>}
    </>}
    </ExtractionDialog>}
  </div>;
}
