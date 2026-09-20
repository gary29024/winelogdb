import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../../lib/auth/api';

type Preview={producerId:string;currentName:string;name:string;wineCount:number;previousNames:string[];sample:Array<{id:string;wineName:string;vintage:number|null}>;conflictProducerId:string|null;previewToken:string};
export function ProducerNameReview({wineId,disabled,onApply}:{wineId:string;disabled:boolean;onApply:(operation:()=>Promise<unknown>)=>Promise<void>}){
 const [preview,setPreview]=useState<Preview>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');setPreview(undefined);try{setPreview(await apiJson<Preview>(`/api/wines/${wineId}/producer-name-review`))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 return <div className="producer-name-review">
  <button type="button" disabled={disabled||loading} onClick={()=>void load()}>{loading?'Checking linked wines…':'Apply producer name to all linked wines…'}</button>
  {error&&<p role="alert">{error}</p>}
  {preview&&<section className="lwin-link-preview" aria-label="Producer name change preview">
   <strong>{preview.currentName} → {preview.name}</strong>
   <p>Use this producer name on all {preview.wineCount} linked wines and on the producer profile.</p>
   <p>Previous names stay available as aliases automatically: {preview.previousNames.join(' · ')||preview.currentName}.</p>
   <p>Wine names, vintages, LWIN links, tasting notes and research stay unchanged. Matching producer suggestions will leave the review queue; other differences remain for review.</p>
   <ul>{preview.sample.map(wine=><li key={wine.id}>{wine.wineName}{wine.vintage?` · ${wine.vintage}`:''}</li>)}</ul>
   {preview.wineCount>preview.sample.length&&<p>And {preview.wineCount-preview.sample.length} more linked wines.</p>}
   {preview.conflictProducerId?<p role="alert">A name already belongs to another producer. <Link to={`/producers/${preview.producerId}`}>Open Identity &amp; aliases</Link> to link those producers first, then preview again.</p>:<button type="button" disabled={disabled} onClick={()=>{const token=preview.previewToken;setPreview(undefined);void onApply(()=>apiJson(`/api/wines/${wineId}/producer-name-review`,'POST',{previewToken:token}))}}>Apply to {preview.wineCount} wines</button>}
   <button type="button" className="quiet" disabled={disabled} onClick={()=>setPreview(undefined)}>Cancel</button>
  </section>}
 </div>;
}
