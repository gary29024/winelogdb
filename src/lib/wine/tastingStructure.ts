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
  return Boolean(value&&Object.values(value).some(item=>item!=null&&item!==''));
}

export const structureValueLabel:Record<string,string>={
  low:'Low',light:'Light',medium_minus:'M−',medium:'M',medium_plus:'M+',high:'High',pronounced:'Pronounced',full:'Full',short:'Short',long:'Long'
};
