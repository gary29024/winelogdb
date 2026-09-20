import { z } from 'zod';
import { canonicalizeWineFields } from '../../lib/wine/canonicalize';
import { normalizedVintageKind,type VintageKind } from '../../lib/wine/referenceIdentity';
import { normalizeRecognitionVintage } from './vintage';

export const nullableRecognitionText=z.string().trim().max(300).nullable().optional();
export const recognitionWineStyles=['red','white','rose','sparkling','dessert','fortified','orange','other'] as const;
export const recognitionVintageSchema=z.preprocess(normalizeRecognitionVintage,z.number().int().min(1000).max(2200).nullable().optional());
export const grapeBlendRecognitionEntry=z.object({grape:z.string().trim().min(1).max(100),percentage:z.number().min(0).max(100).nullable().optional()});

function normalizeStyle(value:unknown){
 if(value==null||value==='')return value;
 const s=String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if((recognitionWineStyles as readonly string[]).includes(s))return s;
 if(s.includes('sparkling')||s.includes('champagne')||s.includes('cremant')||s.includes('cava')||s.includes('prosecco'))return 'sparkling';
 if(s.includes('rose')||s.includes('rosado')||s.includes('rosato'))return 'rose';
 if(s.includes('orange')||s.includes('skin-contact')||s.includes('skin contact'))return 'orange';
 if(s.includes('fortified')||s.includes('port')||s.includes('sherry')||s.includes('madeira'))return 'fortified';
 if(s.includes('dessert')||s.includes('sweet')||s.includes('sauternes')||s.includes('tokaji'))return 'dessert';
 if(s.includes('white')||s.includes('blanc')||s.includes('bianco'))return 'white';
 if(s.includes('red')||s.includes('rouge')||s.includes('rosso')||s.includes('tinto'))return 'red';
 return 'other';
}
export const recognitionStyleSchema=z.preprocess(normalizeStyle,z.enum(recognitionWineStyles).nullable().optional());

export const recognitionCommonFields={
 vintage:recognitionVintageSchema,
 recognizedVintageText:nullableRecognitionText,
 vintageKind:z.enum(['vintage','non_vintage','multi_vintage','unknown']).nullable().optional(),
 releaseDesignation:nullableRecognitionText,
 country:nullableRecognitionText,region:nullableRecognitionText,appellation:nullableRecognitionText,
 recognizedProducer:nullableRecognitionText,recognizedWineName:nullableRecognitionText,
 recognizedRegion:nullableRecognitionText,recognizedAppellation:nullableRecognitionText,
 classification:z.enum(['grand_cru','premier_cru','village']).nullable().optional(),
 grapes:z.array(z.string().trim().max(100)).max(20).default([]),
 grapeBlend:z.array(grapeBlendRecognitionEntry).max(20).default([]),
 style:recognitionStyleSchema,
 alcoholPercentage:z.number().min(0).max(100).nullable().optional()
} as const;

export const referenceRecognitionFields={
 referenceProductKey:nullableRecognitionText,lwin7:nullableRecognitionText,lwin11:nullableRecognitionText,elid:nullableRecognitionText,
 identityMatchStatus:z.enum(['matched','suggested','ambiguous','unmatched','manual','conflict']).nullable().optional(),
 identityMatchConfidence:z.number().min(0).max(1).nullable().optional(),identityMatchCandidates:z.array(z.string().max(32)).nullable().optional(),
 colour:nullableRecognitionText,productType:nullableRecognitionText,productSubtype:nullableRecognitionText,
 referenceProducer:nullableRecognitionText,referenceWineName:nullableRecognitionText,referenceCountry:nullableRecognitionText,referenceRegion:nullableRecognitionText,
 referenceSubRegion:nullableRecognitionText,referenceSite:nullableRecognitionText,referenceParcel:nullableRecognitionText,
 referenceDesignation:nullableRecognitionText,referenceClassification:nullableRecognitionText
} as const;

/** Raw model JSON has no authority to supply catalogue identity. Keep this list
 * tied to the response schema so newly added reference fields are stripped too.
 * Apply before validation: even malformed invented IDs must not discard a read.
 * Browser/session response schemas still accept verified server enrichment. */
export function stripModelReferenceFields(value:unknown):unknown{
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!Object.hasOwn(referenceRecognitionFields,key)));
}

type Evidence={
 producer?:string|null;wineName?:string|null;vintage?:number|null;vintageKind?:VintageKind|null;
 recognizedProducer?:string|null;recognizedWineName?:string|null;recognizedVintageText?:string|null;
};
export function canonicalizeRecognitionEvidence<T extends Evidence>(wine:T):T{
 const enriched={...wine,
  recognizedProducer:wine.recognizedProducer??wine.producer??null,
  recognizedWineName:wine.recognizedWineName??wine.wineName??null,
  recognizedVintageText:wine.recognizedVintageText??(wine.vintage!=null?String(wine.vintage):null),
  vintageKind:normalizedVintageKind(wine.vintage,wine.vintageKind)
 };
 return canonicalizeWineFields(enriched) as T;
}
