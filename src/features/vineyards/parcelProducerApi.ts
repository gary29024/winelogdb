import {apiFetch,authHeaders} from '../../lib/auth/client';
import type {ParcelProducerLink} from '../../lib/places/parcelProducerLinks';
import {parcelManifestFor} from '../../lib/places/grandCruParcels/registry';

// Links are keyed by the cru and its bundle's rights snapshot, so a new snapshot starts with no links.
const path=(parent:string)=>`/api/parcel-producer-links?parent=${encodeURIComponent(parent)}&snapshot=${parcelManifestFor(parent)?.rightsAsOf??''}`;
async function read<T>(response:Response):Promise<T>{
 const value=await response.json() as T&{error?:string};
 if(!response.ok)throw new Error(value.error||'Could not load producer links');
 return value;
}
export const listParcelProducerLinks=(parent:string)=>apiFetch(path(parent)).then(read<{items:ParcelProducerLink[]}>);
export const saveParcelProducerLink=(parent:string,holderId:string,producerId:string)=>apiFetch(path(parent),{
 method:'PUT',headers:authHeaders(true),body:JSON.stringify({holderId,producerId}),
}).then(read<ParcelProducerLink>);
export const removeParcelProducerLink=(parent:string,holderId:string)=>apiFetch(path(parent),{
 method:'DELETE',headers:authHeaders(true),body:JSON.stringify({holderId}),
}).then(read<{deleted:true}>);
