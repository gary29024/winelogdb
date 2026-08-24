import { z } from 'zod';
import { canonicalizeWineFields } from '../../lib/wine/canonicalize';
import { normalizeRecognitionVintage } from './vintage';
const nullableText = z.string().trim().max(300).nullable().optional();
const grapeBlendEntry = z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});
const wineStyles=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
const recognitionVintageSchema=z.preprocess(normalizeRecognitionVintage,z.number().int().min(1000).max(2200).nullable().optional());
function normalizeStyle(value:unknown){
  if(value==null||value==='')return value;
  const s=String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if((wineStyles as readonly string[]).includes(s))return s;
  if(s.includes('sparkling')||s.includes('champagne')||s.includes('cremant')||s.includes('cava')||s.includes('prosecco'))return 'sparkling';
  if(s.includes('rose')||s.includes('rosado')||s.includes('rosato'))return 'rose';
  if(s.includes('orange')||s.includes('skin-contact')||s.includes('skin contact'))return 'orange';
  if(s.includes('fortified')||s.includes('port')||s.includes('sherry')||s.includes('madeira'))return 'fortified';
  if(s.includes('dessert')||s.includes('sweet')||s.includes('sauternes')||s.includes('tokaji'))return 'dessert';
  if(s.includes('white')||s.includes('blanc')||s.includes('bianco'))return 'white';
  if(s.includes('red')||s.includes('rouge')||s.includes('rosso')||s.includes('tinto'))return 'red';
  return 'other';
}
export const recognitionSchema = z.object({
  producer: nullableText,
  wineName: nullableText,
  vintage: recognitionVintageSchema,
  country: nullableText,
  region: nullableText,
  appellation: nullableText,
  classification: z.enum(['grand_cru','premier_cru','village']).nullable().optional().default(null),
  grapes: z.array(z.string().trim().max(100)).max(20).default([]),
  grapeBlend: z.array(grapeBlendEntry).max(20).default([]),
  style: z.preprocess(normalizeStyle,z.enum(wineStyles).nullable().optional()),
  alcoholPercentage: z.number().min(0).max(100).nullable().optional(),
  confidence: z.number().min(0).max(1),
  tastingDate: z.string().date().nullable().optional(),
  locationName: nullableText,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  metadataSource: z.enum(['exif','file_fallback','none']).default('none'),
  requestId: z.string().uuid().optional(),
  recognitionDurationMs: z.number().int().nonnegative().optional()
}).strict();
export type RecognitionResult = z.infer<typeof recognitionSchema>;
export function parseRecognition(raw: string): RecognitionResult {
  const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,'');
  const parsed=recognitionSchema.parse(JSON.parse(cleaned));
  return recognitionSchema.parse(canonicalizeWineFields(parsed));
}
