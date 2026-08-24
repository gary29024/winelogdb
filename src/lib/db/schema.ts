import { z } from 'zod';
import { canonicalizeWineFields } from '../wine/canonicalize';

export const wineStyles = ['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified', 'orange', 'other'] as const;

const blankToNull=(value:unknown)=>typeof value==='string'&&!value.trim()?null:value;
const optionalText = z.preprocess(blankToNull,z.string().trim().max(500).optional().nullable());
const optionalDate = z.preprocess(blankToNull,z.string().date().optional().nullable());
const optionalNumber=(schema:z.ZodNumber)=>z.preprocess(value=>{
  if(value==null)return value;
  if(typeof value==='string'){
    const trimmed=value.trim();
    if(!trimmed)return null;
    const numeric=Number(trimmed);
    return Number.isFinite(numeric)?numeric:value;
  }
  return value;
},schema.optional().nullable());

// Do not derive this limit from Date during module initialization. Cloudflare Workers
// can initialize isolates with a frozen epoch clock, which previously produced 1971.
// 2200 is only a corruption/sanity guard; vintage semantics are otherwise four-digit years.
const MAX_VINTAGE_YEAR=2200;
const vintageSchema=z.unknown().optional().transform((value,ctx):number|null=>{
  if(value==null)return null;
  let numeric:number|undefined;
  if(typeof value==='number')numeric=value;
  else if(typeof value==='string'){
    const trimmed=value.trim();
    if(!trimmed)return null;
    if(/^\d{4}$/.test(trimmed))numeric=Number(trimmed);
  }
  if(numeric===undefined||!Number.isFinite(numeric)){
    const display=typeof value==='string'?JSON.stringify(value):String(value);
    ctx.addIssue({code:'custom',message:`Vintage must be a 4-digit year; received ${display} (${typeof value})`});
    return z.NEVER;
  }
  if(!Number.isInteger(numeric)){
    ctx.addIssue({code:'custom',message:`Vintage must be a whole year; received ${numeric}`});
    return z.NEVER;
  }
  if(numeric<1000||numeric>MAX_VINTAGE_YEAR){
    ctx.addIssue({code:'custom',message:`Vintage must be between 1000 and ${MAX_VINTAGE_YEAR}; received ${numeric}`});
    return z.NEVER;
  }
  return numeric;
});
const percentageSchema = optionalNumber(z.number().min(0).max(100));
const currencySchema = z.preprocess(value=>{
  if(value==null)return value;
  if(typeof value==='string'){
    const trimmed=value.trim();
    return trimmed?trimmed.toUpperCase():null;
  }
  return value;
},z.string().regex(/^[A-Z]{3}$/,'Use a 3-letter currency code such as USD, EUR or HKD').optional().nullable());
const wineStyleSchema = z.preprocess(value=>typeof value==='string'?value.trim().toLowerCase()||null:value,z.enum(wineStyles).optional().nullable());

export const grapeBlendEntrySchema = z.object({
  grape: z.string().trim().min(1).max(100),
  percentage: percentageSchema
});
const researchSourceTierSchema=z.enum(['authoritative','specialist','grounded','none']);
const researchFieldQualitySchema=z.object({
  status:z.enum(['verified','not_found','conflicting','not_applicable']),
  sourceTier:researchSourceTierSchema,
  score:z.number().min(0).max(100),
  warnings:z.array(z.string().trim().max(200)).max(10).default([])
});
export const deepSearchQualitySchema=z.object({
  status:z.enum(['verified','mixed','limited']),
  score:z.number().min(0).max(100),
  sourceTier:researchSourceTierSchema,
  warnings:z.array(z.string().trim().max(200)).max(20).default([]),
  fields:z.record(z.string(),researchFieldQualitySchema).default({})
});
const researchClaimSourceSchema=z.object({title:z.string().trim().max(300),url:z.string().url()});
const researchClaimProvenanceSchema=z.object({
  claim:z.string().trim().min(1).max(1500),
  supportStatus:z.enum(['supported','partial','unsupported','uncertainty','conflicting']),
  sourceTier:researchSourceTierSchema,
  sources:z.array(researchClaimSourceSchema).max(5).default([])
});
const researchFieldProvenanceSchema=z.object({
  claimCount:z.number().int().min(0).max(60),
  supportedCount:z.number().int().min(0).max(60),
  partialCount:z.number().int().min(0).max(60),
  unsupportedCount:z.number().int().min(0).max(60),
  uncertaintyCount:z.number().int().min(0).max(60),
  conflictingCount:z.number().int().min(0).max(60).default(0),
  directSupportRatio:z.number().min(0).max(1),
  claims:z.array(researchClaimProvenanceSchema).max(60).default([])
});
export const deepSearchProvenanceSchema=z.object({
  version:z.literal(1),
  fields:z.record(z.string(),researchFieldProvenanceSchema).default({})
});
export const deepSearchSchema = z.object({
  summary: z.string().trim().max(6000).default(''),
  vintageQuality: z.string().trim().max(4000).default(''),
  producerDetails: z.string().trim().max(5000).default(''),
  producerWinemakingPractices: z.string().trim().max(5000).default(''),
  winemakingTechniques: z.string().trim().max(5000).default(''),
  terroir: z.string().trim().max(4000).default(''),
  drinkingWindow: z.string().trim().max(2000).default(''),
  sources: z.array(z.object({ title: z.string().trim().max(300), url: z.string().url() })).max(20).default([]),
  model: z.string().trim().max(100),
  researchedAt: z.string().datetime(),
  quality:deepSearchQualitySchema.optional(),
  provenance:deepSearchProvenanceSchema.optional()
});
export const wineRecordSchema = z.object({
  id: z.string().uuid(), ownerId: z.string().min(1).max(128), producer: z.string().trim().min(1).max(200),
  wineName: z.string().trim().min(1).max(200), vintage: vintageSchema,
  country: optionalText, region: optionalText, appellation: optionalText,
  // Derived from the place tree and the label text on the way in, so callers
  // never have to supply it.
  classification: z.enum(['grand_cru','premier_cru','village']).nullable().optional().default(null),
  // A tier chosen by hand. Null derives as before; 'none' clears a derived one.
  classificationOverride: z.enum(['grand_cru','premier_cru','village','none']).nullable().optional().default(null), grapes: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  grapeBlend: z.array(grapeBlendEntrySchema).max(30).default([]),
  wineStyle: wineStyleSchema, alcoholPercentage: optionalNumber(z.number().min(0).max(30)),
  tastingNotes: z.string().trim().max(10000).default(''), rating: optionalNumber(z.number().min(0).max(100)),
  tastingDate: optionalDate, event: optionalText, venue: optionalText, price: optionalNumber(z.number().nonnegative()),
  currency: currencySchema, tags: z.array(z.string().trim().min(1).max(50)).max(50).default([]),
  tastingName: optionalText, locationName: optionalText,
  latitude: optionalNumber(z.number().min(-90).max(90)), longitude: optionalNumber(z.number().min(-180).max(180)),
  deepSearch: deepSearchSchema.optional().nullable(),
  imageIds: z.array(z.string().uuid()).max(30).default([]),
  imageObjectKeys: z.array(z.string().min(1)).max(30).default([]), recognitionStatus: z.enum(['pending','processing','review','complete','failed']).default('pending'),
  recognitionConfidence: optionalNumber(z.number().min(0).max(1)), createdAt: z.string().datetime(), updatedAt: z.string().datetime()
});
export type GrapeBlendEntry = z.infer<typeof grapeBlendEntrySchema>;
export type DeepSearchResult = z.infer<typeof deepSearchSchema>;
export type DeepSearchProvenance = z.infer<typeof deepSearchProvenanceSchema>;
export type WineRecord = z.infer<typeof wineRecordSchema>;
const wineInputBaseSchema = wineRecordSchema.omit({ id:true, ownerId:true, createdAt:true, updatedAt:true, deepSearch:true, imageIds:true, imageObjectKeys:true }).superRefine((value,ctx)=>{
  const knownTotal=value.grapeBlend.reduce((sum,x)=>sum+(x.percentage??0),0);
  if(knownTotal>100.0001)ctx.addIssue({code:'custom',path:['grapeBlend'],message:'Known grape percentages cannot total more than 100%'});
});
export const wineInputSchema = wineInputBaseSchema.transform(value=>canonicalizeWineFields(value));
export type WineInput = z.infer<typeof wineInputSchema>;
