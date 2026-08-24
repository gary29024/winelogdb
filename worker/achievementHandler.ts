import { achievementDefinitions } from '../src/features/achievements/definitions';
import { buildAllAchievementProgress } from '../src/features/achievements/engine';
import type { AchievementCuveeIdentity,AchievementProducerIdentity,AchievementWine } from '../src/features/achievements/types';

type WineRow={id:string;producer_id:string|null;cuvee_id:string|null;producer:string;wine_name:string;vintage:number|null;appellation:string|null};
type ProducerRow={id:string;canonical_name:string};
type ProducerAliasRow={producer_id:string;display_alias:string};
type CuveeRow={id:string;producer_id:string;canonical_name:string;appellation:string|null};
type CuveeAliasRow={cuvee_id:string;display_alias:string};

function groupedAliases<T extends {display_alias:string}>(rows:T[],id:(row:T)=>string){
  const result=new Map<string,string[]>();
  for(const row of rows){const key=id(row),values=result.get(key)??[];if(row.display_alias&&!values.includes(row.display_alias))values.push(row.display_alias);result.set(key,values)}
  return result;
}

export async function loadAchievementProgress(db:D1Database,owner:string){
  const [winesResult,producersResult,producerAliasesResult,cuveesResult,cuveeAliasesResult]=await Promise.all([
    db.prepare(`SELECT id,producer_id,cuvee_id,producer,wine_name,vintage,NULLIF(trim(appellation),'') appellation FROM wines WHERE owner_id=?`).bind(owner).all<WineRow>(),
    db.prepare(`SELECT id,canonical_name FROM producers WHERE owner_id=?`).bind(owner).all<ProducerRow>(),
    db.prepare(`SELECT producer_id,display_alias FROM producer_aliases WHERE owner_id=?`).bind(owner).all<ProducerAliasRow>(),
    db.prepare(`SELECT id,producer_id,canonical_name,NULLIF(trim(appellation),'') appellation FROM cuvees WHERE owner_id=?`).bind(owner).all<CuveeRow>(),
    db.prepare(`SELECT cuvee_id,display_alias FROM cuvee_aliases WHERE owner_id=?`).bind(owner).all<CuveeAliasRow>()
  ]);
  const producerAliases=groupedAliases(producerAliasesResult.results,row=>row.producer_id),cuveeAliases=groupedAliases(cuveeAliasesResult.results,row=>row.cuvee_id);
  const producers:AchievementProducerIdentity[]=producersResult.results.map(row=>({id:row.id,canonicalName:row.canonical_name,aliases:producerAliases.get(row.id)??[]}));
  const cuvees:AchievementCuveeIdentity[]=cuveesResult.results.map(row=>({id:row.id,producerId:row.producer_id,canonicalName:row.canonical_name,aliases:cuveeAliases.get(row.id)??[],appellation:row.appellation}));
  const wines:AchievementWine[]=winesResult.results.map(row=>({id:row.id,producerId:row.producer_id,cuveeId:row.cuvee_id,producer:row.producer,wineName:row.wine_name,vintage:row.vintage,appellation:row.appellation}));
  return buildAllAchievementProgress(achievementDefinitions,{producers,cuvees},wines);
}
