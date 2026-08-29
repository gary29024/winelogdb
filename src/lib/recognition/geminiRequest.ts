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

/**
 * Three place fields with no stated meaning left the model to guess which two
 * levels of a nested hierarchy to emit. Old World labels carry a convention
 * strong enough to be stable; AVAs nest three or four deep, so the same wine
 * came back as Napa Valley/Oakville one day and California/Napa Valley the next.
 *
 * The server re-derives the levels from a place tree either way, but saying it
 * here means the tree is usually confirming the answer rather than repairing it.
 */
export const PLACE_LEVEL_RULE='For place fields, region is the principal growing region a wine person would name in conversation (Napa Valley, Sonoma County, Burgundy, Barossa Valley, Mosel, Rioja, Mendoza), and appellation is the narrowest legally defined origin that applies (Oakville, Russian River Valley, Gevrey-Chambertin, Barolo, Rioja Alta, Gualtallary). Broad multi-region designations such as California, South Australia, South Eastern Australia, Vin de France or Columbia Valley are not principal regions: put one in region only when nothing narrower is known, and never in appellation. When only one place is known, put it at the level it actually belongs to and leave the other null rather than repeating it in both. Examples: an Oakville Cabernet is region Napa Valley, appellation Oakville; a wine labelled only Napa Valley is region Napa Valley, appellation null; a Gevrey-Chambertin is region Burgundy, appellation Gevrey-Chambertin.';

const nullableString={anyOf:[{type:'string'},{type:'null'}]} as const;
const regionField={anyOf:[{type:'string'},{type:'null'}],description:'Principal growing region, e.g. Napa Valley, Burgundy, Barossa Valley. Not a broad multi-region designation such as California unless nothing narrower is known.'} as const;
const appellationField={anyOf:[{type:'string'},{type:'null'}],description:'Narrowest legally defined origin, e.g. Oakville, Gevrey-Chambertin, Barolo. Null when only the region is known.'} as const;
const recognitionVintageJsonSchema={anyOf:[{type:'integer',minimum:1000,maximum:2200},{type:'null'}]} as const;

export const recognitionResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    producer:nullableString,
    wineName:nullableString,
    vintage:recognitionVintageJsonSchema,
    country:nullableString,
    region:regionField,
    appellation:appellationField,
    grapes:{type:'array',maxItems:20,items:{type:'string'}},
    grapeBlend:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{grape:{type:'string'},percentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]}},required:['grape']}},
    style:{anyOf:[{type:'string',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},{type:'null'}]},
    alcoholPercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},
    locationName:nullableString,
    confidence:{type:'number',minimum:0,maximum:1}
  },
  required:['grapes','grapeBlend','confidence']
} as const;

export const groupRecognitionResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    wines:{
      type:'array',
      maxItems:12,
      items:{
        type:'object',
        additionalProperties:false,
        properties:{
          producer:{type:'string'},
          wineName:{type:'string'},
          vintage:recognitionVintageJsonSchema,
          country:nullableString,
          region:regionField,
          appellation:appellationField,
          grapes:{type:'array',maxItems:20,items:{type:'string'}},
          grapeBlend:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{grape:{type:'string'},percentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]}},required:['grape']}},
          style:{anyOf:[{type:'string',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},{type:'null'}]},
          alcoholPercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},
          locationName:nullableString,
          confidence:{type:'number',minimum:0,maximum:1},
          boundingBox:{
            type:'object',
            additionalProperties:false,
            properties:{xMin:{type:'number',minimum:0,maximum:1000},yMin:{type:'number',minimum:0,maximum:1000},xMax:{type:'number',minimum:0,maximum:1000},yMax:{type:'number',minimum:0,maximum:1000}},
            required:['xMin','yMin','xMax','yMax']
          }
        },
        required:['producer','wineName','vintage','country','region','appellation','grapes','grapeBlend','style','alcoholPercentage','locationName','confidence','boundingBox']
      }
    },
    unresolvedCount:{type:'integer',minimum:0,maximum:30}
  },
  required:['wines','unresolvedCount']
} as const;

/**
 * One page of a printed wine list. No bounding box - there is no bottle to crop
 * - and a priceOptions array rather than a price, because a list line often
 * carries more than one number and picking between them is the reader's job.
 */
export const sheetRecognitionResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    wines:{
      type:'array',
      maxItems:80,
      items:{
        type:'object',
        additionalProperties:false,
        properties:{
          producer:{type:'string'},
          wineName:{type:'string'},
          vintage:recognitionVintageJsonSchema,
          country:nullableString,
          region:regionField,
          appellation:appellationField,
          grapes:{type:'array',maxItems:20,items:{type:'string'}},
          grapeBlend:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{grape:{type:'string'},percentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]}},required:['grape']}},
          style:{anyOf:[{type:'string',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},{type:'null'}]},
          alcoholPercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},
          priceOptions:{
            type:'array',maxItems:4,
            description:'Every price printed against this wine. Empty when the list shows no price for it.',
            items:{type:'object',additionalProperties:false,properties:{
              amount:{type:'number',minimum:0},
              label:{anyOf:[{type:'string'},{type:'null'}],description:'What the sheet calls this price, e.g. bottle, glass, member. Null when only one is printed.'}
            },required:['amount','label']}
          },
          section:{anyOf:[{type:'string'},{type:'null'}],description:'The flight or heading this wine is printed under.'},
          lineNumber:{anyOf:[{type:'integer',minimum:0,maximum:2000},{type:'null'}],description:'1-based position of this wine down the page.'},
          confidence:{type:'number',minimum:0,maximum:1}
        },
        required:['producer','wineName','vintage','country','region','appellation','grapes','grapeBlend','style','alcoholPercentage','priceOptions','section','lineNumber','confidence']
      }
    },
    currency:{anyOf:[{type:'string'},{type:'null'}],description:'One ISO 4217 code for the whole sheet, e.g. HKD, EUR, USD.'},
    unresolvedCount:{type:'integer',minimum:0,maximum:200},
    truncated:{type:'boolean',description:'True when wines remain on this page that did not fit in the response.'},
    lastLineNumber:{anyOf:[{type:'integer',minimum:0,maximum:2000},{type:'null'}]}
  },
  required:['wines','currency','unresolvedCount','truncated','lastLineNumber']
} as const;

export function buildRecognitionPrompt(metadata:RecognitionPhotoMetadata[]){
  const selected=selectRecognitionMetadata(metadata);
  const context=[
    selected.capturedAt?`The strongest photo timestamp is ${selected.capturedAt}.`:'No reliable photo timestamp.',
    selected.latitude!=null&&selected.longitude!=null?`The exact EXIF GPS is ${selected.latitude}, ${selected.longitude}. Infer only an approximate concise human-readable place name when reasonably confident; never alter the coordinates.`:'No reliable GPS metadata.'
  ].join(' ');
  const prompt=`All supplied images are labels or views of the SAME wine bottle. Analyze them jointly in one identification. Reconcile front, back, neck and supplementary labels rather than treating them as separate wines. Producer, wineName and vintage are identity-critical: return them only when supported by visible label or bottle evidence in the supplied images. Do not invent, complete, or substitute producer, cuvee/wine name, or vintage from general wine knowledge; use null when the identity text or vintage is not reasonably readable, including non-vintage wines. After the visible identity is established, you may fill high-confidence canonical facts from general wine knowledge even when not printed verbatim only for country, region, appellation, grape varieties, and broad wine style. Use null or an empty array when not reasonably confident. ${PLACE_LEVEL_RULE} For style, return only one of: red, white, rose, sparkling, dessert, fortified, orange, other. Capture grape blend percentages only when explicitly visible in the supplied images; never invent vintage-specific percentages. Keep plain grape names in grapes and percentages in grapeBlend. Do not add producer history, vintage quality, terroir commentary, winemaking techniques, drinking windows, tasting notes, scores, or detailed research here; those belong to Deep Search. Confidence is 0 to 1 and should reflect confidence in the specific bottle identity, especially the visible producer and wineName rather than confidence in broad regional knowledge. ${context} Do not invent a tasting date; the application derives it from photo metadata.`;
  return {prompt,selected};
}
