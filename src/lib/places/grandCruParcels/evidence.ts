import type {HolderResearch} from '../parcelPresentation';
import {grandCruFor,type EvidenceSourceId} from './registry';

export type EvidenceKind='authorisation'|'suspended'|'application'|'notice'|'filing'|'research'|'ownership'|'sale'|'filiation'|'lineage'|'lead';
export type EvidenceSource={title:string;url:string;kind:'official'|'research'|'data'|'company'|'estate'|'other';date:string|null};
export type EvidenceContextPath={referencePath:string[];eventPath:string[];qualifications:string[];assignment?:string;method?:'documented-dfi'|'spatial-inference'};
export type EvidenceItem={kind:EvidenceKind;date:string|null;title:string;detail?:string;note?:string;label?:string;via?:string;sources:string[];
 dateRole?:string;method?:'documented-dfi'|'spatial-inference';originalReferenceId?:string;originalScope?:string;contextPaths?:EvidenceContextPath[]};
export type ParcelTracing={earliestSupportedEvent:{date:string;dateRole:string};paths:EvidenceContextPath[];
 terminals:(EvidenceContextPath&{referenceId:string;reason:string})[];issues:unknown[]};
export type HistoryCoverage={rightsImported:string[];earliestReachableDfiValidationDate:string|null;latestReachableDfiValidationDate:string|null;
 missingSources:unknown[];dfiSources:{asOf:string;department:string}[];
 sales?:{availableRange?:{start:string;end:string};observedCommuneRange:string[]|null};
 notices?:{availabilityAudit:{departments:Record<string,{earliestPublishedYearLocated:number;latestPublishedYearLocated:number;
  availabilityStatus:string;unsearchedIntervals:string[]}>};missingDepartmentIndexes:string[]};};
export type ParcelEvidenceData={sources:Record<string,EvidenceSource>;parcels:Record<string,EvidenceItem[]>;holderDomains?:Record<string,HolderResearch>;
 coverage?:Record<string,HistoryCoverage>;tracing?:Record<string,ParcelTracing>};

// Each research file is a separate chunk, loaded on first use so the map itself does not carry the records.
const loaders:Record<EvidenceSourceId,()=>Promise<{default:unknown}>>={
 'bonnes-mares':()=>import('./bonnes-mares.evidence.json'),
 'chambertin':()=>import('./chambertin.evidence.json'),
 'chambertin-clos-de-beze':()=>import('./chambertin-clos-de-beze.evidence.json'),
 'chapelle-chambertin':()=>import('./chapelle-chambertin.evidence.json'),
 'charmes-chambertin':()=>import('./charmes-chambertin.evidence.json'),
 'clos-de-la-roche':()=>import('./clos-de-la-roche.evidence.json'),
 'clos-de-tart':()=>import('./clos-de-tart.evidence.json'),
 'clos-de-vougeot':()=>import('./clos-de-vougeot.evidence.json'),
 'clos-des-lambrays':()=>import('./clos-des-lambrays.evidence.json'),
 'clos-saint-denis':()=>import('./clos-saint-denis.evidence.json'),
 'echezeaux':()=>import('./echezeaux.evidence.json'),
 'grands-echezeaux':()=>import('./grands-echezeaux.evidence.json'),
 'griotte-chambertin':()=>import('./griotte-chambertin.evidence.json'),
 'la-grande-rue':()=>import('./la-grande-rue.evidence.json'),
 'la-romanee':()=>import('./la-romanee.evidence.json'),
 'la-tache':()=>import('./la-tache.evidence.json'),
 'musigny':()=>import('./musigny.evidence.json'),
 'richebourg':()=>import('./richebourg.evidence.json'),
 'romanee-conti':()=>import('./romanee-conti.evidence.json'),
 'romanee-saint-vivant':()=>import('./romanee-saint-vivant.evidence.json'),
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
  if(file.coverage)Object.assign(merged.coverage??={},file.coverage);
  for(const [id,tracing] of Object.entries(file.tracing??{}))(merged.tracing??={})[id]??=tracing;
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
