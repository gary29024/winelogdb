import type {HolderResearch} from '../parcelPresentation';
import {grandCruFor,type EvidenceSourceId} from './registry';

export type EvidenceKind='authorisation'|'suspended'|'application'|'filing'|'research'|'ownership'|'sale'|'lineage'|'lead';
export type EvidenceSource={title:string;url:string;kind:'official'|'research'|'data'|'company'|'estate'|'other';date:string|null};
export type EvidenceItem={kind:EvidenceKind;date:string|null;title:string;detail?:string;note?:string;label?:string;via?:string;sources:string[]};
export type ParcelEvidenceData={sources:Record<string,EvidenceSource>;parcels:Record<string,EvidenceItem[]>;holderDomains?:Record<string,HolderResearch>};

// Each research file is a separate chunk, loaded on first use so the map itself does not carry the records.
const loaders:Record<EvidenceSourceId,()=>Promise<{default:unknown}>>={
 echezeaux:()=>import('./echezeaux.evidence.json'),
 'grands-echezeaux':()=>import('./grands-echezeaux.evidence.json'),
 'clos-de-vougeot':()=>import('./clos-de-vougeot.evidence.json'),
};

const empty=():ParcelEvidenceData=>({sources:{},parcels:{},holderDomains:{}});
/** Several research files for one cru: records of the same parcel are kept together, the first domaine heading wins. */
export function mergeParcelEvidence(files:ParcelEvidenceData[]):ParcelEvidenceData{
 if(files.length===1)return files[0];
 const merged=empty();
 for(const file of files){
  Object.assign(merged.sources,file.sources);
  for(const [id,items] of Object.entries(file.parcels))merged.parcels[id]=[...merged.parcels[id]??[],...items];
  for(const [id,research] of Object.entries(file.holderDomains??{}))merged.holderDomains![id]??=research;
 }
 return merged;
}

const cache=new Map<string,Promise<ParcelEvidenceData>>();
/** Evidence for a cru's parcels. A cru without research resolves to no records; a failed load can be retried. */
export function loadParcelEvidence(parentFeatureId:string):Promise<ParcelEvidenceData>{
 const cached=cache.get(parentFeatureId);
 if(cached)return cached;
 const sources=grandCruFor(parentFeatureId)?.evidenceFrom??[];
 const pending=Promise.all(sources.map(id=>loaders[id]().then(module=>module.default as ParcelEvidenceData)))
  .then(files=>files.length?mergeParcelEvidence(files):empty())
  .catch(error=>{cache.delete(parentFeatureId);throw error});
 cache.set(parentFeatureId,pending);
 return pending;
}

export const hasParcelEvidence=(parentFeatureId:string)=>Boolean(grandCruFor(parentFeatureId)?.evidenceFrom.length);
