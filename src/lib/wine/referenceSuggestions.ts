import { normalizeReferenceText } from './referenceCatalog';
import { referenceAppRegion,regionWithin } from './referenceGeography';
import { lwinDisplayWineName,sameWineDisplayName } from './lwinDisplayName';

export const referenceSuggestionFields=['producer','wineName','country','region','classification'] as const;
export type ReferenceSuggestionField=typeof referenceSuggestionFields[number];
export type ReferenceSuggestion={field:ReferenceSuggestionField;label:string;current:string|null;suggested:string;suggestedValue?:string};

export function appClassification(value:string|null|undefined){
 const normalized=normalizeReferenceText(value);
 if(normalized==='grand cru')return 'grand_cru';
 if(normalized==='premier cru'||normalized==='1er cru')return 'premier_cru';
 if(normalized==='village')return 'village';
 return null;
}
export function classificationLabel(value:string|null|undefined){
 if(value==='grand_cru')return 'Grand Cru';
 if(value==='premier_cru')return 'Premier Cru';
 if(value==='village')return 'Village';
 return value?.trim()||null;
}
type SuggestionInput={
 lwinReference?:{displayName?:string|null;wineName?:string|null}|null;referenceDisplayName?:string|null;
 producer?:string|null;wineName?:string|null;country?:string|null;region?:string|null;classification?:string|null;classificationOverride?:string|null;
 referenceProducer?:string|null;referenceWineName?:string|null;referenceCountry?:string|null;referenceRegion?:string|null;referenceSubRegion?:string|null;referenceClassification?:string|null;
};
export function buildReferenceSuggestions(input:SuggestionInput):ReferenceSuggestion[]{
 const suggestions:ReferenceSuggestion[]=[];
 const pairs:Array<[ReferenceSuggestionField,string,string|null|undefined,string|null|undefined]>=[
  ['producer','Producer',input.producer,input.referenceProducer],
  ['wineName','Wine name',input.wineName,lwinDisplayWineName({displayName:input.referenceDisplayName??input.lwinReference?.displayName,wineName:input.referenceWineName??input.lwinReference?.wineName})],
  ['country','Country',input.country,input.referenceCountry],
  ['region','Region',input.region,referenceAppRegion({country:input.referenceCountry,region:input.referenceRegion,subRegion:input.referenceSubRegion})]
 ];
 for(const [field,label,current,suggested] of pairs){
  const a=current?.trim()||null,b=suggested?.trim()||null;
  if(!a||!b||normalizeReferenceText(a)===normalizeReferenceText(b))continue;
  if(field==='wineName'&&sameWineDisplayName(a,b))continue;
  if(field==='region'&&regionWithin(a,b,input.country,input.referenceCountry))continue;
  suggestions.push({field,label,current:a,suggested:b});
 }
 if(!input.classificationOverride){
  const suggested=appClassification(input.referenceClassification),current=input.classification?.trim()||null;
  if(current&&suggested&&current!==suggested)suggestions.push({field:'classification',label:'Classification',current:classificationLabel(current),suggested:classificationLabel(suggested)!,suggestedValue:suggested});
 }
 return suggestions;
}

/** Refresh pending comparisons without reopening fields the user already kept. */
export function refreshPendingReferenceSuggestions(input:SuggestionInput,stored:unknown):ReferenceSuggestion[]{
 let previous:unknown;try{previous=JSON.parse(String(stored??'[]'))}catch{return []}
 if(!Array.isArray(previous))return [];
 const fields=new Set(previous.filter(item=>item&&typeof item==='object').map(item=>item.field));
 return buildReferenceSuggestions(input).filter(item=>fields.has(item.field));
}
