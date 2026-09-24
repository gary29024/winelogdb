import { z } from 'zod';

const fivePoint=z.enum(['low','medium_minus','medium','medium_plus','high']);
const flavourIntensity=z.enum(['light','medium_minus','medium','medium_plus','pronounced']);
const body=z.enum(['light','medium_minus','medium','medium_plus','full']);
const finish=z.enum(['short','medium_minus','medium','medium_plus','long']);
const perceivedAlcohol=z.enum(['low','medium','high']);

export const tastingStructureSchema=z.object({
  flavourIntensity:flavourIntensity.nullable().optional(),
  acidity:fivePoint.nullable().optional(),
  tannin:fivePoint.nullable().optional(),
  body:body.nullable().optional(),
  finish:finish.nullable().optional(),
  alcohol:perceivedAlcohol.nullable().optional()
}).strict();

export type TastingStructure=z.infer<typeof tastingStructureSchema>;
export type TastingStructureKey=keyof TastingStructure;

export function hasTastingStructure(value:TastingStructure|null|undefined){
  return Boolean(value&&Object.values(value).some(item=>item!=null));
}

export const structureValueLabel:Record<string,string>={
  low:'Low',light:'Light',medium_minus:'M−',medium:'M',medium_plus:'M+',high:'High',pronounced:'Pronounced',full:'Full',short:'Short',long:'Long'
};

// The six axes in form order, with each scale's labels.
export const structureFields=[
  {key:'flavourIntensity',label:'Flavour intensity',options:[['light','Light'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['pronounced','Pronounced']]},
  {key:'acidity',label:'Acidity',options:[['low','Low'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['high','High']]},
  {key:'tannin',label:'Tannin',options:[['low','Low'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['high','High']]},
  {key:'body',label:'Body',options:[['light','Light'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['full','Full']]},
  {key:'finish',label:'Finish',options:[['short','Short'],['medium_minus','M−'],['medium','M'],['medium_plus','M+'],['long','Long']]},
  {key:'alcohol',label:'Perceived alcohol',options:[['low','Low'],['medium','Medium'],['high','High']]}
] as const satisfies ReadonlyArray<{key:TastingStructureKey;label:string;options:ReadonlyArray<readonly [string,string]>}>;

/** Toggle one axis: tapping the selected value again clears it. */
export const toggleStructure=(current:TastingStructure,key:TastingStructureKey,value:string)=>
  ({...current,[key]:current[key]===value?null:value}) as TastingStructure;
