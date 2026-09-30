import {placeKey} from './resolve';
import {ownerName} from './echezeauxParcelOwners';
import type {ParcelProducerLink} from './parcelProducerLinks';

export type HolderResearch={name:string;basis:string;note:string;sources:string[]};
type ParcelRow={properties:{id:string;recordedRights:{holderId:string;name:string}[];overlaps:{parentFeatureId:string;areaM2:number}[]}};
export type HolderGroup={id:string;name:string;domaine:boolean;holderIds:string[];legalNames:string[];areaM2:number;count:number;sources:string[];
 basisLabel:string;lead?:{name:string;label:string}};

// No current farmer is verified, so only identity/estate research may name a
// domaine heading. Weak leads stay under the legal name, labelled as leads.
// Tenancy, lease and operator relationships are never shown in this list.
const headingLabels:Record<string,string>={
 'estate-context':'Estate source','secondary-estate-context':'Estate source','management-and-estate-context':'Estate source',
 'brand-identity-confirmed':'Brand identity confirmed','identity-only':'Registry identity only'};
const leadLabels:Record<string,string>={
 'registered-office-match':'office address only','management-only-lead':'shared management only',
 'succession-lead':'ownership succession lead','partial-succession-lead':'ownership succession lead'};

// A saved catalogue identity is not a fuzzy producer-name suggestion.
// Prefer the account's ID; only missing IDs use the complete normalized name.
// In particular Gros, Mugneret and Bizot family members must not collapse.
const producerKey=(name:string)=>placeKey(name).replace(/^domaines?\s+/, '');
export function matchesLinkedProducer(link:ParcelProducerLink, producer?:string|null, producerId?:string|null):boolean{
 if(producerId)return link.producerId===producerId;
 if(producer===undefined||producer===null)return true; // Generic catalogue browsing, not a known wine producer.
 const key=producerKey(producer);
 return Boolean(key)&&producerKey(link.producerName)===key;
}

/** Presentation of recorded rights, never an assignment of ownership or farming.
 * Each group is the union of its holders' parcels in this cru. Duplicate
 * rights and co-ownership inside a group cannot multiply its area/count. */
export function groupParcelRightHolders(parcels:readonly ParcelRow[],parentId:string,research:Record<string,HolderResearch>={}):HolderGroup[]{
 const groups=new Map<string,HolderGroup&{parcels:Set<string>;holders:Set<string>;names:Set<string>;sourceIds:Set<string>}>();
 for(const parcel of parcels){
  const overlap=parcel.properties.overlaps.find(o=>o.parentFeatureId===parentId);
  if(!overlap)continue;
  for(const right of parcel.properties.recordedRights){
   const found=research[right.holderId];
   const context=found&&headingLabels[found.basis]?found:undefined;
   const lead=found&&leadLabels[found.basis]?{name:found.name,label:leadLabels[found.basis]}:undefined;
   const id=context?`domaine:${placeKey(context.name)}`:right.holderId;
   let group=groups.get(id);
   if(!group){
    group={id,name:context?.name??ownerName(right.name),domaine:Boolean(context),holderIds:[],legalNames:[],sources:[],areaM2:0,count:0,
     basisLabel:context?headingLabels[context.basis]:'',lead,parcels:new Set(),holders:new Set(),names:new Set(),sourceIds:new Set()};
    groups.set(id,group);
   }
   group.holders.add(right.holderId);group.names.add(ownerName(right.name));
   for(const source of (context??(lead?found:undefined))?.sources??[])group.sourceIds.add(source);
   if(!group.parcels.has(parcel.properties.id)){
    group.parcels.add(parcel.properties.id);group.areaM2+=overlap.areaM2;group.count++;
   }
  }
 }
 return [...groups.values()].map(g=>({id:g.id,name:g.name,domaine:g.domaine,holderIds:[...g.holders].sort(),legalNames:[...g.names].sort(),
  sources:[...g.sourceIds].sort(),areaM2:g.areaM2,count:g.count,basisLabel:g.basisLabel,...(g.lead?{lead:g.lead}:{})})).sort((a,b)=>b.areaM2-a.areaM2||a.name.localeCompare(b.name));
}
