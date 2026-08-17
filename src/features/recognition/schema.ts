import { z } from 'zod';
const nullableText = z.string().trim().max(300).nullable().optional();
const grapeBlendEntry = z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});
export const recognitionSchema = z.object({
  producer: nullableText,
  wineName: nullableText,
  vintage: z.number().int().min(1000).max(2200).nullable().optional(),
  country: nullableText,
  region: nullableText,
  appellation: nullableText,
  grapes: z.array(z.string().trim().max(100)).max(20).default([]),
  grapeBlend: z.array(grapeBlendEntry).max(20).default([]),
  style: z.enum(['red','white','rose','sparkling','dessert','fortified','orange','other']).nullable().optional(),
  alcoholPercentage: z.number().min(0).max(100).nullable().optional(),
  confidence: z.number().min(0).max(1),
  tastingDate: z.string().date().nullable().optional(),
  locationName: nullableText,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  metadataSource: z.enum(['exif','file_fallback','none']).default('none')
}).strict();
export type RecognitionResult = z.infer<typeof recognitionSchema>;
export function parseRecognition(raw: string): RecognitionResult { const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,''); return recognitionSchema.parse(JSON.parse(cleaned)); }
