import { authHeaders } from '../../lib/auth/client';
import type { ProducerEntity } from '../../lib/producers/entities';
import { canonicalCatalogEntries,catalogRowsForPresentation } from '../../lib/cuvees/catalogPresentation';
import type { CatalogCuveeSummary,CuveeCatalogLink } from '../../lib/cuvees/catalogLinks';
import type { CatalogDecision,CatalogDecisionKind } from '../../lib/producers/catalogDecisions';
import { matchCuveeReleaseVariantToCatalog } from '../../lib/cuvees/releaseVariants';

export type ProducerSummary={id:string;canonicalName:string;homeCountry:string|null;homeRegion:string|null;homeLocality:string|null;tastedCount:number;catalogCount:number;researchedAt:string|null};
export type TastedWine={id:string;wineName:string;vintage:number|null;appellation:string|null;region:string|null;country:string|null;wineStyle:string|null;grapes:string[];imageId:string|null;tastingDate:string|null;rating:number|null;cuveeId:string|null;catalogCuveeId:string|null;releaseParentCuveeId?:string|null;releaseParentName?:string|null;releaseDesignation?:string|null;releaseSequence?:number|null};
export type LinkedProducer={mergeId:string;producerId:string;name:string;mergedAt:string};
export type ManualProducerContactType='email'|'phone'|'website'|'instagram'|'other';
export type ManualProducerContact={id:string;type:ManualProducerContactType;label:string|null;value:string;note:string|null;createdAt:string;updatedAt:string};
export type ManualProducerContactInput={type:ManualProducerContactType;label?:string;value:string;note?:string};
export type ProducerCatalogCuvee=CatalogCuveeSummary&{tastedReleases?:string[]};
export type ProducerDetail=ProducerEntity&{aliases:string[];tastedWines:TastedWine[];researchHistoryCount:number;linkedProducers:LinkedProducer[];catalogCuvees:ProducerCatalogCuvee[];cuveeCatalogLinks:CuveeCatalogLink[];supplementaryContacts:ManualProducerContact[];catalogDecisions:CatalogDecision[]};
/** A house whose name contains, or is contained by, the one read off the label. Proposed, never applied. */
export type ProducerSuggestion={id:string;canonicalName:string;tastedCount:number};
export type ProducerResolution={matched:boolean;inputName:string;suggestion?:ProducerSuggestion;producer?:{id:string;canonicalName:string;matchedName:string;matchType:'canonical'|'alias'|'normalized';researchedAt:string|null;catalogCount:number;tastedCount:number}};
export type ProducerResearchStage='preparing'|'searching'|'retrying'|'parsing'|'saving'|'image'|'complete'|'failed';
export type ProducerResearchRun={requestId:string;producerId:string;status:'running'|'complete'|'failed';stage:ProducerResearchStage;attempt:number;message:string|null;startedAt:string;updatedAt:string;completedAt:string|null;durationMs:number|null};
export type ResearchCancelResult={ok:true;cancelled:boolean;alreadyTerminal:boolean;requestId:string;trackedBatches?:number;remoteCancellation?:Array<{name:string;ok:boolean;status:number;error?:string}>};

async function json<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw new Error(body.error||message);return body}
export const listProducers=()=>fetch('/api/producers',{headers:authHeaders()}).then(r=>json<{items:ProducerSummary[]}>(r,'Could not load producers'));
export const resolveProducer=(name:string)=>fetch(`/api/producers/resolve?name=${encodeURIComponent(name)}`,{headers:authHeaders()}).then(r=>json<ProducerResolution>(r,'Could not resolve producer'));
export const getProducer=(id:string)=>fetch(`/api/producers/${id}`,{headers:authHeaders()}).then(r=>json<ProducerDetail>(r,'Producer not found')).then(detail=>{
  const producerNames=[detail.canonicalName,...detail.aliases],catalog=canonicalCatalogEntries(detail.catalog,producerNames);
  const catalogCuvees=catalogRowsForPresentation(catalog,producerNames,detail.catalogCuvees);
  const releaseCounts=new Map<string,number>(),releaseNames=new Map<string,Map<number,string>>();
  const tastedWines=detail.tastedWines.map(wine=>{
    const match=matchCuveeReleaseVariantToCatalog({name:wine.wineName,appellation:wine.appellation,wineStyle:wine.wineStyle},catalogCuvees,producerNames);
    const compatible=Boolean(match&&(!wine.catalogCuveeId||wine.catalogCuveeId===match.catalogCuveeId));
    if(!match||!compatible)return {...wine,releaseParentCuveeId:null,releaseParentName:null,releaseDesignation:null,releaseSequence:null};
    if(!wine.catalogCuveeId)releaseCounts.set(match.catalogCuveeId,(releaseCounts.get(match.catalogCuveeId)??0)+1);
    const releases=releaseNames.get(match.catalogCuveeId)??new Map<number,string>();releases.set(match.variant.sequence,match.variant.designation);releaseNames.set(match.catalogCuveeId,releases);
    return {...wine,catalogCuveeId:wine.catalogCuveeId??match.catalogCuveeId,releaseParentCuveeId:match.catalogCuveeId,releaseParentName:match.catalogName,releaseDesignation:match.variant.designation,releaseSequence:match.variant.sequence};
  });
  const catalogWithReleases=catalogCuvees.map(row=>{
    const releases=releaseNames.get(row.id),tastedReleases=releases?[...releases.entries()].sort((a,b)=>b[0]-a[0]).map(([,label])=>label):[];
    return {...row,tastedCount:row.tastedCount+(releaseCounts.get(row.id)??0),tastedReleases};
  });
  return {...detail,catalog,supplementaryContacts:detail.supplementaryContacts??[],catalogDecisions:detail.catalogDecisions??[],tastedWines,catalogCuvees:catalogWithReleases};
});
export const setPrimaryProducerName=(id:string,name:string)=>fetch(`/api/producers/${id}/primary-name`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({name})}).then(r=>json<{id:string;canonicalName:string}>(r,'Could not change primary name'));
export const getProducerResearchStatus=(id:string,requestId?:string)=>{
  const suffix=requestId?`?requestId=${encodeURIComponent(requestId)}`:'';
  return fetch(`/api/producers/${id}/research-status${suffix}`,{headers:authHeaders()}).then(async r=>r.status===404?null:json<ProducerResearchRun>(r,'Could not load producer research status'));
};
export const researchProducer=(id:string,requestId=crypto.randomUUID())=>fetch(`/api/producers/${id}/research`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH',requestId})}).then(r=>json<{accepted:true;researchRequestId:string;existing:boolean}>(r,'Producer research could not be queued'));
export const cancelProducerResearch=(id:string,requestId:string)=>fetch(`/api/producers/${id}/research-cancel`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'CANCEL_PRODUCER_RESEARCH',requestId})}).then(r=>json<ResearchCancelResult>(r,'Could not cancel producer research'));
export const mergeProducer=(destinationId:string,sourceProducerId:string)=>fetch(`/api/producers/${destinationId}/merge`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'MERGE_PRODUCER',sourceProducerId})}).then(r=>json<{mergeId:string;destinationId:string;canonicalName:string;mergedName:string}>(r,'Could not link producer'));
export const deleteProducer=(id:string)=>fetch(`/api/producers/${id}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'DELETE_PRODUCER'})}).then(r=>json<{id:string;canonicalName:string;deleted:true}>(r,'Could not delete this producer'));
export const unlinkProducer=(destinationId:string,mergeId:string)=>fetch(`/api/producers/${destinationId}/unlink`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNLINK_PRODUCER',mergeId})}).then(r=>json<{destinationId:string;restoredProducerId:string;canonicalName:string;unlinkedName:string}>(r,'Could not unlink producer'));
export const createSupplementaryContact=(producerId:string,input:ManualProducerContactInput)=>fetch(`/api/producers/${producerId}/manual-contacts`,{method:'POST',headers:authHeaders(true),body:JSON.stringify(input)}).then(r=>json<ManualProducerContact>(r,'Could not add supplementary contact'));
export const updateSupplementaryContact=(producerId:string,contactId:string,input:ManualProducerContactInput)=>fetch(`/api/producers/${producerId}/manual-contacts/${contactId}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify(input)}).then(r=>json<ManualProducerContact>(r,'Could not update supplementary contact'));
export const deleteSupplementaryContact=(producerId:string,contactId:string)=>fetch(`/api/producers/${producerId}/manual-contacts/${contactId}`,{method:'DELETE',headers:authHeaders(true),body:JSON.stringify({confirmation:'DELETE_MANUAL_CONTACT'})}).then(r=>json<{id:string;deleted:true}>(r,'Could not delete supplementary contact'));
export const linkTastedCuveeToCatalog=(producerId:string,sourceCuveeId:string,catalogCuveeId:string)=>fetch(`/api/producers/${producerId}/cuvee-links`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'LINK_CUVEE_TO_CATALOG',sourceCuveeId,catalogCuveeId})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;existing:boolean}>(r,'Could not link tasted cuvée to catalog'));
export const changeTastedCuveeCatalogLink=(producerId:string,linkId:string,catalogCuveeId:string)=>fetch(`/api/producers/${producerId}/cuvee-links/${linkId}`,{method:'PUT',headers:authHeaders(true),body:JSON.stringify({confirmation:'CHANGE_CUVEE_CATALOG_LINK',catalogCuveeId})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;changed:boolean}>(r,'Could not change catalog link'));
export const unlinkTastedCuveeFromCatalog=(producerId:string,linkId:string)=>fetch(`/api/producers/${producerId}/cuvee-links/${linkId}/unlink`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNLINK_CUVEE_FROM_CATALOG'})}).then(r=>json<{id:string;sourceCuveeId:string;catalogCuveeId:string;unlinked:boolean}>(r,'Could not unlink tasted cuvée from catalog'));

export const saveProducerCatalogDecision=(producerId:string,input:{decision:CatalogDecisionKind;sourceKey:string;sourceName:string;targetKey?:string|null;targetName?:string|null})=>
  fetch(`/api/producers/${producerId}/catalog-decisions`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'CORRECT_PRODUCER_CATALOG',...input})})
    .then(r=>json<CatalogDecision>(r,'Could not save the catalogue correction'));
export const undoProducerCatalogDecision=(producerId:string,decisionId:string)=>
  fetch(`/api/producers/${producerId}/catalog-decisions/${decisionId}/undo`,{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'UNDO_PRODUCER_CATALOG_CORRECTION'})})
    .then(r=>json<{id:string;deleted:true}>(r,'Could not undo the catalogue correction'));
export type ResearchCampaignItem={producerId:string;producerName:string;status:'pending'|'running'|'complete'|'failed'|'skipped';message:string|null};
export type ResearchCampaign={
  id:string;status:'running'|'complete'|'cancelled';requested:number;concurrency:number;
  createdAt:string;updatedAt:string;finishedAt:string|null;dismissedAt:string|null;
  counts:Record<ResearchCampaignItem['status'],number>;
  items:ResearchCampaignItem[];failures:ResearchCampaignItem[];running:ResearchCampaignItem[];
};
export type ResearchCampaignSummary={
  id:string;status:ResearchCampaign['status'];requested:number;createdAt:string;finishedAt:string|null;
  counts:Record<ResearchCampaignItem['status'],number>;
};
export type ResearchCampaignPlan={unresearched:number;willRun:number;maxPerRun:number;concurrency:number;geminiRequests:number;searchQueries:number;searchesPerRequest:number|null;perProducerMs:number|null;estimatedMs:number|null;active:string|null};

export const getResearchCampaignPlan=(limit?:number)=>
  fetch(`/api/producers/research-batch/plan${limit?`?limit=${limit}`:''}`,{headers:authHeaders()})
    .then(r=>json<ResearchCampaignPlan>(r,'Could not work out what a batch run would involve'));
export const getResearchCampaign=()=>
  fetch('/api/producers/research-batch',{headers:authHeaders()}).then(r=>json<{campaign:ResearchCampaign|null}>(r,'Could not load the batch run')).then(r=>r.campaign);
export const startResearchCampaign=(limit:number)=>
  fetch('/api/producers/research-batch',{method:'POST',headers:authHeaders(true),body:JSON.stringify({confirmation:'RUN_PRODUCER_RESEARCH_BATCH',limit})})
    .then(r=>json<{accepted:true;campaign:ResearchCampaign}>(r,'The batch run could not be queued')).then(r=>r.campaign);
export const listResearchCampaigns=(limit=10)=>
  fetch(`/api/producers/research-batch/history?limit=${limit}`,{headers:authHeaders()})
    .then(r=>json<{campaigns:ResearchCampaignSummary[]}>(r,'Could not load past batch runs')).then(r=>r.campaigns);
export const getResearchCampaignById=(id:string)=>
  fetch(`/api/producers/research-batch/${id}`,{headers:authHeaders()})
    .then(r=>json<{campaign:ResearchCampaign}>(r,'Could not load that batch run')).then(r=>r.campaign);
export const cancelResearchCampaign=(id:string)=>
  fetch(`/api/producers/research-batch/${id}/cancel`,{method:'POST',headers:authHeaders(true),body:'{}'})
    .then(r=>json<{campaign:ResearchCampaign|null}>(r,'Could not stop the batch run')).then(r=>r.campaign);
export const dismissResearchCampaign=(id:string)=>
  fetch(`/api/producers/research-batch/${id}/dismiss`,{method:'POST',headers:authHeaders(true),body:'{}'})
    .then(r=>json<{campaign:ResearchCampaign|null}>(r,'Could not clear the batch run')).then(r=>r.campaign);

export type { CatalogDecision,CatalogDecisionKind };
