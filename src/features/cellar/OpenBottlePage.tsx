import { useEffect,useRef,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WineForm } from '../wines/WineForm';
import { extractPhotoMetadata } from '../uploads/photoMetadata';
import { prepareRecognitionImage } from '../uploads/prepareImage';
import { recognitionSchema } from '../recognition/schema';
import { authHeaders,clearSession } from '../../lib/auth/client';
import { applyLabelDifferences,compareToLabel,type CheckField,type CheckableWine,type LabelDifference } from './labelCheck';
import { bottleLabel,getHolding,type CellarHolding } from './api';
import type { WinePhoto } from '../wines/api';
import '../../cellar.css';

type Chosen=WinePhoto&{preview:string;recognitionFile:File};

const initialFrom=(holding:CellarHolding)=>({
  producer:holding.producer,wineName:holding.wineName,vintage:holding.vintage,
  country:holding.country,region:holding.region,appellation:holding.appellation,
  wineStyle:holding.wineStyle,classification:holding.classification,
  // What you paid, carried onto the bottle you are opening. Insights prices a
  // wine from this column, so a cellar line that recorded the price and a
  // journal row that lost it would be the same bottle costing two things.
  price:holding.purchasePrice,currency:holding.currency,
  recognitionStatus:'complete'
});

/**
 * Opening a bottle: the ordinary wine form, prefilled from the cellar, carrying
 * the holding so that saving takes the bottle off the count. Nothing is
 * decremented on the way in - back out and the cellar is untouched.
 *
 * Two things the cellar cannot supply. A photo, because a holding never had one
 * - so it is asked for here, and skipping is a real answer. And a check that
 * what was typed months ago from an invoice matches the bottle in your hand,
 * because this row is about to become a producer, a stamp on the Passport and a
 * line in Insights, and it is cheaper to be right now than to correct all three
 * later. Both are optional, and the check only runs when you press it.
 */
export function OpenBottlePage(){
  const [params]=useSearchParams();
  const holdingId=params.get('holding')||'';
  const [holding,setHolding]=useState<CellarHolding|null>(null);
  const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');
  const [entry,setEntry]=useState<ReturnType<typeof initialFrom>|null>(null);
  const [photos,setPhotos]=useState<Chosen[]>([]);
  const [checking,setChecking]=useState(false),[checkError,setCheckError]=useState('');
  const [differences,setDifferences]=useState<LabelDifference[]|null>(null);
  const [accepted,setAccepted]=useState<Set<CheckField>>(new Set());
  const [formSeq,setFormSeq]=useState(0);
  const picker=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(!holdingId){setState('missing');return}
    let live=true;
    getHolding(holdingId)
      .then(found=>{if(!live)return;setHolding(found);setEntry(found?initialFrom(found):null);setState(found?'ready':'missing')})
      .catch(()=>{if(live)setState('missing')});
    return()=>{live=false};
  },[holdingId]);

  useEffect(()=>()=>{photos.forEach(photo=>URL.revokeObjectURL(photo.preview))},[photos]);

  async function choose(files:File[]){
    if(!files.length)return;
    setCheckError('');setDifferences(null);setAccepted(new Set());
    try{
      const [metadata,prepared]=await Promise.all([
        Promise.all(files.map(file=>extractPhotoMetadata(file))),
        Promise.all(files.map(file=>prepareRecognitionImage(file)))
      ]);
      setPhotos(files.map((file,index)=>({
        file,metadata:metadata[index],width:prepared[index].width,height:prepared[index].height,
        recognitionFile:prepared[index].file,preview:URL.createObjectURL(file)
      })));
    }catch(e){setCheckError((e as Error).message||'Could not prepare those photos')}
  }

  async function check(){
    if(!photos.length||!entry)return;
    setChecking(true);setCheckError('');setDifferences(null);setAccepted(new Set());
    try{
      const form=new FormData();
      photos.forEach(photo=>form.append('images',photo.recognitionFile));
      form.append('metadata',JSON.stringify(photos.map(photo=>photo.metadata??{capturedAt:null,latitude:null,longitude:null,source:'none'})));
      const response=await fetch('/api/recognition',{method:'POST',headers:authHeaders(),body:form});
      if(response.status===401){clearSession();throw new Error('Session expired. Please sign in again.')}
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error((body as {error?:string})?.error||'Could not read the label');
      const reading=recognitionSchema.parse(body);
      setDifferences(compareToLabel(entry as CheckableWine,reading));
    }catch(e){setCheckError((e as Error).message||'Could not read the label')}
    finally{setChecking(false)}
  }

  function takeAccepted(){
    if(!differences||!entry)return;
    setEntry(applyLabelDifferences(entry,differences,accepted));
    setDifferences(null);setAccepted(new Set());
    // The form holds its own state from what it was given, so a corrected entry
    // is a new form rather than a reach into one that is already open.
    setFormSeq(seq=>seq+1);
  }

  function toggle(field:CheckField){
    setAccepted(current=>{const next=new Set(current);if(next.has(field))next.delete(field);else next.add(field);return next});
  }

  if(state==='loading')return <section><h1>Open a bottle</h1><p aria-live="polite">Fetching it from the cellar…</p></section>;
  if(state==='missing'||!holding||!entry)return <section><h1>Add wine</h1><p className="cellar-hint">Those bottles are no longer in your cellar, so this is an ordinary new wine.</p><WineForm/></section>;

  return <section className="open-bottle-page">
    <h1>Open a bottle</h1>
    <p className="cellar-open-note">
      <strong>{holding.producer} · {holding.wineName} {holding.vintage??'NV'}</strong>
      <span>{bottleLabel(holding)} in your cellar. Saving logs the tasting and takes one off the count.</span>
    </p>

    <div className="bottle-photo-prompt">
      <div className="bottle-photo-ask">
        <strong>Add a photo of the bottle?</strong>
        <small>Optional — a cellar entry has never had one, and this is the moment it can. Skip it and the wine saves without.</small>
      </div>
      <input ref={picker} type="file" accept="image/*" multiple hidden onChange={event=>{void choose([...(event.target.files??[])]);event.target.value=''}}/>
      <button type="button" onClick={()=>picker.current?.click()}>{photos.length?'Choose different photos':'Choose photos'}</button>
    </div>

    {photos.length>0&&<div className="bottle-photo-strip">
      {photos.map(photo=><img key={photo.preview} src={photo.preview} alt="Bottle about to be logged"/>)}
      <div className="bottle-check">
        <button type="button" onClick={()=>void check()} disabled={checking}>{checking?'Reading the label…':'Check the details against the label'}</button>
        <small>Reads the photo and says where it disagrees with what you typed. Nothing changes until you accept it.</small>
      </div>
    </div>}

    {checkError&&<p className="cellar-error" role="alert">{checkError}</p>}

    {differences&&(differences.length
      ?<div className="bottle-differences">
        <p className="eyebrow">THE LABEL DISAGREES</p>
        <ul>{differences.map(difference=><li key={difference.field}>
          <label>
            <input type="checkbox" checked={accepted.has(difference.field)} onChange={()=>toggle(difference.field)}/>
            <span className="bottle-difference-field">{difference.label}</span>
            <span className="bottle-difference-held">{difference.held}</span>
            <span className="bottle-difference-arrow" aria-hidden="true">→</span>
            <span className="bottle-difference-read">{difference.read}</span>
          </label>
        </li>)}</ul>
        <div className="bottle-difference-actions">
          <button type="button" onClick={()=>setAccepted(new Set(differences.map(difference=>difference.field)))}>Take all</button>
          <button type="button" className="primary" onClick={takeAccepted} disabled={!accepted.size}>Use {accepted.size} correction{accepted.size===1?'':'s'}</button>
          <button type="button" className="quiet" onClick={()=>{setDifferences(null);setAccepted(new Set())}}>Keep what I typed</button>
        </div>
      </div>
      :<p className="bottle-check-clean" role="status">✓ The label agrees with everything you typed.</p>)}

    <WineForm key={formSeq} holdingId={holding.id} photos={photos} initial={entry as never}/>
  </section>;
}
