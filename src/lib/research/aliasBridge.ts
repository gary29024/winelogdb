import { normalizeProducerAlias } from '../producers/entities';
import { missingTable } from '../db/ownerRevision';

/**
 * Every normalized producer name this owner has confirmed means the same producer.
 *
 * The first entry is always the name as given, so a caller can use the result
 * directly as its lookup order and a producer with no recorded alias costs one
 * indexed read and nothing else.
 *
 * Manual aliases and merges are account-scoped corrections. They may help this
 * owner find a friend's reusable research, but another member must not inherit
 * the correction merely because both journals share the same deployment.
 * Nothing is inferred from spelling distance.
 */
export async function producerNameVariants(db:D1Database,owner:string,producer:string):Promise<string[]>{
  const key=normalizeProducerAlias(producer);
  if(!key)return [];
  try{
    const rows=await db.prepare(
      `SELECT producer_key AS name FROM producer_alias_pool WHERE owner_id=? AND normalized_alias=?
       UNION SELECT normalized_alias AS name FROM producer_alias_pool WHERE owner_id=? AND producer_key=?`
    ).bind(owner,key,owner,key).all<{name:string}>();
    const variants=(rows.results??[]).map(row=>row.name).filter(name=>name&&name!==key);
    return [key,...new Set(variants)];
  }catch(error){
    if(missingTable(error))return [key];
    throw error;
  }
}

/** Record a confirmed equivalence for this owner's reuse lookups only. */
export async function rememberProducerAlias(db:D1Database,owner:string,alias:string,canonical:string){
  const from=normalizeProducerAlias(alias),to=normalizeProducerAlias(canonical);
  if(!from||!to||from===to)return;
  await db.prepare('INSERT OR IGNORE INTO producer_alias_pool(owner_id,normalized_alias,producer_key) VALUES(?,?,?)')
    .bind(owner,from,to).run()
    .catch(error=>{if(!missingTable(error))throw error});
}
