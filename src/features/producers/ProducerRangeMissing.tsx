import { useCallback,useEffect,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';
import '../../producerRangeCorrections.css';

type Props={producerId:string;onChanged:()=>Promise<void>};
type Entry={id:string;name:string;category:string;appellation:string|null;classification:string|null;style:string|null;notes:string|null;sourceUrl:string|null};
type Candidate=Entry&{status:'suggested'|'ignored'|'added';lastSeenAt:string};
type Payload={manualEntries:Entry[];missingCandidates:Candidate[]};
type Draft={name:string;category:string;appellation:string;classification:string;style:string;notes:string;sourceUrl:string};
const EMPTY:Draft={name:'',category:'other',appellation:'',classification:'',style:'',notes:'',sourceUrl:''};
const CATEGORIES=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
const LABELS:Record<(typeof CATEGORIES)[number],string>={red:'Red',white:'White',rose:'Rosé',sparkling:'Sparkling',dessert:'Dessert / sweet',fortified:'Fortified',orange:'Orange',other:'Other'};
async function json<T>(response:Response,message:string){const body=await response.json().catch(()=>({})) as T&{error?:string};if(!response.ok)throw new Error(body.error||message);return body}

export function ProducerRangeMissing({producerId,onChanged}:Props){
 const [data,setData]=useState<Payload>({manualEntries:[],missingCandidates:[]}),[loaded,setLoaded]=useState(false),[showForm,setShowForm]=useState(false),[draft,setDraft]=useState<Draft>(EMPTY),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{const response=await fetch(`/api/producers/${producerId}/catalog-range-corrections`,{headers:authHeaders()});const payload=await json<Partial<Payload>>(response,'Could not load range corrections');setData({manualEntries:Array.isArray(payload.manualEntries)?payload.manualEntries:[],missingCandidates:Array.isArray(payload.missingCandidates)?payload.missingCandidates:[]});setLoaded(true)},[producerId]);
 useEffect(()=>{setLoaded(false);void load().catch(e=>{setError((e as Error).message);setLoaded(true)})},[load]);
 async function changed(){await Promise.all([load(),onChanged()])}
 async function addManual(){if(!draft.name.trim()||busy)return;setBusy('manual');setError('');try{await json(await fetch(`/api/producers/${producerId}/catalog-manual`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'ADD_MISSING_CATALOG_WINE',...draft})}),'Could not add the missing wine');setDraft(EMPTY);setShowForm(false);await changed()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function act(candidate:Candidate,action:'add'|'ignore'){if(busy)return;setBusy(candidate.id);setError('');try{await json(await fetch(`/api/producers/${producerId}/catalog-missing/${candidate.id}/${action}`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:action==='add'?'ADD_MISSING_CATALOG_WINE':'IGNORE_CATALOG_CANDIDATE'})}),action==='add'?'Could not add the suggested wine':'Could not ignore the suggestion');await changed()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function remove(entry:Entry){if(busy||!confirm(`Remove “${entry.name}” from your manual range additions?\n\nIf later research finds it independently, it can still return as a researched wine.`))return;setBusy(entry.id);setError('');try{await json(await fetch(`/api/producers/${producerId}/catalog-manual/${entry.id}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'REMOVE_MANUAL_CATALOG_WINE'})}),'Could not remove the manual wine');await changed()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const meta=(entry:Entry)=>[entry.appellation,entry.classification,entry.style].filter(Boolean).join(' · '),hasCorrections=data.manualEntries.length>0||data.missingCandidates.length>0;
 const openForm=()=>{setShowForm(true);setError('')};
 if(!loaded)return null;
 if(!hasCorrections&&!showForm&&!error)return <div className="producer-range-corrections-quick"><button type="button" className="producer-range-corrections-add" onClick={openForm}>+ Add missing wine</button></div>;
 return <div className="producer-range-corrections">
  <div className="producer-range-corrections-head"><div><p className="section-label">Wine range corrections</p>{hasCorrections&&<small>Missing wines you confirm are kept across future research.</small>}</div><button type="button" className="producer-range-corrections-add" onClick={()=>{setShowForm(value=>!value);setError('')}}>{showForm?'Close':'+ Add missing wine'}</button></div>
  {data.missingCandidates.length>0&&<div className="producer-range-corrections-group"><div className="producer-range-corrections-group-title"><strong>Possible missing wines</strong><small>Found on official pages during an incomplete range check</small></div><div className="producer-range-correction-list">{data.missingCandidates.map(candidate=><div className="producer-range-correction-row" key={candidate.id}><div className="producer-range-correction-copy"><span>{candidate.name}</span>{meta(candidate)&&<small>{meta(candidate)}</small>}{candidate.sourceUrl&&<a href={candidate.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a>}</div><div className="producer-range-correction-actions"><button type="button" disabled={Boolean(busy)} onClick={()=>void act(candidate,'add')}>{busy===candidate.id?'Saving…':'Add'}</button><button type="button" disabled={Boolean(busy)} onClick={()=>void act(candidate,'ignore')}>Ignore</button></div></div>)}</div></div>}
  {data.manualEntries.length>0&&<div className="producer-range-corrections-group"><div className="producer-range-corrections-group-title"><strong>Manual range additions</strong><small>Added by you · durable across Deep Search</small></div><div className="producer-range-correction-list">{data.manualEntries.map(entry=><div className="producer-range-correction-row" key={entry.id}><div className="producer-range-correction-copy"><span>{entry.name}</span>{meta(entry)&&<small>{meta(entry)}</small>}{entry.sourceUrl&&<a href={entry.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}</div><div className="producer-range-correction-actions"><button type="button" className="danger" disabled={Boolean(busy)} onClick={()=>void remove(entry)}>{busy===entry.id?'Removing…':'Remove'}</button></div></div>)}</div></div>}
  {showForm&&<div className="producer-range-correction-form"><div className="producer-range-correction-form-grid">
   <label className="wide"><span>Wine name</span><input value={draft.name} maxLength={220} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Corton-Charlemagne Grand Cru"/></label>
   <label><span>Category</span><select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{CATEGORIES.map(value=><option value={value} key={value}>{LABELS[value]}</option>)}</select></label>
   <label><span>Appellation <em>optional</em></span><input value={draft.appellation} maxLength={180} onChange={e=>setDraft({...draft,appellation:e.target.value})}/></label>
   <label><span>Classification <em>optional</em></span><input value={draft.classification} maxLength={120} onChange={e=>setDraft({...draft,classification:e.target.value})}/></label>
   <label><span>Style <em>optional</em></span><input value={draft.style} maxLength={80} onChange={e=>setDraft({...draft,style:e.target.value})}/></label>
   <label className="wide"><span>Source URL <em>optional</em></span><input type="url" value={draft.sourceUrl} maxLength={600} placeholder="https://producer.example/wines/..." onChange={e=>setDraft({...draft,sourceUrl:e.target.value})}/></label>
   <label className="wide"><span>Note <em>optional</em></span><textarea rows={2} value={draft.notes} maxLength={320} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
  </div><div className="producer-range-correction-form-actions"><button type="button" disabled={Boolean(busy)} onClick={()=>{setShowForm(false);setDraft(EMPTY)}}>Cancel</button><button type="button" disabled={Boolean(busy)||!draft.name.trim()} onClick={()=>void addManual()}>{busy==='manual'?'Saving…':'Add to range'}</button></div></div>}
  {error&&<p className="producer-range-correction-error" role="alert">{error}</p>}
 </div>
}
