import { useState } from 'react';
import { apiJson } from '../../lib/auth/api';
import { summariesChanged } from '../../lib/cache/summaryCaches';
import { appClassification,classificationLabel } from '../../lib/wine/referenceSuggestions';
import { referenceAppRegion,regionWithin } from '../../lib/wine/referenceGeography';
import { getWine,type WineDetail } from './api';
import { LwinLinkEditor,type LwinLinkPreview } from './LwinLinkEditor';
import './lwinEdit.css';
import { lwinDisplayWineName,wineNameNeedsReview } from '../../lib/wine/lwinDisplayName';

export type LwinEditValues={producer:string;wineName:string;country:string;region:string;classification:string;classificationOverride:string};
type Props={wine:WineDetail;values:LwinEditValues;dirty:boolean;disabled:boolean;canMatch:boolean;initiallyOpen?:boolean;onApply:(values:Partial<LwinEditValues>)=>void;onBusy:(busy:boolean)=>void;onUpdated:(wine:WineDetail)=>void};

export function LwinEditPanel({wine,values,dirty,disabled,canMatch,initiallyOpen=false,onApply,onBusy,onUpdated}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [open,setOpen]=useState(initiallyOpen);
 const status=wine.identityMatchStatus;
 const linked=Boolean(wine.lwin7),accepted=linked&&(status==='matched'||status==='manual');
 const reference=wine.lwinReference?.lwin7===wine.lwin7?wine.lwinReference:null;
 const optedOut=status==='manual'&&!linked;
 const label=status==='conflict'?'Needs review':accepted?(status==='manual'?'Manually linked':'Matched'):linked?'Needs review':optedOut?'Matching turned off':status==='ambiguous'?'Multiple possible matches':'Not matched';
 const locked=disabled||busy||dirty;
 async function update(payload:Record<string,unknown>){
  if(locked)return;
  setBusy(true);onBusy(true);setError('');setNotice('');
  try{
   await apiJson(`/api/wines/${wine.id}/reference-review`,'POST',payload);
   summariesChanged();
   // Keep the old form if the refresh fails; never present stale data as saved.
   const next=await getWine(wine.id);
   onUpdated(next);
  }catch(e){setError((e as Error).message+' You can retry, or reload this page to check the saved match.')}
  finally{setBusy(false);onBusy(false)}
 }
 const comparisons=reference?[
  {key:'producer' as const,label:'Producer',value:reference.producer,current:values.producer},
  {key:'wineName' as const,label:'Wine name',value:lwinDisplayWineName(reference),current:values.wineName},
  {key:'country' as const,label:'Country',value:reference.country,current:values.country},
  {key:'region' as const,label:'Region',value:referenceAppRegion(reference),current:values.region},
  {key:'classification' as const,label:'Cru level',value:appClassification(reference.classification),current:values.classificationOverride||values.classification}
 ]:[];
 const differences=comparisons.filter(item=>item.value&&item.value!==item.current&&!(item.key==='wineName'&&!wineNameNeedsReview(item.current,item.value))&&!(item.key==='region'&&regionWithin(item.current,item.value,values.country,reference?.country)));
 const missing=differences.filter(item=>!item.current);
 function apply(patch:Partial<LwinEditValues>){onApply(patch);setNotice('Added to your form. Save changes below to keep these values.')}
 const facts=reference?[
  ['Country',reference.country],['Region',reference.region],['Sub-region',reference.subRegion],['Site / vineyard',reference.site],['Parcel',reference.parcel],
  ['Designation',reference.designation],['Classification',reference.classification],['Colour',reference.colour],['Product type',reference.productType],['Product subtype',reference.productSubtype]
 ]:[];
 return <details id="lwin-match" className="lwin-edit-panel" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="lwin-edit-summary"><span>LWIN reference</span><span className="lwin-edit-summary-status"><strong className={`lwin-edit-status${accepted?' accepted':''}`} role="status">{label}</strong>{linked&&<span className="lwin-edit-code">{wine.lwin7}</span>}</span></summary>
  <div className="lwin-edit-body">
  {linked&&<p><strong>LWIN {wine.lwin7}</strong>{wine.lwin11&&<> · Vintage LWIN {wine.lwin11}</>}</p>}
  {dirty&&<p>The match above is for your saved wine. Pending edits have not been checked yet.</p>}
  {reference&&<p className="lwin-edit-canonical">{reference.displayName||[reference.producer,reference.wineName].filter(Boolean).join(' · ')}</p>}
  {status==='conflict'&&<p>This stored link needs checking. Preview a catalogue entry below before confirming the right wine.</p>}
  {status==='ambiguous'&&!linked&&<p>More than one wine may fit. Preview the possible matches below and choose the bottle you have.</p>}
  {linked&&!reference&&<p>Catalogue details have not been loaded for this link yet.</p>}
  {!linked&&!optedOut&&status!=='ambiguous'&&<p>Find a match using your saved wine details, or enter a 7-digit LWIN to preview it.</p>}
  {reference&&<details className="lwin-edit-facts"><summary>Original catalogue details</summary>
   <dl className="lwin-edit-fact-grid">{facts.filter(([,value])=>value).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
   {reference.sourceUpdatedAt&&<small>Catalogue updated: {reference.sourceUpdatedAt}</small>}
  </details>}
  {accepted&&reference&&canMatch&&differences.length>0&&<details className="lwin-edit-comparison" open><summary>Use catalogue details in your form</summary>
   <p>Missing fields can be filled together. Review each difference before replacing a value you already entered.</p>
   {missing.length>0&&<button type="button" disabled={disabled||busy} onClick={()=>apply(Object.fromEntries(missing.map(item=>[item.key,item.value])))}>Fill {missing.length} missing {missing.length===1?'field':'fields'}</button>}
   {differences.map(item=><div className="lwin-edit-difference" key={item.key}><div><strong>{item.label}</strong><span>Your form: {classificationLabel(item.current)||'Empty'}</span><span>LWIN: {classificationLabel(item.value)}</span></div><button type="button" disabled={disabled||busy} onClick={()=>apply({[item.key]:item.value,...(item.key==='classification'?{classificationOverride:''}:{})})}>Use LWIN {item.label.toLowerCase()}</button></div>)}
  </details>}
  {notice&&<p role="status">{notice}</p>}
  {canMatch&&<>
   {dirty&&<div className="lwin-edit-save-first"><p>Save your changes before finding or changing a match. Your edits are still in the form.</p><button type="submit" form={`wine-edit-form-${wine.id}`} name="editIntent" value="continue" disabled={disabled||busy}>Save & continue matching</button></div>}
   <p className="lwin-edit-help">Matching actions save immediately and fill missing supported fields. Existing values remain for you to review.</p>
   <div className="lwin-edit-actions">{!optedOut&&<button type="button" disabled={locked} onClick={()=>void update({action:'recheck'})}>{busy?'Checking…':linked?'Refresh match and details':'Find LWIN match'}</button>}</div>
   <LwinLinkEditor wine={wine} showStoredSummary={false} disabled={locked} candidates={wine.identityMatchCandidates??[]} onLink={(preview:LwinLinkPreview)=>update({action:'link',lwin7:preview.requestedLwin7,previewToken:preview.previewToken})} onReject={()=>update({action:'reject',lwin7:wine.lwin7??null,updatedAt:wine.updatedAt})}/>
  </>}
  {error&&<p role="alert">{error}</p>}
  </div>
 </details>;
}
