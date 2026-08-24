import { z } from 'zod';
import { normalizeAchievementIdentity } from './engine';
import type {
  AchievementCatalogueOptions,AchievementCatalogueRule,AchievementDefinition,AchievementDefinitionItem,AchievementIconKey,CustomAchievementInput,CustomAchievementManualItem
} from './types';

const iconValues=['first-growth','judgment-paris','beaujolais-crus','bordeaux-classification','sauternes','graves','saint-emilion','burgundy-grand-cru','gevrey-grand-cru','rhone-crus','michelin-grapes'] as const satisfies readonly AchievementIconKey[];
const manualItemSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('producer'),producerId:z.string().trim().min(1).max(100)}),
  z.object({type:z.literal('cuvee'),cuveeId:z.string().trim().min(1).max(100)}),
  z.object({type:z.literal('appellation'),appellation:z.string().trim().min(1).max(120)})
]);
export const achievementCatalogueRuleSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('producer_cuvees'),producerId:z.string().trim().min(1).max(100),producerName:z.string().trim().min(1).max(140)}),
  z.object({type:z.literal('appellation_producers'),appellation:z.string().trim().min(1).max(120)}),
  z.object({type:z.literal('region_producers'),region:z.string().trim().min(1).max(120),country:z.string().trim().max(120).nullable().optional()})
]);
export const customAchievementInputSchema=z.object({
  title:z.string().trim().min(2).max(80),
  subtitle:z.string().trim().max(180).default(''),
  icon:z.enum(iconValues),
  mode:z.enum(['manual','catalogue']),
  items:z.array(manualItemSchema).max(120).optional(),
  rule:achievementCatalogueRuleSchema.optional()
}).superRefine((value,ctx)=>{
  if(value.mode==='manual'&&!value.items?.length)ctx.addIssue({code:'custom',path:['items'],message:'Choose at least one catalogue target'});
  if(value.mode==='catalogue'&&!value.rule)ctx.addIssue({code:'custom',path:['rule'],message:'Choose a catalogue rule'});
});

export type StoredCustomAchievementCollection={
  id:string;
  title:string;
  subtitle:string;
  icon:AchievementIconKey;
  mode:'manual'|'catalogue';
  items:CustomAchievementManualItem[];
  rule:AchievementCatalogueRule|null;
};

function producerByIdOrName(id:string,name:string,options:AchievementCatalogueOptions){
  return options.producers.find(item=>item.id===id)??options.producers.find(item=>normalizeAchievementIdentity(item.name)===normalizeAchievementIdentity(name));
}
function producerItem(id:string,options:AchievementCatalogueOptions):AchievementDefinitionItem|null{
  const producer=options.producers.find(item=>item.id===id);if(!producer)return null;
  return {id:`producer:${producer.id}`,label:producer.name,selector:{type:'producer',producerId:producer.id,producerNames:[producer.name]}};
}
function cuveeItem(id:string,options:AchievementCatalogueOptions):AchievementDefinitionItem|null{
  const cuvee=options.cuvees.find(item=>item.id===id);if(!cuvee)return null;
  return {id:`cuvee:${cuvee.id}`,label:`${cuvee.producerName} · ${cuvee.name}`,selector:{type:'cuvee',producerId:cuvee.producerId,cuveeId:cuvee.id,producerNames:[cuvee.producerName],cuveeNames:[cuvee.name],...(cuvee.appellation?{appellationNames:[cuvee.appellation]}:{})}};
}
function appellationItem(name:string):AchievementDefinitionItem{
  const clean=name.trim();return {id:`appellation:${normalizeAchievementIdentity(clean)}`,label:clean,selector:{type:'appellation',appellationNames:[clean]}};
}
function dedupe(items:Array<AchievementDefinitionItem|null>){
  const seen=new Set<string>();
  return items.filter((item):item is AchievementDefinitionItem=>{if(!item||seen.has(item.id))return false;seen.add(item.id);return true});
}

export function materializeManualAchievementItems(items:CustomAchievementManualItem[],options:AchievementCatalogueOptions){
  return dedupe(items.map(item=>item.type==='producer'?producerItem(item.producerId,options):item.type==='cuvee'?cuveeItem(item.cuveeId,options):appellationItem(item.appellation)));
}

export function materializeCatalogueAchievementItems(rule:AchievementCatalogueRule,options:AchievementCatalogueOptions){
  if(rule.type==='producer_cuvees'){
    const producer=producerByIdOrName(rule.producerId,rule.producerName,options);if(!producer)return [];
    return dedupe(options.cuvees.filter(item=>item.catalogBacked&&item.producerId===producer.id).sort((a,b)=>a.name.localeCompare(b.name)).map(item=>cuveeItem(item.id,options)));
  }
  if(rule.type==='appellation_producers'){
    const target=normalizeAchievementIdentity(rule.appellation),ids=new Set(options.cuvees.filter(item=>item.catalogBacked&&normalizeAchievementIdentity(item.appellation??'')===target).map(item=>item.producerId));
    return dedupe([...ids].map(id=>producerItem(id,options)).sort((a,b)=>(a?.label??'').localeCompare(b?.label??'')));
  }
  const region=normalizeAchievementIdentity(rule.region),country=normalizeAchievementIdentity(rule.country??'');
  return dedupe(options.producers.filter(item=>item.catalogCount>0&&normalizeAchievementIdentity(item.region??'')===region&&(!country||normalizeAchievementIdentity(item.country??'')===country)).sort((a,b)=>a.name.localeCompare(b.name)).map(item=>producerItem(item.id,options)));
}

export function materializeCustomAchievementDefinition(record:StoredCustomAchievementCollection,options:AchievementCatalogueOptions):AchievementDefinition{
  const items=record.mode==='catalogue'&&record.rule?materializeCatalogueAchievementItems(record.rule,options):materializeManualAchievementItems(record.items,options);
  return {
    id:record.id,title:record.title,subtitle:record.subtitle,category:'regional-exploration',icon:record.icon,items,references:[],
    origin:record.mode==='catalogue'?'catalogue':'custom',editable:true,...(record.mode==='catalogue'&&record.rule?{catalogueRule:record.rule}:{})
  };
}

export function catalogueRuleTargetCount(rule:AchievementCatalogueRule,options:AchievementCatalogueOptions){return materializeCatalogueAchievementItems(rule,options).length}
export function normalizedCustomAchievementInput(input:CustomAchievementInput):CustomAchievementInput{
  return {...input,title:input.title.trim(),subtitle:input.subtitle.trim(),items:input.mode==='manual'?(input.items??[]):undefined,rule:input.mode==='catalogue'?input.rule:undefined};
}
