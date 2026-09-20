import { useEffect,useRef,useState } from 'react';
import { apiJson } from '../../lib/auth/api';
import type { WineDetail } from './api';
import '../../referenceSuggestions.css';

export type LwinLinkPreview={requestedLwin7:string;lwin7:string;storedLwin7:string|null;displayName:string;producer:string|null;wineName:string|null;country:string|null;region:string|null;colour:string|null;productType:string|null;productSubtype:string|null;lwin11:string|null;vintage:number|null;suggestions:WineDetail['referenceSuggestions'];previewToken:string};
export function LwinLinkEditor({wine,disabled=false,onLink}:{wine:WineDetail;disabled?:boolean;onLink:(preview:LwinLinkPreview)=>Promise<void>}){
 const [code,setCode]=useState(''),[preview,setPreview]=useState<LwinLinkPreview>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef(0);
 useEffect(()=>{request.current++;setPreview(undefined);setError('');setLoading(false)},[wine.id,wine.updatedAt]);
 async function lookup(){
  const token=++request.current;setLoading(true);setPreview(undefined);setError('');
  try{const next=await apiJson<LwinLinkPreview>(`/api/wines/${wine.id}/reference-preview?lwin7=${encodeURIComponent(code.trim())}`);if(request.current===token)setPreview(next)}catch(e){if(request.current===token)setError((e as Error).message)}finally{if(request.current===token)setLoading(false)}
 }
 return <details className="lwin-link-editor"><summary>{wine.lwin7?'Change LWIN':'Link a LWIN'}</summary>
  <p>Enter a 7-digit LWIN and check the catalogue details before linking it.</p>
  <form className="lwin-link-form" onSubmit={e=>{e.preventDefault();void lookup()}}>
   <label htmlFor={`lwin-code-${wine.id}`}>LWIN code<input id={`lwin-code-${wine.id}`} inputMode="numeric" pattern="[0-9]{7}" maxLength={7} placeholder="e.g. 1017483" autoComplete="off" required value={code} disabled={disabled} onChange={e=>{request.current++;setLoading(false);setPreview(undefined);setError('');setCode(e.target.value)}}/></label>
   <button type="submit" disabled={disabled||loading||!/^\d{7}$/.test(code.trim())}>{loading?'Looking up…':'Preview LWIN'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {preview&&<section className="lwin-link-preview" aria-label="LWIN preview">
   <strong>{preview.displayName}</strong>
   <p>LWIN {preview.lwin7}{preview.requestedLwin7!==preview.lwin7?` · replaces combined code ${preview.requestedLwin7}`:''}</p>
   <p>{[preview.country,preview.region,preview.colour,preview.productSubtype||preview.productType].filter(Boolean).join(' · ')}</p>
   {preview.vintage!=null&&<p>Your vintage: {preview.vintage}{preview.lwin11?` · LWIN11 ${preview.lwin11}`:' · catalogue cannot verify a vintage-specific LWIN11'}</p>}
   <p>{preview.storedLwin7?`Replaces stored LWIN ${preview.storedLwin7}.`:'Adds a reference to this wine.'} Your name, vintage, region and tasting data stay unchanged.</p>
   {!!preview.suggestions.length&&<p>{preview.suggestions.length} field difference{preview.suggestions.length===1?'':'s'} will remain available to review separately.</p>}
   <button type="button" disabled={disabled||loading} onClick={()=>void onLink(preview)}>Link LWIN {preview.lwin7}</button>
  </section>}
 </details>;
}
