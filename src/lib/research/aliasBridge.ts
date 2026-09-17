import { normalizeProducerAlias } from '../producers/entities';
import { missingTable } from '../db/ownerRevision';

/**
 * Every normalized producer name that is known to mean the same producer.
 *
 * The first entry is always the name as given, so a caller can use the result
 * directly as its lookup order and a producer with no recorded alias costs one
 * indexed read and nothing else.
 *
 * Only equivalences a person has confirmed are here - an alias they saved or a
 * merge they performed. Nothing is inferred from spelling distance: in a shared
 * pool a wrong match serves another producer's research to everyone who logs
 * that name, and that is worse than researching it again.
 */
export async function producerNameVariants(db:D1Database,producer:string):Promise<string[]>{
  const key=normalizeProducerAlias(producer);
  if(!key)return [];
  try{
    const rows=await db.prepare(
      `SELECT producer_key AS name FROM producer_alias_pool WHERE normalized_alias=?
       UNION SELECT normalized_alias AS name FROM producer_alias_pool WHERE producer_key=?`
    ).bind(key,key).all<{name:string}>();
    const variants=(rows.results??[]).map(row=>row.name).filter(name=>name&&name!==key);
    return [key,...new Set(variants)];
  }catch(error){
    if(missingTable(error))return [key];
    throw error;
  }
}

/** Record a confirmed equivalence so every account's reuse can use it. */
export async function rememberProducerAlias(db:D1Database,owner:string,alias:string,canonical:string){
  const from=normalizeProducerAlias(alias),to=normalizeProducerAlias(canonical);
  if(!from||!to||from===to)return;
  await db.prepare('INSERT OR IGNORE INTO producer_alias_pool(normalized_alias,producer_key,confirmed_by) VALUES(?,?,?)')
    .bind(from,to,owner).run()
    .catch(error=>{if(!missingTable(error))throw error});
}
