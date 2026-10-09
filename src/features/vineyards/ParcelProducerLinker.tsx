import {useMemo} from 'react';
import type {HolderGroup} from '../../lib/places/parcelPresentation';
import {possibleOwnerMatch} from '../../lib/places/parcelOwners';
import type {ParcelProducerLinks} from './useParcelProducerLinks';

const ha=(m2:number)=>`${(m2/10000).toFixed(2)} ha`;

/** Whether this wine's producer is linked to any holder row, with a one-tap suggestion when it is not. */
export function ProducerLinkCard({producer,rows,links,onShow}:{producer:string;rows:HolderGroup[];links:ParcelProducerLinks;onShow:(row:HolderGroup)=>void}){
 const {loaded,error,busy,linked,hasProducer,canLink,retry,link,unlink}=links;
 const linkedRows=rows.filter(row=>row.holderIds.some(id=>linked.has(id)));
 // A name match is only a suggestion: nothing is saved until the reader taps Link.
 const suggestions=useMemo(()=>rows.filter(row=>[row.name,...row.legalNames].some(name=>possibleOwnerMatch(producer,name))).slice(0,3),[rows,producer]);
 // Without a catalogue producer there is nothing to link; only links saved under its name show.
 if(!hasProducer&&!linkedRows.length)return null;
 return <section className="village-map-producer" aria-label="This wine’s producer">
  <p className="village-map-eyebrow is-wine">THIS WINE’S PRODUCER</p>
  <strong>{producer}</strong>
  {error&&<div role="alert"><p className="village-map-note">{error}</p>{!loaded&&<button type="button" className="village-map-link-button" onClick={retry}>Retry producer links</button>}</div>}
  {!loaded&&!error&&<p className="village-map-note" role="status">Loading your producer links…</p>}
  {linkedRows.map(row=><div key={row.id} className="village-map-linked-producer">
   <span>Linked to <strong>{row.name}</strong> · {ha(row.areaM2)}</span>
   <span className="village-map-badge is-manual">Manual link · unverified</span>
   <div className="village-map-link-actions">
    <button type="button" onClick={()=>onShow(row)}>Show on map</button>
    <button type="button" disabled={Boolean(busy)} aria-label={`Unlink ${row.name}`} onClick={()=>void unlink(row)}>{busy===row.id?'Unlinking…':'Unlink'}</button>
   </div>
  </div>)}
  {canLink&&!linkedRows.length&&<>
   <p className="village-map-note">Not linked to any parcels yet.</p>
   {suggestions.map(row=><div key={row.id} className="village-map-linked-producer">
    <span>Looks like <strong>{row.name}</strong> · {ha(row.areaM2)}</span>
    <div className="village-map-link-actions">
     <button type="button" onClick={()=>onShow(row)}>Show on map</button>
     <button type="button" disabled={Boolean(busy)} aria-label={`Link ${row.name} to ${producer}`} onClick={()=>void link(row).then(()=>onShow(row))}>{busy===row.id?'Linking…':'Link'}</button>
    </div>
   </div>)}
   <p className="village-map-note">{suggestions.length?'Not the right one? ':''}Choose its row in the list below to link it.</p>
  </>}
 </section>;
}
