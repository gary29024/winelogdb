import {placeKey} from './resolve';
import {ownerName} from './echezeauxParcelOwners';
import type {ParcelProducerLink} from './parcelProducerLinks';

export type HolderResearch={name:string;basis:string;note:string;sources:string[]};
type ParcelRow={properties:{id:string;recordedRights:{holderId:string;name:string}[];overlaps:{parentFeatureId:string;areaM2:number}[]}};
export type HolderGroup={id:string;name:string;domaine:boolean;holderIds:string[];legalNames:string[];areaM2:number;count:number;sources:string[]};

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
   const context=research[right.holderId];
   const id=context?`domaine:${placeKey(context.name)}`:right.holderId;
   let group=groups.get(id);
   if(!group){
    group={id,name:context?.name??ownerName(right.name),domaine:Boolean(context),holderIds:[],legalNames:[],sources:[],areaM2:0,count:0,
     parcels:new Set(),holders:new Set(),names:new Set(),sourceIds:new Set()};
    groups.set(id,group);
   }
   group.holders.add(right.holderId);group.names.add(ownerName(right.name));
   for(const source of context?.sources??[])group.sourceIds.add(source);
   if(!group.parcels.has(parcel.properties.id)){
    group.parcels.add(parcel.properties.id);group.areaM2+=overlap.areaM2;group.count++;
   }
  }
 }
 return [...groups.values()].map(g=>({id:g.id,name:g.name,domaine:g.domaine,holderIds:[...g.holders].sort(),legalNames:[...g.names].sort(),
  sources:[...g.sourceIds].sort(),areaM2:g.areaM2,count:g.count})).sort((a,b)=>b.areaM2-a.areaM2||a.name.localeCompare(b.name));
}
