import type { WineInput } from '../src/lib/db/schema';
import { ApiError,hash } from '../src/lib/credits/primitives';
import { enrichRecognitionReference,type ReferenceIdentityInput } from '../src/lib/wine/referenceIdentity';
import { buildReferenceSuggestions } from '../src/lib/wine/referenceSuggestions';

async function matchToken(wine:ReferenceIdentityInput){
 return hash(JSON.stringify([wine.producer,wine.wineName,wine.vintage,wine.vintageKind,wine.releaseDesignation,wine.country,wine.region,wine.wineStyle,
  wine.referenceProductKey,wine.lwin7,wine.lwin11,wine.elid,wine.referenceProducer,wine.referenceWineName,wine.referenceCountry,wine.referenceRegion,wine.colour,wine.productType,wine.productSubtype]));
}

export async function previewLoggingReference(bucket:R2Bucket,input:WineInput){
 const wine=await enrichRecognitionReference(bucket,input) as WineInput&ReferenceIdentityInput;
 const matched=wine.identityMatchStatus==='matched'&&Boolean(wine.lwin7);
 const needsReview=matched&&buildReferenceSuggestions(wine).length>0;
 return {matched,needsReview,producer:matched?wine.referenceProducer:null,wineName:matched?wine.referenceWineName:null,country:matched?wine.referenceCountry:null,region:matched?wine.referenceRegion:null,
  colour:matched?wine.colour:null,productType:matched?wine.productType:null,productSubtype:matched?wine.productSubtype:null,token:matched?await matchToken(wine):null};
}

export async function resolveLoggingReference(bucket:R2Bucket,input:WineInput){
 if(input.referenceDecision?.action==='none'||input.referenceDecision?.action==='unmatched')return {...input,referenceProductKey:null,lwin7:null,lwin11:null,elid:null,referenceSite:null,referenceParcel:null,
  colour:null,productType:null,productSubtype:null,identityMatchStatus:input.referenceDecision.action==='none'?'manual' as const:'unmatched' as const,identityMatchConfidence:null,identityMatchCandidates:[]};
 const wine=await enrichRecognitionReference(bucket,input) as WineInput&ReferenceIdentityInput;
 if(input.referenceDecision?.action==='confirm'&&(!wine.lwin7||wine.identityMatchStatus!=='matched'||input.referenceDecision.token!==await matchToken(wine)))throw new ApiError(409,'The wine match changed. Please save again to check the latest details.');
 return wine;
}
