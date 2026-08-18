import { useEffect,useState, type FormEvent } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { saveWine, type WinePhoto } from './api';
import { resolveProducer,type ProducerResolution } from '../producers/api';
import type { GrapeBlendEntry, WineInput } from '../../lib/db/schema';
import '../../producerResolution.css';

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

export function WineForm({initial,id,photos=[]}:{initial?:Partial<WineInput>;id?:string;photos?:WinePhoto[]}){
  const nav=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [producer,setProducer]=useState(String(initial?.producer??'')),[producerResolution,setProducerResolution]=useState<ProducerResolution|null>(null),[resolvingProducer,setResolvingProducer]=useState(false);

  useEffect(()=>{
    const name=producer.trim();
    if(!name){setProducerResolution(null);setResolvingProducer(false);return}
    let cancelled=false;
    setResolvingProducer(true);
    const timer=setTimeout(()=>{
      resolveProducer(name).then(result=>{if(!cancelled)setProducerResolution(result)}).catch(()=>{if(!cancelled)setProducerResolution(null)}).finally(()=>{if(!cancelled)setResolvingProducer(false)});
    },250);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[producer]);

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);
    const producer=String(fd.get('producer')||'').trim(),wineName=String(fd.get('wineName')||'').trim();
    if(!producer||!wineName){setError('Producer and wine name are required.');setBusy(false);return}
    const grapeBlend=parseBlend(String(fd.get('grapeBlend')||''));
    const currency=String(fd.get('currency')||'').trim().toUpperCase();
    const input:WineInput={
      producer,wineName,vintage:fd.get('vintage')?Number(fd.get('vintage')):null,
      country:String(fd.get('country')||'').trim()||null,region:String(fd.get('region')||'').trim()||null,appellation:String(fd.get('appellation')||'').trim()||null,
      grapes:[...new Set(grapeBlend.map(x=>x.grape))],grapeBlend,wineStyle:(String(fd.get('wineStyle')||'')||null) as WineInput['wineStyle'],
      alcoholPercentage:fd.get('alcoholPercentage')?Number(fd.get('alcoholPercentage')):null,tastingNotes:String(fd.get('tastingNotes')||''),rating:fd.get('rating')?Number(fd.get('rating')):null,
      tastingDate:String(fd.get('tastingDate')||'')||null,tastingName:String(fd.get('tastingName')||'').trim()||null,event:initial?.event??null,
      venue:String(fd.get('venue')||'').trim()||null,locationName:String(fd.get('locationName')||'').trim()||null,
      latitude:initial?.latitude??null,longitude:initial?.longitude??null,
      price:fd.get('price')?Number(fd.get('price')):null,currency:currency||null,
      tags:[...new Set(String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean))],recognitionStatus:'complete',recognitionConfidence:initial?.recognitionConfidence??null
    };
    try{const result=await saveWine(input,id,id?[]:photos);const savedId=id??('id' in result?result.id:undefined);if(!savedId)throw new Error('Save response did not include a wine ID');nav(`/wines/${savedId}`)}catch(e){setError((e as Error).message);setBusy(false)}
  }
  const field=(name:string,label:string,type='text',step?:string,required=false)=><label>{label}<input name={name} type={type} step={step} required={required} defaultValue={String(initial?.[name as keyof WineInput]??'')}/></label>;
  const matched=producerResolution?.matched?producerResolution.producer:undefined;
  return <form className="wine-form" onSubmit={submit}>
    <div className="form-grid">
      <div className="producer-field"><label>Producer *<input name="producer" type="text" required value={producer} onChange={e=>setProducer(e.target.value)}/></label>
       {producer.trim()&&<div className={`producer-resolution ${matched?'matched':'new'}`} aria-live="polite">
        {resolvingProducer?<span>Checking producer library…</span>:matched?<><strong>✓ Existing producer profile</strong><span>{matched.matchType==='alias'?`Matched via known alias “${matched.matchedName}” → `:''}{matched.canonicalName}</span><small>{matched.tastedCount} tasted · {matched.catalogCount} wines in researched range{matched.researchedAt?' · producer research available':''}</small><Link to={`/producers/${matched.id}`}>View producer profile</Link></>:<><strong>○ New producer</strong><span>No existing producer identity matches this name. A new profile will be created when the wine is saved.</span></>}
       </div>}
      </div>
      {field('wineName','Wine name *','text',undefined,true)}{field('vintage','Vintage','number')}{field('country','Country')}{field('region','Region')}{field('appellation','Appellation')}
      <label>Grapes / blend<input name="grapeBlend" defaultValue={blendText(initial)} placeholder="Merlot 95%, Cabernet Franc 5%"/><small>Percentages are optional. Separate grapes with commas.</small></label>
      <label>Style<select name="wineStyle" defaultValue={initial?.wineStyle??''}><option value="">Unknown</option>{['red','white','rose','sparkling','dessert','fortified','orange','other'].map(x=><option key={x}>{x}</option>)}</select></label>
      {field('alcoholPercentage','Alcohol %','number','0.1')}{field('rating','Rating / 100','number','0.5')}
    </div>
    <fieldset className="experience-fields"><legend>This drinking / tasting</legend><div className="form-grid">
      {field('tastingDate','Drinking date','date')}{field('tastingName','Tasting / event group')}{field('venue','Venue')}{field('locationName','Detected / entered location')}
    </div><small>Use “Tasting / event group” to group wines from the same dinner, trip, class or formal tasting. GPS coordinates, when available from photo metadata, are retained internally but are not required.</small></fieldset>
    <div className="form-grid">{field('price','Price','number','0.01')}{field('currency','Currency (e.g. USD)')}{field('tags','Tags (comma separated)')}</div>
    <label>Tasting notes<textarea name="tastingNotes" rows={5} defaultValue={initial?.tastingNotes}/></label>{photos.length>0&&<p className="form-note">{photos.length} photo{photos.length===1?'':'s'} will be saved permanently only after this wine is successfully logged.</p>}{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save wine'}</button>
  </form>
}
