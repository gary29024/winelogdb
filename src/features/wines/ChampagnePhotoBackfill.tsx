import { useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAMPAGNE_PHOTO_LIMIT,missingChampagneDetails,type ChampagneExtractionStatus } from '../../lib/wine/champagneExtraction';
import { hasSparklingDetails,type SparklingDetails } from '../../lib/wine/sparklingDetails';
import { ImageLightbox } from '../../components/ImageLightbox';
import { getChampagneExtraction,startChampagneExtraction } from './champagneExtractionApi';
import { SparklingDetailsCard } from './SparklingDetailsCard';
import { WineImage } from './WineImage';
import { authHeaders } from '../../lib/auth/client';
import '../../sparklingDetails.css';

type Props={wineId:string;imageIds:string[];details:SparklingDetails;onApply:(suggestions:SparklingDetails)=>void};
const pending=(run:ChampagneExtractionStatus|null)=>Boolean(run&&['queued','running','submitted'].includes(run.status));

export function ChampagnePhotoBackfill({wineId,imageIds,details,onApply}:Props){
  const [selected,setSelected]=useState(()=>imageIds.slice(0,CHAMPAGNE_PHOTO_LIMIT)),[run,setRun]=useState<ChampagneExtractionStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lightbox,setLightbox]=useState<string>();
  const controller=useRef<AbortController|null>(null),previewController=useRef<AbortController|null>(null),previewUrl=useRef<string|undefined>(undefined);
  const waiting=pending(run),missing=missingChampagneDetails(details,run?.details),hasMissing=hasSparklingDetails(missing);
  useEffect(()=>{if(window.location.hash==='#champagne-photos')document.getElementById('champagne-photos')?.scrollIntoView?.({block:'start'})},[]);
  useEffect(()=>{
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=async()=>{
      try{const result=await getChampagneExtraction(wineId,abort.signal);if(!abort.signal.aborted){setRun(result.run);setError('');if(pending(result.run))timer=setTimeout(()=>void refresh(),30_000)}}
      catch(e){if(!abort.signal.aborted){setError((e as Error).message);timer=setTimeout(()=>void refresh(),30_000)}}
    };
    void refresh();
    return()=>{abort.abort();clearTimeout(timer)};
  },[wineId,waiting]);
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
  return <section className="champagne-backfill" id="champagne-photos" aria-label="Backfill Champagne details">
    <h3>Read details from saved photos</h3>
    <p>Choose up to {CHAMPAGNE_PHOTO_LIMIT} labels from this same bottle, including the back and neck. Extraction runs in the background; you can leave and return to Edit to review the result.</p>
    {imageIds.length===0?<p><Link to={`/wines/${wineId}`}>Add bottle photos on the wine page</Link> to extract its release details.</p>:<div className="champagne-photo-picker">{imageIds.map((id,index)=><div key={id}>
      <button type="button" onClick={()=>void preview(id)} aria-label={`Enlarge saved photo ${index+1}`}><WineImage imageId={id} alt={`Saved label ${index+1}`}/></button>
      <label><input type="checkbox" checked={selected.includes(id)} disabled={busy||waiting||(!selected.includes(id)&&selected.length>=CHAMPAGNE_PHOTO_LIMIT)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,id]:ids.filter(value=>value!==id))}/>Photo {index+1}</label>
    </div>)}</div>}
    <button type="button" disabled={busy||waiting||!selected.length} onClick={()=>void start()}>{busy?'Preparing photos…':waiting?'Extraction queued…':run?'Extract again from selected photos':'Extract Champagne details'}</button>
    {waiting&&<p role="status">Processing in the background. Batch processing can take up to 24 hours. Nothing is saved to the wine automatically.</p>}
    {run?.status==='failed'&&<p role="alert">{run.error||'Extraction failed. Please try again.'}</p>}
    {run?.status==='complete'&&<div className="champagne-suggestions">
      <p>Result source photos: {run.imageIds.map((id,index)=>imageIds.includes(id)?<button type="button" key={id} onClick={()=>void preview(id)}>Photo {imageIds.indexOf(id)+1}</button>:<span key={id}>Photo {index+1} (removed)</span>)}</p>
      {hasMissing?<><p>Review these missing-field suggestions against the photos before adding them. Existing values are preserved.</p><SparklingDetailsCard details={missing}/><button type="button" onClick={()=>{onApply(missing);setNotice('Suggestions added to the form. Review the fields below, then Save to keep them.')}}>Add suggestions to form</button></>:<p role="status">{hasSparklingDetails(run.details)?'No additional missing fields were found.':'No release details were readable. Try clearer back or neck label photos.'}</p>}
    </div>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    {lightbox&&<ImageLightbox src={lightbox} alt="Saved Champagne label" onClose={()=>setLightbox(undefined)}/>}
  </section>;
}
