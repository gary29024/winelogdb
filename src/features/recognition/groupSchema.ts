import { z } from 'zod';
import { canonicalizeWineFields } from '../../lib/wine/canonicalize';
import { normalizeRecognitionVintage } from './vintage';

const nullableText=z.string().trim().max(300).nullable().optional();
const wineStyles=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
const grapeBlendEntry=z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});
const recognitionVintageSchema=z.preprocess(normalizeRecognitionVintage,z.number().int().min(1000).max(2200).nullable().optional());

/**
 * The frame itself, which is what a coordinate the model did not give falls back
 * to: the crop is then wider than it needed to be, never wrong.
 */
const FULL_FRAME={xMin:0,yMin:0,xMax:1000,yMax:1000} as const;
const EDGE_NAMES={
  xMin:['xmin','left','x1','x0'],
  yMin:['ymin','top','y1','y0'],
  xMax:['xmax','right','x2'],
  yMax:['ymax','bottom','y2']
} as const;

/**
 * Six bottles in a row came back with every yMax missing, and the whole scan was
 * refused over it - six wines read correctly, thrown away because one number
 * out of twenty-four was not there.
 *
 * The box is not identity. It crops a thumbnail and orders the results
 * left-to-right; the producer, the cuvee and the vintage are what the scan is
 * for, and none of them live here. So a coordinate is read wherever the model
 * put it - ymax, y_max, bottom, or Gemini's own box_2d array - and where it
 * genuinely is not there, it comes from the edge of the frame. A row of bottles
 * missing its heights then crops as full-height slices, which is very nearly
 * what was wanted anyway.
 *
 * A box that is present but inverted or empty is still refused: that is a model
 * that has lost track of the photograph, not one that spelled a key its own way.
 */
const edge=(box:Record<string,number>,names:readonly string[])=>{
  for(const name of names)if(name in box)return box[name];
  return undefined;
};

function normalizeBoundingBox(value:unknown):unknown{
  // Gemini's native shape, and its own order: ymin, xmin, ymax, xmax.
  if(Array.isArray(value)&&value.length===4&&value.every(entry=>typeof entry==='number'))
    return {xMin:value[1],yMin:value[0],xMax:value[3],yMax:value[2]};
  if(!value||typeof value!=='object')return {...FULL_FRAME};
  const raw=value as Record<string,unknown>;
  if(Array.isArray(raw.box_2d))return normalizeBoundingBox(raw.box_2d);
  const numbers:Record<string,number>={};
  for(const [key,entry] of Object.entries(raw))
    if(typeof entry==='number'&&Number.isFinite(entry))numbers[key.toLowerCase().replace(/[^a-z0-9]/g,'')]=entry;
  return {
    xMin:edge(numbers,EDGE_NAMES.xMin)??FULL_FRAME.xMin,
    yMin:edge(numbers,EDGE_NAMES.yMin)??FULL_FRAME.yMin,
    xMax:edge(numbers,EDGE_NAMES.xMax)??FULL_FRAME.xMax,
    yMax:edge(numbers,EDGE_NAMES.yMax)??FULL_FRAME.yMax
  };
}

export const groupBoundingBoxSchema=z.preprocess(normalizeBoundingBox,z.object({
  xMin:z.number().min(0).max(1000),
  yMin:z.number().min(0).max(1000),
  xMax:z.number().min(0).max(1000),
  yMax:z.number().min(0).max(1000)
}).superRefine((box,ctx)=>{
  if(box.xMax<=box.xMin)ctx.addIssue({code:'custom',path:['xMax'],message:'xMax must be greater than xMin'});
  if(box.yMax<=box.yMin)ctx.addIssue({code:'custom',path:['yMax'],message:'yMax must be greater than yMin'});
}));

export const groupRecognitionWineSchema=z.object({
  producer:z.string().trim().min(1).max(300),
  wineName:z.string().trim().min(1).max(300),
  vintage:recognitionVintageSchema,
  country:nullableText,
  region:nullableText,
  appellation:nullableText,
  // Filled by canonicalizeWineFields during dedupe, not by the model: the
  // region and appellation as the label was read, before re-slotting, and the
  // cru tier read off the appellation and wine name. The object is strict and
  // is parsed again by the browser and by the session store, so every field
  // canonicalisation adds has to have a home here or the whole scan is
  // rejected. groupSchemaAcceptsCanonicalFields pins that.
  recognizedRegion:nullableText,
  recognizedAppellation:nullableText,
  classification:z.enum(['grand_cru','premier_cru','village']).nullable().optional(),
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
