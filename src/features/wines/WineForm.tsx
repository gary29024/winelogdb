import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveWine } from './api';
import type { WineInput } from '../../lib/db/schema';

export function WineForm({initial,id}:{initial?:Partial<WineInput>;id?:string}){
  const nav=useNavigate(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');const fd=new FormData(e.currentTarget);
    const input:WineInput={
      producer:String(fd.get('producer')),wineName:String(fd.get('wineName')),vintage:fd.get('vintage')?Number(fd.get('vintage')):null,
      country:String(fd.get('country')||'')||null,region:String(fd.get('region')||'')||null,appellation:String(fd.get('appellation')||'')||null,
      grapes:String(fd.get('grapes')||'').split(',').map(x=>x.trim()).filter(Boolean),wineStyle:(String(fd.get('wineStyle')||'')||null) as WineInput['wineStyle'],
      alcoholPercentage:fd.get('alcoholPercentage')?Number(fd.get('alcoholPercentage')):null,tastingNotes:String(fd.get('tastingNotes')||''),rating:fd.get('rating')?Number(fd.get('rating')):null,
      tastingDate:String(fd.get('tastingDate')||'')||null,tastingName:String(fd.get('tastingName')||'')||null,event:initial?.event??null,
      venue:String(fd.get('venue')||'')||null,locationName:String(fd.get('locationName')||'')||null,
      latitude:fd.get('latitude')?Number(fd.get('latitude')):null,longitude:fd.get('longitude')?Number(fd.get('longitude')):null,
      price:fd.get('price')?Number(fd.get('price')):null,currency:String(fd.get('currency')||'')||null,
      tags:String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean),imageObjectKeys:initial?.imageObjectKeys??[],recognitionStatus:'complete',recognitionConfidence:initial?.recognitionConfidence??null
    };
    try{const result=await saveWine(input,id);const savedId=id??('id' in result?result.id:undefined);if(!savedId)throw new Error('Save response did not include a wine ID');nav(`/wines/${savedId}`)}catch(e){setError((e as Error).message);setBusy(false)}
  }
  const field=(name:string,label:string,type='text',step?:string)=><label>{label}<input name={name} type={type} step={step} defaultValue={String(initial?.[name as keyof WineInput]??'')}/></label>;
  return <form className="wine-form" onSubmit={submit}>
    <div className="form-grid">
      {field('producer','Producer *')}{field('wineName','Wine name *')}{field('vintage','Vintage','number')}{field('country','Country')}{field('region','Region')}{field('appellation','Appellation')}{field('grapes','Grapes (comma separated)')}
      <label>Style<select name="wineStyle" defaultValue={initial?.wineStyle??''}><option value="">Unknown</option>{['red','white','rose','sparkling','dessert','fortified','orange','other'].map(x=><option key={x}>{x}</option>)}</select></label>
      {field('alcoholPercentage','Alcohol %','number','0.1')}{field('rating','Rating / 100','number','0.5')}
    </div>
    <fieldset className="experience-fields"><legend>This drinking / tasting</legend><div className="form-grid">
      {field('tastingDate','Drinking date','date')}{field('tastingName','Tasting / event group')}{field('venue','Venue')}{field('locationName','Detected / entered location')}{field('latitude','Latitude','number','any')}{field('longitude','Longitude','number','any')}
    </div><small>Use “Tasting / event group” to group all wines from the same dinner, trip, class or formal tasting. Photo date/GPS suggestions remain editable.</small></fieldset>
    <div className="form-grid">{field('price','Price','number','0.01')}{field('currency','Currency (e.g. USD)')}{field('tags','Tags (comma separated)')}</div>
    <label>Tasting notes<textarea name="tastingNotes" rows={5} defaultValue={initial?.tastingNotes}/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save wine'}</button>
  </form>
}
