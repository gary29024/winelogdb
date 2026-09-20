import { AI_MODELS } from '../ai/policy';
import { selectRecognitionMetadata,type RecognitionPhotoMetadata } from '../uploads/metadataSelection';

export const RECOGNITION_MODEL=AI_MODELS.recognitionPrimary;

const legacySparklingDetailsSchema={
  type:'OBJECT',nullable:true,
  properties:{
    dosageGPerL:{type:'NUMBER',nullable:true},dosageCategory:{type:'STRING',nullable:true},disgorgement:{type:'STRING',nullable:true},tirage:{type:'STRING',nullable:true},
    baseVintage:{type:'NUMBER',nullable:true},reserveWinePercentage:{type:'NUMBER',nullable:true},leesAgeingMonths:{type:'NUMBER',nullable:true},lotCode:{type:'STRING',nullable:true},
    assemblage:{type:'STRING',nullable:true},reserveWineDetail:{type:'STRING',nullable:true},malolactic:{type:'STRING',nullable:true},fermentationElevage:{type:'STRING',nullable:true},otherTechnicalDetails:{type:'STRING',nullable:true}
  }
} as const;

// Legacy OpenAPI-style schema retained for Gemini Batch compatibility. New synchronous
// recognition calls use recognitionResponseJsonSchema below because Google's current
// generateContent API marks responseSchema as deprecated in favor of JSON Schema.
export const recognitionResponseSchema={
  type:'OBJECT',
  properties:{
    producer:{type:'STRING',nullable:true},wineName:{type:'STRING',nullable:true},vintage:{type:'NUMBER',nullable:true},recognizedVintageText:{type:'STRING',nullable:true},vintageKind:{type:'STRING',nullable:true},releaseDesignation:{type:'STRING',nullable:true},country:{type:'STRING',nullable:true},region:{type:'STRING',nullable:true},appellation:{type:'STRING',nullable:true},
    grapes:{type:'ARRAY',items:{type:'STRING'}},
    grapeBlend:{type:'ARRAY',items:{type:'OBJECT',properties:{grape:{type:'STRING'},percentage:{type:'NUMBER',nullable:true}},required:['grape']}},
    style:{type:'STRING',nullable:true},alcoholPercentage:{type:'NUMBER',nullable:true},sparklingDetails:legacySparklingDetailsSchema,locationName:{type:'STRING',nullable:true},confidence:{type:'NUMBER'}
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
export const PRODUCER_NAME_RULE='Preserve the complete printed producer name, including prefixes such as Domaine, Maison, Chateau, and Champagne. Domaine and Maison can identify different producers; never remove, swap, or invent these words.';

export const PLACE_LEVEL_RULE='For place fields, region is the principal growing region a wine person would name in conversation (Napa Valley, Sonoma County, Burgundy, Barossa Valley, Mosel, Rioja, Mendoza), and appellation is the narrowest legally defined origin that applies (Oakville, Russian River Valley, Gevrey-Chambertin, Barolo, Rioja Alta, Gualtallary). Broad multi-region designations such as California, South Australia, South Eastern Australia, Vin de France or Columbia Valley are not principal regions: put one in region only when nothing narrower is known, and never in appellation. When only one place is known, put it at the level it actually belongs to and leave the other null rather than repeating it in both. Examples: an Oakville Cabernet is region Napa Valley, appellation Oakville; a wine labelled only Napa Valley is region Napa Valley, appellation null; a Gevrey-Chambertin is region Burgundy, appellation Gevrey-Chambertin.';

const nullableString={anyOf:[{type:'string'},{type:'null'}]} as const;
const regionField={anyOf:[{type:'string'},{type:'null'}],description:'Principal growing region, e.g. Napa Valley, Burgundy, Barossa Valley. Not a broad multi-region designation such as California unless nothing narrower is known.'} as const;
const appellationField={anyOf:[{type:'string'},{type:'null'}],description:'Narrowest legally defined origin, e.g. Oakville, Gevrey-Chambertin, Barolo. Null when only the region is known.'} as const;
const recognitionVintageJsonSchema={anyOf:[{type:'integer',minimum:1000,maximum:2200},{type:'null'}]} as const;
const recognitionVintageKindJsonSchema={anyOf:[{type:'string',enum:['vintage','non_vintage','multi_vintage','unknown']},{type:'null'}]} as const;
export const sparklingDetailsJsonSchema={
  anyOf:[
    {type:'object',additionalProperties:false,properties:{
      dosageGPerL:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},dosageCategory:nullableString,disgorgement:nullableString,tirage:nullableString,
      baseVintage:recognitionVintageJsonSchema,reserveWinePercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},leesAgeingMonths:{anyOf:[{type:'number',minimum:0,maximum:600},{type:'null'}]},lotCode:nullableString,
      assemblage:nullableString,reserveWineDetail:nullableString,malolactic:nullableString,fermentationElevage:nullableString,otherTechnicalDetails:nullableString
    },required:['dosageGPerL','dosageCategory','disgorgement','tirage','baseVintage','reserveWinePercentage','leesAgeingMonths','lotCode','assemblage','reserveWineDetail','malolactic','fermentationElevage','otherTechnicalDetails']},
    {type:'null'}
  ],
  description:'Release-specific Champagne/sparkling technical facts only when explicitly readable on the supplied bottle/label images. Null when none are visible.'
} as const;

export const recognitionResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{
    producer:nullableString,
    wineName:nullableString,
    vintage:recognitionVintageJsonSchema,
    recognizedVintageText:nullableString,
    vintageKind:recognitionVintageKindJsonSchema,
    releaseDesignation:nullableString,
    country:nullableString,
    region:regionField,
    appellation:appellationField,
    grapes:{type:'array',maxItems:20,items:{type:'string'}},
    grapeBlend:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,properties:{grape:{type:'string'},percentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]}},required:['grape']}},
    style:{anyOf:[{type:'string',enum:['red','white','rose','sparkling','dessert','fortified','orange','other']},{type:'null'}]},
    alcoholPercentage:{anyOf:[{type:'number',minimum:0,maximum:100},{type:'null'}]},
    sparklingDetails:sparklingDetailsJsonSchema,
    locationName:nullableString,
    confidence:{type:'number',minimum:0,maximum:1}
  },
  required:['grapes','grapeBlend','sparklingDetails','confidence']
} as const;

/**
 * Two boxes and nothing else, which is why this call is cheap: one small
 * photograph in, forty tokens out. Both are nullable so the model can say a
 * photograph has no bottle in it rather than inventing one.
 */
const nullableBoundingBox={
  anyOf:[
    {type:'object',additionalProperties:false,
      properties:{xMin:{type:'number',minimum:0,maximum:1000},yMin:{type:'number',minimum:0,maximum:1000},xMax:{type:'number',minimum:0,maximum:1000},yMax:{type:'number',minimum:0,maximum:1000}},
      required:['xMin','yMin','xMax','yMax']},
    {type:'null'}
  ]
} as const;

const nullableAxis={
  anyOf:[
    {type:'object',additionalProperties:false,
      properties:{topX:{type:'number',minimum:0,maximum:1000},topY:{type:'number',minimum:0,maximum:1000},bottomX:{type:'number',minimum:0,maximum:1000},bottomY:{type:'number',minimum:0,maximum:1000}},
      required:['topX','topY','bottomX','bottomY']},
    {type:'null'}
  ]
} as const;

export const bottleFrameResponseJsonSchema={
  type:'object',
  additionalProperties:false,
  properties:{bottle:nullableBoundingBox,label:nullableBoundingBox,axis:nullableAxis,confidence:{type:'number',minimum:0,maximum:1}},
  required:['bottle','label','axis','confidence']
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
          recognizedVintageText:nullableString,
          vintageKind:recognitionVintageKindJsonSchema,
          releaseDesignation:nullableString,
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
          recognizedVintageText:nullableString,
          vintageKind:recognitionVintageKindJsonSchema,
          releaseDesignation:nullableString,
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
  const prompt=`All supplied images are labels or views of the SAME wine bottle. Analyze them jointly in one identification. Reconcile front, back, neck and supplementary labels rather than treating them as separate wines. Producer, wineName and vintage are identity-critical: return them only when supported by visible label or bottle evidence in the supplied images. Release identity is equally evidence-critical. vintage is ONLY an actual four-digit vintage year as a JSON integer; otherwise it is null. recognizedVintageText is the exact visible vintage/NV/MV/edition text when present. vintageKind must be vintage, non_vintage, multi_vintage or unknown: unreadable/missing is unknown, not non_vintage. releaseDesignation carries an edition or release marker such as 171ème Édition, MV20 or 90-21 and is null when none is visible. Do not invent, complete, or substitute producer, cuvee/wine name, or vintage from general wine knowledge. Do not invent or substitute a release designation either. After the visible identity is established, you may fill high-confidence canonical facts from general wine knowledge even when not printed verbatim only for country, region, appellation, grape varieties, and broad wine style. Use null or an empty array when not reasonably confident. ${PRODUCER_NAME_RULE} ${PLACE_LEVEL_RULE} For style, return only one of: red, white, rose, sparkling, dessert, fortified, orange, other. Capture grape blend percentages only when explicitly visible in the supplied images; never invent vintage-specific percentages. Keep plain grape names in grapes and percentages in grapeBlend. For Champagne or another sparkling wine, sparklingDetails may capture dosage g/L, the printed dosage category, disgorgement, tirage/mise en bouteille, base vintage, reserve-wine percentage, lees-ageing months, lot/release code, assemblage, reserve-wine detail, malolactic information, fermentation/elevage and other concise technical details — but ONLY when that fact is explicitly readable somewhere in the supplied bottle images. Do not infer any sparklingDetails value from producer reputation, cuvee style, appellation conventions or general knowledge; return sparklingDetails null when none of these facts are visibly stated. Do not add producer history, vintage quality, terroir commentary, unprinted winemaking techniques, drinking windows, tasting notes, scores, or detailed research here; those belong to Deep Search. Confidence is 0 to 1 and should reflect confidence in the specific bottle identity, especially the visible producer and wineName rather than confidence in broad regional knowledge. ${context} Do not invent a tasting date; the application derives it from photo metadata.`;
  return {prompt,selected};
}
