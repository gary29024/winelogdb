import { z } from 'zod';
import { sparklingDetailsSchema } from '../../lib/wine/sparklingDetails';
import { canonicalizeRecognitionEvidence,nullableRecognitionText,recognitionCommonFields,referenceRecognitionFields } from './identityFields';

export const recognitionSchema = z.object({
  producer: nullableRecognitionText,
  wineName: nullableRecognitionText,
  ...recognitionCommonFields,
  ...referenceRecognitionFields,
  sparklingDetails: sparklingDetailsSchema.nullable().optional(),
  confidence: z.number().min(0).max(1),
  tastingDate: z.string().date().nullable().optional(),
  locationName: nullableRecognitionText,
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
  return recognitionSchema.parse(canonicalizeRecognitionEvidence(parsed));
}
