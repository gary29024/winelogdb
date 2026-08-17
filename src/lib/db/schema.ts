import { z } from 'zod';
import { canonicalizeWineFields } from '../wine/canonicalize';

export const wineStyles = ['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified', 'orange', 'other'] as const;
const optionalText = z.string().trim().max(500).optional().nullable();
const vintageSchema = z.preprocess(value=>{
  if(value==null)return value;
  if(typeof value==='string'){
    const trimmed=value.trim();
    if(!trimmed)return null;
    const numeric=Number(trimmed);
    return Number.isFinite(numeric)?numeric:value;
  }
  return value;
},z.number().int().min(1000).max(new Date().getUTCFullYear()+1).optional().nullable());
export const grapeBlendEntrySchema = z.object({
  grape: z.string().trim().min(1).max(100),
  percentage: z.number().min(0).max(100).optional().nullable()
});
export const deepSearchSchema = z.object({
  summary: z.string().trim().max(6000).default(''),
  vintageQuality: z.string().trim().max(4000).default(''),
  producerDetails: z.string().trim().max(5000).default(''),
  winemakingTechniques: z.string().trim().max(5000).default(''),
  terroir: z.string().trim().max(4000).default(''),
  drinkingWindow: z.string().trim().max(2000).default(''),
  sources: z.array(z.object({ title: z.string().trim().max(300), url: z.string().url() })).max(20).default([]),
  model: z.string().trim().max(100),
  researchedAt: z.string().datetime()
});
export const wineRecordSchema = z.object({
  id: z.string().uuid(), ownerId: z.string().min(1).max(128), producer: z.string().trim().min(1).max(200),
  wineName: z.string().trim().min(1).max(200), vintage: vintageSchema,
  country: optionalText, region: optionalText, appellation: optionalText, grapes: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  grapeBlend: z.array(grapeBlendEntrySchema).max(30).default([]),
  wineStyle: z.enum(wineStyles).optional().nullable(), alcoholPercentage: z.number().min(0).max(100).optional().nullable(),
  tastingNotes: z.string().trim().max(10000).default(''), rating: z.number().min(0).max(100).optional().nullable(),
  tastingDate: z.string().date().optional().nullable(), event: optionalText, venue: optionalText, price: z.number().nonnegative().optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional().nullable(), tags: z.array(z.string().trim().min(1).max(50)).max(50).default([]),
  tastingName: optionalText, locationName: optionalText,
  latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(),
  deepSearch: deepSearchSchema.optional().nullable(),
  imageObjectKeys: z.array(z.string().min(1)).max(30).default([]), recognitionStatus: z.enum(['pending','processing','review','complete','failed']).default('pending'),
  recognitionConfidence: z.number().min(0).max(1).optional().nullable(), createdAt: z.string().datetime(), updatedAt: z.string().datetime()
});
export type GrapeBlendEntry = z.infer<typeof grapeBlendEntrySchema>;
export type DeepSearchResult = z.infer<typeof deepSearchSchema>;
export type WineRecord = z.infer<typeof wineRecordSchema>;
const wineInputBaseSchema = wineRecordSchema.omit({ id:true, ownerId:true, createdAt:true, updatedAt:true, deepSearch:true });
export const wineInputSchema = wineInputBaseSchema.transform(value=>canonicalizeWineFields(value));
export type WineInput = z.infer<typeof wineInputSchema>;
