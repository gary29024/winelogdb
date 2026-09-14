import { z } from 'zod';

const optionalText=(max:number)=>z.preprocess(value=>typeof value==='string'&&!value.trim()?null:value,z.string().trim().max(max).optional().nullable());
const optionalNumber=(schema:z.ZodNumber)=>z.preprocess(value=>{
  if(value==null||(typeof value==='string'&&!value.trim()))return null;
  if(typeof value==='string'){
    const numeric=Number(value.trim());
    return Number.isFinite(numeric)?numeric:value;
  }
  return value;
},schema.optional().nullable());

/**
 * Release/bottle-specific sparkling-wine facts.
 *
 * These deliberately do not live on the cuvée: dosage, assemblage and especially
 * disgorgement can change between releases of the same NV wine. Dates are text
 * rather than ISO-only because producers commonly print only a month/year or a
 * phrase such as "disgorged Spring 2024".
 */
export const sparklingDetailsSchema=z.object({
  dosageGPerL:optionalNumber(z.number().min(0).max(100)),
  dosageCategory:optionalText(80),
  disgorgement:optionalText(100),
  tirage:optionalText(100),
  baseVintage:optionalNumber(z.number().int().min(1000).max(2200)),
  reserveWinePercentage:optionalNumber(z.number().min(0).max(100)),
  leesAgeingMonths:optionalNumber(z.number().min(0).max(600)),
  lotCode:optionalText(120),
  assemblage:optionalText(700),
  reserveWineDetail:optionalText(500),
  malolactic:optionalText(300),
  fermentationElevage:optionalText(700),
  otherTechnicalDetails:optionalText(1200)
}).strict();

export type SparklingDetails=z.infer<typeof sparklingDetailsSchema>;

export const emptySparklingDetails:SparklingDetails={
  dosageGPerL:null,dosageCategory:null,disgorgement:null,tirage:null,
  baseVintage:null,reserveWinePercentage:null,leesAgeingMonths:null,lotCode:null,
  assemblage:null,reserveWineDetail:null,malolactic:null,fermentationElevage:null,otherTechnicalDetails:null
};

export function hasSparklingDetails(details:SparklingDetails|null|undefined){
  if(!details)return false;
  return Object.values(details).some(value=>value!==null&&value!==undefined&&String(value).trim()!=='');
}
