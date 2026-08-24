import { z } from 'zod';
import { canonicalizeWineFields } from '../../lib/wine/canonicalize';
import { normalizeRecognitionVintage } from './vintage';

const nullableText=z.string().trim().max(300).nullable().optional();
const wineStyles=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
const grapeBlendEntry=z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});
const recognitionVintageSchema=z.preprocess(normalizeRecognitionVintage,z.number().int().min(1000).max(2200).nullable().optional());

export const groupBoundingBoxSchema=z.object({
  xMin:z.number().min(0).max(1000),
  yMin:z.number().min(0).max(1000),
  xMax:z.number().min(0).max(1000),
  yMax:z.number().min(0).max(1000)
}).superRefine((box,ctx)=>{
  if(box.xMax<=box.xMin)ctx.addIssue({code:'custom',path:['xMax'],message:'xMax must be greater than xMin'});
  if(box.yMax<=box.yMin)ctx.addIssue({code:'custom',path:['yMax'],message:'yMax must be greater than yMin'});
});

export const groupRecognitionWineSchema=z.object({
  producer:z.string().trim().min(1).max(300),
  wineName:z.string().trim().min(1).max(300),
  vintage:recognitionVintageSchema,
  country:nullableText,
  region:nullableText,
  appellation:nullableText,
  grapes:z.array(z.string().trim().max(100)).max(20).default([]),
  grapeBlend:z.array(grapeBlendEntry).max(20).default([]),
  style:z.enum(wineStyles).nullable().optional(),
  alcoholPercentage:z.number().min(0).max(100).nullable().optional(),
  locationName:nullableText,
  confidence:z.number().min(0).max(1),
  boundingBox:groupBoundingBoxSchema
}).strict();

export const groupRecognitionSchema=z.object({
  wines:z.array(groupRecognitionWineSchema).max(12),
  unresolvedCount:z.number().int().min(0).max(30).default(0),
  requestId:z.string().uuid().optional(),
  recognitionDurationMs:z.number().int().nonnegative().optional()
}).strict();

export type GroupBoundingBox=z.infer<typeof groupBoundingBoxSchema>;
export type GroupRecognitionWine=z.infer<typeof groupRecognitionWineSchema>;
export type GroupRecognitionResult=z.infer<typeof groupRecognitionSchema>;

const identityKey=(wine:GroupRecognitionWine)=>[
  wine.producer.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
  wine.wineName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
  wine.vintage??'nv'
].join('::');

export function dedupeGroupRecognitionWines(wines:GroupRecognitionWine[]){
  const byIdentity=new Map<string,GroupRecognitionWine>();
  for(const raw of wines){
    const wine=canonicalizeWineFields(raw),key=identityKey(wine),existing=byIdentity.get(key);
    if(!existing||wine.confidence>existing.confidence)byIdentity.set(key,wine);
  }
  return [...byIdentity.values()].sort((a,b)=>a.boundingBox.xMin-b.boundingBox.xMin||a.boundingBox.yMin-b.boundingBox.yMin);
}

function normalizeGroupEnvelope(value:unknown){
  if(Array.isArray(value))return {wines:value,unresolvedCount:0};
  return value;
}

export function parseGroupRecognition(raw:string):GroupRecognitionResult{
  const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,'');
  const parsed=groupRecognitionSchema.parse(normalizeGroupEnvelope(JSON.parse(cleaned)));
  return {...parsed,wines:dedupeGroupRecognitionWines(parsed.wines)};
}
