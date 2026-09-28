import {useEffect,useId,useState} from 'react';
import {listProducers,type ProducerSummary} from '../producers/api';
import {ownerName} from '../../lib/places/echezeauxParcelOwners';
import {placeKey} from '../../lib/places/resolve';
import type {ParcelProducerLink} from '../../lib/places/parcelProducerLinks';
import {listParcelProducerLinks,removeParcelProducerLink,saveParcelProducerLink} from './parcelProducerApi';

type Holder={id:string;name:string};
type Props={parentId:string;holders:Holder[];editing:string;onEdit:(id:string)=>void;onShow:(id:string)=>void};
export function ParcelProducerLinker({parentId,holders,editing,onEdit,onShow}:Props){
 const [links,setLinks]=useState<ParcelProducerLink[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [removing,setRemoving]=useState('');
 useEffect(()=>{
  let active=true;
  void listParcelProducerLinks(parentId).then(result=>{if(active){setLinks(result.items);setLoaded(true);setError('')}})
   .catch(()=>{if(active)setError('Your producer links could not load. Parcel rights are still available.')});
  return()=>{active=false};
 },[parentId,attempt]);
 const holder=holders.find(h=>h.id===editing);
 const remove=async(id:string)=>{
  setRemoving(id);setError('');
  try{await removeParcelProducerLink(parentId,id);setLinks(items=>items.filter(l=>l.holderId!==id))}
  catch(e){setError((e as Error).message||'Could not remove the link')}
  finally{setRemoving('')}
 };
 return <div className="village-map-producer-links" aria-label="Your producer links">
  {error&&<div role="alert"><p>{error}</p>{!loaded&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry producer links</button>}</div>}
  {links.length>0&&<>
   <p className="village-map-parcel-label">Your linked producers</p>
   <p className="village-map-note">Personal catalogue links · farming unverified. Highlighting shows the recorded right holder’s parcels.</p>
   {links.map(link=><div className="village-map-linked-producer" key={link.holderId}>
    <strong>{ownerName(holders.find(h=>h.id===link.holderId)?.name??link.holderId)}</strong>
    <a href={`/producers/${encodeURIComponent(link.producerId)}`}>{link.producerName}</a>
    <span className="village-map-badge is-manual">Manually linked · farming unverified</span>
    <div className="village-map-link-actions">
     <button type="button" onClick={()=>onShow(link.holderId)}>Show right holder on map</button>
     <button type="button" disabled={Boolean(removing)} onClick={()=>onEdit(link.holderId)}>Change link</button>
     <button type="button" disabled={Boolean(removing)} onClick={()=>void remove(link.holderId)}>{removing===link.holderId?'Removing…':'Remove link'}</button>
    </div>
   </div>)}
  </>}
  {holder&&loaded&&<LinkEditor key={holder.id} parentId={parentId} holder={holder} current={links.find(l=>l.holderId===holder.id)}
   onCancel={()=>onEdit('')} onSaved={link=>{setLinks(items=>[...items.filter(l=>l.holderId!==link.holderId),link]);onEdit('');setError('')}}/>}
  {holder&&!loaded&&!error&&<p role="status">Loading your producer links…</p>}
 </div>;
}

function LinkEditor({parentId,holder,current,onSaved,onCancel}:{parentId:string;holder:Holder;current?:ParcelProducerLink;onSaved:(link:ParcelProducerLink)=>void;onCancel:()=>void}){
 const [producers,setProducers]=useState<ProducerSummary[]|null>(null),[query,setQuery]=useState(''),[chosen,setChosen]=useState(current?.producerId??'');
 const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[saving,setSaving]=useState(false);
 const searchId=useId(),selectId=useId(),titleId=useId();
 useEffect(()=>{
  let active=true;
  void listProducers().then(result=>{if(active){setProducers(result.items);setError('')}}).catch(()=>{if(active)setError('The producer catalogue could not load.')});
  return()=>{active=false};
 },[attempt]);
 const needle=placeKey(query),options=producers?.filter(p=>p.id===chosen||!needle||placeKey(`${p.canonicalName} ${p.homeLocality??''}`).includes(needle))??[];
 const save=async()=>{
  setSaving(true);setError('');
  try{onSaved(await saveParcelProducerLink(parentId,holder.id,chosen))}
  catch(e){setError((e as Error).message||'Could not save the link');setSaving(false)}
 };
 return <form className="village-map-link-editor" aria-labelledby={titleId} onSubmit={e=>{e.preventDefault();void save()}}>
  <strong id={titleId}>Link {ownerName(holder.name)} to an app producer</strong>
  <p className="village-map-note">Saved to your account for the 1 January 2025 rights snapshot. This links a recorded right holder to the catalogue; it does not verify who farms any parcel.</p>
  {error&&<div role="alert">{error}{!producers&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry catalogue</button>}</div>}
  {!producers&&!error&&<p role="status">Loading producers…</p>}
  {producers?.length===0&&<p>No producers in your catalogue yet. Add a wine to create its producer, then return here.</p>}
  {Boolean(producers?.length)&&<>
   <label htmlFor={searchId}>Search app producers</label>
   <input id={searchId} type="search" autoFocus value={query} disabled={saving} onChange={e=>setQuery(e.target.value)}/>
   <label htmlFor={selectId}>App producer</label>
   <select id={selectId} value={chosen} required disabled={saving} onChange={e=>setChosen(e.target.value)}>
    <option value="">Choose a producer</option>
    {options.map(p=><option key={p.id} value={p.id}>{p.canonicalName}{p.sharedOnly?' · shared':''}</option>)}
   </select>
   {!options.length&&<p>No matching producers. Try another name.</p>}
  </>}
  <div className="village-map-link-actions">
   <button type="submit" disabled={saving||!producers?.some(p=>p.id===chosen)}>{saving?'Saving…':'Save producer link'}</button>
   <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
  </div>
 </form>;
}
