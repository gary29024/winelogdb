import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../uploads/metadataSelection';

export const RECOGNITION_MODEL='gemini-3.1-flash-lite';

// Legacy OpenAPI-style schema retained for Gemini Batch compatibility. New synchronous
// recognition calls use recognitionResponseJsonSchema below because Google's current
// generateContent API marks responseSchema as deprecated in favor of JSON Schema.
export const recognitionResponseSchema={
  type:'OBJECT',
  properties:{
    producer:{type:'STRING',nullable:true},wineName:{type:'STRING',nullable:true},vintage:{type:'NUMBER',nullable:true},country:{type:'STRING',nullable:true},region:{type:'STRING',nullable:true},appellation:{type:'STRING',nullable:true},
    grapes:{type:'ARRAY',items:{type:'STRING'}},
    grapeBlend:{type:'ARRAY',items:{type:'OBJECT',properties:{grape:{type:'STRING'},percentage:{type:'NUMBER',nullable:true}},required:['grape']}},
    style:{type:'STRING',nullable:true},alcoholPercentage:{type:'NUMBER',nullable:true},locationName:{type:'STRING',nullable:true},confidence:{type:'NUMBER'}
  },
  required:['grapes','grapeBlend','confidence']
} as const;

const nullableString={anyOf:[{type:'string'},{type:'null'}]} as const;

export const recognitionResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    producer:nullableString,
    wineName:nullableString,
    vintage:{anyOf:[{type:'integer',minimum:1000,maximum:2200},{type:'null'}]},
    country:nullableString,
    region:nullableString,
    appellation:nullableString,
    grapes:{type:'array',maxItems:20,items:{type:'string'}},
    grapeBlend:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{grape:{type:'string'},percentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]}},required:['grape']}},
    style:{anyOf:[{type:'string',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},{type:'null'}]},
    alcoholPercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},
    locationName:nullableString,
    confidence:{type:'number',minimum:0,maximum:1}
  },
  required:['grapes','grapeBlend','confidence']
} as const;

export function buildRecognitionPrompt(metadata:RecognitionPhotoMetadata[]){
  const selected=selectRecognitionMetadata(metadata);
  const context=[
    selected.capturedAt?`The strongest photo timestamp is ${selected.capturedAt}.`:'No reliable photo timestamp.',
    selected.latitude!=null&&selected.longitude!=null?`The exact EXIF GPS is ${selected.latitude}, ${selected.longitude}. Infer only an approximate concise human-readable place name when reasonably confident; never alter the coordinates.`:'No reliable GPS metadata.'
  ].join(' ');
  const prompt=`All supplied images are labels or views of the SAME wine bottle. Analyze them jointly in one identification. Reconcile front, back, neck and supplementary labels rather than treating them as separate wines. First prioritize facts visible anywhere in the supplied images. After identifying the bottle, you may fill high-confidence canonical facts from general wine knowledge even when not printed verbatim: country, region, appellation, grape varieties, and broad wine style. Use null or an empty array when not reasonably confident. For style, return only one of: red, white, rose, sparkling, dessert, fortified, orange, other. Capture grape blend percentages only when explicitly visible in the supplied images; never invent vintage-specific percentages. Keep plain grape names in grapes and percentages in grapeBlend. Do not add producer history, vintage quality, terroir commentary, winemaking techniques, drinking windows, tasting notes, scores, or detailed research here; those belong to Deep Search. Confidence is 0 to 1 and should reflect confidence in the bottle identification. ${context} Do not invent a tasting date; the application derives it from photo metadata.`;
  return {prompt,selected};
}
