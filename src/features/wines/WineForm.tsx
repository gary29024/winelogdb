import { useEffect,useRef,useState, type FormEvent } from 'react';
import { resolvePlace } from '../../lib/places/resolve';
import { Link,useNavigate } from 'react-router-dom';
import { addWineImages,saveWine,saveWineTastingStructure, type WinePhoto } from './api';
import { resolveProducer,type ProducerResolution } from '../producers/api';
import { resolveCuvee,type CuveeResolution } from '../cuvees/api';
import type { GrapeBlendEntry, WineInput } from '../../lib/db/schema';
import { hasTastingStructure,type TastingStructure,type TastingStructureKey } from '../../lib/wine/tastingStructure';
import { refreshActiveTasting,useActiveTasting } from '../tastings/useActiveTasting';
import { matchTastingWine,type TastingWineMatch } from '../tastings/api';
import '../../producerResolution.css';
import '../../wineFormCompact.css';

function parseBlend(value:string):GrapeBlendEntry[]{
  return value.split(',').map(x=>x.trim()).filter(Boolean).map(part=>{
    const match=part.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
    return match?{grape:match[1].trim(),percentage:Number(match[2])}:{grape:part,percentage:null};
  });
}
function blendText(initial?:Partial<WineInput>){
  if(initial?.grapeBlend?.length)return initial.grapeBlend.map(x=>`${x.grape}${x.percentage!=null?` ${x.percentage}%`:''}`).join(', ');
  return initial?.grapes?.join(', ')??'';
}

const structureFields=[
  {key:'flavourIntensity',label:'Flavour intensity',options:[['light','Light'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['pronounced','Pronounced']]},
  {key:'acidity',label:'Acidity',options:[['low','Low'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['high','High']]},
  {key:'tannin',label:'Tannin',options:[['low','Low'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['high','High']]},
  {key:'body',label:'Body',options:[['light','Light'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['full','Full']]},
  {key:'finish',label:'Finish',options:[['short','Short'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['long','Long']]},
  {key:'alcohol',label:'Perceived alcohol',options:[['low','Low'],['medium','Medium'],['high','High']]}
] as const;

type WineFormInput=WineInput&{tastingStructure?:TastingStructure|null};
type WineFormInitial=Partial<WineInput>&{tastingStructure?:TastingStructure|null};
type WineFormProps={initial?:WineFormInitial;id?:string;photos?:WinePhoto[];onSave?:(input:WineFormInput)=>Promise<{id:string}>;onSaved?:(id:string)=>void;submitLabel?:string};

export function WineForm({initial,id,photos=[],onSave,onSaved,submitLabel}:WineFormProps){
  const nav=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [producer,setProducer]=useState(String(initial?.producer??'')),[producerResolution,setProducerResolution]=useState<ProducerResolution|null>(null),[resolvingProducer,setResolvingProducer]=useState(false);
  const [wineName,setWineName]=useState(String(initial?.wineName??'')),[appellation,setAppellation]=useState(String(initial?.appellation??'')),[wineStyle,setWineStyle]=useState(String(initial?.wineStyle??''));
  const [cruOverride,setCruOverride]=useState(String(initial?.classificationOverride??''));
  // Controlled so the duplicate probe can key on it: 2019 and 2020 of one cuvée
  // are two wines, and an evening pours both.
  const [vintageInput,setVintageInput]=useState(initial?.vintage==null?'':String(initial.vintage));
  const [cuveeResolution,setCuveeResolution]=useState<CuveeResolution|null>(null),[resolvingCuvee,setResolvingCuvee]=useState(false),[preferCuveePrimaryName,setPreferCuveePrimaryName]=useState(false);
  const [structure,setStructure]=useState<TastingStructure>(()=>({...initial?.tastingStructure})),[structureOpen,setStructureOpen]=useState(()=>hasTastingStructure(initial?.tastingStructure??null));
  const matched=producerResolution?.matched?producerResolution.producer:undefined;
  // The three fields an open tasting fills in. They are state rather than
  // defaultValue because the tasting arrives asynchronously, and an uncontrolled
  // input cannot pick up a value that lands after it has mounted.
  const [tastingName,setTastingName]=useState(String(initial?.tastingName??''));
  const [venue,setVenue]=useState(String(initial?.venue??''));
  const [tastingDate,setTastingDate]=useState(String(initial?.tastingDate??''));
  const {tasting:activeTasting,loading:tastingLoading}=useActiveTasting();
  const prefilled=useRef(false);
  /**
   * The wine in tonight's lineup that this photograph is probably of.
   *
   * The create path has no dedupe, so photographing a bottle whose printed line
   * was read an hour earlier makes a second copy of it: one row with the price
   * and no photo, one with the photo and no price, both in the same evening.
   * Rather than merge silently - which would be wrong for the two bottles of
   * one cuvée a tasting really does sometimes pour - the choice is offered.
   */
  const [duplicate,setDuplicate]=useState<TastingWineMatch|null>(null);
  const [dismissedDuplicate,setDismissedDuplicate]=useState(false);
  const [attaching,setAttaching]=useState(false);
  // Editing an existing wine never joins a tasting, so it never waits on one.
  const waitingForTasting=!id&&tastingLoading;

  /**
   * Asked only where a duplicate can actually be made: a new wine, carrying
   * photographs, being logged into an evening that is open. Editing, and the
   * batch and group flows that run their own review, never ask.
   */
  useEffect(()=>{
    if(id||!photos.length||!activeTasting||dismissedDuplicate)return;
    const name=producer.trim(),cuvee=wineName.trim();
    if(!name||!cuvee){setDuplicate(null);return}
    let live=true;
    const timer=setTimeout(()=>{
      void matchTastingWine(activeTasting.id,{producer:name,wineName:cuvee,vintage:/^\d{3,4}$/.test(vintageInput.trim())?Number(vintageInput.trim()):null})
        .then(match=>{if(live)setDuplicate(match)})
        .catch(()=>undefined);
    },400);
    return()=>{live=false;clearTimeout(timer)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id,photos.length,activeTasting?.id,dismissedDuplicate,producer,wineName,vintageInput]);

  /** Adds the photographs to the wine already in the evening, making nothing new. */
  async function attachToExisting(){
    if(!duplicate||attaching)return;
    setAttaching(true);setError('');
    try{
      await addWineImages(duplicate.wineId,photos);
      if(onSaved)onSaved(duplicate.wineId);else nav(`/wines/${duplicate.wineId}`);
    }catch(e){setError((e as Error).message||'Could not add the photos to that wine')}
    finally{setAttaching(false)}
  }

  /**
   * Prefill from the open tasting, once.
   *
   * The ref means it can never stomp typing, and `id` means editing an existing
   * wine never prefills - a bottle from March must not be captured by tonight.
   *
   * The date is the one field where the tasting overrides what the form was
   * given: recognition supplies tastingDate from photo EXIF, and an old photo's
   * timestamp winning would look like a deliberate date change and silently end
   * the tasting. Someone declaring "I am at this tasting" outranks a file stamp.
   */
  useEffect(()=>{
    if(id||prefilled.current||!activeTasting)return;
    prefilled.current=true;
    setTastingName(current=>current||activeTasting.name);
    setVenue(current=>current||activeTasting.venue||'');
    if(activeTasting.tastingDate)setTastingDate(activeTasting.tastingDate);
  },[id,activeTasting]);

  useEffect(()=>{
    const name=producer.trim();
    if(!name){setProducerResolution(null);setResolvingProducer(false);return}
    let cancelled=false;
    setResolvingProducer(true);
    const timer=setTimeout(()=>{resolveProducer(name).then(result=>{if(!cancelled)setProducerResolution(result)}).catch(()=>{if(!cancelled)setProducerResolution(null)}).finally(()=>{if(!cancelled)setResolvingProducer(false)})},250);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[producer]);

  useEffect(()=>{
    const name=wineName.trim();
    if(!matched?.id||!name){setCuveeResolution(null);setResolvingCuvee(false);return}
    let cancelled=false;setResolvingCuvee(true);
    const timer=setTimeout(()=>{resolveCuvee(matched.id,name,appellation.trim()||null,wineStyle||null).then(result=>{if(!cancelled)setCuveeResolution(result)}).catch(()=>{if(!cancelled)setCuveeResolution(null)}).finally(()=>{if(!cancelled)setResolvingCuvee(false)})},300);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[matched?.id,wineName,appellation,wineStyle]);

  const matchedCuvee=cuveeResolution?.matched?cuveeResolution.cuvee:undefined;
  const canPreferPrimary=Boolean(id&&matchedCuvee&&wineName.trim()&&wineName.trim()!==matchedCuvee.canonicalName);
  useEffect(()=>{if(!canPreferPrimary)setPreferCuveePrimaryName(false)},[canPreferPrimary]);

  function chooseStructure(key:TastingStructureKey,value:string){
    setStructure(current=>({...current,[key]:current[key]===value?null:value}) as TastingStructure);
  }

  const placeValue=(value:string|null|undefined)=>value?.trim()||null;

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);
    const producer=String(fd.get('producer')||'').trim(),wineName=String(fd.get('wineName')||'').trim();
    if(!producer||!wineName){setError('Producer and wine name are required.');setBusy(false);return}
    const grapeBlend=parseBlend(String(fd.get('grapeBlend')||'')),currency=String(fd.get('currency')||'').trim().toUpperCase(),tastingStructure=hasTastingStructure(structure)?structure:null;
    const country=String(fd.get('country')||'').trim()||null,region=String(fd.get('region')||'').trim()||null,appellation=String(fd.get('appellation')||'').trim()||null;
    // Region and appellation are one normalized place pair. Once either part is
    // corrected, the old recognition pair no longer describes this save and
    // must not survive as a stale "As recorded" value. Also retire legacy
    // readings whose corresponding normalized field is already empty: those
    // are otherwise invisible in the form and impossible for a user to clear.
    const placeChanged=placeValue(initial?.country)!==country||placeValue(initial?.region)!==region||placeValue(initial?.appellation)!==appellation;
    const orphanedReading=Boolean((initial?.recognizedRegion&&!placeValue(initial?.region))||(initial?.recognizedAppellation&&!placeValue(initial?.appellation)));
    const replaceRecordedPlace=placeChanged||orphanedReading;
    const input:WineFormInput={
      producer,wineName,vintage:fd.get('vintage')?Number(fd.get('vintage')):null,
      country,region,appellation,
      // The reading the wine arrived with, sent back untouched - recognition
      // hands the form values it has already normalised, so re-deriving from
      // the fields would record WineLog's answer as the label's. A place edit
      // deliberately sends null so server canonicalization captures the new
      // typed pair instead of carrying the obsolete recognition forward.
      recognizedRegion:replaceRecordedPlace?null:initial?.recognizedRegion??null,
      recognizedAppellation:replaceRecordedPlace?null:initial?.recognizedAppellation??null,
      // Derived server-side, but sent back so an edit does not clear a tier the
      // label text no longer carries.
      classification:initial?.classification??null,
      classificationOverride:(cruOverride||null) as WineInput['classificationOverride'],
      grapes:[...new Set(grapeBlend.map(x=>x.grape))],grapeBlend,wineStyle:(String(fd.get('wineStyle')||'')||null) as WineInput['wineStyle'],
      alcoholPercentage:fd.get('alcoholPercentage')?Number(fd.get('alcoholPercentage')):null,tastingNotes:String(fd.get('tastingNotes')||''),rating:fd.get('rating')?Number(fd.get('rating')):null,
      tastingDate:String(fd.get('tastingDate')||'')||null,tastingName:String(fd.get('tastingName')||'').trim()||null,event:initial?.event??null,
      venue:String(fd.get('venue')||'').trim()||null,locationName:String(fd.get('locationName')||'').trim()||null,
      latitude:initial?.latitude??null,longitude:initial?.longitude??null,
      price:fd.get('price')?Number(fd.get('price')):null,currency:currency||null,
      tags:[...new Set(String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean))],recognitionStatus:'complete',recognitionConfidence:initial?.recognitionConfidence??null,
      tastingStructure
    };
    try{
      const result=onSave?await onSave(input):await saveWine(input,id,id?[]:photos,{preferCuveePrimaryName:canPreferPrimary&&preferCuveePrimaryName});
      const savedId=id??('id' in result?result.id:undefined);if(!savedId)throw new Error('Save response did not include a wine ID');
      if(onSave)await saveWineTastingStructure(savedId,tastingStructure);
      // A save can have closed the open tasting - a wine dated another day ends
      // it server-side - so the cached answer is no longer trustworthy.
      if(!id)void refreshActiveTasting();
      /**
       * Logging at a tasting is a repeated act, so a save goes back to the
       * evening rather than on to the bottle: the lineup is both the receipt
       * for what was just saved and where the next one is logged from. Landing
       * on the wine meant backing out of it fourteen times a night.
       *
       * Only when it actually joined. Change the event or the date - the way
       * you log something outside the evening - and you get the wine, as
       * before. Group Photo and Batch Scan pass onSaved and keep their own
       * review flow, which already returns you to their list.
       */
      const joined=!id&&activeTasting&&input.tastingName===activeTasting.name
        &&(input.tastingDate??null)===(activeTasting.tastingDate??null);
      if(onSaved)onSaved(savedId);
      else nav(joined&&activeTasting?`/tastings/${activeTasting.id}`:`/wines/${savedId}`);
    }catch(e){setError((e as Error).message);setBusy(false)}
  }
  // The tree, not the typist, holds the denomination: showing what it reads back
  // is what tells you a "Chianti Classico" you typed was understood as a DOCG.
  const denomination=resolvePlace({country:String(initial?.country??'')||null,region:String(initial?.region??'')||null,appellation}).denomination;
  const field=(name:string,label:string,type='text',step?:string,required=false)=><label>{label}<input name={name} type={type} step={step} required={required} defaultValue={String(initial?.[name as keyof WineInput]??'')}/></label>;
  const hasGps=initial?.latitude!=null&&initial?.longitude!=null,hasEstimatedPlace=hasGps&&Boolean(initial?.locationName?.trim());
  return <form className="wine-form wine-form-compact" onSubmit={submit}>
    {duplicate&&<div className="wine-duplicate-note" role="status">
      <p><strong>{duplicate.wineName}</strong>{duplicate.vintage?` ${duplicate.vintage}`:''} is already in this tasting{duplicate.producer?`, under ${duplicate.producer}`:''}. Saving this would make a second copy of it.</p>
      <div className="wine-duplicate-actions">
        <button type="button" className="primary" disabled={attaching||busy} onClick={()=>void attachToExisting()}>
          {attaching?'Adding…':`Add ${photos.length===1?'this photo':`these ${photos.length} photos`} to it`}
        </button>
        <button type="button" className="quiet" disabled={attaching||busy} onClick={()=>{setDismissedDuplicate(true);setDuplicate(null)}}>Save a separate wine</button>
      </div>
    </div>}
    <div className="producer-field"><label>Producer *<input name="producer" type="text" required value={producer} onChange={e=>setProducer(e.target.value)}/></label>
      {producer.trim()&&(resolvingProducer?<div className="producer-resolution matched"><span>Checking producer library…</span></div>:matched?<details className="producer-resolution matched compact-resolution"><summary>✓ Existing producer · {matched.canonicalName}</summary><div className="compact-resolution-body"><span>{matched.matchType==='alias'?`Matched via known alias “${matched.matchedName}” → `:''}{matched.canonicalName}</span><small>{matched.tastedCount} tasted · {matched.catalogCount} wines in researched range{matched.researchedAt?' · producer research available':''}</small><Link to={`/producers/${matched.id}`}>View producer profile</Link></div></details>:<div className="producer-resolution new"><strong>○ New producer</strong><span>No existing producer identity matches this name. A new profile will be created when the wine is saved.</span></div>)}
    </div>
    <div className="cuvee-field"><label>Wine name *<input name="wineName" type="text" required value={wineName} onChange={e=>setWineName(e.target.value)}/></label>
      {matched&&wineName.trim()&&(resolvingCuvee?<div className="producer-resolution cuvee-resolution matched"><span>Checking this producer’s cuvées…</span></div>:matchedCuvee?<><details className="producer-resolution cuvee-resolution matched compact-resolution"><summary>✓ Existing cuvée · {matchedCuvee.canonicalName}</summary><div className="compact-resolution-body"><span>{wineName.trim()===matchedCuvee.canonicalName?matchedCuvee.canonicalName:`${wineName.trim()} → ${matchedCuvee.canonicalName}`}</span><small>{matchedCuvee.matchType==='structured'?'Matched by stable producer + appellation/cuvée identity':matchedCuvee.matchType==='alias'?'Matched via a known cuvée name':'Same canonical cuvée identity'}{matchedCuvee.catalogBacked?' · producer catalogue-backed':''}{matchedCuvee.vintages.length?` · tasted vintages ${matchedCuvee.vintages.join(', ')}`:''}</small></div></details>{canPreferPrimary&&<label className="cuvee-primary-choice"><input type="checkbox" checked={preferCuveePrimaryName} onChange={e=>setPreferCuveePrimaryName(e.target.checked)}/><span>Use “{wineName.trim()}” as the primary cuvée name when saving</span><small>The cuvée ID stays the same; the old wording remains a searchable alias for every vintage.</small></label>}</>:<div className="producer-resolution cuvee-resolution new"><strong>○ New cuvée</strong><span>No existing cuvée identity for this producer matches this wine. WineLog will create one when saved.</span></div>)}
    </div>

    <div className="wine-compact-row three"><label>Vintage<input name="vintage" type="number" value={vintageInput} onChange={e=>setVintageInput(e.target.value)}/></label><label>Style<select name="wineStyle" value={wineStyle} onChange={e=>setWineStyle(e.target.value)}><option value="">Unknown</option>{['red','white','rose','sparkling','dessert','fortified','orange','other'].map(x=><option key={x}>{x}</option>)}</select></label>{field('alcoholPercentage','Alcohol %','number','0.1')}</div>
    <div className="wine-compact-row two">{field('country','Country')}{field('region','Region')}</div>
    <div className="wine-compact-row appellation-row"><label>Appellation<input name="appellation" value={appellation} onChange={e=>setAppellation(e.target.value)}/><small>{denomination?`Recognized as a ${denomination}; no need to type it.`:'The denomination is read from the name, so leave DOC / DOCG / AVA off — but keep IGT or IGP, which tells a zone apart from the region it shares a name with.'}</small></label>
      <label>Cru level<select name="classificationOverride" value={cruOverride} onChange={e=>setCruOverride(e.target.value)}>
        <option value="">Auto</option>
        <option value="grand_cru">Grand Cru</option>
        <option value="premier_cru">Premier Cru</option>
        <option value="village">Village</option>
        <option value="none">Not classified</option>
      </select><small>{cruOverride?'Set by hand; WineLog will not change it.':'Read from the appellation and the label.'}</small></label></div>
    <label className="full-field">Grapes / blend<input name="grapeBlend" defaultValue={blendText(initial)} placeholder="Merlot 95%, Cabernet Franc 5%"/><small>Percentages are optional. Separate grapes with commas.</small></label>

    <details className="structure-fields structure-disclosure" open={structureOpen} onToggle={e=>setStructureOpen(e.currentTarget.open)}><summary><span>Structure</span><small>Optional</small></summary><div className="structure-disclosure-body"><small className="structure-helper">Tap the value itself. Tap the selected value again to clear it.</small>{structureFields.map(item=><div className="structure-row" key={item.key}><span>{item.label}</span><div className="structure-options" role="group" aria-label={item.label}>{item.options.map(([value,label])=><button key={value} type="button" className={`structure-option${structure[item.key]===value?' selected':''}`} aria-pressed={structure[item.key]===value} onClick={()=>chooseStructure(item.key,value)}>{label}</button>)}</div></div>)}</div></details>

    <label className="full-field">Tasting notes<textarea name="tastingNotes" rows={4} defaultValue={initial?.tastingNotes}/></label>

    <fieldset className="experience-fields"><legend>This drinking / tasting</legend>
      <div className="wine-compact-row three"><label>Drinking date<input name="tastingDate" type="date" value={tastingDate} onChange={e=>setTastingDate(e.target.value)}/></label>{field('rating','Rating / 100','number','0.5')}<label>Price<div className="price-currency-inputs"><input name="currency" type="text" inputMode="text" maxLength={3} defaultValue={String(initial?.currency??'')} placeholder="HKD" aria-label="Currency"/><input name="price" type="number" step="0.01" defaultValue={String(initial?.price??'')} placeholder="0" aria-label="Price"/></div></label></div>
      <label className="full-field">Tasting / event group<input name="tastingName" type="text" value={tastingName} onChange={e=>setTastingName(e.target.value)}/></label>
      {!id&&activeTasting&&<p className="tasting-prefill-note">Prefilled from your open tasting — <strong>{activeTasting.name}</strong>. Change any of these to log this bottle outside it.</p>}
      <div className="wine-compact-row two"><label>Venue<input name="venue" type="text" value={venue} onChange={e=>setVenue(e.target.value)}/></label><label>{hasGps?'Approximate place':'Place name'}<input name="locationName" type="text" defaultValue={String(initial?.locationName??'')}/>{hasEstimatedPlace&&<small>Suggested by Gemini from the photo GPS. Verify or edit this approximation before saving.</small>}</label></div>
      {hasGps&&<div className="gps-readout"><strong>Photo GPS</strong><span>{Number(initial?.latitude).toFixed(6)}, {Number(initial?.longitude).toFixed(6)}</span><small>These coordinates are read directly from EXIF and stored exactly. The place name above is only an approximate Gemini interpretation.</small></div>}
      <small>Use “Tasting / event group” to group wines from the same dinner, trip, class or formal tasting. Exact GPS remains attached even if you edit or clear the approximate place name.</small>
    </fieldset>

    <label className="full-field">Tags (comma separated)<input name="tags" defaultValue={initial?.tags?.join(', ')??''}/></label>
    {photos.length>0&&<p className="form-note">{photos.length} photo{photos.length===1?'':'s'} will be saved permanently only after this wine is successfully logged.</p>}
    {error&&<p role="alert">{error}</p>}
    {/* Saving before the open-tasting probe answers used to post a null
        tastingName, so a bottle logged in the first moments after an app load
        was silently created outside the evening. The probe is one indexed query
        and its answer is cached for the rest of the session, so this is a
        flicker on the first save and nothing afterwards - and it fails open: if
        the probe errors, loading clears and the save proceeds untasted. */}
    <div className="wine-form-actions">{id&&<button type="button" className="wine-edit-cancel quiet" disabled={busy} onClick={()=>nav(`/wines/${id}`)}>Cancel</button>}<button type="submit" className="primary" disabled={busy||waitingForTasting}>{busy?'Saving…':waitingForTasting?'Checking tasting…':submitLabel??'Save wine'}</button></div>
  </form>
}
