import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveWine } from './api';
import type { WineInput } from '../../lib/db/schema';

function parseBlend(value:string){
  return value.split(',').map(x=>x.trim()).filter(Boolean).map(part=>{
    const match=part.match(/^(.*?)(?:\s+(\d+(?:\.\d+)?)\s*%)?$/);
    const grape=(match?.[1]??part).trim(),percentage=match?.[2]?Number(match[2]):null;
    return {grape,percentage};
  }).filter(x=>x.grape);
}
function formatBlend(blend:WineInput['grapeBlend']){return (blend??[]).map(x=>x.percentage!=null?`${x.grape} ${x.percentage}%`:x.grape).join(', ')}

export function WineForm({initial,id}:{initial?:Partial<WineInput>;id?:string}){
  const nav=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);
    const grapeBlend=parseBlend(String(fd.get('grapeBlend')||''));
    const enteredGrapes=String(fd.get('grapes')||'').split(',').map(x=>x.trim()).filter(Boolean);
    const grapes=enteredGrapes.length?enteredGrapes:[...new Set(grapeBlend.map(x=>x.grape))];
    const input:WineInput={
      producer:String(fd.get('producer')),wineName:String(fd.get('wineName')),vintage:fd.get('vintage')?Number(fd.get('vintage')):null,
      country:String(fd.get('country')||'')||null,region:String(fd.get('region')||'')||null,appellation:String(fd.get('appellation')||'')||null,
      grapes,grapeBlend,wineStyle:(String(fd.get('wineStyle')||'')||null) as WineInput['wineStyle'],
      alcoholPercentage:fd.get('alcoholPercentage')?Number(fd.get('alcoholPercentage')):null,tastingNotes:String(fd.get('tastingNotes')||''),rating:fd.get('rating')?Number(fd.get('rating')):null,
      tastingDate:String(fd.get('tastingDate')||'')||null,tastingName:String(fd.get('tastingName')||'')||null,event:initial?.event??null,
      venue:String(fd.get('venue')||'')||null,locationName:String(fd.get('locationName')||'')||null,
      latitude:initial?.latitude??null,longitude:initial?.longitude??null,
      price:fd.get('price')?Number(fd.get('price')):null,currency:String(fd.get('currency')||'')||null,
      tags:String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),imageObjectKeys:initial?.imageObjectKeys??[],recognitionStatus:'complete',recognitionConfidence:initial?.recognitionConfidence??null
    };
    try{const result=await saveWine(input,id);const savedId=id??('id' in result?result.id:undefined);if(!savedId)throw new Error('Save response did not include a wine ID');nav(`/wines/${savedId}`)}catch(e){setError((e as Error).message);setBusy(false)}
  }
  const field=(name:string,label:string,type='text',step?:string)=><label>{label}<input name={name} type={type} step={step} defaultValue={String(initial?.[name as keyof WineInput]??'')}/></label>;
  return <form className="wine-form" onSubmit={submit}>
    <div className="form-grid">
      {field('producer','Producer *')}{field('wineName','Wine name *')}{field('vintage','Vintage','number')}{field('country','Country')}{field('region','Region')}{field('appellation','Appellation')}{field('grapes','Grapes (comma separated)')}
      <label>Blend / grape percentages<input name="grapeBlend" defaultValue={formatBlend(initial?.grapeBlend??[])}/><small>Examples: Merlot 85%, Cabernet Franc 15%. Leave percentages blank when unknown.</small></label>
      <label>Style<select name="wineStyle" defaultValue={initial?.wineStyle??''}><option value="">Unknown</option>{['red','white','rose','sparkling','dessert','fortified','orange','other'].map(x=><option key={x}>{x}</option>)}</select></label>
      {field('alcoholPercentage','Alcohol %','number','0.1')}{field('rating','Rating / 100','number','0.5')}
    </div>
    <fieldset className="experience-fields"><legend>This drinking / tasting</legend><div className="form-grid">
      {field('tastingDate','Drinking date','date')}{field('tastingName','Tasting / event group')}{field('venue','Venue')}{field('locationName','Detected / entered location')}
    </div><small>Use “Tasting / event group” to group all wines from the same dinner, trip, class or formal tasting. Photo date and location suggestions remain editable; GPS coordinates are retained in the background when available and are not required.</small></fieldset>
    <div className="form-grid">{field('price','Price','number','0.01')}{field('currency','Currency (e.g. USD)')}{field('tags','Tags (comma separated)')}</div>
    <label>Tasting notes<textarea name="tastingNotes" rows={5} defaultValue={initial?.tastingNotes}/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save wine'}</button>
  </form>
}
